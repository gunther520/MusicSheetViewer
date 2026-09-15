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
  const sameName = a.originalText === b.originalText;
  const xLimit = sameName ? 8.8 : xTol;
  const yLimit = sameName ? 3.6 : yTol;
  return Math.abs(a.x - b.x) <= xLimit && Math.abs(a.y - b.y) <= yLimit;
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
  gutterWidth?: number;
}

function montageSliceForChord(
  chord: ChordPosition,
  montage: ChordBandMontageLike,
  yPx: number
): MontageSlice | undefined {
  const strip = Number(chord.strip);
  if (Number.isFinite(strip) && strip >= 1 && strip <= montage.slices.length) {
    return montage.slices[Math.round(strip) - 1];
  }
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
    if (Math.abs(yPx - mid) > 18) return undefined;
  }
  return slice;
}

function montageXToPagePercent(chordX: number, montage: ChordBandMontageLike): number {
  const gutter = Math.max(0, montage.gutterWidth || 0);
  const xPx = (chordX / 100) * montage.width;
  const musicW = Math.max(1, montage.width - gutter);
  const musicX = xPx - gutter;
  return Math.max(0, Math.min(96, (musicX / musicW) * 100));
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
    const slice = montageSliceForChord(chord, montage, yPx);
    if (!slice) return [];

    const span = Math.max(1, slice.montageY1 - slice.montageY0);
    const t = Number.isFinite(Number(chord.strip))
      ? 0.55
      : Math.max(0, Math.min(1, (yPx - slice.montageY0) / span));
    const srcY = slice.srcY + t * slice.srcH;
    const pageY = (srcY / montage.sourceHeight) * 100;
    const heightPx = ((chord.height || 3) / 100) * montage.height;
    const pageHeight = (heightPx / montage.sourceHeight) * 100;
    const rest = { ...chord };
    delete rest.strip;

    return [{
      ...rest,
      x: montageXToPagePercent(chord.x, montage),
      y: Math.max(0, Math.min(96, pageY)),
      width: chord.width || 5,
      height: Math.max(2, pageHeight),
    }];
  });
}

/**
 * Snap Vision hits onto known staff chord bands and drop hits that are far from every band.
 * Reduces lyric/title false adds without using piece-specific names.
 */
export function placeVisionOnStaffBands(
  chords: ChordPosition[],
  keepYRangesPct?: Array<{ top: number; bottom: number }>,
  maxOutsidePct = 4.8
): ChordPosition[] {
  if (!keepYRangesPct || keepYRangesPct.length === 0) return chords.map((chord) => ({ ...chord }));

  return chords.flatMap((chord) => {
    let best = keepYRangesPct[0];
    let bestDist = Infinity;
    keepYRangesPct.forEach((range) => {
      const dist = chord.y < range.top
        ? range.top - chord.y
        : chord.y > range.bottom
          ? chord.y - range.bottom
          : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = range;
      }
    });
    if (bestDist > maxOutsidePct) return [];
    const mid = (best.top + best.bottom) / 2;
    return [{ ...chord, y: mid }];
  });
}
