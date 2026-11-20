import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import type { DiceMode } from '../types/game';
import { soundFx } from '../utils/sound';
import { DiceWidget } from './DiceWidget';

interface DiceRouletteOverlayProps {
  roundNumber: number;
  totalRounds: number;
  targetValue: number;
  diceMode: DiceMode;
  onComplete: () => void;
}

const CARD_W = 88;
const GAP = 12;
const STEP = CARD_W + GAP;
const SPIN_DURATION_MS = 2250;
const HOLD_AFTER_LAND_MS = 750;

export const DiceRouletteOverlay: React.FC<DiceRouletteOverlayProps> = ({
  roundNumber,
  totalRounds,
  targetValue,
  diceMode,
  onComplete,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [landed, setLanded] = useState(false);

  const faces = useMemo(() => {
    if (diceMode === 'TURBO_2D6' || targetValue > 6) {
      return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    return [1, 2, 3, 4, 5, 6];
  }, [diceMode, targetValue]);

  const clampedTarget = useMemo(() => {
    if (faces.includes(targetValue)) return targetValue;
    return faces[0];
  }, [faces, targetValue]);

  // Repeat faces 6 times so the strip is long enough for a fast, smooth spin
  const { strip, targetIndex, startIndex } = useMemo(() => {
    const repeated: number[] = [];
    for (let c = 0; c < 6; c++) {
      repeated.push(...faces);
    }
    const targetOffset = faces.indexOf(clampedTarget);
    const tIdx = 4 * faces.length + (targetOffset >= 0 ? targetOffset : 0);
    return {
      strip: repeated,
      targetIndex: tIdx,
      startIndex: 1,
    };
  }, [faces, clampedTarget]);

  useEffect(() => {
    setLanded(false);

    const startPx = startIndex * STEP + CARD_W / 2;
    const endPx = targetIndex * STEP + CARD_W / 2;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(calc(50% - ${endPx}px))`;
      }
      setLanded(true);
      soundFx.diceLand();
      const t = setTimeout(() => onCompleteRef.current(), HOLD_AFTER_LAND_MS);
      return () => clearTimeout(t);
    }

    let rafId = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    const startTime = performance.now();
    let lastTickSlot = Math.floor(startPx / STEP);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / SPIN_DURATION_MS);
      // Quartic ease-out: fast initial velocity, smooth natural deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentPx = startPx + (endPx - startPx) * eased;

      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(calc(50% - ${currentPx}px))`;
      }

      const slot = Math.floor(currentPx / STEP);
      if (slot > lastTickSlot && progress < 0.995) {
        lastTickSlot = slot;
        soundFx.rouletteTick();
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setLanded(true);
        soundFx.diceLand();
        holdTimer = setTimeout(() => {
          onCompleteRef.current();
        }, HOLD_AFTER_LAND_MS);
      }
    };

    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(50% - ${startPx}px))`;
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [startIndex, targetIndex]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mengundi dadu ronde"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-7 text-center text-white space-y-5 overflow-hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-amber-400">
            <Dices className="w-4 h-4" />
            Ronde {roundNumber} / {totalRounds}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold">
            {landed ? `Langkahmu: ${clampedTarget} Petak!` : 'Mengundi Langkah Dadu...'}
          </h2>
          <p className="text-xs text-slate-400">
            {landed
              ? 'Bersiap! Soal & hitung mundur segera dimulai...'
              : 'Dadu berputar dan akan berhenti di angka keberuntunganmu'}
          </p>
        </div>

        {/* Horizontal Roulette Viewport */}
        <div className="relative py-4">
          {/* Center Top & Bottom Pointer Markers */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
          >
            <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[11px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow" />
          </div>
          <div
            aria-hidden="true"
            className="absolute left-1/2 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
          >
            <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-b-[11px] border-l-transparent border-r-transparent border-b-amber-400 drop-shadow" />
          </div>

          {/* Center Spotlight Frame */}
          <div
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[96px] h-[112px] rounded-2xl border-2 pointer-events-none transition-all duration-300 ${
              landed
                ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.45)] bg-emerald-500/10'
                : 'border-amber-400/90 shadow-[0_0_16px_rgba(251,191,36,0.28)]'
            }`}
          />

          {/* Side Gradient Masks */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"
          />

          {/* Scrolling Strip */}
          <div className="overflow-hidden py-2">
            <div
              ref={trackRef}
              className="flex items-center will-change-transform"
              style={{ gap: `${GAP}px` }}
            >
              {strip.map((val, idx) => {
                const isWinnerCard = landed && idx === targetIndex;
                return (
                  <div
                    key={idx}
                    style={{ width: `${CARD_W}px`, minWidth: `${CARD_W}px` }}
                    className={`h-[104px] rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-transform duration-300 ${
                      isWinnerCard
                        ? 'bg-slate-800 border-emerald-400 scale-105'
                        : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <DiceWidget value={val} size={val > 6 ? 'sm' : 'md'} />
                    <span
                      className={`font-math text-xs font-extrabold ${
                        isWinnerCard ? 'text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {val} Langkah
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Landed Confirmation */}
        <div className="h-7 flex items-center justify-center">
          {landed ? (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300 animate-pulse">
              <Sparkles className="w-4 h-4" />
              Membuka soal ronde {roundNumber}...
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium">
              Tunggu dadu berhenti untuk melihat soal
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
