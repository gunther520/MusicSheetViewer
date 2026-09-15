import { ChordPosition, isValidChord, normalizeChordToken } from './ocrService';
import {
  completeOpenRouterVision,
  extractJsonObject,
  OPENROUTER_PREFERRED_VL_MODEL,
} from './openRouterClient';
import { alignChordsToStaffTracks, detectStaffTracksFromDataUrl, snapChordsToStaffTracks, StaffSystem } from './staffGeometry';
import { buildChordBandMontage, GrayRaster, sheetToDataUrl } from './rasterize';
import { mapMontageChordsToPage } from './mergeChordDetections';
import {
  resolveVisionPrompts,
  VISION_DETECTION_SYSTEM_PROMPT,
  type VisionSheetLayout,
} from './visionPrompt';

export { VISION_DETECTION_SYSTEM_PROMPT };
export type { VisionSheetLayout };

export type VisionProvider = 'openrouter' | 'openai' | 'gemini' | 'anthropic';

export interface VisionAiOptions {
  provider?: VisionProvider;
  apiKey?: string;
  apiEndpoint?: string;
}

export interface DetectedVisionChord {
  chord: string;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  heightPercent?: number;
  confidence?: number;
}

/**
 * Validates and converts raw vision AI chord entries into standard ChordPosition objects
 */
export function parseVisionChordsResponse(
  rawJson: any
): ChordPosition[] {
  let parsed: any = rawJson;
  if (typeof rawJson === 'string') {
    parsed = extractJsonObject(rawJson);
    if (!parsed) {
      console.error('Failed to parse Vision AI JSON output');
      return [];
    }
  }

  const rawList: any[] = Array.isArray(parsed?.chords)
    ? parsed.chords
    : Array.isArray(parsed)
    ? parsed
    : [];

  const validChords: ChordPosition[] = [];
  let idCounter = 1;

  rawList.forEach((item) => {
    if (!item || typeof item.chord !== 'string') return;
    const rewritten = item.chord.replace(/[△∆]/g, 'maj');
    const cleanNames = normalizeChordToken(rewritten);
    const chordName = cleanNames[0] || rewritten.trim();
    if (!chordName || !isValidChord(chordName)) return;

    const x = Math.max(0, Math.min(98, Number(item.xPercent) || 0));
    const y = Math.max(0, Math.min(98, Number(item.yPercent) || 0));
    const width = Math.max(3, Math.min(15, Number(item.widthPercent) || 5));
    const height = Math.max(2, Math.min(8, Number(item.heightPercent) || 3));

    validChords.push({
      id: `vision-${idCounter++}-${Date.now()}`,
      originalText: chordName,
      currentText: chordName,
      x,
      y,
      width,
      height,
      confidence: 0.98,
    });
  });

  return validChords;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const longest = Math.max(width, height);
      if (!longest || longest <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const scale = maxDim / longest;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function prepareSheetImageForVision(source: string, maxDim = 1600): Promise<string> {
  let dataUrl = source;
  if (!source.startsWith('data:')) {
    try {
      dataUrl = await sheetToDataUrl(source);
      if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:')) {
        const response = await fetch(source);
        if (response.ok) {
          const blob = await response.blob();
          if (typeof FileReader !== 'undefined') {
            dataUrl = await blobToDataUrl(blob);
          }
        }
      }
    } catch {
      return source;
    }
  }
  return downscaleDataUrl(dataUrl, maxDim);
}

export function canAttemptVision(options?: VisionAiOptions): boolean {
  if (options?.apiKey) return true;
  try {
    if (typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY) return true;
  } catch {
    // ignore
  }
  return typeof window !== 'undefined';
}

export async function detectChordsWithOpenRouter(
  imageBase64OrUrl: string,
  apiKey: string,
  layout: VisionSheetLayout = 'full-sheet'
): Promise<ChordPosition[]> {
  const prompts = resolveVisionPrompts(layout);
  const { raw } = await completeOpenRouterVision({
    image: imageBase64OrUrl,
    apiKey,
    systemPrompt: prompts.system,
    userText: prompts.user,
    preferredModel: OPENROUTER_PREFERRED_VL_MODEL,
  });
  return parseVisionChordsResponse(raw);
}

/**
 * Calls OpenAI GPT-4o-mini Vision to detect chords on music sheet
 */
export async function detectChordsWithOpenAI(
  imageBase64OrUrl: string,
  apiKey: string
): Promise<ChordPosition[]> {
  const imageUrl = imageBase64OrUrl.startsWith('http') || imageBase64OrUrl.startsWith('data:')
    ? imageBase64OrUrl
    : `data:image/jpeg;base64,${imageBase64OrUrl}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: VISION_DETECTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please detect and locate all chords printed above staves on this sheet music image.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return parseVisionChordsResponse(content);
}

/**
 * Calls Google Gemini Vision to detect chords on music sheet
 */
export async function detectChordsWithGemini(
  imageBase64OrUrl: string,
  apiKey: string
): Promise<ChordPosition[]> {
  let base64Data = imageBase64OrUrl;
  let mimeType = 'image/jpeg';

  if (imageBase64OrUrl.startsWith('data:')) {
    const matches = imageBase64OrUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: VISION_DETECTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            { text: 'Detect all chords printed above staves on this music sheet.' },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseVisionChordsResponse(content);
}

async function alignDetectedChords(imageDataUrl: string, chords: ChordPosition[]): Promise<ChordPosition[]> {
  if (chords.length === 0) return chords;
  try {
    const staffTracks = await detectStaffTracksFromDataUrl(imageDataUrl);
    return snapChordsToStaffTracks(chords, staffTracks);
  } catch {
    return alignChordsToStaffTracks(chords);
  }
}

async function requestVisionChords(
  image: string,
  layout: VisionSheetLayout,
  options?: VisionAiOptions
): Promise<ChordPosition[]> {
  const prompts = resolveVisionPrompts(layout);
  const provider = options?.provider || 'openrouter';
  const nodeKey = options?.apiKey
    || (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined);

  if (nodeKey && typeof window === 'undefined' && provider === 'openrouter') {
    return detectChordsWithOpenRouter(image, nodeKey, layout);
  }

  const endpoint = options?.apiEndpoint || '/api/detect-chords';
  try {
    const proxyResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        provider,
        layout,
      }),
    });

    if (proxyResponse.ok) {
      const result = await proxyResponse.json();
      return parseVisionChordsResponse(result);
    }
  } catch {
    // Serverless proxy not deployed or unreachable
  }

  if (options?.apiKey) {
    if (provider === 'gemini') {
      return detectChordsWithGemini(image, options.apiKey);
    }
    if (provider === 'openai') {
      return detectChordsWithOpenAI(image, options.apiKey);
    }
    return detectChordsWithOpenRouter(image, options.apiKey, layout);
  }

  if (nodeKey && provider === 'openrouter') {
    return detectChordsWithOpenRouter(image, nodeKey, layout);
  }

  return [];
}

export function systemsToMontageSlices(
  systems: StaffSystem[],
  raster: GrayRaster
): Array<{ srcY: number; srcH: number }> {
  return systems.map((system) => {
    const srcY = Math.max(0, system.chordBandTop / raster.scale);
    const srcBottom = Math.min(raster.sourceHeight, system.chordBandBottom / raster.scale);
    return {
      srcY,
      srcH: Math.max(12, srcBottom - srcY),
    };
  });
}

/**
 * Layout-aware Vision: staff-band montage when staves exist, otherwise full page.
 * Uses only free OpenRouter models (or an explicit paid provider the user chose).
 */
export async function detectChordsWithSheetLayout(
  imageSource: string,
  options: VisionAiOptions & {
    systems: StaffSystem[];
    raster: GrayRaster;
    invertFullPage?: boolean;
  }
): Promise<ChordPosition[]> {
  if (!canAttemptVision(options)) return [];

  const invert = Boolean(options.invertFullPage);
  let layout: VisionSheetLayout = 'full-sheet';
  let image = await prepareSheetImageForVision(
    invert ? await sheetToDataUrl(imageSource, true) : imageSource
  );

  if (options.systems.length > 0) {
    const montage = await buildChordBandMontage(
      imageSource,
      systemsToMontageSlices(options.systems, options.raster),
      options.raster.sourceWidth,
      options.raster.sourceHeight,
      invert
    );
    if (!montage) return [];
    layout = 'staff-bands';
    image = montage.dataUrl;
    const parsed = await requestVisionChords(image, layout, options);
    return mapMontageChordsToPage(parsed, montage);
  }

  const parsed = await requestVisionChords(image, layout, options);
  return alignDetectedChords(image, parsed);
}

/**
 * Main Vision AI coordinator function
 * Tries serverless/local proxy `/api/detect-chords` first (server holds OPENROUTER_API_KEY),
 * then a direct free OpenRouter call if the user pasted a key,
 * then optional OpenAI/Gemini if those providers were chosen explicitly.
 */
export async function scanSheetWithVisionAI(
  imageDataUrl: string,
  options?: VisionAiOptions
): Promise<ChordPosition[]> {
  const prepared = await prepareSheetImageForVision(imageDataUrl);
  const detected = await requestVisionChords(prepared, 'full-sheet', options);
  if (detected.length === 0 && !options?.apiKey && typeof window === 'undefined') {
    throw new Error('No Vision AI key or serverless endpoint configured');
  }
  return alignDetectedChords(prepared, detected);
}
