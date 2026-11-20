import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from '../types/game';

export type RefreshIntervalOption = 2 | 3 | 5 | 0; // 0 = Live

export function usePeriodicBoardRefresh(
  latestPlayers: Player[],
  defaultIntervalSec: RefreshIntervalOption = 3
) {
  const [intervalSec, setIntervalSec] = useState<RefreshIntervalOption>(defaultIntervalSec);
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>(latestPlayers);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [justRefreshed, setJustRefreshed] = useState(false);

  const latestRef = useRef<Player[]>(latestPlayers);
  const hasSyncedNonEmptyRef = useRef(latestPlayers.length > 0);

  useEffect(() => {
    latestRef.current = latestPlayers;
    // Sync immediately on initial populate or when Live (0s) mode is active
    if ((!hasSyncedNonEmptyRef.current && latestPlayers.length > 0) || intervalSec === 0) {
      hasSyncedNonEmptyRef.current = latestPlayers.length > 0;
      setDisplayedPlayers(latestPlayers);
      setLastRefreshedAt(Date.now());
    }
  }, [latestPlayers, intervalSec]);

  const refreshNow = useCallback(() => {
    setDisplayedPlayers(latestRef.current);
    setLastRefreshedAt(Date.now());
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 450);
  }, []);

  useEffect(() => {
    if (intervalSec === 0) return;
    const id = setInterval(() => {
      refreshNow();
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [intervalSec, refreshNow]);

  const formattedTime = new Date(lastRefreshedAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    displayedPlayers,
    intervalSec,
    setIntervalSec,
    lastRefreshedAt,
    formattedTime,
    justRefreshed,
    refreshNow,
  };
}
