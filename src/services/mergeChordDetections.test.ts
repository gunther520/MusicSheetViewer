import { describe, it, expect } from 'vitest';
import { ChordPosition } from '../utils/chordUtils';
import {
  chordSpecificity,
  mapMontageChordsToPage,
  mergeChordDetections,
  placeVisionOnStaffBands,
} from './mergeChordDetections';

function chord(text: string, x: number, y: number, id = text): ChordPosition {
  return {
    id,
    originalText: text,
    currentText: text,
    x,
    y,
    width: 5,
    height: 3,
    confidence: 0.8,
  };
}

describe('mergeChordDetections', () => {
  it('scores more complete chord symbols higher', () => {
    expect(chordSpecificity('Abmaj7')).toBeGreaterThan(chordSpecificity('Ab'));
    expect(chordSpecificity('Gm7/C')).toBeGreaterThan(chordSpecificity('G'));
    expect(chordSpecificity('C/E')).toBeGreaterThan(chordSpecificity('C'));
  });

  it('unions OCR and Vision and prefers the more specific nearby name', () => {
    const ocr = [chord('C', 20, 18, 'ocr-1'), chord('G', 60, 18, 'ocr-2')];
    const vision = [chord('C/E', 20.8, 18.4, 'v-1'), chord('Dm7', 40, 18, 'v-2')];
    const merged = mergeChordDetections(ocr, vision);
    const names = merged.map((item) => item.originalText);
    expect(names).toContain('C/E');
    expect(names).toContain('G');
    expect(names).toContain('Dm7');
    expect(names).not.toContain('C');
  });

  it('drops Vision hits outside detected staff chord bands', () => {
    const ocr = [chord('C', 20, 18, 'ocr-1')];
    const vision = [chord('Am', 25, 82, 'v-lyric')];
    const merged = mergeChordDetections(ocr, vision, [{ top: 12, bottom: 24 }]);
    expect(merged.map((item) => item.originalText)).toEqual(['C']);
  });

  it('maps montage-strip percents back onto the original page', () => {
    const mapped = mapMontageChordsToPage(
      [chord('Fm7', 30, 25, 'v-1')],
      {
        width: 1000,
        height: 200,
        sourceWidth: 1000,
        sourceHeight: 2000,
        slices: [
          { montageY0: 0, montageY1: 100, srcY: 80, srcH: 40 },
          { montageY0: 108, montageY1: 200, srcY: 400, srcH: 40 },
        ],
      }
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0].originalText).toBe('Fm7');
    expect(mapped[0].x).toBe(30);
    expect(mapped[0].y).toBeCloseTo((80 + 0.5 * 40) / 2000 * 100, 1);
  });

  it('uses labeled strip numbers and remaps x after a left gutter', () => {
    const mapped = mapMontageChordsToPage(
      [{ ...chord('C7', 28, 90, 'v-1'), strip: 2 }],
      {
        width: 1100,
        height: 200,
        sourceWidth: 1000,
        sourceHeight: 2000,
        gutterWidth: 100,
        slices: [
          { montageY0: 0, montageY1: 100, srcY: 80, srcH: 40 },
          { montageY0: 108, montageY1: 200, srcY: 400, srcH: 40 },
        ],
      }
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0].originalText).toBe('C7');
    expect(mapped[0].x).toBeCloseTo(((28 / 100) * 1100 - 100) / 1000 * 100, 1);
    expect(mapped[0].y).toBeCloseTo((400 + 0.55 * 40) / 2000 * 100, 1);
    expect(mapped[0].strip).toBeUndefined();
  });

  it('snaps Vision hits onto staff bands and drops far lyric false adds', () => {
    const placed = placeVisionOnStaffBands(
      [chord('C', 20, 19, 'v-1'), chord('Am', 40, 81, 'v-2')],
      [{ top: 16, bottom: 24 }]
    );
    expect(placed).toHaveLength(1);
    expect(placed[0].originalText).toBe('C');
    expect(placed[0].y).toBe(20);
  });
});
