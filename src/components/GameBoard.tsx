import React, { useMemo } from 'react';
import { Crown, Flag, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import { getBoardGridSquares, getGridDimension, getSquareCoord } from '../engine/boardEngine';
import type { BoardConfiguration, Player, SpecialTileType } from '../types/game';

interface GameBoardProps {
  board: BoardConfiguration;
  players: Player[];
  highlightPlayerId?: string;
  compact?: boolean;
  darkTheme?: boolean;
}

const SPECIAL_TILE_META: Record<
  SpecialTileType,
  { label: string; bg: string; text: string; Icon: React.FC<{ className?: string }> }
> = {
  BONUS: { label: 'Bonus', bg: 'bg-amber-100/90', text: 'text-amber-800', Icon: Sparkles },
  CHALLENGE: { label: 'Tantangan', bg: 'bg-violet-100/90', text: 'text-violet-800', Icon: Swords },
  DOUBLE_DICE: { label: '2× Dadu', bg: 'bg-cyan-100/90', text: 'text-cyan-800', Icon: Zap },
  SHIELD: { label: 'Perisai', bg: 'bg-sky-100/90', text: 'text-sky-800', Icon: Shield },
};

function LadderSvg({ start, end, boardSize }: { start: number; end: number; boardSize: 100 | 64 }) {
  const s = getSquareCoord(start, boardSize);
  const e = getSquareCoord(end, boardSize);

  const dx = e.xPercent - s.xPercent;
  const dy = e.yPercent - s.yPercent;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 1.15;
  const ny = (dx / len) * 1.15;

  const rungCount = Math.max(3, Math.floor(len / 5.5));
  const rungs = Array.from({ length: rungCount }, (_, idx) => {
    const t = (idx + 1) / (rungCount + 1);
    const cx = s.xPercent + dx * t;
    const cy = s.yPercent + dy * t;
    return {
      x1: cx - nx,
      y1: cy - ny,
      x2: cx + nx,
      y2: cy + ny,
    };
  });

  return (
    <g>
      {/* Subtle drop shadow */}
      <line
        x1={s.xPercent - nx + 0.3}
        y1={s.yPercent - ny + 0.4}
        x2={e.xPercent - nx + 0.3}
        y2={e.yPercent - ny + 0.4}
        stroke="rgba(15,23,42,0.22)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <line
        x1={s.xPercent + nx + 0.3}
        y1={s.yPercent + ny + 0.4}
        x2={e.xPercent + nx + 0.3}
        y2={e.yPercent + ny + 0.4}
        stroke="rgba(15,23,42,0.22)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {/* Side rails */}
      <line
        x1={s.xPercent - nx}
        y1={s.yPercent - ny}
        x2={e.xPercent - nx}
        y2={e.yPercent - ny}
        stroke="#059669"
        strokeWidth="0.85"
        strokeLinecap="round"
      />
      <line
        x1={s.xPercent + nx}
        y1={s.yPercent + ny}
        x2={e.xPercent + nx}
        y2={e.yPercent + ny}
        stroke="#059669"
        strokeWidth="0.85"
        strokeLinecap="round"
      />
      {/* Rungs */}
      {rungs.map((r, idx) => (
        <line
          key={idx}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke="#34D399"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function SnakeSvg({ start, end, boardSize, index }: { start: number; end: number; boardSize: 100 | 64; index: number }) {
  const s = getSquareCoord(start, boardSize);
  const e = getSquareCoord(end, boardSize);

  const dx = e.xPercent - s.xPercent;
  const dy = e.yPercent - s.yPercent;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 4.5;
  const ny = (dx / len) * 4.5;
  const dir = index % 2 === 0 ? 1 : -1;

  const cp1x = s.xPercent + dx * 0.33 + nx * dir;
  const cp1y = s.yPercent + dy * 0.33 + ny * dir;
  const cp2x = s.xPercent + dx * 0.66 - nx * dir;
  const cp2y = s.yPercent + dy * 0.66 - ny * dir;

  const pathD = `M ${s.xPercent} ${s.yPercent} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${e.xPercent} ${e.yPercent}`;
  const bodyColors = ['#E11D48', '#EA580C', '#D97706', '#BE123C'];
  const strokeColor = bodyColors[index % bodyColors.length];

  return (
    <g>
      <path d={pathD} fill="none" stroke="rgba(15,23,42,0.22)" strokeWidth="2.1" strokeLinecap="round" transform="translate(0.35,0.45)" />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.7" strokeLinecap="round" />
      <path d={pathD} fill="none" stroke="#FEF08A" strokeWidth="0.55" strokeDasharray="1.2 1.8" strokeLinecap="round" />
      {/* Snake head at start square */}
      <circle cx={s.xPercent} cy={s.yPercent} r="1.55" fill={strokeColor} stroke="#FFFFFF" strokeWidth="0.35" />
      <circle cx={s.xPercent - 0.5} cy={s.yPercent - 0.35} r="0.3" fill="#FFFFFF" />
      <circle cx={s.xPercent + 0.5} cy={s.yPercent - 0.35} r="0.3" fill="#FFFFFF" />
      {/* Tail tip */}
      <circle cx={e.xPercent} cy={e.yPercent} r="0.7" fill={strokeColor} />
    </g>
  );
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  players,
  highlightPlayerId,
  compact = false,
  darkTheme = false,
}) => {
  const dim = getGridDimension(board.boardSize);
  const squares = useMemo(() => getBoardGridSquares(board.boardSize), [board.boardSize]);

  const activePlayers = useMemo(
    () => players.filter((p) => p.status !== 'REMOVED'),
    [players]
  );

  const playersBySquare = useMemo(() => {
    const map = new Map<number, Player[]>();
    for (const p of activePlayers) {
      const sq = Math.max(1, Math.min(board.boardSize, p.position));
      const list = map.get(sq) || [];
      list.push(p);
      map.set(sq, list);
    }
    return map;
  }, [activePlayers, board.boardSize]);

  const ladderMap = useMemo(() => {
    const m = new Map<number, number>();
    board.ladders.forEach((l) => m.set(l.start, l.end));
    return m;
  }, [board.ladders]);

  const snakeMap = useMemo(() => {
    const m = new Map<number, number>();
    board.snakes.forEach((s) => m.set(s.start, s.end));
    return m;
  }, [board.snakes]);

  return (
    <div className="relative w-full aspect-square max-w-[780px] mx-auto select-none">
      <div
        className={`w-full h-full rounded-2xl overflow-hidden border-2 shadow-lg relative ${
          darkTheme ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
        }`}
      >
        {/* Grid Squares */}
        <div
          className="w-full h-full grid"
          style={{
            gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${dim}, minmax(0, 1fr))`,
          }}
        >
          {squares.map((sq) => {
            const coord = getSquareCoord(sq, board.boardSize);
            const isAlt = (coord.rowFromTop + coord.colFromLeft) % 2 === 0;
            const special = board.specialTiles[String(sq)];
            const specialMeta = special ? SPECIAL_TILE_META[special] : null;
            const isStart = sq === 1;
            const isFinish = sq === board.boardSize;
            const hasLadderStart = ladderMap.has(sq);
            const hasSnakeStart = snakeMap.has(sq);

            let cellBg = isAlt
              ? darkTheme
                ? 'bg-slate-800/95'
                : 'bg-sky-50/75'
              : darkTheme
              ? 'bg-slate-900/95'
              : 'bg-white';

            if (isStart) cellBg = 'bg-emerald-500/20';
            else if (isFinish) cellBg = 'bg-amber-400/30';
            else if (specialMeta && !darkTheme) cellBg = specialMeta.bg;

            return (
              <div
                key={sq}
                className={`relative border-[0.5px] ${
                  darkTheme ? 'border-slate-700/70' : 'border-slate-200/90'
                } ${cellBg} flex flex-col justify-between p-0.5 sm:p-1 overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-0.5 z-10">
                  <span
                    className={`font-math font-bold leading-none ${
                      compact ? 'text-[9px]' : 'text-[10px] sm:text-xs md:text-sm'
                    } ${
                      isFinish
                        ? 'text-amber-700'
                        : isStart
                        ? 'text-emerald-700'
                        : darkTheme
                        ? 'text-slate-200'
                        : 'text-slate-700'
                    }`}
                  >
                    {sq}
                  </span>

                  {isFinish && <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 shrink-0" />}
                  {isStart && <Flag className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />}
                  {specialMeta && !compact && (
                    <span
                      title={specialMeta.label}
                      className={`inline-flex items-center justify-center rounded p-0.5 ${specialMeta.text}`}
                    >
                      <specialMeta.Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </span>
                  )}
                </div>

                {!compact && (hasLadderStart || hasSnakeStart) && (
                  <div className="text-[8px] sm:text-[9px] font-semibold leading-none z-10 opacity-85 truncate">
                    {hasLadderStart ? (
                      <span className="text-emerald-700 dark:text-emerald-400">↑{ladderMap.get(sq)}</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">↓{snakeMap.get(sq)}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SVG Overlay for Snakes & Ladders */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        >
          {board.ladders.map((l) => (
            <LadderSvg key={l.id} start={l.start} end={l.end} boardSize={board.boardSize} />
          ))}
          {board.snakes.map((s, idx) => (
            <SnakeSvg key={s.id} start={s.start} end={s.end} boardSize={board.boardSize} index={idx} />
          ))}
        </svg>

        {/* Animated Player Tokens Layer */}
        <div className="absolute inset-0 pointer-events-none z-30">
          {Array.from(playersBySquare.entries()).map(([sq, group]) => {
            const coord = getSquareCoord(sq, board.boardSize);
            const count = group.length;

            return group.map((player, idx) => {
              const avatar = AVATARS.find((a) => a.id === player.avatar) || AVATARS[0];
              const isHighlighted = player.playerId === highlightPlayerId;

              // Spread multiple tokens neatly within the square without hiding any
              let offsetX = 0;
              let offsetY = 0;
              if (count === 2) {
                offsetX = idx === 0 ? -1.8 : 1.8;
              } else if (count === 3 || count === 4) {
                const cols = 2;
                const r = Math.floor(idx / cols);
                const c = idx % cols;
                offsetX = (c - 0.5) * 3.1;
                offsetY = (r - 0.5) * 3.1;
              } else if (count > 4) {
                const angle = (idx / count) * Math.PI * 2;
                offsetX = Math.cos(angle) * 2.5;
                offsetY = Math.sin(angle) * 2.5;
              }

              const tokenSizeClass =
                count > 3 || compact
                  ? 'w-5 h-5 sm:w-6 sm:h-6 text-[11px] sm:text-xs'
                  : 'w-6 h-6 sm:w-8 sm:h-8 text-xs sm:text-base';

              return (
                <div
                  key={player.playerId}
                  style={{
                    left: `${coord.xPercent + offsetX}%`,
                    top: `${coord.yPercent + offsetY}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 550ms cubic-bezier(0.16, 1, 0.3, 1), top 550ms cubic-bezier(0.16, 1, 0.3, 1)',
                    zIndex: isHighlighted ? 40 : 30 + idx,
                  }}
                  className="absolute flex flex-col items-center"
                >
                  <div
                    style={{ backgroundColor: player.color || avatar.color }}
                    className={`${tokenSizeClass} rounded-full flex items-center justify-center shadow-md border-2 ${
                      isHighlighted ? 'border-amber-300 ring-2 ring-amber-400 scale-110' : 'border-white'
                    }`}
                  >
                    <span className="leading-none">{avatar.emoji}</span>
                  </div>
                  {!compact && (count <= 2 || isHighlighted) && (
                    <span className="mt-0.5 px-1 rounded bg-slate-900/80 text-white text-[9px] font-semibold max-w-[56px] truncate leading-tight">
                      {player.displayName.split(' ')[0]}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>

      {/* Board Legend */}
      {!compact && (
        <div
          className={`mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs ${
            darkTheme ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Tangga (Naik)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-600 inline-block" /> Ular (Turun)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Bonus
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-violet-500" /> Tantangan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-500" /> 2× Dadu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-500" /> Perisai
          </span>
        </div>
      )}
    </div>
  );
};
