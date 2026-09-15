import { ChordPosition, notePitchClass, parseChord } from '../utils/chordUtils';

export type KeyMode = 'major' | 'minor';
export type KeySource = 'printed-label' | 'chord-histogram';

export interface SongKey {
  tonic: string;
  mode: KeyMode;
  name: string;
  /** Positive = sharps in the signature, negative = flats. */
  fifths: number;
  signatureAccidentals: string[];
  scaleSpellings: string[];
  confidence: number;
  source: KeySource;
}

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const SHARP_SIGNATURE = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
const FLAT_SIGNATURE = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];

const MAJOR_SCALES: Record<string, string[]> = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
  'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
  'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
  F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
  Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
  Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
  Ab: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
  Db: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
  Gb: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
  Cb: ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
};

const MINOR_SCALES: Record<string, string[]> = {
  A: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  E: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  B: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
  'F#': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
  'C#': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
  'G#': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
  'D#': ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
  'A#': ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'],
  D: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
  G: ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
  C: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  F: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
  Bb: ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'],
  Eb: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'],
  Ab: ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb'],
};

const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};

const MINOR_FIFTHS: Record<string, number> = {
  A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7,
  D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7,
};

const CANDIDATE_KEYS: Array<{ tonic: string; mode: KeyMode }> = [
  ...Object.keys(MAJOR_SCALES).map((tonic) => ({ tonic, mode: 'major' as const })),
  ...Object.keys(MINOR_SCALES).map((tonic) => ({ tonic, mode: 'minor' as const })),
];

function formatKeyName(tonic: string, mode: KeyMode): string {
  return `${tonic} ${mode}`;
}

function signatureAccidentalsFor(fifths: number): string[] {
  if (fifths > 0) return SHARP_SIGNATURE.slice(0, fifths);
  if (fifths < 0) return FLAT_SIGNATURE.slice(0, -fifths);
  return [];
}

export function buildSongKey(
  tonic: string,
  mode: KeyMode,
  confidence: number,
  source: KeySource
): SongKey | null {
  const scaleSpellings = mode === 'major' ? MAJOR_SCALES[tonic] : MINOR_SCALES[tonic];
  const fifths = mode === 'major' ? MAJOR_FIFTHS[tonic] : MINOR_FIFTHS[tonic];
  if (!scaleSpellings || fifths === undefined) return null;
  return {
    tonic,
    mode,
    name: formatKeyName(tonic, mode),
    fifths,
    signatureAccidentals: signatureAccidentalsFor(fifths),
    scaleSpellings,
    confidence: Math.max(0, Math.min(1, confidence)),
    source,
  };
}

function normalizeTonic(raw: string): string {
  const cleaned = raw.replace(/♯/g, '#').replace(/♭/g, 'b').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function parseMode(raw?: string): KeyMode | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === 'minor' || lower === 'min' || lower === 'm') return 'minor';
  if (lower === 'major' || lower === 'maj') return 'major';
  return undefined;
}

/**
 * Read a printed heading such as "Key: F", "in Bb major", "D Minor".
 * Requires a key/tonality word so a lone chord letter is never treated as the key.
 */
export function parsePrintedKeyLabel(text: string): SongKey | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return null;

  const keyOf = raw.match(
    /\b(?:key\s*(?:of|:)?|tonality\s*(?:of|:)?)\s*([A-G](?:#|b|♯|♭)?)(?:\s*(major|minor|maj|min)|\s*(m))?\b/i
  );
  if (keyOf) {
    const tonic = normalizeTonic(keyOf[1]);
    const mode = parseMode(keyOf[2] || keyOf[3]) || 'major';
    if ((mode === 'major' ? MAJOR_SCALES : MINOR_SCALES)[tonic]) {
      return buildSongKey(tonic, mode, 0.92, 'printed-label');
    }
  }

  const named = raw.match(/\b([A-G](?:#|b|♯|♭)?)\s+(Major|Minor)\b/);
  if (named) {
    const tonic = normalizeTonic(named[1]);
    const mode = parseMode(named[2]);
    if (mode && (mode === 'major' ? MAJOR_SCALES : MINOR_SCALES)[tonic]) {
      return buildSongKey(tonic, mode, 0.88, 'printed-label');
    }
  }

  return null;
}

export function extractPrintedKeyLabels(
  tokens: Array<{ text: string; y0?: number }>,
  pageHeight = 1000
): string[] {
  const headerCutoff = pageHeight * 0.28;
  const texts = tokens
    .filter((token) => token.text && token.text.trim())
    .filter((token) => token.y0 === undefined || token.y0 <= headerCutoff)
    .map((token) => token.text.trim());

  const found: string[] = [];
  const consider = (snippet: string) => {
    const key = parsePrintedKeyLabel(snippet);
    if (key) found.push(key.name);
  };

  texts.forEach((text) => consider(text));
  for (let i = 0; i < texts.length; i++) {
    consider(texts.slice(i, i + 5).join(' '));
  }

  return Array.from(new Set(found));
}

function qualityClass(quality: string): 'major' | 'minor' | 'dom' | 'dim' | 'aug' | 'sus' | 'other' {
  const q = quality.toLowerCase();
  if (q.includes('sus')) return 'sus';
  if (q === 'm7b5' || q === 'min7b5' || q === 'dim' || q === 'dim7' || q === 'o') return 'dim';
  if (q === 'aug' || q === '+') return 'aug';
  if (q === '7' || q === '9' || q === '11' || q === '13' || /^7/.test(q)) return 'dom';
  if (
    q === 'm' || q === 'min' || q === '-' || q === 'm6' || q === 'm7' || q === 'm9'
    || q === 'm11' || q === 'm13' || q === 'min7' || (q.startsWith('min') && !q.startsWith('maj'))
  ) {
    return 'minor';
  }
  if (q === '' || q.startsWith('maj') || q === '6' || q.startsWith('add') || q === '5') return 'major';
  return 'other';
}

function expectedDegreeClass(rel: number, mode: KeyMode): Array<'major' | 'minor' | 'dom' | 'dim' | 'sus'> {
  if (mode === 'major') {
    const map: Record<number, Array<'major' | 'minor' | 'dom' | 'dim' | 'sus'>> = {
      0: ['major', 'dom', 'sus'],
      2: ['minor'],
      4: ['minor'],
      5: ['major', 'sus'],
      7: ['major', 'dom', 'sus'],
      9: ['minor'],
      11: ['dim'],
    };
    return map[rel] || [];
  }
  const map: Record<number, Array<'major' | 'minor' | 'dom' | 'dim' | 'sus'>> = {
    0: ['minor'],
    2: ['dim', 'minor'],
    3: ['major'],
    5: ['minor'],
    7: ['major', 'dom', 'minor', 'sus'],
    8: ['major'],
    10: ['major', 'dom'],
    11: ['dim'],
  };
  return map[rel] || [];
}

/** How well a printed chord fits a candidate key. Never used to invent missing chords. */
export function diatonicFit(chordName: string, key: SongKey): number {
  const parsed = parseChord(chordName);
  if (!parsed.isValid) return 0;
  const rootPc = notePitchClass(parsed.root);
  const tonicPc = notePitchClass(key.tonic);
  if (rootPc === undefined || tonicPc === undefined) return 0;

  const rel = (rootPc - tonicPc + 12) % 12;
  const scalePcs = key.scaleSpellings.map((note) => notePitchClass(note)).filter((pc): pc is number => pc !== undefined);
  const inScale = scalePcs.includes(rootPc);
  const qClass = qualityClass(parsed.quality);
  const expected = expectedDegreeClass(rel, key.mode);

  let score = inScale ? 1.15 : 0.12;
  if (rel === 0) score += 2.3;
  else if (rel === 7) score += 1.7;
  else if (rel === 5) score += 1.35;
  else if (key.mode === 'major' && rel === 9) score += 1.05;
  else if (key.mode === 'minor' && rel === 3) score += 1.05;
  else if (inScale) score += 0.35;

  if (expected.includes(qClass as 'major' | 'minor' | 'dom' | 'dim' | 'sus')) score += 1.55;
  else if (qClass === 'sus' && (rel === 0 || rel === 5 || rel === 7)) score += 0.8;
  else if (!inScale) score -= 0.25;

  if (parsed.bass) {
    const bassPc = notePitchClass(parsed.bass);
    if (bassPc !== undefined && scalePcs.includes(bassPc)) score += 0.25;
  }

  return score;
}

export function inferKeyFromChords(chordNames: string[]): SongKey | null {
  const parsed = chordNames.map((name) => parseChord(name)).filter((item) => item.isValid);
  if (parsed.length < 3) return null;

  const scores = CANDIDATE_KEYS.map((candidate) => {
    const key = buildSongKey(candidate.tonic, candidate.mode, 0, 'chord-histogram');
    if (!key) return { key: null as SongKey | null, score: -Infinity };
    let score = 0;
    parsed.forEach((chord, index) => {
      const name = `${chord.root}${chord.quality}${chord.bass ? `/${chord.bass}` : ''}`;
      score += diatonicFit(name, key);
      if (index === 0 || index === parsed.length - 1) {
        const rootPc = notePitchClass(chord.root);
        const tonicPc = notePitchClass(key.tonic);
        if (rootPc !== undefined && rootPc === tonicPc) score += 1.4;
      }
    });
    return { key, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];
  if (!best.key || !Number.isFinite(best.score)) return null;
  const margin = best.score - (second?.score ?? 0);
  const relative = best.score > 0 ? margin / best.score : 0;
  if (margin < 1.35 && relative < 0.08) return null;

  const confidence = Math.max(0.2, Math.min(0.86, 0.32 + relative));
  return { ...best.key, confidence };
}

export function resolveSongKey(options: {
  labels?: string[];
  chords: string[];
}): SongKey | null {
  const labeled = (options.labels || [])
    .map((label) => parsePrintedKeyLabel(label))
    .find((key): key is SongKey => Boolean(key));
  const histogram = inferKeyFromChords(options.chords);

  if (labeled && histogram) {
    const sameTonic = notePitchClass(labeled.tonic) === notePitchClass(histogram.tonic);
    if (sameTonic && labeled.mode === histogram.mode) {
      return { ...labeled, confidence: Math.max(labeled.confidence, histogram.confidence) };
    }
    if (sameTonic) return labeled;
    if (histogram.confidence > labeled.confidence + 0.12 && histogram.confidence >= 0.55) {
      return histogram;
    }
    return labeled;
  }

  return labeled || histogram;
}

function preferredSpelling(note: string, key: SongKey): string {
  const pitch = notePitchClass(note);
  if (pitch === undefined) return note;
  const scaleHit = key.scaleSpellings.find((spelling) => notePitchClass(spelling) === pitch);
  if (scaleHit) return scaleHit;
  if (key.fifths < 0) return FLAT_NOTES[pitch];
  if (key.fifths > 0) return SHARP_NOTES[pitch];
  return note.includes('b') ? FLAT_NOTES[pitch] : (note.includes('#') ? SHARP_NOTES[pitch] : (FLAT_NOTES[pitch] === SHARP_NOTES[pitch] ? SHARP_NOTES[pitch] : note));
}

function formatChord(root: string, quality: string, bass?: string): string {
  return `${root}${quality}${bass ? `/${bass}` : ''}`;
}

function isPrimaryTriadRoot(note: string, key: SongKey): boolean {
  const rootPc = notePitchClass(note);
  const tonicPc = notePitchClass(key.tonic);
  if (rootPc === undefined || tonicPc === undefined) return false;
  const rel = (rootPc - tonicPc + 12) % 12;
  return rel === 0 || rel === 5 || rel === 7;
}

function countRoots(names: string[], root: string): number {
  return names.reduce((sum, name) => {
    const parsed = parseChord(name);
    return parsed.isValid && parsed.root === root ? sum + 1 : sum;
  }, 0);
}

/**
 * Conservative, key-aware rewrite of a single already-detected symbol.
 * Same pitch respelling and known OCR confusions only — never inserts a new chord.
 */
export function disambiguateChordName(
  chordName: string,
  key: SongKey,
  companionNames: string[] = []
): string {
  const parsed = parseChord(chordName);
  if (!parsed.isValid) return chordName;

  let root = parsed.root;
  let quality = parsed.quality;
  let bass = parsed.bass;

  const rare = new Set(['Cb', 'Fb', 'E#', 'B#']);
  if (rare.has(root) && !key.scaleSpellings.includes(root)) {
    const natural = root.charAt(0);
    if ((root === 'Cb' || root === 'Fb') && isPrimaryTriadRoot(natural, key)) {
      root = natural;
    } else {
      root = preferredSpelling(root, key);
    }
  }

  if (
    (quality === '' || quality === '7') &&
    !root.includes('#') &&
    !root.includes('b') &&
    (root === 'B' || root === 'E')
  ) {
    const flatRoot = `${root}b`;
    if (key.signatureAccidentals.includes(flatRoot)) {
      const naturalCount = countRoots(companionNames, root);
      const flatCount = countRoots(companionNames, flatRoot);
      const thisIsOnlyNatural = naturalCount <= 1 && flatCount >= 1;
      const isolatedInFlatKey = naturalCount <= 1 && flatCount === 0 && key.confidence >= 0.34 && key.fifths <= -1;
      if (thisIsOnlyNatural || isolatedInFlatKey) {
        root = flatRoot;
        if (quality === '7') quality = '';
      }
    }
  }

  root = preferredSpelling(root, key);
  if (bass) bass = preferredSpelling(bass, key);

  return formatChord(root, quality, bass);
}

export function chooseNameInKey(
  current: string,
  challenger: string,
  key: SongKey | null,
  specificity: (name: string) => number
): string {
  if (!challenger) return current;
  if (!current) return challenger;
  if (current === challenger) return current;

  if (!key) {
    return specificity(challenger) > specificity(current) ? challenger : current;
  }

  const names = [current, challenger];
  const fixedCurrent = disambiguateChordName(current, key, names);
  const fixedChallenger = disambiguateChordName(challenger, key, names);

  const slashBias = Number(challenger.includes('/')) - Number(current.includes('/'));
  if (slashBias !== 0) {
    return specificity(challenger) >= specificity(current) ? challenger : current;
  }

  if (fixedCurrent === fixedChallenger) {
    return specificity(challenger) > specificity(current) ? fixedChallenger : fixedCurrent;
  }

  const fitCurrent = diatonicFit(fixedCurrent, key);
  const fitChallenger = diatonicFit(fixedChallenger, key);
  if (fitChallenger >= fitCurrent + 1.8 && specificity(challenger) + 2.5 >= specificity(current)) {
    return fixedChallenger;
  }
  if (fitCurrent >= fitChallenger + 1.8 && specificity(current) + 2.5 >= specificity(challenger)) {
    return fixedCurrent;
  }

  return specificity(challenger) > specificity(current) ? fixedChallenger : fixedCurrent;
}

export function refineDetectedChords(
  chords: ChordPosition[],
  printedLabels: string[] = []
): { chords: ChordPosition[]; key: SongKey | null } {
  if (chords.length === 0) {
    return { chords, key: resolveSongKey({ labels: printedLabels, chords: [] }) };
  }

  const names = chords.map((chord) => chord.originalText);
  const key = resolveSongKey({ labels: printedLabels, chords: names });
  if (!key || key.confidence < 0.2) {
    return { chords, key };
  }

  const refined = chords.map((chord) => {
    const next = disambiguateChordName(chord.originalText, key, names);
    if (next === chord.originalText) return chord;
    return {
      ...chord,
      originalText: next,
      currentText: next,
    };
  });

  return { chords: refined, key };
}

export function visionKeyHintText(key: SongKey): string {
  const accidentalList = key.signatureAccidentals.length > 0
    ? key.signatureAccidentals.join(', ')
    : 'no sharps or flats';
  return `This page appears to be in ${key.name} (signature: ${accidentalList}). Prefer those spellings when a glyph is ambiguous (Bb not A# or B7; F# not Gb in a sharp key). Still transcribe only printed glyphs — do not invent I–IV–V or any missing chord.`;
}
