import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { scanSheetForChords, normalizeChordToken } from '../src/services/ocrService';
import { isValidChord } from '../src/utils/chordUtils';

describe('Arbitrary Random Online Sheets Evaluation', () => {
  it('correctly detects chords on a random online lead sheet (Are You Washed in the Blood)', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/are_you_washed_1200.png');
    expect(fs.existsSync(sheetPath)).toBe(true);

    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(6);

    const chordNames = chords.map((c) => c.originalText);
    expect(chordNames).toContain('C');
    expect(chordNames).toContain('F');
    expect(chordNames).toContain('G');

    // All detected chords must be musically valid
    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(100);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(100);
    });
  }, 120000);

  it('correctly detects complex extended & slash chords on Trifle in Pyjamas lead sheet', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/Trifle_In_Pyjamas_lead_sheet.jpg');
    expect(fs.existsSync(sheetPath)).toBe(true);

    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(10);

    const chordNames = chords.map((c) => c.originalText);
    expect(chordNames).toContain('Cm7');
    expect(chordNames).toContain('Gm7/C');
    expect(chordNames).toContain('Abmaj7');
    expect(chordNames).toContain('Gm7');

    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
    });
  }, 120000);

  it('correctly detects chords on online LeadsheetNotation from Wikimedia Commons', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/LeadsheetNotation.png');
    expect(fs.existsSync(sheetPath)).toBe(true);

    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(1);

    const chordNames = chords.map((c) => c.originalText);
    expect(chordNames).toContain('C7');

    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
    });
  }, 120000);

  it('correctly detects jazz extended chords on lesheets chord chart', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/lesheets_chords.png');
    expect(fs.existsSync(sheetPath)).toBe(true);

    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(2);

    const chordNames = chords.map((c) => c.originalText);
    expect(chordNames).toContain('Dm7');
    expect(chordNames).toContain('Em7');

    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
    });
  }, 120000);

  it('correctly detects chords on obsidian_leadsheet lead sheet', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/obsidian_leadsheet.png');
    expect(fs.existsSync(sheetPath)).toBe(true);

    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(10);

    const chordNames = chords.map((c) => c.originalText);
    expect(chordNames).toContain('G7');
    expect(chordNames).toContain('C');
    expect(chordNames).toContain('G');
    expect(chordNames).toContain('Em');
    expect(chordNames).toContain('D');

    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
    });
  }, 120000);

  it('detects printed jazz/hymn chords on Zamboanga Hermosa rather than treating it as chordless', async () => {
    const sheetPath = path.resolve(__dirname, '../testing/random_sheets/zamboanga_hermosa_hymn.jpg');
    expect(fs.existsSync(sheetPath)).toBe(true);
    const chords = await scanSheetForChords(sheetPath);
    expect(chords.length).toBeGreaterThanOrEqual(2);
    chords.forEach((c) => {
      expect(isValidChord(c.originalText)).toBe(true);
    });
  }, 120000);

  it('produces zero false-positive chords on SATB/hymn scores that have no chord symbols', async () => {
    const hymn1 = path.resolve(__dirname, '../testing/random_sheets/power_in_the_blood_chorus.jpg');
    const hymn3 = path.resolve(__dirname, '../testing/random_sheets/amazing_grace-1.png');
    const hymn4 = path.resolve(__dirname, '../testing/random_sheets/what_a_friend.png');

    const chords1 = await scanSheetForChords(hymn1);
    expect(chords1.length).toBe(0);

    const chords3 = await scanSheetForChords(hymn3);
    expect(chords3.length).toBe(0);

    const chords4 = await scanSheetForChords(hymn4);
    expect(chords4.length).toBe(0);
  }, 180000);

  it('rejects English lyric words and does not hallucinate chords inside words', () => {
    const lyricWords = [
      'grace', 'There', 'blood', 'Lamb', 'peace', 'Edgar', 'precious', 'Jones',
      'feed', 'before', 'where', 'life', 'come', 'love', 'great', 'friend',
      'faith', 'hope', 'joy', 'glory', 'praise', 'worship', 'heart', 'soul',
      'am', 'as', 'at', 'be', 'do', 'in', 'me', 'we', 'he', 'so', 'to'
    ];

    lyricWords.forEach((word) => {
      const extracted = normalizeChordToken(word);
      expect(extracted, `Expected word "${word}" to produce 0 chords`).toEqual([]);
    });

    // Valid chords must still be recognized
    expect(normalizeChordToken('C')).toEqual(['C']);
    expect(normalizeChordToken('Am')).toEqual(['Am']);
    expect(normalizeChordToken('Dm7')).toEqual(['Dm7']);
    expect(normalizeChordToken('G/B')).toEqual(['G/B']);
  });
});
