import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
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
  RoundSecret,
  RoundSummary,
  SecretAnswerKey,
} from '../types/game';
import { db, handleFirestoreError, OperationType } from './firebaseService';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return `MATH-${suffix}`;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export async function createRoom(
  teacher: User,
  title: string,
  settings: GameSettings,
  boardConfiguration: BoardConfiguration
): Promise<string> {
  let roomCode = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const existing = await getDoc(doc(db, 'rooms', roomCode));
    if (!existing.exists()) break;
    roomCode = generateRoomCode();
  }

  const path = `rooms/${roomCode}`;
  try {
    const roomPayload = {
      roomCode,
      teacherId: teacher.uid,
      teacherName: (teacher.displayName || teacher.email || 'Guru').slice(0, 80),
      title: (title.trim() || 'Balapan Bilangan Bulat').slice(0, 100),
      status: 'WAITING',
      settings,
      boardConfiguration,
      currentRound: 0,
      locked: false,
      playerCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'rooms', roomCode), roomPayload);
    return roomCode;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function getRoomByCode(roomCode: string): Promise<Room | null> {
  const code = normalizeRoomCode(roomCode);
  if (!code) return null;
  const path = `rooms/${code}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', code));
    return snap.exists() ? (snap.data() as Room) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export function subscribeRoom(
  roomCode: string,
  onData: (room: Room | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}`;
  return onSnapshot(
    doc(db, 'rooms', code),
    (snap) => {
      onData(snap.exists() ? (snap.data() as Room) : null);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribePlayers(
  roomCode: string,
  onData: (players: Player[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/players`;
  const q = query(collection(db, 'rooms', code, 'players'), where('roomId', '==', code));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Player);
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeRounds(
  roomCode: string,
  onData: (rounds: Round[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/rounds`;
  const q = query(
    collection(db, 'rooms', code, 'rounds'),
    where('roomId', '==', code),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Round);
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeRoundAnswers(
  roomCode: string,
  roundId: string,
  teacherId: string,
  onData: (answers: AnswerSubmission[]) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/answers`;
  const q = query(
    collection(db, 'rooms', code, 'answers'),
    where('teacherId', '==', teacherId),
    where('roundId', '==', roundId)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AnswerSubmission));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllRoomAnswers(
  roomCode: string,
  teacherId: string,
  onData: (answers: AnswerSubmission[]) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/answers`;
  const q = query(
    collection(db, 'rooms', code, 'answers'),
    where('teacherId', '==', teacherId)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AnswerSubmission));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeMyAnswer(
  roomCode: string,
  roundId: string,
  playerId: string,
  onData: (answer: AnswerSubmission | null) => void
): Unsubscribe {
  const code = normalizeRoomCode(roomCode);
  const answerId = `${roundId}_${playerId}`;
  const path = `rooms/${code}/answers/${answerId}`;
  return onSnapshot(
    doc(db, 'rooms', code, 'answers', answerId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as AnswerSubmission) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export async function joinRoom(params: {
  roomCode: string;
  user: User;
  displayName: string;
  avatar: string;
  color: string;
}): Promise<{ reconnected: boolean }> {
  const code = normalizeRoomCode(params.roomCode);
  const cleanName = params.displayName.trim().slice(0, 32);
  if (!cleanName) throw new Error('Nama tampilan tidak boleh kosong.');

  const roomSnap = await getDoc(doc(db, 'rooms', code));
  if (!roomSnap.exists()) {
    throw new Error(`Ruangan "${code}" tidak ditemukan.`);
  }
  const room = roomSnap.data() as Room;

  const existingPlayerRef = doc(db, 'rooms', code, 'players', params.user.uid);
  const existingPlayerSnap = await getDoc(existingPlayerRef);

  if (existingPlayerSnap.exists()) {
    const existingPlayer = existingPlayerSnap.data() as Player;
    if (existingPlayer.status === 'REMOVED') {
      throw new Error('Kamu telah dikeluarkan dari ruangan ini oleh guru.');
    }
    try {
      await updateDoc(existingPlayerRef, {
        connected: true,
        lastSeenAt: serverTimestamp(),
      });
      return { reconnected: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${code}/players/${params.user.uid}`);
    }
  }

  if (room.locked) {
    throw new Error('Lobi ruangan sedang dikunci oleh guru.');
  }
  if (room.status === 'FINISHED') {
    throw new Error('Permainan pada ruangan ini sudah selesai.');
  }
  if (room.status !== 'WAITING' && !room.settings.allowLateJoin) {
    throw new Error('Permainan sudah dimulai dan guru menutup pendaftaran susulan.');
  }

  // Prevent duplicate display names in the same room
  const playersSnap = await getDocs(
    query(collection(db, 'rooms', code, 'players'), where('roomId', '==', code))
  );
  const duplicate = playersSnap.docs.some((d) => {
    const p = d.data() as Player;
    return p.status !== 'REMOVED' && p.displayName.toLowerCase() === cleanName.toLowerCase();
  });
  if (duplicate) {
    throw new Error(`Nama "${cleanName}" sudah digunakan di ruangan ini. Silakan pilih nama lain.`);
  }

  const playerPath = `rooms/${code}/players/${params.user.uid}`;
  try {
    await setDoc(existingPlayerRef, {
      playerId: params.user.uid,
      roomId: code,
      displayName: cleanName,
      avatar: params.avatar,
      color: params.color,
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
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
    return { reconnected: false };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, playerPath);
  }
}

export async function updatePlayerHeartbeat(roomCode: string, playerId: string, connected: boolean): Promise<void> {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/players/${playerId}`;
  try {
    await updateDoc(doc(db, 'rooms', code, 'players', playerId), {
      connected,
      lastSeenAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal background heartbeat
  }
}

export async function removePlayerFromRoom(roomCode: string, playerId: string): Promise<void> {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}/players/${playerId}`;
  try {
    await updateDoc(doc(db, 'rooms', code, 'players', playerId), {
      status: 'REMOVED',
      connected: false,
      lastSeenAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncRoomPlayerCount(roomCode: string, count: number): Promise<void> {
  const code = normalizeRoomCode(roomCode);
  try {
    await updateDoc(doc(db, 'rooms', code), {
      playerCount: count,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Best-effort sync
  }
}

export async function toggleRoomLock(roomCode: string, locked: boolean): Promise<void> {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}`;
  try {
    await updateDoc(doc(db, 'rooms', code), {
      locked,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function setRoomStatus(
  roomCode: string,
  status: Room['status'],
  extra?: Partial<Pick<Room, 'currentRound'>>
): Promise<void> {
  const code = normalizeRoomCode(roomCode);
  const path = `rooms/${code}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === 'FINISHED') {
      payload.finishedAt = serverTimestamp();
    }
    if (extra?.currentRound !== undefined) {
      payload.currentRound = extra.currentRound;
    }
    await updateDoc(doc(db, 'rooms', code), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function startNextRound(
  room: Room,
  players: Player[],
  usedPrompts: Set<string>
): Promise<number> {
  const code = room.roomCode;
  const nextRoundNumber = room.currentRound + 1;
  const roundId = `round_${nextRoundNumber}`;
  const activePlayers = players.filter((p) => p.status !== 'REMOVED' && !p.finished);

  if (activePlayers.length === 0) {
    await setRoomStatus(code, 'FINISHED');
    return nextRoundNumber;
  }

  const roundRef = doc(db, 'rooms', code, 'rounds', roundId);
  const secretRef = doc(db, 'rooms', code, 'roundSecrets', roundId);
  const [existingRoundSnap, existingSecretSnap] = await Promise.all([
    getDoc(roundRef),
    getDoc(secretRef),
  ]);

  const existingRound = existingRoundSnap.exists() ? (existingRoundSnap.data() as Round) : null;
  const existingSecret = existingSecretSnap.exists() ? (existingSecretSnap.data() as RoundSecret) : null;

  const diceResults: Record<string, number> = { ...(existingRound?.diceResults ?? {}) };
  const questions: Record<string, PublicQuestion> = { ...(existingRound?.questions ?? {}) };
  const secretAnswers: Record<string, SecretAnswerKey> = { ...(existingSecret?.answers ?? {}) };

  activePlayers.forEach((player, idx) => {
    if (questions[player.playerId] && secretAnswers[player.playerId]) {
      return;
    }
    const dice = rollDice(room.settings.diceMode, player.doubleDiceNext);
    diceResults[player.playerId] = dice;

    const isChallenge = room.boardConfiguration.specialTiles[String(player.position)] === 'CHALLENGE';
    const opHint = pickBalancedOperation(room.settings.operations, nextRoundNumber + idx);
    const { publicQuestion, secretKey } = generateQuestion(room.settings, {
      operationHint: opHint,
      usedPrompts,
      isChallenge,
    });
    questions[player.playerId] = publicQuestion;
    secretAnswers[player.playerId] = secretKey;
  });

  const deadlineAt = Date.now() + room.settings.answerTimerSec * 1000;
  const batch = writeBatch(db);

  if (existingRoundSnap.exists()) {
    if (existingRound?.status === 'ACTIVE') {
      batch.update(roundRef, {
        deadlineAt,
        diceResults,
        questions,
      });
    }
  } else {
    batch.set(roundRef, {
      roundNumber: nextRoundNumber,
      roomId: code,
      status: 'ACTIVE',
      startedAt: serverTimestamp(),
      deadlineAt,
      diceResults,
      questions,
    });
  }

  if (existingSecretSnap.exists()) {
    batch.update(secretRef, {
      answers: secretAnswers,
    });
  } else {
    batch.set(secretRef, {
      roundNumber: nextRoundNumber,
      roomId: code,
      answers: secretAnswers,
    });
  }

  const roomUpdate: Record<string, unknown> = {
    status: 'PLAYING',
    currentRound: nextRoundNumber,
    updatedAt: serverTimestamp(),
  };
  if (!room.startedAt) {
    roomUpdate.startedAt = serverTimestamp();
  }
  batch.update(doc(db, 'rooms', code), roomUpdate);

  try {
    await batch.commit();
    return nextRoundNumber;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${code}/rounds/${roundId}`);
  }
}

export async function submitStudentAnswer(params: {
  roomCode: string;
  teacherId: string;
  roundId: string;
  playerId: string;
  submittedAnswer: number;
}): Promise<void> {
  const code = normalizeRoomCode(params.roomCode);
  const answerId = `${params.roundId}_${params.playerId}`;
  const path = `rooms/${code}/answers/${answerId}`;
  try {
    await setDoc(doc(db, 'rooms', code, 'answers', answerId), {
      playerId: params.playerId,
      teacherId: params.teacherId,
      roomId: code,
      roundId: params.roundId,
      submittedAnswer: Math.round(params.submittedAnswer),
      submittedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function gradeSingleAnswer(params: {
  room: Room;
  round: Round;
  player: Player;
  submission: AnswerSubmission;
  usedPrompts: Set<string>;
}): Promise<void> {
  const { room, round, player, submission, usedPrompts } = params;
  if (submission.isCorrect !== undefined || player.finished || player.status === 'REMOVED') {
    return;
  }

  const code = room.roomCode;
  const roundId = submission.roundId;

  let secretDoc: RoundSecret;
  try {
    const snap = await getDoc(doc(db, 'rooms', code, 'roundSecrets', roundId));
    if (!snap.exists()) return;
    secretDoc = snap.data() as RoundSecret;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${code}/roundSecrets/${roundId}`);
  }

  const secret = secretDoc.answers[player.playerId];
  if (!secret) return;

  const dice = round.diceResults[player.playerId] ?? 1;
  const roundStartMs =
    round.startedAt instanceof Timestamp ? round.startedAt.toMillis() : Date.now() - 4000;
  const submittedMs =
    submission.submittedAt instanceof Timestamp ? submission.submittedAt.toMillis() : Date.now();
  const responseTimeMs = Math.max(200, submittedMs - roundStartMs);
  const isCorrect = submission.submittedAnswer === secret.correctAnswer;

  const movement = resolveMovement({
    currentPosition: player.position,
    dice,
    isCorrect,
    isTimeout: false,
    penalty: room.settings.wrongPenalty,
    finishRule: room.settings.finishRule,
    hasShield: player.shield,
    board: room.boardConfiguration,
    isChallengeRound: Boolean(secret.isChallenge),
  });

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
      : player.shield;

  const nextDoubleDice = movement.specialTileTriggered === 'DOUBLE_DICE';

  const playerUpdate: Record<string, unknown> = {
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
    status: movement.finished ? 'FINISHED' : 'PLAYING',
    finished: movement.finished,
    shield: nextShield,
    doubleDiceNext: nextDoubleDice,
    operationStats: scoreDelta.newOperationStats,
    negativeStats: scoreDelta.newNegativeStats,
    lastOutcome: {
      roundNumber: round.roundNumber,
      dice,
      submittedAnswer: submission.submittedAnswer,
      correctAnswer: secret.correctAnswer,
      isCorrect,
      isTimeout: false,
      fromPosition: movement.fromPosition,
      toPosition: movement.finalPosition,
      ...(movement.ladderTaken ? { ladderTo: movement.ladderTaken.end } : {}),
      ...(movement.snakeTaken ? { snakeTo: movement.snakeTaken.end } : {}),
      shieldBlocked: movement.shieldBlocked,
      ...(movement.specialTileTriggered ? { specialTileTriggered: movement.specialTileTriggered } : {}),
      xpEarned: scoreDelta.xpEarned,
      goldEarned: scoreDelta.goldEarned,
      message: movement.feedbackMessage,
    },
  };
  if (movement.finished) {
    playerUpdate.finishedRound = round.roundNumber;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'rooms', code, 'answers', `${roundId}_${player.playerId}`), {
    isCorrect,
    correctAnswer: secret.correctAnswer,
    responseTimeMs,
  });
  batch.update(doc(db, 'rooms', code, 'players', player.playerId), playerUpdate);

  if (movement.finished && room.settings.gameEndRule === 'FIRST_FINISH') {
    batch.update(doc(db, 'rooms', code), {
      status: 'FINISHED',
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (!movement.finished && round.roundNumber < room.settings.totalRounds) {
    // Pre-generate the next round entry immediately so early finishers can proceed right away
    const nextRoundNumber = round.roundNumber + 1;
    const nextRoundId = `round_${nextRoundNumber}`;
    const nextRoundRef = doc(db, 'rooms', code, 'rounds', nextRoundId);
    const nextSecretRef = doc(db, 'rooms', code, 'roundSecrets', nextRoundId);
    const [nextRoundSnap, nextSecretSnap] = await Promise.all([
      getDoc(nextRoundRef),
      getDoc(nextSecretRef),
    ]);

    const nextRoundData = nextRoundSnap.exists() ? (nextRoundSnap.data() as Round) : null;
    if (!nextRoundSnap.exists() || nextRoundData?.status === 'ACTIVE') {
      const alreadyHasQuestion = Boolean(nextRoundData?.questions?.[player.playerId]);
      if (!alreadyHasQuestion) {
        const nextDice = rollDice(room.settings.diceMode, nextDoubleDice);
        const isChallenge =
          room.boardConfiguration.specialTiles[String(movement.finalPosition)] === 'CHALLENGE';
        const opHint = pickBalancedOperation(room.settings.operations, nextRoundNumber);
        const { publicQuestion, secretKey } = generateQuestion(room.settings, {
          operationHint: opHint,
          usedPrompts,
          isChallenge,
        });

        if (nextRoundSnap.exists()) {
          batch.update(nextRoundRef, {
            diceResults: { ...(nextRoundData?.diceResults ?? {}), [player.playerId]: nextDice },
            questions: { ...(nextRoundData?.questions ?? {}), [player.playerId]: publicQuestion },
          });
        } else {
          batch.set(nextRoundRef, {
            roundNumber: nextRoundNumber,
            roomId: code,
            status: 'ACTIVE',
            startedAt: serverTimestamp(),
            deadlineAt: Date.now() + room.settings.answerTimerSec * 1000,
            diceResults: { [player.playerId]: nextDice },
            questions: { [player.playerId]: publicQuestion },
          });
        }

        const existingSec = nextSecretSnap.exists() ? (nextSecretSnap.data() as RoundSecret) : null;
        if (nextSecretSnap.exists()) {
          batch.update(nextSecretRef, {
            answers: { ...(existingSec?.answers ?? {}), [player.playerId]: secretKey },
          });
        } else {
          batch.set(nextSecretRef, {
            roundNumber: nextRoundNumber,
            roomId: code,
            answers: { [player.playerId]: secretKey },
          });
        }
      }
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${code}/answers/${roundId}_${player.playerId}`);
  }
}

export async function resolveCurrentRound(
  room: Room,
  round: Round,
  players: Player[],
  answers: AnswerSubmission[]
): Promise<void> {
  const code = room.roomCode;
  const roundId = `round_${round.roundNumber}`;

  let secretDoc: RoundSecret;
  try {
    const snap = await getDoc(doc(db, 'rooms', code, 'roundSecrets', roundId));
    if (!snap.exists()) {
      throw new Error('Kunci jawaban ronde tidak ditemukan.');
    }
    secretDoc = snap.data() as RoundSecret;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${code}/roundSecrets/${roundId}`);
  }

  const answerMap = new Map<string, AnswerSubmission>();
  answers.forEach((a) => answerMap.set(a.playerId, a));

  const roundStartMs =
    round.startedAt instanceof Timestamp ? round.startedAt.toMillis() : Date.now() - room.settings.answerTimerSec * 1000;

  let correctCount = 0;
  let incorrectCount = 0;
  let timeoutCount = 0;
  let movedCount = 0;
  let laddersClimbedCount = 0;
  let snakesSlidCount = 0;
  let finishedCount = 0;
  const revealedAnswers: Record<string, number> = {};
  const events: RoundEvent[] = [];

  const batch = writeBatch(db);
  const activePlayers = players.filter((p) => p.status !== 'REMOVED');
  let newFinisherOccurred = false;
  let allFinishedNow = true;

  for (const player of activePlayers) {
    const secret = secretDoc.answers[player.playerId];
    const dice = round.diceResults[player.playerId] ?? 1;
    if (!secret) {
      if (!player.finished) allFinishedNow = false;
      continue;
    }

    revealedAnswers[player.playerId] = secret.correctAnswer;
    const sub = answerMap.get(player.playerId);

    // Skip mutating players who were already immediately graded for this round
    if (sub && sub.isCorrect !== undefined) {
      if (sub.isCorrect) correctCount++;
      else incorrectCount++;
      if (!player.finished) allFinishedNow = false;
      else if (player.finishedRound === round.roundNumber) {
        finishedCount++;
        newFinisherOccurred = true;
      }
      if (player.lastOutcome?.roundNumber === round.roundNumber) {
        if (player.lastOutcome.toPosition !== player.lastOutcome.fromPosition) movedCount++;
        if (player.lastOutcome.ladderTo) laddersClimbedCount++;
        if (player.lastOutcome.snakeTo) snakesSlidCount++;
        if (player.lastOutcome.ladderTo) {
          events.push({
            id: `${roundId}_${player.playerId}_lad`,
            playerId: player.playerId,
            playerName: player.displayName,
            avatar: player.avatar,
            type: 'LADDER',
            text: `${player.displayName} naik tangga ${player.lastOutcome.fromPosition} → ${player.lastOutcome.ladderTo}!`,
            timestamp: Date.now(),
          });
        } else if (player.lastOutcome.snakeTo) {
          events.push({
            id: `${roundId}_${player.playerId}_snk`,
            playerId: player.playerId,
            playerName: player.displayName,
            avatar: player.avatar,
            type: 'SNAKE',
            text: `${player.displayName} turun ular ${player.lastOutcome.fromPosition} → ${player.lastOutcome.snakeTo}`,
            timestamp: Date.now(),
          });
        } else if (player.lastOutcome.toPosition > player.lastOutcome.fromPosition) {
          events.push({
            id: `${roundId}_${player.playerId}_mov`,
            playerId: player.playerId,
            playerName: player.displayName,
            avatar: player.avatar,
            type: 'MOVE',
            text: `${player.displayName} maju ke petak ${player.lastOutcome.toPosition}`,
            timestamp: Date.now(),
          });
        }
      }
      continue;
    }

    if (player.finished) continue;

    const isTimeout = !sub;
    const isCorrect = sub ? sub.submittedAnswer === secret.correctAnswer : false;

    const submittedMs =
      sub?.submittedAt instanceof Timestamp ? sub.submittedAt.toMillis() : Date.now();
    const responseTimeMs = sub ? Math.max(200, submittedMs - roundStartMs) : room.settings.answerTimerSec * 1000;

    if (isTimeout) timeoutCount++;
    else if (isCorrect) correctCount++;
    else incorrectCount++;

    const movement = resolveMovement({
      currentPosition: player.position,
      dice,
      isCorrect,
      isTimeout,
      penalty: room.settings.wrongPenalty,
      finishRule: room.settings.finishRule,
      hasShield: player.shield,
      board: room.boardConfiguration,
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

    const playerUpdate: Record<string, unknown> = {
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
      status: movement.finished ? 'FINISHED' : 'PLAYING',
      finished: movement.finished,
      shield: nextShield,
      doubleDiceNext: nextDoubleDice,
      operationStats: scoreDelta.newOperationStats,
      negativeStats: scoreDelta.newNegativeStats,
      lastOutcome: {
        roundNumber: round.roundNumber,
        dice,
        submittedAnswer: sub ? sub.submittedAnswer : null,
        correctAnswer: secret.correctAnswer,
        isCorrect,
        isTimeout,
        fromPosition: movement.fromPosition,
        toPosition: movement.finalPosition,
        ...(movement.ladderTaken ? { ladderTo: movement.ladderTaken.end } : {}),
        ...(movement.snakeTaken ? { snakeTo: movement.snakeTaken.end } : {}),
        shieldBlocked: movement.shieldBlocked,
        ...(movement.specialTileTriggered ? { specialTileTriggered: movement.specialTileTriggered } : {}),
        xpEarned: scoreDelta.xpEarned,
        goldEarned: scoreDelta.goldEarned,
        message: movement.feedbackMessage,
      },
    };
    if (movement.finished) {
      playerUpdate.finishedRound = round.roundNumber;
    }

    batch.update(doc(db, 'rooms', code, 'players', player.playerId), playerUpdate);

    if (sub) {
      batch.update(doc(db, 'rooms', code, 'answers', `${roundId}_${player.playerId}`), {
        isCorrect,
        correctAnswer: secret.correctAnswer,
        responseTimeMs,
      });
    }

    if (movement.finished) {
      events.push({
        id: `${roundId}_${player.playerId}_fin`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'FINISH',
        text: `${player.displayName} mencapai petak ${room.boardConfiguration.boardSize} dan FINISH!`,
        timestamp: Date.now(),
      });
    } else if (movement.ladderTaken) {
      events.push({
        id: `${roundId}_${player.playerId}_lad`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'LADDER',
        text: `${player.displayName} naik tangga ${movement.ladderTaken.start} → ${movement.ladderTaken.end}!`,
        timestamp: Date.now(),
      });
    } else if (movement.snakeTaken) {
      events.push({
        id: `${roundId}_${player.playerId}_snk`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'SNAKE',
        text: `${player.displayName} turun ular ${movement.snakeTaken.start} → ${movement.snakeTaken.end}`,
        timestamp: Date.now(),
      });
    } else if (movement.specialTileTriggered) {
      events.push({
        id: `${roundId}_${player.playerId}_spc`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: movement.specialTileTriggered,
        text: `${player.displayName} mengaktifkan petak ${movement.specialTileTriggered} di petak ${movement.finalPosition}!`,
        timestamp: Date.now(),
      });
    } else if (isCorrect && movement.finalPosition > movement.fromPosition) {
      events.push({
        id: `${roundId}_${player.playerId}_mov`,
        playerId: player.playerId,
        playerName: player.displayName,
        avatar: player.avatar,
        type: 'MOVE',
        text: `${player.displayName} maju ke petak ${movement.finalPosition}`,
        timestamp: Date.now(),
      });
    }
  }

  const summary: RoundSummary = {
    roundNumber: round.roundNumber,
    correctCount,
    incorrectCount,
    timeoutCount,
    movedCount,
    laddersClimbedCount,
    snakesSlidCount,
    finishedCount,
    revealedAnswers,
    events: events.slice(0, 12),
  };

  batch.update(doc(db, 'rooms', code, 'rounds', roundId), {
    status: 'RESOLVED',
    resultSummary: summary,
  });

  const previouslyFinished = players.some((p) => p.status !== 'REMOVED' && p.finished);
  const reachedMaxRounds = round.roundNumber >= room.settings.totalRounds;
  const shouldEnd =
    (room.settings.gameEndRule === 'FIRST_FINISH' && (newFinisherOccurred || previouslyFinished)) ||
    (room.settings.gameEndRule === 'ALL_FINISH' && activePlayers.length > 0 && allFinishedNow) ||
    reachedMaxRounds;

  if (shouldEnd) {
    batch.update(doc(db, 'rooms', code), {
      status: 'FINISHED',
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${code}/rounds/${roundId}`);
  }
}

export async function getTeacherHistory(teacherId: string): Promise<Room[]> {
  const path = 'rooms';
  try {
    const q = query(
      collection(db, 'rooms'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Room);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
