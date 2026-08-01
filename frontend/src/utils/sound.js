// Tiny, dependency-free UI sounds generated via the Web Audio API — no asset
// files needed. Only ever triggered from a real user gesture (a click), so
// browser autoplay policies never block it. Fails silently if AudioContext
// is unavailable; never throws into caller code.

let ctx = null;
const getCtx = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
};

const tone = (freq, duration, when = 0, volume = 0.05) => {
  try {
    const audioCtx = getCtx();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + when + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + when);
    osc.stop(audioCtx.currentTime + when + duration);
  } catch {
    // Audio is a nicety, never let it break the actual action.
  }
};

// Soft descending tick — used right before a destructive action executes.
export const playConfirmTick = () => {
  tone(720, 0.05, 0, 0.04);
  tone(480, 0.07, 0.05, 0.035);
};

// Short bright tap — used for lighter confirmations / success moments.
export const playTapTick = () => {
  tone(880, 0.045, 0, 0.03);
};
