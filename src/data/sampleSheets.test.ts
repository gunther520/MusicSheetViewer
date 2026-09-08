import { describe, it, expect } from 'vitest';
import { SAMPLE_SHEETS } from '../data/sampleSheets';
import { isValidChord, transposeChord } from '../utils/chordUtils';

describe('SAMPLE_SHEETS', () => {
  it('provides valid sample sheets with chords and metadata', () => {
    expect(SAMPLE_SHEETS.length).toBeGreaterThanOrEqual(3);

    SAMPLE_SHEETS.forEach((sheet) => {
      expect(sheet.id).toBeTruthy();
      expect(sheet.title).toBeTruthy();
      expect(sheet.imageUrl).toMatch(/(?:data:image\/svg\+xml|\/sheets\/sheet\d\.jpg)/);
      expect(sheet.defaultChords.length).toBeGreaterThan(0);

      // Verify every chord is recognized and valid
      sheet.defaultChords.forEach((chord) => {
        expect(isValidChord(chord.originalText)).toBe(true);
        expect(chord.x).toBeGreaterThanOrEqual(0);
        expect(chord.x).toBeLessThanOrEqual(100);
        expect(chord.y).toBeGreaterThanOrEqual(0);
        expect(chord.y).toBeLessThanOrEqual(100);
      });
    });
  });

  it('transposes all chords in Pop Ballad one key lower (-2 semitones)', () => {
    const popSheet = SAMPLE_SHEETS.find((s) => s.id === 'pop-ballad')!;
    expect(popSheet).toBeDefined();

    const originalChords = popSheet.defaultChords.map((c) => c.originalText);
    expect(originalChords.slice(0, 4)).toEqual(['C', 'G', 'Am', 'F']);

    // One key lower (-2 semitones) with flats:
    const transposed = originalChords.map((c) => transposeChord(c, -2, 'flats'));
    expect(transposed.slice(0, 4)).toEqual(['Bb', 'F', 'Gm', 'Eb']);
  });

  it('transposes all chords in Jazz Autumn one key lower (-2 semitones)', () => {
    const jazzSheet = SAMPLE_SHEETS.find((s) => s.id === 'jazz-autumn')!;
    expect(jazzSheet).toBeDefined();

    const originalChords = jazzSheet.defaultChords.map((c) => c.originalText);
    expect(originalChords.slice(0, 4)).toEqual(['Am7', 'D7', 'Gmaj7', 'Cmaj7']);

    // One key lower (-2 semitones):
    const transposed = originalChords.map((c) => transposeChord(c, -2, 'flats'));
    expect(transposed.slice(0, 4)).toEqual(['Gm7', 'C7', 'Fmaj7', 'Bbmaj7']);
  });

  it('transposes all chords in Rock Acoustic one key lower (-2 semitones) including slash chords', () => {
    const rockSheet = SAMPLE_SHEETS.find((s) => s.id === 'rock-acoustic')!;
    expect(rockSheet).toBeDefined();

    const originalChords = rockSheet.defaultChords.map((c) => c.originalText);
    expect(originalChords.slice(0, 4)).toEqual(['D', 'A/C#', 'Bm', 'F#m']);

    // One key lower (-2 semitones):
    // D -> C, A/C# -> G/B, Bm -> Am, F#m -> Em
    const transposed = originalChords.map((c) => transposeChord(c, -2, 'flats'));
    expect(transposed.slice(0, 4)).toEqual(['C', 'G/B', 'Am', 'Em']);
  });
});
