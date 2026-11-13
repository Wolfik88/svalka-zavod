/* Простые звуки, синтезированные через WebAudio: никаких файлов. */
(function () {
  'use strict';

  let ac = null;
  let master = null;
  let muted = false;
  let paused = false;
  let blurred = false;

  function unlock() {
    blurred = false;
    if (!ac) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ac = new Ctx();
        master = ac.createGain();
        master.gain.value = 0.45;
        master.connect(ac.destination);
      } catch (e) { ac = null; return; }
    }
    apply();
  }

  function apply() {
    if (!ac) return;
    const on = !muted && !paused && !blurred;
    try {
      if (on && ac.state === 'suspended') ac.resume();
      else if (!on && ac.state === 'running') ac.suspend();
    } catch (e) { /* ignore */ }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ac || muted || paused || blurred) return;
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  const SFX = {
    pick: function () { tone(520, 0.06, 'square', 0.06); },
    ok: function (combo) {
      const f = 560 * Math.pow(1.06, Math.min(combo || 0, 12));
      tone(f, 0.1, 'triangle', 0.22);
      tone(f * 1.5, 0.12, 'triangle', 0.16, null, 0.06);
    },
    auto: function () { tone(760, 0.05, 'sine', 0.06); },
    bad: function () { tone(190, 0.22, 'sawtooth', 0.1, 110); },
    coin: function () {
      tone(990, 0.08, 'square', 0.07);
      tone(1320, 0.14, 'square', 0.07, null, 0.07);
    },
    buy: function () {
      tone(440, 0.08, 'triangle', 0.18);
      tone(660, 0.12, 'triangle', 0.18, null, 0.07);
    },
    stage: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.2, null, i * 0.1); });
    },
    star: function () {
      [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.14, 'square', 0.08, null, i * 0.07); });
    },
    crack: function () { tone(320, 0.07, 'square', 0.12, 160); },
    break: function () {
      tone(220, 0.18, 'sawtooth', 0.12, 70);
      tone(660, 0.08, 'square', 0.06, 330, 0.03);
    },
    truck: function () { tone(70, 0.6, 'sawtooth', 0.06, 55); },
    rac: function () { tone(1200, 0.06, 'square', 0.05, 1500); tone(1300, 0.06, 'square', 0.05, 1600, 0.09); },
    woof: function () { tone(260, 0.09, 'sawtooth', 0.15, 160); tone(240, 0.1, 'sawtooth', 0.15, 140, 0.14); }
  };

  window.GameAudio = {
    unlock: unlock,
    play: function (name, arg) { if (SFX[name]) SFX[name](arg); },
    setMuted: function (v) { muted = !!v; apply(); },
    isMuted: function () { return muted; },
    setPaused: function (v) { paused = !!v; apply(); },
    setBlurred: function (v) { blurred = !!v; apply(); }
  };
})();
