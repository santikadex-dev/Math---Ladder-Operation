let audioCtx: AudioContext | null = null;
let isMuted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted) return null;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export function setSoundMuted(muted: boolean) {
  isMuted = muted;
}

export function getSoundMuted(): boolean {
  return isMuted;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gainVal = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch {
    // Ignore audio context errors
  }
}

export const soundFx = {
  diceRoll() {
    [220, 290, 260, 340].forEach((f, i) => playTone(f, 0.06, 'triangle', i * 0.06, 0.06));
  },
  correct() {
    playTone(523.25, 0.12, 'sine', 0, 0.09);
    playTone(659.25, 0.16, 'sine', 0.08, 0.09);
  },
  wrong() {
    playTone(240, 0.16, 'triangle', 0, 0.08);
    playTone(185, 0.22, 'triangle', 0.12, 0.07);
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
