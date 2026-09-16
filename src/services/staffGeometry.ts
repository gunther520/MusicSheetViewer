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

export interface StaffSystem {
  staffTop: number;
  staffBottom: number;
  lineSpacing: number;
  chordBandTop: number;
  chordBandBottom: number;
  isGrandStaff: boolean;
}

type FiveLineStaff = { top: number; bottom: number; spacing: number };

function collectFiveLineStaves(
  smoothed: Float64Array,
  height: number,
  peakFloor: number,
  cvMax = 0.22
): FiveLineStaff[] {
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

  const fiveLineStaves: FiveLineStaff[] = [];
  for (let i = 0; i <= peaks.length - 5; i++) {
    const group = peaks.slice(i, i + 5);
    const spacings = [
      group[1] - group[0],
      group[2] - group[1],
      group[3] - group[2],
      group[4] - group[3],
    ];
    const mean = spacings.reduce((sum, val) => sum + val, 0) / spacings.length;
    if (mean < 3 || mean > Math.max(16, height * 0.07)) continue;
    const variance = spacings.reduce((sum, val) => sum + (val - mean) ** 2, 0) / spacings.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > cvMax) continue;

    const top = group[0];
    const bottom = group[4];
    const prev = fiveLineStaves[fiveLineStaves.length - 1];
    if (prev && Math.abs(top - prev.top) < mean * 2) continue;
    fiveLineStaves.push({ top, bottom, spacing: mean });
  }
  return fiveLineStaves;
}

function mergeFiveLineStaves(primary: FiveLineStaff[], extra: FiveLineStaff[]): FiveLineStaff[] {
  const merged = [...primary];
  extra.forEach((staff) => {
    const nearby = merged.some((existing) => {
      const minSpacing = Math.max(existing.spacing, staff.spacing);
      return Math.abs(staff.top - existing.top) < minSpacing * 4;
    });
    if (!nearby) merged.push(staff);
  });
  return merged.sort((a, b) => a.top - b.top);
}

/**
 * Detect musical staff systems and the chord-symbol band sitting above each staff.
 * Layout-based only: horizontal ink projection + regularly spaced 5-line groups.
 * Works on any engraved/printed lead sheet; does not use filenames or known pieces.
 */
export function detectStaffSystemsFromGray(
  width: number,
  height: number,
  pixels: Uint8Array,
  inkThreshold?: number
): StaffSystem[] {
  if (width < 32 || height < 32) return [];

  const threshold = inkThreshold ?? estimateInkThreshold(pixels);
  const rowDark = new Float64Array(height);
  const rowLine = new Float64Array(height);
  const x0 = Math.floor(width * 0.08);
  const x1 = Math.ceil(width * 0.92);
  const span = Math.max(1, x1 - x0);

  for (let y = 0; y < height; y++) {
    let dark = 0;
    let longest = 0;
    let run = 0;
    const rowStart = y * width;
    for (let x = x0; x < x1; x++) {
      if (pixels[rowStart + x] < threshold) {
        dark += 1;
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    rowDark[y] = dark / span;
    rowLine[y] = longest / span;
  }

  const smoothed = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (let k = -1; k <= 1; k++) {
      const yy = y + k;
      if (yy >= 0 && yy < height) {
        sum += rowLine[yy] * 0.7 + rowDark[yy] * 0.3;
        count += 1;
      }
    }
    smoothed[y] = sum / count;
  }

  const sorted = Array.from(smoothed).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
  const conservativeFloor = Math.max(0.1, median * 3.2, p90 * 0.5);
  const sensitiveFloor = Math.max(0.07, median * 2.0, p90 * 0.4);

  const primary = collectFiveLineStaves(smoothed, height, conservativeFloor, 0.22);
  const extra = collectFiveLineStaves(smoothed, height, sensitiveFloor, 0.32);
  const fiveLineStaves = mergeFiveLineStaves(primary, extra);

  if (fiveLineStaves.length === 0) return [];

  const systems: StaffSystem[] = [];
  for (let i = 0; i < fiveLineStaves.length; i++) {
    const staff = fiveLineStaves[i];
    const next = fiveLineStaves[i + 1];
    const prevSystem = systems[systems.length - 1];
    const staffHeight = staff.bottom - staff.top;
    const gapToNext = next ? next.top - staff.bottom : Infinity;
    const isGrandPair = Boolean(
      next &&
      gapToNext > staff.spacing * 1.15 &&
      gapToNext < staffHeight * 2.4
    );

    if (prevSystem && staff.top < prevSystem.staffBottom + staffHeight * 0.4) {
      continue;
    }

    const chordBandBottom = Math.max(0, staff.top - Math.round(staff.spacing * 0.15));
    const chordBandTop = Math.max(
      0,
      staff.top - Math.max(Math.round(staff.spacing * 7.2), 24)
    );
    const limitedTop = prevSystem
      ? Math.max(chordBandTop, prevSystem.staffBottom + Math.round(staff.spacing * 0.4))
      : chordBandTop;

    systems.push({
      staffTop: staff.top,
      staffBottom: isGrandPair && next ? next.bottom : staff.bottom,
      lineSpacing: staff.spacing,
      chordBandTop: limitedTop,
      chordBandBottom: Math.max(limitedTop + 4, chordBandBottom),
      isGrandStaff: isGrandPair,
    });

    if (isGrandPair) i += 1;
  }

  return systems;
}

function estimateInkThreshold(pixels: Uint8Array): number {
  let sum = 0;
  const step = Math.max(1, Math.floor(pixels.length / 8000));
  let count = 0;
  for (let i = 0; i < pixels.length; i += step) {
    sum += pixels[i];
    count += 1;
  }
  const mean = count ? sum / count : 128;
  return mean < 90 ? 160 : Math.max(70, Math.min(140, mean - 45));
}

function chordBandSearchWindow(
  width: number,
  height: number,
  system: StaffSystem
): { x0: number; x1: number; y0: number; y1: number } | null {
  const y1 = Math.min(height, Math.ceil(system.chordBandBottom));
  const yTop = Math.max(0, Math.floor(system.chordBandTop));
  const y0 = Math.max(yTop, Math.round(yTop + (y1 - yTop) * 0.32));
  if (y1 - y0 < 4) return null;
  const x0 = Math.floor(width * 0.07);
  const x1 = Math.ceil(width * 0.93);
  if (x1 - x0 < 8) return null;
  return { x0, x1, y0, y1 };
}

export interface ChordInkBlob {
  /** Glyph center as percent of page width. */
  x: number;
  /** Glyph center as percent of page height. */
  y: number;
  width: number;
  height: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lineSpacing: number;
}

function blobFromBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pageWidth: number,
  pageHeight: number,
  lineSpacing: number
): ChordInkBlob {
  return {
    x0,
    y0,
    x1,
    y1,
    x: (((x0 + x1) / 2) / Math.max(1, pageWidth)) * 100,
    y: (((y0 + y1) / 2) / Math.max(1, pageHeight)) * 100,
    width: ((x1 - x0) / Math.max(1, pageWidth)) * 100,
    height: ((y1 - y0) / Math.max(1, pageHeight)) * 100,
    lineSpacing,
  };
}

function looksLikePrintedSymbol(widthPx: number, heightPx: number, spacing: number): boolean {
  if (spacing <= 0) return false;
  if (widthPx < spacing * 0.28 || heightPx < spacing * 0.38) return false;
  if (widthPx > spacing * 4.6 || heightPx > spacing * 2.3) return false;
  return true;
}

/**
 * Locate token-sized ink blobs in one staff's chord band.
 * Layout-only: connected components in the same window `scoreChordBandInk` uses.
 */
export function findChordInkBlobs(
  width: number,
  height: number,
  gray: Uint8Array,
  system: StaffSystem,
  inkThreshold?: number
): ChordInkBlob[] {
  const window = chordBandSearchWindow(width, height, system);
  if (!window) return [];
  const { x0, x1, y0, y1 } = window;
  const span = x1 - x0;
  const threshold = inkThreshold ?? estimateInkThreshold(gray);
  const spacing = Math.max(3, system.lineSpacing);
  const maskW = span;
  const maskH = y1 - y0;
  const dark = new Uint8Array(maskW * maskH);

  for (let y = y0; y < y1; y++) {
    const rowStart = y * width;
    let longest = 0;
    let run = 0;
    for (let x = x0; x < x1; x++) {
      if (gray[rowStart + x] < threshold) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    if (longest / span > 0.5) continue;
    const my = y - y0;
    for (let x = x0; x < x1; x++) {
      if (gray[rowStart + x] < threshold) {
        dark[my * maskW + (x - x0)] = 1;
      }
    }
  }

  const visited = new Uint8Array(maskW * maskH);
  const blobs: ChordInkBlob[] = [];

  for (let i = 0; i < dark.length; i++) {
    if (!dark[i] || visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    let minX = maskW;
    let minY = maskH;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const mx = idx % maskW;
      const my = (idx - mx) / maskW;
      if (mx < minX) minX = mx;
      if (my < minY) minY = my;
      if (mx > maxX) maxX = mx;
      if (my > maxY) maxY = my;
      count += 1;
      const left = idx - 1;
      const right = idx + 1;
      const up = idx - maskW;
      const down = idx + maskW;
      if (mx > 0 && dark[left] && !visited[left]) {
        visited[left] = 1;
        stack.push(left);
      }
      if (mx + 1 < maskW && dark[right] && !visited[right]) {
        visited[right] = 1;
        stack.push(right);
      }
      if (my > 0 && dark[up] && !visited[up]) {
        visited[up] = 1;
        stack.push(up);
      }
      if (my + 1 < maskH && dark[down] && !visited[down]) {
        visited[down] = 1;
        stack.push(down);
      }
    }

    if (count < Math.max(8, spacing * 0.35)) continue;
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    if (!looksLikePrintedSymbol(boxW, boxH, spacing)) continue;
    blobs.push(blobFromBox(
      x0 + minX,
      y0 + minY,
      x0 + maxX + 1,
      y0 + maxY + 1,
      width,
      height,
      spacing
    ));
  }

  return mergeNeighborInkBlobs(blobs, width, height);
}

/**
 * Join adjacent letter-sized blobs (C + / + E) into one crop.
 */
export function mergeNeighborInkBlobs(
  blobs: ChordInkBlob[],
  pageWidth: number,
  pageHeight: number
): ChordInkBlob[] {
  if (blobs.length < 2) return blobs.slice();
  const sorted = blobs.slice().sort((a, b) => (a.y - b.y) || (a.x0 - b.x0));
  const merged: ChordInkBlob[] = [];

  sorted.forEach((blob) => {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(blob);
      return;
    }
    const spacing = Math.max(prev.lineSpacing, blob.lineSpacing);
    const gap = blob.x0 - prev.x1;
    const yOverlap = Math.min(prev.y1, blob.y1) - Math.max(prev.y0, blob.y0);
    const combinedW = blob.x1 - prev.x0;
    if (
      gap >= -spacing * 0.35
      && gap <= spacing * 1.45
      && yOverlap >= spacing * 0.25
      && Math.abs(blob.y - prev.y) < 3.2
      && combinedW <= spacing * 6.6
    ) {
      merged[merged.length - 1] = blobFromBox(
        Math.min(prev.x0, blob.x0),
        Math.min(prev.y0, blob.y0),
        Math.max(prev.x1, blob.x1),
        Math.max(prev.y1, blob.y1),
        pageWidth,
        pageHeight,
        spacing
      );
      return;
    }
    merged.push(blob);
  });

  return merged;
}

export function findChordInkBlobsOnSystems(
  width: number,
  height: number,
  gray: Uint8Array,
  systems: StaffSystem[],
  inkThreshold?: number
): ChordInkBlob[] {
  const threshold = inkThreshold ?? estimateInkThreshold(gray);
  return systems.flatMap((system) => findChordInkBlobs(width, height, gray, system, threshold));
}

/**
 * Score a chord band for sparse, token-sized ink (printed chord symbols)
 * versus leftover staff lines or dense lyric/notation fill.
 */
export function scoreChordBandInk(
  width: number,
  height: number,
  gray: Uint8Array,
  system: StaffSystem,
  inkThreshold?: number
): { peaks: number; fill: number } {
  const window = chordBandSearchWindow(width, height, system);
  if (!window) return { peaks: 0, fill: 0 };
  const { x0, x1, y0, y1 } = window;
  const span = Math.max(1, x1 - x0);
  const threshold = inkThreshold ?? estimateInkThreshold(gray);
  const col = new Float64Array(span);
  let dark = 0;
  let area = 0;

  for (let y = y0; y < y1; y++) {
    const rowStart = y * width;
    let longest = 0;
    let run = 0;
    for (let x = x0; x < x1; x++) {
      if (gray[rowStart + x] < threshold) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    if (longest / span > 0.5) continue;
    area += span;
    for (let x = x0; x < x1; x++) {
      if (gray[rowStart + x] < threshold) {
        col[x - x0] += 1;
        dark += 1;
      }
    }
  }

  const fill = area > 0 ? dark / area : 0;
  const bandH = Math.max(1, y1 - y0);
  const minH = Math.max(2, bandH * 0.12);
  const smoothed = new Float64Array(span);
  for (let i = 0; i < span; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < span) {
        sum += col[j];
        count += 1;
      }
    }
    smoothed[i] = sum / count;
  }

  let peaks = 0;
  let i = 0;
  while (i < span) {
    if (smoothed[i] >= minH) {
      let j = i;
      while (j < span && smoothed[j] >= minH) j += 1;
      const peakWidth = j - i;
      if (peakWidth >= 4 && peakWidth <= span * 0.12) peaks += 1;
      i = j;
    } else {
      i += 1;
    }
  }

  return { peaks, fill };
}

export function staffBandHasSymbolInk(
  width: number,
  height: number,
  gray: Uint8Array,
  system: StaffSystem,
  inkThreshold?: number
): boolean {
  const { peaks, fill } = scoreChordBandInk(width, height, gray, system, inkThreshold);
  return peaks >= 2 && fill >= 0.012 && fill <= 0.09 && !(fill > 0.03 && peaks >= 10);
}

export function systemsWithSymbolInk(
  width: number,
  height: number,
  gray: Uint8Array,
  systems: StaffSystem[]
): StaffSystem[] {
  const threshold = estimateInkThreshold(gray);
  const scored = systems.map((system) => ({
    system,
    ...scoreChordBandInk(width, height, gray, system, threshold),
  }));
  const pageLooksLikeLead = scored.some((item) => staffBandHasSymbolInk(
    width,
    height,
    gray,
    item.system,
    threshold
  ));
  if (!pageLooksLikeLead) return [];
  return scored
    .filter((item) => item.peaks >= 1 && !(item.fill > 0.03 && item.peaks >= 10))
    .map((item) => item.system);
}

export function staffSystemsToKeepYRangesPct(
  systems: StaffSystem[],
  rasterHeight: number,
  padPct = 2.4
): Array<{ top: number; bottom: number }> {
  if (rasterHeight <= 0) return [];
  return systems.map((system) => ({
    top: Math.max(0, (system.chordBandTop / rasterHeight) * 100 - padPct),
    bottom: Math.min(100, (system.chordBandBottom / rasterHeight) * 100 + padPct),
  }));
}

export function detectStaffChordTracksFromGray(
  width: number,
  height: number,
  pixels: Uint8Array,
  inkThreshold?: number
): number[] {
  return detectStaffSystemsFromGray(width, height, pixels, inkThreshold).map((system) => {
    const y = (system.chordBandTop + system.chordBandBottom) / 2;
    return (y / height) * 100;
  });
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
