import type { AvatarOption, GameSettings, SnakeOrLadder } from '../types/game';

export const DEFAULT_LADDERS_100: SnakeOrLadder[] = [
  { id: 'L1', start: 4, end: 14, type: 'LADDER' },
  { id: 'L2', start: 9, end: 31, type: 'LADDER' },
  { id: 'L3', start: 20, end: 38, type: 'LADDER' },
  { id: 'L4', start: 28, end: 46, type: 'LADDER' },
  { id: 'L5', start: 40, end: 59, type: 'LADDER' },
  { id: 'L6', start: 63, end: 81, type: 'LADDER' },
  { id: 'L7', start: 71, end: 91, type: 'LADDER' },
];

export const DEFAULT_SNAKES_100: SnakeOrLadder[] = [
  { id: 'S1', start: 17, end: 7, type: 'SNAKE' },
  { id: 'S2', start: 34, end: 19, type: 'SNAKE' },
  { id: 'S3', start: 54, end: 34, type: 'SNAKE' },
  { id: 'S4', start: 62, end: 43, type: 'SNAKE' },
  { id: 'S5', start: 87, end: 66, type: 'SNAKE' },
  { id: 'S6', start: 95, end: 72, type: 'SNAKE' },
  { id: 'S7', start: 99, end: 78, type: 'SNAKE' },
];

export const DEFAULT_SETTINGS: GameSettings = {
  operations: ['ADD', 'SUB', 'MUL', 'DIV'],
  operandAMin: -20,
  operandAMax: 20,
  operandBMin: -20,
  operandBMax: 20,
  allowNegativeAnswers: true,
  allowZeroAnswer: true,
  restrictDivisionToInteger: true,
  avoidExcessivelyLargeAnswers: true,
  difficulty: 'NORMAL',
  answerMode: 'MULTIPLE_CHOICE',
  allowRetry: false,
  totalRounds: 15,
  answerTimerSec: 15,
  wrongPenalty: 'STAY',
  diceMode: 'STANDARD_1D6',
  boardSize: 100,
  enableSnakesAndLadders: true,
  snakeCount: 7,
  ladderCount: 7,
  randomizeBoard: false,
  enableBonusTiles: true,
  enableChallengeTiles: true,
  enableDoubleDiceTiles: true,
  enableShieldTiles: true,
  finishRule: 'EXACT_FINISH',
  gameEndRule: 'AFTER_ROUNDS',
  allowLateJoin: false,
  nextRoundMode: 'AUTO',
};

export const AVATARS: AvatarOption[] = [
  { id: 'phoenix', name: 'Phoenix', emoji: '🦅', color: '#E11D48', bgClass: 'bg-rose-500', ringClass: 'ring-rose-300' },
  { id: 'dragon', name: 'Naga', emoji: '🐉', color: '#059669', bgClass: 'bg-emerald-600', ringClass: 'ring-emerald-300' },
  { id: 'wizard', name: 'Penyihir', emoji: '🧙', color: '#2563EB', bgClass: 'bg-blue-600', ringClass: 'ring-blue-300' },
  { id: 'knight', name: 'Ksatria', emoji: '🛡️', color: '#D97706', bgClass: 'bg-amber-600', ringClass: 'ring-amber-300' },
  { id: 'fox', name: 'Rubah', emoji: '🦊', color: '#EA580C', bgClass: 'bg-orange-600', ringClass: 'ring-orange-300' },
  { id: 'owl', name: 'Burung Hantu', emoji: '🦉', color: '#7C3AED', bgClass: 'bg-violet-600', ringClass: 'ring-violet-300' },
  { id: 'tiger', name: 'Harimau', emoji: '🐯', color: '#CA8A04', bgClass: 'bg-yellow-600', ringClass: 'ring-yellow-300' },
  { id: 'dolphin', name: 'Lumba-lumba', emoji: '🐬', color: '#0891B2', bgClass: 'bg-cyan-600', ringClass: 'ring-cyan-300' },
  { id: 'wolf', name: 'Serigala', emoji: '🐺', color: '#475569', bgClass: 'bg-slate-600', ringClass: 'ring-slate-300' },
  { id: 'unicorn', name: 'Unicorn', emoji: '🦄', color: '#DB2777', bgClass: 'bg-pink-600', ringClass: 'ring-pink-300' },
  { id: 'panda', name: 'Panda', emoji: '🐼', color: '#0D9488', bgClass: 'bg-teal-600', ringClass: 'ring-teal-300' },
  { id: 'lion', name: 'Singa', emoji: '🦁', color: '#B45309', bgClass: 'bg-amber-700', ringClass: 'ring-amber-300' },
];

export const XP_REWARDS = {
  CORRECT_BASE: 10,
  FAST_BONUS: 5,
  FAST_THRESHOLD_MS: 5000,
  STREAK_3_BONUS: 10,
  STREAK_5_BONUS: 20,
  BONUS_TILE_XP: 15,
  BONUS_TILE_GOLD: 25,
  GOLD_PER_CORRECT: 10,
};

export const DEMO_BOT_PROFILES = [
  { id: 'bot_alya', name: 'Alya Putri', avatar: 'owl', skill: 0.88 },
  { id: 'bot_bima', name: 'Bima Sakti', avatar: 'dragon', skill: 0.78 },
  { id: 'bot_citra', name: 'Citra Dewi', avatar: 'phoenix', skill: 0.82 },
  { id: 'bot_dimas', name: 'Dimas Pratama', avatar: 'knight', skill: 0.65 },
  { id: 'bot_eka', name: 'Eka Wijaya', avatar: 'fox', skill: 0.72 },
  { id: 'bot_farhan', name: 'Farhan Aziz', avatar: 'wizard', skill: 0.58 },
];
