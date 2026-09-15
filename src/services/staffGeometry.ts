import { ChordPosition } from '../utils/chordUtils';

/**
 * Cluster Y coordinates into horizontal staff chord tracks.
 * `height` is the same unit as `ys` (pixels or 0-100 percent).
 */
export function clusterYTracks(ys: number[], height = 100, frac = 0.04): number[] {
  if (ys.length === 0) return [];

  const yTolerance = height * frac;
  const clusters: number[][] = [];

  ys.forEach((y) => {
    let placed = false;
    for (const cluster of clusters) {
      const avgY = cluster.reduce((sum, val) => sum + val, 0) / cluster.length;
      if (Math.abs(y - avgY) <= yTolerance) {
        cluster.push(y);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([y]);
    }
  });

  return clusters
    .map((cluster) => cluster.reduce((sum, val) => sum + val, 0) / cluster.length)
    .sort((a, b) => a - b);
}

export function snapToNearestTrack(y: number, tracks: number[], maxDistance: number): number {
  if (tracks.length === 0) return y;

  let closest = y;
  let minDiff = Infinity;
  tracks.forEach((trackY) => {
    const diff = Math.abs(y - trackY);
    if (diff < minDiff && diff <= maxDistance) {
      minDiff = diff;
      closest = trackY;
    }
  });
  return closest;
}

/**
 * Snap Vision detections onto shared staff chord baselines using their own Y clusters.
 */
export function alignChordsToStaffTracks(chords: ChordPosition[], maxDistancePct = 4.5): ChordPosition[] {
  if (chords.length < 2) return chords;
  const tracks = clusterYTracks(chords.map((chord) => chord.y), 100, 0.04);
  if (tracks.length === 0) return chords;
  return chords.map((chord) => ({
    ...chord,
    y: snapToNearestTrack(chord.y, tracks, maxDistancePct),
  }));
}

/**
 * Detect chord-track Y percentages from a grayscale raster via horizontal ink projection.
 * Staff lines are thin dark rows; chord symbols sit ~1.5 line-spacings above each 5-line staff.
 */
export function detectStaffChordTracksFromGray(
  width: number,
  height: number,
  pixels: Uint8Array,
  inkThreshold = 90
): number[] {
  if (width < 16 || height < 16) return [];

  const rowDark = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let dark = 0;
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      if (pixels[rowStart + x] < inkThreshold) dark += 1;
    }
    rowDark[y] = dark / width;
  }

  const smoothed = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (let k = -1; k <= 1; k++) {
      const yy = y + k;
      if (yy >= 0 && yy < height) {
        sum += rowDark[yy];
        count += 1;
      }
    }
    smoothed[y] = sum / count;
  }

  const sorted = Array.from(smoothed).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const peakFloor = Math.max(0.06, median * 3);

  const rawPeaks: Array<{ y: number; val: number }> = [];
  for (let y = 1; y < height - 1; y++) {
    if (smoothed[y] >= peakFloor && smoothed[y] >= smoothed[y - 1] && smoothed[y] >= smoothed[y + 1]) {
      rawPeaks.push({ y, val: smoothed[y] });
    }
  }

  const peaks: number[] = [];
  rawPeaks.forEach((peak) => {
    const prev = peaks[peaks.length - 1];
    if (prev === undefined || peak.y - prev >= 3) {
      peaks.push(peak.y);
      return;
    }
    if (peak.val > smoothed[prev]) {
      peaks[peaks.length - 1] = peak.y;
    }
  });

  if (peaks.length < 5) return [];

  const tracksPct: number[] = [];
  for (let i = 0; i <= peaks.length - 5; i++) {
    const group = peaks.slice(i, i + 5);
    const spacings = [
      group[1] - group[0],
      group[2] - group[1],
      group[3] - group[2],
      group[4] - group[3],
    ];
    const mean = spacings.reduce((sum, val) => sum + val, 0) / spacings.length;
    if (mean < 2 || mean > height * 0.08) continue;
    const variance = spacings.reduce((sum, val) => sum + (val - mean) ** 2, 0) / spacings.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.28) continue;

    const staffTop = group[0];
    const chordTrack = staffTop - 1.55 * mean;
    const pct = (Math.max(0, chordTrack) / height) * 100;
    const prev = tracksPct[tracksPct.length - 1];
    if (prev === undefined || Math.abs(pct - prev) > 3) {
      tracksPct.push(pct);
    }
  }

  return tracksPct;
}

export function snapChordsToStaffTracks(
  chords: ChordPosition[],
  staffTrackPct: number[],
  maxDistancePct = 5
): ChordPosition[] {
  if (staffTrackPct.length === 0) {
    return alignChordsToStaffTracks(chords);
  }
  return chords.map((chord) => ({
    ...chord,
    y: snapToNearestTrack(chord.y, staffTrackPct, maxDistancePct),
  }));
}

export function detectStaffTracksFromImageData(imageData: ImageData): number[] {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return detectStaffChordTracksFromGray(width, height, gray);
}

export async function detectStaffTracksFromDataUrl(dataUrl: string): Promise<number[]> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return [];
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 0;
        const naturalH = img.naturalHeight || img.height || 0;
        if (!naturalW || !naturalH) {
          resolve([]);
          return;
        }
        const maxW = 800;
        const scale = Math.min(1, maxW / naturalW);
        const width = Math.max(1, Math.round(naturalW * scale));
        const height = Math.max(1, Math.round(naturalH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(detectStaffTracksFromImageData(ctx.getImageData(0, 0, width, height)));
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
