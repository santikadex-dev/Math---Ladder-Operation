import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { RefreshIntervalOption } from '../hooks/usePeriodicBoardRefresh';

interface BoardRefreshToolbarProps {
  intervalSec: RefreshIntervalOption;
  onChangeInterval: (val: RefreshIntervalOption) => void;
  formattedTime: string;
  justRefreshed: boolean;
  onRefreshNow: () => void;
  darkTheme?: boolean;
}

const OPTIONS: { label: string; value: RefreshIntervalOption }[] = [
  { label: '2d', value: 2 },
  { label: '3d', value: 3 },
  { label: '5d', value: 5 },
  { label: 'Live', value: 0 },
];

export const BoardRefreshToolbar: React.FC<BoardRefreshToolbarProps> = ({
  intervalSec,
  onChangeInterval,
  formattedTime,
  justRefreshed,
  onRefreshNow,
  darkTheme = false,
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b ${
        darkTheme ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600'
      }`}
    >
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            justRefreshed
              ? 'bg-emerald-400 scale-125'
              : intervalSec === 0
              ? 'bg-sky-500 animate-pulse'
              : 'bg-emerald-500'
          }`}
        />
        <span className="font-medium">
          {intervalSec === 0 ? 'Sinkronisasi Langsung' : `Refresh Papan tiap ${intervalSec} detik`}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-math opacity-80">Update {formattedTime}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          className={`inline-flex items-center p-0.5 rounded-lg border text-[11px] font-semibold ${
            darkTheme ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {OPTIONS.map((opt) => {
            const active = intervalSec === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeInterval(opt.value)}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : darkTheme
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefreshNow}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
            darkTheme
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Segarkan posisi papan sekarang"
        >
          <RefreshCw className={`w-3 h-3 ${justRefreshed ? 'animate-spin text-emerald-500' : ''}`} />
          Segarkan
        </button>
      </div>
    </div>
  );
};
