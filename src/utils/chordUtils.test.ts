import { describe, it, expect } from 'vitest';
import {
  parseChord,
  transposeChord,
  transposeNote,
  getSemitoneDistance,
  isLikelyChordSymbol,
  normalizeAccidentals,
  getChordMidiNotes
} from './chordUtils';

describe('chordUtils', () => {
  describe('parseChord', () => {
    it('parses basic major and minor chords', () => {
      expect(parseChord('C')).toEqual({
        original: 'C',
        root: 'C',
        quality: '',
        bass: undefined,
        isValid: true
      });

      expect(parseChord('Am')).toEqual({
        original: 'Am',
        root: 'A',
        quality: 'm',
        bass: undefined,
        isValid: true
      });

      expect(parseChord('F#m7')).toEqual({
        original: 'F#m7',
        root: 'F#',
        quality: 'm7',
        bass: undefined,
        isValid: true
      });

      expect(parseChord('Bbm')).toEqual({
        original: 'Bbm',
        root: 'Bb',
        quality: 'm',
        bass: undefined,
        isValid: true
      });
    });

    it('parses slash chords with bass notes', () => {
      expect(parseChord('G/B')).toEqual({
        original: 'G/B',
        root: 'G',
        quality: '',
        bass: 'B',
        isValid: true
      });

      expect(parseChord('D/F#')).toEqual({
        original: 'D/F#',
        root: 'D',
        quality: '',
        bass: 'F#',
        isValid: true
      });

      expect(parseChord('C/E')).toEqual({
        original: 'C/E',
        root: 'C',
        quality: '',
        bass: 'E',
        isValid: true
      });
    });

    it('parses complex jazz and pop chord extensions', () => {
      expect(parseChord('Cmaj7').isValid).toBe(true);
      expect(parseChord('Dm7b5').isValid).toBe(true);
      expect(parseChord('Gsus4').isValid).toBe(true);
      expect(parseChord('A7#9').isValid).toBe(true);
      expect(parseChord('Fdim7').isValid).toBe(true);
    });

    it('handles unicode sharp and flat accidentals', () => {
      expect(normalizeAccidentals('B♭')).toBe('Bb');
      expect(normalizeAccidentals('F♯')).toBe('F#');
      expect(parseChord('B♭').root).toBe('Bb');
      expect(parseChord('F♯m').root).toBe('F#');
      expect(parseChord('CΔ').quality).toBe('maj7');
    });

    it('transposes individual notes directly', () => {
      expect(transposeNote('C', 2)).toBe('D');
      expect(transposeNote('A', -2, 'flats')).toBe('G');
      expect(transposeNote('F', 1, 'sharps')).toBe('F#');
    });

    it('rejects invalid chords', () => {
      expect(parseChord('XYZ').isValid).toBe(false);
      expect(parseChord('hello').isValid).toBe(false);
      expect(parseChord('').isValid).toBe(false);
    });
  });

  describe('transposeChord - One key lower / higher', () => {
    it('transposes one whole step lower (-2 semitones, 1 full key lower)', () => {
      // User request: "E.g. One key lower for all the chord."
      // In C major -> Bb major
      expect(transposeChord('C', -2, 'flats')).toBe('Bb');
      expect(transposeChord('Dm', -2, 'flats')).toBe('Cm');
      expect(transposeChord('Em', -2, 'flats')).toBe('Dm');
      expect(transposeChord('F', -2, 'flats')).toBe('Eb');
      expect(transposeChord('G', -2, 'flats')).toBe('F');
      expect(transposeChord('Am', -2, 'flats')).toBe('Gm');
      expect(transposeChord('Bdim', -2, 'flats')).toBe('Adim');

      // Slash chords
      expect(transposeChord('G/B', -2, 'flats')).toBe('F/A');
    });

    it('transposes one half step lower (-1 semitone)', () => {
      expect(transposeChord('C', -1)).toBe('B');
      expect(transposeChord('F', -1)).toBe('E');
      expect(transposeChord('G', -1, 'sharps')).toBe('F#');
      expect(transposeChord('Am', -1, 'sharps')).toBe('G#m');
      expect(transposeChord('D', -1, 'sharps')).toBe('C#');
    });

    it('transposes one half step higher (+1 semitone)', () => {
      expect(transposeChord('C', 1, 'sharps')).toBe('C#');
      expect(transposeChord('E', 1)).toBe('F');
      expect(transposeChord('B', 1)).toBe('C');
      expect(transposeChord('G', 1, 'flats')).toBe('Ab');
    });

    it('transposes one whole step higher (+2 semitones)', () => {
      expect(transposeChord('C', 2)).toBe('D');
      expect(transposeChord('F', 2)).toBe('G');
      expect(transposeChord('G', 2)).toBe('A');
      expect(transposeChord('Am', 2)).toBe('Bm');
      expect(transposeChord('Bb', 2)).toBe('C');
      expect(transposeChord('D/F#', 2)).toBe('E/G#');
    });

    it('preserves quality and transposes both root and bass', () => {
      expect(transposeChord('F#m7b5', -1, 'flats')).toBe('Fm7b5');
      expect(transposeChord('Bbmaj7/D', 2)).toBe('Cmaj7/E');
      expect(transposeChord('Ebadd9', -2, 'flats')).toBe('Dbadd9');
    });

    it('handles transposition wrapping across octaves and full scale', () => {
      // +12 and -12 should be equivalent note
      expect(transposeChord('C', 12)).toBe('C');
      expect(transposeChord('G7', -12)).toBe('G7');
      expect(transposeChord('B', 1)).toBe('C');
      expect(transposeChord('C', -1)).toBe('B');
    });

    it('respects accidental preferences for sharp and flat keys', () => {
      expect(transposeChord('C', 1, 'sharps')).toBe('C#');
      expect(transposeChord('C', 1, 'flats')).toBe('Db');
      expect(transposeChord('G', -1, 'sharps')).toBe('F#');
      expect(transposeChord('G', -1, 'flats')).toBe('Gb');
    });
  });

  describe('getSemitoneDistance', () => {
    it('calculates distance between keys accurately', () => {
      expect(getSemitoneDistance('C', 'Bb')).toBe(-2);
      expect(getSemitoneDistance('C', 'D')).toBe(2);
      expect(getSemitoneDistance('C', 'G')).toBe(-5); // or 7
      expect(getSemitoneDistance('G', 'F')).toBe(-2);
    });
  });

  describe('isLikelyChordSymbol', () => {
    it('identifies valid chord symbols', () => {
      expect(isLikelyChordSymbol('C')).toBe(true);
      expect(isLikelyChordSymbol('Am')).toBe(true);
      expect(isLikelyChordSymbol('G7')).toBe(true);
      expect(isLikelyChordSymbol('F#m7b5')).toBe(true);
      expect(isLikelyChordSymbol('Bb/D')).toBe(true);
      expect(isLikelyChordSymbol('Dsus4')).toBe(true);
    });

    it('filters out common English lyric words', () => {
      expect(isLikelyChordSymbol('THE')).toBe(false);
      expect(isLikelyChordSymbol('IN')).toBe(false);
      expect(isLikelyChordSymbol('ON')).toBe(false);
      expect(isLikelyChordSymbol('AND')).toBe(false);
      expect(isLikelyChordSymbol('TO')).toBe(false);
    });
  });

  describe('getChordMidiNotes', () => {
    it('returns MIDI note numbers for C major chord', () => {
      const notes = getChordMidiNotes('C');
      // Root: C4 = 60, Major 3rd: E4 = 64, 5th: G4 = 67
      expect(notes).toEqual([60, 64, 67]);
    });

    it('includes bass note in lower octave for slash chord', () => {
      const notes = getChordMidiNotes('C/E');
      // Bass E3 = 48 + 4 = 52, followed by C4, E4, G4
      expect(notes[0]).toBe(52);
    });
  });
});
