import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  alignChordsToStaffTracks,
  clusterYTracks,
  detectStaffChordTracksFromGray,
  detectStaffSystemsFromGray,
  snapToNearestTrack,
  systemsWithSymbolInk,
} from './staffGeometry';
import { rasterizeSheet } from './rasterize';
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

  it('treats fragmented ink in a chord band as symbols, not leftover staff lines', () => {
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
    const systems = detectStaffSystemsFromGray(width, height, pixels);
    expect(systems.length).toBeGreaterThanOrEqual(1);
    expect(systemsWithSymbolInk(width, height, pixels, systems)).toHaveLength(0);

    const band = systems[0];
    for (let y = band.chordBandBottom - 8; y < band.chordBandBottom - 2; y++) {
      for (let x = 20; x < 28; x++) pixels[y * width + x] = 15;
      for (let x = 40; x < 48; x++) pixels[y * width + x] = 15;
      for (let x = 70; x < 78; x++) pixels[y * width + x] = 15;
    }
    expect(systemsWithSymbolInk(width, height, pixels, systems).length).toBeGreaterThan(0);
  });

  it('finds symbol-like ink on a printed lead sheet and not on a chordless SATB page', async () => {
    const washed = await rasterizeSheet(
      path.resolve(__dirname, '../../testing/random_sheets/are_you_washed_1200.png')
    );
    const washedSystems = detectStaffSystemsFromGray(washed.width, washed.height, washed.gray);
    expect(washedSystems.length).toBe(4);
    expect(washedSystems.some((system) => system.isGrandStaff)).toBe(true);
    expect(systemsWithSymbolInk(washed.width, washed.height, washed.gray, washedSystems).length)
      .toBeGreaterThan(0);

    const satb = await rasterizeSheet(
      path.resolve(__dirname, '../../testing/random_sheets/amazing_grace-1.png')
    );
    const satbSystems = detectStaffSystemsFromGray(satb.width, satb.height, satb.gray);
    expect(satbSystems.length).toBeGreaterThan(0);
    expect(systemsWithSymbolInk(satb.width, satb.height, satb.gray, satbSystems)).toHaveLength(0);

    const hymn = await rasterizeSheet(
      path.resolve(__dirname, '../../testing/random_sheets/what_a_friend.png')
    );
    const hymnSystems = detectStaffSystemsFromGray(hymn.width, hymn.height, hymn.gray);
    expect(hymnSystems.every((system) => system.isGrandStaff) || hymnSystems.length <= 4).toBe(true);
    expect(systemsWithSymbolInk(hymn.width, hymn.height, hymn.gray, hymnSystems)).toHaveLength(0);
  }, 30000);
});
