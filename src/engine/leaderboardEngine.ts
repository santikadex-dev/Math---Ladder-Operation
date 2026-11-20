import type { Player } from '../types/game';

export interface RankedPlayer {
  rank: number;
  player: Player;
}

/**
 * Fair classroom ranking strategy:
 * 1. Finished players rank above unfinished players.
 * 2. Among finished players, rank by finishing round (lower is better).
 * 3. Among unfinished players, rank by board position (higher is better).
 * 4. Tie-break by accuracy (higher is better).
 * 5. Tie-break by correct answers (higher is better).
 * 6. Deterministic tie-break by XP then alphabetical name.
 */
export function rankPlayers(players: Player[]): RankedPlayer[] {
  const active = players.filter((p) => p.status !== 'REMOVED');
  const sorted = [...active].sort((a, b) => {
    if (a.finished !== b.finished) {
      return a.finished ? -1 : 1;
    }
    if (a.finished && b.finished) {
      const roundA = a.finishedRound ?? 9999;
      const roundB = b.finishedRound ?? 9999;
      if (roundA !== roundB) return roundA - roundB;
    }
    if (a.position !== b.position) return b.position - a.position;
    if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
    if (a.correctAnswers !== b.correctAnswers) return b.correctAnswers - a.correctAnswers;
    if (a.xp !== b.xp) return b.xp - a.xp;
    return a.displayName.localeCompare(b.displayName);
  });

  return sorted.map((player, index) => ({
    rank: index + 1,
    player,
  }));
}
