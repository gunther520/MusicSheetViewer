import { describe, it, expect } from 'vitest';
import { cleanOcrToken, filterAndClusterChords, CandidateToken } from './ocrService';

describe('ocrService enhancements', () => {
  describe('cleanOcrToken', () => {
    it('strips bracket artifacts and punctuation', () => {
      expect(cleanOcrToken('[C]')).toEqual(['C']);
      expect(cleanOcrToken('|Am7|')).toEqual(['Am7']);
      expect(cleanOcrToken('(G7)')).toEqual(['G7']);
      expect(cleanOcrToken('F#m7b5.')).toEqual(['F#m7b5']);
      expect(cleanOcrToken(':Bb/D;')).toEqual(['Bb/D']);
    });

    it('corrects slash chord misreads like CIE -> C/E', () => {
      expect(cleanOcrToken('CIE')).toEqual(['C/E']);
      expect(cleanOcrToken('C|E')).toEqual(['C/E']);
      expect(cleanOcrToken('C1E')).toEqual(['C/E']);
      expect(cleanOcrToken('C/Bb')).toEqual(['C/Bb']);
      expect(cleanOcrToken('G/B')).toEqual(['G/B']);
      expect(cleanOcrToken('D/F#')).toEqual(['D/F#']);
    });

    it('splits concatenated chords like F(G/F', () => {
      expect(cleanOcrToken('F(G/F')).toEqual(['F', 'G/F']);
    });

    it('normalizes accidentals like unicode sharps and flats', () => {
      expect(cleanOcrToken('B♭')).toEqual(['Bb']);
      expect(cleanOcrToken('F♯m7')).toEqual(['F#m7']);
    });
  });

  describe('filterAndClusterChords', () => {
    it('filters out non-chord lyrics and false positives like EB, BB, a, em from lyrics', () => {
      const tokens: CandidateToken[] = [
        // Real chords on staff 1 (y: ~560)
        { text: 'C', x0: 321, y0: 564, x1: 334, y1: 580, confidence: 90 },
        { text: 'CIE', x0: 450, y0: 563, x1: 484, y1: 580, confidence: 85 },
        { text: 'F', x0: 607, y0: 560, x1: 630, y1: 577, confidence: 90 },
        { text: 'G', x0: 700, y0: 560, x1: 720, y1: 577, confidence: 90 },

        // Stray lyric words
        { text: 'a', x0: 661, y0: 1214, x1: 714, y1: 1263, confidence: 20 },
        { text: 'EB', x0: 185, y0: 1350, x1: 232, y1: 1412, confidence: 82 },
        { text: 'BB', x0: 547, y0: 1341, x1: 594, y1: 1411, confidence: 75 },
        { text: 'Copyright', x0: 400, y0: 1451, x1: 466, y1: 1467, confidence: 94 },
      ];

      const result = filterAndClusterChords(tokens, 1200, 1600);
      const chordNames = result.map((c) => c.originalText);

      // Should keep authentic chords and converted slash chords
      expect(chordNames).toContain('C');
      expect(chordNames).toContain('C/E');
      expect(chordNames).toContain('F');
      expect(chordNames).toContain('G');

      // Should NOT include lyrics, header, or doubled letter artifacts
      expect(chordNames).not.toContain('a');
      expect(chordNames).not.toContain('EB');
      expect(chordNames).not.toContain('BB');
      expect(chordNames).not.toContain('Copyright');
    });
  });
});
