import type { Plugin } from 'vite';
import { completeOpenRouterVision } from '../src/services/openRouterClient';
import { VISION_DETECTION_SYSTEM_PROMPT } from '../src/services/visionPrompt';

function readJsonBody(req: { on: (event: string, cb: (...args: any[]) => void) => void }): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Local `/api/detect-chords` handler so `npm run dev` can use OPENROUTER_API_KEY
 * from `.env.local` without putting the key in the browser bundle.
 */
export function detectChordsDevPlugin(apiKey: string): Plugin {
  const handle = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/detect-chords')) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured' }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const image = body?.image;
      if (!image || typeof image !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing image parameter' }));
        return;
      }

      const { raw } = await completeOpenRouterVision({
        image,
        apiKey,
        systemPrompt: VISION_DETECTION_SYSTEM_PROMPT,
        preferredModel: 'openrouter/free',
      });

      const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(parsed));
    } catch (error: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error?.message || 'OpenRouter free-model scan failed' }));
    }
  };

  return {
    name: 'detect-chords-dev-api',
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}
