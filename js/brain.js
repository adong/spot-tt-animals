/* Spot TT Animals: the computer player. No Three.js in here.
   It only ever gets match.cpuView(i): its own character, its own field's count, the difficulty and the sky.
   It never sees your field, your count or your answer (tools/check.js proves its answers don't change when yours do).

   It counts its own field and then, like a person, sometimes slips by one or two. How often it gets the count right
   is CONFIG.cpu.accuracy (PROPOSAL: 60% / 75% / 90% for easy / medium / hard), nudged a little by its own powers
   and by the dark (CONFIG.cpu.mods). */
(function () {
  'use strict';
  const SPOT = (window.SPOT = window.SPOT || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function accuracy(view, cfg) {
    const c = cfg.cpu, m = c.mods;
    let p = c.accuracy[view.difficulty];
    if (view.char === 'teddy') p += m.wideView;
    if (view.powerKind === 'freeze' && view.usedPower) p += m.freeze;
    if (view.sky === 'night') {
      p += m.night;
      if (view.powerKind === 'spotlight' && view.usedPower) p += m.spotlightAtNight;
    }
    return clamp(p, 0, 1);
  }

  // { at: seconds into the 3 s answer window, value: 0..20 }
  function planAnswer(view, cfg, rng) {
    const max = SPOT.RULES.maxAnimals;
    let value = view.count;
    if (rng() >= accuracy(view, cfg)) {
      const off = rng() < 0.7 ? 1 : 2, dir = rng() < 0.5 ? -1 : 1;
      value = view.count + dir * off;
      if (value < 0 || value > max) value = view.count - dir * off;
      value = clamp(value, 0, max);
    }
    const [a, b] = cfg.cpu.answerDelay;
    return { at: a + rng() * (b - a), value };
  }

  // Seconds to wait before using a power that's ready, or null for "don't" (Teddy's is always on, and the
  // helicopter only flies at night).
  function powerWait(view, cfg, rng) {
    if (!view.powerKind) return null;
    if (view.powerKind === 'spotlight' && cfg.characters.pilot.nightOnly && view.sky !== 'night') return null;
    const [a, b] = cfg.cpu.powerWait;
    return a + rng() * (b - a);
  }

  SPOT.brain = { accuracy, planAnswer, powerWait };
})();
