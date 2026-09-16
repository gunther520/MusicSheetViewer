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

export async function decodePngToGray(png: Uint8Array): Promise<{ width: number; height: number; gray: Uint8Array }> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    gray: data,
  };
}

export async function buildMontageWithSharp(
  filePath: string,
  slices: Array<{ srcY: number; srcH: number }>,
  sourceWidth: number,
  invert: boolean,
  upscale: number,
  gap = 8,
  gutterWidth = 0
): Promise<{
  buffer: Uint8Array;
  width: number;
  height: number;
  gutterWidth: number;
  slices: Array<{ montageY0: number; montageY1: number; srcY: number; srcH: number }>;
}> {
  const meta = await sharp(filePath).metadata();
  const imgW = meta.width || sourceWidth;
  const imgH = meta.height || 1;
  const musicW = Math.max(8, Math.round(sourceWidth * upscale));
  const gutter = Math.max(0, Math.round(gutterWidth));
  const outW = musicW + gutter;
  const mapped: Array<{ montageY0: number; montageY1: number; srcY: number; srcH: number }> = [];
  const composites: Array<{ input: Buffer; top: number; left: number }> = [];
  let y = 0;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const top = Math.max(0, Math.min(imgH - 1, Math.round(slice.srcY)));
    const height = Math.max(8, Math.min(imgH - top, Math.round(slice.srcH)));
    const outH = Math.max(28, Math.round(height * upscale));
    let pipeline = sharp(filePath)
      .extract({ left: 0, top, width: Math.max(8, Math.min(imgW, Math.round(sourceWidth))), height })
      .resize({ width: musicW, height: outH });
    if (invert) pipeline = pipeline.negate();
    const input = await pipeline.png().toBuffer();
    composites.push({ input, top: y, left: gutter });
    if (gutter > 0) {
      const fontSize = Math.max(16, Math.round(outH * 0.42));
      const labelSvg = new TextEncoder().encode(
        `<svg width="${gutter}" height="${outH}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#ececec"/>
          <text x="${gutter / 2}" y="${outH / 2}" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#111111" text-anchor="middle" dominant-baseline="central">${i + 1}</text>
        </svg>`
      );
      const label = await sharp(labelSvg).png().toBuffer();
      composites.push({ input: Buffer.from(label), top: y, left: 0 });
    }
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
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    buffer,
    width: outW,
    height: Math.max(8, y),
    gutterWidth: gutter,
    slices: mapped,
  };
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
  maxDim = 2048,
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
  const buffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
