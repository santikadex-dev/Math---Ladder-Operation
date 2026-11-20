import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AVATARS } from '../constants/gameDefaults';
import type { Player, Round } from '../types/game';

interface FunnyEventTickerProps {
  players: Player[];
  rounds?: Round[];
  topOffsetClass?: string;
}

interface TickerItem {
  id: string;
  kind: 'LADDER' | 'SNAKE';
  emoji: string;
  text: string;
  roundNumber: number;
}

const LADDER_TEMPLATES = [
  (name: string, from: number, to: number) =>
    `🚀 Wushh! ${name} nemu lift ekspres di petak ${from} → langsung melesat ke ${to}!`,
  (name: string, from: number, to: number) =>
    `🪜 ${name} manjat tangga kilat ${from} → ${to}, yang lain masih ngos-ngosan di bawah!`,
  (name: string, from: number, to: number) =>
    `⚡ Jalur VIP terdeteksi! ${name} terbang mulus dari petak ${from} ke ${to}!`,
  (name: string, from: number, to: number) =>
    `🧗 Skill panjat pinang aktif! ${name} naik tangga dari ${from} langsung ke ${to}!`,
  (name: string, from: number, to: number) =>
    `✨ Tangga ajaib menyapa! ${name} langsung nongkrong santai di petak ${to}!`,
];

const SNAKE_TEMPLATES = [
  (name: string, from: number, to: number) =>
    `🐍 Waduh! ${name} diajak wisata seluncuran gratis sama ular ${from} → ${to}, sabar ya!`,
  (name: string, from: number, to: number) =>
    `😂 Upss! ${name} kepeleset ekor ular di ${from} → nyungsep ke ${to}. Jangan nangis!`,
  (name: string, from: number, to: number) =>
    `🎢 Wahana perosotan dadakan! ${name} meluncur syahdu dari ${from} balik ke ${to}!`,
  (name: string, from: number, to: number) =>
    `😅 Lantai licin! ${name} kenalan sama si ular panjang ${from} → turun ke ${to}!`,
  (name: string, from: number, to: number) =>
    `🫠 Lagi asyik di atas, eh ${name} disuruh nostalgia di petak ${to} sama si ular!`,
];

function hashPick(seed: string, length: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % length;
}

function getFunnyComment(
  kind: 'LADDER' | 'SNAKE',
  name: string,
  from: number,
  to: number,
  roundNumber: number
): string {
  const firstName = name.split(' ')[0] || name;
  const seed = `${firstName}_${roundNumber}_${from}_${to}_${kind}`;
  if (kind === 'LADDER') {
    const fn = LADDER_TEMPLATES[hashPick(seed, LADDER_TEMPLATES.length)];
    return fn(firstName, from, to);
  }
  const fn = SNAKE_TEMPLATES[hashPick(seed, SNAKE_TEMPLATES.length)];
  return fn(firstName, from, to);
}

export const FunnyEventTicker: React.FC<FunnyEventTickerProps> = ({
  players,
  rounds = [],
  topOffsetClass = 'top-14',
}) => {
  const [historyMap, setHistoryMap] = useState<Map<string, TickerItem>>(new Map());
  const [dismissed, setDismissed] = useState(false);
  const lastLatestIdRef = useRef<string | null>(null);

  // Collect ladder/snake events from both resolved round summaries and immediate player outcomes
  useEffect(() => {
    const discovered: TickerItem[] = [];

    rounds.forEach((round) => {
      round.resultSummary?.events?.forEach((ev) => {
        if (ev.type !== 'LADDER' && ev.type !== 'SNAKE') return;
        const av = AVATARS.find((a) => a.id === ev.avatar) || AVATARS[0];
        const nums = ev.text.match(/\d+/g);
        const from = nums && nums.length >= 2 ? Number(nums[0]) : 1;
        const to = nums && nums.length >= 2 ? Number(nums[1]) : 1;
        const id = `${ev.playerId}_r${round.roundNumber}_${ev.type}`;
        discovered.push({
          id,
          kind: ev.type,
          emoji: av.emoji,
          text: getFunnyComment(ev.type, ev.playerName, from, to, round.roundNumber),
          roundNumber: round.roundNumber,
        });
      });
    });

    players.forEach((p) => {
      const out = p.lastOutcome;
      if (!out) return;
      if (!out.ladderTo && !out.snakeTo) return;
      const kind: 'LADDER' | 'SNAKE' = out.ladderTo ? 'LADDER' : 'SNAKE';
      const to = out.ladderTo ?? out.snakeTo ?? out.toPosition;
      const from = out.fromPosition + (out.isCorrect ? out.dice : 0);
      const av = AVATARS.find((a) => a.id === p.avatar) || AVATARS[0];
      const id = `${p.playerId}_r${out.roundNumber}_${kind}`;
      discovered.push({
        id,
        kind,
        emoji: av.emoji,
        text: getFunnyComment(kind, p.displayName, from, to, out.roundNumber),
        roundNumber: out.roundNumber,
      });
    });

    if (discovered.length === 0) return;

    setHistoryMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const item of discovered) {
        if (!next.has(item.id)) {
          next.set(item.id, item);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [players, rounds]);

  const items = useMemo(() => {
    return Array.from(historyMap.values())
      .sort((a, b) => b.roundNumber - a.roundNumber)
      .slice(0, 6);
  }, [historyMap]);

  // Auto-reopen ticker whenever a brand-new ladder/snake event arrives
  const newestId = items[0]?.id ?? null;
  useEffect(() => {
    if (newestId && newestId !== lastLatestIdRef.current) {
      lastLatestIdRef.current = newestId;
      setDismissed(false);
    }
  }, [newestId]);

  if (items.length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={`fixed ${topOffsetClass} left-0 right-0 z-30 pointer-events-none px-3 pt-1.5`}
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto pointer-events-auto rounded-full bg-slate-900/95 text-white border border-slate-700/90 shadow-lg backdrop-blur-xs flex items-center overflow-hidden h-9">
        <div className="px-3 h-full bg-amber-400 text-slate-950 font-display font-extrabold text-[11px] tracking-wide uppercase flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Berita Tangga & Ular</span>
          <span className="sm:hidden">Info Papan</span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee items-center gap-8 px-4 text-xs font-medium whitespace-nowrap">
            {[...items, ...items].map((item, idx) => (
              <span key={`${item.id}_${idx}`} className="inline-flex items-center gap-2 shrink-0">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.kind === 'LADDER'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                      : 'bg-rose-500/25 text-rose-300 border border-rose-400/40'
                  }`}
                >
                  {item.kind === 'LADDER' ? 'Naik Tangga' : 'Turun Ular'}
                </span>
                <span>{item.emoji}</span>
                <span className="text-slate-100">{item.text}</span>
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2.5 h-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Sembunyikan running text"
          aria-label="Sembunyikan running text"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
