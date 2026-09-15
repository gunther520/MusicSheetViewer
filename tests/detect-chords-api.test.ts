import { describe, it, expect } from 'vitest';
import handler from '../api/detect-chords';

describe('detect-chords API handler', () => {
  it('boots and rejects non-POST requests without crashing', async () => {
    const response = await handler(new Request('https://example.com/api/detect-chords', { method: 'GET' })) as Response;
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.error).toMatch(/not allowed/i);
  });

  it('returns 400 when the image is missing', async () => {
    const response = await handler(new Request('https://example.com/api/detect-chords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openrouter' }),
    })) as Response;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/image/i);
  });

  it('returns 400 when no OpenRouter key is configured', async () => {
    const previous = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const response = await handler(new Request('https://example.com/api/detect-chords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/png;base64,aaa' }),
      })) as Response;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/OPENROUTER_API_KEY/);
    } finally {
      if (previous) process.env.OPENROUTER_API_KEY = previous;
    }
  });
});
