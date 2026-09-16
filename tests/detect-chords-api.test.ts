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

  it('does not import anything (extra api/ files crash Vercel boot with FUNCTION_INVOCATION_FAILED)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../api/detect-chords.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/from ['"]\.\.\/src\//);
    expect(source).toContain('one-glyph');
    expect(source).toContain('ink cluster');
    expect(source).toContain('time signature');
    expect(source).toContain('rehearsal');
    expect(source).toContain('Nashville');
  });
});
