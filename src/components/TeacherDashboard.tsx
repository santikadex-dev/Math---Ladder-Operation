import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Lock,
  Monitor,
  Pause,
  Play,
  SkipForward,
  Square,
  Unlock,
  UserX,
  Users,
} from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { generateBoardConfiguration } from '../engine/boardEngine';
import {
  createRoom,
  removePlayerFromRoom,
  resolveCurrentRound,
  setRoomStatus,
  startNextRound,
  subscribePlayers,
  subscribeRoom,
  subscribeRoundAnswers,
  subscribeRounds,
  syncRoomPlayerCount,
  toggleRoomLock,
} from '../services/roomService';
import type { AnswerSubmission, Player, Room, Round } from '../types/game';
import type { User } from 'firebase/auth';
import { GameBoard } from './GameBoard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { ResultsAnalyticsScreen } from './ResultsAnalyticsScreen';
import { RoundSummaryPanel } from './RoundSummaryPanel';

interface TeacherDashboardProps {
  roomCode: string;
  teacher: User;
  onOpenProjector: (code: string) => void;
  onSwitchRoom: (newCode: string) => void;
  onNewSetup: () => void;
  onExitHome: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  roomCode,
  teacher,
  onOpenProjector,
  onSwitchRoom,
  onNewSetup,
  onExitHome,
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundAnswers, setRoundAnswers] = useState<AnswerSubmission[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const usedPromptsRef = useRef<Set<string>>(new Set());
  const resolvingRef = useRef<string | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubRoom = subscribeRoom(roomCode, setRoom);
    const unsubPlayers = subscribePlayers(roomCode, setPlayers);
    const unsubRounds = subscribeRounds(roomCode, setRounds);
    return () => {
      unsubRoom();
      unsubPlayers();
      unsubRounds();
    };
  }, [roomCode]);

  const activePlayers = useMemo(
    () => players.filter((p) => p.status !== 'REMOVED'),
    [players]
  );

  // Sync playerCount cleanly by teacher host only
  useEffect(() => {
    if (!room || room.status === 'FINISHED') return;
    if (room.playerCount !== activePlayers.length) {
      syncRoomPlayerCount(room.roomCode, activePlayers.length);
    }
  }, [room, activePlayers.length]);

  const currentRound = rounds[rounds.length - 1] ?? null;
  const currentRoundId = currentRound ? `round_${currentRound.roundNumber}` : null;

  useEffect(() => {
    if (!room || !currentRoundId) {
      setRoundAnswers([]);
      return;
    }
    const unsub = subscribeRoundAnswers(room.roomCode, currentRoundId, room.teacherId, setRoundAnswers);
    return () => unsub();
  }, [room?.roomCode, room?.teacherId, currentRoundId]);

  // Countdown timer & automatic round resolution when timer expires or all unfinished players answered
  useEffect(() => {
    if (!room || !currentRound || currentRound.status !== 'ACTIVE' || room.status !== 'PLAYING') {
      setSecondsLeft(0);
      return;
    }

    const unfinishedPlayers = activePlayers.filter((p) => !p.finished);
    const answeredIds = new Set(roundAnswers.map((a) => a.playerId));
    const everyoneAnswered =
      unfinishedPlayers.length > 0 && unfinishedPlayers.every((p) => answeredIds.has(p.playerId));

    const triggerResolve = async () => {
      const key = `${room.roomCode}_${currentRound.roundNumber}`;
      if (resolvingRef.current === key) return;
      resolvingRef.current = key;
      try {
        await resolveCurrentRound(room, currentRound, players, roundAnswers);
      } finally {
        resolvingRef.current = null;
      }
    };

    if (everyoneAnswered) {
      const t = setTimeout(() => {
        void triggerResolve();
      }, 650);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => {
      const rem = Math.max(0, Math.ceil((currentRound.deadlineAt - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        clearInterval(interval);
        void triggerResolve();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [room, currentRound, activePlayers, players, roundAnswers]);

  // Automatic next round after short summary when nextRoundMode === 'AUTO'
  useEffect(() => {
    if (
      !room ||
      room.status !== 'PLAYING' ||
      room.settings.nextRoundMode !== 'AUTO' ||
      !currentRound ||
      currentRound.status !== 'RESOLVED'
    ) {
      return;
    }
    if (room.currentRound >= room.settings.totalRounds) return;
    if (autoAdvanceRef.current === currentRound.roundNumber) return;

    autoAdvanceRef.current = currentRound.roundNumber;
    const timer = setTimeout(() => {
      void startNextRound(room, players, usedPromptsRef.current);
    }, 4500);

    return () => clearTimeout(timer);
  }, [room, currentRound, players]);

  if (!room) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <p className="text-slate-600 text-sm">Memuat dashboard guru untuk ruangan {roomCode}...</p>
        </div>
      </div>
    );
  }

  if (room.status === 'FINISHED') {
    const handleReplay = async (randomize: boolean) => {
      setBusyAction(true);
      try {
        const nextSettings = { ...room.settings, randomizeBoard: randomize };
        const nextBoard = randomize ? generateBoardConfiguration(nextSettings) : room.boardConfiguration;
        const newCode = await createRoom(teacher, room.title, nextSettings, nextBoard);
        onSwitchRoom(newCode);
      } finally {
        setBusyAction(false);
      }
    };

    return (
      <ResultsAnalyticsScreen
        room={room}
        players={players}
        isTeacher
        isDemo={false}
        onPlayAgainSameBoard={() => handleReplay(false)}
        onPlayAgainNewBoard={() => handleReplay(true)}
        onNewSetup={onNewSetup}
        onExitHome={onExitHome}
      />
    );
  }

  const joinUrl = `${window.location.origin}${window.location.pathname}?join=${room.roomCode}`;
  const boardUrl = `${window.location.origin}${window.location.pathname}?board=${room.roomCode}`;

  const handleCopy = (text: string, which: 'code' | 'link') => {
    navigator.clipboard?.writeText(text);
    if (which === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const handleStartGame = async () => {
    if (activePlayers.length === 0 || busyAction) return;
    setBusyAction(true);
    try {
      await setRoomStatus(room.roomCode, 'COUNTDOWN');
      setCountdownNum(3);
      setTimeout(() => setCountdownNum(2), 1000);
      setTimeout(() => setCountdownNum(1), 2000);
      setTimeout(async () => {
        setCountdownNum(null);
        await startNextRound(room, players, usedPromptsRef.current);
        setBusyAction(false);
      }, 3000);
    } catch {
      setBusyAction(false);
      setCountdownNum(null);
    }
  };

  const handleManualNextRound = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      await startNextRound(room, players, usedPromptsRef.current);
    } finally {
      setBusyAction(false);
    }
  };

  const handleTogglePause = async () => {
    if (room.status === 'PLAYING') {
      await setRoomStatus(room.roomCode, 'PAUSED');
    } else if (room.status === 'PAUSED') {
      await setRoomStatus(room.roomCode, 'PLAYING');
    }
  };

  const handleEndGame = async () => {
    await setRoomStatus(room.roomCode, 'FINISHED');
  };

  const answeredSet = new Set(roundAnswers.map((a) => a.playerId));

  // LOBBY VIEW (WAITING / COUNTDOWN)
  if (room.status === 'WAITING' || room.status === 'COUNTDOWN') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <span>Lobi Guru</span>
                <span aria-hidden="true">·</span>
                <span>{room.title}</span>
                <span aria-hidden="true">·</span>
                <span>{room.settings.totalRounds} Ronde</span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Kode Ruangan Kelas</div>
                  <div className="font-math text-4xl sm:text-5xl font-extrabold tracking-wider text-blue-700">
                    {room.roomCode}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(room.roomCode, 'code')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Tersalin' : 'Salin Kode'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(joinUrl, 'link')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Tautan Tersalin' : 'Salin Tautan Siswa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProjector(room.roomCode)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Buka Layar Proyektor
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={activePlayers.length === 0 || busyAction}
                  onClick={handleStartGame}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-display font-bold text-base shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  {countdownNum !== null ? `Mulai dalam ${countdownNum}...` : 'Mulai Permainan'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleRoomLock(room.roomCode, !room.locked)}
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer ${
                    room.locked
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {room.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {room.locked ? 'Lobi Terkunci' : 'Kunci Lobi'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <QRCodeSVG value={joinUrl} size={148} level="M" />
              <span className="text-xs font-medium text-slate-600 mt-2.5 text-center">
                Pindai QR untuk bergabung dari HP siswa
              </span>
            </div>
          </div>
        </div>

        {/* Joined Students List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="font-display font-bold text-lg text-slate-900">
                Siswa Bergabung ({activePlayers.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Tautan Proyektor: <span className="font-math">{boardUrl}</span>
            </span>
          </div>

          {activePlayers.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">
              Menunggu siswa bergabung menggunakan kode <strong className="font-math text-slate-800">{room.roomCode}</strong>...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {activePlayers.map((p) => {
                const av = AVATARS.find((a) => a.id === p.avatar) || AVATARS[0];
                return (
                  <div
                    key={p.playerId}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{ backgroundColor: p.color || av.color }}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 border-white shadow-sm shrink-0"
                      >
                        {av.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 truncate">{p.displayName}</div>
                        <div className="text-[11px] text-emerald-700 font-medium">
                          {p.connected ? 'Terhubung' : 'Terputus'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      title={`Keluarkan ${p.displayName}`}
                      onClick={() => removePlayerFromRoom(room.roomCode, p.playerId)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIVE GAME TEACHER DASHBOARD
  const unfinishedCount = activePlayers.filter((p) => !p.finished).length;
  const answeredCount = activePlayers.filter((p) => !p.finished && answeredSet.has(p.playerId)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Live Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 font-medium">
            {room.roomCode} · {room.title} · Status: <strong>{room.status === 'PAUSED' ? 'Dijeda' : 'Berlangsung'}</strong>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="font-display font-bold text-lg text-slate-900 font-math">
              Ronde {room.currentRound} / {room.settings.totalRounds}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-math font-semibold text-amber-600">
              <Clock className="w-4 h-4" /> {secondsLeft}s
            </span>
            <span className="text-xs font-math text-slate-600">
              Menjawab: {answeredCount}/{unfinishedCount}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenProjector(room.roomCode)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Monitor className="w-4 h-4" /> Layar Proyektor
          </button>

          <button
            type="button"
            onClick={handleTogglePause}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            {room.status === 'PAUSED' ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4 text-amber-600" />}
            {room.status === 'PAUSED' ? 'Lanjutkan' : 'Jeda'}
          </button>

          {currentRound?.status === 'RESOLVED' && room.currentRound < room.settings.totalRounds && (
            <button
              type="button"
              disabled={busyAction}
              onClick={handleManualNextRound}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <SkipForward className="w-4 h-4" /> Ronde Berikutnya
            </button>
          )}

          {currentRound?.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => resolveCurrentRound(room, currentRound, players, roundAnswers)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Selesaikan Ronde Ini
            </button>
          )}

          <button
            type="button"
            onClick={handleEndGame}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" /> Akhiri Game
          </button>
        </div>
      </div>

      {/* Main 2-Column Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <GameBoard board={room.boardConfiguration} players={players} />
        </div>

        <div className="lg:col-span-5 space-y-5">
          {/* Student Answer Status Monitor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-3">
              Status Jawaban Ronde {room.currentRound}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
              {activePlayers.map((p) => {
                const done = p.finished || answeredSet.has(p.playerId);
                return (
                  <div
                    key={p.playerId}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-1 ${
                      p.finished
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="truncate font-medium">{p.displayName}</span>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                  </div>
                );
              })}
            </div>
          </div>

          <RoundSummaryPanel summary={currentRound?.resultSummary} />
          <LeaderboardPanel players={players} maxRows={10} />
        </div>
      </div>
    </div>
  );
};
