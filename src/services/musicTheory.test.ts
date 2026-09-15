import { describe, it, expect } from 'vitest';
import { ChordPosition } from '../utils/chordUtils';
import {
  parsePrintedKeyLabel,
  extractPrintedKeyLabels,
  inferKeyFromChords,
  resolveSongKey,
  disambiguateChordName,
  refineDetectedChords,
  chooseNameInKey,
  buildSongKey,
  visionKeyHintText,
} from './musicTheory';

function chord(text: string, x = 10, y = 10): ChordPosition {
  return {
    id: text,
    originalText: text,
    currentText: text,
    x,
    y,
    width: 5,
    height: 3,
  };
}

describe('parsePrintedKeyLabel', () => {
  it('reads explicit key headings and ignores lone chord letters', () => {
    expect(parsePrintedKeyLabel('Key: F')?.name).toBe('F major');
    expect(parsePrintedKeyLabel('key of Bb major')?.name).toBe('Bb major');
    expect(parsePrintedKeyLabel('Key of Dm')?.name).toBe('D minor');
    expect(parsePrintedKeyLabel('in C Major')?.name).toBe('C major');
    expect(parsePrintedKeyLabel('G Minor')?.name).toBe('G minor');
    expect(parsePrintedKeyLabel('F')).toBeNull();
    expect(parsePrintedKeyLabel('a major part of the song')).toBeNull();
    expect(parsePrintedKeyLabel('VERSE')).toBeNull();
  });
});

describe('extractPrintedKeyLabels', () => {
  it('joins nearby header tokens such as Key of F Major', () => {
    const labels = extractPrintedKeyLabels([
      { text: 'Key', y0: 12 },
      { text: 'of', y0: 12 },
      { text: 'F', y0: 12 },
      { text: 'Major', y0: 12 },
      { text: 'C', y0: 400 },
      { text: 'G', y0: 400 },
    ], 1000);
    expect(labels.some((label) => /F major/i.test(label))).toBe(true);
  });
});

describe('inferKeyFromChords', () => {
  it('infers C major from a I–IV–V–vi histogram without using a song title', () => {
    const key = inferKeyFromChords(['C', 'F', 'G', 'Am', 'C', 'F', 'G', 'C']);
    expect(key?.name).toBe('C major');
    expect(key?.source).toBe('chord-histogram');
  });

  it('infers F major from a flat-key histogram', () => {
    const key = inferKeyFromChords(['F', 'Bb', 'C', 'Dm', 'F', 'Bb', 'C', 'F']);
    expect(key?.name).toBe('F major');
    expect(key?.signatureAccidentals).toEqual(['Bb']);
  });

  it('infers A minor when the dominant is E7 rather than G', () => {
    const key = inferKeyFromChords(['Am', 'Dm', 'E7', 'Am', 'Dm', 'E7', 'Am']);
    expect(key?.name).toBe('A minor');
  });

  it('needs several chords before guessing', () => {
    expect(inferKeyFromChords(['C', 'G'])).toBeNull();
  });
});

describe('resolveSongKey', () => {
  it('prefers a printed label over the histogram when they disagree', () => {
    const key = resolveSongKey({
      labels: ['Key: Bb major'],
      chords: ['C', 'F', 'G', 'Am', 'C'],
    });
    expect(key?.name).toBe('Bb major');
    expect(key?.source).toBe('printed-label');
  });
});

describe('disambiguateChordName', () => {
  it('respells A# to Bb in F major and keeps G7 in C major', () => {
    const fMajor = buildSongKey('F', 'major', 0.7, 'chord-histogram')!;
    const cMajor = buildSongKey('C', 'major', 0.7, 'chord-histogram')!;
    expect(disambiguateChordName('A#', fMajor, ['F', 'C', 'A#'])).toBe('Bb');
    expect(disambiguateChordName('D/A#', fMajor, ['F', 'D/A#'])).toBe('D/Bb');
    expect(disambiguateChordName('G7', cMajor, ['C', 'F', 'G7'])).toBe('G7');
    expect(disambiguateChordName('G5', cMajor, ['C', 'G5', 'F'])).toBe('G5');
  });

  it('treats an isolated B7 as Bb in a Bb-signature key when other Bb chords are present', () => {
    const fMajor = buildSongKey('F', 'major', 0.7, 'chord-histogram')!;
    expect(disambiguateChordName('B7', fMajor, ['F', 'Bb', 'C', 'B7'])).toBe('Bb');
  });

  it('keeps a real B7 in a sharp key', () => {
    const eMajor = buildSongKey('E', 'major', 0.7, 'chord-histogram')!;
    expect(disambiguateChordName('B7', eMajor, ['E', 'B7', 'A'])).toBe('B7');
  });

  it('drops a spurious Cb onto C when C is I/IV/V, but keeps Cb in Gb major', () => {
    const cMajor = buildSongKey('C', 'major', 0.7, 'chord-histogram')!;
    const gbMajor = buildSongKey('Gb', 'major', 0.7, 'chord-histogram')!;
    expect(disambiguateChordName('Cb', cMajor, ['C', 'F', 'G', 'Cb'])).toBe('C');
    expect(disambiguateChordName('Cb', gbMajor, ['Gb', 'Cb', 'Db'])).toBe('Cb');
  });
});

describe('refineDetectedChords', () => {
  it('rewrites names in place and never invents extra chords', () => {
    const input = [
      chord('F', 10, 20),
      chord('B7', 25, 20),
      chord('C', 40, 20),
      chord('Bb', 55, 20),
      chord('F', 70, 20),
    ];
    const { chords, key } = refineDetectedChords(input);
    expect(key?.name).toBe('F major');
    expect(chords).toHaveLength(5);
    expect(chords.map((item) => item.originalText)).toEqual(['F', 'Bb', 'C', 'Bb', 'F']);
  });

  it('leaves an empty SATB-style detection unchanged', () => {
    const { chords, key } = refineDetectedChords([]);
    expect(chords).toEqual([]);
    expect(key).toBeNull();
  });

  it('keeps secondary dominants that are not the Bb/B7 OCR pair', () => {
    const input = [
      chord('C'),
      chord('A7'),
      chord('Dm7'),
      chord('G7'),
      chord('Cmaj7'),
    ];
    const { chords } = refineDetectedChords(input);
    expect(chords.map((item) => item.originalText)).toEqual(['C', 'A7', 'Dm7', 'G7', 'Cmaj7']);
  });
});

describe('chooseNameInKey', () => {
  const spec = (name: string) => name.length + (name.includes('/') ? 2 : 0) + (/[0-9]/.test(name) ? 2 : 0);

  it('does not drop slash chords in favor of a diatonic triad', () => {
    const cMajor = buildSongKey('C', 'major', 0.7, 'chord-histogram')!;
    expect(chooseNameInKey('C', 'C/E', cMajor, spec)).toBe('C/E');
  });

  it('prefers Bb over a nearby B7 when the page is in F major', () => {
    const fMajor = buildSongKey('F', 'major', 0.7, 'chord-histogram')!;
    expect(chooseNameInKey('Bb', 'B7', fMajor, spec)).toBe('Bb');
  });
});

describe('visionKeyHintText', () => {
  it('mentions the inferred key without asking the model to invent a progression', () => {
    const key = buildSongKey('F', 'major', 0.7, 'printed-label')!;
    const hint = visionKeyHintText(key);
    expect(hint).toContain('F major');
    expect(hint).toContain('Bb');
    expect(hint).toMatch(/do not invent/i);
  });
});
