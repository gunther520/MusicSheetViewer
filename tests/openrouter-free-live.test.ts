import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { completeOpenRouterVision, isFreeOpenRouterModel } from '../src/services/openRouterClient';
import { parseVisionChordsResponse, systemsToMontageSlices } from '../src/services/visionAiService';
import { resolveVisionPrompts } from '../src/services/visionPrompt';
import { isValidChord } from '../src/utils/chordUtils';
import { rasterizeSheet, buildChordBandMontage } from '../src/services/rasterize';
import { detectStaffSystemsFromGray, systemsWithSymbolInk } from '../src/services/staffGeometry';
import { mapMontageChordsToPage } from '../src/services/mergeChordDetections';
import { scanSheetWithFallback } from '../src/services/ocrService';

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
  it('detects printed chords on a Wikimedia lead sheet via free Vision', async () => {
    const file = path.resolve(__dirname, '../testing/random_sheets/LeadsheetNotation.png');
    const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    const prompts = resolveVisionPrompts('full-sheet');
    const { raw, model } = await completeOpenRouterVision({
      image: dataUrl,
      apiKey: apiKey as string,
      systemPrompt: prompts.system,
      userText: prompts.user,
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

  it('reads stacked staff-band crops on a random online hymn lead sheet', async () => {
    const file = path.resolve(__dirname, '../testing/random_sheets/are_you_washed_1200.png');
    const raster = await rasterizeSheet(file);
    const systems = systemsWithSymbolInk(
      raster.width,
      raster.height,
      raster.gray,
      detectStaffSystemsFromGray(raster.width, raster.height, raster.gray)
    );
    expect(systems.length).toBeGreaterThan(0);
    const montage = await buildChordBandMontage(
      file,
      systemsToMontageSlices(systems, raster),
      raster.sourceWidth,
      raster.sourceHeight
    );
    expect(montage).toBeTruthy();
    const prompts = resolveVisionPrompts('staff-bands');
    const { raw, model } = await completeOpenRouterVision({
      image: montage!.dataUrl,
      apiKey: apiKey as string,
      systemPrompt: prompts.system,
      userText: prompts.user,
    });
    expect(isFreeOpenRouterModel(model) || model.endsWith(':free') || model === 'openrouter/free').toBe(true);
    const mapped = mapMontageChordsToPage(parseVisionChordsResponse(raw), montage!);
    const names = mapped.map((chord) => chord.originalText);
    expect(names.some((name) => ['C', 'F', 'G'].includes(name))).toBe(true);
    mapped.forEach((chord) => {
      expect(isValidChord(chord.originalText)).toBe(true);
      expect(chord.y).toBeGreaterThan(0);
      expect(chord.y).toBeLessThan(100);
    });
  }, 180000);

  it('merges OCR with free Vision on a dark online jazz chart', async () => {
    const file = path.resolve(__dirname, '../testing/random_sheets/lesheets_chords.png');
    const chords = await scanSheetWithFallback(file, {
      apiKey: apiKey as string,
      provider: 'openrouter',
    });
    const names = chords.map((chord) => chord.originalText);
    expect(names).toContain('Dm7');
    expect(names).toContain('Em7');
    chords.forEach((chord) => {
      expect(isValidChord(chord.originalText)).toBe(true);
    });
  }, 180000);
});
