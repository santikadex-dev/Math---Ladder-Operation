import type { Operation, Player } from '../types/game';
import { rankPlayers } from './leaderboardEngine';

export interface OperationAccuracy {
  operation: Operation;
  label: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface ClassAnalytics {
  totalQuestionsAnswered: number;
  classAccuracy: number;
  totalLaddersClimbed: number;
  totalSnakesEncountered: number;
  operationBreakdown: OperationAccuracy[];
  lowestOperation: OperationAccuracy | null;
  highAccuracyStudents: Player[];
  supportNeededStudents: Player[];
  negativeStruggleStudents: Player[];
  frequentTimeoutStudents: Player[];
  progressBuckets: { label: string; count: number }[];
}

const OP_LABELS: Record<Operation, string> = {
  ADD: 'Penjumlahan (+)',
  SUB: 'Pengurangan (−)',
  MUL: 'Perkalian (×)',
  DIV: 'Pembagian (÷)',
};

export function computeClassAnalytics(players: Player[]): ClassAnalytics {
  const active = players.filter((p) => p.status !== 'REMOVED');

  let totalCorrect = 0;
  let totalAttempts = 0;
  let totalLaddersClimbed = 0;
  let totalSnakesEncountered = 0;

  const opAgg: Record<Operation, { attempted: number; correct: number }> = {
    ADD: { attempted: 0, correct: 0 },
    SUB: { attempted: 0, correct: 0 },
    MUL: { attempted: 0, correct: 0 },
    DIV: { attempted: 0, correct: 0 },
  };

  for (const p of active) {
    totalCorrect += p.correctAnswers;
    totalAttempts += p.correctAnswers + p.incorrectAnswers + p.timeoutCount;
    totalLaddersClimbed += p.laddersClimbed;
    totalSnakesEncountered += p.snakesEncountered;

    if (p.operationStats) {
      (['ADD', 'SUB', 'MUL', 'DIV'] as Operation[]).forEach((op) => {
        const stat = p.operationStats?.[op];
        if (stat) {
          opAgg[op].attempted += stat.attempted;
          opAgg[op].correct += stat.correct;
        }
      });
    }
  }

  const operationBreakdown: OperationAccuracy[] = (['ADD', 'SUB', 'MUL', 'DIV'] as Operation[])
    .map((op) => {
      const { attempted, correct } = opAgg[op];
      return {
        operation: op,
        label: OP_LABELS[op],
        attempted,
        correct,
        accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
      };
    })
    .filter((item) => item.attempted > 0);

  const lowestOperation =
    operationBreakdown.length > 0
      ? [...operationBreakdown].sort((a, b) => a.accuracy - b.accuracy)[0]
      : null;

  const highAccuracyStudents = active.filter(
    (p) => p.correctAnswers + p.incorrectAnswers > 0 && p.accuracy >= 80
  );
  const supportNeededStudents = active.filter(
    (p) => p.correctAnswers + p.incorrectAnswers + p.timeoutCount > 0 && p.accuracy < 50
  );
  const negativeStruggleStudents = active.filter((p) => {
    const neg = p.negativeStats;
    if (!neg || neg.attempted < 2) return false;
    return neg.correct / neg.attempted < 0.5;
  });
  const frequentTimeoutStudents = active.filter((p) => p.timeoutCount >= 2);

  const buckets = [
    { label: '1–25', count: 0 },
    { label: '26–50', count: 0 },
    { label: '51–75', count: 0 },
    { label: '76–99', count: 0 },
    { label: '100 (Finish)', count: 0 },
  ];
  for (const p of active) {
    if (p.position >= 100) buckets[4].count++;
    else if (p.position >= 76) buckets[3].count++;
    else if (p.position >= 51) buckets[2].count++;
    else if (p.position >= 26) buckets[1].count++;
    else buckets[0].count++;
  }

  return {
    totalQuestionsAnswered: totalAttempts,
    classAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    totalLaddersClimbed,
    totalSnakesEncountered,
    operationBreakdown,
    lowestOperation,
    highAccuracyStudents,
    supportNeededStudents,
    negativeStruggleStudents,
    frequentTimeoutStudents,
    progressBuckets: buckets,
  };
}

export function exportResultsToCsv(roomCode: string, players: Player[]): void {
  const ranked = rankPlayers(players);
  const headers = [
    'Peringkat',
    'Nama Siswa',
    'Posisi Akhir',
    'Status Finish',
    'Ronde Finish',
    'Benar',
    'Salah',
    'Waktu Habis',
    'Akurasi (%)',
    'Streak Terbaik',
    'XP',
    'Koin',
    'Naik Tangga',
    'Kena Ular',
  ];

  const rows = ranked.map(({ rank, player }) => [
    rank,
    `"${player.displayName.replace(/"/g, '""')}"`,
    player.position,
    player.finished ? 'Selesai' : 'Aktif',
    player.finishedRound ?? '-',
    player.correctAnswers,
    player.incorrectAnswers,
    player.timeoutCount,
    player.accuracy,
    player.bestStreak,
    player.xp,
    player.gold,
    player.laddersClimbed,
    player.snakesEncountered,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `math-ladder-${roomCode}-hasil.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
