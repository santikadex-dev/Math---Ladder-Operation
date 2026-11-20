import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Award,
  CheckCircle2,
  Dices,
  History,
  LogIn,
  Play,
  Users,
  WifiOff,
} from 'lucide-react';
import { isFirebaseConfigured, signInWithGoogle, testConnection } from '../services/firebaseService';
import { getTeacherHistory } from '../services/roomService';
import type { Room } from '../types/game';

interface HomeScreenProps {
  user: User | null;
  onCreateGameTeacher: () => void;
  onJoinGameStudent: () => void;
  onStartDemoMode: () => void;
  onOpenExistingRoom: (roomCode: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  onCreateGameTeacher,
  onJoinGameStudent,
  onStartDemoMode,
  onOpenExistingRoom,
}) => {
  const [imgError, setImgError] = useState(false);
  const [connStatus, setConnStatus] = useState<'CHECKING' | 'ONLINE' | 'OFFLINE'>('CHECKING');
  const [history, setHistory] = useState<Room[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!isFirebaseConfigured()) {
      setConnStatus('OFFLINE');
      return;
    }
    testConnection().then((res) => {
      if (mounted) setConnStatus(res.ok ? 'ONLINE' : 'OFFLINE');
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user || connStatus !== 'ONLINE') {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    getTeacherHistory(user.uid)
      .then((rooms) => setHistory(rooms.slice(0, 6)))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [user, connStatus]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Main Hero 2-Column Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Ular Tangga Matematika Kelas</span>
            <span aria-hidden="true">·</span>
            {connStatus === 'ONLINE' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Multipemain Firebase Aktif
              </span>
            ) : connStatus === 'CHECKING' ? (
              <span className="text-slate-500">Memeriksa koneksi...</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <WifiOff className="w-3.5 h-3.5" /> Offline (Gunakan Demo Mode)
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance leading-[1.1]">
            MATH LADDER
          </h1>

          <p className="font-display text-lg sm:text-xl font-semibold text-blue-700">
            "Hitung, Melangkah, dan Raih Kemenangan!"
          </p>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
            Permainan papan ular tangga multipemain real-time untuk kelas SMA. Seluruh siswa melempar dadu, memecahkan soal operasi bilangan bulat serentak, menaiki tangga, dan berlomba mencapai petak 100.
          </p>

          {/* Required 3 Home Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onCreateGameTeacher}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-sm shadow-md shadow-blue-600/20 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              BUAT GAME (GURU)
            </button>

            <button
              type="button"
              onClick={onJoinGameStudent}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-display font-bold text-sm shadow-md shadow-teal-600/20 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              GABUNG GAME (SISWA)
            </button>

            <button
              type="button"
              onClick={onStartDemoMode}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-display font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Dices className="w-4 h-4 text-amber-600" />
              DEMO MODE
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          {!imgError ? (
            <img
              src="/src/assets/images/hero_board_crest_1795183861613.jpg"
              alt="Ilustrasi papan petualangan Math Ladder"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full min-h-[280px] max-h-[400px] object-cover rounded-3xl border border-slate-200 shadow-lg"
            />
          ) : (
            <div className="w-full h-full min-h-[280px] rounded-3xl bg-gradient-to-br from-blue-900 via-slate-900 to-teal-900 flex flex-col items-center justify-center p-8 text-white border border-slate-700 shadow-lg">
              <Dices className="w-16 h-16 text-amber-400 mb-3" />
              <div className="font-display text-2xl font-bold">Math Ladder: Class Race</div>
              <p className="text-sm text-slate-300 mt-1">Papan Ular Tangga Bilangan Bulat</p>
            </div>
          )}
        </div>
      </section>

      {/* Core Feature Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Ronde Serentak Kelas',
            desc: 'Semua 30–40 siswa melempar dadu dan menjawab secara bersamaan tanpa menunggu giliran.',
          },
          {
            title: 'Operasi Bilangan Bulat',
            desc: 'Penjumlahan, pengurangan, perkalian, dan pembagian bulat dengan rentang negatif yang terukur.',
          },
          {
            title: 'Layar Proyektor Khusus',
            desc: 'Tampilan papan 10×10 beresolusi tinggi yang terbaca jelas dari bangku belakang kelas.',
          },
          {
            title: 'Analitik & Laporan CSV',
            desc: 'Identifikasi operasi tersulit, kendala bilangan negatif, dan ekspor nilai kelas seketika.',
          },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-1.5">
            <h3 className="font-display font-bold text-sm text-slate-900">{item.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Teacher Game History (when signed in) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-bold text-lg text-slate-900">Riwayat Ruang Permainan Guru</h2>
          </div>

          {!user && connStatus === 'ONLINE' && (
            <button
              type="button"
              onClick={() => signInWithGoogle().catch(() => {})}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Masuk Google untuk Lihat Riwayat
            </button>
          )}
        </div>

        {!user ? (
          <p className="text-xs text-slate-500">
            Masuk sebagai guru dengan akun Google untuk melihat atau membuka kembali sesi kelas sebelumnya.
          </p>
        ) : loadingHistory ? (
          <p className="text-xs text-slate-500">Memuat riwayat ruangan...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada riwayat ruangan yang dibuat dengan akun ini. Klik <strong>BUAT GAME (GURU)</strong> untuk memulai.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((r) => (
              <button
                key={r.roomCode}
                type="button"
                onClick={() => onOpenExistingRoom(r.roomCode)}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-sky-50/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-math font-bold text-sm text-blue-700">{r.roomCode}</span>
                  <span className="text-[11px] font-semibold text-slate-500">{r.status}</span>
                </div>
                <div className="font-semibold text-sm text-slate-900 truncate mt-1">{r.title}</div>
                <div className="text-xs text-slate-500 font-math mt-1 flex items-center gap-2">
                  <span>Ronde {r.currentRound}/{r.settings.totalRounds}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Award className="w-3 h-3" /> {r.playerCount} Siswa
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
