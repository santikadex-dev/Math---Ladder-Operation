import type { BoardConfiguration, FinishRule, PenaltyType, SpecialTileType } from '../types/game';

export interface MovementResult {
  fromPosition: number;
  intermediatePosition: number;
  finalPosition: number;
  ladderTaken?: { start: number; end: number };
  snakeTaken?: { start: number; end: number };
  shieldBlocked: boolean;
  specialTileTriggered?: SpecialTileType;
  finished: boolean;
  exactFinishBlocked: boolean;
  feedbackMessage: string;
}

export function resolveMovement(params: {
  currentPosition: number;
  dice: number;
  isCorrect: boolean;
  isTimeout: boolean;
  penalty: PenaltyType;
  finishRule: FinishRule;
  hasShield: boolean;
  board: BoardConfiguration;
  isChallengeRound?: boolean;
}): MovementResult {
  const {
    currentPosition,
    dice,
    isCorrect,
    isTimeout,
    penalty,
    finishRule,
    hasShield,
    board,
    isChallengeRound,
  } = params;

  const targetFinish = board.boardSize;

  if (isTimeout) {
    return {
      fromPosition: currentPosition,
      intermediatePosition: currentPosition,
      finalPosition: currentPosition,
      shieldBlocked: false,
      finished: false,
      exactFinishBlocked: false,
      feedbackMessage: 'Waktu habis! Kamu tidak bergerak pada ronde ini.',
    };
  }

  if (!isCorrect) {
    let stepsBack = 0;
    if (penalty === 'BACK_1') stepsBack = 1;
    else if (penalty === 'BACK_2') stepsBack = 2;
    else if (penalty === 'BACK_3') stepsBack = 3;
    else if (penalty === 'BACK_BY_DICE') stepsBack = dice;

    if (stepsBack > 0 && hasShield) {
      return {
        fromPosition: currentPosition,
        intermediatePosition: currentPosition,
        finalPosition: currentPosition,
        shieldBlocked: true,
        finished: false,
        exactFinishBlocked: false,
        feedbackMessage: 'Belum tepat, tetapi Perisai melindungimu dari penalti mundur!',
      };
    }

    const nextPos = Math.max(1, currentPosition - stepsBack);
    const msg =
      stepsBack === 0
        ? 'Belum tepat. Kamu tetap di posisi.'
        : `Belum tepat. Kamu mundur ${currentPosition - nextPos} langkah ke petak ${nextPos}.`;

    return {
      fromPosition: currentPosition,
      intermediatePosition: nextPos,
      finalPosition: nextPos,
      shieldBlocked: false,
      finished: false,
      exactFinishBlocked: false,
      feedbackMessage: msg,
    };
  }

  // Correct answer movement
  const totalMove = dice + (isChallengeRound ? 2 : 0);
  const rawTarget = currentPosition + totalMove;

  if (rawTarget > targetFinish && finishRule === 'EXACT_FINISH') {
    return {
      fromPosition: currentPosition,
      intermediatePosition: currentPosition,
      finalPosition: currentPosition,
      shieldBlocked: false,
      finished: false,
      exactFinishBlocked: true,
      feedbackMessage: `Benar! Namun butuh angka dadu tepat (${targetFinish - currentPosition}) untuk mencapai petak ${targetFinish}.`,
    };
  }

  const intermediate = Math.min(targetFinish, rawTarget);
  let finalPosition = intermediate;
  let ladderTaken: { start: number; end: number } | undefined;
  let snakeTaken: { start: number; end: number } | undefined;
  let shieldBlocked = false;
  let specialTileTriggered: SpecialTileType | undefined;

  // Check ladder or snake (single transition, prevents infinite chains)
  const ladder = board.ladders.find((l) => l.start === intermediate);
  if (ladder) {
    ladderTaken = { start: ladder.start, end: ladder.end };
    finalPosition = ladder.end;
  } else {
    const snake = board.snakes.find((s) => s.start === intermediate);
    if (snake) {
      if (hasShield) {
        shieldBlocked = true;
      } else {
        snakeTaken = { start: snake.start, end: snake.end };
        finalPosition = snake.end;
      }
    }
  }

  // Check special tile at final position (only if not already finished)
  if (finalPosition < targetFinish) {
    const special = board.specialTiles[String(finalPosition)];
    if (special) {
      specialTileTriggered = special;
    }
  }

  const finished = finalPosition === targetFinish;

  let feedbackMessage = isChallengeRound
    ? `Luar biasa! Jawaban tantangan benar, kamu maju ${totalMove} langkah!`
    : `Benar! Kamu maju ${dice} langkah!`;

  if (finished) {
    feedbackMessage = `Selamat! Kamu mencapai petak ${targetFinish} dan menyelesaikan perlombaan!`;
  } else if (ladderTaken) {
    feedbackMessage = `Hebat! Kamu menemukan tangga dari petak ${ladderTaken.start} ke ${ladderTaken.end}!`;
  } else if (snakeTaken) {
    feedbackMessage = `Ups! Kamu terkena ular di petak ${snakeTaken.start} dan turun ke ${snakeTaken.end}.`;
  } else if (shieldBlocked) {
    feedbackMessage = `Perisaimu menahan serangan ular di petak ${intermediate}!`;
  } else if (specialTileTriggered === 'BONUS') {
    feedbackMessage += ' Petak Bonus: +15 XP & +25 Koin!';
  } else if (specialTileTriggered === 'SHIELD') {
    feedbackMessage += ' Petak Perisai: Kamu mendapat perlindungan 1 kali!';
  } else if (specialTileTriggered === 'DOUBLE_DICE') {
    feedbackMessage += ' Petak Dadu Ganda: Ronde depan lempar 2 dadu!';
  } else if (specialTileTriggered === 'CHALLENGE') {
    feedbackMessage += ' Petak Tantangan: Ronde depan ada soal ekstra berhadiah +2 langkah!';
  }

  return {
    fromPosition: currentPosition,
    intermediatePosition: intermediate,
    finalPosition,
    ladderTaken,
    snakeTaken,
    shieldBlocked,
    specialTileTriggered,
    finished,
    exactFinishBlocked: false,
    feedbackMessage,
  };
}
