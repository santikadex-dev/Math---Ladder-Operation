import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  Award,
  BarChart3,
  Clock,
  Download,
  Home,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { computeClassAnalytics, exportResultsToCsv } from '../engine/analyticsEngine';
import { rankPlayers } from '../engine/leaderboardEngine';
import type { Player, Room } from '../types/game';
import { soundFx } from '../utils/sound';

interface ResultsAnalyticsScreenProps {
  room: Room;
  players: Player[];
  isTeacher: boolean;
  isDemo: boolean;
  onPlayAgainSameBoard?: () => void;
  onPlayAgainNewBoard?: () => void;
  onNewSetup?: () => void;
  onExitHome: () => void;
}

export const ResultsAnalyticsScreen: React.FC<ResultsAnalyticsScreenProps> = ({
  room,
  players,
  isTeacher,
  isDemo,
  onPlayAgainSameBoard,
  onPlayAgainNewBoard,
  onNewSetup,
  onExitHome,
}) => {
  const [imgError, setImgError] = useState(false);
  const ranked = rankPlayers(players);
  const analytics = computeClassAnalytics(players);
  const top3 = ranked.slice(0, 3);
  const champion = ranked[0]?.player;

  useEffect(() => {
    soundFx.victory();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore confetti errors in headless browsers
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Winner Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="text-xs font-semibold text-amber-300 tracking-wide">
              {isDemo ? 'DEMO MODE · ' : ''}HASIL AKHIR PERMAINAN · {room.roomCode}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-balance">
              {champion ? `Selamat kepada ${champion.displayName}!` : 'Permainan Selesai!'}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl">
              {room.title} selesai dalam {room.currentRound} ronde dengan akurasi kelas{' '}
              <span className="font-math font-bold text-white">{analytics.classAccuracy}%</span> dari{' '}
              <span className="font-math font-bold text-white">{analytics.totalQuestionsAnswered}</span> soal terjawab.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => exportResultsToCsv(room.roomCode, players)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Unduh Laporan CSV
                </button>
              )}
              {isTeacher && onPlayAgainSameBoard && (
                <button
                  type="button"
                  onClick={onPlayAgainSameBoard}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Main Lagi (Reset Papan)
                </button>
              )}
              {isTeacher && onPlayAgainNewBoard && (
                <button
                  type="button"
                  onClick={onPlayAgainNewBoard}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Acak Papan Baru
                </button>
              )}
              {isTeacher && onNewSetup && (
                <button
                  type="button"
                  onClick={onNewSetup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Pengaturan Baru
                </button>
              )}
              <button
                type="button"
                onClick={onExitHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Beranda
              </button>
            </div>
          </div>

          <div className="md:col-span-4 flex justify-center">
            {!imgError ? (
              <img
                src="/src/assets/images/victory_crown_emblem_1795183860645.jpg"
                alt="Mahkota Juara Math Ladder"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-44 h-44 sm:w-52 sm:h-52 object-cover rounded-2xl border-2 border-amber-400/50 shadow-lg"
              />
            ) : (
              <div className="w-44 h-44 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 flex flex-col items-center justify-center text-amber-300">
                <Award className="w-16 h-16 mb-2" />
                <span className="font-display font-bold text-sm">Juara Kelas</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {top3.map(({ rank, player }) => {
            const av = AVATARS.find((a) => a.id === player.avatar) || AVATARS[0];
            const podiumStyle =
              rank === 1
                ? 'border-amber-300 bg-amber-50/70'
                : rank === 2
                ? 'border-slate-300 bg-slate-50'
                : 'border-orange-200 bg-orange-50/50';
            return (
              <div key={player.playerId} className={`rounded-2xl border p-5 flex items-center gap-4 ${podiumStyle}`}>
                <div className="font-display text-3xl font-extrabold text-slate-400 font-math">#{rank}</div>
                <div
                  style={{ backgroundColor: player.color || av.color }}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 border-white shadow shrink-0"
                >
                  {av.emoji}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-base text-slate-900 truncate">{player.displayName}</div>
                  <div className="text-xs text-slate-600 font-math">
                    Petak {player.position} · {player.accuracy}% akurasi · {player.xp} XP
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Class Analytics Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Operation Breakdown & Insights */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="font-display font-bold text-base text-slate-900">Analitik Pembelajaran Kelas</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Akurasi Kelas</div>
              <div className="font-math text-2xl font-bold text-slate-900">{analytics.classAccuracy}%</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500">Tangga / Ular</div>
              <div className="font-math text-2xl font-bold text-slate-900">
                {analytics.totalLaddersClimbed} / {analytics.totalSnakesEncountered}
              </div>
            </div>
          </div>

          {analytics.operationBreakdown.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">Akurasi per Operasi</div>
              {analytics.operationBreakdown.map((op) => (
                <div key={op.operation} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{op.label}</span>
                    <span className="font-math text-slate-600">
                      {op.correct}/{op.attempted} ({op.accuracy}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        op.accuracy >= 75 ? 'bg-emerald-500' : op.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${op.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actionable Teacher Insights */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
            {analytics.lowestOperation && (
              <div className="flex items-start gap-2 text-slate-700">
                <TrendingUp className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Operasi perlu penguatan: <strong>{analytics.lowestOperation.label}</strong> ({analytics.lowestOperation.accuracy}%).
                </span>
              </div>
            )}
            <div className="flex items-start gap-2 text-slate-700">
              <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Akurasi tinggi (&ge;80%):{' '}
                {analytics.highAccuracyStudents.length > 0
                  ? analytics.highAccuracyStudents.map((s) => s.displayName).join(', ')
                  : 'Belum ada'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Perlu pendampingan (&lt;50%):{' '}
                {analytics.supportNeededStudents.length > 0
                  ? analytics.supportNeededStudents.map((s) => s.displayName).join(', ')
                  : 'Semua siswa di atas 50%'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <AlertCircle className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
              <span>
                Kesulitan bilangan negatif:{' '}
                {analytics.negativeStruggleStudents.length > 0
                  ? analytics.negativeStruggleStudents.map((s) => s.displayName).join(', ')
                  : 'Tidak terdeteksi kendala khusus'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <span>
                Sering kehabisan waktu:{' '}
                {analytics.frequentTimeoutStudents.length > 0
                  ? analytics.frequentTimeoutStudents.map((s) => s.displayName).join(', ')
                  : 'Tidak ada'}
              </span>
            </div>
          </div>
        </div>

        {/* Full Student Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-900">Rekap Hasil Individual Siswa</h2>
            <span className="text-xs text-slate-500 font-math">{ranked.length} Peserta</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">#</th>
                  <th className="py-2.5 px-3 font-semibold">Siswa</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Petak</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Benar/Salah/Habis</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Akurasi</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Streak</th>
                  <th className="py-2.5 px-4 font-semibold text-right">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map(({ rank, player }) => {
                  const av = AVATARS.find((a) => a.id === player.avatar) || AVATARS[0];
                  return (
                    <tr key={player.playerId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-math font-bold text-slate-500">{rank}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span>{av.emoji}</span>
                          <span className="font-semibold text-slate-900">{player.displayName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-math font-bold text-blue-700">
                        {player.finished ? `${player.position} (Finish)` : player.position}
                      </td>
                      <td className="py-2.5 px-3 text-right font-math text-slate-700">
                        {player.correctAnswers} / {player.incorrectAnswers} / {player.timeoutCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-math font-semibold text-slate-900">
                        {player.accuracy}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-math text-orange-600">{player.bestStreak}</td>
                      <td className="py-2.5 px-4 text-right font-math font-bold text-slate-900">{player.xp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
