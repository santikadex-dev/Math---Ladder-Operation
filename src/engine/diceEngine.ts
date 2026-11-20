import type { DiceMode } from '../types/game';

export function rollDice(mode: DiceMode, doubleDiceActive: boolean): number {
  const rollOne = () => Math.floor(Math.random() * 6) + 1;
  if (doubleDiceActive || mode === 'TURBO_2D6') {
    return rollOne() + rollOne();
  }
  return rollOne();
}
