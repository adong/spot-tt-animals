/* Spot TT Animals: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const SPOT = (window.SPOT = window.SPOT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);

  SPOT.sfx = {
    // the farm animals (quiet, now and then while you count; never one per animal, so they don't give the count away)
    moo() {
      tone({ type: 'sawtooth', f: 150, to: 118, dur: 0.9, vol: 0.09, lp: 650, attack: 0.08 });
      tone({ type: 'sawtooth', f: 152, to: 120, dur: 0.9, vol: 0.05, lp: 900, attack: 0.1 });
    },
    baa() {
      for (let i = 0; i < 5; i++) tone({ type: 'square', f: 430 + (i % 2) * 25, to: 410, at: i * 0.07, dur: 0.09, vol: 0.035, lp: 1600 });
    },
    cluck() {
      for (let i = 0; i < 3; i++) tone({ type: 'square', f: 900 - i * 60, to: 500, at: i * 0.13, dur: 0.06, vol: 0.04, lp: 2400 });
    },
    crow() {
      tone({ type: 'sawtooth', f: 500, to: 900, dur: 0.25, vol: 0.05, lp: 2600 });
      tone({ type: 'sawtooth', f: 900, at: 0.25, dur: 0.35, vol: 0.05, lp: 2600 });
      tone({ type: 'sawtooth', f: 900, to: 450, at: 0.6, dur: 0.4, vol: 0.05, lp: 2400 });
    },
    animal(type) {
      if (type === 'cow') this.moo();
      else if (type === 'sheep') this.baa();
      else if (type === 'rooster') this.crow();
      else this.cluck();
    },
    // round start: a little fanfare; 3 2 1 beeps; GO! whistle
    roundStart() { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.09, dur: 0.14, vol: 0.12 })); },
    beep(n) { tone({ type: 'square', f: 660, dur: 0.12, vol: 0.06, lp: 2600 }); void n; },
    go() {
      tone({ type: 'square', f: 1320, dur: 0.32, vol: 0.07, lp: 3400 });
      tone({ type: 'sine', f: 2200, to: 2600, dur: 0.3, vol: 0.05 });
    },
    tick(n) { tone({ type: 'square', f: n <= 3 ? 990 : 820, dur: 0.06, vol: 0.05, lp: 3000 }); },
    // time's up: the binoculars snap shut
    shut() {
      tone({ type: 'square', f: 300, to: 90, dur: 0.18, vol: 0.12, lp: 1400 });
      hiss({ filter: 'lowpass', f: 1600, to: 300, dur: 0.15, vol: 0.15 });
    },
    lens() { hiss({ f: 1800, to: 5000, dur: 0.25, vol: 0.05, q: 2 }); },
    clicker() { tone({ type: 'square', f: 1800, dur: 0.02, vol: 0.03, lp: 5000 }); },
    typed() { tone({ type: 'triangle', f: 880, dur: 0.06, vol: 0.08 }); },
    lock() {
      tone({ type: 'square', f: 520, to: 260, dur: 0.08, vol: 0.08, lp: 2000 });
      tone({ type: 'triangle', f: 1040, at: 0.06, dur: 0.1, vol: 0.08 });
    },
    // the reveal counts the animals one by one, each a little higher
    pip(k) { tone({ type: 'triangle', f: 600 * Math.pow(2, Math.min(k, 24) / 14), dur: 0.08, vol: 0.09 }); },
    right() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.12, vol: 0.06, lp: 3600 })); },
    wrong() { tone({ type: 'sawtooth', f: 260, to: 150, dur: 0.45, vol: 0.07, lp: 900 }); },
    draw() { tone({ type: 'sine', f: 400, to: 700, dur: 0.18, vol: 0.12 }); tone({ type: 'sine', f: 700, to: 400, at: 0.18, dur: 0.2, vol: 0.1 }); },
    // Tommy Freeze: an icy shimmer, then a crackle when it thaws
    freeze() {
      hiss({ filter: 'highpass', f: 5000, to: 9000, dur: 0.6, vol: 0.12 });
      [1568, 2093, 2637, 3136].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.05, dur: 0.35, vol: 0.05 }));
    },
    thaw() { for (let i = 0; i < 6; i++) hiss({ filter: 'bandpass', f: 2500 + i * 300, at: i * 0.04, dur: 0.03, vol: 0.12, q: 3 }); },
    // the helicopter: whup-whup-whup for as long as it's there
    heli(sec) {
      const n = Math.round(sec * 9);
      for (let i = 0; i < n; i++) hiss({ filter: 'lowpass', f: 420, at: i / 9, dur: 0.07, vol: 0.18 * (i < 6 ? (i + 1) / 6 : i > n - 6 ? (n - i) / 6 : 1) });
      tone({ type: 'triangle', f: 330, to: 660, dur: 0.3, vol: 0.06 });
    },
    // your brother: beep-beep hello, the treat, the save, and the high five's clap
    hello() {
      tone({ type: 'square', f: 660, dur: 0.1, vol: 0.06, lp: 2400 });
      tone({ type: 'square', f: 880, at: 0.14, dur: 0.14, vol: 0.06, lp: 2400 });
    },
    treat() { S.coin(3); tone({ type: 'triangle', f: 1568, at: 0.12, dur: 0.2, vol: 0.1 }); },
    save() {
      tone({ type: 'triangle', f: 880, dur: 0.1, vol: 0.12 });
      tone({ type: 'triangle', f: 1320, at: 0.08, dur: 0.25, vol: 0.12 });
      hiss({ f: 2500, to: 6000, dur: 0.3, vol: 0.08 });
    },
    cheer() {
      hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.4, q: 1.2 });
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: 0.08 + i * 0.07, dur: 0.14, vol: 0.1 }));
    },
    spot() { [988, 1319].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.08, dur: 0.12, vol: 0.06 })); },
    ready() { tone({ type: 'triangle', f: 1175, dur: 0.08, vol: 0.06 }); tone({ type: 'triangle', f: 1568, at: 0.07, dur: 0.1, vol: 0.06 }); },
    nope() { tone({ type: 'square', f: 200, dur: 0.08, vol: 0.05, lp: 1200 }); tone({ type: 'square', f: 160, at: 0.09, dur: 0.1, vol: 0.05, lp: 1200 }); },
    fanfare() {
      const notes = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.78], [784, 0.9], [1047, 1.05]];
      for (const [f, at] of notes) tone({ type: 'square', f, at, dur: at >= 1.05 ? 0.55 : 0.13, vol: 0.07, lp: 3600 });
      for (const [f, at] of [[131, 0], [196, 0.36], [262, 0.6], [196, 0.9], [262, 1.05]]) tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.22 });
    },
    unlock() { [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.18, vol: 0.09 })); hiss({ f: 3000, to: 8000, dur: 0.6, vol: 0.06 }); },
    click() { S.click(); },
  };
})();
