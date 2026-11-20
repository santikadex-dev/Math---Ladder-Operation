import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  LayoutGrid,
  MapPin,
  Shield,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { rankPlayers } from '../engine/leaderboardEngine';
import { usePeriodicBoardRefresh } from '../hooks/usePeriodicBoardRefresh';
import {
  subscribeMyAnswer,
  subscribePlayers,
  subscribeRoom,
  subscribeRounds,
  submitStudentAnswer,
  updatePlayerHeartbeat,
} from '../services/roomService';
import type { AnswerSubmission, Player, Room, Round } from '../types/game';
import { soundFx, startBgm, stopBgm } from '../utils/sound';
import { BoardRefreshToolbar } from './BoardRefreshToolbar';
import { DiceRouletteOverlay } from './DiceRouletteOverlay';
import { DiceWidget } from './DiceWidget';
import { FunnyEventTicker } from './FunnyEventTicker';
import { GameBoard } from './GameBoard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { ResultsAnalyticsScreen } from './ResultsAnalyticsScreen';

interface StudentGameScreenProps {
  roomCode: string;
  playerId: string;
  isDemo?: boolean;
  demoRoom?: Room;
  demoPlayers?: Player[];
  demoRounds?: Round[];
  demoHumanRound?: number;
  demoMyAnswer?: AnswerSubmission | null;
  onDemoSubmitAnswer?: (roundNumber: number, val: number) => void;
  onDemoAdvanceRound?: () => void;
  onExitHome: () => void;
}

function formatSignedNumber(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

export const StudentGameScreen: React.FC<StudentGameScreenProps> = ({
  roomCode,
  playerId,
  isDemo = false,
  demoRoom,
  demoPlayers,
  demoRounds,
  demoHumanRound = 1,
  demoMyAnswer = null,
  onDemoSubmitAnswer,
  onDemoAdvanceRound,
  onExitHome,
}) => {
  const [room, setRoom] = useState<Room | null>(demoRoom ?? null);
  const [players, setPlayers] = useState<Player[]>(demoPlayers ?? []);
  const [rounds, setRounds] = useState<Round[]>(demoRounds ?? []);
  const [myAnswer, setMyAnswer] = useState<AnswerSubmission | null>(demoMyAnswer);

  const [viewingRound, setViewingRound] = useState<number>(1);
  const [hasInitializedRound, setHasInitializedRound] = useState(false);
  const [rolledRound, setRolledRound] = useState<number>(0);
  const [questionRevealedAt, setQuestionRevealedAt] = useState<number | null>(null);
  const [directInput, setDirectInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittedLocalValue, setSubmittedLocalValue] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [overlayModal, setOverlayModal] = useState<'NONE' | 'LEADERBOARD' | 'BOARD'>('NONE');
  const [lastSoundRound, setLastSoundRound] = useState(0);

  const {
    displayedPlayers,
    intervalSec,
    setIntervalSec,
    formattedTime,
    justRefreshed,
    refreshNow,
  } = usePeriodicBoardRefresh(players, 3);

  useEffect(() => {
    if (isDemo) {
      if (demoRoom) setRoom(demoRoom);
      if (demoPlayers) setPlayers(demoPlayers);
      if (demoRounds) setRounds(demoRounds);
      return;
    }
    const unsubRoom = subscribeRoom(roomCode, setRoom);
    const unsubPlayers = subscribePlayers(roomCode, setPlayers);
    const unsubRounds = subscribeRounds(roomCode, setRounds);
    return () => {
      unsubRoom();
      unsubPlayers();
      unsubRounds();
    };
  }, [roomCode, isDemo, demoRoom, demoPlayers, demoRounds]);

  // Initialize viewingRound when joining/reconnecting in Real Mode
  useEffect(() => {
    if (isDemo || !room || hasInitializedRound) return;
    if (room.currentRound > 0) {
      setViewingRound(room.currentRound);
      setHasInitializedRound(true);
    }
  }, [isDemo, room?.currentRound, hasInitializedRound]);

  // Connection heartbeat in real mode
  useEffect(() => {
    if (isDemo || !roomCode || !playerId) return;
    void updatePlayerHeartbeat(roomCode, playerId, true);
    const id = setInterval(() => {
      void updatePlayerHeartbeat(roomCode, playerId, true);
    }, 25000);
    return () => clearInterval(id);
  }, [roomCode, playerId, isDemo]);

  const activeRoundNumber = isDemo ? demoHumanRound : viewingRound;
  const activeRound = useMemo(
    () => rounds.find((r) => r.roundNumber === activeRoundNumber) ?? null,
    [rounds, activeRoundNumber]
  );
  const activeRoundId = activeRound ? `round_${activeRound.roundNumber}` : null;

  useEffect(() => {
    if (isDemo) {
      setMyAnswer(demoMyAnswer ?? null);
      return;
    }
    if (!activeRoundId) {
      setMyAnswer(null);
      return;
    }
    const unsub = subscribeMyAnswer(roomCode, activeRoundId, playerId, setMyAnswer);
    return () => unsub();
  }, [roomCode, activeRoundId, playerId, isDemo, demoMyAnswer]);

  // Manage BGM during real gameplay
  useEffect(() => {
    if (isDemo) return;
    if (room?.status === 'PLAYING') {
      startBgm();
    } else {
      stopBgm();
    }
    return () => {
      stopBgm();
    };
  }, [isDemo, room?.status]);

  // Reset local inputs & reveal timer whenever student's active round changes
  useEffect(() => {
    setDirectInput('');
    setSelectedOption(null);
    setSubmittedLocalValue(null);
    setQuestionRevealedAt(null);
  }, [activeRoundNumber]);

  // Timer countdown starts ONLY after the floating dice roulette reveals the question
  useEffect(() => {
    if (!activeRound || !room) {
      setSecondsLeft(0);
      return;
    }
    if (activeRound.status !== 'ACTIVE' || room.status === 'PAUSED') {
      setSecondsLeft(0);
      return;
    }
    if (rolledRound < activeRound.roundNumber || !questionRevealedAt) {
      setSecondsLeft(room.settings.answerTimerSec);
      return;
    }

    const personalDeadlineMs = questionRevealedAt + room.settings.answerTimerSec * 1000;
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((personalDeadlineMs - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [activeRound, room?.status, room?.settings.answerTimerSec, rolledRound, questionRevealedAt]);

  const me = players.find((p) => p.playerId === playerId) ?? null;

  // Immediate sound feedback as soon as the current round is graded for this student
  useEffect(() => {
    if (!me) return;
    const outcomeForActiveRound =
      me.lastOutcome && me.lastOutcome.roundNumber === activeRoundNumber ? me.lastOutcome : null;
    const answerGraded = myAnswer && myAnswer.isCorrect !== undefined;

    if (!outcomeForActiveRound && !answerGraded) return;
    if (lastSoundRound === activeRoundNumber) return;

    setLastSoundRound(activeRoundNumber);
    const isCorrect = answerGraded
      ? Boolean(myAnswer?.isCorrect)
      : Boolean(outcomeForActiveRound?.isCorrect);

    if (isCorrect) {
      soundFx.correct();
      if (outcomeForActiveRound?.ladderTo) {
        setTimeout(() => soundFx.ladder(), 240);
      }
    } else {
      soundFx.wrong();
      if (outcomeForActiveRound?.snakeTo) {
        setTimeout(() => soundFx.snake(), 260);
      }
    }
  }, [me?.lastOutcome, myAnswer, activeRoundNumber, lastSoundRound]);

  const rankedPlayers = useMemo(() => rankPlayers(players), [players]);
  const myRank = useMemo(() => {
    const idx = rankedPlayers.findIndex((r) => r.player.playerId === playerId);
    return idx >= 0 ? idx + 1 : 1;
  }, [rankedPlayers, playerId]);

  if (!room || !me) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">Menghubungkan ke ruang {roomCode}...</p>
        </div>
      </div>
    );
  }

  if (me.status === 'REMOVED') {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="font-display font-bold text-lg text-slate-900">Sesi Berakhir</h2>
          <p className="text-sm text-slate-600">Kamu telah dikeluarkan dari ruangan oleh guru.</p>
          <button
            type="button"
            onClick={onExitHome}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold cursor-pointer"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (room.status === 'FINISHED') {
    return (
      <ResultsAnalyticsScreen
        room={room}
        players={players}
        isTeacher={false}
        isDemo={isDemo}
        onExitHome={onExitHome}
      />
    );
  }

  const myAvatar = AVATARS.find((a) => a.id === me.avatar) || AVATARS[0];
  const activePeers = players.filter((p) => p.status !== 'REMOVED');

  // LOBBY WAITING SCREEN
  if (room.status === 'WAITING' || room.status === 'COUNTDOWN') {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="text-xs font-semibold text-blue-600">
            RUANG {room.roomCode} · {room.title}
          </div>

          <div
            style={{ backgroundColor: me.color || myAvatar.color }}
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl border-4 border-white shadow-lg"
          >
            {myAvatar.emoji}
          </div>

          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">{me.displayName}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {room.status === 'COUNTDOWN'
                ? 'Bersiap! Permainan segera dimulai...'
                : 'Menunggu guru memulai permainan...'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-3">
              Siswa di Lobi ({activePeers.length})
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {activePeers.map((p) => {
                const av = AVATARS.find((a) => a.id === p.avatar) || AVATARS[0];
                return (
                  <div
                    key={p.playerId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    <span>{av.emoji}</span>
                    <span>{p.displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STUDENT GAMEPLAY (MOBILE PORTRAIT OPTIMIZED)
  const myQuestion = activeRound?.questions?.[playerId] ?? null;
  const myDice = activeRound?.diceResults?.[playerId] ?? 1;
  const hasRolledThisRound = activeRound ? rolledRound >= activeRound.roundNumber : false;

  const chosenVal = myAnswer?.submittedAnswer ?? submittedLocalValue;
  const hasSubmitted = chosenVal !== null || myAnswer !== null;

  const outcomeForRound =
    me.lastOutcome && me.lastOutcome.roundNumber === activeRoundNumber ? me.lastOutcome : null;
  const isGraded = Boolean(
    (myAnswer && myAnswer.isCorrect !== undefined) || outcomeForRound
  );
  const gradedIsCorrect =
    myAnswer?.isCorrect !== undefined
      ? myAnswer.isCorrect
      : Boolean(outcomeForRound?.isCorrect);
  const gradedCorrectAnswer =
    myAnswer?.correctAnswer ?? outcomeForRound?.correctAnswer;

  const nextRoundNum = activeRoundNumber + 1;
  const canProceedToNext =
    !me.finished &&
    isGraded &&
    activeRoundNumber < room.settings.totalRounds;
  const nextRoundDoc = rounds.find((r) => r.roundNumber === nextRoundNum);
  const isNextRoundReady = Boolean(nextRoundDoc?.questions?.[playerId]);

  const shouldShowRoulette = Boolean(
    !me.finished &&
      room.status === 'PLAYING' &&
      activeRound &&
      activeRound.status === 'ACTIVE' &&
      myQuestion &&
      !hasSubmitted &&
      !isGraded &&
      rolledRound < activeRound.roundNumber
  );

  const handleRouletteComplete = () => {
    if (!activeRound) return;
    setRolledRound(activeRound.roundNumber);
    setQuestionRevealedAt(Date.now());
  };

  const handleSubmitNumber = async (num: number) => {
    if (!activeRound || hasSubmitted || submitting || activeRound.status !== 'ACTIVE') return;
    soundFx.select();
    setSelectedOption(num);
    setSubmittedLocalValue(num);

    if (isDemo && onDemoSubmitAnswer) {
      onDemoSubmitAnswer(activeRound.roundNumber, num);
      return;
    }

    setSubmitting(true);
    try {
      await submitStudentAnswer({
        roomCode: room.roomCode,
        teacherId: room.teacherId,
        roundId: `round_${activeRound.roundNumber}`,
        playerId,
        submittedAnswer: num,
      });
    } catch {
      setSelectedOption(null);
      setSubmittedLocalValue(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeypadPress = (key: string) => {
    if (hasSubmitted) return;
    soundFx.select();
    if (key === 'CLEAR') {
      setDirectInput('');
    } else if (key === 'BACK') {
      setDirectInput((prev) => prev.slice(0, -1));
    } else if (key === 'SIGN') {
      setDirectInput((prev) => (prev.startsWith('-') ? prev.slice(1) : prev ? `-${prev}` : '-'));
    } else {
      setDirectInput((prev) => (prev.length >= 6 ? prev : prev === '0' ? key : prev + key));
    }
  };

  const handleProceedNextRound = () => {
    if (!canProceedToNext) return;
    soundFx.nextRound();
    setQuestionRevealedAt(null);
    if (isDemo && onDemoAdvanceRound) {
      onDemoAdvanceRound();
      return;
    }
    const targetRound =
      outcomeForRound?.isTimeout && room.currentRound > activeRoundNumber
        ? room.currentRound
        : nextRoundNum;
    setViewingRound(targetRound);
  };

  const parsedDirect = directInput !== '' && directInput !== '-' ? Number(directInput) : null;

  return (
    <div className="max-w-md mx-auto px-3 py-3 space-y-3 pb-6">
      {!isDemo && <FunnyEventTicker players={players} rounds={rounds} />}
      {shouldShowRoulette && activeRound && (
        <DiceRouletteOverlay
          roundNumber={activeRound.roundNumber}
          totalRounds={room.settings.totalRounds}
          targetValue={myDice}
          diceMode={room.settings.diceMode}
          onComplete={handleRouletteComplete}
        />
      )}
      {/* Compact Top Status Bar with Tile & Rank */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              style={{ backgroundColor: me.color || myAvatar.color }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-white shadow shrink-0"
            >
              {myAvatar.emoji}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-slate-900 truncate">{me.displayName}</div>
              <div className="text-[11px] text-slate-600 font-math flex items-center gap-1.5">
                <span>{me.xp} XP</span>
                {me.streak >= 2 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-orange-600 inline-flex items-center font-semibold">
                      <Flame className="w-3 h-3" /> {me.streak} Streak
                    </span>
                  </>
                )}
                {me.shield && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-600 inline-flex items-center">
                      <Shield className="w-3 h-3" />
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setOverlayModal('BOARD')}
              className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              title="Lihat Papan Ular Tangga"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Papan</span>
            </button>
            <button
              type="button"
              onClick={() => setOverlayModal('LEADERBOARD')}
              className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              title="Papan Peringkat"
            >
              <Trophy className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Peringkat</span>
            </button>
          </div>
        </div>

        {/* Prominent Tile Number & Rank Strip */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                Posisi Petak
              </div>
              <div className="font-math font-extrabold text-sm text-slate-900">
                Tile #{me.position}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  / {room.boardConfiguration.boardSize}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-100">
            <Award className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Peringkat Kelas
              </div>
              <div className="font-math font-extrabold text-sm text-slate-900">
                #{myRank}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  dari {rankedPlayers.length || 1} siswa
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Finished Banner for Student who reached final tile */}
      {me.finished && (
        <div className="bg-emerald-600 text-white rounded-3xl p-6 text-center space-y-2 shadow-lg">
          <Sparkles className="w-10 h-10 mx-auto text-amber-300" />
          <h2 className="font-display text-2xl font-extrabold">Kamu Sudah Finish!</h2>
          <p className="text-sm text-emerald-100">
            Kamu mencapai Tile #{room.boardConfiguration.boardSize} (Peringkat #{myRank}) pada ronde{' '}
            {me.finishedRound}. Menunggu teman sekelas menyelesaikan permainan!
          </p>
        </div>
      )}

      {/* Paused Notice */}
      {room.status === 'PAUSED' && !me.finished && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-center text-amber-900 text-sm font-semibold">
          Permainan dijeda sementara oleh guru.
        </div>
      )}

      {/* Active Round Card (or Immediate Graded Feedback for Active Round) */}
      {!me.finished && activeRound && myQuestion && (activeRound.status === 'ACTIVE' || isGraded) && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {/* Round & Timer Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 font-math">
              RONDE {activeRound.roundNumber} / {room.settings.totalRounds}
            </span>
            {activeRound.status === 'ACTIVE' && !isGraded ? (
              <span
                className={`inline-flex items-center gap-1 font-math font-bold text-sm ${
                  secondsLeft <= 5 ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" /> {secondsLeft} detik
              </span>
            ) : isGraded ? (
              <span className="text-xs font-bold text-emerald-700">Terkonfirmasi</span>
            ) : null}
          </div>

          {/* Progress Timer Bar (only counts down after dice roulette lands) */}
          {activeRound.status === 'ACTIVE' && !isGraded && hasRolledThisRound && (
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  secondsLeft <= 5 ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(100, (secondsLeft / Math.max(1, room.settings.answerTimerSec)) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Step 1: Floating roulette spins before question & timer appear */}
          {!hasRolledThisRound && !isGraded && !hasSubmitted ? (
            <div className="py-10 text-center space-y-2 text-slate-500">
              <DiceWidget value={myDice} rolling size="lg" />
              <div className="font-display font-bold text-base text-slate-800 pt-2">
                Mengundi Dadu Ronde {activeRound.roundNumber}...
              </div>
              <p className="text-xs text-slate-500">
                Soal dan hitung mundur dimulai setelah dadu berhenti.
              </p>
            </div>
          ) : (
            <>
              {/* Rolled Dice & Question Prompt */}
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100">
                <div className="text-xs text-slate-600">
                  Hasil Dadumu: <strong className="font-math text-slate-900 text-sm">{myDice} Langkah</strong>
                  {myQuestion.isChallenge && (
                    <span className="block text-[11px] font-bold text-violet-700">
                      Soal Tantangan (+2 langkah ekstra!)
                    </span>
                  )}
                </div>
                <DiceWidget value={myDice} size="sm" />
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 text-white text-center">
                <div className="text-[11px] text-sky-300 font-semibold mb-1">Hitung nilai berikut:</div>
                <div className="font-math text-3xl sm:text-4xl font-bold tracking-tight">{myQuestion.prompt}</div>
              </div>

              {/* Answer Input Area (Always stays visible with highlight on chosen option!) */}
              {myQuestion.answerMode === 'MULTIPLE_CHOICE' && myQuestion.options ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {myQuestion.options.map((opt, idx) => {
                    const isSelected = chosenVal === opt || selectedOption === opt;
                    const isTheCorrectOption =
                      isGraded && gradedCorrectAnswer !== undefined && gradedCorrectAnswer === opt;

                    let cardStyle =
                      'border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50 text-slate-900';
                    let badgeText: string | null = null;
                    let badgeClass = '';

                    if (isSelected) {
                      if (!isGraded) {
                        cardStyle =
                          'border-blue-600 bg-blue-50 ring-2 ring-blue-300 text-blue-950 shadow-sm';
                        badgeText = 'Dipilih';
                        badgeClass = 'text-blue-700';
                      } else if (gradedIsCorrect) {
                        cardStyle =
                          'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-300 text-emerald-950 shadow-sm';
                        badgeText = '✓ Jawabanmu Benar';
                        badgeClass = 'text-emerald-700';
                      } else {
                        cardStyle =
                          'border-rose-500 bg-rose-50 ring-2 ring-rose-300 text-rose-950 shadow-sm';
                        badgeText = '✗ Pilihanmu';
                        badgeClass = 'text-rose-700';
                      }
                    } else if (isTheCorrectOption) {
                      cardStyle =
                        'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-300 text-emerald-950';
                      badgeText = '✓ Jawaban Benar';
                      badgeClass = 'text-emerald-700';
                    } else if (hasSubmitted || isGraded) {
                      cardStyle = 'border-slate-200 bg-slate-50/70 text-slate-400 opacity-75';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={hasSubmitted || isGraded || submitting || room.status === 'PAUSED'}
                        onClick={() => handleSubmitNumber(opt)}
                        className={`min-h-[64px] py-2.5 px-3 rounded-2xl border-2 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-default ${cardStyle}`}
                      >
                        <span className="font-math text-xl font-bold">
                          {formatSignedNumber(opt)}
                        </span>
                        {badgeText && (
                          <span className={`text-[10px] font-bold ${badgeClass}`}>{badgeText}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Mobile Numeric Keypad for Direct Input */
                <div className="space-y-2.5">
                  <div
                    className={`px-4 py-3 rounded-2xl border-2 text-center font-math text-2xl font-bold min-h-[54px] flex flex-col items-center justify-center transition-colors ${
                      isGraded
                        ? gradedIsCorrect
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-300 text-emerald-950'
                          : 'border-rose-500 bg-rose-50 ring-2 ring-rose-300 text-rose-950'
                        : hasSubmitted
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-300 text-blue-950'
                        : 'border-slate-300 bg-slate-50 text-slate-900'
                    }`}
                  >
                    <span>
                      {hasSubmitted && chosenVal !== null
                        ? formatSignedNumber(chosenVal)
                        : directInput === ''
                        ? <span className="text-slate-400 text-base">Ketik jawaban...</span>
                        : directInput}
                    </span>
                    {hasSubmitted && !isGraded && (
                      <span className="text-[10px] font-semibold text-blue-700">Dipilih · Memeriksa...</span>
                    )}
                    {isGraded && (
                      <span
                        className={`text-[10px] font-bold ${
                          gradedIsCorrect ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {gradedIsCorrect ? '✓ Jawabanmu Benar' : '✗ Jawabanmu Kurang Tepat'}
                      </span>
                    )}
                  </div>

                  {!hasSubmitted && !isGraded && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'SIGN', '0', 'BACK'].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleKeypadPress(k)}
                            className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 font-math font-bold text-lg text-slate-900 cursor-pointer"
                          >
                            {k === 'SIGN' ? '+/−' : k === 'BACK' ? '⌫' : k}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={parsedDirect === null || submitting || room.status === 'PAUSED'}
                        onClick={() => parsedDirect !== null && handleSubmitNumber(parsedDirect)}
                        className="w-full min-h-[50px] rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-bold text-base cursor-pointer"
                      >
                        Kirim Jawaban
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Immediate Pending Verification Notice */}
              {hasSubmitted && !isGraded && (
                <div className="py-3 px-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-xs font-semibold text-blue-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Pilihanmu (<strong className="font-math">{chosenVal !== null ? formatSignedNumber(chosenVal) : ''}</strong>) sedang dikonfirmasi...
                  </span>
                </div>
              )}

              {/* Immediate Confirmation Banner + Early Advance Button */}
              {isGraded && (
                <div
                  className={`rounded-2xl border p-4 space-y-3 ${
                    outcomeForRound?.isTimeout
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : gradedIsCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {outcomeForRound?.isTimeout ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : gradedIsCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-extrabold text-sm">
                        {outcomeForRound?.isTimeout
                          ? 'Waktu Ronde Habis'
                          : gradedIsCorrect
                          ? 'Konfirmasi: Jawaban Benar!'
                          : 'Konfirmasi: Jawaban Kurang Tepat'}
                      </div>
                      <p className="text-xs mt-0.5 opacity-90">
                        {outcomeForRound
                          ? outcomeForRound.message
                          : gradedIsCorrect
                          ? 'Bagus sekali! Posisimu sudah diperbarui.'
                          : 'Tetap semangat, coba lagi di ronde berikutnya!'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-xl px-3 py-2 text-xs font-math flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Jawaban benar:{' '}
                      <strong>
                        {gradedCorrectAnswer !== undefined ? formatSignedNumber(gradedCorrectAnswer) : '—'}
                      </strong>
                    </span>
                    {outcomeForRound && (
                      <span>
                        Tile #{outcomeForRound.fromPosition} → <strong>Tile #{outcomeForRound.toPosition}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>
                      Posisi: <strong className="font-math">Tile #{me.position}</strong> · Peringkat{' '}
                      <strong className="font-math">#{myRank}/{rankedPlayers.length || 1}</strong>
                    </span>
                    {outcomeForRound && (
                      <span className="font-math">
                        +{outcomeForRound.xpEarned} XP · +{outcomeForRound.goldEarned} Koin
                      </span>
                    )}
                  </div>

                  {canProceedToNext ? (
                    <button
                      type="button"
                      disabled={!isNextRoundReady}
                      onClick={handleProceedNextRound}
                      className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-display font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span>
                        {isNextRoundReady
                          ? `Lanjut ke Ronde ${nextRoundNum} Sekarang`
                          : `Menyiapkan Ronde ${nextRoundNum}...`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    !me.finished &&
                    activeRoundNumber >= room.settings.totalRounds && (
                      <div className="text-xs text-center font-semibold bg-white/70 rounded-xl py-2 px-3">
                        Kamu telah menyelesaikan semua {room.settings.totalRounds} ronde! Menunggu hasil akhir kelas...
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Waiting notice if student advanced ahead and next round is still initializing */}
      {!me.finished && (!activeRound || !myQuestion) && room.status === 'PLAYING' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-2 shadow-sm">
          <Clock className="w-8 h-8 text-blue-600 mx-auto animate-pulse" />
          <div className="font-display font-bold text-base text-slate-900">
            Menyiapkan Ronde {activeRoundNumber}...
          </div>
          <p className="text-xs text-slate-500">
            Soal dan dadu barumu sedang dimuat.
          </p>
        </div>
      )}

      {/* Compact Board / Leaderboard Overlay Modal */}
      {overlayModal !== 'NONE' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                {overlayModal === 'BOARD' ? 'Papan Ular Tangga' : 'Papan Peringkat Kelas'}
              </h3>
              <button
                type="button"
                onClick={() => setOverlayModal('NONE')}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {overlayModal === 'BOARD' ? (
                <>
                  <BoardRefreshToolbar
                    intervalSec={intervalSec}
                    onChangeInterval={setIntervalSec}
                    formattedTime={formattedTime}
                    justRefreshed={justRefreshed}
                    onRefreshNow={refreshNow}
                  />
                  <GameBoard
                    board={room.boardConfiguration}
                    players={displayedPlayers}
                    highlightPlayerId={playerId}
                  />
                </>
              ) : (
                <LeaderboardPanel players={players} highlightPlayerId={playerId} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
