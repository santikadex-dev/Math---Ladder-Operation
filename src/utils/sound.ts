let audioCtx: AudioContext | null = null;
let isMuted = false;
let bgmMuted = false;
let bgmWanted = false;
let bgmTimerId: ReturnType<typeof setInterval> | null = null;
let bgmStep = 0;
let gestureListenerAttached = false;

function ensureCtx(ignoreMute = false): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ignoreMute && isMuted) return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function attachUnlockListener() {
  if (typeof window === 'undefined' || gestureListenerAttached) return;
  gestureListenerAttached = true;
  const unlock = () => {
    const ctx = ensureCtx(true);
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function setSoundMuted(muted: boolean) {
  isMuted = muted;
  if (muted) {
    pauseBgmLoop();
  } else if (bgmWanted && !bgmMuted) {
    ensureBgmLoop();
  }
}

export function getSoundMuted(): boolean {
  return isMuted;
}

export function setBgmMuted(muted: boolean) {
  bgmMuted = muted;
  if (muted) {
    pauseBgmLoop();
  } else if (bgmWanted && !isMuted) {
    ensureBgmLoop();
  }
}

export function getBgmMuted(): boolean {
  return bgmMuted;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  delay = 0,
  gainVal = 0.08
) {
  const ctx = ensureCtx(false);
  if (!ctx || ctx.state !== 'running') {
    // Still attempt resume for next note if triggered inside user gesture
    ensureCtx(false);
    if (!ctx) return;
  }
  try {
    const startAt = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(gainVal, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.01);
  } catch {
    // Ignore audio context errors
  }
}

// Upbeat classroom game loop (16 steps @ 125 BPM -> 240ms/step, 8th notes)
// Light marimba melody + warm bassline in C major pentatonic / mixolydian
const MELODY_NOTES: (number | null)[] = [
  523.25, null, 659.25, 783.99,
  659.25, null, 880.0, 783.99,
  587.33, null, 659.25, 783.99,
  659.25, 587.33, 523.25, null,
  523.25, null, 659.25, 783.99,
  1046.5, null, 880.0, 783.99,
  698.46, null, 659.25, 587.33,
  659.25, 587.33, 523.25, null,
];

const BASS_NOTES: (number | null)[] = [
  130.81, null, null, null,
  196.0, null, null, null,
  146.83, null, null, null,
  196.0, null, 130.81, null,
  130.81, null, null, null,
  220.0, null, null, null,
  174.61, null, 196.0, null,
  130.81, null, 196.0, null,
];

function playBgmStep() {
  if (isMuted || bgmMuted || !bgmWanted) return;
  const ctx = ensureCtx(false);
  if (!ctx || ctx.state !== 'running') return;

  const idx = bgmStep % MELODY_NOTES.length;
  bgmStep = (bgmStep + 1) % MELODY_NOTES.length;

  const mel = MELODY_NOTES[idx];
  const bass = BASS_NOTES[idx];

  if (mel) {
    playTone(mel, 0.19, 'triangle', 0, 0.026);
  }
  if (bass) {
    playTone(bass, 0.28, 'sine', 0, 0.03);
  }
}

function ensureBgmLoop() {
  attachUnlockListener();
  if (bgmTimerId !== null) return;
  if (isMuted || bgmMuted || !bgmWanted) return;
  ensureCtx(false);
  bgmTimerId = setInterval(playBgmStep, 220);
}

function pauseBgmLoop() {
  if (bgmTimerId !== null) {
    clearInterval(bgmTimerId);
    bgmTimerId = null;
  }
}

export function startBgm() {
  bgmWanted = true;
  if (!isMuted && !bgmMuted) {
    ensureBgmLoop();
  }
}

export function stopBgm() {
  bgmWanted = false;
  pauseBgmLoop();
}

export const soundFx = {
  select() {
    playTone(580, 0.045, 'triangle', 0, 0.07);
    playTone(760, 0.05, 'sine', 0.025, 0.05);
  },
  rouletteTick() {
    playTone(720, 0.03, 'triangle', 0, 0.055);
  },
  diceLand() {
    playTone(523.25, 0.09, 'triangle', 0, 0.09);
    playTone(783.99, 0.14, 'sine', 0.07, 0.1);
    playTone(1046.5, 0.22, 'sine', 0.14, 0.09);
  },
  diceRoll() {
    [220, 290, 260, 340].forEach((f, i) => playTone(f, 0.06, 'triangle', i * 0.06, 0.06));
  },
  correct() {
    playTone(523.25, 0.11, 'sine', 0, 0.09);
    playTone(659.25, 0.12, 'sine', 0.08, 0.09);
    playTone(783.99, 0.18, 'sine', 0.16, 0.09);
  },
  wrong() {
    playTone(260, 0.15, 'triangle', 0, 0.09);
    playTone(185, 0.24, 'sawtooth', 0.12, 0.05);
  },
  nextRound() {
    playTone(440, 0.08, 'sine', 0, 0.06);
    playTone(587.33, 0.12, 'sine', 0.06, 0.07);
  },
  ladder() {
    [440, 523, 659, 784].forEach((f, i) => playTone(f, 0.12, 'sine', i * 0.07, 0.08));
  },
  snake() {
    [440, 370, 294, 220].forEach((f, i) => playTone(f, 0.12, 'sawtooth', i * 0.07, 0.04));
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.24, 'triangle', i * 0.1, 0.1));
  },
};
