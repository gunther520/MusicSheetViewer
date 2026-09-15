import { ChordPosition } from '../utils/chordUtils';

export function chordSpecificity(name: string): number {
  const n = name.trim();
  if (!n) return 0;
  let score = n.length;
  if (/maj|min|sus|dim|aug|add|alt/i.test(n)) score += 4;
  if (/[0-9]/.test(n)) score += 2;
  if (n.includes('/')) score += 2;
  if (/[#b]/.test(n)) score += 1;
  if (/m(?!aj)/i.test(n.slice(1))) score += 1;
  return score;
}

function near(a: ChordPosition, b: ChordPosition, xTol = 4.6, yTol = 3.8): boolean {
  return Math.abs(a.x - b.x) <= xTol && Math.abs(a.y - b.y) <= yTol;
}

function inKeepBands(chord: ChordPosition, keepYRangesPct?: Array<{ top: number; bottom: number }>): boolean {
  if (!keepYRangesPct || keepYRangesPct.length === 0) return true;
  const y = chord.y;
  return keepYRangesPct.some((range) => y >= range.top && y <= range.bottom);
}

/**
 * Union OCR and Vision detections. No filename/piece logic.
 * When staff chord bands are known, Vision hits outside those bands are dropped.
 * Nearby duplicates keep the more specific symbol and the OCR box when possible.
 */
export function mergeChordDetections(
  ocr: ChordPosition[],
  vision: ChordPosition[],
  keepYRangesPct?: Array<{ top: number; bottom: number }>
): ChordPosition[] {
  const merged: ChordPosition[] = ocr.map((chord) => ({ ...chord }));
  const visionKept = vision.filter((chord) => inKeepBands(chord, keepYRangesPct));

  visionKept.forEach((hit, index) => {
    const match = merged.find((existing) => near(existing, hit));
    if (match) {
      if (chordSpecificity(hit.originalText) > chordSpecificity(match.originalText)) {
        match.originalText = hit.originalText;
        match.currentText = hit.originalText;
        match.confidence = Math.max(match.confidence ?? 0, hit.confidence ?? 0);
      }
      return;
    }
    merged.push({
      ...hit,
      id: `vision-${index + 1}-${Date.now()}`,
    });
  });

  merged.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const deduped: ChordPosition[] = [];
  merged.forEach((chord) => {
    const prev = deduped[deduped.length - 1];
    if (prev && near(prev, chord, 3.2, 2.8)) {
      if (chordSpecificity(chord.originalText) > chordSpecificity(prev.originalText)) {
        prev.originalText = chord.originalText;
        prev.currentText = chord.originalText;
      }
      return;
    }
    deduped.push(chord);
  });

  return deduped;
}

export interface MontageSlice {
  montageY0: number;
  montageY1: number;
  srcY: number;
  srcH: number;
}

export interface ChordBandMontageLike {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  slices: MontageSlice[];
}

/**
 * Map Vision coordinates from a stacked chord-band montage back onto the page.
 */
export function mapMontageChordsToPage(
  chords: ChordPosition[],
  montage: ChordBandMontageLike
): ChordPosition[] {
  if (montage.height <= 0 || montage.sourceHeight <= 0) return [];

  return chords.flatMap((chord) => {
    const yPx = (chord.y / 100) * montage.height;
    let slice = montage.slices.find(
      (item) => yPx >= item.montageY0 - 1 && yPx <= item.montageY1 + 1
    );
    if (!slice && montage.slices.length > 0) {
      slice = montage.slices.reduce((best, item) => {
        const mid = (item.montageY0 + item.montageY1) / 2;
        const bestMid = (best.montageY0 + best.montageY1) / 2;
        return Math.abs(yPx - mid) < Math.abs(yPx - bestMid) ? item : best;
      });
      const mid = (slice.montageY0 + slice.montageY1) / 2;
      if (Math.abs(yPx - mid) > 18) return [];
    }
    if (!slice) return [];

    const span = Math.max(1, slice.montageY1 - slice.montageY0);
    const t = Math.max(0, Math.min(1, (yPx - slice.montageY0) / span));
    const srcY = slice.srcY + t * slice.srcH;
    const pageY = (srcY / montage.sourceHeight) * 100;
    const heightPx = ((chord.height || 3) / 100) * montage.height;
    const pageHeight = (heightPx / montage.sourceHeight) * 100;

    return [{
      ...chord,
      x: Math.max(0, Math.min(96, chord.x)),
      y: Math.max(0, Math.min(96, pageY)),
      width: chord.width || 5,
      height: Math.max(2, pageHeight),
    }];
  });
}
