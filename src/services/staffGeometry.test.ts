import { describe, it, expect } from 'vitest';
import {
  alignChordsToStaffTracks,
  clusterYTracks,
  detectStaffChordTracksFromGray,
  snapToNearestTrack,
} from './staffGeometry';
import { ChordPosition } from '../utils/chordUtils';

describe('Staff-aware Vision placement', () => {
  it('clusters nearby Y percents onto shared chord tracks', () => {
    const tracks = clusterYTracks([20.1, 20.4, 20.0, 48.2, 48.8], 100, 0.04);
    expect(tracks.length).toBe(2);
    expect(tracks[0]).toBeCloseTo(20.17, 1);
    expect(tracks[1]).toBeCloseTo(48.5, 1);
  });

  it('snaps detections onto clustered staff tracks', () => {
    const chords: ChordPosition[] = [
      { id: '1', originalText: 'C', currentText: 'C', x: 10, y: 20.2, width: 5, height: 3 },
      { id: '2', originalText: 'G', currentText: 'G', x: 30, y: 21.1, width: 5, height: 3 },
      { id: '3', originalText: 'Am', currentText: 'Am', x: 50, y: 19.6, width: 5, height: 3 },
    ];
    const aligned = alignChordsToStaffTracks(chords);
    const ys = new Set(aligned.map((chord) => chord.y.toFixed(3)));
    expect(ys.size).toBe(1);
  });

  it('detects a chord track above a synthetic 5-line staff', () => {
    const width = 120;
    const height = 200;
    const pixels = new Uint8Array(width * height);
    pixels.fill(240);
    const lineYs = [80, 88, 96, 104, 112];
    lineYs.forEach((y) => {
      for (let x = 10; x < 110; x++) {
        pixels[y * width + x] = 10;
      }
    });

    const tracks = detectStaffChordTracksFromGray(width, height, pixels);
    expect(tracks.length).toBeGreaterThanOrEqual(1);
    const bandMid = ((80 - 7.2 * 8) + (80 - 0.15 * 8)) / 2;
    const expected = (bandMid / height) * 100;
    expect(Math.abs(tracks[0] - expected)).toBeLessThan(8);
    expect(snapToNearestTrack(expected + 1.2, tracks, 8)).toBe(tracks[0]);
  });
});
