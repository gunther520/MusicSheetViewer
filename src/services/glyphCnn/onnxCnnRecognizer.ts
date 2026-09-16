import { greedyCtcDecode } from './ctcDecode';
import { PPOCR_EN_DICT } from './enDict';
import { preprocessPpocrRec } from './preprocess';
import type { GlyphImage, GlyphRead, GlyphRecognizer } from './types';

/** Public English PP-OCRv4 rec CNN. Not trained on this repo's sheets. */
export const PPOCR_EN_REC_MODEL_URLS = [
  'https://huggingface.co/cycloneboy/en_PP-OCRv4_rec_infer/resolve/main/model.onnx',
  'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv4/rec/en_PP-OCRv4_rec_mobile.onnx',
] as const;

const ORT_WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = import('onnxruntime-web').InferenceSession;

let shared: OnnxCnnGlyphRecognizer | null = null;

export function getSharedCnnRecognizer(): OnnxCnnGlyphRecognizer {
  if (!shared) shared = new OnnxCnnGlyphRecognizer();
  return shared;
}

/**
 * Default leftover-glyph reader: public English PP-OCRv4 rec CNN (CTC).
 * Swap by implementing GlyphRecognizer — do not train on this repo's sheets.
 */
export function createGlyphRecognizer(): GlyphRecognizer {
  return getSharedCnnRecognizer();
}

export function resetSharedCnnRecognizer(): void {
  shared = null;
}

/**
 * Modular CNN recognizer: MobileNet/SVTR PP-OCR English rec, CTC decoded.
 * Weights are fetched from a public pretrained checkpoint. Failure is non-fatal.
 */
export class OnnxCnnGlyphRecognizer implements GlyphRecognizer {
  readonly id = 'ppocr-en-v4-cnn';
  private sessionPromise: Promise<InferenceSession | null> | null = null;

  recognize(image: GlyphImage): Promise<GlyphRead | null> {
    return this.infer(image);
  }

  private async infer(image: GlyphImage): Promise<GlyphRead | null> {
    if (image.width < 4 || image.height < 4) return null;
    const session = await this.getSession();
    if (!session) return null;

    const input = preprocessPpocrRec(image);
    const ort = await loadOrt();
    if (!ort) return null;

    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    if (!inputName || !outputName) return null;

    const tensor = new ort.Tensor('float32', input.data, [1, 3, input.height, input.width]);
    const result = await session.run({ [inputName]: tensor });
    const output = result[outputName];
    if (!output || !output.data) return null;

    const dims = output.dims || [];
    let timeSteps = 0;
    let classCount = 0;
    if (dims.length === 3) {
      // [N, T, C] or [N, C, T]
      if (dims[2] === PPOCR_EN_DICT.length + 1) {
        timeSteps = dims[1];
        classCount = dims[2];
      } else if (dims[1] === PPOCR_EN_DICT.length + 1) {
        timeSteps = dims[2];
        classCount = dims[1];
      } else {
        timeSteps = dims[1];
        classCount = dims[2];
      }
    } else if (dims.length === 2) {
      timeSteps = dims[0];
      classCount = dims[1];
    } else {
      return null;
    }

    const logits = output.data as Float32Array;
    const decoded = dims.length === 3 && dims[1] === classCount
      ? greedyCtcDecode(transposeNcToNt(logits, timeSteps, classCount), timeSteps, classCount, PPOCR_EN_DICT)
      : greedyCtcDecode(logits, timeSteps, classCount, PPOCR_EN_DICT);

    if (!decoded.text) return null;
    return {
      text: decoded.text,
      confidence: decoded.confidence,
      source: this.id,
    };
  }

  private getSession(): Promise<InferenceSession | null> {
    if (!this.sessionPromise) {
      this.sessionPromise = loadCnnSession().catch((error) => {
        console.warn('Pretrained chord CNN unavailable; using OCR fallback:', error);
        return null;
      });
    }
    return this.sessionPromise;
  }
}

function transposeNcToNt(data: Float32Array, timeSteps: number, classCount: number): Float32Array {
  const out = new Float32Array(timeSteps * classCount);
  for (let t = 0; t < timeSteps; t++) {
    for (let c = 0; c < classCount; c++) {
      out[t * classCount + c] = data[c * timeSteps + t];
    }
  }
  return out;
}

async function loadOrt(): Promise<OrtModule | null> {
  try {
    const ort = await import('onnxruntime-web');
    if (ort.env?.wasm) {
      ort.env.wasm.wasmPaths = ORT_WASM_CDN;
      ort.env.wasm.numThreads = 1;
    }
    return ort;
  } catch (error) {
    console.warn('onnxruntime-web failed to load:', error);
    return null;
  }
}

async function loadCnnSession(): Promise<InferenceSession | null> {
  const ort = await loadOrt();
  if (!ort) return null;

  let lastError: unknown;
  for (const url of PPOCR_EN_REC_MODEL_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`CNN weights ${response.status} from ${url}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      return await ort.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No pretrained CNN checkpoint reachable');
}
