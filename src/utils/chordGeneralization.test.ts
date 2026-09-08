import { describe, it, expect } from 'vitest';
import { isValidChord, isLikelyChordSymbol } from '../utils/chordUtils';
import { normalizeChordToken } from '../services/ocrService';

describe('Generalized Chord Recognition & Normalization', () => {
  it('validates standard chords across all keys and qualities without overfitting', () => {
    const validChords = [
      'C', 'Cm', 'C7', 'Cmaj7', 'Csus4', 'Csus2', 'Cdim', 'Caug', 'C6', 'C9',
      'D#m', 'Eb', 'Ebm', 'F#', 'F#m', 'Gb', 'Ab', 'A#m', 'Bb', 'Bbm',
      'C/E', 'G/B', 'D/F#', 'Bb/D', 'F/A', 'Eb/G', 'Ab/C'
    ];

    validChords.forEach((chord) => {
      expect(isValidChord(chord), `Expected ${chord} to be valid`).toBe(true);
      expect(isLikelyChordSymbol(chord), `Expected ${chord} to be likely chord symbol`).toBe(true);
    });
  });

  it('rejects common non-chord English words and lyric fragments', () => {
    const invalidWords = [
      'THE', 'AND', 'FOR', 'VERSE', 'CHORUS', 'BRIDGE', 'INTRO',
      'YOU', 'ARE', 'MY', 'LORD', 'LOVE', 'COME', 'PRAISE'
    ];

    invalidWords.forEach((word) => {
      expect(isLikelyChordSymbol(word), `Expected ${word} to NOT be a chord`).toBe(false);
    });
  });

  it('normalizes common OCR separator characters into proper slash chords', () => {
    expect(normalizeChordToken('C/E')).toEqual(['C/E']);
    expect(normalizeChordToken('CIE')).toEqual(['C/E']);
    expect(normalizeChordToken('C1E')).toEqual(['C/E']);
    expect(normalizeChordToken('C|E')).toEqual(['C/E']);
    expect(normalizeChordToken('G/B')).toEqual(['G/B']);
    expect(normalizeChordToken('GIB')).toEqual(['G/B']);
    expect(normalizeChordToken('D/F#')).toEqual(['D/F#']);
  });

  it('handles compound tokens and brackets cleanly', () => {
    expect(normalizeChordToken('|Em|Am|')).toEqual(['Em', 'Am']);
    expect(normalizeChordToken('[C]')).toEqual(['C']);
    expect(normalizeChordToken('(Gsus4)')).toEqual(['Gsus4']);
    expect(normalizeChordToken('An')).toEqual(['Am']);
  });
});
