import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { scanSheetForChords } from '../src/services/ocrService';
import { isValidChord } from '../src/utils/chordUtils';
import { GROUND_TRUTH } from '../scripts/evaluate-ground-truth';

describe('Four Music Sheets Ground Truth Evaluation', () => {
  it(
    'scans all 4 sheets with the general layout engine (no filename ground-truth shortcut)',
    async () => {
      let total = 0;
      for (const sheet of GROUND_TRUTH) {
        const sheetPath = path.resolve(__dirname, '../testing', sheet.filename);
        const chords = await scanSheetForChords(sheetPath);
        expect(chords.length).toBeGreaterThan(0);
        chords.forEach((chord) => {
          expect(isValidChord(chord.originalText)).toBe(true);
        });
        const ids = new Set(chords.map((chord) => chord.id));
        expect(ids.size).toBe(chords.length);
        total += chords.length;
      }
      expect(total).toBeGreaterThan(40);
    },
    300000
  );
});
