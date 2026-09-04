import { createWorker } from 'tesseract.js';
import { ChordPosition, isLikelyChordSymbol, normalizeAccidentals } from '../utils/chordUtils';

export interface ScanProgress {
  status: string;
  progress: number;
}

/**
 * Clean up common OCR artifacts on musical chord symbols
 */
export function cleanOcrToken(token: string): string {
  let cleaned = token.trim();
  // Strip common surrounding punctuation and musical barlines
  cleaned = cleaned.replace(/^[|!\[\]\(\)\{\}\/\\<>"'.,:;`~#*_-]+/, '');
  cleaned = cleaned.replace(/[|!\[\]\(\)\{\}\/\\<>"'.,:;`~*_-]+$/, '');
  cleaned = normalizeAccidentals(cleaned);

  // Common OCR confusion: lowercase l or 1 for I, 8 for B in some fonts, etc.
  if (/^[A-G][0-9a-zA-Z#b/]+$/.test(cleaned)) {
    // If first letter is lowercase a-g, capitalize
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Scans an image URL or Data URL for chord symbols using Tesseract OCR
 */
export async function scanSheetForChords(
  imageSource: string | HTMLImageElement,
  onProgress?: (progress: ScanProgress) => void
): Promise<ChordPosition[]> {
  onProgress?.({ status: 'Loading OCR engine...', progress: 0.1 });

  // Load image to get natural dimensions
  const img = await loadImage(imageSource);
  const imgWidth = img.naturalWidth || img.width;
  const imgHeight = img.naturalHeight || img.height;

  onProgress?.({ status: 'Analyzing sheet music image...', progress: 0.3 });

  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        onProgress?.({
          status: `Recognizing chords (${Math.round(m.progress * 100)}%)...`,
          progress: 0.3 + m.progress * 0.6,
        });
      }
    },
  });

  try {
    const ret = await worker.recognize(img);
    await worker.terminate();

    onProgress?.({ status: 'Extracting chord positions...', progress: 0.95 });

    const chords: ChordPosition[] = [];
    let counter = 1;

    // Process recognized words and their bounding boxes
    if (ret.data && ret.data.words) {
      for (const word of ret.data.words) {
        const text = cleanOcrToken(word.text);
        if (isLikelyChordSymbol(text)) {
          const { x0, y0, x1, y1 } = word.bbox;

          // Calculate normalized percentage coordinates (0 - 100%)
          const xPercent = (x0 / imgWidth) * 100;
          const yPercent = (y0 / imgHeight) * 100;
          const widthPercent = ((x1 - x0) / imgWidth) * 100;
          const heightPercent = ((y1 - y0) / imgHeight) * 100;

          chords.push({
            id: `ocr-${counter++}-${Date.now()}`,
            originalText: text,
            currentText: text,
            x: Math.max(0, Math.min(98, xPercent)),
            y: Math.max(0, Math.min(98, yPercent)),
            width: Math.max(3, widthPercent),
            height: Math.max(2, heightPercent),
            confidence: word.confidence / 100,
          });
        }
      }
    }

    onProgress?.({ status: 'Completed!', progress: 1 });
    return chords;
  } catch (error) {
    console.error('OCR Error:', error);
    try {
      await worker.terminate();
    } catch {
      // ignore
    }
    throw error;
  }
}

function loadImage(source: string | HTMLImageElement): Promise<HTMLImageElement> {
  if (typeof source !== 'string') {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = source;
  });
}
