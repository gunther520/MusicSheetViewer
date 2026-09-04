import { describe, it, expect } from 'vitest';
import {
  parseVisionChordsResponse,
  VISION_DETECTION_SYSTEM_PROMPT,
} from './visionAiService';

describe('Vision AI Service', () => {
  it('has a comprehensive prompt enforcing clean music chord extraction', () => {
    expect(VISION_DETECTION_SYSTEM_PROMPT).toContain('expert music notation');
    expect(VISION_DETECTION_SYSTEM_PROMPT).toContain('xPercent');
    expect(VISION_DETECTION_SYSTEM_PROMPT).toContain('yPercent');
    expect(VISION_DETECTION_SYSTEM_PROMPT).toContain('chords');
  });

  it('correctly parses raw structured JSON from Vision AI output', () => {
    const rawOutput = JSON.stringify({
      chords: [
        { chord: 'C', xPercent: 18.2, yPercent: 20.5 },
        { chord: 'C/E', xPercent: 32.1, yPercent: 20.5 },
        { chord: 'F', xPercent: 45.0, yPercent: 20.6 },
        { chord: 'G', xPercent: 58.4, yPercent: 20.4 },
        { chord: 'Bb/C', xPercent: 72.0, yPercent: 35.0 },
      ],
    });

    const parsed = parseVisionChordsResponse(rawOutput);
    expect(parsed.length).toBe(5);
    expect(parsed[0].originalText).toBe('C');
    expect(parsed[0].x).toBe(18.2);
    expect(parsed[0].y).toBe(20.5);
    expect(parsed[1].originalText).toBe('C/E');
    expect(parsed[4].originalText).toBe('Bb/C');
  });

  it('handles markdown wrapped JSON responses from LLM', () => {
    const wrappedOutput = `\`\`\`json
    {
      "chords": [
        { "chord": "D/F#", "xPercent": 25.0, "yPercent": 15.0 },
        { "chord": "Gsus4", "xPercent": 50.0, "yPercent": 15.0 }
      ]
    }
    \`\`\``;

    const parsed = parseVisionChordsResponse(wrappedOutput);
    expect(parsed.length).toBe(2);
    expect(parsed[0].originalText).toBe('D/F#');
    expect(parsed[1].originalText).toBe('Gsus4');
  });

  it('filters out invalid or non-musical chord strings', () => {
    const mixedOutput = {
      chords: [
        { chord: 'Verse', xPercent: 10, yPercent: 10 },
        { chord: 'C', xPercent: 20, yPercent: 10 },
        { chord: '120', xPercent: 30, yPercent: 10 },
        { chord: 'Am', xPercent: 40, yPercent: 10 },
      ],
    };

    const parsed = parseVisionChordsResponse(mixedOutput);
    expect(parsed.length).toBe(2);
    expect(parsed.map(p => p.originalText)).toEqual(['C', 'Am']);
  });
});
