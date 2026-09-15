import {
  completeOpenRouterVision,
  extractJsonObject,
  OPENROUTER_PREFERRED_VL_MODEL,
  isFreeOpenRouterModel,
} from '../src/services/openRouterClient';
import { resolveVisionPrompts, type VisionSheetLayout } from '../src/services/visionPrompt';

interface ApiRequest {
  method?: string;
  body?: {
    image?: string;
    provider?: string;
    apiKey?: string;
    model?: string;
    layout?: VisionSheetLayout;
  };
}

interface ApiResponse {
  status: (code: number) => {
    json: (body: any) => void;
  };
}

function resolveOpenRouterKey(req: ApiRequest): string | undefined {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) return envKey;
  const clientKey = req.body?.apiKey;
  if (clientKey && clientKey.startsWith('sk-or-')) return clientKey;
  return undefined;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, provider = 'openrouter', model, layout } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: 'Missing image parameter' });
  }

  if (provider !== 'openrouter' && provider !== 'openai' && provider !== 'gemini') {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const openRouterKey = resolveOpenRouterKey(req);
  if (!openRouterKey) {
    return res.status(400).json({
      error: 'OPENROUTER_API_KEY is not configured on the server',
    });
  }

  const requestedModel = typeof model === 'string' && isFreeOpenRouterModel(model)
    ? model
    : OPENROUTER_PREFERRED_VL_MODEL;
  const visionLayout: VisionSheetLayout = layout === 'staff-bands' ? 'staff-bands' : 'full-sheet';
  const prompts = resolveVisionPrompts(visionLayout);

  try {
    const { raw, model: usedModel } = await completeOpenRouterVision({
      image,
      apiKey: openRouterKey,
      systemPrompt: prompts.system,
      userText: prompts.user,
      preferredModel: requestedModel,
    });

    const parsed = extractJsonObject(raw) || { chords: [] };
    return res.status(200).json({
      ...parsed,
      model: usedModel,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'OpenRouter free-model scan failed' });
  }
}
