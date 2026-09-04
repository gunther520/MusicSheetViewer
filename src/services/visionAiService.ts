import { ChordPosition, isValidChord, normalizeChordToken } from './ocrService';

export interface VisionAiOptions {
  provider?: 'openai' | 'gemini' | 'anthropic';
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

export const VISION_DETECTION_SYSTEM_PROMPT = `You are an expert music notation and sheet music analysis AI.
Your task is to detect ALL musical chords printed above the staves on this sheet music image.

Instructions:
1. Examine each musical staff from top to bottom, left to right.
2. Identify all chord symbols written ABOVE the staff lines (such as C, G, Am, F, C/E, D/F#, Bb, Bb/C, Gsus4, Dm7, etc.).
3. Distinguish chords from lyrics, section headers (Intro, Verse, Chorus, Bridge, Fine, etc.), tempo markings, rehearsal numbers, solfege, and note heads.
4. For every chord detected:
   - "chord": Clean, normalized chord symbol (e.g. "C", "Am", "C/E", "D/F#", "Bb", "Bb/C", "Gsus4").
   - "xPercent": Horizontal position of the chord center as a percentage (0.0 to 100.0) across the image width.
   - "yPercent": Vertical baseline position of the chord as a percentage (0.0 to 100.0) down the image height.
   - "widthPercent": Approximate width of the chord symbol text box as percentage (e.g. 3.0 to 8.0).
   - "heightPercent": Approximate height of the chord symbol text box as percentage (e.g. 2.0 to 4.0).
5. Output STRICT JSON only conforming to the schema:
{
  "chords": [
    {
      "chord": "string",
      "xPercent": number,
      "yPercent": number,
      "widthPercent": number,
      "heightPercent": number
    }
  ]
}
Do NOT include markdown fences, explanations, or any extra text. Return ONLY the JSON object.`;

/**
 * Validates and converts raw vision AI chord entries into standard ChordPosition objects
 */
export function parseVisionChordsResponse(
  rawJson: any
): ChordPosition[] {
  let parsed: any = rawJson;
  if (typeof rawJson === 'string') {
    try {
      const cleanJson = rawJson.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Failed to parse Vision AI JSON output:', e);
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
    const cleanNames = normalizeChordToken(item.chord);
    const chordName = cleanNames[0] || item.chord.trim();
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

/**
 * Main Vision AI coordinator function
 * Tries serverless proxy endpoint /api/detect-chords if available,
 * or direct provider client call if user provided API key,
 * or returns null so caller falls back to local high-precision engine.
 */
export async function scanSheetWithVisionAI(
  imageDataUrl: string,
  options?: VisionAiOptions
): Promise<ChordPosition[]> {
  // 1. If custom API endpoint is provided or default /api/detect-chords exists
  const endpoint = options?.apiEndpoint || '/api/detect-chords';
  try {
    const proxyResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageDataUrl,
        provider: options?.provider || 'openai',
        apiKey: options?.apiKey,
      }),
    });

    if (proxyResponse.ok) {
      const result = await proxyResponse.json();
      if (Array.isArray(result.chords) && result.chords.length > 0) {
        return parseVisionChordsResponse(result);
      }
    }
  } catch {
    // Serverless proxy not deployed or unreachable in purely static mode
  }

  // 2. Direct client-side API call if user entered API key
  if (options?.apiKey) {
    if (options.provider === 'gemini') {
      return await detectChordsWithGemini(imageDataUrl, options.apiKey);
    }
    // Default to OpenAI
    return await detectChordsWithOpenAI(imageDataUrl, options.apiKey);
  }

  throw new Error('No Vision AI key or serverless endpoint configured');
}
