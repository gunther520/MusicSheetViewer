import type { GlyphImage } from './types';

export const PPOCR_REC_HEIGHT = 48;
export const PPOCR_REC_MAX_WIDTH = 320;

function sampleBilinear(image: GlyphImage, x: number, y: number): number {
  const w = image.width;
  const h = image.height;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, x - Math.floor(x)));
  const fy = Math.min(1, Math.max(0, y - Math.floor(y)));
  const gray = image.gray;
  const a = gray[y0 * w + x0] ?? 255;
  const b = gray[y0 * w + x1] ?? 255;
  const c = gray[y1 * w + x0] ?? 255;
  const d = gray[y1 * w + x1] ?? 255;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * Resize a gray crop to PP-OCR rec input: NCHW float32, 3×48×W.
 * Matches Paddle/RapidOCR: bilinear resize, (pixel/255 - 0.5) / 0.5 → [-1, 1],
 * width padded to a multiple of 8 with 0 (mid-gray). Not fitted on this repo's sheets.
 */
export function preprocessPpocrRec(
  image: GlyphImage,
  targetHeight = PPOCR_REC_HEIGHT,
  maxWidth = PPOCR_REC_MAX_WIDTH
): { data: Float32Array; width: number; height: number; contentWidth: number } {
  const srcW = Math.max(1, image.width);
  const srcH = Math.max(1, image.height);
  const scale = targetHeight / srcH;
  const contentWidth = Math.max(8, Math.min(maxWidth, Math.round(srcW * scale)));
  const width = Math.min(maxWidth, Math.max(8, Math.ceil(contentWidth / 8) * 8));
  const height = targetHeight;
  const chw = new Float32Array(3 * height * width);
  const plane = height * width;
  const xScale = srcW / contentWidth;
  const yScale = srcH / height;

  for (let y = 0; y < height; y++) {
    const srcY = (y + 0.5) * yScale - 0.5;
    for (let x = 0; x < contentWidth; x++) {
      const srcX = (x + 0.5) * xScale - 0.5;
      const luma = sampleBilinear(image, srcX, srcY) / 255;
      const norm = (luma - 0.5) / 0.5;
      const idx = y * width + x;
      chw[idx] = norm;
      chw[plane + idx] = norm;
      chw[plane * 2 + idx] = norm;
    }
  }

  return { data: chw, width, height, contentWidth };
}
