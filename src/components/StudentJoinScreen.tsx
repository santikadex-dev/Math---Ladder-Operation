import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, LogIn, ShieldAlert, UserCheck } from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { signInWithGoogle } from '../services/firebaseService';
import { joinRoom, normalizeRoomCode } from '../services/roomService';

interface StudentJoinScreenProps {
  initialRoomCode?: string;
  user: User | null;
  onBack: () => void;
  onJoined: (roomCode: string) => void;
}

export const StudentJoinScreen: React.FC<StudentJoinScreenProps> = ({
  initialRoomCode = '',
  user,
  onBack,
  onJoined,
}) => {
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [displayName, setDisplayName] = useState(user?.displayName?.split(' ')[0] ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const signed = await signInWithGoogle();
      if (!displayName && signed.displayName) {
        setDisplayName(signed.displayName.split(' ')[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Silakan masuk dengan akun Google terlebih dahulu agar progresmu tersimpan aman.');
      return;
    }

    const code = normalizeRoomCode(roomCode);
    if (!code) {
      setError('Masukkan kode ruangan yang valid, misalnya MATH-7K4P.');
      return;
    }

    const avatarObj = AVATARS.find((a) => a.id === selectedAvatar) ?? AVATARS[0];
    setJoining(true);
    setError(null);
    try {
      await joinRoom({
        roomCode: code,
        user,
        displayName,
        avatar: avatarObj.id,
        color: avatarObj.color,
      });
      onJoined(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung ke ruangan.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Gabung Permainan Kelas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Masukkan kode ruangan dari gurumu, tulis nama panggilan, dan pilih karakter petualangan.
          </p>
        </div>

        {!user ? (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
            <p className="text-xs text-sky-900 font-medium">
              Masuk dengan akun Google sekolah/pribadi untuk menjaga skor dan posisimu jika koneksi terputus.
            </p>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Masuk dengan Google
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>Terautentikasi sebagai <strong>{user.email}</strong></span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kode Ruangan</label>
            <input
              type="text"
              required
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Contoh: MATH-7K4P"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-math text-lg font-bold tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Tampilan</label>
            <input
              type="text"
              required
              maxLength={32}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nama kamu di papan kelas"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">Pilih Avatar Karakter</span>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {AVATARS.map((av) => {
                const active = selectedAvatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.id)}
                    className={`min-h-[56px] p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/30 scale-105'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl leading-none">{av.emoji}</span>
                    <span className="text-[10px] font-semibold text-slate-700 truncate max-w-full">
                      {av.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={joining || !user}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-bold text-base shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            {joining ? 'Sedang Bergabung...' : 'Masuk ke Lobi Kelas'}
          </button>
        </form>
      </div>
    </div>
  );
};
