#!/usr/bin/env node
/* Runs the rule checks in Node (no browser, no npm):
     node tools/check.js                 Teddy's rules and the defaults, then the sabotage cases (--verbose lists every check)
     node tools/check.js --soak [--matches=N] [--2p | --cpu] [--easy | --medium | --hard] [--day | --night | --mix]
   Loads the game's rules (title, config, sim, brain, check) into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/config.js', 'js/sim.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const SPOT = ctx.SPOT;
const args = process.argv.slice(2);
const has = (a) => args.includes(a);
const val = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
let bad = 0;

if (!has('--soak-only')) {
  const t0 = Date.now();
  const rules = SPOT.check.rules();
  const groups = {};
  for (const r of rules) (groups[r.group] = groups[r.group] || []).push(r);
  console.log(`rules: ${rules.filter((r) => r.ok).length} of ${rules.length} ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const [g, list] of Object.entries(groups)) {
    const fails = list.filter((r) => !r.ok);
    console.log(`  ${fails.length ? 'FAIL' : 'ok  '} ${g.padEnd(8)} ${list.length - fails.length}/${list.length}`);
    for (const r of list) if (!r.ok || has('--verbose')) console.log(`        ${r.ok ? 'ok' : 'FAIL'}: ${r.name}${r.info ? ' (' + r.info + ')' : ''}`);
  }
  if (rules.some((r) => !r.ok)) bad++;

  if (!has('--no-sabotage')) {
    const t1 = Date.now();
    const sab = SPOT.check.sabotage();
    console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken setups caught (${((Date.now() - t1) / 1000).toFixed(1)} s)`);
    for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.probs.length ? ' <- ' + s.probs.join('; ') : ''}`);
    if (sab.some((s) => !s.caught)) bad++;
  }
}

if (has('--soak') || has('--soak-only')) {
  const o = { matches: Number(val('matches')) || 120 };
  if (has('--2p')) o.mode = '2p';
  if (has('--cpu')) o.mode = 'cpu';
  for (const d of ['easy', 'medium', 'hard']) if (has(`--${d}`)) o.difficulty = d;
  for (const s of ['day', 'night', 'mix']) if (has(`--${s}`)) o.sky = s;
  const { probs, stats: st } = SPOT.check.soak(o);
  console.log(`soak: ${st.matches} of ${o.matches} matches finished, ${st.rounds} rounds, ${st.ticks} ticks (${(st.ms / 1000).toFixed(1)} s)`);
  console.log(`  zero rounds ${st.zero} (${((st.zero / Math.max(1, st.rounds)) * 100).toFixed(1)}%), bot rounds unanswered ${st.unanswered}/${st.humanRounds}, closest two animals ${st.minGap.toFixed(2)} x their room`);
  for (const [d, c] of Object.entries(st.cpu)) console.log(`  computer on ${d}: right ${c.right}/${c.n} (${((c.right / c.n) * 100).toFixed(0)}%)`);
  for (const [ch, s] of Object.entries(st.seen)) console.log(`  ${ch.padEnd(6)} sees ${((s.v / s.n) * 100).toFixed(0)}% of their animals at a time`);
  for (const p of probs) console.log(`  PROBLEM ${p}`);
  if (probs.length || st.matches !== o.matches) bad++;
}
process.exitCode = bad ? 1 : 0;
