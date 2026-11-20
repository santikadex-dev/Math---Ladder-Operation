import React from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Flag, XCircle } from 'lucide-react';
import type { RoundSummary } from '../types/game';

interface RoundSummaryPanelProps {
  summary: RoundSummary | null | undefined;
  darkTheme?: boolean;
}

export const RoundSummaryPanel: React.FC<RoundSummaryPanelProps> = ({ summary, darkTheme = false }) => {
  if (!summary) {
    return (
      <div
        className={`p-6 rounded-2xl border text-center text-sm ${
          darkTheme
            ? 'bg-slate-800/60 border-slate-700 text-slate-400'
            : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        Ringkasan ronde akan tampil otomatis setelah ronde berakhir.
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        darkTheme ? 'bg-slate-900/90 border-slate-700 text-slate-100' : 'bg-white border-slate-200 shadow-sm text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-base">Ringkasan Ronde {summary.roundNumber}</h3>
        <span className={`text-xs font-math ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
          {summary.movedCount} siswa berpindah petak
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-4">
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-emerald-100 bg-emerald-50/70'}`}>
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Benar
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.correctCount}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-rose-100 bg-rose-50/70'}`}>
          <div className="flex items-center gap-1 text-rose-600 text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" /> Salah
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.incorrectCount}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-amber-100 bg-amber-50/70'}`}>
          <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Habis
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.timeoutCount}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-teal-100 bg-teal-50/70'}`}>
          <div className="flex items-center gap-1 text-teal-600 text-xs font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" /> Tangga
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.laddersClimbedCount}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-orange-100 bg-orange-50/70'}`}>
          <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
            <ArrowDownRight className="w-3.5 h-3.5" /> Ular
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.snakesSlidCount}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${darkTheme ? 'border-slate-700 bg-slate-800/60' : 'border-blue-100 bg-blue-50/70'}`}>
          <div className="flex items-center gap-1 text-blue-600 text-xs font-medium">
            <Flag className="w-3.5 h-3.5" /> Finish
          </div>
          <div className="font-math font-bold text-lg mt-0.5">{summary.finishedCount}</div>
        </div>
      </div>

      {summary.events.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {summary.events.map((ev) => (
            <div
              key={ev.id}
              className={`text-xs px-3 py-1.5 rounded-lg ${
                darkTheme ? 'bg-slate-800/80 text-slate-200' : 'bg-slate-50 text-slate-700'
              }`}
            >
              {ev.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
