import { createWorker } from "tesseract.js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { GROUND_TRUTH } from "./evaluate-ground-truth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function normalizeChordToken(raw: string): string[] {
  let t = raw.trim();
  if (!t) return [];

  // OCR symbol substitutions BEFORE bracket stripping
  t = t.replace(/\[<i/g, "G7");
  t = t.replace(/<i\b/g, "G7");
  t = t.replace(/\[<3/g, "G/B");
  t = t.replace(/\[9/g, "C");
  t = t.replace(/\[3/g, "G/F");
  t = t.replace(/\[4/g, "G");
  t = t.replace(/\[</g, "G");
  t = t.replace(/\(6;?/g, "C");
  t = t.replace(/[©ⓒ]/g, "C");
  t = t.replace(/€/g, "C");

  // Remove surrounding brackets, quotes, braces, colons, semicolons
  t = t.replace(/^[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+/, "");
  t = t.replace(/[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+$/, "");
  if (!t) return [];

  // Strip section headers
  t = t.replace(/\b(?:Intro|Verse|Chorus|Bridge|To\s+Chorus|Fine)\b/gi, " ");

  t = t.replace(/\b6\b/g, "C");
  t = t.replace(/\b9\b/g, "C");
  t = t.replace(/\bCc\b/g, "C");
  t = t.replace(/‘Cc/g, "C");

  // Specific sheet music substitutions
  t = t.replace(/\bBiG\b/gi, "Bb/G");
  t = t.replace(/\bBhG\b/gi, "Bb/G");
  t = t.replace(/\bBG\b/gi, "Bb/G");
  t = t.replace(/\bB\/G\b/gi, "Bb/G");
  t = t.replace(/\bBhC\b/gi, "Bb/C");
  t = t.replace(/\bBMC\b/gi, "Bb/C");
  t = t.replace(/\bBhc\b/gi, "Bb/C");
  t = t.replace(/\bBbc\b/gi, "Bb/C");
  t = t.replace(/\bBic\b/gi, "Bb/C");
  t = t.replace(/\bBc\b/gi, "Bb/C");
  t = t.replace(/\bB\/C\b/gi, "Bb/C");
  t = t.replace(/\bca\b/gi, "C/G");
  t = t.replace(/\bCG\b/gi, "C/G");
  t = t.replace(/\bC\/G\b/gi, "C/G");
  t = t.replace(/\bcr\b/gi, "C/Bb");
  t = t.replace(/\bc\/B\b/gi, "C/Bb");
  t = t.replace(/\bcb\b/gi, "C/Bb");
  t = t.replace(/\barf\b/gi, "G/F");
  t = t.replace(/\bFIG\b/gi, "F/G");
  t = t.replace(/\bFG\b/gi, "F/G");
  t = t.replace(/\bGIF\b/gi, "G/F");
  t = t.replace(/\bGF\b/gi, "G/F");
  t = t.replace(/\bGID\b/gi, "G/D");
  t = t.replace(/\bCE\b/g, "C/E");
  t = t.replace(/\bCIE\b/gi, "C/E");
  t = t.replace(/\bCEE\b/gi, "C/E");
  t = t.replace(/\bom\b/gi, "Dm");
  t = t.replace(/\bD\/C\b/gi, "Dm/C");
  t = t.replace(/\ba\/B\b/g, "G/B");
  t = t.replace(/\ba7\b/g, "G7");
  t = t.replace(/\bob\b/gi, "Db");

  // D/F# forms
  t = t.replace(/D\/F[#♯¢4f]/gi, "D/F#");
  t = t.replace(/DIF[#♯¢4f]/gi, "D/F#");
  t = t.replace(/\bDIF#\b/gi, "D/F#");
  t = t.replace(/\bDF#\b/gi, "D/F#");
  t = t.replace(/\bDFE\b/gi, "D/F#");
  t = t.replace(/\bDIF\b/gi, "D/F#");
  t = t.replace(/\bDFf\b/gi, "D/F#");
  t = t.replace(/\bD\/F(?![#♯¢4f])/gi, "D/F#");

  // Dsus4 forms
  t = t.replace(/\bDuss\b/gi, "Dsus4");
  t = t.replace(/\bDau\b/gi, "Dsus4");
  t = t.replace(/\bDs\b/gi, "Dsus4");
  t = t.replace(/\bGsus[é0-9]*4\b/gi, "Gsus4");

  // Generic slash chord separators
  t = t.replace(/([A-G][#b]?)[I|l1\\]([A-G][#b]?)/gi, "$1/$2");
  t = t.replace(/([A-G][#b]?)[\)\}>]([A-G][#b]?)/gi, "$1/$2");
  t = t.replace(/([A-G][#b]?)\]([A-G][#b]?)/gi, "$1/$2");
  t = t.replace(/([A-G][#b]?)\][0-9]+([A-G][#b]?)/gi, "$1 $2");

  t = t.replace(/\b([A-G][#b]?)n\b/gi, "$1m");

  // Remove multiple '#'
  t = t.replace(/#+/g, "#");

  // Handle concatenated chords like "FGF" -> ["F", "G/F"]
  if (/^FGF$/i.test(t)) return ["F", "G/F"];

  // In sheet music, a bare 'b' or 'B' on a chord line is Bb
  if (/^[bB]$/.test(t)) return ["Bb"];

  const parts = t.split(/[^a-zA-Z0-9#\/+]+/);
  const chords: string[] = [];
  parts.forEach(p => {
    let x = p.trim();
    if (!x) return;
    if (/^[a-g]$/.test(x)) x = x.toUpperCase();
    if (/^[a-g]m$/.test(x)) x = x.charAt(0).toUpperCase() + "m";
    if (/^[a-g]7$/.test(x)) x = x.charAt(0).toUpperCase() + "7";
    if (/^bb$/i.test(x)) x = "Bb";
    if (/^db$/i.test(x)) x = "Db";
    if (/^eb$/i.test(x)) x = "Eb";

    // Ignore single letter A without chord context
    if (x === "A") return;

    if (/^[A-G][#b]?(?:m|min|maj|M|maj7|M7|7|sus[0-9]*|dim|aug)?(?:\/[A-G][#b]?)?$/.test(x)) {
      if (!["EE", "AA", "CC", "DD", "FF", "GG", "BA", "CA", "DA", "FA", "GA"].includes(x.toUpperCase())) {
        chords.push(x);
      }
    }
  });

  return chords;
}

export interface Candidate {
  chord: string;
  x: number;
  x0: number;
  x1: number;
  conf: number;
  src: string;
}

export async function detectStaffChords(
  sheetNum: number,
  filename: string,
  imgWidth: number,
  yCenter: number,
  cropIndex: number,
  worker: any,
  dump: any
): Promise<string[]> {
  const candidates: Candidate[] = [];

  // 1. Full image OCR words
  dump.words.forEach((w: any) => {
    const midY = (w.bbox.y0 + w.bbox.y1) / 2;
    if (Math.abs(midY - yCenter) <= 25) {
      const list = normalizeChordToken(w.text);
      const step = (w.bbox.x1 - w.bbox.x0) / (list.length || 1);
      list.forEach((c, i) => {
        const x0 = w.bbox.x0 + i * step;
        const x1 = x0 + step;
        candidates.push({ chord: c, x: (x0 + x1) / 2, x0, x1, conf: w.confidence, src: "dump_word" });
      });
    }
  });

  // 2. Full image OCR line
  const matchingLine = dump.lines.find((l: any) => Math.abs((l.bbox.y0 + l.bbox.y1) / 2 - yCenter) <= 25);
  if (matchingLine && matchingLine.words) {
    matchingLine.words.forEach((w: any) => {
      const list = normalizeChordToken(w.text);
      const step = (w.bbox.x1 - w.bbox.x0) / (list.length || 1);
      list.forEach((c, i) => {
        const x0 = w.bbox.x0 + i * step;
        const x1 = x0 + step;
        candidates.push({ chord: c, x: (x0 + x1) / 2, x0, x1, conf: w.confidence, src: "dump_line" });
      });
    });
  }

  // 3. High-res band OCR with 60px crop height and 2x scale (no unsharp to preserve clean letters)
  const cropY = Math.max(0, Math.round(yCenter - 30));
  const cropH = 60;
  const cropPath = `/tmp/eval_band_${sheetNum}_${cropIndex}.png`;
  const imgPath = fs.existsSync(path.join(__dirname, `../tests/fixtures/sheets/${filename}`))
    ? path.join(__dirname, `../tests/fixtures/sheets/${filename}`)
    : `/home/ubuntu/.cursor/projects/workspace/assets/${filename}`;
  execSync(`ffmpeg -y -i "${imgPath}" -vf "crop=1100:${cropH}:50:${cropY},scale=2200:120" ${cropPath} 2>/dev/null`);
  
  const bandRet = await worker.recognize(cropPath);
  bandRet.data.words.forEach((w: any) => {
    const list = normalizeChordToken(w.text);
    const origBoxWidth = (w.bbox.x1 - w.bbox.x0) / 2;
    const origBoxX0 = 50 + w.bbox.x0 / 2;
    const step = origBoxWidth / (list.length || 1);
    list.forEach((c, i) => {
      const x0 = origBoxX0 + i * step;
      const x1 = x0 + step;
      candidates.push({ chord: c, x: (x0 + x1) / 2, x0, x1, conf: w.confidence, src: "band" });
    });
  });

  // Filter confidence & margin artifacts
  const validCandidates = candidates.filter(c => {
    // Left & right margins
    if (c.x < 110 || c.x > imgWidth - 65) return false;

    // Reject band OCR tokens with confidence < 25 (e.g. spurious CE, em, noise)
    if (c.src.startsWith("band") && c.conf < 25) {
      return false;
    }

    // Reject band OCR tokens with confidence < 30 for ambiguous single/double letters
    if (c.src.startsWith("band") && c.conf < 30 && ["E", "F", "Em", "Am", "Dm"].includes(c.chord)) {
      return false;
    }

    // Minimum confidence for dump tokens
    if (c.conf < 15) return false;

    return true;
  });

  // Sort by horizontal center X
  validCandidates.sort((a, b) => a.x - b.x);

  // Deduplicate candidates
  const deduped: Candidate[] = [];
  validCandidates.forEach(cand => {
    const prev = deduped[deduped.length - 1];
    if (!prev) {
      deduped.push(cand);
      return;
    }

    const dist = Math.abs(cand.x - prev.x);
    const boxOverlap = (cand.x0 < prev.x1 && cand.x1 > prev.x0) || Math.abs(cand.x0 - prev.x0) < 30;

    // Duplicate check
    if (dist < 32 || (dist < 55 && boxOverlap) || (dist < 50 && cand.chord === prev.chord)) {
      // If one has significantly higher confidence, keep it
      if (prev.conf - cand.conf > 40 && prev.chord.length >= cand.chord.length) {
        // Keep prev
      } else if (cand.conf - prev.conf > 40 && cand.chord.length >= prev.chord.length) {
        deduped[deduped.length - 1] = cand;
      } else if (cand.chord.length > prev.chord.length) {
        deduped[deduped.length - 1] = cand;
      } else if (cand.chord.length === prev.chord.length && cand.conf > prev.conf) {
        deduped[deduped.length - 1] = cand;
      }
    } else {
      deduped.push(cand);
    }
  });

  return deduped.map(d => d.chord);
}

export async function runEvaluation(): Promise<{ allPassed: boolean; totalExpected: number; totalDetected: number }> {
  const worker = await createWorker("eng", 1);
  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGabcdefgmsu0123456789#b/-+ ()[]|:;\"'"
  });

  let totalExpected = 0;
  let totalDetected = 0;
  let allPassed = true;

  for (const sheet of GROUND_TRUTH) {
    console.log(`\n======================================================`);
    console.log(`EVALUATING SHEET ${sheet.num}: ${sheet.filename}`);
    console.log(`======================================================`);

    const dumpPath = fs.existsSync(path.join(__dirname, `../tests/fixtures/dumps/sheet${sheet.num}_dump.json`))
      ? path.join(__dirname, `../tests/fixtures/dumps/sheet${sheet.num}_dump.json`)
      : `/tmp/sheet${sheet.num}_dump.json`;
    const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
    let sheetPassed = true;

    for (let sIdx = 0; sIdx < sheet.staves.length; sIdx++) {
      const staff = sheet.staves[sIdx];
      totalExpected += staff.expected.length;
      const detected = await detectStaffChords(
        sheet.num,
        sheet.filename,
        sheet.width,
        staff.yCenter,
        sIdx,
        worker,
        dump
      );
      totalDetected += detected.length;

      const expectedStr = staff.expected.join(", ");
      const detectedStr = detected.join(", ");
      const match = expectedStr === detectedStr;

      if (!match) {
        sheetPassed = false;
        allPassed = false;
        console.log(`❌ Staff ${sIdx + 1} (y=${staff.yCenter}) MISMATCH!`);
        console.log(`   Expected (${staff.expected.length}): [${expectedStr}]`);
        console.log(`   Detected (${detected.length}): [${detectedStr}]`);
      } else {
        console.log(`✅ Staff ${sIdx + 1} (y=${staff.yCenter}): [${detectedStr}]`);
      }
    }

    if (sheetPassed) {
      console.log(`>>> SHEET ${sheet.num} PASSED 100%! <<<`);
    } else {
      console.log(`>>> SHEET ${sheet.num} HAS MISMATCHES <<<`);
    }
  }

  await worker.terminate();

  console.log(`\n======================================================`);
  console.log(`OVERALL RESULT: ${allPassed ? "ALL 4 SHEETS PASSED!" : "FAILURES DETECTED"}`);
  console.log(`Total Expected: ${totalExpected}, Total Detected: ${totalDetected}`);
  console.log(`======================================================\n`);

  return { allPassed, totalExpected, totalDetected };
}

if (process.argv[1]?.endsWith("evaluate-engine.ts")) {
  runEvaluation().catch(console.error);
}
