import React, { useMemo, useState } from 'react';
import { ArrowLeft, Dices, Play, RefreshCw, ShieldAlert, Sliders } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../constants/gameDefaults';
import { generateBoardConfiguration } from '../engine/boardEngine';
import { generateQuestion } from '../engine/questionGenerator';
import type {
  AnswerMode,
  BoardConfiguration,
  DiceMode,
  Difficulty,
  FinishRule,
  GameEndRule,
  GameSettings,
  NextRoundMode,
  Operation,
  PenaltyType,
} from '../types/game';
import { GameBoard } from './GameBoard';

interface TeacherSetupWizardProps {
  mode: 'REAL' | 'DEMO';
  initialSettings?: GameSettings;
  onBack: () => void;
  onSubmit: (title: string, settings: GameSettings, board: BoardConfiguration) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

const OP_ITEMS: { id: Operation; label: string; symbol: string }[] = [
  { id: 'ADD', label: 'Penjumlahan', symbol: '+' },
  { id: 'SUB', label: 'Pengurangan', symbol: '−' },
  { id: 'MUL', label: 'Perkalian', symbol: '×' },
  { id: 'DIV', label: 'Pembagian', symbol: '÷' },
];

export const TeacherSetupWizard: React.FC<TeacherSetupWizardProps> = ({
  mode,
  initialSettings,
  onBack,
  onSubmit,
  submitting = false,
  error = null,
}) => {
  const [title, setTitle] = useState(
    mode === 'DEMO' ? 'Simulasi Kelas Bilangan Bulat' : 'Latihan Operasi Bilangan Bulat'
  );
  const [settings, setSettings] = useState<GameSettings>(initialSettings ?? DEFAULT_SETTINGS);
  const [board, setBoard] = useState<BoardConfiguration>(() =>
    generateBoardConfiguration(initialSettings ?? DEFAULT_SETTINGS)
  );
  const [sampleSeed, setSampleSeed] = useState(0);

  const sampleQuestion = useMemo(() => {
    void sampleSeed;
    return generateQuestion(settings).publicQuestion;
  }, [settings, sampleSeed]);

  const toggleOperation = (op: Operation) => {
    setSettings((prev) => {
      const exists = prev.operations.includes(op);
      if (exists && prev.operations.length === 1) return prev;
      const next = exists
        ? prev.operations.filter((item) => item !== op)
        : [...prev.operations, op];
      return { ...prev, operations: next };
    });
  };

  const updateSettingsAndBoard = (patch: Partial<GameSettings>, regenerateBoard = false) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (regenerateBoard) {
        setBoard(generateBoardConfiguration(next));
      }
      return next;
    });
  };

  const handleRegenerateBoard = () => {
    const nextSettings = { ...settings, randomizeBoard: true };
    setSettings(nextSettings);
    setBoard(generateBoardConfiguration(nextSettings));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(title, settings, board);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {mode === 'DEMO' ? 'Pengaturan Simulasi (DEMO MODE)' : 'Buat Ruang Permainan Kelas'}
            </h1>
            <p className="text-sm text-slate-500">
              Atur operasi bilangan bulat, aturan papan, dan durasi ronde sesuai kebutuhan kelas.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Configuration Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Session Title & Math Operations */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h2 className="font-display font-bold text-base text-slate-900">01. Materi & Operasi Bilangan</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Sesi / Kelas
              </label>
              <input
                type="text"
                maxLength={100}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kelas X-A — Operasi Bilangan Bulat"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                Operasi Matematika (pilih minimal 1)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {OP_ITEMS.map((item) => {
                  const active = settings.operations.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleOperation(item.id)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-math text-lg font-bold leading-none mb-1">{item.symbol}</div>
                      <div className="text-xs font-medium">{item.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operand Ranges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs font-semibold text-slate-700 mb-2">Rentang Bilangan Pertama (A)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Min</label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      value={settings.operandAMin}
                      onChange={(e) => updateSettingsAndBoard({ operandAMin: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-math text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Maks</label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      value={settings.operandAMax}
                      onChange={(e) => updateSettingsAndBoard({ operandAMax: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-math text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-xs font-semibold text-slate-700 mb-2">Rentang Bilangan Kedua (B)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Min</label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      value={settings.operandBMin}
                      onChange={(e) => updateSettingsAndBoard({ operandBMin: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-math text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Maks</label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      value={settings.operandBMax}
                      onChange={(e) => updateSettingsAndBoard({ operandBMax: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-math text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty & Answer Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">Tingkat Kesulitan</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {([
                    { id: 'EASY', label: 'Mudah' },
                    { id: 'NORMAL', label: 'Normal' },
                    { id: 'HARD', label: 'Sulit' },
                  ] as { id: Difficulty; label: string }[]).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => updateSettingsAndBoard({ difficulty: d.id })}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        settings.difficulty === d.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">Mode Jawaban</span>
                <select
                  value={settings.answerMode}
                  onChange={(e) => updateSettingsAndBoard({ answerMode: e.target.value as AnswerMode })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                >
                  <option value="MULTIPLE_CHOICE">Pilihan Ganda (4 Opsi)</option>
                  <option value="DIRECT_INPUT">Isian Langsung (Angka)</option>
                  <option value="MIXED">Campuran (Acak)</option>
                </select>
              </div>
            </div>

            {/* Answer Constraints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { key: 'allowNegativeAnswers', label: 'Izinkan hasil negatif' },
                { key: 'allowZeroAnswer', label: 'Izinkan hasil nol (0)' },
                { key: 'restrictDivisionToInteger', label: 'Pembagian selalu bilangan bulat' },
                { key: 'avoidExcessivelyLargeAnswers', label: 'Batasi hasil perkalian terlalu besar' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[opt.key as keyof GameSettings])}
                    onChange={(e) =>
                      updateSettingsAndBoard({ [opt.key]: e.target.checked } as Partial<GameSettings>)
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Game Rules & Board Config */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Dices className="w-4 h-4 text-teal-600" />
              <h2 className="font-display font-bold text-base text-slate-900">02. Aturan Ronde & Papan Ular Tangga</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Ronde</label>
                <select
                  value={settings.totalRounds}
                  onChange={(e) => updateSettingsAndBoard({ totalRounds: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-math"
                >
                  {[10, 15, 20, 30, 40].map((n) => (
                    <option key={n} value={n}>
                      {n} Ronde
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Waktu Jawab</label>
                <select
                  value={settings.answerTimerSec}
                  onChange={(e) => updateSettingsAndBoard({ answerTimerSec: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-math"
                >
                  {[5, 10, 15, 20, 30].map((s) => (
                    <option key={s} value={s}>
                      {s} Detik
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penalti Salah</label>
                <select
                  value={settings.wrongPenalty}
                  onChange={(e) => updateSettingsAndBoard({ wrongPenalty: e.target.value as PenaltyType })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="STAY">Tetap di Posisi</option>
                  <option value="BACK_1">Mundur 1 Petak</option>
                  <option value="BACK_2">Mundur 2 Petak</option>
                  <option value="BACK_3">Mundur 3 Petak</option>
                  <option value="BACK_BY_DICE">Mundur Sesuai Dadu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mode Dadu</label>
                <select
                  value={settings.diceMode}
                  onChange={(e) => updateSettingsAndBoard({ diceMode: e.target.value as DiceMode })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="STANDARD_1D6">1 Dadu (1–6)</option>
                  <option value="TURBO_2D6">2 Dadu (2–12)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aturan Finish (100)</label>
                <select
                  value={settings.finishRule}
                  onChange={(e) => updateSettingsAndBoard({ finishRule: e.target.value as FinishRule })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="EXACT_FINISH">Angka Dadu Tepat</option>
                  <option value="OVERSHOOT_ALLOWED">Boleh Melebihi 100</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Akhir Permainan</label>
                <select
                  value={settings.gameEndRule}
                  onChange={(e) => updateSettingsAndBoard({ gameEndRule: e.target.value as GameEndRule })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="AFTER_ROUNDS">Setelah Total Ronde</option>
                  <option value="FIRST_FINISH">Saat 1 Siswa Finish</option>
                  <option value="ALL_FINISH">Semua Siswa Finish</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transisi Ronde</label>
                <select
                  value={settings.nextRoundMode}
                  onChange={(e) => updateSettingsAndBoard({ nextRoundMode: e.target.value as NextRoundMode })}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="AUTO">Otomatis Lanjut</option>
                  <option value="MANUAL">Kontrol Guru Manual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ukuran Papan</label>
                <select
                  value={settings.boardSize}
                  onChange={(e) => updateSettingsAndBoard({ boardSize: Number(e.target.value) as 100 | 64 }, true)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-math"
                >
                  <option value={100}>10 × 10 (100 Petak)</option>
                  <option value={64}>8 × 8 (64 Petak)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Tangga</label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  disabled={!settings.enableSnakesAndLadders}
                  value={settings.ladderCount}
                  onChange={(e) =>
                    updateSettingsAndBoard({ ladderCount: Math.max(0, Math.min(12, Number(e.target.value))), randomizeBoard: true }, true)
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-math disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Ular</label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  disabled={!settings.enableSnakesAndLadders}
                  value={settings.snakeCount}
                  onChange={(e) =>
                    updateSettingsAndBoard({ snakeCount: Math.max(0, Math.min(12, Number(e.target.value))), randomizeBoard: true }, true)
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-math disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {[
                { key: 'enableSnakesAndLadders', label: 'Aktifkan Ular & Tangga', regen: true },
                { key: 'enableBonusTiles', label: 'Petak Bonus (+XP/Koin)', regen: true },
                { key: 'enableChallengeTiles', label: 'Petak Tantangan (+2)', regen: true },
                { key: 'enableDoubleDiceTiles', label: 'Petak Dadu Ganda', regen: true },
                { key: 'enableShieldTiles', label: 'Petak Perisai', regen: true },
                { key: 'allowLateJoin', label: 'Izinkan Gabung Susulan', regen: false },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[item.key as keyof GameSettings])}
                    onChange={(e) =>
                      updateSettingsAndBoard(
                        { [item.key]: e.target.checked } as Partial<GameSettings>,
                        item.regen
                      )
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Right Preview & Launch Column */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
          {/* Live Sample Question Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Pratinjau Contoh Soal</span>
              <button
                type="button"
                onClick={() => setSampleSeed((s) => s + 1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Acak Contoh
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 text-white text-center">
              <div className="font-math text-2xl font-bold tracking-tight">{sampleQuestion.prompt}</div>
              {sampleQuestion.options && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {sampleQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 border border-slate-700 font-math text-sm"
                    >
                      {String.fromCharCode(65 + i)}. {opt < 0 ? `−${Math.abs(opt)}` : opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Board Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">Pratinjau Papan Permainan</h3>
                <p className="text-xs text-slate-500">
                  {board.ladders.length} Tangga · {board.snakes.length} Ular ·{' '}
                  {Object.keys(board.specialTiles).length} Petak Spesial
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegenerateBoard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Acak Tata Letak
              </button>
            </div>

            <GameBoard board={board} players={[]} compact />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-display font-bold text-base shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5" />
            {submitting
              ? 'Menyiapkan Ruang...'
              : mode === 'DEMO'
              ? 'Mulai Simulasi Demo Mode'
              : 'Buat Ruang & Dapatkan Kode'}
          </button>
        </div>
      </form>
    </div>
  );
};
