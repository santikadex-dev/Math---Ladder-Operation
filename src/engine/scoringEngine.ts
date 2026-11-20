import { XP_REWARDS } from '../constants/gameDefaults';
import type { Operation, OperationStat, SpecialTileType } from '../types/game';

export interface ScoreDelta {
  xpEarned: number;
  goldEarned: number;
  newXp: number;
  newLevel: number;
  newGold: number;
  newStreak: number;
  newBestStreak: number;
  newCorrect: number;
  newIncorrect: number;
  newTimeout: number;
  newAccuracy: number;
  newOperationStats: Record<Operation, OperationStat>;
  newNegativeStats: OperationStat;
}

const DEFAULT_OP_STATS = (): Record<Operation, OperationStat> => ({
  ADD: { attempted: 0, correct: 0 },
  SUB: { attempted: 0, correct: 0 },
  MUL: { attempted: 0, correct: 0 },
  DIV: { attempted: 0, correct: 0 },
});

export function calculatePlayerScore(params: {
  currentXp: number;
  currentGold: number;
  currentStreak: number;
  bestStreak: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeoutCount: number;
  operationStats?: Record<Operation, OperationStat>;
  negativeStats?: OperationStat;
  isCorrect: boolean;
  isTimeout: boolean;
  responseTimeMs: number;
  operation: Operation;
  hasNegative: boolean;
  specialTile?: SpecialTileType;
}): ScoreDelta {
  const opStats: Record<Operation, OperationStat> = params.operationStats
    ? {
        ADD: { ...params.operationStats.ADD },
        SUB: { ...params.operationStats.SUB },
        MUL: { ...params.operationStats.MUL },
        DIV: { ...params.operationStats.DIV },
      }
    : DEFAULT_OP_STATS();

  const negStats: OperationStat = params.negativeStats
    ? { ...params.negativeStats }
    : { attempted: 0, correct: 0 };

  opStats[params.operation].attempted += 1;
  if (params.hasNegative) {
    negStats.attempted += 1;
  }

  let xpEarned = 0;
  let goldEarned = 0;
  let newStreak = params.currentStreak;
  let newCorrect = params.correctAnswers;
  let newIncorrect = params.incorrectAnswers;
  let newTimeout = params.timeoutCount;

  if (params.isTimeout) {
    newStreak = 0;
    newTimeout += 1;
  } else if (params.isCorrect) {
    newCorrect += 1;
    newStreak += 1;
    opStats[params.operation].correct += 1;
    if (params.hasNegative) {
      negStats.correct += 1;
    }

    xpEarned += XP_REWARDS.CORRECT_BASE;
    goldEarned += XP_REWARDS.GOLD_PER_CORRECT;

    if (params.responseTimeMs > 0 && params.responseTimeMs <= XP_REWARDS.FAST_THRESHOLD_MS) {
      xpEarned += XP_REWARDS.FAST_BONUS;
    }

    if (newStreak > 0 && newStreak % 5 === 0) {
      xpEarned += XP_REWARDS.STREAK_5_BONUS;
    } else if (newStreak > 0 && newStreak % 3 === 0) {
      xpEarned += XP_REWARDS.STREAK_3_BONUS;
    }
  } else {
    newStreak = 0;
    newIncorrect += 1;
  }

  if (params.specialTile === 'BONUS') {
    xpEarned += XP_REWARDS.BONUS_TILE_XP;
    goldEarned += XP_REWARDS.BONUS_TILE_GOLD;
  }

  const newXp = params.currentXp + xpEarned;
  const newGold = params.currentGold + goldEarned;
  const newLevel = 1 + Math.floor(newXp / 100);
  const newBestStreak = Math.max(params.bestStreak, newStreak);
  const totalAnswered = newCorrect + newIncorrect + newTimeout;
  const newAccuracy = totalAnswered > 0 ? Math.round((newCorrect / totalAnswered) * 100) : 0;

  return {
    xpEarned,
    goldEarned,
    newXp,
    newLevel,
    newGold,
    newStreak,
    newBestStreak,
    newCorrect,
    newIncorrect,
    newTimeout,
    newAccuracy,
    newOperationStats: opStats,
    newNegativeStats: negStats,
  };
}
