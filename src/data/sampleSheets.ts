import { ChordPosition } from '../utils/chordUtils';

export interface SampleSheet {
  id: string;
  title: string;
  composer: string;
  genre: string;
  originalKey: string;
  description: string;
  imageUrl: string;
  defaultChords: ChordPosition[];
}

// Generate an authentic looking SVG sheet music data URL
function createSvgSheet(
  title: string,
  composer: string,
  key: string,
  timeSignature: string,
  measures: { chord: string; notes?: string }[][]
): string {
  const width = 850;
  const height = 1100;
  const marginX = 60;
  const startY = 160;
  const systemSpacing = 160;
  const staffWidth = width - marginX * 2;

  let systemsSvg = '';

  measures.forEach((systemMeasures, sysIdx) => {
    const sysY = startY + sysIdx * systemSpacing;
    const measureWidth = staffWidth / systemMeasures.length;

    // Draw 5 staff lines
    for (let line = 0; line < 5; line++) {
      const lineY = sysY + line * 10;
      systemsSvg += `<line x1="${marginX}" y1="${lineY}" x2="${width - marginX}" y2="${lineY}" stroke="#334155" stroke-width="1.2"/>`;
    }

    // Draw start and end bar lines
    systemsSvg += `<line x1="${marginX}" y1="${sysY}" x2="${marginX}" y2="${sysY + 40}" stroke="#334155" stroke-width="2"/>`;
    systemsSvg += `<line x1="${width - marginX}" y1="${sysY}" x2="${width - marginX}" y2="${sysY + 40}" stroke="#334155" stroke-width="2"/>`;

    // Treble Clef symbol (sysIdx === 0 or all)
    systemsSvg += `
      <text x="${marginX + 8}" y="${sysY + 34}" font-family="serif" font-size="44" fill="#1e293b" font-weight="bold">𝄞</text>
    `;

    // Time signature on first system
    if (sysIdx === 0) {
      systemsSvg += `
        <text x="${marginX + 42}" y="${sysY + 18}" font-family="sans-serif" font-size="18" font-weight="bold" fill="#334155">4</text>
        <text x="${marginX + 42}" y="${sysY + 36}" font-family="sans-serif" font-size="18" font-weight="bold" fill="#334155">4</text>
      `;
    }

    // Measure barlines and chords
    systemMeasures.forEach((m, mIdx) => {
      const mX = marginX + mIdx * measureWidth;
      const contentStartX = mX + (sysIdx === 0 && mIdx === 0 ? 65 : 20);

      // Measure divider
      if (mIdx > 0) {
        systemsSvg += `<line x1="${mX}" y1="${sysY}" x2="${mX}" y2="${sysY + 40}" stroke="#64748b" stroke-width="1.2"/>`;
      }

      // Chord text above staff
      systemsSvg += `
        <text x="${contentStartX}" y="${sysY - 14}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="22" font-weight="800" fill="#0f172a">${m.chord}</text>
      `;

      // Decorative musical notes inside staff
      const noteX1 = contentStartX + 15;
      const noteX2 = contentStartX + 45;
      const noteX3 = contentStartX + 75;
      const noteX4 = contentStartX + 105;

      const randomYOffset = ((sysIdx * 7 + mIdx * 11) % 4) * 6;

      // Draw standard musical notes representation (quarter notes & whole notes)
      systemsSvg += `
        <ellipse cx="${noteX1}" cy="${sysY + 25 - randomYOffset}" rx="6" ry="4.5" transform="rotate(-25 ${noteX1} ${sysY + 25 - randomYOffset})" fill="#1e293b"/>
        <line x1="${noteX1 + 5}" y1="${sysY + 23 - randomYOffset}" x2="${noteX1 + 5}" y2="${sysY - 5 - randomYOffset}" stroke="#1e293b" stroke-width="1.8"/>

        <ellipse cx="${noteX2}" cy="${sysY + 15 + randomYOffset}" rx="6" ry="4.5" transform="rotate(-25 ${noteX2} ${sysY + 15 + randomYOffset})" fill="#1e293b"/>
        <line x1="${noteX2 + 5}" y1="${sysY + 13 + randomYOffset}" x2="${noteX2 + 5}" y2="${sysY - 15 + randomYOffset}" stroke="#1e293b" stroke-width="1.8"/>

        <ellipse cx="${noteX3}" cy="${sysY + 30 - randomYOffset}" rx="6" ry="4.5" transform="rotate(-25 ${noteX3} ${sysY + 30 - randomYOffset})" fill="#1e293b"/>
        <line x1="${noteX3 + 5}" y1="${sysY + 28 - randomYOffset}" x2="${noteX3 + 5}" y2="${sysY}" stroke="#1e293b" stroke-width="1.8"/>

        <ellipse cx="${noteX4}" cy="${sysY + 20 + randomYOffset}" rx="6" ry="4.5" transform="rotate(-25 ${noteX4} ${sysY + 20 + randomYOffset})" fill="#1e293b"/>
        <line x1="${noteX4 + 5}" y1="${sysY + 18 + randomYOffset}" x2="${noteX4 + 5}" y2="${sysY - 10}" stroke="#1e293b" stroke-width="1.8"/>
      `;
    });
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <!-- Paper background with subtle warmth -->
      <rect width="${width}" height="${height}" fill="#fcfbf7"/>
      <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Header -->
      <text x="${width / 2}" y="65" text-anchor="middle" font-family="'Plus Jakarta Sans', serif" font-size="30" font-weight="800" fill="#0f172a">${title}</text>
      <text x="${width / 2}" y="95" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="600" fill="#64748b">Key: ${key} • Time: ${timeSignature}</text>
      <text x="${width - marginX}" y="95" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-style="italic" fill="#475569">${composer}</text>

      <!-- Music Systems -->
      ${systemsSvg}

      <!-- Footer watermark -->
      <text x="${width / 2}" y="${height - 35}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#94a3b8">Music Sheet Transposer • Ready for Chord Transposition</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Pre-calculated normalized coordinates (0-100% of sheet dimensions)
function calculateSystemChords(
  measures: { chord: string }[][],
  width = 850,
  height = 1100,
  startY = 160,
  systemSpacing = 160,
  marginX = 60
): ChordPosition[] {
  const staffWidth = width - marginX * 2;
  const chords: ChordPosition[] = [];
  let idCounter = 1;

  measures.forEach((systemMeasures, sysIdx) => {
    const sysY = startY + sysIdx * systemSpacing;
    const measureWidth = staffWidth / systemMeasures.length;

    systemMeasures.forEach((m, mIdx) => {
      const mX = marginX + mIdx * measureWidth;
      const contentStartX = mX + (sysIdx === 0 && mIdx === 0 ? 65 : 20);
      const chordY = sysY - 14;

      chords.push({
        id: `chord-${idCounter++}`,
        originalText: m.chord,
        currentText: m.chord,
        // Normalized coordinates in percentages
        x: (contentStartX / width) * 100,
        y: ((chordY - 18) / height) * 100,
        width: 6,
        height: 3,
        confidence: 0.98,
      });
    });
  });

  return chords;
}

// 1. Pop progression (Let It Be / Standard Pop in C)
const popMeasures = [
  [{ chord: 'C' }, { chord: 'G' }, { chord: 'Am' }, { chord: 'F' }],
  [{ chord: 'C' }, { chord: 'G' }, { chord: 'F' }, { chord: 'C' }],
  [{ chord: 'Am' }, { chord: 'G' }, { chord: 'F' }, { chord: 'C' }],
  [{ chord: 'C' }, { chord: 'G' }, { chord: 'F/A' }, { chord: 'C' }],
  [{ chord: 'Dm7' }, { chord: 'G7' }, { chord: 'C' }, { chord: 'C' }],
];

// 2. Jazz Standard progression (Autumn Leaves in G / Em)
const jazzMeasures = [
  [{ chord: 'Am7' }, { chord: 'D7' }, { chord: 'Gmaj7' }, { chord: 'Cmaj7' }],
  [{ chord: 'F#m7b5' }, { chord: 'B7' }, { chord: 'Em' }, { chord: 'Em' }],
  [{ chord: 'Am7' }, { chord: 'D7' }, { chord: 'Gmaj7' }, { chord: 'Cmaj7' }],
  [{ chord: 'F#m7b5' }, { chord: 'B7b9' }, { chord: 'Em' }, { chord: 'Em7' }],
  [{ chord: 'F#m7b5' }, { chord: 'B7' }, { chord: 'Em7' }, { chord: 'A7' }],
];

// 3. Rock / Acoustic Progression (Classic Rock in D)
const rockMeasures = [
  [{ chord: 'D' }, { chord: 'A/C#' }, { chord: 'Bm' }, { chord: 'F#m' }],
  [{ chord: 'G' }, { chord: 'D/F#' }, { chord: 'Em7' }, { chord: 'A7' }],
  [{ chord: 'D' }, { chord: 'A' }, { chord: 'Bm' }, { chord: 'G' }],
  [{ chord: 'D' }, { chord: 'A' }, { chord: 'G' }, { chord: 'D' }],
];

export const SAMPLE_SHEETS: SampleSheet[] = [
  {
    id: 'pop-ballad',
    title: 'Peaceful Melody (Pop Ballad)',
    composer: 'Modern Pop Classic',
    genre: 'Pop / Ballad',
    originalKey: 'C',
    description: 'Popular 4-chord progression in C Major. Perfect for testing "one key lower" (e.g. C -> Bb).',
    imageUrl: createSvgSheet('Peaceful Melody', 'Modern Pop Classic', 'C Major', '4/4', popMeasures),
    defaultChords: calculateSystemChords(popMeasures),
  },
  {
    id: 'jazz-autumn',
    title: 'Autumn Echoes (Jazz Standard)',
    composer: 'Jazz Standard ii-V-I',
    genre: 'Jazz / Standards',
    originalKey: 'G',
    description: 'Features rich extensions: maj7, m7, m7b5, 7b9, slash chords. Great for jazz musicians transposing keys.',
    imageUrl: createSvgSheet('Autumn Echoes', 'Jazz Standard ii-V-I', 'G Major / E Minor', '4/4', jazzMeasures),
    defaultChords: calculateSystemChords(jazzMeasures),
  },
  {
    id: 'rock-acoustic',
    title: 'Sunrise Road (Acoustic Rock)',
    composer: 'Folk / Acoustic',
    genre: 'Acoustic / Rock',
    originalKey: 'D',
    description: 'Includes slash chords like A/C# and D/F#. Transpose down to C or up to E with full bass note handling.',
    imageUrl: createSvgSheet('Sunrise Road', 'Folk / Acoustic', 'D Major', '4/4', rockMeasures),
    defaultChords: calculateSystemChords(rockMeasures),
  },
];
