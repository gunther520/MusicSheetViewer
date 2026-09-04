import { describe, it, expect } from 'vitest';
import { cleanOcrToken } from './ocrService';
import { isLikelyChordSymbol } from '../utils/chordUtils';

describe('ocrService', () => {
  describe('cleanOcrToken', () => {
    it('strips bracket artifacts and punctuation', () => {
      expect(cleanOcrToken('[C]')).toBe('C');
      expect(cleanOcrToken('|Am7|')).toBe('Am7');
      expect(cleanOcrToken('(G7)')).toBe('G7');
      expect(cleanOcrToken('F#m7b5.')).toBe('F#m7b5');
      expect(cleanOcrToken(':Bb/D;')).toBe('Bb/D');
    });

    it('normalizes accidentals like unicode sharps and flats', () => {
      expect(cleanOcrToken('B♭')).toBe('Bb');
      expect(cleanOcrToken('F♯m7')).toBe('F#m7');
    });

    it('works with isLikelyChordSymbol on cleaned tokens', () => {
      const noisyTokens = ['[C]', '|Am|', 'G7,', 'F#m7b5', '(Bb/D)'];
      noisyTokens.forEach((token) => {
        const cleaned = cleanOcrToken(token);
        expect(isLikelyChordSymbol(cleaned)).toBe(true);
      });
    });
  });
});
