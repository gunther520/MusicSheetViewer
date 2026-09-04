import { describe, it } from 'vitest';

describe('Extract chords from chord line composite tokens', () => {
  it('extracts chords cleanly', () => {
    function extractChordsFromText(text: string): string[] {
      // 1. Normalize slash chord misreads: CIE -> C/E, CIBb -> C/Bb
      let s = text.replace(/([A-G][#b]?)[I|l1\\]([A-G][#b]?)/gi, '$1/$2');
      // 2. Normalize 'An' to 'Am', 'Dn' to 'Dm', 'En' to 'Em'
      s = s.replace(/\b([A-G][#b]?)n\b/gi, '$1m');
      // 3. Normalize bracket separators like F]6G -> F G
      s = s.replace(/([A-G][#b]?)\][0-9]*([A-G][#b]?)/gi, '$1 $2');
      // 4. Gsusé4 -> Gsus4
      s = s.replace(/sus[é0-9]*4/gi, 'sus4');

      const matches: string[] = [];
      const regex = /([A-G][#b]?(?:m|min|-|maj|M|maj7|M7|7|sus2|sus4|sus|dim|dim7|aug|\+|add9|add2|6|9|11|13|m7|min7|-7|m7b5)?(?:\/[A-G][#b]?)?)/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(s)) !== null) {
        if (m[1] && m[1].length > 0) {
          matches.push(m[1]);
        }
      }
      return matches;
    }

    const testStrings = [
      '(F]G6',
      '(F]6G',
      '|Em|Am',
      '[E2An',
      'F(G/F',
      'CIE',
      'c',
      'C',
      'Bb/C',
      'C/Bb',
      'Gsus4',
      'Gsusé4',
      'An',
      'B-',
      'c7',
      'c CIE (F]6G c CIE'
    ];

    testStrings.forEach(str => {
      console.log(str, '=>', extractChordsFromText(str));
    });
  });
});
