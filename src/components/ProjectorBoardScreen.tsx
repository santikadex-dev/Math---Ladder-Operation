import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, LayoutGrid, ListOrdered, Sparkles } from 'lucide-react';
import { subscribePlayers, subscribeRoom, subscribeRounds } from '../services/roomService';
import type { Player, Room, Round } from '../types/game';
import { GameBoard } from './GameBoard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { RoundSummaryPanel } from './RoundSummaryPanel';

interface ProjectorBoardScreenProps {
  roomCode: string;
  initialRoom?: Room | null;
  initialPlayers?: Player[];
  initialRounds?: Round[];
  isDemo?: boolean;
  onExit?: () => void;
}

type ProjectorTab = 'FULL_BOARD' | 'LEADERBOARD' | 'ROUND_SUMMARY';

export const ProjectorBoardScreen: React.FC<ProjectorBoardScreenProps> = ({
  roomCode,
  initialRoom = null,
  initialPlayers = [],
  initialRounds = [],
  isDemo = false,
  onExit,
}) => {
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [rounds, setRounds] = useState<Round[]>(initialRounds);
  const [tab, setTab] = useState<ProjectorTab>('FULL_BOARD');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (isDemo) {
      setRoom(initialRoom);
      setPlayers(initialPlayers);
      setRounds(initialRounds);
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
  }, [roomCode, isDemo, initialRoom, initialPlayers, initialRounds]);

  const currentRound = rounds[rounds.length - 1] ?? null;
  const lastResolved = [...rounds].reverse().find((r) => r.status === 'RESOLVED') ?? null;

  useEffect(() => {
    const tick = () => {
      if (!currentRound || currentRound.status !== 'ACTIVE' || room?.status === 'PAUSED') {
        setSecondsLeft(0);
        return;
      }
      const rem = Math.max(0, Math.ceil((currentRound.deadlineAt - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [currentRound, room?.status]);

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="font-display text-2xl font-bold">Memuat Papan Proyektor...</div>
          <p className="text-sm text-slate-400">Kode Ruangan: {roomCode}</p>
        </div>
      </div>
    );
  }

  const activeCount = players.filter((p) => p.status !== 'REMOVED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 flex flex-col">
      {/* Projector Header */}
      <header className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-4">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
          )}
          <div>
            <div className="text-xs font-semibold text-sky-400">
              {isDemo ? 'DEMO MODE · ' : ''}LAYAR PAPAN KELAS · {room.roomCode}
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{room.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400">Ronde</div>
            <div className="font-math text-xl font-bold text-white">
              {room.currentRound} / {room.settings.totalRounds}
            </div>
          </div>

          <div
            className={`px-4 py-2 rounded-xl border text-center ${
              secondsLeft > 0 && secondsLeft <= 5
                ? 'bg-rose-950/70 border-rose-500 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-amber-400'
            }`}
          >
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Sisa Waktu
            </div>
            <div className="font-math text-xl font-bold">{secondsLeft}s</div>
          </div>

          <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setTab('FULL_BOARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'FULL_BOARD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Papan Penuh
            </button>
            <button
              type="button"
              onClick={() => setTab('LEADERBOARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'LEADERBOARD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" /> Peringkat
            </button>
            <button
              type="button"
              onClick={() => setTab('ROUND_SUMMARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'ROUND_SUMMARY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Ringkasan Ronde
            </button>
          </div>
        </div>
      </header>

      {/* Main Projector Stage */}
      <main className="max-w-7xl w-full mx-auto flex-1">
        {tab === 'FULL_BOARD' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8">
              <GameBoard board={room.boardConfiguration} players={players} darkTheme />
            </div>
            <div className="xl:col-span-4 space-y-4">
              <div className="text-xs text-slate-400 font-medium">
                Status: <strong className="text-white">{room.status}</strong> · {activeCount} Siswa Terhubung
              </div>
              <LeaderboardPanel players={players} darkTheme maxRows={8} />
              <RoundSummaryPanel summary={lastResolved?.resultSummary} darkTheme />
            </div>
          </div>
        )}

        {tab === 'LEADERBOARD' && (
          <div className="max-w-3xl mx-auto">
            <LeaderboardPanel players={players} darkTheme />
          </div>
        )}

        {tab === 'ROUND_SUMMARY' && (
          <div className="max-w-3xl mx-auto">
            <RoundSummaryPanel summary={lastResolved?.resultSummary} darkTheme />
          </div>
        )}
      </main>
    </div>
  );
};
