import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import {
  cleanOcrToken,
  filterAndClusterChords,
  CandidateToken
} from '../src/services/ocrService';
import { isLikelyChordSymbol } from '../src/utils/chordUtils';

describe('End-to-End OCR Chord Detection with Chord Line Sensitivity', () => {
  it('verifies isLikelyChordSymbol allows Bb and Eb', () => {
    expect(isLikelyChordSymbol('Bb')).toBe(true);
    expect(isLikelyChordSymbol('Eb')).toBe(true);
    expect(isLikelyChordSymbol('Db')).toBe(true);
    expect(isLikelyChordSymbol('C/Bb')).toBe(true);
    expect(isLikelyChordSymbol('Bb/C')).toBe(true);
  });

  it('verifies cleanOcrToken handles sheet music chord patterns', () => {
    expect(cleanOcrToken('CIE')).toEqual(['C/E']);
    expect(cleanOcrToken('C1E')).toEqual(['C/E']);
    expect(cleanOcrToken('C|E')).toEqual(['C/E']);
    expect(cleanOcrToken('C/Bb')).toEqual(['C/Bb']);
    expect(cleanOcrToken('Bb/C')).toEqual(['Bb/C']);
    expect(cleanOcrToken('G/F')).toEqual(['G/F']);
    expect(cleanOcrToken('F(G/F')).toEqual(['F', 'G/F']);
    expect(cleanOcrToken('(F]6G')).toEqual(['F', 'G']);
    expect(cleanOcrToken('|Em|Am')).toEqual(['Em', 'Am']);
    expect(cleanOcrToken('An')).toEqual(['Am']);
    expect(cleanOcrToken('Gsusé4')).toEqual(['Gsus4']);
  });

  it('runs filterAndClusterChords on ocr_dump and verifies all chord rows', () => {
    const dump = JSON.parse(fs.readFileSync('/tmp/ocr_dump.json', 'utf8'));
    const tokens: CandidateToken[] = dump.words.map((w: any) => ({
      text: w.text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      confidence: w.confidence
    }));

    const lines = dump.lines.map((l: any) => ({
      text: l.text,
      bbox: l.bbox,
      confidence: l.confidence
    }));

    const symbols = dump.symbols.map((s: any) => ({
      text: s.text,
      bbox: s.bbox,
      confidence: s.confidence
    }));

    const chords = filterAndClusterChords(tokens, 1206, 1540, { lines, symbols });
    console.log(`\n=== TOTAL CHORDS DETECTED: ${chords.length} ===`);
    chords.forEach(c => {
      console.log(`Chord: ${c.originalText.padEnd(7)} at x:${c.x.toFixed(1)}% y:${c.y.toFixed(1)}% (conf:${(c.confidence! * 100).toFixed(0)}%)`);
    });

    const chordTexts = chords.map(c => c.originalText);
    // Key chords that user asked to be detected and not missed:
    expect(chordTexts).toContain('C');
    expect(chordTexts).toContain('C/E');
    expect(chordTexts).toContain('F');
    expect(chordTexts).toContain('G');
    expect(chordTexts).toContain('Am');
    expect(chordTexts).toContain('Dm');
    expect(chordTexts).toContain('Em');
    expect(chordTexts).toContain('C7');
    expect(chordTexts).toContain('G/F');
  });
});
