/* Spot TT Animals: the rules. A match is five rounds; each round goes
     ready (ROUND n OF 5, 3 2 1 GO!) -> observe (60 / 30 / 15 s) -> answer (30 s: Alan's change, Teddy's document said 3) -> result,
   and after the fifth result, final. Every player has their own field, animals, binoculars, power and answer box.
   No Three.js in here: the browser game (js/game.js) and the Node check (tools/check.js) run the same code at a
   fixed 60 ticks a second. All the numbers come from js/config.js.

   Anyone can answer early, while still counting: their own binoculars shut and their own answer time starts at once,
   and the round moves on as soon as every player is done (so nobody waits out the clock once they're sure).
   The screen only ever reads match.view(), which keeps every answer hidden until both are locked (or the time is up).
   The computer player only ever reads match.cpuView(i): its own field, nothing of yours. */
(function () {
  'use strict';
  const SPOT = (window.SPOT = window.SPOT || {});
  const RULES = SPOT.RULES;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  // ---------------------------------------------------------------- randomness (seeded, so a match can be replayed)

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const rnd = (rng, a, b) => a + rng() * (b - a);

  // ---------------------------------------------------------------- characters

  // Teddy's three. The pilot's look (who flies the helicopter) is CONFIG.characters.pilot.who.
  const CHARS = {
    teddy: { id: 'teddy', power: null, ability: 'wide_view' }, // always on: bigger binoculars
    tommy: { id: 'tommy', power: 'freeze', ability: 'freeze' },
    pilot: { id: 'pilot', power: 'spotlight', ability: 'spotlight' },
  };
  const powerOf = (char) => (CHARS[char] ? CHARS[char].power : null);
  // the companion's treats, the same six in every family game
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  function powerTimes(cfg, kind) {
    if (kind === 'freeze') return { dur: cfg.characters.tommy.freezeDurationSeconds, cool: cfg.characters.tommy.cooldownSeconds };
    if (kind === 'spotlight') return { dur: cfg.characters.pilot.durationSeconds, cool: cfg.characters.pilot.cooldownSeconds };
    return { dur: 0, cool: 0 };
  }

  // ---------------------------------------------------------------- the binoculars

  // Each player sees their field through two round lenses side by side, looking down at CONFIG.lens.tilt.
  // Lens units: x across, y up the screen; the middle of the view is the middle of the field.
  function lensRadius(cfg, char) {
    return cfg.lens.radius * (char === 'teddy' ? cfg.characters.teddy.viewMultiplier : 1);
  }
  function toLens(cfg, x, z, y = 0) {
    const t = (cfg.lens.tilt * Math.PI) / 180;
    return { sx: x, sy: -z * Math.sin(t) + y * Math.cos(t) };
  }
  function inLens(cfg, r, x, z, y = 0) {
    const p = toLens(cfg, x, z, y), o = cfg.lens.lobe * r;
    return Math.hypot(p.sx - o, p.sy) < r || Math.hypot(p.sx + o, p.sy) < r;
  }
  // How much of the field a lens of radius r shows (0..1), by sampling a grid.
  function lensCover(cfg, r, n = 80) {
    const W = cfg.field.width, D = cfg.field.depth;
    let hit = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (inLens(cfg, r, ((a + 0.5) / n - 0.5) * W, ((b + 0.5) / n - 0.5) * D)) hit++;
    return hit / (n * n);
  }

  // ---------------------------------------------------------------- fields and animals

  // Where an animal wanders to next: anywhere in the field, but mostly towards the middle (CONFIG.field.centerPull).
  function wanderTarget(cfg, rng) {
    const hw = cfg.field.width / 2 - 0.9, hd = cfg.field.depth / 2 - 0.8, k = cfg.field.centerPull;
    const pick = () => (rng() < k ? rng() + rng() - 1 : rng() * 2 - 1);
    return { x: pick() * hw, z: pick() * hd };
  }

  // One field: `count` animals of one `type`, spread out so none stand on top of each other.
  function makeField(cfg, type, count, rng) {
    const mv = cfg.movement[type];
    const animals = [];
    for (let k = 0; k < count; k++) {
      let p, tries = 0;
      do { p = wanderTarget(cfg, rng); tries++; } while (tries < 40 && animals.some((a) => Math.hypot(a.x - p.x, a.z - p.z) < mv.r * 2.2));
      animals.push({ id: k, type, x: p.x, z: p.z, heading: rng() * TAU, speed: 0, state: 'graze', t: rnd(rng, 0.2, 2.5), tx: p.x, tz: p.z, walked: 0 });
    }
    return { type, count, animals, frozen: false };
  }

  function moveField(cfg, f, dt, rng) {
    if (f.frozen) return; // Tommy Freeze: nothing in this field moves at all
    const mv = cfg.movement[f.type];
    for (const a of f.animals) {
      if (a.state === 'graze') {
        a.speed = 0;
        a.t -= dt;
        if (a.t <= 0) {
          const p = wanderTarget(cfg, rng);
          a.tx = p.x; a.tz = p.z; a.state = 'walk'; a.t = 14;
        }
        continue;
      }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      a.t -= dt;
      if (d < 0.25 || a.t <= 0) { a.state = 'graze'; a.t = rnd(rng, mv.graze[0], mv.graze[1]); a.speed = 0; continue; }
      const diff = wrap(Math.atan2(dx, dz) - a.heading);
      a.heading = wrap(a.heading + clamp(diff, -mv.turn * dt, mv.turn * dt));
      const sp = mv.speed * (Math.abs(diff) > 1.2 ? 0.35 : 1);
      a.speed = sp;
      a.x += Math.sin(a.heading) * sp * dt;
      a.z += Math.cos(a.heading) * sp * dt;
      a.walked += sp * dt;
    }
    // room to breathe: animals that bump gently push apart, so they can always be counted one by one
    const A = f.animals, min = mv.r * 2;
    for (let i = 0; i < A.length; i++) {
      for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j];
        let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-6) { dx = 1; dz = 0; d = 1e-6; }
        const push = Math.min((min - d) * 0.5, 4 * dt);
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        b.x += (dx / d) * push; b.z += (dz / d) * push;
      }
    }
    const hw = cfg.field.width / 2 - 0.5, hd = cfg.field.depth / 2 - 0.5;
    for (const a of A) { a.x = clamp(a.x, -hw, hw); a.z = clamp(a.z, -hd, hd); }
  }

  // ---------------------------------------------------------------- dealing a round

  // The animal type, day or night, and each player's count. Counts come from each player's own random stream.
  // Rare zero (rules 9 and 10): with CONFIG.animals.zeroProbability, ONE player (picked at random) gets an empty
  // field and the other gets 1 to 20 as usual. Nothing warns anyone.
  function dealRound(cfg, skyMode, rngRound, rngA, rngB) {
    const types = RULES.animalTypes;
    const type = types[Math.floor(rngRound() * types.length)];
    const sky = skyMode === 'mix' ? (rngRound() < cfg.sky.mixNightChance ? 'night' : 'day') : skyMode;
    let zero = -1;
    if (cfg.animals.allowRareZero && rngRound() < cfg.animals.zeroProbability) zero = rngRound() < 0.5 ? 0 : 1;
    const counts = [rngA, rngB].map((rng, i) => (i === zero ? 0 : randInt(rng, cfg.animals.min, cfg.animals.max)));
    return { type, sky, zero, counts };
  }

  // Who wins a round. Both right = a draw (Teddy's rule 18). Neither right = a draw for now (the document's
  // prototype rule), or the closer answer wins with CONFIG.scoring.bothWrong = 'closest'. No answer = never right.
  function scoreRound(answers, counts, bothWrong) {
    const correct = answers.map((a, i) => a !== null && a === counts[i]);
    let winner = null, why;
    if (correct[0] && correct[1]) why = 'bothRight';
    else if (correct[0]) { winner = 0; why = 'right'; }
    else if (correct[1]) { winner = 1; why = 'right'; }
    else if (bothWrong === 'closest') {
      const off = answers.map((a, i) => (a === null ? Infinity : Math.abs(a - counts[i])));
      if (off[0] < off[1]) { winner = 0; why = 'closest'; }
      else if (off[1] < off[0]) { winner = 1; why = 'closest'; }
      else why = 'bothWrong';
    } else why = 'bothWrong';
    return { correct, winner, why };
  }

  // ---------------------------------------------------------------- a match

  const PHASES = ['ready', 'observe', 'answer', 'result', 'final'];

  // o: { mode: '2p' | 'cpu' | 'demo', difficulty: 'easy' | 'medium' | 'hard', sky: 'day' | 'night' | 'mix',
  //      chars: [p1, p2], seed, cfg, bothWrong, still (no animal movement: fast statistics), autoNext (seconds),
  //      buddyFor (who comes when you call your brother; the game passes Kit.roster.buddyFor) }
  class Match {
    constructor(o = {}) {
      this.cfg = o.cfg || SPOT.CONFIG;
      this.mode = ['2p', 'cpu', 'demo'].includes(o.mode) ? o.mode : '2p';
      this.difficulty = ['easy', 'medium', 'hard'].includes(o.difficulty) ? o.difficulty : 'easy';
      this.skyMode = ['day', 'night', 'mix'].includes(o.sky) ? o.sky : 'day';
      this.bothWrong = o.bothWrong || this.cfg.scoring.bothWrong;
      this.seed = (o.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : o.seed) >>> 0;
      this.still = !!o.still;
      this.autoNext = o.autoNext || 0;
      this.rngRound = makeRng(this.seed ^ 0x9e3779b9);
      this.rngCpu = makeRng(this.seed ^ 0x85ebca6b); // the computer's answers
      this.rngCpuPow = makeRng(this.seed ^ 0xc2b2ae35); // ...and its powers, apart, so the round's length never changes its answers
      this.rngBuddy = makeRng(this.seed ^ 0x27d4eb2f); // the companion's own dice, so calling him never changes the computer
      this.buddyFor = o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy'));
      this.buddy = null; // VS Computer: your brother, while he's visiting
      this.cheerT = 0; // two players: how long the high five still rests
      this.stats = { calls: 0, treats: 0, saves: 0, highFives: 0 };
      const chars = o.chars || ['teddy', 'tommy'];
      this.players = [0, 1].map((i) => ({
        i,
        char: CHARS[chars[i]] ? chars[i] : 'teddy',
        human: this.mode === '2p' || (this.mode === 'cpu' && i === 0),
        score: 0,
        rngField: makeRng(this.seed * 31 + 7919 * (i + 1)),
        rngMove: makeRng(this.seed * 17 + 104729 * (i + 1)),
        field: null,
        lit: false,
        power: { kind: powerOf(chars[i]), activeT: 0, coolT: 0, uses: 0 },
        ans: null,
        cpuWaitAt: null,
        spotT: 0, // two players: a high five lets you spot your hiding animals this long
      }));
      this.rounds = this.cfg.roundsPerGame;
      this.observeT = this.cfg.difficulty[this.difficulty];
      this.answerT = this.cfg.answerTimeSeconds;
      this.round = 0;
      this.t = 0;
      this.events = [];
      this.results = [];
      this.final = null;
      this.tweakCounts = o.tweakCounts || null; // tests only: change the counts after they're dealt
      if (o.patch) o.patch(this); // tests only: the sabotage cases break a method on purpose
      this.startRound();
    }

    emit(type, data) { this.events.push(Object.assign({ type, t: this.t }, data || {})); }

    // ---- rounds

    startRound() {
      this.round++;
      const deal = this.deal();
      let counts = deal.counts;
      if (this.tweakCounts) counts = this.tweakCounts(counts.slice(), this.round);
      this.roundInfo = { round: this.round, type: deal.type, sky: deal.sky, zero: deal.zero };
      this.players.forEach((P, i) => {
        P.field = this.makeField(deal.type, counts[i], P);
        P.ans = this.freshAnswer();
        P.lit = false;
        if (this.cfg.powers.resetEachRound || this.round === 1) { P.power.activeT = 0; P.power.coolT = 0; }
        P.power.usesRound = 0;
        P.cpuWaitAt = null;
      });
      this.cpuPlans = [null, null];
      this.phase = 'ready';
      this.phaseT = 0;
      this.readyStep = -1;
      this.lastTick = 0;
      // the same for every round: nothing here says if a field is empty
      this.emit('round', { round: this.round, rounds: this.rounds, animal: deal.type, sky: deal.sky });
    }
    deal() { return dealRound(this.cfg, this.skyMode, this.rngRound, this.players[0].rngField, this.players[1].rngField); }
    makeField(type, count, P) { return makeField(this.cfg, type, count, P.rngField); }
    freshAnswer() {
      // two players share the keyboard with hidden clickers that start at 0; alone you type (or tap) a number
      // early: when this player said they were ready during the count (their own answer time starts then); spent: that
      // time ran out with no answer
      return { draft: this.mode === '2p' ? 0 : null, typed: null, pendT: 0, locked: false, value: null, at: null, how: null, saved: false, yours: null, early: null, spent: false };
    }

    begin(phase) {
      this.phase = phase;
      this.phaseT = 0;
      if (phase === 'observe') this.emit('go');
      if (phase === 'answer') {
        // observation is over: the binoculars close and every power stops
        for (const P of this.players) {
          P.spotT = 0;
          if (P.power.activeT > 0) { P.power.activeT = 0; P.power.coolT = powerTimes(this.cfg, P.power.kind).cool; }
          this.applyPower(P, false);
        }
        this.players.forEach((P, i) => { if (!P.human) this.cpuPlans[i] = this.planCpuAnswer(i); });
        this.emit('answer', { animal: this.roundInfo.type });
      }
    }

    step(dt) {
      if (this.phase === 'final') return;
      this.t += dt;
      this.phaseT += dt;
      const cfg = this.cfg;
      this.updateBuddy(dt);
      if (this.cheerT > 0) this.cheerT = Math.max(0, this.cheerT - dt);
      if (this.phase === 'ready') {
        const tb = cfg.timing.roundBanner, cs = cfg.timing.countdownStep, n = RULES.readyCountdown;
        const k = this.phaseT < tb ? -1 : Math.floor((this.phaseT - tb) / cs + 1e-9);
        if (k !== this.readyStep && k >= 0 && k < n) { this.readyStep = k; this.emit('count', { n: n - k }); }
        if (this.phaseT >= tb + n * cs - 1e-9) this.begin('observe');
      } else if (this.phase === 'observe') {
        this.tickPowers(dt);
        for (const P of this.players) if (P.spotT > 0) P.spotT = Math.max(0, P.spotT - dt);
        this.cpuObserve();
        this.moveFields(dt);
        this.tickEarly(dt);
        const left = this.observeT - this.phaseT;
        const sec = Math.ceil(left - 1e-9);
        if (sec >= 1 && sec <= RULES.finalCountdown && sec !== this.lastTick) { this.lastTick = sec; this.emit('final', { n: sec }); }
        // the count ends when the time is up, or as soon as every player has answered early
        const humans = this.players.filter((P) => P.human);
        if (left <= 1e-9 || (humans.length && humans.every((P) => this.isDone(P)))) this.begin('answer');
      } else if (this.phase === 'answer') {
        this.moveFields(dt);
        // your brother has your back: nothing typed or locked with a moment left, and he shouts the number for you
        const H = this.players[0], B = this.buddy;
        if (this.mode === 'cpu' && cfg.companion.saves && this.buddyHere() && B.save && this.canAnswer(0) && H.ans.typed === null &&
          this.phaseT >= this.answerT - cfg.companion.shoutBefore - 1e-9) this.buddySave(0, 'answer');
        this.players.forEach((P, i) => {
          const A = P.ans;
          if (A.locked || A.spent) return;
          if (!P.human && this.cpuPlans[i] && this.phaseT >= this.cpuPlans[i].at) this.lockValue(i, this.cpuPlans[i].value, 'cpu');
          else if (A.pendT > 0) { A.pendT -= dt; if (A.pendT <= 0) this.lockValue(i, A.typed, 'typed'); }
        });
        const done = this.players.every((P) => this.isDone(P));
        if ((done && cfg.timing.endAnswerWhenBothLocked) || this.phaseT >= this.answerT - 1e-9) this.reveal();
      } else if (this.phase === 'result') {
        if (this.autoNext && this.phaseT >= this.autoNext) this.next();
      }
    }

    moveFields(dt) {
      if (this.still) return;
      for (const P of this.players) moveField(this.cfg, P.field, dt, P.rngMove);
    }

    // ---- powers: each one changes only its own player's field

    usePower(i) {
      const P = this.players[i], pw = P.power;
      const no = (why) => { this.emit('refuse', { i, why }); return why; };
      if (!pw.kind) return no('passive');
      if (this.phase !== 'observe') return no('phase');
      if (pw.activeT > 0) return no('active');
      if (pw.coolT > 0) return no('cooling');
      if (pw.kind === 'spotlight' && this.cfg.characters.pilot.nightOnly && this.roundInfo.sky !== 'night') return no('day');
      pw.activeT = powerTimes(this.cfg, pw.kind).dur;
      pw.uses++;
      pw.usesRound++;
      this.applyPower(P, true);
      this.emit('power', { i, kind: pw.kind });
      return 'ok';
    }
    applyPower(P, on) {
      if (P.power.kind === 'freeze') P.field.frozen = on;
      if (P.power.kind === 'spotlight') P.lit = on;
    }
    tickPowers(dt) {
      for (const P of this.players) {
        const pw = P.power;
        if (pw.activeT > 0) {
          pw.activeT -= dt;
          if (pw.activeT <= 1e-9) {
            pw.activeT = 0;
            pw.coolT = powerTimes(this.cfg, pw.kind).cool; // the cooldown starts when the power runs out
            this.applyPower(P, false);
            this.emit('powerEnd', { i: P.i, kind: pw.kind });
          }
        } else if (pw.coolT > 0) {
          pw.coolT -= dt;
          if (pw.coolT <= 1e-9) { pw.coolT = 0; this.emit('powerReady', { i: P.i, kind: pw.kind }); }
        }
      }
    }
    lensFor(i) { return lensRadius(this.cfg, this.players[i].char); }
    visibleCount(i) {
      const r = this.lensFor(i);
      return this.players[i].field.animals.filter((a) => inLens(this.cfg, r, a.x, a.z, 0.4)).length;
    }

    // ---- the computer player: it sees its own field and nothing else

    cpuView(i) {
      const P = this.players[i];
      return {
        char: P.char, count: P.field.count, difficulty: this.difficulty, sky: this.roundInfo.sky,
        powerKind: P.power.kind, usedPower: P.power.usesRound > 0,
      };
    }
    planCpuAnswer(i) { return SPOT.brain.planAnswer(this.cpuView(i), this.cfg, this.rngCpu); }
    planCpuPower(i) { return SPOT.brain.powerWait(this.cpuView(i), this.cfg, this.rngCpuPow); }
    cpuObserve() {
      for (const P of this.players) {
        const pw = P.power;
        if (P.human || !pw.kind) continue;
        if (pw.activeT > 0 || pw.coolT > 0) { P.cpuWaitAt = null; continue; }
        if (P.cpuWaitAt === null) { const w = this.planCpuPower(P.i); P.cpuWaitAt = w === null ? Infinity : this.phaseT + w; }
        if (this.phaseT >= P.cpuWaitAt) { P.cpuWaitAt = null; this.usePower(P.i); }
      }
    }

    // ---- answers. Two players: W/S and the arrows are hidden clickers, and D / the right arrow locks.
    //      One player: type the number (3-9 and 0 lock at once; 1 and 2 wait a moment for a second digit).
    //      Touch: tap a number from 0 to 20, which locks it. Locked answers can't change.

    canAnswer(i) { const P = this.players[i]; return !!P && P.human && !P.ans.locked && !P.ans.spent; }
    isDone(P) { return P.ans.locked || P.ans.spent; }
    // answering now: in the answer time after the count, or early, once you've said you're ready
    answering(i) { return this.phase === 'answer' || (this.phase === 'observe' && this.players[i].ans.early !== null); }
    // ---- answering early (Alan's request): "I'm ready!" while counting. Your binoculars shut and your own answer time
    //      (the same length as the one after the count) starts now; the other player keeps counting.
    ready(i) {
      const A = this.players[i] && this.players[i].ans;
      if (!this.canAnswer(i) || this.phase !== 'observe' || A.early !== null) return false;
      A.early = this.phaseT;
      this.emit('ready', { i });
      return true;
    }
    // the lock key: while counting it says you're ready (and locks your clicker count if you have one)
    lockNow(i) {
      const A = this.players[i] && this.players[i].ans;
      if (!A) return false;
      if (this.phase === 'observe' && A.early === null && !this.ready(i)) return false;
      if (A.typed === null && A.draft === null) return this.answering(i); // alone with nothing typed: the box is open, type it
      return this.lock(i);
    }
    // your own answer time, while the count goes on for the others
    tickEarly(dt) {
      const cfg = this.cfg;
      this.players.forEach((P, i) => {
        const A = P.ans;
        if (!P.human || A.early === null || this.isDone(P)) return;
        const e = this.phaseT - A.early;
        if (A.pendT > 0) { A.pendT -= dt; if (A.pendT <= 0) { this.lockValue(i, A.typed, 'typed'); return; } }
        if (i === 0 && this.mode === 'cpu' && cfg.companion.saves && this.buddyHere() && this.buddy.save && A.typed === null &&
          e >= this.answerT - cfg.companion.shoutBefore - 1e-9) { this.buddySave(0, 'answer'); return; }
        if (e >= this.answerT - 1e-9) {
          if (A.typed !== null) this.lockValue(i, A.typed, 'typed');
          else { A.spent = true; this.emit('spent', { i }); }
        }
      });
    }
    adjust(i, d) {
      if (!this.canAnswer(i) || (this.phase !== 'observe' && this.phase !== 'answer')) return false;
      const A = this.players[i].ans;
      A.typed = null;
      A.pendT = 0;
      A.draft = clamp((A.draft === null ? 0 : A.draft) + Math.sign(d), 0, RULES.maxAnimals);
      this.emit('click', { i, d: Math.sign(d) }); // the step only, never the number
      return true;
    }
    typeDigit(i, d) {
      if (!this.canAnswer(i) || !(d >= 0 && d <= 9 && Number.isInteger(d))) return false;
      if (this.phase === 'observe' && this.players[i].ans.early === null) this.ready(i); // typing while counting = ready
      if (!this.answering(i)) return false;
      const A = this.players[i].ans, max = RULES.maxAnimals;
      if (A.typed !== null && A.pendT > 0 && A.typed * 10 + d <= max) return this.lockValue(i, A.typed * 10 + d, 'typed');
      A.typed = d;
      A.draft = d;
      if (d === 0 || d * 10 > max) return this.lockValue(i, d, 'typed');
      A.pendT = this.cfg.timing.typedConfirm;
      this.emit('typed', { i });
      return true;
    }
    backspace(i) {
      if (!this.canAnswer(i)) return false;
      const A = this.players[i].ans;
      A.typed = null;
      A.pendT = 0;
      A.draft = this.mode === '2p' ? 0 : null;
      return true;
    }
    pick(i, n) {
      if (!this.canAnswer(i) || !this.answering(i)) return false;
      if (!Number.isInteger(n) || n < 0 || n > RULES.maxAnimals) return false;
      return this.lockValue(i, n, 'pick');
    }
    lock(i) {
      if (!this.canAnswer(i) || !this.answering(i)) return false;
      const A = this.players[i].ans;
      if (A.typed !== null) return this.lockValue(i, A.typed, 'typed');
      if (A.draft === null) { this.emit('refuse', { i, why: 'empty' }); return false; }
      return this.lockValue(i, A.draft, 'count');
    }
    lockValue(i, n, how) {
      const A = this.players[i].ans;
      if (A.locked || (this.phase !== 'answer' && this.phase !== 'observe')) return false;
      A.locked = true;
      A.value = n;
      A.at = this.phaseT;
      A.how = how;
      A.pendT = 0;
      this.emit('lock', { i }); // who locked, never what
      return true;
    }

    // ---- your brother (Alan's series feature): VS Computer only, he only ever helps you, in your own field

    lookOf(char) { return char === 'pilot' ? this.cfg.characters.pilot.who : char; }
    callBuddy() {
      if (this.mode === '2p') return this.highFive();
      if (this.mode !== 'cpu' || this.phase === 'final') return 'none';
      const c = this.cfg.companion, B = this.buddy;
      this.stats.calls++;
      if (!B) {
        this.buddy = { kind: this.buddyFor(this.lookOf(this.players[0].char)), phase: 'hello', t: 0, helloT: c.helloSeconds, treatT: 0, treated: false, left: c.visitSeconds, visit: c.visitSeconds, save: !!c.saves, byeT: 0 };
        this.emit('buddyHello', { who: this.buddy.kind, again: false });
        return 'ok';
      }
      if (B.phase === 'bye' || B.treated) {
        // called again: he says hi again, brings another treat, stays the whole visit again and re-arms his save
        Object.assign(B, { phase: 'hello', helloT: c.helloSeconds, treatT: 0, treated: false, left: c.visitSeconds, save: !!c.saves, byeT: 0 });
        this.emit('buddyHello', { who: B.kind, again: true });
        return 'again';
      }
      B.left = c.visitSeconds; // called again before his treat landed: he just stays longer
      return 'longer';
    }
    updateBuddy(dt) {
      const B = this.buddy;
      if (!B) return;
      const c = this.cfg.companion;
      B.t += dt;
      if (B.phase === 'hello') {
        B.helloT -= dt;
        if (B.helloT <= 0) {
          const [emoji, name] = TREATS[Math.floor(this.rngBuddy() * TREATS.length)];
          B.phase = 'help';
          B.treatT = c.treatFlySeconds;
          this.emit('treat', { emoji, name, who: B.kind });
        }
      } else if (B.phase === 'help' && B.treatT > 0) {
        B.treatT -= dt;
        if (B.treatT <= 0) { B.treated = true; this.stats.treats++; this.emit('treatGot', { who: B.kind }); }
      }
      if (B.phase !== 'bye') {
        B.left -= dt;
        if (B.left <= 0) { B.left = 0; B.phase = 'bye'; B.byeT = c.byeSeconds; this.emit('buddyBye', { who: B.kind }); }
      } else {
        B.byeT -= dt;
        if (B.byeT <= 0) { this.buddy = null; this.emit('buddyOut', { who: B.kind }); }
      }
    }
    buddyHere() { return !!this.buddy && this.buddy.phase !== 'bye'; }
    buddySave(i, how) {
      const P = this.players[i], A = P.ans;
      this.buddy.save = false;
      this.stats.saves++;
      if (how === 'answer') { A.yours = null; this.lockValue(i, P.field.count, 'buddy'); }
      else { A.yours = A.value; A.value = P.field.count; A.how = 'buddy'; }
      A.saved = true;
      this.emit('buddySave', { i, who: this.buddy.kind, how }); // never the number
    }
    // two players: the high five. Both brothers spot their own hiding animals for a while; then it rests.
    cheerRest() { const r = this.cfg.companion.highFiveRest; return r[this.difficulty] !== undefined ? r[this.difficulty] : r.medium; }
    highFive() {
      if (this.mode !== '2p') return 'none';
      const no = (why) => { this.emit('cheerNo', { why }); return why; };
      if (this.phase !== 'observe') return no('phase');
      if (this.cheerT > 0) return no('rest');
      for (const P of this.players) P.spotT = this.cfg.companion.highFiveSpotSeconds;
      this.cheerT = this.cheerRest();
      this.stats.highFives++;
      const treats = this.players.map(() => { const [emoji, name] = TREATS[Math.floor(this.rngBuddy() * TREATS.length)]; return { emoji, name }; });
      this.emit('highFive', { treats });
      return 'ok';
    }
    // spotting: your brother (or a high five) shows you where your own hiding animals are; never anyone else's
    spotting(i) {
      if (this.phase !== 'observe') return false;
      return (this.mode === 'cpu' && i === 0 && this.buddyHere()) || this.players[i].spotT > 0;
    }
    spotted(i) {
      if (!this.spotting(i)) return [];
      const r = this.lensFor(i);
      return this.players[i].field.animals.filter((a) => !inLens(this.cfg, r, a.x, a.z, 0.4));
    }

    // ---- the reveal

    score(answers, counts) { return scoreRound(answers, counts, this.bothWrong); }
    reveal() {
      // a 1 or 2 typed inside the window counts even if its little wait for a second digit wasn't over
      this.players.forEach((P, i) => { if (!P.ans.locked && P.ans.typed !== null) this.lockValue(i, P.ans.typed, 'typed'); });
      // ...and a wrong answer while he's there becomes the right one, once per visit
      const H = this.players[0];
      if (this.mode === 'cpu' && this.cfg.companion.saves && this.buddyHere() && this.buddy.save && H.ans.locked && H.ans.value !== H.field.count) this.buddySave(0, 'fix');
      const answers = this.players.map((P) => (P.ans.locked ? P.ans.value : null));
      const counts = this.players.map((P) => P.field.count);
      const res = this.score(answers, counts);
      if (res.winner !== null) this.players[res.winner].score += this.cfg.scoring.roundWin;
      else for (const P of this.players) P.score += this.cfg.scoring.draw;
      const saved = this.players.map((P) => !!P.ans.saved);
      const yours = this.players.map((P, i) => (P.ans.saved ? P.ans.yours : answers[i]));
      const r = Object.assign({ round: this.round, animal: this.roundInfo.type, sky: this.roundInfo.sky, counts, answers, saved, yours }, res);
      this.results.push(r);
      this.phase = 'result';
      this.phaseT = 0;
      this.emit('reveal', r);
    }

    next() {
      if (this.phase !== 'result') return false;
      if (this.round >= this.rounds) this.finish();
      else this.startRound();
      return true;
    }
    finish() {
      const scores = this.players.map((P) => P.score);
      const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;
      this.final = { scores, winner, results: this.results.slice() };
      this.phase = 'final';
      this.phaseT = 0;
      this.emit('matchEnd', this.final);
    }

    // ---- what the screen may show. Answers stay null until the reveal. In VS Computer you may see your own box.

    view() {
      const shown = this.phase === 'result' || this.phase === 'final';
      const last = shown ? this.results[this.results.length - 1] : null;
      const cfg = this.cfg, night = this.roundInfo.sky === 'night';
      const tb = cfg.timing.roundBanner, cs = cfg.timing.countdownStep;
      return {
        phase: this.phase, round: this.round, rounds: this.rounds, mode: this.mode, difficulty: this.difficulty,
        animal: this.roundInfo.type, sky: this.roundInfo.sky,
        timeLeft: this.phase === 'observe' ? Math.max(0, this.observeT - this.phaseT) : this.phase === 'answer' ? Math.max(0, this.answerT - this.phaseT) : 0,
        countdown: this.phase === 'ready' && this.phaseT >= tb ? RULES.readyCountdown - Math.floor((this.phaseT - tb) / cs + 1e-9) : null,
        scores: this.players.map((P) => P.score),
        players: this.players.map((P, i) => {
          const A = P.ans, pw = P.power;
          const mine = this.mode === 'cpu' && P.human; // the only human: nobody else could read this box
          return {
            char: P.char, human: P.human, lens: this.lensFor(i), frozen: !!P.field.frozen, lit: !!P.lit,
            power: {
              kind: pw.kind, active: pw.activeT > 0, activeLeft: pw.activeT, coolLeft: pw.coolT,
              dur: powerTimes(cfg, pw.kind).dur, cool: powerTimes(cfg, pw.kind).cool,
              dayOnly: pw.kind === 'spotlight' && cfg.characters.pilot.nightOnly && !night,
              ready: !!pw.kind && pw.activeT <= 0 && pw.coolT <= 0 && !(pw.kind === 'spotlight' && cfg.characters.pilot.nightOnly && !night),
            },
            locked: A.locked,
            early: A.early !== null, // said ready during the count: binoculars shut, answer box open
            spent: A.spent, // their answer time ran out with no answer
            answerLeft: this.phase === 'answer' ? Math.max(0, this.answerT - this.phaseT) : this.phase === 'observe' && A.early !== null ? Math.max(0, this.answerT - (this.phaseT - A.early)) : null,
            entry: mine && !A.locked ? (A.typed !== null ? A.typed : A.draft) : null,
            pending: mine && A.pendT > 0,
            answer: shown && A.locked ? A.value : null,
            count: shown ? P.field.count : null,
            correct: last ? last.correct[i] : null,
            saved: last ? last.saved[i] : null,
            yours: last ? last.yours[i] : null,
            spotting: this.spotting(i),
          };
        }),
        result: last,
        final: this.final,
        buddy: this.buddy ? { kind: this.buddy.kind, phase: this.buddy.phase, left: Math.max(0, this.buddy.left), visit: this.buddy.visit, save: this.buddy.save, here: this.buddyHere(), treated: this.buddy.treated } : null,
        cheer: this.mode === '2p' ? { rest: this.cheerT, restMax: this.cheerRest(), ready: this.cheerT <= 0 && this.phase === 'observe' } : null,
      };
    }
  }

  // ---------------------------------------------------------------- unlocks (PROPOSAL: CONFIG.roster)

  // Saved as { wins, games, unlocked: [ids] }. A game counts as won when a person wins it: either brother in two
  // players, you against the computer. Draws and computer wins don't count.
  const progress = {
    KEY: 'spotTT.progress',
    blank: () => ({ wins: 0, games: 0, unlocked: [] }),
    load(store) {
      try {
        const v = JSON.parse(store.getItem(progress.KEY) || 'null');
        if (v && typeof v.wins === 'number' && Array.isArray(v.unlocked)) return { wins: v.wins | 0, games: v.games | 0, unlocked: v.unlocked.filter((x) => typeof x === 'string') };
      } catch (e) { /* storage blocked or broken */ }
      return progress.blank();
    },
    save(store, p) { try { store.setItem(progress.KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ } },
    owned(p, cfg) { return cfg.roster.start.concat(p.unlocked.filter((id) => !cfg.roster.start.includes(id))); },
    has(p, cfg, id) { return progress.owned(p, cfg).includes(id); },
    // the next character to unlock: { id, wins, left } or null when there's nothing left
    next(p, cfg) {
      const u = cfg.roster.unlocks.find((x) => !progress.has(p, cfg, x.id));
      return u ? { id: u.id, wins: u.wins, left: Math.max(0, u.wins - p.wins) } : null;
    },
    record(p, cfg, final, mode) {
      const humanWon = final.winner !== null && (mode === '2p' || (mode === 'cpu' && final.winner === 0));
      p.games++;
      if (humanWon) p.wins++;
      const newly = [];
      for (const u of cfg.roster.unlocks) if (p.wins >= u.wins && !progress.has(p, cfg, u.id)) { p.unlocked.push(u.id); newly.push(u.id); }
      return { humanWon, newly };
    },
  };

  SPOT.sim = { Match, PHASES, CHARS, TREATS, makeRng, randInt, dealRound, scoreRound, makeField, moveField, wanderTarget, lensRadius, toLens, inLens, lensCover, powerTimes, progress };
})();
