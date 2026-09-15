import { describe, it, expect } from 'vitest';
import {
  assertFreeOpenRouterModel,
  buildOpenRouterVisionBody,
  extractOpenRouterMessageContent,
  isFreeOpenRouterModel,
  OPENROUTER_FREE_MODEL,
  OPENROUTER_FREE_MODEL_CANDIDATES,
} from './openRouterClient';

describe('OpenRouter free-model client', () => {
  it('only allows the free router and :free model slugs', () => {
    expect(OPENROUTER_FREE_MODEL).toBe('openrouter/free');
    expect(isFreeOpenRouterModel('openrouter/free')).toBe(true);
    expect(isFreeOpenRouterModel('inclusionai/ling-3.0-flash-vl:free')).toBe(true);
    expect(isFreeOpenRouterModel('google/gemini-2.5-flash')).toBe(false);
    expect(isFreeOpenRouterModel('openai/gpt-4o-mini')).toBe(false);
    expect(() => assertFreeOpenRouterModel('google/gemini-2.5-flash')).toThrow(/paid OpenRouter model/);
  });

  it('never includes paid model slugs in the candidate list', () => {
    OPENROUTER_FREE_MODEL_CANDIDATES.forEach((model) => {
      expect(isFreeOpenRouterModel(model)).toBe(true);
    });
  });

  it('builds a vision request for openrouter/free without paid JSON-mode flags', () => {
    const body = buildOpenRouterVisionBody(
      'data:image/png;base64,abc',
      'Detect chords',
      'openrouter/free'
    );
    expect(body.model).toBe('openrouter/free');
    expect(body.response_format).toBeUndefined();
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    expect(messages[0].role).toBe('system');
    expect(Array.isArray(messages[1].content)).toBe(true);
  });

  it('extracts message content and reasoning fallbacks', () => {
    expect(extractOpenRouterMessageContent({
      choices: [{ message: { content: '{"chords":[]}' } }],
    })).toBe('{"chords":[]}');

    expect(extractOpenRouterMessageContent({
      choices: [{ message: { content: [{ type: 'text', text: '{"chords":[{"chord":"C"}]}' }] } }],
    })).toContain('C');

    expect(extractOpenRouterMessageContent({
      choices: [{ message: { content: '', reasoning: '{"chords":[{"chord":"Am"}]}' } }],
    })).toContain('Am');
  });
});
