import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { scanSheetWithFallback } from '../src/services/ocrService';
import { rasterizeSheet } from '../src/services/rasterize';
import { detectStaffSystemsFromGray, StaffSystem } from '../src/services/staffGeometry';
import { scoreNameSequence, scoreSheetDetections, type SheetScore } from '../src/services/detectionScore';
import { GROUND_TRUTH } from './evaluate-ground-truth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalOpenRouterKey(): string | undefined {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^OPENROUTER_API_KEY=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // CI without a key
  }
  return undefined;
}

interface EvalCase {
  label: string;
  file: string;
  minRecall: number;
  maxExtras: number;
  expectedByStaff?: string[][];
  expectedBag?: string[];
}

const RANDOM_CASES: EvalCase[] = [
  {
    label: 'Are You Washed (online hymn lead sheet)',
    file: path.resolve(__dirname, '../testing/random_sheets/are_you_washed_1200.png'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedByStaff: [
      ['C', 'F'],
      ['C', 'G', 'C'],
      ['F', 'C', 'G', 'C'],
      ['C', 'F', 'C'],
    ],
  },
  {
    label: 'Wikimedia LeadsheetNotation',
    file: path.resolve(__dirname, '../testing/random_sheets/LeadsheetNotation.png'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedBag: ['C', 'C7', 'F'],
  },
  {
    label: 'lesheets jazz diagram',
    file: path.resolve(__dirname, '../testing/random_sheets/lesheets_chords.png'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedBag: ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7'],
  },
  {
    label: 'Obsidian lyric chart',
    file: path.resolve(__dirname, '../testing/random_sheets/obsidian_leadsheet.png'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedBag: [
      'G', 'G7', 'C', 'G', 'D',
      'G7', 'C', 'G',
      'G', 'Em', 'D',
      'G', 'G7', 'C', 'G',
      'Em', 'D', 'G',
    ],
  },
  {
    label: 'Trifle In Pyjamas',
    file: path.resolve(__dirname, '../testing/random_sheets/Trifle_In_Pyjamas_lead_sheet.jpg'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedByStaff: [
      ['Cm11', 'Cm11', 'Cm11', 'C11', 'Cm7', 'Gm7/C'],
      ['Fm7', 'Fm11', 'Cm11', 'Cm11', 'Cm7', 'Gm7/C'],
      ['Abmaj7', 'Gm7', 'F#7', 'Fm9', 'Bb', 'Bmaj7#5'],
      ['Cm11', 'Cm11', 'Cm11', 'C11', 'Cm7', 'Gm7/C'],
      ['Fm7', 'Fm11', 'Cm11', 'Cm7', 'Cm9'],
      ['Abmaj7', 'Gm7', 'F#7', 'Fm9', 'Bb', 'Bmaj7#5'],
      ['Cm11'],
    ],
  },
  {
    label: 'Zamboanga Hermosa',
    file: path.resolve(__dirname, '../testing/random_sheets/zamboanga_hermosa_hymn.jpg'),
    minRecall: 0.85,
    maxExtras: 5,
    expectedByStaff: [
      ['Fm7', 'Bb7', 'Eb', 'Bb7'],
      ['Eb', 'Bb7'],
      ['Bb7', 'Eb'],
      ['Bb7', 'Eb'],
      ['Ab', 'Bb7', 'Eb'],
      ['Cm', 'Bb7'],
      ['Eb', 'Bb7'],
      ['Bb7', 'Eb'],
      ['Eb'],
    ],
  },
  {
    label: 'SATB Amazing Grace (no chord symbols)',
    file: path.resolve(__dirname, '../testing/random_sheets/amazing_grace-1.png'),
    minRecall: 1,
    maxExtras: 5,
    expectedBag: [],
  },
];

function alignExpectedToChordBands(
  staves: Array<{ yCenter: number; expected: string[] }>,
  systems: StaffSystem[],
  sourceHeight: number,
  rasterHeight: number
): Array<{ yCenter: number; expected: string[] }> {
  if (systems.length === 0) return staves;
  return staves.map((staff) => {
    const yRaster = (staff.yCenter / sourceHeight) * rasterHeight;
    let best = systems[0];
    let bestDist = Infinity;
    systems.forEach((system) => {
      const mid = (system.staffTop + system.staffBottom) / 2;
      const dist = Math.abs(mid - yRaster);
      if (dist < bestDist) {
        bestDist = dist;
        best = system;
      }
    });
    return {
      yCenter: (best.chordBandTop + best.chordBandBottom) / 2,
      expected: staff.expected,
    };
  });
}

function printScore(label: string, score: SheetScore, model?: string, extraNote?: string) {
  const recallPct = (score.recall * 100).toFixed(1);
  const okRecall = score.recall >= 0.85 || score.expected === 0;
  const okExtras = score.extras <= 5;
  const mark = okRecall && okExtras ? 'PASS' : 'FAIL';
  console.log(`\n[${mark}] ${label}`);
  if (model) console.log(`  model: ${model}`);
  console.log(`  recall ${recallPct}%  (${score.hits}/${score.expected})  extras ${score.extras}`);
  if (score.missed.length) console.log(`  missed: ${score.missed.slice(0, 16).join(', ')}${score.missed.length > 16 ? '…' : ''}`);
  if (score.extraNames.length) console.log(`  extras: ${score.extraNames.slice(0, 16).join(', ')}${score.extraNames.length > 16 ? '…' : ''}`);
  if (extraNote) console.log(`  ${extraNote}`);
}

async function scoreCase(testCase: EvalCase): Promise<{ score: SheetScore; model?: string; error?: string }> {
  const result = await scanSheetWithFallback(testCase.file, {
    apiKey: loadLocalOpenRouterKey(),
    provider: 'openrouter',
  });

  if (testCase.expectedByStaff && testCase.expectedByStaff.length > 0) {
    const raster = await rasterizeSheet(testCase.file);
    const systems = detectStaffSystemsFromGray(raster.width, raster.height, raster.gray);
    if (systems.length === testCase.expectedByStaff.length) {
      const staves = systems.map((system, index) => ({
        yCenter: (system.chordBandTop + system.chordBandBottom) / 2,
        expected: testCase.expectedByStaff![index],
      }));
      return {
        score: scoreSheetDetections(staves, result.chords, raster.height, 6.5),
        model: result.visionModel,
        error: result.visionError,
      };
    }
    const bag = scoreNameSequence(
      testCase.expectedByStaff.flat(),
      result.chords.map((chord) => chord.originalText)
    );
    return {
      score: {
        expected: bag.hits + bag.missed.length,
        hits: bag.hits,
        extras: bag.extras.length,
        recall: (bag.hits + bag.missed.length) ? bag.hits / (bag.hits + bag.missed.length) : 1,
        missed: bag.missed,
        extraNames: bag.extras,
      },
      model: result.visionModel,
      error: result.visionError,
    };
  }

  const expectedBag = testCase.expectedBag || [];
  if (expectedBag.length === 0) {
    return {
      score: {
        expected: 0,
        hits: 0,
        extras: result.chords.length,
        recall: 1,
        missed: [],
        extraNames: result.chords.map((chord) => chord.originalText),
      },
      model: result.visionModel,
      error: result.visionError,
    };
  }

  const bag = scoreNameSequence(expectedBag, result.chords.map((chord) => chord.originalText));
  return {
    score: {
      expected: expectedBag.length,
      hits: bag.hits,
      extras: bag.extras.length,
      recall: expectedBag.length ? bag.hits / expectedBag.length : 1,
      missed: bag.missed,
      extraNames: bag.extras,
    },
    model: result.visionModel,
    error: result.visionError,
  };
}

export async function runHybridEvaluation(): Promise<{ passed: boolean }> {
  const apiKey = loadLocalOpenRouterKey();
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY missing; cannot run hybrid evaluation');
    return { passed: false };
  }

  let passed = true;

  for (const sheet of GROUND_TRUTH) {
    const file = path.resolve(__dirname, '../testing', sheet.filename);
    console.log(`\nScanning benchmark sheet ${sheet.num}…`);
    const result = await scanSheetWithFallback(file, { apiKey, provider: 'openrouter' });
    const raster = await rasterizeSheet(file);
    const systems = detectStaffSystemsFromGray(raster.width, raster.height, raster.gray);
    const aligned = alignExpectedToChordBands(sheet.staves, systems, sheet.height, raster.height);
    const score = scoreSheetDetections(aligned, result.chords, raster.height, 4.8);
    const bag = scoreNameSequence(
      sheet.staves.flatMap((staff) => staff.expected),
      result.chords.map((chord) => chord.originalText)
    );
    printScore(
      `benchmark ${sheet.num}`,
      score,
      result.visionModel,
      `${result.visionError || ''} bag ${((bag.hits / Math.max(1, bag.hits + bag.missed.length)) * 100).toFixed(1)}% extras ${bag.extras.length} detected ${result.chords.length}`.trim()
    );
    if (score.recall < 0.85 || score.extras > 5) passed = false;
  }

  for (const testCase of RANDOM_CASES) {
    console.log(`\nScanning ${testCase.label}…`);
    const { score, model, error } = await scoreCase(testCase);
    printScore(testCase.label, score, model, error);
    if (score.recall < testCase.minRecall || score.extras > testCase.maxExtras) passed = false;
  }

  console.log(`\n======== hybrid eval ${passed ? 'PASSED' : 'FAILED'} ========`);
  return { passed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runHybridEvaluation()
    .then((result) => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
