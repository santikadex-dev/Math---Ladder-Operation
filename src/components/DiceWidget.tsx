import React from 'react';

interface DiceWidgetProps {
  value: number;
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const PIP_LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function SingleDie({ face, size, rolling }: { face: number; size: 'sm' | 'md' | 'lg'; rolling?: boolean }) {
  const clamped = Math.max(1, Math.min(6, face));
  const pips = PIP_LAYOUTS[clamped] || PIP_LAYOUTS[1];

  const sizeClass =
    size === 'sm'
      ? 'w-10 h-10 p-1.5 rounded-lg'
      : size === 'lg'
      ? 'w-20 h-20 p-3 rounded-2xl'
      : 'w-14 h-14 p-2 rounded-xl';

  const pipSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br from-amber-50 via-white to-amber-100 border-2 border-amber-400 shadow-md grid grid-cols-3 grid-rows-3 place-items-center ${
        rolling ? 'animate-dice-tumble' : 'transition-transform duration-200'
      }`}
      aria-label={`Dadu bernilai ${clamped}`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span
          key={idx}
          className={`${pipSize} rounded-full ${
            pips.includes(idx)
              ? clamped === 1 || clamped === 6
                ? 'bg-rose-600'
                : 'bg-slate-800'
              : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

export const DiceWidget: React.FC<DiceWidgetProps> = ({ value, rolling = false, size = 'md' }) => {
  if (value > 6) {
    const d1 = Math.min(6, Math.max(1, Math.floor(value / 2)));
    const d2 = Math.min(6, Math.max(1, value - d1));
    return (
      <div className="inline-flex items-center gap-2">
        <SingleDie face={d1} size={size} rolling={rolling} />
        <SingleDie face={d2} size={size} rolling={rolling} />
      </div>
    );
  }
  return <SingleDie face={value} size={size} rolling={rolling} />;
};
