import { describe, it, expect } from 'vitest';
import { chordsEquivalent, scoreNameSequence, scoreSheetDetections } from './detectionScore';

describe('detectionScore', () => {
  it('treats slash-bass variants as the same printed chord for recall', () => {
    expect(chordsEquivalent('C/E', 'C/E')).toBe(true);
    expect(chordsEquivalent('C/E', 'C')).toBe(true);
    expect(chordsEquivalent('Gsus4', 'Gsus4')).toBe(true);
    expect(chordsEquivalent('Cmaj7', 'C△7')).toBe(true);
    expect(chordsEquivalent('Bmaj7#5', 'Bma7#5')).toBe(true);
    expect(chordsEquivalent('Dm', 'G')).toBe(false);
  });

  it('scores hits, misses, and extras on a name sequence', () => {
    const score = scoreNameSequence(['C', 'F', 'G', 'C'], ['C', 'G', 'Am', 'C']);
    expect(score.hits).toBe(3);
    expect(score.missed).toEqual(['F']);
    expect(score.extras).toEqual(['Am']);
  });

  it('assigns detections to the nearest staff and counts stray hits as extras', () => {
    const score = scoreSheetDetections(
      [
        { yCenter: 200, expected: ['C', 'F'] },
        { yCenter: 400, expected: ['G'] },
      ],
      [
        { originalText: 'C', x: 10, y: (200 / 1000) * 100 },
        { originalText: 'F', x: 40, y: (200 / 1000) * 100 },
        { originalText: 'G', x: 20, y: (400 / 1000) * 100 },
        { originalText: 'Am', x: 50, y: 90 },
      ],
      1000,
      4.2
    );
    expect(score.expected).toBe(3);
    expect(score.hits).toBe(3);
    expect(score.extras).toBe(1);
    expect(score.recall).toBe(1);
  });
});
