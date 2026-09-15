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
    const { rasterizeWithSharp } = await import('./rasterizeNode');
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
    const { invertSheetWithSharp } = await import('./rasterizeNode');
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
    const { cropBandWithSharp } = await import('./rasterizeNode');
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
