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
