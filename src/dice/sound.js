// The sound of dice landing, made with Web Audio (neither roller has one): a short burst of
// filtered noise per die, a few milliseconds apart. Off unless the tray's sound setting is on.

const contexts = new WeakMap();

export function clatter(win, count) {
  const Context = win.AudioContext || win.webkitAudioContext;
  if (!Context) return;
  if (!contexts.has(win)) contexts.set(win, new Context());
  const context = contexts.get(win);
  const rate = context.sampleRate;
  const length = Math.floor(rate * 0.05);
  for (let die = 0; die < Math.min(count, 6); die++) {
    const buffer = context.createBuffer(1, length, rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 1400;
    const gain = context.createGain();
    gain.gain.value = 0.35;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(context.currentTime + die * 0.035);
  }
}
