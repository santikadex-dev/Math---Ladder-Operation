import { AVATARS, DEMO_BOT_PROFILES } from '../constants/gameDefaults';
import { generateBoardConfiguration } from '../engine/boardEngine';
import { rollDice } from '../engine/diceEngine';
import { resolveMovement } from '../engine/movementEngine';
import { generateQuestion, pickBalancedOperation } from '../engine/questionGenerator';
import { calculatePlayerScore } from '../engine/scoringEngine';
import type {
  AnswerSubmission,
  BoardConfiguration,
  GameSettings,
  Player,
  PublicQuestion,
  Room,
  Round,
  RoundEvent,
  SecretAnswerKey,
} from '../types/game';

export interface DemoHumanAnswerRecord {
  submittedAnswer: number;
  isCorrect: boolean;
  correctAnswer: number;
  submittedAtMs: number;
  responseTimeMs: number;
}

export interface DemoSessionState {
  room: Room;
  players: Player[];
  rounds: Round[];
  humanCurrentRound: number;
  secretsByRound: Record<number, Record<string, SecretAnswerKey>>;
  humanAnswersByRound: Record<number, DemoHumanAnswerRecord>;
  botAnswersByRound: Record<number, Record<string, { answer: number; timeMs: number }>>;
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
    humanCurrentRound: 1,
    secretsByRound: {},
    humanAnswersByRound: {},
    botAnswersByRound: {},
    eventsFeed: [],
  };
}

function buildPlayerRoundEntry(
  player: Player,
  roundNum: number,
  playerOffset: number,
  room: Room,
  usedPrompts: Set<string>
): { dice: number; publicQuestion: PublicQuestion; secretKey: SecretAnswerKey } {
  const dice = rollDice(room.settings.diceMode, player.doubleDiceNext);
  const isChallenge = room.boardConfiguration.specialTiles[String(player.position)] === 'CHALLENGE';
  const opHint = pickBalancedOperation(room.settings.operations, roundNum + playerOffset);
  const { publicQuestion, secretKey } = generateQuestion(room.settings, {
    operationHint: opHint,
    usedPrompts,
    isChallenge,
  });
  return { dice, publicQuestion, secretKey };
}

function ensureRoundForHuman(
  state: DemoSessionState,
  roundNum: number,
  humanPlayer: Player,
  usedPrompts: Set<string>
): { rounds: Round[]; secretsByRound: Record<number, Record<string, SecretAnswerKey>> } {
  if (roundNum > state.room.settings.totalRounds || humanPlayer.finished) {
    return { rounds: state.rounds, secretsByRound: state.secretsByRound };
  }

  const existingIdx = state.rounds.findIndex((r) => r.roundNumber === roundNum);
  const existingRound = existingIdx >= 0 ? state.rounds[existingIdx] : null;
  if (existingRound && existingRound.questions[DEMO_HUMAN_ID]) {
    return { rounds: state.rounds, secretsByRound: state.secretsByRound };
  }

  const entry = buildPlayerRoundEntry(humanPlayer, roundNum, 0, state.room, usedPrompts);
  const now = Date.now();

  const updatedRound: Round = existingRound
    ? {
        ...existingRound,
        diceResults: { ...existingRound.diceResults, [DEMO_HUMAN_ID]: entry.dice },
        questions: { ...existingRound.questions, [DEMO_HUMAN_ID]: entry.publicQuestion },
      }
    : {
        roundNumber: roundNum,
        roomId: state.room.roomCode,
        status: 'ACTIVE',
        startedAt: now,
        deadlineAt: now + state.room.settings.answerTimerSec * 1000,
        diceResults: { [DEMO_HUMAN_ID]: entry.dice },
        questions: { [DEMO_HUMAN_ID]: entry.publicQuestion },
      };

  const nextRounds =
    existingIdx >= 0
      ? state.rounds.map((r, i) => (i === existingIdx ? updatedRound : r))
      : [...state.rounds, updatedRound].sort((a, b) => a.roundNumber - b.roundNumber);

  const nextSecrets = {
    ...state.secretsByRound,
    [roundNum]: {
      ...(state.secretsByRound[roundNum] ?? {}),
      [DEMO_HUMAN_ID]: entry.secretKey,
    },
  };

  return { rounds: nextRounds, secretsByRound: nextSecrets };
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

  const existingIdx = state.rounds.findIndex((r) => r.roundNumber === nextNum);
  const existingRound = existingIdx >= 0 ? state.rounds[existingIdx] : null;

  const diceResults: Record<string, number> = { ...(existingRound?.diceResults ?? {}) };
  const questions: Record<string, PublicQuestion> = { ...(existingRound?.questions ?? {}) };
  const roundSecrets: Record<string, SecretAnswerKey> = { ...(state.secretsByRound[nextNum] ?? {}) };
  const botAnswers: Record<string, { answer: number; timeMs: number }> = {
    ...(state.botAnswersByRound[nextNum] ?? {}),
  };

  activePlayers.forEach((player, idx) => {
    if (!questions[player.playerId] || !roundSecrets[player.playerId]) {
      const entry = buildPlayerRoundEntry(player, nextNum, idx, state.room, usedPrompts);
      diceResults[player.playerId] = entry.dice;
      questions[player.playerId] = entry.publicQuestion;
      roundSecrets[player.playerId] = entry.secretKey;
    }

    if (player.playerId !== DEMO_HUMAN_ID && !botAnswers[player.playerId]) {
      const secretKey = roundSecrets[player.playerId];
      const publicQuestion = questions[player.playerId];
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
    startedAt: existingRound?.startedAt ?? now,
    deadlineAt: now + state.room.settings.answerTimerSec * 1000,
    diceResults,
    questions,
  };

  const nextRounds =
    existingIdx >= 0
      ? state.rounds.map((r, i) => (i === existingIdx ? round : r))
      : [...state.rounds, round].sort((a, b) => a.roundNumber - b.roundNumber);

  return {
    ...state,
    room: {
      ...state.room,
      status: 'PLAYING',
      currentRound: nextNum,
      updatedAt: now,
    },
    humanCurrentRound: state.room.currentRound === 0 ? 1 : state.humanCurrentRound,
    rounds: nextRounds,
    secretsByRound: {
      ...state.secretsByRound,
      [nextNum]: roundSecrets,
    },
    botAnswersByRound: {
      ...state.botAnswersByRound,
      [nextNum]: botAnswers,
    },
  };
}

export function submitAndGradeDemoHumanAnswer(
  state: DemoSessionState,
  roundNumber: number,
  submittedAnswer: number,
  usedPrompts: Set<string>
): DemoSessionState {
  if (state.humanAnswersByRound[roundNumber]) return state;

  const round = state.rounds.find((r) => r.roundNumber === roundNumber);
  const secret = state.secretsByRound[roundNumber]?.[DEMO_HUMAN_ID];
  const human = state.players.find((p) => p.playerId === DEMO_HUMAN_ID);
  if (!round || !secret || !human || human.finished) return state;

  const now = Date.now();
  const roundStartMs = typeof round.startedAt === 'number' ? round.startedAt : now - 2500;
  const responseTimeMs = Math.max(250, now - roundStartMs);
  const isCorrect = Math.round(submittedAnswer) === secret.correctAnswer;
  const dice = round.diceResults[DEMO_HUMAN_ID] ?? 1;

  const movement = resolveMovement({
    currentPosition: human.position,
    dice,
    isCorrect,
    isTimeout: false,
    penalty: state.room.settings.wrongPenalty,
    finishRule: state.room.settings.finishRule,
    hasShield: human.shield,
    board: state.room.boardConfiguration,
    isChallengeRound: Boolean(secret.isChallenge),
  });

  const scoreDelta = calculatePlayerScore({
    currentXp: human.xp,
    currentGold: human.gold,
    currentStreak: human.streak,
    bestStreak: human.bestStreak,
    correctAnswers: human.correctAnswers,
    incorrectAnswers: human.incorrectAnswers,
    timeoutCount: human.timeoutCount,
    operationStats: human.operationStats,
    negativeStats: human.negativeStats,
    isCorrect,
    isTimeout: false,
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
      : human.shield;

  const nextDoubleDice = movement.specialTileTriggered === 'DOUBLE_DICE';

  const updatedHuman: Player = {
    ...human,
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
    laddersClimbed: human.laddersClimbed + (movement.ladderTaken ? 1 : 0),
    snakesEncountered: human.snakesEncountered + (movement.snakeTaken ? 1 : 0),
    status: movement.finished ? 'FINISHED' : 'PLAYING',
    finished: movement.finished,
    finishedRound: movement.finished ? roundNumber : human.finishedRound,
    shield: nextShield,
    doubleDiceNext: nextDoubleDice,
    operationStats: scoreDelta.newOperationStats,
    negativeStats: scoreDelta.newNegativeStats,
    lastOutcome: {
      roundNumber,
      dice,
      submittedAnswer: Math.round(submittedAnswer),
      correctAnswer: secret.correctAnswer,
      isCorrect,
      isTimeout: false,
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

  const newEvents: RoundEvent[] = [];
  if (movement.finished) {
    newEvents.push({
      id: `d_${roundNumber}_${DEMO_HUMAN_ID}_fin`,
      playerId: DEMO_HUMAN_ID,
      playerName: human.displayName,
      avatar: human.avatar,
      type: 'FINISH',
      text: `${human.displayName} mencapai petak ${state.room.boardConfiguration.boardSize} dan FINISH!`,
      timestamp: now,
    });
  } else if (movement.ladderTaken) {
    newEvents.push({
      id: `d_${roundNumber}_${DEMO_HUMAN_ID}_lad`,
      playerId: DEMO_HUMAN_ID,
      playerName: human.displayName,
      avatar: human.avatar,
      type: 'LADDER',
      text: `${human.displayName} naik tangga ${movement.ladderTaken.start} → ${movement.ladderTaken.end}!`,
      timestamp: now,
    });
  } else if (movement.snakeTaken) {
    newEvents.push({
      id: `d_${roundNumber}_${DEMO_HUMAN_ID}_snk`,
      playerId: DEMO_HUMAN_ID,
      playerName: human.displayName,
      avatar: human.avatar,
      type: 'SNAKE',
      text: `${human.displayName} turun ular ${movement.snakeTaken.start} → ${movement.snakeTaken.end}`,
      timestamp: now,
    });
  } else if (isCorrect && movement.finalPosition > movement.fromPosition) {
    newEvents.push({
      id: `d_${roundNumber}_${DEMO_HUMAN_ID}_mov`,
      playerId: DEMO_HUMAN_ID,
      playerName: human.displayName,
      avatar: human.avatar,
      type: 'MOVE',
      text: `${human.displayName} maju ke petak ${movement.finalPosition}`,
      timestamp: now,
    });
  }

  const nextPlayers = state.players.map((p) => (p.playerId === DEMO_HUMAN_ID ? updatedHuman : p));
  const shouldEndFirstFinish = state.room.settings.gameEndRule === 'FIRST_FINISH' && movement.finished;

  const { rounds: nextRounds, secretsByRound: nextSecrets } = ensureRoundForHuman(
    state,
    roundNumber + 1,
    updatedHuman,
    usedPrompts
  );

  return {
    ...state,
    room: shouldEndFirstFinish
      ? { ...state.room, status: 'FINISHED', finishedAt: now }
      : state.room,
    players: nextPlayers,
    rounds: nextRounds,
    secretsByRound: nextSecrets,
    humanAnswersByRound: {
      ...state.humanAnswersByRound,
      [roundNumber]: {
        submittedAnswer: Math.round(submittedAnswer),
        isCorrect,
        correctAnswer: secret.correctAnswer,
        submittedAtMs: now,
        responseTimeMs,
      },
    },
    eventsFeed: [...newEvents, ...state.eventsFeed].slice(0, 20),
  };
}

export function advanceDemoHumanRound(state: DemoSessionState): DemoSessionState {
  const nextRound = Math.min(state.room.settings.totalRounds, state.humanCurrentRound + 1);
  return {
    ...state,
    humanCurrentRound: nextRound,
  };
}

export function getDemoHumanAnswerSubmission(
  state: DemoSessionState,
  roundNumber: number
): AnswerSubmission | null {
  const rec = state.humanAnswersByRound[roundNumber];
  if (!rec) return null;
  return {
    playerId: DEMO_HUMAN_ID,
    teacherId: 'demo_teacher',
    roomId: state.room.roomCode,
    roundId: `round_${roundNumber}`,
    submittedAnswer: rec.submittedAnswer,
    isCorrect: rec.isCorrect,
    correctAnswer: rec.correctAnswer,
    responseTimeMs: rec.responseTimeMs,
    submittedAt: rec.submittedAtMs,
  };
}

export function resolveDemoRound(state: DemoSessionState): DemoSessionState {
  const currentRoundNum = state.room.currentRound;
  const roundIdx = state.rounds.findIndex((r) => r.roundNumber === currentRoundNum);
  const currentRound = roundIdx >= 0 ? state.rounds[roundIdx] : null;
  if (!currentRound || currentRound.status === 'RESOLVED') return state;

  const roundStartMs = typeof currentRound.startedAt === 'number' ? currentRound.startedAt : Date.now() - 5000;
  const roundSecrets = state.secretsByRound[currentRoundNum] ?? {};
  const roundBotAnswers = state.botAnswersByRound[currentRoundNum] ?? {};

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
    const secret = roundSecrets[player.playerId];
    if (!secret) {
      if (!player.finished && player.status !== 'REMOVED') allFinishedNow = false;
      return player;
    }

    revealedAnswers[player.playerId] = secret.correctAnswer;

    // If human already answered and was graded for this round, keep their graded stats and tally summary
    if (player.playerId === DEMO_HUMAN_ID && state.humanAnswersByRound[currentRoundNum]) {
      const hRec = state.humanAnswersByRound[currentRoundNum];
      if (hRec.isCorrect) correctCount++;
      else incorrectCount++;
      if (!player.finished) allFinishedNow = false;
      else if (player.finishedRound === currentRoundNum) {
        finishedCount++;
        newFinisherOccurred = true;
      }
      if (player.lastOutcome?.roundNumber === currentRoundNum) {
        if (player.lastOutcome.toPosition !== player.lastOutcome.fromPosition) movedCount++;
        if (player.lastOutcome.ladderTo) laddersClimbedCount++;
        if (player.lastOutcome.snakeTo) snakesSlidCount++;
      }
      return player;
    }

    if (player.finished || player.status === 'REMOVED') return player;

    const dice = currentRound.diceResults[player.playerId] ?? 1;
    let submitted: number | null = null;
    let responseTimeMs = state.room.settings.answerTimerSec * 1000;

    if (player.playerId !== DEMO_HUMAN_ID) {
      const botAns = roundBotAnswers[player.playerId];
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
        id: `d_${currentRoundNum}_${player.playerId}_fin`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'FINISH',
        text: `${player.displayName} mencapai petak ${state.room.boardConfiguration.boardSize} dan FINISH!`,
        timestamp: Date.now(),
      });
    } else if (movement.ladderTaken) {
      events.push({
        id: `d_${currentRoundNum}_${player.playerId}_lad`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'LADDER',
        text: `${player.displayName} naik tangga ${movement.ladderTaken.start} → ${movement.ladderTaken.end}!`,
        timestamp: Date.now(),
      });
    } else if (movement.snakeTaken) {
      events.push({
        id: `d_${currentRoundNum}_${player.playerId}_snk`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'SNAKE',
        text: `${player.displayName} turun ular ${movement.snakeTaken.start} → ${movement.snakeTaken.end}`,
        timestamp: Date.now(),
      });
    } else if (isCorrect && movement.finalPosition > movement.fromPosition) {
      events.push({
        id: `d_${currentRoundNum}_${player.playerId}_mov`,
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
      finishedRound: movement.finished ? currentRoundNum : player.finishedRound,
      shield: nextShield,
      doubleDiceNext: nextDoubleDice,
      operationStats: scoreDelta.newOperationStats,
      negativeStats: scoreDelta.newNegativeStats,
      lastOutcome: {
        roundNumber: currentRoundNum,
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
      roundNumber: currentRoundNum,
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
  const reachedMaxRounds = currentRoundNum >= state.room.settings.totalRounds;
  const shouldEnd =
    (state.room.settings.gameEndRule === 'FIRST_FINISH' && (newFinisherOccurred || previouslyFinished)) ||
    (state.room.settings.gameEndRule === 'ALL_FINISH' && allFinishedNow) ||
    reachedMaxRounds;

  const nextRounds = state.rounds.map((r, idx) => (idx === roundIdx ? resolvedRound : r));
  const humanPlayerAfter = updatedPlayers.find((p) => p.playerId === DEMO_HUMAN_ID);
  const nextHumanRound =
    humanPlayerAfter && !state.humanAnswersByRound[currentRoundNum] && !humanPlayerAfter.finished
      ? Math.max(state.humanCurrentRound, currentRoundNum)
      : state.humanCurrentRound;

  return {
    ...state,
    room: {
      ...state.room,
      status: shouldEnd ? 'FINISHED' : state.room.status,
      finishedAt: shouldEnd ? Date.now() : state.room.finishedAt,
    },
    humanCurrentRound: nextHumanRound,
    players: updatedPlayers,
    rounds: nextRounds,
    eventsFeed: [...events, ...state.eventsFeed].slice(0, 20),
  };
}
