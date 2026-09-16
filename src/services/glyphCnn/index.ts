/**
 * Modular printed-glyph CNN: public PP-OCRv4 English rec weights + CTC.
 * Implement GlyphRecognizer to swap engines. Do not train on this repo's sheets.
 */
export type { GlyphImage, GlyphRead, GlyphRecognizer } from './types';
export { CNN_GLYPH_MIN_CONFIDENCE } from './types';
export { greedyCtcDecode } from './ctcDecode';
export { preprocessPpocrRec, PPOCR_REC_HEIGHT, PPOCR_REC_MAX_WIDTH } from './preprocess';
export { PPOCR_EN_DICT, PPOCR_EN_CLASS_COUNT } from './enDict';
export {
  OnnxCnnGlyphRecognizer,
  getSharedCnnRecognizer,
  createGlyphRecognizer,
  resetSharedCnnRecognizer,
  PPOCR_EN_REC_MODEL_URLS,
} from './onnxCnnRecognizer';
export { bandImageToGlyph } from './fromBand';
