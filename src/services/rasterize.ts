export interface GrayRaster {
  width: number;
  height: number;
  gray: Uint8Array;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  meanLuma: number;
}

export interface BandImage {
  target: Uint8Array | HTMLCanvasElement | string;
  width: number;
  height: number;
  srcX: number;
  srcY: number;
  upscale: number;
}

export interface MontageSlice {
  montageY0: number;
  montageY1: number;
  srcY: number;
  srcH: number;
}

export interface ChordBandMontage {
  dataUrl: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  slices: MontageSlice[];
}

export interface ChordBandSliceRequest {
  srcY: number;
  srcH: number;
}

function meanLumaOf(gray: Uint8Array): number {
  let sum = 0;
  const step = Math.max(1, Math.floor(gray.length / 6000));
  let count = 0;
  for (let i = 0; i < gray.length; i += step) {
    sum += gray[i];
    count += 1;
  }
  return count ? sum / count : 128;
}

export async function rasterizeSheet(
  source: string | HTMLImageElement,
  maxWidth = 1400
): Promise<GrayRaster> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { rasterizeWithSharp } = await import(/* @vite-ignore */ './rasterizeNode');
    return rasterizeWithSharp(typeof source === 'string' ? source : source.src, maxWidth);
  }
  return rasterizeWithCanvas(source, maxWidth);
}

async function rasterizeWithCanvas(
  source: string | HTMLImageElement,
  maxWidth: number
): Promise<GrayRaster> {
  const img = typeof source === 'string'
    ? await loadDomImage(source)
    : source;
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  const scale = Math.min(1, maxWidth / Math.max(1, sourceWidth));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas for sheet rasterization');
  }
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return {
    width,
    height,
    gray,
    sourceWidth,
    sourceHeight,
    scale,
    meanLuma: meanLumaOf(gray),
  };
}

function loadDomImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function invertSheetForOcr(
  source: string | HTMLImageElement,
  maxDim = 2000
): Promise<BandImage['target']> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { invertSheetWithSharp } = await import(/* @vite-ignore */ './rasterizeNode');
    return invertSheetWithSharp(typeof source === 'string' ? source : source.src, maxDim);
  }
  const img = typeof source === 'string' ? await loadDomImage(source) : source;
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source as string;
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function cropBandForOcr(
  source: string | HTMLImageElement,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  upscale = 2.5,
  invert = false
): Promise<BandImage> {
  const width = Math.max(8, Math.round(srcW * upscale));
  const height = Math.max(8, Math.round(srcH * upscale));

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { cropBandWithSharp } = await import(/* @vite-ignore */ './rasterizeNode');
    const buffer = await cropBandWithSharp(
      typeof source === 'string' ? source : source.src,
      srcX,
      srcY,
      srcW,
      srcH,
      upscale,
      invert
    );
    return { target: buffer, width, height, srcX, srcY, upscale };
  }

  const img = typeof source === 'string' ? await loadDomImage(source) : source;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not crop chord band');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, width, height);
  if (invert) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return { target: canvas, width, height, srcX, srcY, upscale };
}

function uint8ToBase64(bytes: Uint8Array): string {
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Stack full-width chord-band crops into one image for a single Vision call.
 */
export async function buildChordBandMontage(
  source: string | HTMLImageElement,
  slices: ChordBandSliceRequest[],
  sourceWidth: number,
  sourceHeight: number,
  invert = false
): Promise<ChordBandMontage | null> {
  const usable = slices.filter((slice) => slice.srcH >= 8 && sourceWidth >= 8);
  if (usable.length === 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;

  const upscale = Math.min(2.2, 1600 / Math.max(1, sourceWidth));
  const gap = 8;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { buildMontageWithSharp } = await import(/* @vite-ignore */ './rasterizeNode');
    const built = await buildMontageWithSharp(
      typeof source === 'string' ? source : source.src,
      usable,
      sourceWidth,
      invert,
      upscale,
      gap
    );
    return {
      dataUrl: `data:image/jpeg;base64,${uint8ToBase64(built.buffer)}`,
      width: built.width,
      height: built.height,
      sourceWidth,
      sourceHeight,
      slices: built.slices,
    };
  }

  const img = typeof source === 'string' ? await loadDomImage(source) : source;
  const outW = Math.max(8, Math.round(sourceWidth * upscale));
  const bandHeights = usable.map((slice) => Math.max(24, Math.round(slice.srcH * upscale)));
  const outH = bandHeights.reduce((sum, h) => sum + h, 0) + gap * (usable.length - 1);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  const mapped: MontageSlice[] = [];
  let y = 0;
  usable.forEach((slice, i) => {
    const h = bandHeights[i];
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, slice.srcY, sourceWidth, slice.srcH, 0, y, outW, h);
    if (invert) {
      const imageData = ctx.getImageData(0, y, outW, h);
      const data = imageData.data;
      for (let p = 0; p < data.length; p += 4) {
        data[p] = 255 - data[p];
        data[p + 1] = 255 - data[p + 1];
        data[p + 2] = 255 - data[p + 2];
      }
      ctx.putImageData(imageData, 0, y);
    }
    mapped.push({
      montageY0: y,
      montageY1: y + h,
      srcY: slice.srcY,
      srcH: slice.srcH,
    });
    y += h + gap;
  });

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width: outW,
    height: outH,
    sourceWidth,
    sourceHeight,
    slices: mapped,
  };
}

export async function sheetToDataUrl(
  source: string,
  invert = false,
  maxDim = 1600
): Promise<string> {
  if (source.startsWith('data:') && !invert) return source;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { fileToVisionJpegDataUrl } = await import(/* @vite-ignore */ './rasterizeNode');
    if (source.startsWith('data:')) return source;
    return fileToVisionJpegDataUrl(source, maxDim, invert);
  }

  if (invert) {
    const inverted = await invertSheetForOcr(source, maxDim);
    if (inverted instanceof HTMLCanvasElement) {
      return inverted.toDataURL('image/jpeg', 0.85);
    }
  }

  if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('http')) {
    return source;
  }
  return source;
}
