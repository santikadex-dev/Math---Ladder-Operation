import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Monitor,
  Pause,
  Play,
  SkipForward,
  Smartphone,
  Square,
} from 'lucide-react';
import { generateBoardConfiguration } from '../engine/boardEngine';
import {
  createInitialDemoSession,
  DEMO_HUMAN_ID,
  resolveDemoRound,
  startDemoRound,
  type DemoSessionState,
} from '../services/demoEngine';
import type { BoardConfiguration, GameSettings } from '../types/game';
import { GameBoard } from './GameBoard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { ProjectorBoardScreen } from './ProjectorBoardScreen';
import { ResultsAnalyticsScreen } from './ResultsAnalyticsScreen';
import { RoundSummaryPanel } from './RoundSummaryPanel';
import { StudentGameScreen } from './StudentGameScreen';

interface DemoModeWorkspaceProps {
  initialSettings: GameSettings;
  initialBoard: BoardConfiguration;
  onEditSetup: () => void;
  onExitHome: () => void;
}

export const DemoModeWorkspace: React.FC<DemoModeWorkspaceProps> = ({
  initialSettings,
  initialBoard,
  onEditSetup,
  onExitHome,
}) => {
  const [demoState, setDemoState] = useState<DemoSessionState>(() =>
    createInitialDemoSession(initialSettings, initialBoard)
  );
  const [mobileTab, setMobileTab] = useState<'STUDENT' | 'BOARD'>('STUDENT');
  const [projectorView, setProjectorView] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const usedPromptsRef = useRef<Set<string>>(new Set());

  const { room, players, rounds, humanSubmittedAnswer } = demoState;
  const currentRound = rounds[rounds.length - 1] ?? null;

  // Countdown timer & auto-resolve in Demo Mode
  useEffect(() => {
    if (!currentRound || currentRound.status !== 'ACTIVE' || room.status !== 'PLAYING') {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const rem = Math.max(0, Math.ceil((currentRound.deadlineAt - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        setDemoState((prev) => resolveDemoRound(prev));
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [currentRound?.roundNumber, currentRound?.status, currentRound?.deadlineAt, room.status]);

  // Auto-resolve shortly after human submits answer (simulating bots finishing)
  useEffect(() => {
    if (
      humanSubmittedAnswer !== null &&
      currentRound?.status === 'ACTIVE' &&
      room.status === 'PLAYING'
    ) {
      const t = setTimeout(() => {
        setDemoState((prev) => resolveDemoRound(prev));
      }, 950);
      return () => clearTimeout(t);
    }
  }, [humanSubmittedAnswer, currentRound?.status, room.status]);

  // Auto-advance to next round after short summary when nextRoundMode === 'AUTO'
  useEffect(() => {
    if (
      room.status === 'PLAYING' &&
      room.settings.nextRoundMode === 'AUTO' &&
      currentRound?.status === 'RESOLVED' &&
      room.currentRound < room.settings.totalRounds
    ) {
      const t = setTimeout(() => {
        setDemoState((prev) => startDemoRound(prev, usedPromptsRef.current));
      }, 3600);
      return () => clearTimeout(t);
    }
  }, [room.status, room.settings.nextRoundMode, room.currentRound, room.settings.totalRounds, currentRound?.status]);

  if (projectorView) {
    return (
      <ProjectorBoardScreen
        roomCode={room.roomCode}
        initialRoom={room}
        initialPlayers={players}
        initialRounds={rounds}
        isDemo
        onExit={() => setProjectorView(false)}
      />
    );
  }

  if (room.status === 'FINISHED') {
    return (
      <div>
        <div className="bg-amber-400 text-slate-950 text-xs font-bold text-center py-2 px-4">
          DEMO MODE — Simulasi Lokal dengan 6 Pemain Virtual (Bukan Koneksi Multipemain Nyata)
        </div>
        <ResultsAnalyticsScreen
          room={room}
          players={players}
          isTeacher
          isDemo
          onPlayAgainSameBoard={() => {
            usedPromptsRef.current.clear();
            setDemoState(createInitialDemoSession(room.settings, room.boardConfiguration));
          }}
          onPlayAgainNewBoard={() => {
            usedPromptsRef.current.clear();
            const newBoard = generateBoardConfiguration({ ...room.settings, randomizeBoard: true });
            setDemoState(createInitialDemoSession(room.settings, newBoard));
          }}
          onNewSetup={onEditSetup}
          onExitHome={onExitHome}
        />
      </div>
    );
  }

  const handleStartDemoGame = () => {
    setDemoState((prev) => startDemoRound(prev, usedPromptsRef.current));
  };

  const handlePauseResume = () => {
    setDemoState((prev) => ({
      ...prev,
      room: {
        ...prev.room,
        status: prev.room.status === 'PAUSED' ? 'PLAYING' : 'PAUSED',
      },
    }));
  };

  const handleEndDemoGame = () => {
    setDemoState((prev) => ({
      ...prev,
      room: { ...prev.room, status: 'FINISHED', finishedAt: Date.now() },
    }));
  };

  const handleHumanSubmit = (val: number) => {
    setDemoState((prev) => ({
      ...prev,
      humanSubmittedAnswer: val,
      humanSubmittedAtMs: Date.now(),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Unmistakable DEMO MODE Banner */}
      <div className="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          DEMO MODE: Simulasi Lokal (6 teman kelas adalah bot simulasi, bukan perangkat nyata).
        </span>
      </div>

      {/* Teacher Demo Control Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500 font-medium">
              Panel Kontrol Guru (Demo) · {room.settings.totalRounds} Ronde · Penalti {room.settings.wrongPenalty}
            </div>
            <div className="flex items-center gap-4 mt-0.5">
              <span className="font-display font-bold text-lg text-slate-900 font-math">
                Ronde {room.currentRound} / {room.settings.totalRounds}
              </span>
              {currentRound?.status === 'ACTIVE' && (
                <span className="inline-flex items-center gap-1 font-math font-bold text-sm text-amber-600">
                  <Clock className="w-4 h-4" /> {secondsLeft}s
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {room.status === 'WAITING' ? (
              <button
                type="button"
                onClick={handleStartDemoGame}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <Play className="w-4 h-4" /> Mulai Simulasi Ronde 1
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePauseResume}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {room.status === 'PAUSED' ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4 text-amber-600" />}
                  {room.status === 'PAUSED' ? 'Lanjutkan' : 'Jeda'}
                </button>

                {currentRound?.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => setDemoState((prev) => resolveDemoRound(prev))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Proses Ronde Sekarang
                  </button>
                )}

                {currentRound?.status === 'RESOLVED' && room.currentRound < room.settings.totalRounds && (
                  <button
                    type="button"
                    onClick={() => setDemoState((prev) => startDemoRound(prev, usedPromptsRef.current))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" /> Ronde Berikutnya
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEndDemoGame}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" /> Akhiri & Lihat Hasil
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setProjectorView(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Monitor className="w-4 h-4" /> Layar Proyektor
            </button>

            <button
              type="button"
              onClick={onEditSetup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Ubah Pengaturan
            </button>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="lg:hidden mt-3 flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <button
            type="button"
            onClick={() => setMobileTab('STUDENT')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'STUDENT' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Layar Siswa
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('BOARD')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'BOARD' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Papan & Peringkat
          </button>
        </div>
      </div>

      {/* Split Workspace: Student Phone Frame (Left) + Classroom Board & Leaderboard (Right) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={`lg:col-span-4 ${mobileTab === 'STUDENT' ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-slate-900 rounded-[2rem] p-2.5 shadow-xl border-4 border-slate-800">
            <div className="bg-slate-50 rounded-[1.5rem] overflow-hidden min-h-[540px]">
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span>Simulasi Layar HP Siswa</span>
                {room.status === 'WAITING' && (
                  <button
                    type="button"
                    onClick={handleStartDemoGame}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    Mulai Sekarang
                  </button>
                )}
              </div>
              <StudentGameScreen
                roomCode={room.roomCode}
                playerId={DEMO_HUMAN_ID}
                isDemo
                demoRoom={room}
                demoPlayers={players}
                demoRounds={rounds}
                demoSubmittedAnswer={humanSubmittedAnswer}
                onDemoSubmitAnswer={handleHumanSubmit}
                onExitHome={onExitHome}
              />
            </div>
          </div>
        </div>

        <div className={`lg:col-span-8 space-y-5 ${mobileTab === 'BOARD' ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <GameBoard board={room.boardConfiguration} players={players} highlightPlayerId={DEMO_HUMAN_ID} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <LeaderboardPanel players={players} highlightPlayerId={DEMO_HUMAN_ID} />
            <RoundSummaryPanel summary={currentRound?.resultSummary} />
          </div>
        </div>
      </div>
    </div>
  );
};
