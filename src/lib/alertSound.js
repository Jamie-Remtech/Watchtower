// In-app alert tones, synthesized (no audio files to fetch offline).
// Played when an alert or check-in arrives while Watchtower is open.

let ctx = null;
const audio = () => {
  ctx = ctx ?? new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const tone = (c, freq, start, dur, type = 'sine', vol = 0.12) => {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  gain.gain.setValueAtTime(0, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
  return osc;
};

export function playAlert(sound = 'standard') {
  try {
    if (sound === 'vibrate') {
      navigator.vibrate?.([300, 120, 300]);
      return;
    }
    const c = audio();
    if (sound === 'siren') {
      for (let i = 0; i < 3; i++) {
        const osc = tone(c, 600, i * 0.7, 0.65, 'sawtooth', 0.09);
        osc.frequency.linearRampToValueAtTime(1300, c.currentTime + i * 0.7 + 0.6);
      }
    } else if (sound === 'chime') {
      [880, 1109, 1319].forEach((f, i) => tone(c, f, i * 0.18, 0.5, 'sine', 0.1));
    } else if (sound === 'pulse') {
      for (let i = 0; i < 5; i++) tone(c, 1000, i * 0.14, 0.08, 'square', 0.06);
    } else {
      [880, 660, 880, 660].forEach((f, i) => tone(c, f, i * 0.22, 0.18, 'triangle', 0.12));
    }
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* no audio available */ }
}
