/**
 * Greedy CTC decode used by PaddleOCR / PP-OCRv4 recognition CNNs.
 * Blank = 0; charset[i] is class i + 1.
 */

function rowLooksLikeSoftmax(logits: ArrayLike<number>, row: number, classCount: number): boolean {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let c = 0; c < classCount; c++) {
    const value = logits[row + c];
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }
  return min >= -1e-4 && max <= 1.02 && Math.abs(sum - 1) < 0.2;
}

function argmaxProb(
  logits: ArrayLike<number>,
  row: number,
  classCount: number
): { best: number; prob: number } {
  if (rowLooksLikeSoftmax(logits, row, classCount)) {
    let best = 0;
    let bestVal = logits[row];
    for (let c = 1; c < classCount; c++) {
      const value = logits[row + c];
      if (value > bestVal) {
        bestVal = value;
        best = c;
      }
    }
    return { best, prob: bestVal };
  }

  let maxLogit = -Infinity;
  for (let c = 0; c < classCount; c++) {
    const value = logits[row + c];
    if (value > maxLogit) maxLogit = value;
  }
  let sumExp = 0;
  let best = 0;
  let bestExp = -1;
  for (let c = 0; c < classCount; c++) {
    const e = Math.exp(logits[row + c] - maxLogit);
    sumExp += e;
    if (e > bestExp) {
      bestExp = e;
      best = c;
    }
  }
  return { best, prob: sumExp > 0 ? bestExp / sumExp : 0 };
}

export function greedyCtcDecode(
  logits: ArrayLike<number>,
  timeSteps: number,
  classCount: number,
  charset: readonly string[]
): { text: string; confidence: number } {
  if (timeSteps <= 0 || classCount <= 0) return { text: '', confidence: 0 };

  const chars: string[] = [];
  let prev = -1;
  let confSum = 0;
  let confCount = 0;

  for (let t = 0; t < timeSteps; t++) {
    const { best, prob } = argmaxProb(logits, t * classCount, classCount);
    if (best !== 0 && best !== prev) {
      const glyph = charset[best - 1];
      if (glyph !== undefined) chars.push(glyph);
      confSum += prob;
      confCount += 1;
    }
    prev = best;
  }

  return {
    text: chars.join('').trim(),
    confidence: confCount ? confSum / confCount : 0,
  };
}
