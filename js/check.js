/* Spot TT Animals: the rule checks, the soak and the sabotage cases. Runs in the browser console (game.check(),
   game.soak()) and in Node (node tools/check.js). No Three.js in here.

   - rules(): Teddy's rules and the prototype defaults, checked one by one (timing, scoring, zero rounds, powers,
     hidden answers, the computer player, unlocks, day and night).
   - soak(): many whole matches with movement, two players or against the computer, with random little bots, checking
     the invariants every tick.
   - sabotage(): broken setups that must fail, to prove the checks can fail at all. */
(function () {
  'use strict';
  const SPOT = (window.SPOT = window.SPOT || {});
  const DT = 1 / 60;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const base = () => ({ cfg: SPOT.CONFIG, deal: SPOT.sim.dealRound, patch: null, progress: SPOT.sim.progress });
  const mk = (env, o) => new SPOT.sim.Match(Object.assign({ cfg: env.cfg, still: true, seed: 1, patch: env.patch }, o));
  const near = (a, b, tol = DT * 1.5) => Math.abs(a - b) <= tol;
  const snap = (P) => P.field.animals.map((a) => `${a.x.toFixed(6)},${a.z.toFixed(6)}`).join(';');
  const wrongFor = (n) => (n >= 20 ? 19 : n + 1);
  function stepUntil(m, pred, maxSec = 400, dt = DT, each) {
    const end = m.t + maxSec;
    while (!pred(m) && m.t < end && m.phase !== 'final') { m.step(dt); if (each) each(m); }
    return pred(m);
  }
  function drain(m) { const ev = m.events.slice(); m.events.length = 0; return ev; }

  // ---------------------------------------------------------------- 1. Teddy's rules are still in the config

  function guard(env) {
    const R = SPOT.RULES, C = env.cfg, out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    ok('rule 2: five rounds per game', C.roundsPerGame === R.roundsPerGame && R.roundsPerGame === 5, `config ${C.roundsPerGame}`);
    ok('rule 3: observation is 60 / 30 / 15 s', ['easy', 'medium', 'hard'].every((d) => C.difficulty[d] === R.observeSeconds[d]) && R.observeSeconds.easy === 60 && R.observeSeconds.medium === 30 && R.observeSeconds.hard === 15, JSON.stringify(C.difficulty));
    ok('rule 4: three seconds to answer', C.answerTimeSeconds === R.answerSeconds && R.answerSeconds === 3, `config ${C.answerTimeSeconds}`);
    ok('rule 8: never more than 20 animals', C.animals.max <= R.maxAnimals && R.maxAnimals === 20 && C.animals.min >= 1, `min ${C.animals.min}, max ${C.animals.max}`);
    ok('rule 9: zero is possible but extremely rare (at most 5% of rounds)', C.animals.allowRareZero && C.animals.zeroProbability > 0 && C.animals.zeroProbability <= 0.05, `${C.animals.zeroProbability}`);
    ok('rule 13: Tommy Freeze has a cooldown', C.characters.tommy.cooldownSeconds > 0 && C.characters.tommy.freezeDurationSeconds > 0, `${C.characters.tommy.freezeDurationSeconds} s, cooldown ${C.characters.tommy.cooldownSeconds} s`);
    ok('rule 14: Teddy has bigger binoculars', C.characters.teddy.viewMultiplier > 1, `x${C.characters.teddy.viewMultiplier}`);
    ok('rule 1: one animal type per round, from the five', R.animalTypes.length === 5 && R.animalTypes.every((t) => C.movement[t]), R.animalTypes.join(' '));
    return out;
  }

  // ---------------------------------------------------------------- 2. timing: 60 / 30 / 15 s, then exactly 3 s

  function timing(env) {
    const out = [], R = SPOT.RULES;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    for (const d of ['easy', 'medium', 'hard']) {
      for (const mode of ['2p', 'cpu']) {
        const m = mk(env, { difficulty: d, mode, seed: 11 });
        let tGo = null, tAns = null, tRev = null;
        const counts = [], finals = [];
        stepUntil(m, (x) => x.phase === 'result', 200, DT, (x) => {
          for (const e of drain(x)) {
            if (e.type === 'go') tGo = e.t;
            if (e.type === 'answer') tAns = e.t;
            if (e.type === 'reveal') tRev = e.t;
            if (e.type === 'count') counts.push(e.n);
            if (e.type === 'final') finals.push([e.n, e.t]);
          }
        });
        const obs = tAns - tGo, ans = tRev - tAns;
        ok(`${d} ${mode}: observation lasts ${R.observeSeconds[d]} s`, tGo !== null && near(obs, R.observeSeconds[d]), `${obs.toFixed(3)} s`);
        ok(`${d} ${mode}: the answer window is 3 s when ${mode === 'cpu' ? 'you' : 'nobody'} answer${mode === 'cpu' ? '' : 's'}`, near(ans, R.answerSeconds), `${ans.toFixed(3)} s`);
        if (mode === '2p') {
          ok(`${d}: ROUND 1 OF 5, then 3, 2, 1, GO!`, counts.join() === '3,2,1' && tGo !== null, counts.join());
          ok(`${d}: 5 4 3 2 1 over the last five seconds`, finals.map((f) => f[0]).join() === '5,4,3,2,1' && finals.every(([n, t]) => near(tAns - t, n)), finals.map(([n, t]) => `${n}@${(tAns - t).toFixed(2)}`).join(' '));
        }
      }
    }
    // the window never stretches, and it ends early once both answers are in
    let m = mk(env, { mode: '2p', difficulty: 'hard', seed: 12 });
    stepUntil(m, (x) => x.phase === 'answer');
    const t0 = m.t;
    stepUntil(m, (x) => x.phaseT >= 1);
    m.pick(0, 5); m.pick(1, 6);
    m.step(DT);
    ok('answers in early: the window ends as soon as both are locked', m.phase === 'result' && m.t - t0 < 1.1, `${(m.t - t0).toFixed(2)} s`);
    m = mk(env, { mode: '2p', difficulty: 'hard', seed: 12 });
    stepUntil(m, (x) => x.phase === 'answer');
    const t1 = m.t;
    m.pick(0, 5);
    stepUntil(m, (x) => x.phase === 'result');
    ok('one answer in: the other still gets the whole 3 s, and not a tick more', near(m.t - t1, R.answerSeconds), `${(m.t - t1).toFixed(3)} s`);
    // the clock keeps running however much you press
    m = mk(env, { mode: '2p', difficulty: 'hard', seed: 13, chars: ['tommy', 'tommy'] });
    stepUntil(m, (x) => x.phase === 'observe');
    let ticks = 0;
    stepUntil(m, (x) => x.phase !== 'observe', 30, DT, (x) => { ticks++; x.usePower(0); x.usePower(1); x.adjust(0, 1); x.adjust(1, 1); });
    ok('powers and clicks never stop the observation clock', near(ticks * DT, R.observeSeconds.hard), `${(ticks * DT).toFixed(3)} s of ticks`);
    return out;
  }

  // ---------------------------------------------------------------- 3. answers: 0 to 20, typing, tapping, locking

  function answers(env) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    let m = mk(env, { mode: '2p', seed: 21 });
    stepUntil(m, (x) => x.phase === 'answer');
    ok('a tap must be a whole number from 0 to 20', !m.pick(0, 21) && !m.pick(0, -1) && !m.pick(0, 2.5) && !m.pick(0, NaN) && m.pick(0, 20));
    ok('a locked answer can not change', !m.pick(0, 3) && !m.adjust(0, 1) && !m.lock(0) && m.players[0].ans.value === 20);
    for (let k = 0; k < 30; k++) m.adjust(1, 1);
    const top = m.players[1].ans.draft;
    for (let k = 0; k < 40; k++) m.adjust(1, -1);
    ok('the clicker stops at 20 and at 0', top === 20 && m.players[1].ans.draft === 0);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    m.typeDigit(0, 7);
    ok('typing 7 locks 7 at once', m.players[0].ans.locked && m.players[0].ans.value === 7);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    m.typeDigit(0, 1); m.typeDigit(0, 7);
    ok('typing 1 then 7 locks 17', m.players[0].ans.value === 17 && m.players[0].ans.locked);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    m.typeDigit(0, 2); m.typeDigit(0, 0);
    ok('typing 2 then 0 locks 20', m.players[0].ans.value === 20);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    m.typeDigit(0, 2);
    stepUntil(m, (x) => x.players[0].ans.locked, 2);
    ok('typing just 2 locks 2 after a short wait for a second digit', m.players[0].ans.value === 2 && m.players[0].ans.at < 1.5, `locked at ${m.players[0].ans.at && m.players[0].ans.at.toFixed(2)} s`);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    stepUntil(m, (x) => x.phaseT >= 2.8);
    m.typeDigit(0, 1);
    stepUntil(m, (x) => x.phase === 'result', 2);
    ok('a 1 typed just before the buzzer still counts', m.results[0].answers[0] === 1);
    m = mk(env, { mode: 'cpu', seed: 22 });
    stepUntil(m, (x) => x.phase === 'answer');
    ok('locking an empty box does nothing (alone you type or tap a number)', !m.lock(0) && !m.players[0].ans.locked);
    return out;
  }

  // ---------------------------------------------------------------- 4. five rounds and the scoring

  // script: per round, what each player does: 'r' right, 'w' wrong, 'n' clicks to the right number but never locks
  function playScript(env, script, o = {}) {
    const m = mk(env, Object.assign({ mode: '2p', difficulty: 'hard', seed: 31 }, o));
    let rounds = 0, done = false;
    stepUntil(m, (x) => x.phase === 'final', 700, DT, (x) => {
      const s = script[x.round - 1];
      if (x.phase === 'observe' && x.phaseT > 1 && x.phaseT < 1 + DT * 1.5) {
        s.forEach((how, i) => { if (how === 'n') for (let k = 0; k < x.players[i].field.count; k++) x.adjust(i, 1); });
      }
      if (x.phase === 'answer' && !done && x.phaseT > 0.5) {
        done = true;
        s.forEach((how, i) => { const c = x.players[i].field.count; if (how === 'r') x.pick(i, c); else if (how === 'w') x.pick(i, wrongFor(c)); });
      }
      if (x.phase === 'result') { rounds++; done = false; x.next(); }
    });
    return { m, rounds };
  }

  function scoring(env) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const { m, rounds } = playScript(env, [['r', 'w'], ['r', 'r'], ['w', 'w'], ['w', 'r'], ['r', 'n']]);
    const r = m.results, f = m.final || { scores: [], winner: undefined };
    ok('a match is exactly five rounds, then the final score', rounds === 5 && m.phase === 'final' && r.length === 5, `${rounds} rounds, ${m.phase}`);
    if (r.length < 5) return out;
    ok('right beats wrong: that player wins the round', r[0].winner === 0 && r[3].winner === 1);
    ok('rule 18: both right is a draw', r[1].winner === null && r[1].why === 'bothRight');
    ok('both wrong is a draw (the prototype rule)', r[2].winner === null && r[2].why === 'bothWrong');
    ok('no answer in 3 s gets no credit, even if the clicker showed the right number', r[4].answers[1] === null && r[4].correct[1] === false && r[4].winner === 0);
    ok('a point for each round won, none for a draw: 2-1 wins the match', f.scores.join() === '2,1' && f.winner === 0, `scores ${f.scores.join('-')}`);
    const d = playScript(env, [['r', 'w'], ['w', 'r'], ['r', 'r'], ['w', 'w'], ['w', 'w']], { seed: 32 }).m;
    ok('equal points after five rounds: the match is a draw', d.final && d.final.scores.join() === '1,1' && d.final.winner === null, d.final ? d.final.scores.join('-') : 'no final');
    const sr = SPOT.sim.scoreRound;
    ok('closest-wins option: neither right, the closer answer wins', sr([10, 13], [11, 17], 'closest').winner === 0 && sr([10, 16], [11, 17], 'closest').why === 'bothWrong' && sr([null, 3], [5, 9], 'closest').winner === 1);
    ok('closest-wins option: both right is still a draw', sr([5, 9], [5, 9], 'closest').winner === null);
    return out;
  }

  // ---------------------------------------------------------------- 5. counts and zero rounds (dealt 200,000 times)

  function deals(env, n = 200000) {
    const out = [], R = SPOT.RULES, cfg = env.cfg, p = cfg.animals.zeroProbability;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const M = SPOT.sim;
    const rr = M.makeRng(101), ra = M.makeRng(202), rb = M.makeRng(303);
    let zero = 0, both = 0, out20 = 0, side = [0, 0], last = -1;
    const gaps = [], hist = new Array(21).fill(0), types = {};
    for (let k = 0; k < n; k++) {
      const d = env.deal(cfg, 'day', rr, ra, rb);
      types[d.type] = (types[d.type] || 0) + 1;
      d.counts.forEach((c) => { if (!Number.isInteger(c) || c < 0 || c > R.maxAnimals) out20++; else hist[c]++; });
      const zs = d.counts.filter((c) => c === 0).length;
      if (zs === 2) both++;
      if (zs >= 1) {
        zero++;
        side[d.counts[0] === 0 ? 0 : 1]++;
        if (last >= 0) gaps.push(k - last);
        last = k;
      }
    }
    const rate = zero / n;
    const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, gaps.length));
    ok('rule 8: every count is a whole number from 0 to 20', out20 === 0, `${out20} bad`);
    ok('rule 10: never both players at zero', both === 0, `${both} rounds`);
    ok(`rule 9: zero rounds are rare (about ${(p * 100).toFixed(1)}%)`, rate > p * 0.7 && rate < p * 1.3 && rate <= 0.05, `${(rate * 100).toFixed(2)}% of ${n}`);
    ok('rule 9: zero rounds are unpredictable (no schedule: the gaps vary like dice)', gaps.length > 20 && sd / mean > 0.6, `gap ${mean.toFixed(0)} rounds on average, spread ${(sd / mean).toFixed(2)}`);
    ok('either player can be the one with zero', side[0] > zero * 0.4 && side[1] > zero * 0.4, `${side[0]} / ${side[1]}`);
    const normal = hist.slice(1).reduce((a, b) => a + b, 0);
    ok('1 to 20 are all about equally likely', hist.slice(1).every((h) => h > normal / 20 * 0.85 && h < normal / 20 * 1.15), hist.slice(1).map((h) => (h / normal * 100).toFixed(1)).join(' '));
    ok('all five animal types come up', R.animalTypes.every((t) => types[t] > n / 5 * 0.9) && Object.keys(types).every((t) => R.animalTypes.includes(t)), JSON.stringify(types));
    return out;
  }

  // ---------------------------------------------------------------- 6. fields: one type, what you see is what's scored, no warning

  function fields(env) {
    const out = [], R = SPOT.RULES;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    let mixed = 0, mismatch = 0, range = 0, bothZero = 0, shared = 0, n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = mk(env, { seed, mode: seed % 2 ? '2p' : 'cpu', sky: 'mix' });
      for (let r = 0; r < 5; r++) {
        if (r) m.startRound();
        n++;
        const type = m.roundInfo.type;
        for (const P of m.players) {
          const f = P.field;
          if (f.type !== type || f.animals.some((a) => a.type !== type)) mixed++;
          if (f.animals.length !== f.count) mismatch++;
          if (!(f.count >= 0 && f.count <= R.maxAnimals)) range++;
        }
        if (m.players.every((P) => P.field.count === 0)) bothZero++;
        if (m.players[0].field.type !== m.players[1].field.type) shared++;
      }
    }
    ok('rule 1: every animal in a round is the same type, in both fields', mixed === 0 && shared === 0, `${mixed} mixed fields in ${n} rounds`);
    ok('the field shows exactly as many animals as the count that is scored', mismatch === 0, `${mismatch} fields differ`);
    ok('rule 8 and 10 in real rounds: 0 to 20, never both zero', range === 0 && bothZero === 0);
    // no warning: with zero forced on, the round looks exactly like any other until the reveal
    const zc = clone(env.cfg);
    zc.animals.zeroProbability = 1;
    const z = mk(Object.assign({}, env, { cfg: zc }), { seed: 5, mode: '2p' }), a = mk(env, { seed: 5, mode: '2p' });
    const keys = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((s, x) => ((s[x] = v[x]), s), {}) : v)).replace(/:[^,{}[\]]+/g, ':');
    const ez = drain(z).filter((e) => e.type === 'round'), ea = drain(a).filter((e) => e.type === 'round');
    stepUntil(z, (x) => x.phase === 'observe'); stepUntil(a, (x) => x.phase === 'observe');
    const vz = z.view(), va = a.view();
    ok('rule 9: no warning: a zero round starts with the same messages and screen as any other',
      z.players.some((P) => P.field.count === 0) && keys(ez) === keys(ea) && keys(vz) === keys(va) && vz.players.every((p) => p.count === null) && !/zero/i.test(JSON.stringify(vz) + JSON.stringify(ez)));
    return out;
  }

  // ---------------------------------------------------------------- 7. Tommy Freeze: own field only, and a cooldown

  function freeze(env) {
    const out = [], C = env.cfg.characters.tommy;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const o = { mode: '2p', chars: ['tommy', 'tommy'], seed: 41, still: false, difficulty: 'medium' };
    const A = mk(env, o), B = mk(env, o);
    stepUntil(A, (x) => x.phase === 'observe' && x.phaseT >= 2); stepUntil(B, (x) => x.phase === 'observe' && x.phaseT >= 2);
    const used = A.usePower(0);
    let stillOwn = true, otherSame = true, otherMoved = false, frozenView = true, otherFrozenView = false, dur = 0;
    let prev = snap(A.players[0]);
    const p1 = snap(B.players[0]);
    while (A.players[0].power.activeT > 0 && dur < 20) {
      A.step(DT); B.step(DT); dur += DT;
      if (A.players[0].power.activeT > 0 && snap(A.players[0]) !== prev) stillOwn = false;
      prev = snap(A.players[0]);
      if (snap(A.players[1]) !== snap(B.players[1])) otherSame = false;
      if (snap(B.players[0]) !== p1) otherMoved = true;
      const v = A.view();
      if (A.players[0].power.activeT > 0 && !v.players[0].frozen) frozenView = false;
      if (v.players[1].frozen) otherFrozenView = true;
    }
    ok('Freeze works for Tommy during observation', used === 'ok', used);
    ok(`Freeze lasts ${C.freezeDurationSeconds} s (proposal)`, near(dur, C.freezeDurationSeconds), `${dur.toFixed(3)} s`);
    ok('while frozen, nothing in Tommy\'s own field moves', stillOwn && otherMoved, otherMoved ? '' : 'the animals never moved anyway');
    ok('the other field keeps moving exactly as if nobody had frozen anything', otherSame && !otherFrozenView && frozenView);
    const cool1 = A.usePower(0);
    let coolTicks = 0;
    while (A.players[0].power.coolT > 0 && coolTicks < 3000) { A.step(DT); B.step(DT); coolTicks++; }
    const coolDur = coolTicks * DT;
    const cool2 = A.usePower(0);
    ok(`rule 13: then a cooldown (${C.cooldownSeconds} s, proposal), and it works again after`, cool1 === 'cooling' && near(coolDur, C.cooldownSeconds) && cool2 === 'ok', `${cool1}, ${coolDur.toFixed(2)} s, then ${cool2}`);
    // A froze twice, B never did: stepped tick for tick, both must reach the answer window on the same tick
    let lock = 0;
    while (B.phase === 'observe' && lock++ < 4000) { A.step(DT); B.step(DT); }
    ok('the observation clock keeps running while frozen', A.phase === 'answer' && B.phase === 'answer', `frozen field: ${A.phase}, other: ${B.phase}`);
    ok('after the freeze, Tommy\'s animals move again', (() => { const m = mk(env, o); stepUntil(m, (x) => x.phase === 'observe' && x.phaseT >= 1); m.usePower(0); stepUntil(m, (x) => x.players[0].power.activeT <= 0, 10); const s = snap(m.players[0]); stepUntil(m, (x) => snap(x.players[0]) !== s, 3); return snap(m.players[0]) !== s; })());
    return out;
  }

  // ---------------------------------------------------------------- 8. Teddy's wide view

  function wide(env) {
    const out = [], cfg = env.cfg, M = SPOT.sim;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const r = cfg.lens.radius, k = cfg.characters.teddy.viewMultiplier;
    for (const chars of [['teddy', 'tommy'], ['tommy', 'teddy'], ['pilot', 'teddy']]) {
      const m = mk(env, { chars });
      const v = m.view();
      const want = chars.map((c) => (c === 'teddy' ? r * k : r));
      ok(`${chars.join(' vs ')}: only Teddy's binoculars are bigger`, chars.every((c, i) => Math.abs(m.lensFor(i) - want[i]) < 1e-9 && Math.abs(v.players[i].lens - want[i]) < 1e-9), chars.map((c, i) => m.lensFor(i).toFixed(2)).join(' / '));
    }
    const cn = M.lensCover(cfg, r), cw = M.lensCover(cfg, r * k);
    ok('Teddy sees more of his field at once, but the field is the same size', cw > cn + 0.15 && cn < 0.9, `${(cn * 100).toFixed(0)}% vs ${(cw * 100).toFixed(0)}% of the field`);
    // and in real rounds he sees more of his animals at a time
    const seen = [0, 0], tot = [0, 0];
    for (let seed = 1; seed <= 12; seed++) {
      const m = mk(env, { chars: ['teddy', 'tommy'], seed, still: false, difficulty: 'hard', mode: '2p', tweakCounts: (c) => [c[0] || 10, c[0] || 10] });
      let tick = 0;
      stepUntil(m, (x) => x.phase === 'answer', 60, DT, (x) => {
        if (x.phase !== 'observe' || tick++ % 30) return;
        for (let i = 0; i < 2; i++) { seen[i] += x.visibleCount(i); tot[i] += x.players[i].field.count; }
      });
    }
    const f0 = seen[0] / tot[0], f1 = seen[1] / tot[1];
    ok('in real rounds Teddy sees more of his animals at a time', f0 > f1 + 0.08, `Teddy ${(f0 * 100).toFixed(0)}%, Tommy ${(f1 * 100).toFixed(0)}% on average`);
    return out;
  }

  // ---------------------------------------------------------------- 9. the helicopter: night only, own field only

  function heli(env) {
    const out = [], C = env.cfg.characters.pilot;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    let m = mk(env, { sky: 'night', chars: ['pilot', 'pilot'], seed: 51 });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT >= 1);
    const used = m.usePower(0);
    const v = m.view();
    ok('at night the helicopter comes when called', used === 'ok' && m.players[0].lit && v.players[0].lit, used);
    ok('rule 15: it lights only its own player\'s binoculars', !m.players[1].lit && !v.players[1].lit);
    let dur = 0, otherLit = false;
    while (m.players[0].power.activeT > 0 && dur < 20) { m.step(DT); dur += DT; if (m.players[1].lit) otherLit = true; }
    ok(`it shines for ${C.durationSeconds} s (proposal), then rests ${C.cooldownSeconds} s`, near(dur, C.durationSeconds) && !m.players[0].lit && !otherLit && m.usePower(0) === 'cooling' && near(m.players[0].power.coolT, C.cooldownSeconds, 0.05), `${dur.toFixed(3)} s`);
    m = mk(env, { sky: 'day', chars: ['pilot', 'tommy'], seed: 52 });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT >= 1);
    const day = m.usePower(0);
    const dv = m.view();
    ok('in the daytime the helicopter does not come, and costs nothing', day === 'day' && !m.players[0].lit && m.players[0].power.coolT === 0 && m.players[0].power.uses === 0 && dv.players[0].power.dayOnly && !dv.players[0].power.ready, day);
    const tom = m.usePower(1);
    ok('Tommy\'s freeze is not a light: his field stays unlit', tom === 'ok' && !m.players[1].lit && !m.players[0].lit);
    m = mk(env, { sky: 'mix', chars: ['pilot', 'pilot'], seed: 53 });
    let nights = 0, days = 0, wrong = 0;
    for (let r = 0; r < 40; r++) {
      if (r) m.startRound();
      m.phase = 'observe'; m.phaseT = 1;
      const res = m.usePower(0);
      if (m.roundInfo.sky === 'night') { nights++; if (res !== 'ok') wrong++; } else { days++; if (res !== 'day') wrong++; }
      m.players[0].power.activeT = 0; m.applyPower(m.players[0], false);
    }
    ok('on mixed games it works on the night rounds only', wrong === 0 && nights > 5 && days > 5, `${nights} nights, ${days} days`);
    return out;
  }

  // ---------------------------------------------------------------- 10. answers stay hidden until both are locked

  function hidden(env) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    let m = mk(env, { mode: '2p', seed: 61 });
    stepUntil(m, (x) => x.phase === 'observe');
    drain(m);
    m.adjust(1, 1); m.adjust(1, 1); m.adjust(1, 1);
    stepUntil(m, (x) => x.phase === 'answer');
    m.pick(0, 7);
    const v = m.view();
    const evs = drain(m);
    const leak = evs.filter((e) => 'value' in e || 'answers' in e || 'draft' in e || 'n' in e && e.type !== 'final' && e.type !== 'count');
    ok('two players: a locked answer shows only as LOCKED until both are in', v.players[0].locked && v.players[0].answer === null && v.players[0].entry === null && v.result === null);
    ok('two players: the hidden clicker never shows its number', v.players[1].entry === null && v.players[1].answer === null);
    ok('no message before the reveal carries an answer', leak.length === 0 && evs.some((e) => e.type === 'lock'), leak.map((e) => e.type).join(' '));
    ok('no count shows before the reveal', v.players.every((p) => p.count === null && p.correct === null));
    m.pick(1, 3);
    m.step(DT);
    const w = m.view();
    ok('once both are locked, both answers and counts are revealed', w.phase === 'result' && w.players[0].answer === 7 && w.players[1].answer === 3 && w.players.every((p) => p.count !== null));
    m = mk(env, { mode: 'cpu', seed: 62 });
    stepUntil(m, (x) => x.phase === 'answer');
    m.typeDigit(0, 1);
    const own = m.view().players[0].entry;
    m.backspace(0);
    stepUntil(m, (x) => x.players[1].ans.locked, 3);
    const c = m.view();
    ok('VS Computer: you can see your own box (nobody else is there to read it)', own === 1);
    ok('VS Computer: the computer\'s answer stays hidden until yours is in', m.players[1].ans.locked && c.players[1].locked && c.players[1].answer === null && c.players[1].entry === null && c.phase === 'answer');
    return out;
  }

  // ---------------------------------------------------------------- 11. the computer player

  function cpu(env) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    // it never reads your count: change only your field and its answers must not change at all
    const play = (o) => {
      const m = mk(env, Object.assign({ mode: 'cpu', difficulty: 'hard' }, o));
      const ans = [], at = [], uses = [];
      stepUntil(m, (x) => x.phase === 'final', 600, 0.05, (x) => {
        if (x.phase === 'answer' && !x.players[0].ans.locked && x.phaseT > 0.3) x.pick(0, x.players[0].field.count);
        if (x.phase === 'observe' && x.phaseT > 2 && x.phaseT < 2.06) x.usePower(0);
        if (x.phase === 'result') { ans.push(x.results[x.results.length - 1].answers[1]); at.push(String(x.players[1].ans.at)); uses.push(x.players[1].power.uses); x.next(); }
      });
      return { ans: ans.join(), at: at.join(), uses: uses.join(), mine: m.results.map((r) => r.counts[0]).join() };
    };
    let same = true, changed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const chars = [['teddy', 'tommy'], ['tommy', 'pilot'], ['pilot', 'teddy']][seed % 3];
      const a = play({ seed, chars, sky: seed % 2 ? 'night' : 'day' });
      const b = play({ seed, chars, sky: seed % 2 ? 'night' : 'day', tweakCounts: (c) => [(c[0] + 7) % 21, c[1]] });
      if (a.mine !== b.mine) changed++;
      if (a.ans !== b.ans || a.at !== b.at || a.uses !== b.uses) same = false;
    }
    ok('it never reads your count: changing only your field never changes its answers', same && changed === 40, `${changed} matches with your counts changed`);
    const m = mk(env, { mode: 'cpu' });
    const view = m.cpuView(1);
    ok('all it is given is its own field\'s count, its character, the difficulty and the sky', Object.keys(view).sort().join() === 'char,count,difficulty,powerKind,sky,usedPower' && view.count === m.players[1].field.count);
    // accuracy: with the nudges off, it matches the difficulty's number
    const flat = clone(env.cfg);
    for (const k in flat.cpu.mods) flat.cpu.mods[k] = 0;
    const measure = (cfg, difficulty, chars, sky, n) => {
      let right = 0, rounds = 0, bad = 0;
      for (let seed = 1; seed <= n; seed++) {
        const x = mk(Object.assign({}, env, { cfg }), { mode: 'cpu', difficulty, chars, sky, seed: seed * 7 + 3 });
        stepUntil(x, (y) => y.phase === 'final', 1000, 0.1, (y) => {
          if (y.phase !== 'result') return;
          const r = y.results[y.results.length - 1], A = y.players[1].ans;
          rounds++;
          if (r.correct[1]) right++;
          if (!A.locked || A.at > 3 || !(r.answers[1] >= 0 && r.answers[1] <= 20)) bad++;
          y.next();
        });
      }
      return { rate: right / Math.max(1, rounds), rounds, bad };
    };
    const acc = env.cfg.cpu.accuracy;
    let allBad = 0;
    for (const d of ['easy', 'medium', 'hard']) {
      const res = measure(flat, d, ['teddy', 'tommy'], 'day', 300);
      allBad += res.bad;
      ok(`${d}: right about ${Math.round(acc[d] * 100)}% of the time (proposal)`, Math.abs(res.rate - acc[d]) < 0.045, `${(res.rate * 100).toFixed(1)}% of ${res.rounds} rounds`);
    }
    ok('it always answers inside the 3 s, with a number from 0 to 20', allBad === 0, `${allBad} bad`);
    const nudged = measure(env.cfg, 'medium', ['tommy', 'teddy'], 'day', 200);
    ok('with its own power nudges on, it stays close to its difficulty', Math.abs(nudged.rate - (acc.medium + env.cfg.cpu.mods.wideView)) < 0.06, `CPU Teddy on medium: ${(nudged.rate * 100).toFixed(1)}%`);
    // it uses its powers like a player: freeze, the helicopter at night, never the helicopter in the day
    const powers = (chars, sky) => {
      let rounds = 0, used = 0, refused = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const x = mk(env, { mode: 'cpu', difficulty: 'medium', chars, sky, seed });
        stepUntil(x, (y) => y.phase === 'final', 1000, 0.05, (y) => {
          for (const e of drain(y)) if (e.type === 'refuse' && e.i === 1) refused++;
          if (y.phase === 'result') { rounds++; if (y.players[1].power.usesRound > 0) used++; y.next(); }
        });
      }
      return { rate: used / rounds, refused };
    };
    const fz = powers(['teddy', 'tommy'], 'day'), sn = powers(['teddy', 'pilot'], 'night'), sd = powers(['teddy', 'pilot'], 'day');
    ok('CPU Tommy freezes his animals, CPU pilot calls the helicopter at night', fz.rate > 0.9 && sn.rate > 0.9, `freeze in ${(fz.rate * 100).toFixed(0)}% of rounds, spotlight in ${(sn.rate * 100).toFixed(0)}%`);
    ok('CPU pilot never tries the helicopter in the daytime', sd.rate === 0 && sd.refused === 0);
    return out;
  }

  // ---------------------------------------------------------------- 12. unlocks (proposal: 2 wins unlock the pilot)

  function unlocks(env) {
    const out = [], cfg = env.cfg, P = env.progress;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const mem = {};
    const store = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    const p = P.load(store);
    ok('you start with Teddy and Tommy; the pilot is locked', P.has(p, cfg, 'teddy') && P.has(p, cfg, 'tommy') && !P.has(p, cfg, 'pilot') && P.next(p, cfg).left === 2);
    const a = P.record(p, cfg, { winner: 1 }, 'cpu');
    const b = P.record(p, cfg, { winner: null }, '2p');
    ok('a computer win or a draw does not count', !a.humanWon && !b.humanWon && p.wins === 0 && p.games === 2);
    const c = P.record(p, cfg, { winner: 0 }, 'cpu');
    ok('rule 19: winning a game counts towards an unlock', c.humanWon && p.wins === 1 && c.newly.length === 0 && P.next(p, cfg).left === 1);
    const d = P.record(p, cfg, { winner: 1 }, '2p');
    ok('the second win unlocks the helicopter pilot (and says so once)', d.newly.join() === 'pilot' && P.has(p, cfg, 'pilot') && P.record(p, cfg, { winner: 0 }, '2p').newly.length === 0);
    P.save(store, p);
    const back = P.load(store);
    ok('progress is saved and loaded again', back.wins === 3 && P.has(back, cfg, 'pilot') && P.next(back, cfg) === null);
    mem[P.KEY] = '{broken';
    ok('broken saved data starts fresh instead of crashing', P.load(store).wins === 0);
    return out;
  }

  // ---------------------------------------------------------------- 13. day and night

  function skies(env) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const seen = (sky) => { const m = mk(env, { sky, seed: 71 }); const s = {}; for (let r = 0; r < 60; r++) { if (r) m.startRound(); s[m.roundInfo.sky] = (s[m.roundInfo.sky] || 0) + 1; } return s; };
    const d = seen('day'), n = seen('night'), x = seen('mix');
    ok('rule 16: day games are all day, night games all night', d.day === 60 && n.night === 60);
    ok('mixed games have both (proposal)', x.day > 10 && x.night > 10, JSON.stringify(x));
    return out;
  }

  // ---------------------------------------------------------------- 14. your brother (Alan's series feature)

  function buddy(env) {
    const out = [], C = env.cfg.companion, R = SPOT.RULES;
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const toAnswer = (m) => stepUntil(m, (x) => x.phase === 'answer');
    // who comes
    const who = ['teddy', 'tommy', 'pilot'].map((c) => { const m = mk(env, { mode: 'cpu', chars: [c, 'teddy'] }); m.callBuddy(); return m.buddy && m.buddy.kind; });
    ok('VS Computer: T brings the other brother (Tommy for Teddy, Teddy for Tommy, Tommy for the pilot)', who.join() === 'tommy,teddy,tommy', who.join());
    // hello, treat, visit, goodbye
    let m = mk(env, { mode: 'cpu', seed: 81, difficulty: 'easy' });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT > 1);
    drain(m);
    m.callBuddy();
    const ev1 = [];
    stepUntil(m, (x) => !x.buddy, 30, DT, (x) => { for (const e of drain(x)) ev1.push([e.type, x.buddy ? x.buddy.t : 99]); });
    const types = ev1.map((e) => e[0]);
    const byeAt = (ev1.find((e) => e[0] === 'buddyBye') || [0, 0])[1];
    ok('he says hi, tosses a treat that lands, stays his visit, then says bye and goes', ['buddyHello', 'treat', 'treatGot', 'buddyBye', 'buddyOut'].every((t) => types.includes(t)) && types.indexOf('treat') < types.indexOf('treatGot') && near(byeAt, C.visitSeconds, 0.05), `${types.filter((t) => /buddy|treat/.test(t)).join(' ')}; bye after ${byeAt.toFixed(2)} s`);
    // call again: hello, treat and the whole visit again, never two
    m = mk(env, { mode: 'cpu', seed: 82, difficulty: 'easy' });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT > 1);
    m.callBuddy();
    stepUntil(m, (x) => x.buddy && x.buddy.treated, 5);
    stepUntil(m, (x) => x.buddy.left < 4, 10);
    m.buddy.save = false;
    drain(m);
    const again = m.callBuddy();
    const ev2 = []; stepUntil(m, (x) => x.buddy.treated, 5, DT, (x) => { for (const e of drain(x)) ev2.push(e.type); });
    ok('calling again (no cooldown): another hello and treat, the whole visit again, the save re-armed', again === 'again' && ev2.includes('buddyHello') && ev2.includes('treatGot') && m.buddy.left > C.visitSeconds - 3 && m.buddy.save);
    m.callBuddy(); m.callBuddy(); m.callBuddy();
    ok('quick calls never bring two brothers', !!m.buddy && m.stats.calls >= 5);
    // spotting: your own hiding animals, never the computer's
    m = mk(env, { mode: 'cpu', seed: 83, difficulty: 'medium', chars: ['tommy', 'tommy'], tweakCounts: () => [20, 20] });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT > 1);
    const before = m.spotted(0).length;
    m.callBuddy();
    m.step(DT);
    const sp = m.spotted(0), hidden = 20 - m.visibleCount(0), v = m.view();
    ok('while he\'s there he spots your hiding animals (only yours: never the computer\'s)', before === 0 && sp.length === hidden && hidden > 0 && sp.every((a) => m.players[0].field.animals.includes(a)) && !m.spotting(1) && m.spotted(1).length === 0 && v.players[0].spotting && !v.players[1].spotting, `${sp.length} hiding, computer spotted ${m.spotted(1).length}`);
    // the save
    const saveRound = (how, call = true) => {
      const x = mk(env, { mode: 'cpu', seed: 84, difficulty: 'hard' });
      stepUntil(x, (y) => y.phase === 'observe' && y.observeT - y.phaseT < 4);
      if (call) x.callBuddy();
      toAnswer(x);
      const c = x.players[0].field.count;
      if (how === 'wrong') { stepUntil(x, (y) => y.phaseT > 0.4); x.pick(0, wrongFor(c)); }
      if (how === 'right') { stepUntil(x, (y) => y.phaseT > 0.4); x.pick(0, c); }
      const evs = [];
      stepUntil(x, (y) => y.phase === 'result', 4, DT, (y) => { for (const e of drain(y)) evs.push(e); });
      return { x, r: x.results[0], c, evs, at: x.players[0].ans.at };
    };
    let t = saveRound('wrong');
    ok('he has your back: a wrong answer while he\'s there becomes right ("TOMMY SAVED YOU!")', t.r.correct[0] && t.r.saved[0] && t.r.yours[0] === wrongFor(t.c) && t.r.answers[0] === t.c && t.evs.some((e) => e.type === 'buddySave' && !('value' in e)));
    t = saveRound('none');
    ok('no answer with a moment left: he shouts the number for you, inside the 3 s', t.r.correct[0] && t.r.saved[0] && t.r.yours[0] === null && t.at <= R.answerSeconds - C.shoutBefore + 0.05 && t.at >= R.answerSeconds - C.shoutBefore - 0.05, `locked at ${t.at && t.at.toFixed(2)} s`);
    t = saveRound('right');
    ok('a right answer needs no save (and keeps his save)', t.r.correct[0] && !t.r.saved[0] && t.x.buddy && t.x.buddy.save);
    t = saveRound('wrong', false);
    const t2 = saveRound('none', false);
    ok('without him there\'s no save: wrong stays wrong, no answer stays no answer', !t.r.correct[0] && !t.r.saved[0] && t2.r.answers[0] === null && !t2.r.saved[0]);
    // once per visit, and not after he's gone
    m = mk(env, { mode: 'cpu', seed: 85, difficulty: 'hard' });
    stepUntil(m, (x) => x.phase === 'answer');
    m.callBuddy();
    stepUntil(m, (x) => x.phaseT > 0.3);
    m.pick(0, wrongFor(m.players[0].field.count));
    m.buddySave(0, 'fix');
    const used = m.buddy.save;
    ok('one save per visit (the 🛡️ is used up)', used === false && m.view().buddy.save === false);
    m = mk(env, { mode: 'cpu', seed: 86, difficulty: 'easy' });
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT > 1);
    m.callBuddy();
    toAnswer(m);
    stepUntil(m, (x) => x.phaseT > 0.4);
    m.pick(0, wrongFor(m.players[0].field.count));
    stepUntil(m, (x) => x.phase === 'result', 4);
    ok('called at the start of a long round, he\'s gone by the answer, so no save', !m.buddy && !m.results[0].saved[0] && !m.results[0].correct[0]);
    // two players: the high five
    m = mk(env, { mode: '2p', seed: 87, difficulty: 'medium', tweakCounts: () => [20, 20] });
    ok('two players: no visiting brother, T is a high five (and only while counting)', m.callBuddy() === 'phase' && !m.buddy);
    stepUntil(m, (x) => x.phase === 'observe' && x.phaseT > 1);
    drain(m);
    const hf = m.callBuddy();
    const hev = drain(m);
    const both = [0, 1].map((i) => m.spotting(i) && m.spotted(i).length === 20 - m.visibleCount(i) && m.spotted(i).every((a) => m.players[i].field.animals.includes(a)));
    ok('HIGH FIVE: both players spot their own hiding animals, a treat each', hf === 'ok' && both.every(Boolean) && hev.some((e) => e.type === 'highFive' && e.treats.length === 2));
    ok(`then it rests ${C.highFiveRest.medium} s (${C.highFiveRest.easy} s on easy), and says no meanwhile`, m.callBuddy() === 'rest' && near(m.cheerT, C.highFiveRest.medium, 0.02) && near(mk(env, { mode: '2p', difficulty: 'easy' }).cheerRest(), C.highFiveRest.easy, 0.001));
    let spotTicks = 0;
    stepUntil(m, (x) => !x.spotting(0), 20, DT, () => spotTicks++);
    ok(`the spotting lasts ${C.highFiveSpotSeconds} s for both`, near(spotTicks * DT, C.highFiveSpotSeconds) && !m.spotting(1), `${(spotTicks * DT).toFixed(2)} s`);
    stepUntil(m, (x) => x.cheerT <= 0, 30);
    ok('after its rest the high five works again', m.phase !== 'observe' || m.callBuddy() === 'ok');
    // the computer never notices
    const play = (calls) => {
      const x = mk(env, { mode: 'cpu', difficulty: 'hard', seed: 88, chars: ['teddy', 'tommy'] });
      const ans = [];
      stepUntil(x, (y) => y.phase === 'final', 600, 0.05, (y) => {
        if (calls && y.phase === 'observe' && Math.random() < 0.02) y.callBuddy();
        if (y.phase === 'result') { ans.push(`${y.results[y.results.length - 1].answers[1]}@${y.players[1].ans.at}`); y.next(); }
      });
      return ans.join();
    };
    ok('calling your brother never changes what the computer answers', play(false) === play(true));
    return out;
  }

  const CHECKS = { guard, timing, answers, scoring, deals, fields, freeze, wide, heli, hidden, cpu, unlocks, skies, buddy };
  // a check that crashes counts as failed, never as passed
  function runCheck(k, env) {
    try { return CHECKS[k](env); } catch (e) { return [{ name: `${k} crashed: ${e && e.message}`, ok: false, info: String(e && e.stack || e).split('\n')[1] || '' }]; }
  }

  function rules(only) {
    const env = base(), out = [];
    for (const k of Object.keys(CHECKS)) {
      if (only && !only.includes(k)) continue;
      for (const r of runCheck(k, env)) out.push(Object.assign({ group: k }, r));
    }
    return out;
  }

  // ---------------------------------------------------------------- soak: whole matches with little random bots

  function soak(o = {}) {
    const M = SPOT.sim, R = SPOT.RULES, cfg = o.cfg || SPOT.CONFIG;
    const n = o.matches || 60;
    const probs = [];
    const st = { matches: 0, rounds: 0, zero: 0, unanswered: 0, humanRounds: 0, cpu: {}, seen: {}, minGap: 9, ms: 0, ticks: 0, calls: 0, saves: 0 };
    const t0 = Date.now();
    const NEXT = { ready: ['observe'], observe: ['answer'], answer: ['result'], result: ['ready', 'final'] };
    const chars = ['teddy', 'tommy', 'pilot'];
    for (let k = 0; k < n; k++) {
      const rng = M.makeRng(9000 + k);
      const pick = (a) => a[Math.floor(rng() * a.length)];
      const mode = o.mode || (k % 2 ? 'cpu' : '2p');
      const m = new M.Match({ cfg, mode, difficulty: o.difficulty || pick(['easy', 'medium', 'hard']), sky: o.sky || pick(['day', 'night', 'mix']), chars: [pick(chars), pick(chars)], seed: 500 + k * 13 });
      const plan = [null, null];
      let last = m.phase, tick = 0, waitNext = 0, safety = 0;
      const fail = (msg) => { if (probs.length < 30) probs.push(`match ${k} (${m.mode} ${m.difficulty} ${m.skyMode} ${m.players.map((P) => P.char).join('/')}) round ${m.round}: ${msg}`); };
      while (m.phase !== 'final' && safety++ < 200000) {
        for (const P of m.players) {
          if (!P.human) continue;
          const i = P.i;
          if (m.phase === 'observe' || m.phase === 'answer') if (rng() < 0.003 && i === 0) { m.callBuddy(); st.calls++; }
          if (m.phase === 'observe') {
            if (rng() < 0.004) m.usePower(i);
            if (m.mode === '2p' && rng() < 0.01) m.adjust(i, rng() < 0.85 ? 1 : -1);
          } else if (m.phase === 'answer' && !P.ans.locked) {
            if (!plan[i]) plan[i] = { at: rng() * 3.6, how: pick(['pick', 'type', 'click']) };
            if (m.phaseT >= plan[i].at) {
              const c = P.field.count, v = rng() < 0.75 ? c : Math.max(0, Math.min(20, c + Math.round((rng() - 0.5) * 6)));
              if (plan[i].how === 'pick') m.pick(i, v);
              else if (plan[i].how === 'type' && m.mode === 'cpu') { if (v >= 10) m.typeDigit(i, Math.floor(v / 10)); m.typeDigit(i, v % 10); if (v < 3 && v > 0) m.lock(i); }
              else { for (let g = 0; g < 25 && (P.ans.draft || 0) < v; g++) m.adjust(i, 1); for (let g = 0; g < 25 && (P.ans.draft || 0) > v; g++) m.adjust(i, -1); m.lock(i); }
              plan[i].at = 99;
            }
          }
        }
        if (m.phase === 'result') { if (!waitNext) waitNext = m.t + 0.5; if (m.t >= waitNext) { waitNext = 0; plan[0] = plan[1] = null; m.next(); } }
        if (m.phase === 'final') break;
        m.step(DT);
        tick++;
        st.ticks++;
        if (m.phase !== last) {
          if (!(NEXT[last] || []).includes(m.phase)) fail(`went from ${last} to ${m.phase}`);
          if (m.phase === 'result') {
            const r = m.results[m.results.length - 1];
            st.rounds++;
            if (r.counts.includes(0)) st.zero++;
            m.players.forEach((P, i) => {
              if (P.human) { st.humanRounds++; if (r.answers[i] === null) st.unanswered++; }
              else {
                const c = st.cpu[m.difficulty] || (st.cpu[m.difficulty] = { right: 0, n: 0 });
                c.n++; if (r.correct[i]) c.right++;
                if (r.answers[i] === null || P.ans.at > R.answerSeconds) fail('the computer did not answer in time');
              }
            });
            if (r.answers.some((a) => a !== null && !(a >= 0 && a <= 20))) fail(`answer out of range ${r.answers}`);
            r.saved.forEach((sv, i) => { if (sv) { st.saves++; if (!r.correct[i] || i !== 0 || m.mode !== 'cpu') fail(`a save that wasn't right, or for the wrong player (${i}, ${m.mode})`); } });
          }
          last = m.phase;
        }
        if (m.round < 1 || m.round > R.roundsPerGame) fail(`round ${m.round}`);
        const type = m.roundInfo.type;
        if (m.players.every((P) => P.field.count === 0)) fail('both fields empty');
        if (m.buddy && m.mode !== 'cpu') fail('a visiting brother in two-player mode');
        if (m.mode === 'cpu' && m.spotting(1)) fail('the computer got spotting help');
        if (m.phase !== 'observe' && (m.spotting(0) || m.spotting(1))) fail(`spotting outside the observation (${m.phase})`);
        for (const P of m.players) {
          const f = P.field, mv = cfg.movement[f.type];
          if (f.type !== type || f.animals.length !== f.count || f.count < 0 || f.count > R.maxAnimals) fail(`field ${P.i}: ${f.type} x${f.animals.length} for ${f.count}`);
          if (f.frozen !== (P.power.kind === 'freeze' && P.power.activeT > 0)) fail(`field ${P.i} frozen=${f.frozen} without its own freeze`);
          if (P.lit && !(P.power.kind === 'spotlight' && P.power.activeT > 0 && m.roundInfo.sky === 'night')) fail(`player ${P.i} lit without their own helicopter at night`);
          for (let a = 0; a < f.animals.length; a++) {
            const A = f.animals[a];
            if (!Number.isFinite(A.x) || !Number.isFinite(A.z) || Math.abs(A.x) > cfg.field.width / 2 || Math.abs(A.z) > cfg.field.depth / 2) { fail(`animal outside the field ${A.x},${A.z}`); break; }
            if (tick % 6 === 0) for (let b = a + 1; b < f.animals.length; b++) { const B = f.animals[b]; st.minGap = Math.min(st.minGap, Math.hypot(A.x - B.x, A.z - B.z) / (mv.r * 2)); }
          }
        }
        if (tick % 15 === 0 && m.phase !== 'result') {
          const v = m.view();
          if (v.players.some((p) => p.answer !== null || p.count !== null) || v.result) fail(`the screen showed an answer or count during ${m.phase}`);
          if (m.mode === '2p' && v.players.some((p) => p.entry !== null)) fail('a two-player box showed its number');
          if (m.phase === 'observe' && tick % 30 === 0) m.players.forEach((P, i) => { if (P.field.count) { const s = st.seen[P.char] || (st.seen[P.char] = { v: 0, n: 0 }); s.v += m.visibleCount(i); s.n += P.field.count; } });
        }
        m.events.length = 0;
      }
      if (m.phase !== 'final') fail('the match never finished');
      else {
        st.matches++;
        const f = m.final, wins = m.results.filter((r) => r.winner !== null).length;
        if (m.results.length !== R.roundsPerGame) fail(`${m.results.length} rounds`);
        if (f.scores[0] + f.scores[1] !== wins * cfg.scoring.roundWin) fail(`scores ${f.scores} for ${wins} rounds won`);
      }
    }
    st.ms = Date.now() - t0;
    return { probs, stats: st };
  }

  // ---------------------------------------------------------------- sabotage: each of these is broken on purpose

  function sabotage() {
    const M = SPOT.sim, R = SPOT.RULES, cases = [];
    const env0 = base();
    const run = (name, keys, env) => {
      const res = [];
      for (const k of keys) for (const r of runCheck(k, env)) res.push(r);
      const failed = res.filter((r) => !r.ok);
      cases.push({ name, caught: failed.length > 0, probs: failed.slice(0, 2).map((r) => r.name + (r.info ? ` (${r.info})` : '')) });
    };
    const withCfg = (edit) => { const c = clone(SPOT.CONFIG); edit(c); return Object.assign(base(), { cfg: c }); };
    const withPatch = (patch, extra) => Object.assign(base(), { patch }, extra || {});
    const dealWith = (fn) => withPatch(function (m) { m.deal = function () { return fn(this.cfg, this.skyMode, this.rngRound, this.players[0].rngField, this.players[1].rngField); }; }, { deal: fn });

    run('config: four rounds a game', ['guard'], withCfg((c) => { c.roundsPerGame = 4; }));
    run('config: 20 s to count on hard', ['guard'], withCfg((c) => { c.difficulty.hard = 20; }));
    run('config: 5 s to answer', ['guard'], withCfg((c) => { c.answerTimeSeconds = 5; }));
    run('config: up to 25 animals', ['guard'], withCfg((c) => { c.animals.max = 25; }));
    run('config: Tommy Freeze with no cooldown', ['guard'], withCfg((c) => { c.characters.tommy.cooldownSeconds = 0; }));
    run('a game whose answer window is really 5 s', ['timing'], withCfg((c) => { c.answerTimeSeconds = 5; }));
    run('a game whose hard round really lasts 20 s', ['timing'], withCfg((c) => { c.difficulty.hard = 20; }));
    run('a game of four rounds', ['scoring'], withCfg((c) => { c.roundsPerGame = 4; }));
    run('dealing zero to both players', ['deals', 'fields'], dealWith((cfg, sky, rr, ra, rb) => { const d = M.dealRound(cfg, sky, rr, ra, rb); if (d.zero >= 0) d.counts = [0, 0]; return d; }));
    run('zero rounds 30% of the time', ['deals'], dealWith((cfg, sky, rr, ra, rb) => { const d = M.dealRound(cfg, sky, rr, ra, rb); if (rr() < 0.3) d.counts[rr() < 0.5 ? 0 : 1] = 0; return d; }));
    let tickTock = 0;
    run('zero rounds on a schedule (every 100th round)', ['deals'], dealWith((cfg, sky, rr, ra, rb) => { const c2 = clone(cfg); c2.animals.allowRareZero = false; const d = M.dealRound(c2, sky, rr, ra, rb); if (++tickTock % 100 === 0) d.counts[0] = 0; return d; }));
    run('counts that can reach 21', ['deals', 'fields'], dealWith((cfg, sky, rr, ra, rb) => { const d = M.dealRound(cfg, sky, rr, ra, rb); if (d.counts[1] === 20 && rr() < 0.5) d.counts[1] = 21; return d; }));
    run('fields with a mixture of animals', ['fields'], withPatch((m) => { m.makeField = function (type, count, P) { const f = M.makeField(this.cfg, type, count, P.rngField); f.animals.forEach((a, k) => { a.type = R.animalTypes[k % 5]; }); return f; }; }));
    run('a field showing one animal more than it scores', ['fields'], withPatch((m) => { m.makeField = function (type, count, P) { const f = M.makeField(this.cfg, type, count + 1, P.rngField); f.count = count; return f; }; }));
    run('Tommy Freeze with no cooldown', ['freeze'], withCfg((c) => { c.characters.tommy.cooldownSeconds = 0; }));
    run('Tommy Freeze that freezes both fields', ['freeze'], withPatch((m) => { const ap = m.applyPower; m.applyPower = function (P, on) { ap.call(this, P, on); if (P.power.kind === 'freeze') for (const Q of this.players) Q.field.frozen = on; }; }));
    run('a freeze that also stops the clock', ['timing', 'freeze'], withPatch((m) => { const st = m.step; m.step = function (dt) { if (this.players.some((P) => P.field.frozen)) { this.tickPowers(dt); return; } st.call(this, dt); }; }));
    run('the helicopter in the daytime', ['heli'], withCfg((c) => { c.characters.pilot.nightOnly = false; }));
    run('a helicopter that lights both fields', ['heli'], withPatch((m) => { const ap = m.applyPower; m.applyPower = function (P, on) { ap.call(this, P, on); if (P.power.kind === 'spotlight') for (const Q of this.players) Q.lit = on; }; }));
    run('Teddy\'s big binoculars for everyone', ['wide'], withPatch((m) => { m.lensFor = function () { return M.lensRadius(this.cfg, 'teddy'); }; }));
    run('a screen that shows a locked answer early', ['hidden'], withPatch((m) => { const vw = m.view; m.view = function () { const v = vw.call(this); v.players.forEach((p, i) => { p.answer = this.players[i].ans.value; }); return v; }; }));
    run('a lock message that carries the number', ['hidden'], withPatch((m) => { const lv = m.lockValue; m.lockValue = function (i, n, how) { const r = lv.call(this, i, n, how); const e = this.events[this.events.length - 1]; if (e && e.type === 'lock') e.value = n; return r; }; }));
    run('a two-player clicker that shows its number', ['hidden'], withPatch((m) => { const vw = m.view; m.view = function () { const v = vw.call(this); v.players.forEach((p, i) => { if (!this.players[i].ans.locked) p.entry = this.players[i].ans.draft; }); return v; }; }));
    run('a computer that copies your count', ['cpu'], withPatch((m) => { m.planCpuAnswer = function (i) { const p = SPOT.brain.planAnswer(this.cpuView(i), this.cfg, this.rngCpu); p.value = this.players[0].field.count; return p; }; }));
    run('a computer that is always right', ['cpu'], withPatch((m) => { m.planCpuAnswer = function (i) { const p = SPOT.brain.planAnswer(this.cpuView(i), this.cfg, this.rngCpu); p.value = this.players[i].field.count; return p; }; }));
    run('a computer that forgets to answer', ['cpu'], withPatch((m) => { m.planCpuAnswer = function (i) { const p = SPOT.brain.planAnswer(this.cpuView(i), this.cfg, this.rngCpu); p.at = 9; return p; }; }));
    run('both right gives the round to player 1', ['scoring'], withPatch((m) => { m.score = function (a, c) { const r = M.scoreRound(a, c, this.bothWrong); if (r.why === 'bothRight') r.winner = 0; return r; }; }));
    run('a clicker number that counts without being locked', ['scoring'], withPatch((m) => { const rv = m.reveal; m.reveal = function () { this.players.forEach((P) => { if (!P.ans.locked && P.ans.draft !== null) { P.ans.locked = true; P.ans.value = P.ans.draft; } }); rv.call(this); }; }));
    run('a brother who saves you even when he isn\'t there', ['buddy'], withPatch((m) => { m.buddyHere = () => true; const cb = m.callBuddy; m.callBuddy = function () { const r = cb.call(this); return r; }; m.buddy = { kind: 'tommy', phase: 'help', t: 0, helloT: 0, treatT: 0, treated: true, left: 1e9, visit: 10, save: true, byeT: 0 }; m.updateBuddy = function () {}; }));
    run('a brother who never leaves', ['buddy'], withPatch((m) => { const ub = m.updateBuddy; m.updateBuddy = function (dt) { if (this.buddy) this.buddy.left = 99; ub.call(this, dt); }; }));
    run('a brother who saves every time (no once-per-visit)', ['buddy'], withPatch((m) => { const bs = m.buddySave; m.buddySave = function (i, how) { bs.call(this, i, how); this.buddy.save = true; }; }));
    run('a brother who answers after the 3 s', ['buddy'], withCfg((c) => { c.companion.shoutBefore = -0.5; }));
    run('a brother who spots the computer\'s field too', ['buddy'], withPatch((m) => { const sp = m.spotting; m.spotting = function (i) { return sp.call(this, 0) || sp.call(this, i); }; }));
    run('a high five that only helps player 1', ['buddy'], withPatch((m) => { const hf = m.highFive; m.highFive = function () { const r = hf.call(this); if (r === 'ok') this.players[1].spotT = 0; return r; }; }));
    run('a high five with no rest', ['buddy'], withPatch((m) => { const hf = m.highFive; m.highFive = function () { const r = hf.call(this); this.cheerT = 0; return r; }; }));
    run('a brother whose treats use the computer\'s dice', ['buddy'], withPatch((m) => { Object.defineProperty(m, 'rngBuddy', { get() { return this.rngCpu; }, set() {} }); }));
    run('unlocks that count the computer\'s wins', ['unlocks'], Object.assign(base(), { progress: Object.assign({}, M.progress, { record(p, cfg, final, mode) { const won = final.winner !== null; p.games++; if (won) p.wins++; const newly = []; for (const u of cfg.roster.unlocks) if (p.wins >= u.wins && !M.progress.has(p, cfg, u.id)) { p.unlocked.push(u.id); newly.push(u.id); } return { humanWon: won, newly }; } }) }));
    void env0;
    return cases;
  }

  SPOT.check = { rules, soak, sabotage, CHECKS };
})();
