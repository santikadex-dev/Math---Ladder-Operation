import type { Difficulty, GameSettings, Operation, PublicQuestion, SecretAnswerKey } from '../types/game';

export interface GeneratedQuestionPair {
  publicQuestion: PublicQuestion;
  secretKey: SecretAnswerKey;
}

const OP_SYMBOLS: Record<Operation, string> = {
  ADD: '+',
  SUB: '−',
  MUL: '×',
  DIV: '÷',
};

function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function formatOperand(n: number, isSecond: boolean): string {
  if (n < 0) {
    const absStr = `−${Math.abs(n)}`;
    return isSecond ? `(${absStr})` : absStr;
  }
  return String(n);
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getEffectiveRanges(settings: GameSettings, effectiveDifficulty: Difficulty) {
  let aMin = Math.min(settings.operandAMin, settings.operandAMax);
  let aMax = Math.max(settings.operandAMin, settings.operandAMax);
  let bMin = Math.min(settings.operandBMin, settings.operandBMax);
  let bMax = Math.max(settings.operandBMin, settings.operandBMax);

  if (effectiveDifficulty === 'EASY') {
    aMin = Math.max(aMin, aMin < 0 ? -10 : 0);
    aMax = Math.min(aMax, 12);
    bMin = Math.max(bMin, bMin < 0 ? -8 : 0);
    bMax = Math.min(bMax, 12);
    // Prefer mostly positive numbers in EASY if positive range exists
    if (aMax > 0 && aMin < 0 && Math.random() < 0.75) {
      aMin = Math.max(0, aMin);
    }
    if (bMax > 0 && bMin < 0 && Math.random() < 0.75) {
      bMin = Math.max(0, bMin);
    }
  } else if (effectiveDifficulty === 'HARD') {
    // Encourage non-trivial values away from 0 and 1
    if (aMax - aMin > 10 && Math.random() < 0.75 && aMin < 0) {
      // Bias toward negative numbers or larger absolute values
      if (Math.random() < 0.5 && aMin <= -5) {
        aMax = Math.min(aMax, -2);
      } else if (aMax >= 5) {
        aMin = Math.max(aMin, 4);
      }
    }
    if (bMax - bMin > 10 && Math.random() < 0.75 && bMin < 0) {
      if (Math.random() < 0.5 && bMin <= -4) {
        bMax = Math.min(bMax, -2);
      } else if (bMax >= 4) {
        bMin = Math.max(bMin, 3);
      }
    }
  }

  if (aMin > aMax) aMin = aMax;
  if (bMin > bMax) bMin = bMax;

  return { aMin, aMax, bMin, bMax };
}

function generateDistractors(a: number, b: number, op: Operation, correct: number, settings: GameSettings): number[] {
  const candidates = new Set<number>();

  // Common student arithmetic misconceptions
  if (correct !== 0) candidates.add(-correct);
  if (op === 'ADD') {
    candidates.add(a - b);
    candidates.add(-(Math.abs(a) + Math.abs(b)));
    candidates.add(Math.abs(a) + Math.abs(b));
    candidates.add(Math.abs(a) - Math.abs(b));
  } else if (op === 'SUB') {
    candidates.add(a + b);
    candidates.add(b - a);
    candidates.add(-(Math.abs(a) + Math.abs(b)));
    candidates.add(correct + (b < 0 ? 2 * b : -2 * b));
  } else if (op === 'MUL') {
    candidates.add(a + b);
    candidates.add(correct + b);
    candidates.add(correct - b);
    candidates.add(correct + a);
  } else if (op === 'DIV') {
    candidates.add(correct + 1);
    candidates.add(correct - 1);
    candidates.add(-correct + 1);
    candidates.add(correct * 2);
  }

  // Filter out the correct answer and invalid negative answers if disallowed
  const validDistractors: number[] = [];
  for (const val of candidates) {
    if (
      Number.isInteger(val) &&
      val !== correct &&
      (settings.allowNegativeAnswers || val >= 0) &&
      (settings.allowZeroAnswer || val !== 0)
    ) {
      validDistractors.push(val);
    }
  }

  const chosen = new Set<number>(shuffleArray(validDistractors).slice(0, 3));

  let offset = 1;
  while (chosen.size < 3 && offset < 60) {
    const sign = Math.random() < 0.5 ? 1 : -1;
    const step = op === 'MUL' ? randomInt(1, 6) : offset;
    const candidate = correct + sign * step;
    if (
      candidate !== correct &&
      !chosen.has(candidate) &&
      (settings.allowNegativeAnswers || candidate >= 0) &&
      (settings.allowZeroAnswer || candidate !== 0)
    ) {
      chosen.add(candidate);
    }
    offset++;
  }

  return shuffleArray([correct, ...Array.from(chosen).slice(0, 3)]);
}

function tryBuildOperation(
  op: Operation,
  settings: GameSettings,
  effectiveDifficulty: Difficulty
): { a: number; b: number; answer: number } | null {
  const { aMin, aMax, bMin, bMax } = getEffectiveRanges(settings, effectiveDifficulty);

  for (let attempt = 0; attempt < 40; attempt++) {
    let a = randomInt(aMin, aMax);
    let b = randomInt(bMin, bMax);

    if (op === 'ADD') {
      const answer = a + b;
      if (!settings.allowNegativeAnswers && answer < 0) continue;
      if (!settings.allowZeroAnswer && answer === 0) continue;
      if (settings.avoidExcessivelyLargeAnswers && Math.abs(answer) > 500) continue;
      return { a, b, answer };
    }

    if (op === 'SUB') {
      const answer = a - b;
      if (!settings.allowNegativeAnswers && answer < 0) continue;
      if (!settings.allowZeroAnswer && answer === 0) continue;
      if (settings.avoidExcessivelyLargeAnswers && Math.abs(answer) > 500) continue;
      return { a, b, answer };
    }

    if (op === 'MUL') {
      if (effectiveDifficulty === 'EASY') {
        a = randomInt(Math.max(aMin, -9), Math.min(aMax, 10));
        b = randomInt(Math.max(bMin, -9), Math.min(bMax, 10));
      } else if (effectiveDifficulty === 'HARD') {
        if (Math.abs(a) <= 1 && aMax - aMin > 4) continue;
        if (Math.abs(b) <= 1 && bMax - bMin > 4) continue;
      }
      const answer = a * b;
      if (!settings.allowNegativeAnswers && answer < 0) continue;
      if (!settings.allowZeroAnswer && answer === 0) continue;
      if (settings.avoidExcessivelyLargeAnswers && Math.abs(answer) > 400) continue;
      return { a, b, answer };
    }

    if (op === 'DIV') {
      if (b === 0) continue;
      if (effectiveDifficulty === 'HARD' && Math.abs(b) === 1 && bMax - bMin > 4) continue;

      if (settings.restrictDivisionToInteger) {
        // Pick a valid quotient q such that a = b * q is within [aMin, aMax]
        const qMin = Math.ceil(Math.min(aMin / b, aMax / b));
        const qMax = Math.floor(Math.max(aMin / b, aMax / b));
        if (qMin > qMax) continue;

        const validQs: number[] = [];
        for (let q = Math.max(qMin, -20); q <= Math.min(qMax, 20); q++) {
          if (!settings.allowZeroAnswer && q === 0) continue;
          if (!settings.allowNegativeAnswers && q < 0) continue;
          if (effectiveDifficulty === 'HARD' && Math.abs(q) <= 1 && qMax - qMin > 4) continue;
          validQs.push(q);
        }
        if (validQs.length === 0) continue;
        const q = validQs[Math.floor(Math.random() * validQs.length)];
        a = b * q;
        return { a, b, answer: q };
      } else {
        if (a % b !== 0) continue;
        const answer = a / b;
        if (!settings.allowNegativeAnswers && answer < 0) continue;
        if (!settings.allowZeroAnswer && answer === 0) continue;
        return { a, b, answer };
      }
    }
  }

  return null;
}

export function pickBalancedOperation(
  operations: Operation[],
  indexSeed: number
): Operation {
  const ops = operations.length > 0 ? operations : (['ADD'] as Operation[]);
  return ops[indexSeed % ops.length];
}

export function generateQuestion(
  settings: GameSettings,
  options?: {
    operationHint?: Operation;
    usedPrompts?: Set<string>;
    isChallenge?: boolean;
  }
): GeneratedQuestionPair {
  const enabledOps: Operation[] = settings.operations.length > 0 ? settings.operations : ['ADD'];
  const effectiveDifficulty: Difficulty = options?.isChallenge ? 'HARD' : settings.difficulty;

  let chosenOp: Operation = options?.operationHint && enabledOps.includes(options.operationHint)
    ? options.operationHint
    : enabledOps[Math.floor(Math.random() * enabledOps.length)];

  let built: { a: number; b: number; answer: number } | null = null;
  let prompt = '';

  for (let roundTry = 0; roundTry < 16; roundTry++) {
    const candidateOp = roundTry === 0 ? chosenOp : enabledOps[(roundTry + Math.floor(Math.random() * enabledOps.length)) % enabledOps.length];
    const result = tryBuildOperation(candidateOp, settings, effectiveDifficulty);
    if (!result) continue;

    const candidatePrompt = `${formatOperand(result.a, false)} ${OP_SYMBOLS[candidateOp]} ${formatOperand(result.b, true)} = ?`;
    if (options?.usedPrompts && options.usedPrompts.has(candidatePrompt) && roundTry < 12) {
      continue;
    }

    chosenOp = candidateOp;
    built = result;
    prompt = candidatePrompt;
    break;
  }

  if (!built) {
    // Guaranteed safe fallback within integer arithmetic
    const a = randomInt(2, 15);
    const b = randomInt(1, 12);
    chosenOp = 'ADD';
    built = { a, b, answer: a + b };
    prompt = `${a} + ${b} = ?`;
  }

  if (options?.usedPrompts) {
    options.usedPrompts.add(prompt);
  }

  let answerMode: 'MULTIPLE_CHOICE' | 'DIRECT_INPUT' = 'MULTIPLE_CHOICE';
  if (settings.answerMode === 'DIRECT_INPUT') {
    answerMode = 'DIRECT_INPUT';
  } else if (settings.answerMode === 'MIXED') {
    answerMode = Math.random() < 0.5 ? 'MULTIPLE_CHOICE' : 'DIRECT_INPUT';
  }

  const mcOptions = answerMode === 'MULTIPLE_CHOICE'
    ? generateDistractors(built.a, built.b, chosenOp, built.answer, settings)
    : undefined;

  const hasNegative = built.a < 0 || built.b < 0 || built.answer < 0;
  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    publicQuestion: {
      id,
      prompt,
      operation: chosenOp,
      answerMode,
      options: mcOptions,
      hasNegative,
      isChallenge: Boolean(options?.isChallenge),
    },
    secretKey: {
      correctAnswer: built.answer,
      operation: chosenOp,
      hasNegative,
      isChallenge: Boolean(options?.isChallenge),
    },
  };
}
