import { DEFAULT_LADDERS_100, DEFAULT_SNAKES_100 } from '../constants/gameDefaults';
import type { BoardConfiguration, GameSettings, SnakeOrLadder, SpecialTileType } from '../types/game';

export interface SquareCoord {
  square: number;
  rowFromTop: number; // 0 = top row, 9 = bottom row (for 10x10)
  colFromLeft: number; // 0 = left, 9 = right
  xPercent: number; // center X % (0..100)
  yPercent: number; // center Y % (0..100)
}

export function getGridDimension(boardSize: 100 | 64): number {
  return boardSize === 64 ? 8 : 10;
}

/**
 * Computes classic boustrophedon (zigzag) Snakes & Ladders coordinates.
 * Square 1 is bottom-left. Bottom row goes left->right (1..10).
 * Second row from bottom goes right->left (11..20), and so on.
 */
export function getSquareCoord(square: number, boardSize: 100 | 64 = 100): SquareCoord {
  const clamped = Math.max(1, Math.min(boardSize, square));
  const dim = getGridDimension(boardSize);
  const zeroIdx = clamped - 1;
  const rowFromBottom = Math.floor(zeroIdx / dim);
  const rowFromTop = dim - 1 - rowFromBottom;
  const posInRow = zeroIdx % dim;
  const colFromLeft = rowFromBottom % 2 === 0 ? posInRow : dim - 1 - posInRow;

  const cellPct = 100 / dim;
  return {
    square: clamped,
    rowFromTop,
    colFromLeft,
    xPercent: colFromLeft * cellPct + cellPct / 2,
    yPercent: rowFromTop * cellPct + cellPct / 2,
  };
}

/**
 * Generates ordered array of square numbers for CSS grid rendering (top-left to bottom-right).
 */
export function getBoardGridSquares(boardSize: 100 | 64 = 100): number[] {
  const dim = getGridDimension(boardSize);
  const cells: number[] = [];
  for (let rowFromTop = 0; rowFromTop < dim; rowFromTop++) {
    const rowFromBottom = dim - 1 - rowFromTop;
    for (let col = 0; col < dim; col++) {
      const posInRow = rowFromBottom % 2 === 0 ? col : dim - 1 - col;
      const square = rowFromBottom * dim + posInRow + 1;
      cells.push(square);
    }
  }
  return cells;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateBoardConfiguration(settings: GameSettings): BoardConfiguration {
  const boardSize = settings.boardSize || 100;
  const dim = getGridDimension(boardSize);
  let ladders: SnakeOrLadder[] = [];
  let snakes: SnakeOrLadder[] = [];
  const occupied = new Set<number>([1, boardSize]);

  if (settings.enableSnakesAndLadders) {
    if (!settings.randomizeBoard && boardSize === 100 && settings.ladderCount === 7 && settings.snakeCount === 7) {
      ladders = DEFAULT_LADDERS_100.map((l) => ({ ...l }));
      snakes = DEFAULT_SNAKES_100.map((s) => ({ ...s }));
      ladders.forEach((l) => {
        occupied.add(l.start);
        occupied.add(l.end);
      });
      snakes.forEach((s) => {
        occupied.add(s.start);
        occupied.add(s.end);
      });
    } else {
      // Generate balanced, non-overlapping, chain-free ladders & snakes
      const targetLadders = Math.max(0, Math.min(12, settings.ladderCount));
      const targetSnakes = Math.max(0, Math.min(12, settings.snakeCount));

      for (let i = 0; i < targetLadders; i++) {
        for (let attempt = 0; attempt < 80; attempt++) {
          const start = randomInt(3, boardSize - dim * 2);
          const minJump = dim;
          const maxJump = Math.min(dim * 3, boardSize - 2 - start);
          if (maxJump < minJump) continue;
          const end = start + randomInt(minJump, maxJump);
          if (start >= end || end >= boardSize) continue;
          if (occupied.has(start) || occupied.has(end)) continue;

          occupied.add(start);
          occupied.add(end);
          ladders.push({ id: `L${i + 1}`, start, end, type: 'LADDER' });
          break;
        }
      }

      for (let i = 0; i < targetSnakes; i++) {
        for (let attempt = 0; attempt < 80; attempt++) {
          const start = randomInt(dim + 3, boardSize - 1);
          const minDrop = dim;
          const maxDrop = Math.min(dim * 3, start - 2);
          if (maxDrop < minDrop) continue;
          const end = start - randomInt(minDrop, maxDrop);
          if (end >= start || end <= 1) continue;
          if (occupied.has(start) || occupied.has(end)) continue;

          occupied.add(start);
          occupied.add(end);
          snakes.push({ id: `S${i + 1}`, start, end, type: 'SNAKE' });
          break;
        }
      }
    }
  }

  // Place optional special tiles on unoccupied squares
  const specialTiles: Record<string, SpecialTileType> = {};
  const enabledSpecials: SpecialTileType[] = [];
  if (settings.enableBonusTiles) enabledSpecials.push('BONUS');
  if (settings.enableChallengeTiles) enabledSpecials.push('CHALLENGE');
  if (settings.enableDoubleDiceTiles) enabledSpecials.push('DOUBLE_DICE');
  if (settings.enableShieldTiles) enabledSpecials.push('SHIELD');

  if (enabledSpecials.length > 0) {
    const countPerType = boardSize === 100 ? 3 : 2;
    for (const type of enabledSpecials) {
      for (let c = 0; c < countPerType; c++) {
        for (let attempt = 0; attempt < 60; attempt++) {
          const sq = randomInt(5, boardSize - 3);
          if (occupied.has(sq)) continue;
          occupied.add(sq);
          specialTiles[String(sq)] = type;
          break;
        }
      }
    }
  }

  return {
    boardSize,
    ladders,
    snakes,
    specialTiles,
  };
}
