import React from 'react';
import { Award, Flame, Shield, Trophy } from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { rankPlayers } from '../engine/leaderboardEngine';
import type { Player } from '../types/game';

interface LeaderboardPanelProps {
  players: Player[];
  highlightPlayerId?: string;
  darkTheme?: boolean;
  maxRows?: number;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  players,
  highlightPlayerId,
  darkTheme = false,
  maxRows,
}) => {
  const ranked = rankPlayers(players);
  const displayRows = maxRows ? ranked.slice(0, maxRows) : ranked;

  if (displayRows.length === 0) {
    return (
      <div
        className={`p-6 rounded-2xl border text-center text-sm ${
          darkTheme
            ? 'bg-slate-800/60 border-slate-700 text-slate-400'
            : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        Belum ada siswa yang bergabung di papan peringkat.
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        darkTheme ? 'bg-slate-900/90 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          darkTheme ? 'border-slate-800 bg-slate-800/70' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className={`font-display font-bold text-sm ${darkTheme ? 'text-white' : 'text-slate-900'}`}>
            Papan Peringkat Langsung
          </h3>
        </div>
        <span className={`text-xs font-math ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
          {ranked.length} Siswa
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {displayRows.map(({ rank, player }) => {
          const av = AVATARS.find((a) => a.id === player.avatar) || AVATARS[0];
          const isMe = player.playerId === highlightPlayerId;

          return (
            <div
              key={player.playerId}
              className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                isMe
                  ? darkTheme
                    ? 'bg-sky-900/40'
                    : 'bg-sky-50'
                  : darkTheme
                  ? 'hover:bg-slate-800/40'
                  : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-6 text-center font-math font-bold text-sm shrink-0 ${
                    rank === 1
                      ? 'text-amber-500'
                      : rank === 2
                      ? 'text-slate-400'
                      : rank === 3
                      ? 'text-amber-700'
                      : darkTheme
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {rank}
                </span>

                <div
                  style={{ backgroundColor: player.color || av.color }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base border-2 border-white shadow-sm shrink-0"
                >
                  {av.emoji}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold text-sm truncate ${
                        darkTheme ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {player.displayName}
                    </span>
                    {player.finished && (
                      <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Finish" />
                    )}
                    {player.shield && (
                      <Shield className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-label="Perisai aktif" />
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs ${
                      darkTheme ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <span className="font-math">{player.correctAnswers} benar</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-math">{player.accuracy}% akurasi</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-math">{player.xp} XP</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {player.streak >= 2 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-500 font-math">
                    <Flame className="w-3.5 h-3.5" />
                    {player.streak}
                  </span>
                )}
                <div className="text-right">
                  <div
                    className={`font-math font-bold text-sm ${
                      player.finished
                        ? 'text-emerald-600'
                        : darkTheme
                        ? 'text-sky-400'
                        : 'text-blue-700'
                    }`}
                  >
                    {player.finished ? 'FINISH' : `Petak ${player.position}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
