// Eyes-free acknowledgements: a short beep plus a brief spoken echo,
// so responders never have to look at the screen to know a command
// registered. Read-back of safety-critical values is standard practice.

let ctx = null;

export const beep = (ok = true) => {
  try {
    ctx = ctx ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch { /* no audio available */ }
};

export const say = (text) => {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.15;
    u.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* no TTS available */ }
};
