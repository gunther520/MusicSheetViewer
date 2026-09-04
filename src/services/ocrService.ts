import { createWorker } from 'tesseract.js';
import { ChordPosition, isLikelyChordSymbol, normalizeAccidentals, isValidChord } from '../utils/chordUtils';

export interface ScanProgress {
  status: string;
  progress: number;
}

export interface CandidateToken {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

/**
 * Clean up common OCR artifacts on musical chord symbols, handling common misreadings
 * like slash chord characters, bracket enclosures, and misread accidentals.
 */
export function cleanOcrToken(token: string): string[] {
  let cleaned = token.trim();
  if (!cleaned) return [];

  // Strip brackets, quotes, punctuation
  cleaned = cleaned.replace(/^[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+/, '');
  cleaned = cleaned.replace(/[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+$/, '');
  cleaned = normalizeAccidentals(cleaned);

  // Common composite OCR strings, e.g. "F(G/F" -> ["F", "G/F"] or "F/G/F" -> ["F", "G/F"]
  if (cleaned.includes('(')) {
    const parts = cleaned.split('(').map(p => cleanSingleChordToken(p)).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Handle concatenated chords like "FG" or "DmG"
  const single = cleanSingleChordToken(cleaned);
  return single ? [single] : [];
}

/**
 * Clean and normalize a single potential chord token
 */
function cleanSingleChordToken(token: string): string {
  let str = token.trim();
  str = str.replace(/^[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+/, '');
  str = str.replace(/[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_\-]+$/, '');
  if (!str) return '';

  // 1. Fix common slash chord misreads:
  // e.g. "CIE" -> "C/E", "C1E" -> "C/E", "C|E" -> "C/E", "C/Bb" -> "C/Bb", "CIBb" -> "C/Bb"
  str = str.replace(/^([A-G][#b]?)[I|l1\\]([A-G][#b]?)$/i, '$1/$2');

  // e.g. "F/G" where slash was recognized as bracket or parenthesis "F]G" or "F)G"
  str = str.replace(/^([A-G][#b]?)[\]\)\}>]([A-G][#b]?)$/i, '$1/$2');

  // e.g. "F(G/F" -> handled by split earlier

  // 2. Fix flat symbol misread as lowercase 'b' or uppercase 'B' on root notes
  // e.g. "Bb" vs "BB" (if someone wrote Bb and OCR read BB)
  // But check if it's already a valid chord
  if (isValidChord(str)) {
    return str;
  }

  // Try capitalizing root note
  if (/^[a-g]/i.test(str)) {
    const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
    if (isValidChord(capitalized)) {
      return capitalized;
    }
  }

  return str;
}

/**
 * Post-processes recognized chords:
 * 1. Clusters chords into horizontal staff reading lines (chords on the same staff share similar Y coords)
 * 2. Filters out stray lyric syllables and low-confidence isolated tokens far below staves
 * 3. Removes duplicates and overlapping boxes
 */
export function filterAndClusterChords(
  tokens: CandidateToken[],
  imgWidth: number,
  imgHeight: number
): ChordPosition[] {
  const validTokens: CandidateToken[] = [];

  tokens.forEach((t) => {
    const cleanedArr = cleanOcrToken(t.text);
    cleanedArr.forEach((cleaned, index) => {
      // Must be a recognized musical chord symbol
      if (!isLikelyChordSymbol(cleaned)) return;

      // Minimum confidence threshold (0-100)
      if (t.confidence < 25) return;

      // Exclude tokens in extreme header / footer areas
      // Top 5% (page counter, title) or bottom 5% (copyright, publisher)
      const yPercent = (t.y0 / imgHeight) * 100;
      if (yPercent < 6 || yPercent > 94) return;

      // Offset X if a single token split into multiple chords (like "F(G/F")
      const widthDelta = (t.x1 - t.x0) / cleanedArr.length;
      const x0 = t.x0 + index * widthDelta;
      const x1 = x0 + widthDelta;

      validTokens.push({
        text: cleaned,
        x0,
        y0: t.y0,
        x1,
        y1: t.y1,
        confidence: t.confidence,
      });
    });
  });

  if (validTokens.length === 0) return [];

  // Group tokens by Y coordinate into horizontal chord lines (tolerance: within ~3.5% of sheet height)
  const yTolerance = imgHeight * 0.038;
  const lines: CandidateToken[][] = [];

  // Sort tokens primarily by Y, then by X
  validTokens.sort((a, b) => a.y0 - b.y0);

  validTokens.forEach((token) => {
    const tokenMidY = (token.y0 + token.y1) / 2;
    let placedInLine = false;

    for (const line of lines) {
      const lineAvgY = line.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / line.length;
      if (Math.abs(tokenMidY - lineAvgY) <= yTolerance) {
        line.push(token);
        placedInLine = true;
        break;
      }
    }

    if (!placedInLine) {
      lines.push([token]);
    }
  });

  // Filter lines: On music lead sheets, authentic chord rows typically have multiple chords,
  // whereas stray lyrics or random noise appear as isolated single low-confidence lowercase/single-character items
  const filteredTokens: CandidateToken[] = [];

  lines.forEach((line) => {
    // If a line has only 1 chord candidate, check if it's high quality or suspiciously isolated noise
    if (line.length === 1) {
      const single = line[0];
      // Isolated single letter or ambiguous lowercase like "b", "a", "em" with moderate confidence is often lyrics
      if (single.text.length <= 2 && single.confidence < 75) {
        return; // drop isolated noise
      }
    }

    // Sort tokens within line left-to-right
    line.sort((a, b) => a.x0 - b.x0);

    // Deduplicate tokens that are almost at the same X position within the same row
    const deduplicated: CandidateToken[] = [];
    line.forEach((tok) => {
      const prev = deduplicated[deduplicated.length - 1];
      if (prev && Math.abs(tok.x0 - prev.x0) < imgWidth * 0.03) {
        // Keep the one with higher confidence or longer chord name
        if (tok.confidence > prev.confidence || tok.text.length > prev.text.length) {
          deduplicated[deduplicated.length - 1] = tok;
        }
      } else {
        deduplicated.push(tok);
      }
    });

    filteredTokens.push(...deduplicated);
  });

  // Map to ChordPosition with percentage coordinates
  let idCounter = 1;
  return filteredTokens.map((t) => {
    const xPercent = (t.x0 / imgWidth) * 100;
    const yPercent = (t.y0 / imgHeight) * 100;
    const widthPercent = ((t.x1 - t.x0) / imgWidth) * 100;
    const heightPercent = ((t.y1 - t.y0) / imgHeight) * 100;

    return {
      id: `ocr-${idCounter++}-${Date.now()}`,
      originalText: t.text.charAt(0).toUpperCase() + t.text.slice(1),
      currentText: t.text.charAt(0).toUpperCase() + t.text.slice(1),
      x: Math.max(0, Math.min(96, xPercent)),
      y: Math.max(0, Math.min(96, yPercent)),
      width: Math.max(3, widthPercent),
      height: Math.max(2, heightPercent),
      confidence: t.confidence / 100,
    };
  });
}

/**
 * Scans an image URL or Data URL for chord symbols using Tesseract OCR
 */
export async function scanSheetForChords(
  imageSource: string | HTMLImageElement,
  onProgress?: (progress: ScanProgress) => void
): Promise<ChordPosition[]> {
  onProgress?.({ status: 'Loading OCR engine...', progress: 0.1 });

  // Load image to get natural dimensions
  const img = await loadImage(imageSource);
  const imgWidth = img.naturalWidth || img.width;
  const imgHeight = img.naturalHeight || img.height;

  onProgress?.({ status: 'Analyzing sheet music image...', progress: 0.3 });

  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        onProgress?.({
          status: `Recognizing chords (${Math.round(m.progress * 100)}%)...`,
          progress: 0.3 + m.progress * 0.6,
        });
      }
    },
  });

  try {
    const ret = await worker.recognize(img);
    await worker.terminate();

    onProgress?.({ status: 'Filtering & aligning chord positions...', progress: 0.95 });

    const candidateTokens: CandidateToken[] = [];
    if (ret.data && ret.data.words) {
      ret.data.words.forEach((w) => {
        candidateTokens.push({
          text: w.text,
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
          confidence: w.confidence,
        });
      });
    }

    const chords = filterAndClusterChords(candidateTokens, imgWidth, imgHeight);

    onProgress?.({ status: 'Completed!', progress: 1 });
    return chords;
  } catch (error) {
    console.error('OCR Error:', error);
    try {
      await worker.terminate();
    } catch {
      // ignore
    }
    throw error;
  }
}

function loadImage(source: string | HTMLImageElement): Promise<HTMLImageElement> {
  if (typeof source !== 'string') {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = source;
  });
}
