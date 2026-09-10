// Comprehensive musical chord parsing, transposition, and formatting utility

export type AccidentalPreference = 'auto' | 'sharps' | 'flats';

export interface ParsedChord {
  original: string;
  root: string;
  quality: string;
  bass?: string;
  isValid: boolean;
}

export interface ChordPosition {
  id: string;
  originalText: string;
  currentText: string;
  // Normalized coordinates (0 to 100 percentage of image width and height)
  x: number;
  y: number;
  width?: number;
  height?: number;
  confidence?: number;
}

// 12 chromatic pitches
const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map note names to semitone value (0-11)
const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'DB': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'EB': 3, 'Eb': 3,
  'E': 4, 'FB': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'GB': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'AB': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'BB': 10, 'Bb': 10,
  'B': 11, 'CB': 11, 'Cb': 11,
};

// Key signature accidental defaults
const FLAT_KEYS = new Set([
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'
]);

// Words commonly found in lyrics, structure headers, or annotations that must NOT be treated as chords
export const EXCLUDED_COMMON_WORDS = new Set([
  // Short common words / pronouns / prepositions
  'THE', 'IN', 'ON', 'AT', 'TO', 'BY', 'IT', 'IS', 'AS', 'BE', 'HE', 'ME', 'MY', 'WE', 'SO', 'NO', 'DO', 'GO', 'OR', 'IF', 'UP', 'AND', 'FOR',
  'OF', 'WITH', 'YOU', 'YOUR', 'ALL', 'ARE', 'WAS', 'WERE', 'OUT', 'DAY', 'SEE', 'FACE', 'LORD', 'LIFE', 'KING', 'WILL', 'DONE', 'COME',
  'DOWN', 'JOY', 'LOVE', 'LIGHT', 'NOT', 'BUT', 'FROM', 'THEY', 'THEM', 'HER', 'HIS', 'OUR', 'WHO', 'WHAT', 'HOW', 'WHEN', 'ONCE', 'BACK',
  'GIVE', 'SACRIFICE', 'WORSHIP', 'HOLY', 'SPIRIT', 'REIGN', 'PRAISE', 'WALK', 'STAND', 'HEAR', 'TELL', 'SING', 'SONG', 'SOUND',
  'BLOOD', 'LAMB', 'PEACE', 'GRACE', 'SINS', 'GRIEFS', 'BEAR', 'PRAYER', 'EVER', 'ALWAYS', 'FRIEND', 'EMBRACE', 'STRENGTH',
  'DID', 'CAN', 'CAME', 'END', 'FAR', 'GET', 'GOT', 'GOOD', 'GREAT', 'GAVE', 'HAD', 'HAS', 'HAVE', 'HIM', 'MAN', 'MEN', 'MAY', 'NOW',
  'NOR', 'NEW', 'OLD', 'ONE', 'SAW', 'SAY', 'SAID', 'SHE', 'THY', 'THEE', 'THOU', 'THEN', 'THAN', 'THIS', 'THAT', 'TOO', 'TWO', 'WAY',
  // Sheet music section headers and publisher text
  'INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'ENDING', 'CODA', 'REFRAIN', 'HOOK', 'SOLO', 'INTERLUDE', 'TAG',
  'COPYRIGHT', 'CCLI', 'BMI', 'STREAM', 'MUSIC', 'PAGE', 'SONG', 'KEY', 'TIME', 'TEMPO',
  'CHORD', 'CHORDS', 'LEAD', 'SHEET', 'MEASURE', 'BAR', 'STAFF', 'STAVES', 'TREBLE', 'BASS', 'CLEF',
  // Musical dynamics & performance markings
  'MF', 'MP', 'FFF', 'PPP', 'SFZ', 'CRESC', 'RIT', 'ACCEL',
  // OCR artifacts / syllables frequently misread from sheet music notes & lyrics
  // Note: 'BB' and 'EB' are checked separately so real chords 'Bb' and 'Eb' are not blocked
  'EE', 'AA', 'CC', 'DD', 'FF', 'GG', 'BA', 'CA', 'DA', 'FA', 'GA',
  'I'
]);

// Lowercase tokens that represent words in lyrics rather than chords (e.g. "a", "am", "em", "b", "in")
export const EXCLUDED_LOWERCASE_WORDS = new Set([
  'a', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'em', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'we',
  'did', 'are', 'all', 'and', 'can', 'come', 'came', 'day', 'end', 'for', 'from', 'far', 'get', 'got', 'good', 'great', 'give', 'gave',
  'had', 'has', 'have', 'him', 'his', 'her', 'how', 'into', 'like', 'man', 'men', 'may', 'now', 'not', 'nor', 'new', 'old', 'one', 'out', 'our',
  'see', 'saw', 'say', 'said', 'she', 'the', 'thy', 'thee', 'thou', 'then', 'than', 'this', 'that', 'too', 'two', 'was', 'were', 'who', 'why', 'way', 'will', 'with', 'you', 'your'
]);

/**
 * Normalizes accidental representations (e.g., ♯ -> #, ♭ -> b)
 */
export function normalizeAccidentals(str: string): string {
  return str
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/ø|Ø/g, 'm7b5')
    .replace(/Δ/g, 'maj7')
    .replace(/°/g, 'dim')
    .trim();
}

/**
 * Regex to parse a chord into Root, Quality, and optional Bass (/Note)
 * Matches e.g.:
 * C, C#, Db, F#m, Bbm7, Gsus4, Dmaj7, F#m7b5, C7#9, Bb/D, G/B, G/D7, etc.
 */
const CHORD_REGEX = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?[0-9]*))?$/i;

/**
 * Parses a chord string into its constituent parts
 */
export function parseChord(chordStr: string): ParsedChord {
  const cleaned = normalizeAccidentals(chordStr.trim());
  if (!cleaned) {
    return { original: chordStr, root: '', quality: '', isValid: false };
  }

  const match = cleaned.match(CHORD_REGEX);
  if (!match) {
    return { original: chordStr, root: '', quality: '', isValid: false };
  }

  // Capitalize root correctly (e.g., "bb" -> "Bb", "c#" -> "C#")
  let root = match[1];
  root = root.charAt(0).toUpperCase() + (root.slice(1).toLowerCase());

  let quality = match[2] || '';
  let bass = match[3];

  if (bass) {
    bass = bass.charAt(0).toUpperCase() + (bass.slice(1).toLowerCase());
    // If bass has a numeric extension (e.g., D7 in G/D7), extract just the note for transposition
    if (/^[A-G][#b]?[0-9]+$/i.test(bass)) {
      bass = bass.slice(0, bass.search(/[0-9]/i));
    }
  }

  // Capitalize quality if it was lowercase single letter root that got lumped, or normalize
  // Check special cases where 'c' was lowercase
  if (/^[a-g]$/.test(root)) {
    root = root.toUpperCase();
  }

  // Verify root is in note map
  if (NOTE_TO_SEMITONE[root] === undefined) {
    return { original: chordStr, root: '', quality: '', isValid: false };
  }

  if (bass && NOTE_TO_SEMITONE[bass] === undefined) {
    return { original: chordStr, root: '', quality: '', isValid: false };
  }

  return {
    original: chordStr,
    root,
    quality,
    bass,
    isValid: true,
  };
}

/**
 * Checks if a string is a valid chord symbol
 */
export function isValidChord(str: string): boolean {
  return parseChord(str).isValid;
}

/**
 * Transposes a single note by a given number of semitones (-12 to +12)
 */
export function transposeNote(
  note: string,
  semitones: number,
  preference: AccidentalPreference = 'auto',
  targetKey?: string
): string {
  const normalized = normalizeAccidentals(note);
  const formatted = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  const currentSemitone = NOTE_TO_SEMITONE[formatted];

  if (currentSemitone === undefined) {
    return note;
  }

  // Calculate new semitone (mod 12 with positive result)
  const newSemitone = ((currentSemitone + semitones) % 12 + 12) % 12;

  // Decide whether to use sharps or flats
  let useFlats = false;
  if (preference === 'flats') {
    useFlats = true;
  } else if (preference === 'sharps') {
    useFlats = false;
  } else {
    // Auto preference based on target key or direction
    if (targetKey && FLAT_KEYS.has(targetKey)) {
      useFlats = true;
    } else if (note.includes('b')) {
      // If original had flats and no specific key, tend to preserve flats
      useFlats = true;
    } else {
      // Common standard musical convention
      useFlats = [1, 3, 8, 10].includes(newSemitone) && semitones < 0;
    }
  }

  return useFlats ? FLAT_NOTES[newSemitone] : SHARP_NOTES[newSemitone];
}

/**
 * Transposes a full chord (root + quality + optional bass note)
 * Example:
 * transposeChord("C", -1) -> "B" (1 half step lower)
 * transposeChord("C", -2) -> "Bb" (1 whole step / 1 key lower)
 * transposeChord("Am7", 2) -> "Bm7"
 * transposeChord("G/B", -2) -> "F/A"
 */
export function transposeChord(
  chordStr: string,
  semitones: number,
  preference: AccidentalPreference = 'auto',
  targetKey?: string
): string {
  if (semitones === 0) {
    return chordStr;
  }

  const parsed = parseChord(chordStr);
  if (!parsed.isValid) {
    return chordStr; // Return unchanged if not recognized
  }

  const newRoot = transposeNote(parsed.root, semitones, preference, targetKey);
  const newBass = parsed.bass ? '/' + transposeNote(parsed.bass, semitones, preference, targetKey) : '';

  return `${newRoot}${parsed.quality}${newBass}`;
}

/**
 * Calculates semitone distance between two keys
 * e.g., fromKey: "C", toKey: "Bb" -> -2 semitones
 */
export function getSemitoneDistance(fromKey: string, toKey: string): number {
  const fromClean = parseChord(fromKey).root;
  const toClean = parseChord(toKey).root;

  const fromSemi = NOTE_TO_SEMITONE[fromClean];
  const toSemi = NOTE_TO_SEMITONE[toClean];

  if (fromSemi === undefined || toSemi === undefined) {
    return 0;
  }

  let diff = toSemi - fromSemi;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  return diff;
}

/**
 * Tests if a recognized word or token is likely a chord symbol in sheet music
 */
export function isLikelyChordSymbol(token: string, allowSingleLetterA = false): boolean {
  const raw = token.trim();
  const cleaned = normalizeAccidentals(raw.replace(/^[\[\(\{<|"']+|[\]\)\}>|"':;,]+$/g, ''));
  if (!cleaned || cleaned.length > 10) return false;

  const upper = cleaned.toUpperCase();

  // Exact uppercase double-letter artifacts (like EB, BB) are not chords, but real chords Bb and Eb are valid
  if (cleaned === 'EB' || cleaned === 'BB') {
    return false;
  }

  // Filter excluded common words, section headers, lyric terms, and doubled-letter artifacts
  if (EXCLUDED_COMMON_WORDS.has(upper)) {
    return false;
  }

  // Handle single-letter 'A' or 'B'
  if (!allowSingleLetterA && (cleaned === 'A' || cleaned === 'a' || cleaned === 'I' || cleaned === 'i' || cleaned === 'B')) {
    return false;
  }

  // Filter lowercase words in lyrics (e.g. "a", "am", "em", "b", "in")
  // Only check EXCLUDED_LOWERCASE_WORDS if the token is completely lowercase.
  // Capitalized chord symbols like "Am" (A minor) and "Em" (E minor) must never be blocked.
  if (cleaned === cleaned.toLowerCase() && EXCLUDED_LOWERCASE_WORDS.has(cleaned)) {
    return false;
  }

  const parsed = parseChord(cleaned);
  if (!parsed.isValid) return false;

  // Must match standard chord syntax
  // Allowed roots: A-G with optional # or b
  const root = parsed.root;
  if (!/^[A-G][#b]?$/.test(root)) return false;

  // If bass note is present, it must be a valid note and NOT identical to the root (e.g. D/D or C/C is redundant/artifact)
  if (parsed.bass) {
    if (!/^[A-G][#b]?$/.test(parsed.bass)) return false;
    if (parsed.bass.toUpperCase() === root.toUpperCase()) return false;
  }

  // Validate quality contains musical chord suffixes
  const validQualities = [
    '', 'm', 'min', '-', 'maj', 'M', 'maj7', 'M7', '7', 'm7', 'min7', '-7',
    'dim', 'dim7', 'aug', '+', 'sus', 'sus2', 'sus4', '7sus4', '7sus',
    'add9', 'add2', 'add4', 'add11', '9', 'm9', 'maj9', '11', 'm11', '13', 'm13',
    '6', 'm6', '6/9', 'm6/9', '5', 'm7b5', '7b5', '7#5', '7b9', '7#9', 'alt'
  ];

  const q = parsed.quality.toLowerCase();
  const qualityMatch = validQualities.some(valid => valid.toLowerCase() === q);

  return qualityMatch;
}

/**
 * Musical note frequencies and MIDI numbers for synth audio playback
 */
const CHORD_INTERVALS: Record<string, number[]> = {
  // Major
  '': [0, 4, 7],
  'maj': [0, 4, 7],
  'M': [0, 4, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  'maj7': [0, 4, 7, 11],
  'M7': [0, 4, 7, 11],
  'maj9': [0, 4, 7, 11, 14],
  'add9': [0, 4, 7, 14],

  // Minor
  'm': [0, 3, 7],
  'min': [0, 3, 7],
  '-': [0, 3, 7],
  'm6': [0, 3, 7, 9],
  'm7': [0, 3, 7, 10],
  'min7': [0, 3, 7, 10],
  '-7': [0, 3, 7, 10],
  'm9': [0, 3, 7, 10, 14],
  'm11': [0, 3, 7, 10, 14, 17],

  // Dominant
  '7': [0, 4, 7, 10],
  '9': [0, 4, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15],
  '7b5': [0, 4, 6, 10],
  '7#5': [0, 4, 8, 10],

  // Diminished & Half-Diminished
  'dim': [0, 3, 6],
  'dim7': [0, 3, 6, 9],
  'm7b5': [0, 3, 6, 10],

  // Augmented
  'aug': [0, 4, 8],
  '+': [0, 4, 8],

  // Suspended
  'sus': [0, 5, 7],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
  '7sus4': [0, 5, 7, 10],
  '7sus': [0, 5, 7, 10],
};

/**
 * Returns array of MIDI note numbers for a given chord (centered around Middle C = 60)
 */
export function getChordMidiNotes(chordStr: string): number[] {
  const parsed = parseChord(chordStr);
  if (!parsed.isValid) return [60, 64, 67]; // Fallback C major

  const rootSemitone = NOTE_TO_SEMITONE[parsed.root] ?? 0;
  // Center around octave 4 (MIDI 60 = C4)
  const baseMidi = 60 + rootSemitone;

  const intervals = CHORD_INTERVALS[parsed.quality] || [0, 4, 7];
  const notes = intervals.map(interval => baseMidi + interval);

  // If there's a bass note, add an octave lower bass note
  if (parsed.bass) {
    const bassSemitone = NOTE_TO_SEMITONE[parsed.bass] ?? rootSemitone;
    notes.unshift(48 + bassSemitone);
  }

  return notes;
}

/**
 * Standard list of keys for transposing reference
 */
export const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
  'Am', 'A#m', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m'
];
