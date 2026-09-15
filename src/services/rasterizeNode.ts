import sharp from 'sharp';
import type { GrayRaster } from './rasterize';

export async function rasterizeWithSharp(filePath: string, maxWidth = 1400): Promise<GrayRaster> {
  const meta = await sharp(filePath).metadata();
  const sourceWidth = meta.width || 1200;
  const sourceHeight = meta.height || 1600;
  const scale = Math.min(1, maxWidth / Math.max(1, sourceWidth));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const { data } = await sharp(filePath)
    .resize({ width, height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  const step = Math.max(1, Math.floor(data.length / 6000));
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += data[i];
    count += 1;
  }

  return {
    width,
    height,
    gray: data,
    sourceWidth,
    sourceHeight,
    scale,
    meanLuma: count ? sum / count : 128,
  };
}

export async function cropBandWithSharp(
  filePath: string,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  upscale: number,
  invert: boolean
): Promise<Uint8Array> {
  const meta = await sharp(filePath).metadata();
  const imgW = meta.width || srcW;
  const imgH = meta.height || srcH;
  const left = Math.max(0, Math.min(imgW - 1, Math.round(srcX)));
  const top = Math.max(0, Math.min(imgH - 1, Math.round(srcY)));
  const width = Math.max(8, Math.min(imgW - left, Math.round(srcW)));
  const height = Math.max(8, Math.min(imgH - top, Math.round(srcH)));
  let pipeline = sharp(filePath).extract({ left, top, width, height }).resize({
    width: Math.max(8, Math.round(width * upscale)),
    height: Math.max(8, Math.round(height * upscale)),
  });
  if (invert) {
    pipeline = pipeline.negate();
  }
  return pipeline.sharpen().png().toBuffer();
}

export async function buildMontageWithSharp(
  filePath: string,
  slices: Array<{ srcY: number; srcH: number }>,
  sourceWidth: number,
  invert: boolean,
  upscale: number,
  gap = 8
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  slices: Array<{ montageY0: number; montageY1: number; srcY: number; srcH: number }>;
}> {
  const meta = await sharp(filePath).metadata();
  const imgW = meta.width || sourceWidth;
  const imgH = meta.height || 1;
  const outW = Math.max(8, Math.round(sourceWidth * upscale));
  const mapped: Array<{ montageY0: number; montageY1: number; srcY: number; srcH: number }> = [];
  const composites: sharp.OverlayOptions[] = [];
  let y = 0;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const top = Math.max(0, Math.min(imgH - 1, Math.round(slice.srcY)));
    const height = Math.max(8, Math.min(imgH - top, Math.round(slice.srcH)));
    const outH = Math.max(24, Math.round(height * upscale));
    let pipeline = sharp(filePath)
      .extract({ left: 0, top, width: Math.max(8, Math.min(imgW, Math.round(sourceWidth))), height })
      .resize({ width: outW, height: outH });
    if (invert) pipeline = pipeline.negate();
    const input = await pipeline.png().toBuffer();
    composites.push({ input, top: y, left: 0 });
    mapped.push({
      montageY0: y,
      montageY1: y + outH,
      srcY: slice.srcY,
      srcH: slice.srcH,
    });
    y += outH;
    if (i < slices.length - 1) y += gap;
  }

  const buffer = await sharp({
    create: {
      width: outW,
      height: Math.max(8, y),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer, width: outW, height: Math.max(8, y), slices: mapped };
}

export async function invertSheetWithSharp(filePath: string, maxDim = 2000): Promise<Uint8Array> {
  const meta = await sharp(filePath).metadata();
  const sourceWidth = meta.width || 1200;
  const sourceHeight = meta.height || 1600;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return sharp(filePath)
    .resize({ width, height })
    .negate()
    .png()
    .toBuffer();
}

export async function fileToVisionJpegDataUrl(
  filePath: string,
  maxDim = 1600,
  invert = false
): Promise<string> {
  const meta = await sharp(filePath).metadata();
  const sourceWidth = meta.width || 1200;
  const sourceHeight = meta.height || 1600;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  let pipeline = sharp(filePath).resize({ width, height });
  if (invert) pipeline = pipeline.negate();
  const buffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
