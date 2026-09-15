import { ChordPosition } from '../utils/chordUtils';
import { ChordInkBlob } from './staffGeometry';

const DEFAULT_X_TOL = 5.5;
const DEFAULT_Y_TOL = 3.0;
export const MAX_LEFTOVER_BLOBS = 12;

/**
 * Keep ink blobs whose centers are not already covered by an accepted chord overlay.
 * Remaining blobs are missed printed ink, not a theory guess.
 */
export function uncoveredInkBlobs(
  blobs: ChordInkBlob[],
  chords: Array<Pick<ChordPosition, 'x' | 'y'>>,
  xTol = DEFAULT_X_TOL,
  yTol = DEFAULT_Y_TOL
): ChordInkBlob[] {
  if (blobs.length === 0) return [];
  if (chords.length === 0) return blobs.slice();

  return blobs.filter((blob) => {
    const covered = chords.some((chord) => (
      Math.abs(chord.x - blob.x) <= xTol && Math.abs(chord.y - blob.y) <= yTol
    ));
    return !covered;
  });
}

export function capLeftoverBlobs(blobs: ChordInkBlob[], max = MAX_LEFTOVER_BLOBS): ChordInkBlob[] {
  if (blobs.length <= max) return blobs.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return blobs
    .slice()
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))
    .slice(0, max)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
}
