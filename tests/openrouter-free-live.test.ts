import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { completeOpenRouterVision, isFreeOpenRouterModel } from '../src/services/openRouterClient';
import { parseVisionChordsResponse } from '../src/services/visionAiService';
import { VISION_DETECTION_SYSTEM_PROMPT } from '../src/services/visionPrompt';
import { isValidChord } from '../src/utils/chordUtils';

function loadLocalOpenRouterKey(): string | undefined {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^OPENROUTER_API_KEY=(.*)$/m);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // no local env file in CI
  }
  return undefined;
}

const apiKey = loadLocalOpenRouterKey();

describe.skipIf(!apiKey)('OpenRouter free live chord detection', () => {
  it('detects printed chords on a Wikimedia lead sheet via openrouter/free', async () => {
    const file = path.resolve(__dirname, '../testing/random_sheets/LeadsheetNotation.png');
    const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    const { raw, model } = await completeOpenRouterVision({
      image: dataUrl,
      apiKey: apiKey as string,
      systemPrompt: VISION_DETECTION_SYSTEM_PROMPT,
    });

    expect(isFreeOpenRouterModel(model) || model.endsWith(':free') || model === 'openrouter/free').toBe(true);
    const chords = parseVisionChordsResponse(raw);
    const names = chords.map((chord) => chord.originalText);
    expect(names).toContain('C');
    expect(names).toContain('F');
    chords.forEach((chord) => {
      expect(isValidChord(chord.originalText)).toBe(true);
    });
  }, 120000);
});
