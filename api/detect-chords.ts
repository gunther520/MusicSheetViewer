/**
 * Vercel serverless function for free OpenRouter Vision chord detection.
 * ZERO imports: extra files under api/ are treated as extra functions and crash boot.
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

const FULL_SHEET_PROMPT = `You are an expert engraver-level reader of printed lead sheets and chord charts.
Transcribe chord SYMBOLS actually printed in THIS image. Do not invent or complete a progression.

HOW TO READ: Root A-G, optional #/b, optional quality, optional /bass.
Slash: LEFT = chord, RIGHT = bass. C/E, D/F#, Bb/C, G/F, G/B, Gm7/C. Never drop or swap the slash.
Jazz: △/∆/Δ = maj7 (write Cmaj7). ø = m7b5. Superscript 11 is 11 not 7. Eb is not Bb. Ab is not Db.
A small b after B is Bb, not B7. If flat vs 7 is unclear, prefer this page's key signature / prevailing accidentals.
One ink cluster = one object. Do not merge neighbors or split Cmaj7. Repeats are separate objects.
Guitar diagrams: the chord is the letter ABOVE the grid, not fret digits.
Rehearsal boxes on the staff are not chords. Roman numerals / Nashville 1-4-5 are analysis, not A-G glyphs.
Do not invent missing chords from the key.
Include EVERY occurrence. Repeated C C C is three objects. Simple C F G Am still count.

EXCLUDE lyrics, titles like "C Major", verse/chorus/intro, bar numbers, SATB, noteheads, fingerings, N.C., time signatures, capo, percent-repeats, clefs, key-signature accidentals on the staff, lone | or /.

xPercent/yPercent = glyph CENTER on THIS image (chords sit just above the staff, not on noteheads). Walk left-to-right, then next staff down.
Zero printed symbols → {"chords":[]}.

Return ONLY JSON:
{"chords":[{"chord":"C/E","xPercent":32.0,"yPercent":22.0,"widthPercent":6,"heightPercent":3}]}`;

const BAND_PROMPT = `You are an expert lead-sheet chord reader.
THIS image is a VERTICAL STACK of chord-symbol bands above each staff. Gray left column numbers strips 1, 2, 3 from TOP to BOTTOM.

Read each strip left-to-right. One object per glyph. strip = left-column number (required).
Slash: LEFT chord, RIGHT bass (C/E, D/F#, Bb/C). △ = maj7. 11 is not 7. Repeats are separate objects. Include C F G.
One ink cluster = one object. Do not merge neighbors or split Cmaj7.
Ambiguous accidentals follow this page's key signature. Ignore time signatures, capo, N.C., fret numbers, noteheads, rehearsal boxes, Roman/Nashville analysis, clefs.
Blank strip → nothing. No symbols at all → {"chords":[]}. Do not invent.

xPercent is 0-100 of the FULL stacked image (including the number gutter).

Return ONLY JSON:
{"chords":[{"chord":"C/E","strip":1,"xPercent":32.0,"yPercent":12.0,"widthPercent":6,"heightPercent":3}]}`;

const ONE_GLYPH_PROMPT = `You are reading ONE cropped printed chord symbol from a lead-sheet chord band.
Transcribe the glyph if it is actually a chord (including slash chords like C/E, D/F#, Bb/C).
Read the root letter first, then #/b, then quality, then /bass. A small b after B is Bb, not B7.
Squeeze obvious spacing: "B b" is Bb, "C / E" is C/E, "C maj7" is Cmaj7.
If the crop is specks, lyrics, a barline, a time signature, capo, rehearsal box, fret digits, or empty, return {"chords":[]}.
Do not invent a chord from a key or a I–IV–V progression.

Return ONLY JSON:
{"chords":[{"chord":"Bb","xPercent":50,"yPercent":50,"widthPercent":80,"heightPercent":70}]}`;

const FULL_SHEET_USER =
  'Transcribe every printed chord glyph, left-to-right then down the page. Keep slash chords (C/E, D/F#, Bb/C). Repeat identical chords as separate objects. If none, {"chords":[]}.';
const BAND_USER =
  'Each numbered strip is one staff chord band. For every glyph: chord + strip + xPercent. Keep slashes and repeats. Blank strips contribute nothing. If none, {"chords":[]}.';
const ONE_GLYPH_USER =
  'This crop is a single leftover ink blob. Return one printed chord name if visible, else {"chords":[]}.';

type JsonBody = {
  image?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  layout?: string;
  keyHint?: string;
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

function sanitizeKeyHint(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[\r\n]+/g, ' ').trim().slice(0, 400);
  if (!cleaned) return '';
  if (!/^[A-Za-z0-9 #,:'()–—\-./]+$/.test(cleaned)) return '';
  return cleaned;
}

async function completeFreeVision(
  image: string,
  apiKey: string,
  layout: string,
  keyHint?: string
): Promise<{ raw: string; model: string }> {
  const imageUrl = image.startsWith('http') || image.startsWith('data:')
    ? image
    : `data:image/jpeg;base64,${image}`;
  const system = layout === 'staff-bands'
    ? BAND_PROMPT
    : layout === 'one-glyph'
      ? ONE_GLYPH_PROMPT
      : FULL_SHEET_PROMPT;
  const hint = keyHint ? ` ${keyHint}` : '';
  const user = (layout === 'staff-bands'
    ? BAND_USER
    : layout === 'one-glyph'
      ? ONE_GLYPH_USER
      : FULL_SHEET_USER) + hint;

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
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 8000,
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

    const layout = body.layout === 'staff-bands'
      ? 'staff-bands'
      : body.layout === 'one-glyph'
        ? 'one-glyph'
        : 'full-sheet';
    const { raw, model: usedModel } = await completeFreeVision(
      image,
      openRouterKey,
      layout,
      sanitizeKeyHint(body.keyHint)
    );
    const parsed = extractJsonObject(raw) || { chords: [] };
    return jsonResponse(200, { ...parsed, model: usedModel }, res);
  } catch (error: any) {
    return jsonResponse(500, { error: error?.message || 'OpenRouter free-model scan failed' }, res);
  }
}
