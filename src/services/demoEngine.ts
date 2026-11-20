import { AVATARS, DEMO_BOT_PROFILES } from '../constants/gameDefaults';
import { generateBoardConfiguration } from '../engine/boardEngine';
import { rollDice } from '../engine/diceEngine';
import { resolveMovement } from '../engine/movementEngine';
import { generateQuestion, pickBalancedOperation } from '../engine/questionGenerator';
import { calculatePlayerScore } from '../engine/scoringEngine';
import type {
  BoardConfiguration,
  GameSettings,
  Player,
  PublicQuestion,
  Room,
  Round,
  RoundEvent,
  SecretAnswerKey,
} from '../types/game';

export interface DemoSessionState {
  room: Room;
  players: Player[];
  rounds: Round[];
  activeSecrets: Record<string, SecretAnswerKey>;
  humanSubmittedAnswer: number | null;
  humanSubmittedAtMs: number | null;
  botAnswers: Record<string, { answer: number; timeMs: number }>;
  eventsFeed: RoundEvent[];
}

export const DEMO_HUMAN_ID = 'demo_you';

export function createInitialDemoSession(
  settings: GameSettings,
  boardConfig?: BoardConfiguration,
  humanName = 'Kamu (Siswa Demo)',
  humanAvatarId = 'unicorn'
): DemoSessionState {
  const board = boardConfig ?? generateBoardConfiguration(settings);
  const now = Date.now();
  const roomCode = 'DEMO-RACE';

  const humanAvatar = AVATARS.find((a) => a.id === humanAvatarId) ?? AVATARS[9];
  const humanPlayer: Player = {
    playerId: DEMO_HUMAN_ID,
    roomId: roomCode,
    displayName: humanName,
    avatar: humanAvatar.id,
    color: humanAvatar.color,
    position: 1,
    xp: 0,
    level: 1,
    gold: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    timeoutCount: 0,
    streak: 0,
    bestStreak: 0,
    accuracy: 0,
    laddersClimbed: 0,
    snakesEncountered: 0,
    status: 'READY',
    connected: true,
    finished: false,
    shield: false,
    doubleDiceNext: false,
    joinedAt: now,
    lastSeenAt: now,
  };

  const botPlayers: Player[] = DEMO_BOT_PROFILES.map((bot) => {
    const av = AVATARS.find((a) => a.id === bot.avatar) ?? AVATARS[0];
    return {
      playerId: bot.id,
      roomId: roomCode,
      displayName: bot.name,
      avatar: av.id,
      color: av.color,
      position: 1,
      xp: 0,
      level: 1,
      gold: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      timeoutCount: 0,
      streak: 0,
      bestStreak: 0,
      accuracy: 0,
      laddersClimbed: 0,
      snakesEncountered: 0,
      status: 'READY',
      connected: true,
      finished: false,
      shield: false,
      doubleDiceNext: false,
      joinedAt: now,
      lastSeenAt: now,
    };
  });

  const players = [humanPlayer, ...botPlayers];

  const room: Room = {
    roomCode,
    teacherId: 'demo_teacher',
    teacherName: 'Guru Demo',
    title: 'Mode Simulasi Kelas (DEMO MODE)',
    status: 'WAITING',
    settings,
    boardConfiguration: board,
    currentRound: 0,
    locked: false,
    playerCount: players.length,
    createdAt: now,
    updatedAt: now,
  };

  return {
    room,
    players,
    rounds: [],
    activeSecrets: {},
    humanSubmittedAnswer: null,
    humanSubmittedAtMs: null,
    botAnswers: {},
    eventsFeed: [],
  };
}

export function startDemoRound(state: DemoSessionState, usedPrompts: Set<string>): DemoSessionState {
  const nextNum = state.room.currentRound + 1;
  const activePlayers = state.players.filter((p) => !p.finished && p.status !== 'REMOVED');
  if (activePlayers.length === 0) {
    return {
      ...state,
      room: { ...state.room, status: 'FINISHED' },
    };
  }

  const diceResults: Record<string, number> = {};
  const questions: Record<string, PublicQuestion> = {};
  const activeSecrets: Record<string, SecretAnswerKey> = {};
  const botAnswers: Record<string, { answer: number; timeMs: number }> = {};

  activePlayers.forEach((player, idx) => {
    diceResults[player.playerId] = rollDice(state.room.settings.diceMode, player.doubleDiceNext);
    const isChallenge = state.room.boardConfiguration.specialTiles[String(player.position)] === 'CHALLENGE';
    const opHint = pickBalancedOperation(state.room.settings.operations, nextNum + idx);
    const { publicQuestion, secretKey } = generateQuestion(state.room.settings, {
      operationHint: opHint,
      usedPrompts,
      isChallenge,
    });
    questions[player.playerId] = publicQuestion;
    activeSecrets[player.playerId] = secretKey;

    if (player.playerId !== DEMO_HUMAN_ID) {
      const profile = DEMO_BOT_PROFILES.find((b) => b.id === player.playerId);
      const skill = profile?.skill ?? 0.72;
      const roll = Math.random();
      if (roll < 0.06) {
        // Occasional realistic timeout
      } else if (roll < skill) {
        botAnswers[player.playerId] = {
          answer: secretKey.correctAnswer,
          timeMs: Math.round(1800 + Math.random() * 5500),
        };
      } else {
        const wrong =
          publicQuestion.options?.find((o) => o !== secretKey.correctAnswer) ??
          secretKey.correctAnswer + (Math.random() < 0.5 ? 2 : -3);
        botAnswers[player.playerId] = {
          answer: wrong,
          timeMs: Math.round(2500 + Math.random() * 6500),
        };
      }
    }
  });

  const now = Date.now();
  const round: Round = {
    roundNumber: nextNum,
    roomId: state.room.roomCode,
    status: 'ACTIVE',
    startedAt: now,
    deadlineAt: now + state.room.settings.answerTimerSec * 1000,
    diceResults,
    questions,
  };

  return {
    ...state,
    room: {
      ...state.room,
      status: 'PLAYING',
      currentRound: nextNum,
      updatedAt: now,
    },
    rounds: [...state.rounds, round],
    activeSecrets,
    humanSubmittedAnswer: null,
    humanSubmittedAtMs: null,
    botAnswers,
  };
}

export function resolveDemoRound(state: DemoSessionState): DemoSessionState {
  const currentRound = state.rounds[state.rounds.length - 1];
  if (!currentRound || currentRound.status === 'RESOLVED') return state;

  const roundStartMs = typeof currentRound.startedAt === 'number' ? currentRound.startedAt : Date.now() - 5000;
  let correctCount = 0;
  let incorrectCount = 0;
  let timeoutCount = 0;
  let movedCount = 0;
  let laddersClimbedCount = 0;
  let snakesSlidCount = 0;
  let finishedCount = 0;
  const revealedAnswers: Record<string, number> = {};
  const events: RoundEvent[] = [];

  let newFinisherOccurred = false;
  let allFinishedNow = true;

  const updatedPlayers = state.players.map((player) => {
    if (player.finished || player.status === 'REMOVED') return player;
    const secret = state.activeSecrets[player.playerId];
    if (!secret) return player;
    revealedAnswers[player.playerId] = secret.correctAnswer;

    const dice = currentRound.diceResults[player.playerId] ?? 1;
    let submitted: number | null = null;
    let responseTimeMs = state.room.settings.answerTimerSec * 1000;

    if (player.playerId === DEMO_HUMAN_ID) {
      submitted = state.humanSubmittedAnswer;
      if (state.humanSubmittedAtMs) {
        responseTimeMs = Math.max(200, state.humanSubmittedAtMs - roundStartMs);
      }
    } else {
      const botAns = state.botAnswers[player.playerId];
      if (botAns) {
        submitted = botAns.answer;
        responseTimeMs = botAns.timeMs;
      }
    }

    const isTimeout = submitted === null;
    const isCorrect = submitted !== null && submitted === secret.correctAnswer;

    if (isTimeout) timeoutCount++;
    else if (isCorrect) correctCount++;
    else incorrectCount++;

    const movement = resolveMovement({
      currentPosition: player.position,
      dice,
      isCorrect,
      isTimeout,
      penalty: state.room.settings.wrongPenalty,
      finishRule: state.room.settings.finishRule,
      hasShield: player.shield,
      board: state.room.boardConfiguration,
      isChallengeRound: Boolean(secret.isChallenge),
    });

    if (movement.finalPosition !== player.position) movedCount++;
    if (movement.ladderTaken) laddersClimbedCount++;
    if (movement.snakeTaken) snakesSlidCount++;
    if (movement.finished) {
      finishedCount++;
      newFinisherOccurred = true;
    } else {
      allFinishedNow = false;
    }

    const scoreDelta = calculatePlayerScore({
      currentXp: player.xp,
      currentGold: player.gold,
      currentStreak: player.streak,
      bestStreak: player.bestStreak,
      correctAnswers: player.correctAnswers,
      incorrectAnswers: player.incorrectAnswers,
      timeoutCount: player.timeoutCount,
      operationStats: player.operationStats,
      negativeStats: player.negativeStats,
      isCorrect,
      isTimeout,
      responseTimeMs,
      operation: secret.operation,
      hasNegative: secret.hasNegative,
      specialTile: movement.specialTileTriggered,
    });

    const nextShield =
      movement.specialTileTriggered === 'SHIELD'
        ? true
        : movement.shieldBlocked
        ? false
        : player.shield;

    const nextDoubleDice = movement.specialTileTriggered === 'DOUBLE_DICE';

    if (movement.finished) {
      events.push({
        id: `d_${currentRound.roundNumber}_${player.playerId}_fin`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'FINISH',
        text: `${player.displayName} mencapai petak ${state.room.boardConfiguration.boardSize} dan FINISH!`,
        timestamp: Date.now(),
      });
    } else if (movement.ladderTaken) {
      events.push({
        id: `d_${currentRound.roundNumber}_${player.playerId}_lad`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'LADDER',
        text: `${player.displayName} naik tangga ${movement.ladderTaken.start} → ${movement.ladderTaken.end}!`,
        timestamp: Date.now(),
      });
    } else if (movement.snakeTaken) {
      events.push({
        id: `d_${currentRound.roundNumber}_${player.playerId}_snk`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'SNAKE',
        text: `${player.displayName} turun ular ${movement.snakeTaken.start} → ${movement.snakeTaken.end}`,
        timestamp: Date.now(),
      });
    } else if (isCorrect && movement.finalPosition > movement.fromPosition) {
      events.push({
        id: `d_${currentRound.roundNumber}_${player.playerId}_mov`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'MOVE',
        text: `${player.displayName} maju ke petak ${movement.finalPosition}`,
        timestamp: Date.now(),
      });
    }

    return {
      ...player,
      position: movement.finalPosition,
      xp: scoreDelta.newXp,
      level: scoreDelta.newLevel,
      gold: scoreDelta.newGold,
      correctAnswers: scoreDelta.newCorrect,
      incorrectAnswers: scoreDelta.newIncorrect,
      timeoutCount: scoreDelta.newTimeout,
      streak: scoreDelta.newStreak,
      bestStreak: scoreDelta.newBestStreak,
      accuracy: scoreDelta.newAccuracy,
      laddersClimbed: player.laddersClimbed + (movement.ladderTaken ? 1 : 0),
      snakesEncountered: player.snakesEncountered + (movement.snakeTaken ? 1 : 0),
      status: movement.finished ? ('FINISHED' as const) : ('PLAYING' as const),
      finished: movement.finished,
      finishedRound: movement.finished ? currentRound.roundNumber : player.finishedRound,
      shield: nextShield,
      doubleDiceNext: nextDoubleDice,
      operationStats: scoreDelta.newOperationStats,
      negativeStats: scoreDelta.newNegativeStats,
      lastOutcome: {
        roundNumber: currentRound.roundNumber,
        dice,
        submittedAnswer: submitted,
        correctAnswer: secret.correctAnswer,
        isCorrect,
        isTimeout,
        fromPosition: movement.fromPosition,
        toPosition: movement.finalPosition,
        ladderTo: movement.ladderTaken?.end,
        snakeTo: movement.snakeTaken?.end,
        shieldBlocked: movement.shieldBlocked,
        specialTileTriggered: movement.specialTileTriggered,
        xpEarned: scoreDelta.xpEarned,
        goldEarned: scoreDelta.goldEarned,
        message: movement.feedbackMessage,
      },
    };
  });

  const resolvedRound: Round = {
    ...currentRound,
    status: 'RESOLVED',
    resultSummary: {
      roundNumber: currentRound.roundNumber,
      correctCount,
      incorrectCount,
      timeoutCount,
      movedCount,
      laddersClimbedCount,
      snakesSlidCount,
      finishedCount,
      revealedAnswers,
      events: events.slice(0, 12),
    },
  };

  const previouslyFinished = state.players.some((p) => p.finished);
  const reachedMaxRounds = currentRound.roundNumber >= state.room.settings.totalRounds;
  const shouldEnd =
    (state.room.settings.gameEndRule === 'FIRST_FINISH' && (newFinisherOccurred || previouslyFinished)) ||
    (state.room.settings.gameEndRule === 'ALL_FINISH' && allFinishedNow) ||
    reachedMaxRounds;

  return {
    ...state,
    room: {
      ...state.room,
      status: shouldEnd ? 'FINISHED' : state.room.status,
      finishedAt: shouldEnd ? Date.now() : state.room.finishedAt,
    },
    players: updatedPlayers,
    rounds: [...state.rounds.slice(0, -1), resolvedRound],
    eventsFeed: [...events, ...state.eventsFeed].slice(0, 20),
  };
}
