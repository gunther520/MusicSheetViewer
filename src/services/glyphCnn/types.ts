/** One grayscale crop of a printed glyph (row-major, 0–255). */
export interface GlyphImage {
  gray: Uint8Array;
  width: number;
  height: number;
}

export interface GlyphRead {
  text: string;
  confidence: number;
  source: string;
}

/**
 * Swappable printed-glyph reader.
 * Implementations must not train on this app's sheets; use public pretrained weights or a generic OCR engine.
 */
export interface GlyphRecognizer {
  readonly id: string;
  recognize(image: GlyphImage): Promise<GlyphRead | null>;
}

/** Minimum CTC confidence (softmax) to accept a CNN read before Tesseract fallback. */
export const CNN_GLYPH_MIN_CONFIDENCE = 0.35;
