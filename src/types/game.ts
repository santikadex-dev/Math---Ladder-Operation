export type Operation = 'ADD' | 'SUB' | 'MUL' | 'DIV';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type AnswerMode = 'MULTIPLE_CHOICE' | 'DIRECT_INPUT' | 'MIXED';
export type PenaltyType = 'STAY' | 'BACK_1' | 'BACK_2' | 'BACK_3' | 'BACK_BY_DICE';
export type FinishRule = 'EXACT_FINISH' | 'OVERSHOOT_ALLOWED';
export type GameEndRule = 'AFTER_ROUNDS' | 'FIRST_FINISH' | 'ALL_FINISH';
export type LateJoinRule = 'REJECT' | 'ALLOW_AT_START';
export type NextRoundMode = 'AUTO' | 'MANUAL';
export type DiceMode = 'STANDARD_1D6' | 'TURBO_2D6';
export type SpecialTileType = 'BONUS' | 'CHALLENGE' | 'DOUBLE_DICE' | 'SHIELD';

export type RoomStatus = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'FINISHED';
export type RoundStatus = 'ACTIVE' | 'RESOLVED';
export type PlayerStatus = 'READY' | 'PLAYING' | 'FINISHED' | 'REMOVED';
export type AppMode = 'REAL' | 'DEMO';

export interface GameSettings {
  operations: Operation[];
  operandAMin: number;
  operandAMax: number;
  operandBMin: number;
  operandBMax: number;
  allowNegativeAnswers: boolean;
  allowZeroAnswer: boolean;
  restrictDivisionToInteger: boolean;
  avoidExcessivelyLargeAnswers: boolean;
  difficulty: Difficulty;
  answerMode: AnswerMode;
  allowRetry: boolean;
  totalRounds: number;
  answerTimerSec: number;
  wrongPenalty: PenaltyType;
  diceMode: DiceMode;
  boardSize: 100 | 64;
  enableSnakesAndLadders: boolean;
  snakeCount: number;
  ladderCount: number;
  randomizeBoard: boolean;
  enableBonusTiles: boolean;
  enableChallengeTiles: boolean;
  enableDoubleDiceTiles: boolean;
  enableShieldTiles: boolean;
  finishRule: FinishRule;
  gameEndRule: GameEndRule;
  allowLateJoin: boolean;
  nextRoundMode: NextRoundMode;
}

export interface SnakeOrLadder {
  id: string;
  start: number;
  end: number;
  type: 'LADDER' | 'SNAKE';
}

export interface BoardConfiguration {
  boardSize: 100 | 64;
  ladders: SnakeOrLadder[];
  snakes: SnakeOrLadder[];
  specialTiles: Record<string, SpecialTileType>;
}

export interface AvatarOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgClass: string;
  ringClass: string;
}

export interface OperationStat {
  attempted: number;
  correct: number;
}

export interface PlayerOutcome {
  roundNumber: number;
  dice: number;
  submittedAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  isTimeout: boolean;
  fromPosition: number;
  toPosition: number;
  ladderTo?: number;
  snakeTo?: number;
  shieldBlocked?: boolean;
  specialTileTriggered?: SpecialTileType;
  xpEarned: number;
  goldEarned: number;
  message: string;
}

export interface Player {
  playerId: string;
  roomId: string;
  displayName: string;
  avatar: string;
  color: string;
  position: number;
  xp: number;
  level: number;
  gold: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeoutCount: number;
  streak: number;
  bestStreak: number;
  accuracy: number;
  laddersClimbed: number;
  snakesEncountered: number;
  status: PlayerStatus;
  connected: boolean;
  finished: boolean;
  finishedRound?: number;
  shield: boolean;
  doubleDiceNext: boolean;
  joinedAt: unknown;
  lastSeenAt: unknown;
  lastOutcome?: PlayerOutcome;
  operationStats?: Record<Operation, OperationStat>;
  negativeStats?: OperationStat;
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  operation: Operation;
  answerMode: 'MULTIPLE_CHOICE' | 'DIRECT_INPUT';
  options?: number[];
  hasNegative: boolean;
  isChallenge?: boolean;
}

export interface SecretAnswerKey {
  correctAnswer: number;
  operation: Operation;
  hasNegative: boolean;
  isChallenge?: boolean;
}

export interface RoundEvent {
  id: string;
  playerId: string;
  playerName: string;
  avatar: string;
  type: 'MOVE' | 'LADDER' | 'SNAKE' | 'BONUS' | 'CHALLENGE' | 'SHIELD' | 'DOUBLE_DICE' | 'FINISH' | 'TIMEOUT' | 'WRONG';
  text: string;
  timestamp: number;
}

export interface RoundSummary {
  roundNumber: number;
  correctCount: number;
  incorrectCount: number;
  timeoutCount: number;
  movedCount: number;
  laddersClimbedCount: number;
  snakesSlidCount: number;
  finishedCount: number;
  revealedAnswers: Record<string, number>;
  events: RoundEvent[];
}

export interface Round {
  roundNumber: number;
  roomId: string;
  status: RoundStatus;
  startedAt: unknown;
  deadlineAt: number;
  diceResults: Record<string, number>;
  questions: Record<string, PublicQuestion>;
  resultSummary?: RoundSummary | null;
}

export interface RoundSecret {
  roundNumber: number;
  roomId: string;
  answers: Record<string, SecretAnswerKey>;
}

export interface AnswerSubmission {
  playerId: string;
  teacherId: string;
  roomId: string;
  roundId: string;
  submittedAnswer: number;
  isCorrect?: boolean;
  correctAnswer?: number;
  responseTimeMs?: number;
  submittedAt: unknown;
}

export interface Room {
  roomCode: string;
  teacherId: string;
  teacherName: string;
  title: string;
  status: RoomStatus;
  settings: GameSettings;
  boardConfiguration: BoardConfiguration;
  currentRound: number;
  locked: boolean;
  playerCount: number;
  createdAt: unknown;
  updatedAt: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
}
