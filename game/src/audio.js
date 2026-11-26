// Synthesised sound for Dawn Patrol: no audio files, everything is built
// with WebAudio — a prop-engine drone, wind, a ring chime, a crash thud and
// a short landing fanfare. Audio starts only after a user gesture.
export function createAudio() {
  const api = {
    ctx: null,
    muted: false,
    engine: null,
    wind: null,
    windGain: null,
    engineGain: null,
  };

  function ensure() {
    if (api.ctx) return api.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    api.ctx = ctx;

    // Engine: a low sawtooth through a low-pass, pitch follows throttle.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 110;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const eg = ctx.createGain();
    eg.gain.value = 0;
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(eg);
    eg.connect(ctx.destination);
    osc.start();
    osc2.start();

    // Wind: looped noise through a band-pass, loudness follows speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    noise.connect(bp);
    bp.connect(wg);
    wg.connect(ctx.destination);
    noise.start();

    api.engine = { osc, osc2, lp };
    api.engineGain = eg;
    api.windGain = wg;
    return ctx;
  }

  function tone(freq, at, dur, type, vol) {
    if (!api.ctx || api.muted) return;
    const ctx = api.ctx;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime + at);
    g.gain.linearRampToValueAtTime(vol || 0.22, ctx.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur + 0.05);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      api.muted = m;
      if (api.ctx) api.ctx.suspend();
      if (api.ctx && !m) api.ctx.resume();
    },
    isMuted() {
      return api.muted;
    },
    update(throttle, speed, flying) {
      if (!api.ctx || api.muted) return;
      const ctx = api.ctx;
      const rpm = 52 + throttle * 96 + speed * 0.35;
      api.engine.osc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      api.engine.osc2.frequency.setTargetAtTime(rpm * 2.02, ctx.currentTime, 0.08);
      api.engine.lp.frequency.setTargetAtTime(260 + throttle * 700, ctx.currentTime, 0.1);
      const target = flying ? 0.05 + throttle * 0.075 : 0;
      api.engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
      api.windGain.gain.setTargetAtTime(
        flying ? Math.min(0.16, (speed / 86) * 0.16) : 0,
        ctx.currentTime,
        0.15,
      );
    },
    ring() {
      tone(660, 0, 0.35, 'sine', 0.25);
      tone(990, 0.09, 0.4, 'sine', 0.22);
      tone(1320, 0.18, 0.5, 'sine', 0.18);
    },
    crash() {
      if (!api.ctx || api.muted) return;
      const ctx = api.ctx;
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
      tone(70, 0, 0.5, 'sine', 0.5);
    },
    win() {
      tone(523, 0, 0.3, 'triangle', 0.25);
      tone(659, 0.12, 0.3, 'triangle', 0.25);
      tone(784, 0.24, 0.3, 'triangle', 0.25);
      tone(1047, 0.36, 0.6, 'triangle', 0.28);
    },
  };
}
