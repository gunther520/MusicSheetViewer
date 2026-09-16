import { describe, it, expect } from 'vitest';
import {
  createGlyphRecognizer,
  greedyCtcDecode,
  preprocessPpocrRec,
  PPOCR_EN_CLASS_COUNT,
  PPOCR_EN_DICT,
  PPOCR_EN_REC_MODEL_URLS,
  PPOCR_REC_HEIGHT,
  type GlyphImage,
  type GlyphRecognizer,
} from './index';

function classOf(glyph: string): number {
  const index = PPOCR_EN_DICT.indexOf(glyph as typeof PPOCR_EN_DICT[number]);
  if (index < 0) throw new Error(`missing ${glyph}`);
  return index + 1;
}

function logitsFor(sequence: number[], classCount = PPOCR_EN_CLASS_COUNT): Float32Array {
  const data = new Float32Array(sequence.length * classCount);
  for (let t = 0; t < sequence.length; t++) {
    data[t * classCount + sequence[t]] = 8;
  }
  return data;
}

describe('pretrained glyph CNN (no repo-sheet training)', () => {
  it('uses the public English PP-OCR charset (95 glyphs + CTC blank)', () => {
    expect(PPOCR_EN_DICT).toHaveLength(95);
    expect(PPOCR_EN_CLASS_COUNT).toBe(96);
    expect(PPOCR_EN_DICT).toContain('B');
    expect(PPOCR_EN_DICT).toContain('b');
    expect(PPOCR_EN_DICT).toContain('/');
    expect(PPOCR_EN_DICT).toContain('#');
  });

  it('points at public pretrained ONNX weights, not this repo', () => {
    expect(PPOCR_EN_REC_MODEL_URLS[0]).toMatch(/huggingface\.co/);
    expect(PPOCR_EN_REC_MODEL_URLS[1]).toMatch(/modelscope/);
    for (const url of PPOCR_EN_REC_MODEL_URLS) {
      expect(url).not.toMatch(/testing\//);
    }
  });

  it('exposes a swappable GlyphRecognizer that does not train locally', () => {
    const recognizer = createGlyphRecognizer();
    expect(recognizer.id).toBe('ppocr-en-v4-cnn');
    expect(typeof recognizer.recognize).toBe('function');
    const other: GlyphRecognizer = {
      id: 'scripted',
      recognize: async () => ({ text: 'Bb', confidence: 0.9, source: 'scripted' }),
    };
    expect(other.id).toBe('scripted');
  });

  it('CTC-decodes logits to text and skips blanks/repeats', () => {
    const B = classOf('B');
    const b = classOf('b');
    const decoded = greedyCtcDecode(logitsFor([B, B, 0, b]), 4, PPOCR_EN_CLASS_COUNT, PPOCR_EN_DICT);
    expect(decoded.text).toBe('Bb');
    expect(decoded.confidence).toBeGreaterThan(0.8);
  });

  it('CTC-decodes already-softmaxed rows without double-counting blanks', () => {
    const C = classOf('C');
    const slash = classOf('/');
    const E = classOf('E');
    const classCount = PPOCR_EN_CLASS_COUNT;
    const rows = [C, 0, slash, E];
    const data = new Float32Array(rows.length * classCount);
    for (let t = 0; t < rows.length; t++) {
      const row = t * classCount;
      for (let c = 0; c < classCount; c++) data[row + c] = 0.0001;
      data[row + rows[t]] = 0.9;
    }
    expect(greedyCtcDecode(data, rows.length, classCount, PPOCR_EN_DICT).text).toBe('C/E');
  });

  it('returns empty text when every timestep is CTC blank', () => {
    expect(greedyCtcDecode(logitsFor([0, 0, 0]), 3, PPOCR_EN_CLASS_COUNT, PPOCR_EN_DICT)).toEqual({
      text: '',
      confidence: 0,
    });
  });

  it('preprocesses crops to Paddle rec NCHW [-1, 1] at height 48', () => {
    const white: GlyphImage = {
      gray: new Uint8Array(16 * 8).fill(255),
      width: 16,
      height: 8,
    };
    const black: GlyphImage = {
      gray: new Uint8Array(16 * 8).fill(0),
      width: 16,
      height: 8,
    };
    const w = preprocessPpocrRec(white);
    const k = preprocessPpocrRec(black);
    expect(w.height).toBe(PPOCR_REC_HEIGHT);
    expect(w.width % 8).toBe(0);
    expect(w.data.length).toBe(3 * w.height * w.width);
    expect(w.data[0]).toBeGreaterThan(0.9);
    expect(k.data[0]).toBeLessThan(-0.9);
  });
});
