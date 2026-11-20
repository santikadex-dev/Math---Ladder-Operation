import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Dices,
  Flame,
  LayoutGrid,
  Shield,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import {
  subscribeMyAnswer,
  subscribePlayers,
  subscribeRoom,
  subscribeRounds,
  submitStudentAnswer,
  updatePlayerHeartbeat,
} from '../services/roomService';
import type { AnswerSubmission, Player, Room, Round } from '../types/game';
import { soundFx } from '../utils/sound';
import { DiceWidget } from './DiceWidget';
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
  demoSubmittedAnswer?: number | null;
  onDemoSubmitAnswer?: (val: number) => void;
  onExitHome: () => void;
}

export const StudentGameScreen: React.FC<StudentGameScreenProps> = ({
  roomCode,
  playerId,
  isDemo = false,
  demoRoom,
  demoPlayers,
  demoRounds,
  demoSubmittedAnswer = null,
  onDemoSubmitAnswer,
  onExitHome,
}) => {
  const [room, setRoom] = useState<Room | null>(demoRoom ?? null);
  const [players, setPlayers] = useState<Player[]>(demoPlayers ?? []);
  const [rounds, setRounds] = useState<Round[]>(demoRounds ?? []);
  const [myAnswer, setMyAnswer] = useState<AnswerSubmission | null>(null);

  const [rolledRound, setRolledRound] = useState<number>(0);
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [directInput, setDirectInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [overlayModal, setOverlayModal] = useState<'NONE' | 'LEADERBOARD' | 'BOARD'>('NONE');
  const [lastSoundRound, setLastSoundRound] = useState(0);

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

  // Connection heartbeat in real mode
  useEffect(() => {
    if (isDemo || !roomCode || !playerId) return;
    void updatePlayerHeartbeat(roomCode, playerId, true);
    const id = setInterval(() => {
      void updatePlayerHeartbeat(roomCode, playerId, true);
    }, 25000);
    return () => clearInterval(id);
  }, [roomCode, playerId, isDemo]);

  const currentRound = rounds[rounds.length - 1] ?? null;
  const currentRoundId = currentRound ? `round_${currentRound.roundNumber}` : null;

  useEffect(() => {
    if (isDemo) {
      setMyAnswer(
        demoSubmittedAnswer !== null && currentRoundId
          ? {
              playerId,
              teacherId: 'demo_teacher',
              roomId: roomCode,
              roundId: currentRoundId,
              submittedAnswer: demoSubmittedAnswer,
              submittedAt: Date.now(),
            }
          : null
      );
      return;
    }
    if (!currentRoundId) {
      setMyAnswer(null);
      return;
    }
    const unsub = subscribeMyAnswer(roomCode, currentRoundId, playerId, setMyAnswer);
    return () => unsub();
  }, [roomCode, currentRoundId, playerId, isDemo, demoSubmittedAnswer]);

  // Clear local input when a new round starts
  useEffect(() => {
    if (currentRound && currentRound.status === 'ACTIVE') {
      setDirectInput('');
    }
  }, [currentRound?.roundNumber]);

  // Timer countdown
  useEffect(() => {
    if (!currentRound || currentRound.status !== 'ACTIVE' || room?.status === 'PAUSED') {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((currentRound.deadlineAt - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [currentRound, room?.status]);

  const me = players.find((p) => p.playerId === playerId) ?? null;

  // Outcome sound FX once per resolved round
  useEffect(() => {
    if (!me?.lastOutcome) return;
    if (me.lastOutcome.roundNumber !== lastSoundRound) {
      setLastSoundRound(me.lastOutcome.roundNumber);
      if (me.lastOutcome.ladderTo) soundFx.ladder();
      else if (me.lastOutcome.snakeTo) soundFx.snake();
      else if (me.lastOutcome.isCorrect) soundFx.correct();
      else soundFx.wrong();
    }
  }, [me?.lastOutcome, lastSoundRound]);

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
  const myQuestion = currentRound?.questions?.[playerId] ?? null;
  const myDice = currentRound?.diceResults?.[playerId] ?? 1;
  const hasRolledThisRound = currentRound ? rolledRound >= currentRound.roundNumber : false;
  const hasSubmitted = myAnswer !== null;

  const handleRollDice = () => {
    if (!currentRound || isRollingAnim) return;
    soundFx.diceRoll();
    setIsRollingAnim(true);
    setTimeout(() => {
      setIsRollingAnim(false);
      setRolledRound(currentRound.roundNumber);
    }, 600);
  };

  const handleSubmitNumber = async (num: number) => {
    if (!currentRound || hasSubmitted || submitting || currentRound.status !== 'ACTIVE') return;
    if (isDemo && onDemoSubmitAnswer) {
      onDemoSubmitAnswer(num);
      return;
    }
    setSubmitting(true);
    try {
      await submitStudentAnswer({
        roomCode: room.roomCode,
        teacherId: room.teacherId,
        roundId: `round_${currentRound.roundNumber}`,
        playerId,
        submittedAnswer: num,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeypadPress = (key: string) => {
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

  const parsedDirect = directInput !== '' && directInput !== '-' ? Number(directInput) : null;

  return (
    <div className="max-w-md mx-auto px-3 py-3 space-y-3 pb-6">
      {/* Compact Top Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-3.5 py-2.5 flex items-center justify-between gap-2">
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
              <span>Petak {me.position}</span>
              <span aria-hidden="true">·</span>
              <span>{me.xp} XP</span>
              {me.streak >= 2 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-orange-600 inline-flex items-center">
                    <Flame className="w-3 h-3" /> {me.streak}
                  </span>
                </>
              )}
              {me.shield && <Shield className="w-3 h-3 text-sky-600" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setOverlayModal('BOARD')}
            className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Lihat Papan"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setOverlayModal('LEADERBOARD')}
            className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            title="Papan Peringkat"
          >
            <Trophy className="w-4 h-4 text-amber-600" />
          </button>
        </div>
      </div>

      {/* Finished Banner for Student who reached 100 */}
      {me.finished && (
        <div className="bg-emerald-600 text-white rounded-3xl p-6 text-center space-y-2 shadow-lg">
          <Sparkles className="w-10 h-10 mx-auto text-amber-300" />
          <h2 className="font-display text-2xl font-extrabold">Kamu Sudah Finish!</h2>
          <p className="text-sm text-emerald-100">
            Kamu mencapai petak {room.boardConfiguration.boardSize} pada ronde {me.finishedRound}. Menunggu teman sekelas menyelesaikan permainan!
          </p>
        </div>
      )}

      {/* Paused Notice */}
      {room.status === 'PAUSED' && !me.finished && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-center text-amber-900 text-sm font-semibold">
          Permainan dijeda sementara oleh guru.
        </div>
      )}

      {/* Active Round Card */}
      {!me.finished && currentRound && currentRound.status === 'ACTIVE' && myQuestion && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {/* Round & Timer Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 font-math">
              RONDE {currentRound.roundNumber} / {room.settings.totalRounds}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-math font-bold text-sm ${
                secondsLeft <= 5 ? 'text-rose-600' : 'text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" /> {secondsLeft} detik
            </span>
          </div>

          {/* Progress Timer Bar */}
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

          {/* Step 1: Roll Dice */}
          {!hasRolledThisRound ? (
            <div className="py-6 text-center space-y-4">
              <DiceWidget value={isRollingAnim ? Math.floor(Math.random() * 6) + 1 : myDice} rolling={isRollingAnim} size="lg" />
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Giliran Melempar Dadu!</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ketuk tombol di bawah untuk melihat langkahmu dan membuka soal ronde ini.
                </p>
              </div>
              <button
                type="button"
                disabled={isRollingAnim || room.status === 'PAUSED'}
                onClick={handleRollDice}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-display font-extrabold text-base shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Dices className="w-5 h-5" />
                {isRollingAnim ? 'Mengocok Dadu...' : 'Lempar Dadu Sekarang'}
              </button>
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

              {/* Answer Input Area */}
              {hasSubmitted ? (
                <div className="py-5 px-4 rounded-2xl bg-sky-50 border border-sky-200 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-blue-600 mx-auto" />
                  <div className="font-display font-bold text-base text-slate-900">
                    Jawaban Terkirim: <span className="font-math">{myAnswer?.submittedAnswer}</span>
                  </div>
                  <p className="text-xs text-slate-600">Menunggu siswa lain atau waktu ronde selesai...</p>
                </div>
              ) : myQuestion.answerMode === 'MULTIPLE_CHOICE' && myQuestion.options ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {myQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={submitting || room.status === 'PAUSED'}
                      onClick={() => handleSubmitNumber(opt)}
                      className="min-h-[56px] py-3 px-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50 active:scale-[0.98] transition-all font-math text-xl font-bold text-slate-900 cursor-pointer"
                    >
                      {opt < 0 ? `−${Math.abs(opt)}` : opt}
                    </button>
                  ))}
                </div>
              ) : (
                /* Mobile Numeric Keypad for Direct Input */
                <div className="space-y-2.5">
                  <div className="px-4 py-3 rounded-2xl border-2 border-slate-300 bg-slate-50 text-center font-math text-2xl font-bold text-slate-900 min-h-[52px]">
                    {directInput === '' ? <span className="text-slate-400 text-base">Ketik jawaban...</span> : directInput}
                  </div>
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
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Round Resolved Encouraging Feedback */}
      {!me.finished && currentRound && currentRound.status === 'RESOLVED' && me.lastOutcome && (
        <div
          className={`rounded-3xl border p-5 space-y-3 shadow-sm ${
            me.lastOutcome.isCorrect
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : me.lastOutcome.isTimeout
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>HASIL RONDE {me.lastOutcome.roundNumber}</span>
            <span className="font-math">Petak {me.lastOutcome.fromPosition} → {me.lastOutcome.toPosition}</span>
          </div>

          <h2 className="font-display text-lg font-extrabold">{me.lastOutcome.message}</h2>

          <div className="text-xs font-math bg-white/70 rounded-xl px-3 py-2 flex items-center justify-between">
            <span>Jawaban benar: {me.lastOutcome.correctAnswer < 0 ? `−${Math.abs(me.lastOutcome.correctAnswer)}` : me.lastOutcome.correctAnswer}</span>
            <span>+{me.lastOutcome.xpEarned} XP · +{me.lastOutcome.goldEarned} Koin</span>
          </div>

          <p className="text-xs opacity-80">Menunggu ronde berikutnya dimulai...</p>
        </div>
      )}

      {/* Compact Board / Leaderboard Overlay Modal */}
      {overlayModal !== 'NONE' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                {overlayModal === 'BOARD' ? 'Papan Permainan' : 'Papan Peringkat Kelas'}
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
                <GameBoard board={room.boardConfiguration} players={players} highlightPlayerId={playerId} />
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
