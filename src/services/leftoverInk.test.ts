import { describe, it, expect } from 'vitest';
import { capLeftoverBlobs, uncoveredInkBlobs } from './leftoverInk';
import { ChordInkBlob } from './staffGeometry';

function blob(x: number, y: number, id = x): ChordInkBlob {
  return {
    x,
    y,
    width: 4,
    height: 3,
    x0: x,
    y0: y,
    x1: x + 8,
    y1: y + 6,
    lineSpacing: 8,
  };
}

describe('uncoveredInkBlobs', () => {
  it('drops blobs already covered by an accepted chord', () => {
    const blobs = [blob(20, 18), blob(55, 18), blob(80, 18)];
    const leftover = uncoveredInkBlobs(blobs, [{ x: 20.4, y: 18.2 }, { x: 80, y: 18 }]);
    expect(leftover.map((item) => item.x)).toEqual([55]);
  });

  it('keeps every blob when nothing has been detected yet', () => {
    const blobs = [blob(12, 20), blob(40, 20)];
    expect(uncoveredInkBlobs(blobs, [])).toHaveLength(2);
  });

  it('caps leftover blobs without inventing new ones', () => {
    const blobs = Array.from({ length: 20 }, (_, i) => blob(10 + i * 3, 20, i));
    expect(capLeftoverBlobs(blobs, 12)).toHaveLength(12);
  });
});
