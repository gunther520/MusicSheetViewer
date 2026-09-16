import type { BandImage } from '../rasterize';
import type { GlyphImage } from './types';

export async function bandImageToGlyph(band: BandImage): Promise<GlyphImage | null> {
  const target = band.target;
  if (typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement) {
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    const image = ctx.getImageData(0, 0, target.width, target.height);
    const gray = new Uint8Array(image.width * image.height);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = Math.round(0.299 * image.data[p] + 0.587 * image.data[p + 1] + 0.114 * image.data[p + 2]);
    }
    return { gray, width: image.width, height: image.height };
  }

  if (target instanceof Uint8Array) {
    const { decodePngToGray } = await import(/* @vite-ignore */ '../rasterizeNode');
    return decodePngToGray(target);
  }

  return null;
}
