import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { LogIn, LogOut, Music, Volume2, VolumeX } from 'lucide-react';
import { DEFAULT_SETTINGS } from './constants/gameDefaults';
import { DemoModeWorkspace } from './components/DemoModeWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './components/HomeScreen';
import { ProjectorBoardScreen } from './components/ProjectorBoardScreen';
import { StudentGameScreen } from './components/StudentGameScreen';
import { StudentJoinScreen } from './components/StudentJoinScreen';
import { TeacherDashboard } from './components/TeacherDashboard';
import { TeacherSetupWizard } from './components/TeacherSetupWizard';
import { generateBoardConfiguration } from './engine/boardEngine';
import { auth, isFirebaseConfigured, signInWithGoogle, signOutUser } from './services/firebaseService';
import { createRoom, normalizeRoomCode } from './services/roomService';
import type { BoardConfiguration, GameSettings } from './types/game';
import { setBgmMuted, setSoundMuted } from './utils/sound';

type ScreenView =
  | { name: 'HOME' }
  | { name: 'TEACHER_SETUP'; mode: 'REAL' | 'DEMO' }
  | { name: 'TEACHER_ROOM'; roomCode: string }
  | { name: 'STUDENT_JOIN'; initialCode?: string }
  | { name: 'STUDENT_GAME'; roomCode: string }
  | { name: 'PROJECTOR_BOARD'; roomCode: string }
  | { name: 'DEMO_PLAY'; settings: GameSettings; board: BoardConfiguration };

function parseInitialView(): ScreenView {
  if (typeof window === 'undefined') return { name: 'HOME' };
  const params = new URLSearchParams(window.location.search);
  const joinParam = params.get('join');
  const boardParam = params.get('board');
  if (boardParam) {
    return { name: 'PROJECTOR_BOARD', roomCode: normalizeRoomCode(boardParam) };
  }
  if (joinParam) {
    return { name: 'STUDENT_JOIN', initialCode: normalizeRoomCode(joinParam) };
  }
  return { name: 'HOME' };
}

export default function App() {
  const [view, setView] = useState<ScreenView>(parseInitialView);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured());
  const [muted, setMuted] = useState(false);
  const [bgmMuted, setBgmMutedState] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const handleToggleBgmMute = () => {
    const next = !bgmMuted;
    setBgmMutedState(next);
    setBgmMuted(next);
  };

  const handleTeacherSetupSubmit = async (
    title: string,
    settings: GameSettings,
    board: BoardConfiguration
  ) => {
    setSetupError(null);
    if (view.name === 'TEACHER_SETUP' && view.mode === 'DEMO') {
      setView({ name: 'DEMO_PLAY', settings, board });
      return;
    }

    if (!isFirebaseConfigured()) {
      setSetupError('Firebase belum dikonfigurasi. Gunakan DEMO MODE untuk simulasi lokal.');
      return;
    }

    setCreatingRoom(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await signInWithGoogle();
      }
      const code = await createRoom(activeUser, title, settings, board);
      setView({ name: 'TEACHER_ROOM', roomCode: code });
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Gagal membuat ruangan permainan.');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Dedicated full-screen Projector view without top chrome
  if (view.name === 'PROJECTOR_BOARD') {
    return (
      <ErrorBoundary>
        <ProjectorBoardScreen
          roomCode={view.roomCode}
          onExit={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setView({ name: 'HOME' });
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Clean 3-Zone Top Navigation Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => {
                window.history.replaceState({}, '', window.location.pathname);
                setView({ name: 'HOME' });
              }}
              className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Math Ladder
            </button>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setView({ name: 'HOME' })}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => setView({ name: 'TEACHER_SETUP', mode: 'REAL' })}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buat Game
              </button>
              <button
                type="button"
                onClick={() => setView({ name: 'STUDENT_JOIN' })}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Gabung Siswa
              </button>
              <button
                type="button"
                onClick={() =>
                  setView({
                    name: 'DEMO_PLAY',
                    settings: DEFAULT_SETTINGS,
                    board: generateBoardConfiguration(DEFAULT_SETTINGS),
                  })
                }
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Demo Mode
              </button>
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleBgmMute}
                aria-label={bgmMuted ? 'Nyalakan musik BGM' : 'Matikan musik BGM'}
                title={bgmMuted ? 'BGM Dimatikan (Klik untuk nyalakan)' : 'BGM Menyala (Klik untuk mute)'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  bgmMuted || muted
                    ? 'border-slate-200 bg-slate-100 text-slate-400'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{bgmMuted || muted ? 'BGM Off' : 'BGM On'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Nyalakan semua suara' : 'Bisukan semua suara'}
                title={muted ? 'Suara dibisukan' : 'Bisukan semua suara'}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {authReady && (
                user ? (
                  <button
                    type="button"
                    onClick={() => signOutUser()}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInWithGoogle().catch(() => {})}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Masuk Google
                  </button>
                )
              )}
            </div>
          </div>
        </header>

        {/* Main Screen Router */}
        <main className="flex-1">
          {view.name === 'HOME' && (
            <HomeScreen
              user={user}
              onCreateGameTeacher={() => {
                setSetupError(null);
                setView({ name: 'TEACHER_SETUP', mode: 'REAL' });
              }}
              onJoinGameStudent={() => setView({ name: 'STUDENT_JOIN' })}
              onStartDemoMode={() =>
                setView({
                  name: 'DEMO_PLAY',
                  settings: DEFAULT_SETTINGS,
                  board: generateBoardConfiguration(DEFAULT_SETTINGS),
                })
              }
              onOpenExistingRoom={(code) => setView({ name: 'TEACHER_ROOM', roomCode: code })}
            />
          )}

          {view.name === 'TEACHER_SETUP' && (
            <TeacherSetupWizard
              mode={view.mode}
              onBack={() => setView({ name: 'HOME' })}
              onSubmit={handleTeacherSetupSubmit}
              submitting={creatingRoom}
              error={setupError}
            />
          )}

          {view.name === 'TEACHER_ROOM' && user && (
            <TeacherDashboard
              roomCode={view.roomCode}
              teacher={user}
              onOpenProjector={(code) => setView({ name: 'PROJECTOR_BOARD', roomCode: code })}
              onSwitchRoom={(newCode) => setView({ name: 'TEACHER_ROOM', roomCode: newCode })}
              onNewSetup={() => setView({ name: 'TEACHER_SETUP', mode: 'REAL' })}
              onExitHome={() => setView({ name: 'HOME' })}
            />
          )}

          {view.name === 'TEACHER_ROOM' && !user && (
            <div className="max-w-md mx-auto p-8 text-center">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="font-display font-bold text-lg text-slate-900">Autentikasi Guru Diperlukan</h2>
                <p className="text-sm text-slate-600">
                  Silakan masuk dengan akun Google yang membuat ruangan ini untuk mengelola permainan.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle().catch(() => {})}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold cursor-pointer"
                >
                  Masuk dengan Google
                </button>
              </div>
            </div>
          )}

          {view.name === 'STUDENT_JOIN' && (
            <StudentJoinScreen
              initialRoomCode={view.initialCode}
              user={user}
              onBack={() => setView({ name: 'HOME' })}
              onJoined={(code) => setView({ name: 'STUDENT_GAME', roomCode: code })}
            />
          )}

          {view.name === 'STUDENT_GAME' && user && (
            <StudentGameScreen
              roomCode={view.roomCode}
              playerId={user.uid}
              onExitHome={() => setView({ name: 'HOME' })}
            />
          )}

          {view.name === 'DEMO_PLAY' && (
            <DemoModeWorkspace
              initialSettings={view.settings}
              initialBoard={view.board}
              onEditSetup={() => setView({ name: 'TEACHER_SETUP', mode: 'DEMO' })}
              onExitHome={() => setView({ name: 'HOME' })}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
