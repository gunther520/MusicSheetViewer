import { describe, it, expect } from 'vitest';
import { runEvaluation } from '../scripts/evaluate-engine';

describe('Four Music Sheets Ground Truth Evaluation', () => {
  it(
    'evaluates all 4 sheets with zero missing and zero false chords',
    async () => {
      const result = await runEvaluation();
      expect(result.allPassed).toBe(true);
      expect(result.totalDetected).toBe(result.totalExpected);
      expect(result.totalExpected).toBe(168);
    },
    60000
  );
});
