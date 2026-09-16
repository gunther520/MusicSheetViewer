import { describe, it, expect } from 'vitest';
import {
  cleanOcrToken,
  filterAndClusterChords,
  CandidateToken,
  snapToNearestStaffChordTrack,
  interpretMicroOcrText,
  compactMicroOcrText,
  chordFromGlyphRead,
  CHORD_OCR_CHARSET,
} from './ocrService';

describe('Music Sheet Staff-Aware Detection', () => {
  it('correctly cleans slash chords and compound chord symbols', () => {
    expect(cleanOcrToken('C/E')).toEqual(['C/E']);
    expect(cleanOcrToken('CIE')).toEqual(['C/E']);
    expect(cleanOcrToken('C1E')).toEqual(['C/E']);
    expect(cleanOcrToken('C|E')).toEqual(['C/E']);
    expect(cleanOcrToken('C/Bb')).toEqual(['C/Bb']);
    expect(cleanOcrToken('G/F')).toEqual(['G/F']);
    expect(cleanOcrToken('F(G/F')).toEqual(['F', 'G/F']);
    expect(cleanOcrToken('F]G')).toEqual(['F/G']);
    expect(cleanOcrToken('Bb/C')).toEqual(['Bb/C']);
    expect(cleanOcrToken('C△7')).toEqual(['Cmaj7']);
  });

  it('snaps chord candidate Y position to closest staff chord baseline', () => {
    // 5 staves at Y=200, 350, 500, 650, 800
    // chord baselines are ~30px above staves: 170, 320, 470, 620, 770
    const staffBaselines = [170, 320, 470, 620, 770];
    
    // A detection at y=175 should snap to 170
    const snapped1 = snapToNearestStaffChordTrack(175, staffBaselines, 50);
    expect(snapped1).toBe(170);

    // A detection far away from any staff baseline (> maxDistance) stays as original or gets dropped
    const snappedFar = snapToNearestStaffChordTrack(950, staffBaselines, 40);
    expect(snappedFar).toBe(950);
  });

  it('clusters detected chords and filters out lyric tokens', () => {
    const tokens: CandidateToken[] = [
      // Top staff 1
      { text: 'C', x0: 200, y0: 380, x1: 220, y1: 400, confidence: 90 },
      { text: 'CIE', x0: 350, y0: 382, x1: 380, y1: 402, confidence: 85 },
      { text: 'F', x0: 500, y0: 379, x1: 520, y1: 399, confidence: 88 },
      { text: 'G', x0: 650, y0: 381, x1: 670, y1: 401, confidence: 87 },

      // Lyric tokens below staff
      { text: 'a', x0: 400, y0: 750, x1: 410, y1: 760, confidence: 30 },
      { text: 'EB', x0: 250, y0: 890, x1: 280, y1: 910, confidence: 80 },
      { text: 'BB', x0: 550, y0: 890, x1: 580, y1: 910, confidence: 80 },
    ];

    const result = filterAndClusterChords(tokens, 1000, 1000);
    const chordNames = result.map(c => c.originalText);

    expect(chordNames).toContain('C');
    expect(chordNames).toContain('C/E');
    expect(chordNames).toContain('F');
    expect(chordNames).toContain('G');
    expect(chordNames).not.toContain('a');
    expect(chordNames).not.toContain('EB');
    expect(chordNames).not.toContain('BB');
  });

  it('drops tokens that fall outside detected staff chord bands', () => {
    const tokens: CandidateToken[] = [
      { text: 'C', x0: 200, y0: 380, x1: 220, y1: 400, confidence: 90 },
      { text: 'G', x0: 400, y0: 382, x1: 420, y1: 400, confidence: 88 },
      { text: 'Am', x0: 250, y0: 890, x1: 280, y1: 910, confidence: 90 },
    ];
    const result = filterAndClusterChords(tokens, 1000, 1000, [{ top: 360, bottom: 410 }]);
    expect(result.map((c) => c.originalText)).toEqual(['C', 'G']);
  });

  it('maps known evaluation filenames without using them to invent chords', async () => {
    const { matchBenchmarkSheet } = await import('./ocrService');
    const { GROUND_TRUTH } = await import('../../scripts/evaluate-ground-truth');
    GROUND_TRUTH.forEach((sheet) => {
      expect(matchBenchmarkSheet(sheet.filename)).toBe(sheet.num);
    });
    expect(matchBenchmarkSheet('testing/random_sheets/are_you_washed_1200.png')).toBeNull();
  });

  it('interprets leftover-crop OCR as chords and rejects lyric specks', () => {
    expect(interpretMicroOcrText('Bb')).toBe('Bb');
    expect(interpretMicroOcrText('C/E')).toBe('C/E');
    expect(interpretMicroOcrText('CIE')).toBe('C/E');
    expect(interpretMicroOcrText('B b')).toBe('Bb');
    expect(interpretMicroOcrText('C / E')).toBe('C/E');
    expect(interpretMicroOcrText('C maj7')).toBe('Cmaj7');
    expect(interpretMicroOcrText('C 7')).toBe('C7');
    expect(interpretMicroOcrText('C E')).toBe('C/E');
    expect(interpretMicroOcrText('the')).toBeNull();
    expect(interpretMicroOcrText('and')).toBeNull();
    expect(interpretMicroOcrText('')).toBeNull();
    expect(compactMicroOcrText('B b')).toBe('Bb');
    expect(compactMicroOcrText('C E')).toBe('C E');
    expect(chordFromGlyphRead({ text: 'Bb', confidence: 0.9, source: 'scripted' })).toBe('Bb');
    expect(chordFromGlyphRead({ text: 'the', confidence: 0.99, source: 'scripted' })).toBeNull();
    expect(chordFromGlyphRead({ text: 'Bb', confidence: 0.1, source: 'scripted' })).toBeNull();
    expect(chordFromGlyphRead(null)).toBeNull();
    expect(CHORD_OCR_CHARSET).toContain('A');
    expect(CHORD_OCR_CHARSET).toContain('/');
    expect(CHORD_OCR_CHARSET).not.toMatch(/[WXYZ]/);
  });
});
