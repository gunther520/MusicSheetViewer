/**
 * Evaluation-only matching of detected overlay chords against expected sequences.
 * Not used by the scanner.
 */

export function normalizeEvalChord(name: string): string {
  return name
    .trim()
    .replace(/[△∆Δ]/g, 'maj7')
    .replace(/maj77/g, 'maj7')
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .replace(/ø7?/gi, 'm7b5')
    .replace(/maj9/gi, 'maj9')
    .replace(/9maj7/gi, 'maj9')
    .replace(/\s+/g, '');
}

function splitQualityBass(name: string): { body: string; bass: string } {
  const normalized = normalizeEvalChord(name);
  const slash = normalized.lastIndexOf('/');
  if (slash <= 0) return { body: normalized, bass: '' };
  return { body: normalized.slice(0, slash), bass: normalized.slice(slash + 1) };
}

/** Exact symbol match, or same root+quality with missing/extra bass. */
export function chordsEquivalent(expected: string, detected: string): boolean {
  const a = splitQualityBass(expected);
  const b = splitQualityBass(detected);
  if (a.body === b.body && a.bass === b.bass) return true;
  if (a.body === b.body) return true;
  return false;
}

export interface SequenceScore {
  hits: number;
  missed: string[];
  extras: string[];
}

export function scoreNameSequence(expected: string[], detected: string[]): SequenceScore {
  const used = new Array(detected.length).fill(false);
  const missed: string[] = [];

  expected.forEach((want) => {
    const idx = detected.findIndex((got, i) => !used[i] && chordsEquivalent(want, got));
    if (idx >= 0) {
      used[idx] = true;
      return;
    }
    missed.push(want);
  });

  const extras = detected.filter((_, i) => !used[i]);
  return {
    hits: expected.length - missed.length,
    missed,
    extras,
  };
}

export interface StaffExpectation {
  yCenter: number;
  expected: string[];
}

export interface SheetScore {
  expected: number;
  hits: number;
  extras: number;
  recall: number;
  missed: string[];
  extraNames: string[];
}

/**
 * Assign each detection to the nearest staff by Y, then score name bags per staff.
 * Detections farther than yTolPct from every staff count as extras (wrong position).
 */
export function scoreSheetDetections(
  staves: StaffExpectation[],
  detections: Array<{ originalText: string; x: number; y: number }>,
  imgHeight: number,
  yTolPct = 4.2
): SheetScore {
  if (staves.length === 0) {
    return {
      expected: 0,
      hits: 0,
      extras: detections.length,
      recall: 1,
      missed: [],
      extraNames: detections.map((item) => item.originalText),
    };
  }

  const buckets: Array<Array<{ originalText: string; x: number }>> = staves.map(() => []);
  const stray: string[] = [];

  detections.forEach((chord) => {
    let best = 0;
    let bestDist = Infinity;
    staves.forEach((staff, index) => {
      const staffPct = (staff.yCenter / imgHeight) * 100;
      const dist = Math.abs(chord.y - staffPct);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    if (bestDist > yTolPct) {
      stray.push(chord.originalText);
      return;
    }
    buckets[best].push({ originalText: chord.originalText, x: chord.x });
  });

  let hits = 0;
  let extras = stray.length;
  const missed: string[] = [];
  const extraNames = [...stray];
  let expected = 0;

  staves.forEach((staff, index) => {
    expected += staff.expected.length;
    const names = buckets[index]
      .sort((a, b) => a.x - b.x)
      .map((item) => item.originalText);
    const score = scoreNameSequence(staff.expected, names);
    hits += score.hits;
    extras += score.extras.length;
    missed.push(...score.missed);
    extraNames.push(...score.extras);
  });

  return {
    expected,
    hits,
    extras,
    recall: expected > 0 ? hits / expected : 1,
    missed,
    extraNames,
  };
}
