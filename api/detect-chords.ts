/**
 * Vercel serverless function for free OpenRouter Vision chord detection.
 * Self-contained so the function can boot without bundling the Vite app graph.
 * Supports both Web Request handlers and Node (req, res) runtimes.
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODELS = [
  'inclusionai/ling-3.0-flash-vl:free',
  'openrouter/free',
] as const;

const FULL_SHEET_PROMPT = `You are an expert music notation and lead-sheet reader.
Detect EVERY printed chord symbol in this image. Do not invent chords that are not printed.
Return ONLY JSON: {"chords":[{"chord":"string","xPercent":number,"yPercent":number,"widthPercent":number,"heightPercent":number}]}
If there are no printed chord symbols, return {"chords":[]}.`;

const BAND_PROMPT = `You are an expert lead-sheet chord reader.
This image is a VERTICAL STACK of cropped strips from the chord-symbol band above each staff.
Return ONLY JSON: {"chords":[{"chord":"string","xPercent":number,"yPercent":number,"widthPercent":number,"heightPercent":number}]}
If a strip has no chord symbols, contribute nothing. If none, return {"chords":[]}.`;

type JsonBody = {
  image?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  layout?: string;
};

function jsonResponse(status: number, body: unknown, nodeRes?: { status: (code: number) => { json: (value: unknown) => unknown } }) {
  if (nodeRes && typeof nodeRes.status === 'function') {
    return nodeRes.status(status).json(body);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice = firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;
  try {
    const parsed = JSON.parse(jsonSlice);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function hasChords(raw: string): boolean {
  const parsed = extractJsonObject(raw);
  if (!parsed) return false;
  const list = Array.isArray(parsed.chords) ? parsed.chords : [];
  return list.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return String((item as { chord?: unknown }).chord || '').trim().length > 0;
  });
}

function extractMessage(data: any): string {
  const message = data?.choices?.[0]?.message || {};
  if (typeof message.content === 'string' && message.content.trim()) return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part: any) => (typeof part === 'string' ? part : part?.text || '')).join('\n').trim();
  }
  if (typeof message.reasoning === 'string' && message.reasoning.trim()) return message.reasoning;
  return '';
}

async function completeFreeVision(image: string, apiKey: string, layout: string): Promise<{ raw: string; model: string }> {
  const imageUrl = image.startsWith('http') || image.startsWith('data:')
    ? image
    : `data:image/jpeg;base64,${image}`;
  const system = layout === 'staff-bands' ? BAND_PROMPT : FULL_SHEET_PROMPT;
  const user = layout === 'staff-bands'
    ? 'These stacked strips are chord-symbol bands. List every printed chord. If none, return {"chords":[]}.'
    : 'Detect every printed chord symbol on this sheet. If none, return {"chords":[]}.';

  let lastError = 'OpenRouter free-model request failed';
  let emptyModel: string | undefined;

  for (const model of FREE_MODELS) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/gunther520/MusicSheetViewer',
        'X-Title': 'SheetTransposer',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      lastError = await response.text();
      if ([400, 402, 404, 408, 429, 502, 503].includes(response.status)) continue;
      throw new Error(`OpenRouter error (${response.status}): ${lastError}`);
    }

    const data = await response.json();
    const raw = extractMessage(data);
    const usedModel = typeof data?.model === 'string' && data.model ? data.model : model;
    if (hasChords(raw)) return { raw, model: usedModel };
    if (extractJsonObject(raw)) emptyModel = usedModel;
    lastError = `Free model ${model} returned no chord JSON`;
  }

  if (emptyModel) return { raw: '{"chords":[]}', model: emptyModel };
  throw new Error(lastError);
}

async function readBody(req: any): Promise<JsonBody> {
  if (req.body && typeof req.body === 'object' && typeof req.body.image === 'string') {
    return req.body as JsonBody;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  if (typeof req.json === 'function') {
    return await req.json();
  }
  return {};
}

function resolveKey(body: JsonBody): string | undefined {
  const envKey = typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined;
  if (envKey) return envKey;
  if (body.apiKey && body.apiKey.startsWith('sk-or-')) return body.apiKey;
  return undefined;
}

export default async function handler(req: any, res?: any) {
  try {
    const method = req.method || 'GET';
    if (method === 'OPTIONS') {
      if (res?.status) return res.status(204).end();
      return new Response(null, { status: 204 });
    }
    if (method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' }, res);
    }

    const body = await readBody(req);
    const image = body.image;
    if (!image || typeof image !== 'string') {
      return jsonResponse(400, { error: 'Missing image parameter' }, res);
    }

    const provider = body.provider || 'openrouter';
    if (provider !== 'openrouter') {
      return jsonResponse(400, { error: 'Unsupported provider' }, res);
    }

    const openRouterKey = resolveKey(body);
    if (!openRouterKey) {
      return jsonResponse(400, {
        error: 'OPENROUTER_API_KEY is not configured on the server',
      }, res);
    }

    const { raw, model: usedModel } = await completeFreeVision(
      image,
      openRouterKey,
      body.layout === 'staff-bands' ? 'staff-bands' : 'full-sheet'
    );
    const parsed = extractJsonObject(raw) || { chords: [] };
    return jsonResponse(200, { ...parsed, model: usedModel }, res);
  } catch (error: any) {
    return jsonResponse(500, { error: error?.message || 'OpenRouter free-model scan failed' }, res);
  }
}
