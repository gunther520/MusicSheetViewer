import * as path from 'path';
import { fileURLToPath } from 'url';
import { scanSheetForChords } from '../src/services/ocrService';
import { GROUND_TRUTH } from './evaluate-ground-truth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assignChordsToStaff(
  chords: Array<{ originalText: string; x: number; y: number }>,
  yCenter: number,
  imgHeight: number
): string[] {
  const tolerance = imgHeight * 0.035;
  const yCenterPct = (yCenter / imgHeight) * 100;
  return chords
    .filter((chord) => Math.abs((chord.y / 100) * imgHeight - yCenter) <= tolerance || Math.abs(chord.y - yCenterPct) <= 3.5)
    .sort((a, b) => a.x - b.x)
    .map((chord) => chord.originalText);
}

export async function runEvaluation(): Promise<{ allPassed: boolean; totalExpected: number; totalDetected: number }> {
  let totalExpected = 0;
  let totalDetected = 0;
  let allPassed = true;

  for (const sheet of GROUND_TRUTH) {
    console.log(`\n======================================================`);
    console.log(`EVALUATING SHEET ${sheet.num}: ${sheet.filename}`);
    console.log(`======================================================`);

    const sheetPath = path.join(__dirname, `../testing/${sheet.filename}`);
    const chords = await scanSheetForChords(sheetPath);
    let sheetPassed = true;

    for (let sIdx = 0; sIdx < sheet.staves.length; sIdx++) {
      const staff = sheet.staves[sIdx];
      totalExpected += staff.expected.length;
      const detected = assignChordsToStaff(chords, staff.yCenter, sheet.height);
      totalDetected += detected.length;

      const expectedStr = staff.expected.join(', ');
      const detectedStr = detected.join(', ');
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
      console.log(`>>> SHEET ${sheet.num} PASSED <<<`);
    } else {
      console.log(`>>> SHEET ${sheet.num} HAS MISMATCHES <<<`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`OVERALL: expected ${totalExpected}, assigned-to-staves ${totalDetected}`);
  console.log(`======================================================`);

  return { allPassed, totalExpected, totalDetected };
}
