/**
 * OpenRouter client for free-tier Vision chord detection.
 * Uses only the free models router (`openrouter/free`) plus `:free` fallbacks.
 * Never import paid model slugs here.
 */

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Free Models Router: picks a free model that supports the requested features (images, etc.). */
export const OPENROUTER_FREE_MODEL = 'openrouter/free';

/** Dedicated free vision-language model; more reliable for chord glyphs than a random router pick. */
export const OPENROUTER_PREFERRED_VL_MODEL = 'inclusionai/ling-3.0-flash-vl:free';

/** Explicit free vision fallbacks if the preferred VL model is unavailable. All slugs must stay `:free`. */
export const OPENROUTER_FREE_FALLBACK_MODELS = [
  OPENROUTER_PREFERRED_VL_MODEL,
] as const;

export const OPENROUTER_FREE_MODEL_CANDIDATES = [
  OPENROUTER_PREFERRED_VL_MODEL,
  OPENROUTER_FREE_MODEL,
] as const;

export function isFreeOpenRouterModel(model: string): boolean {
  const trimmed = model.trim();
  return trimmed === OPENROUTER_FREE_MODEL || trimmed.endsWith(':free');
}

export function assertFreeOpenRouterModel(model: string): string {
  if (!isFreeOpenRouterModel(model)) {
    throw new Error(`Refusing paid OpenRouter model "${model}". Only openrouter/free and :free models are allowed.`);
  }
  return model;
}

export function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://github.com/gunther520/MusicSheetViewer',
    'X-Title': 'SheetTransposer',
  };
}

export function toOpenRouterImageUrl(image: string): string {
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) {
    return image;
  }
  return `data:image/jpeg;base64,${image}`;
}

export function buildOpenRouterVisionBody(
  imageUrl: string,
  systemPrompt: string,
  model: string,
  userText = 'Detect all musical chord symbols printed above the staves on this sheet.'
): Record<string, unknown> {
  assertFreeOpenRouterModel(model);
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 8000,
  };
}

export function extractOpenRouterMessageContent(data: unknown): string {
  const root = data as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning?: unknown;
        reasoning_content?: unknown;
      };
    }>;
  };
  const message = root?.choices?.[0]?.message || {};
  const content = message.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text || '');
        }
        return '';
      })
      .join('\n')
      .trim();
    if (joined) return joined;
  }

  for (const extra of [message.reasoning, message.reasoning_content]) {
    if (typeof extra === 'string' && extra.trim()) return extra;
  }

  return '';
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
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

export function hasNonEmptyChordsPayload(raw: string): boolean {
  const parsed = extractJsonObject(raw);
  if (!parsed) return false;
  const list = Array.isArray(parsed.chords)
    ? parsed.chords
    : Array.isArray(parsed)
      ? parsed
      : [];
  return list.some((item: unknown) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (item && typeof item === 'object' && 'chord' in item) {
      return String((item as { chord?: unknown }).chord || '').trim().length > 0;
    }
    return false;
  });
}

export async function completeOpenRouterVision(options: {
  image: string;
  apiKey: string;
  systemPrompt: string;
  preferredModel?: string;
  userText?: string;
}): Promise<{ raw: string; model: string }> {
  const imageUrl = toOpenRouterImageUrl(options.image);
  const preferred = options.preferredModel
    ? assertFreeOpenRouterModel(options.preferredModel)
    : OPENROUTER_PREFERRED_VL_MODEL;

  const models = [
    preferred,
    ...OPENROUTER_FREE_MODEL_CANDIDATES.filter((model) => model !== preferred),
  ];

  let lastError = 'OpenRouter free-model request failed';
  let emptyJsonModel: string | undefined;

  for (const model of models) {
    const attempts = model === preferred ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: buildOpenRouterHeaders(options.apiKey),
        body: JSON.stringify(buildOpenRouterVisionBody(
          imageUrl,
          options.systemPrompt,
          model,
          options.userText
        )),
      });

      if (!response.ok) {
        lastError = await response.text();
        if ([400, 402, 404, 408, 429, 502, 503].includes(response.status)) {
          if (response.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, 1600 * (attempt + 1)));
          }
          continue;
        }
        throw new Error(`OpenRouter error (${response.status}): ${lastError}`);
      }

      const data = await response.json();
      const raw = extractOpenRouterMessageContent(data);
      if (hasNonEmptyChordsPayload(raw)) {
        const usedModel = typeof data?.model === 'string' && data.model
          ? data.model
          : model;
        return { raw, model: usedModel };
      }
      if (extractJsonObject(raw)) {
        emptyJsonModel = typeof data?.model === 'string' && data.model ? data.model : model;
        // Empty JSON can be a true no-chord page; do not keep retrying the same model.
        break;
      }
      lastError = `Free model ${model} returned no chord JSON`;
    }
  }

  if (emptyJsonModel) {
    return { raw: '{"chords":[]}', model: emptyJsonModel };
  }

  throw new Error(lastError);
}
