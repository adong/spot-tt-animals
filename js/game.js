/* Spot TT Animals: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, draws each
   player's own field through their own binoculars (one camera each, side by side, or one above the other when the
   screen stands up), and handles the HUD, menus, keys, taps and sound.
   The screen reads only match.view(), so it can't show an answer before both are locked.
   Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const A = SPOT.art;
  const M = SPOT.sim;
  const C = SPOT.CONFIG;
  const SFX = SPOT.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (k) => k * k * (3 - 2 * k);
  const approach = (v, t, step) => (v < t ? Math.min(t, v + step) : Math.max(t, v - step));

  const ANIMAL = {
    chicken: { emoji: '🐔', many: 'CHICKENS' },
    cow: { emoji: '🐄', many: 'COWS' },
    sheep: { emoji: '🐑', many: 'SHEEP' },
    rooster: { emoji: '🐓', many: 'ROOSTERS' },
    hen: { emoji: '🐔', many: 'HENS' },
  };
  const DIFF = { easy: '🟢 EASY', medium: '🟡 MEDIUM', hard: '🔴 HARD' };
  const pilotEntry = Kit.roster.get(C.characters.pilot.who) || Kit.roster.get('zoom');
  const CHAR = {
    teddy: { id: 'teddy', look: 'teddy', name: 'TEDDY', emoji: '🔭', power: 'WIDE VIEW' },
    tommy: { id: 'tommy', look: 'tommy', name: 'TOMMY', emoji: '❄️', power: 'FREEZE' },
    pilot: { id: 'pilot', look: pilotEntry.id, name: pilotEntry.name, emoji: '🚁', power: 'SPOTLIGHT' },
  };
  const charDesc = (id) => ({
    teddy: `Bigger binoculars: he sees more of his field at once. Always on.`,
    tommy: `Freezes his animals for ${C.characters.tommy.freezeDurationSeconds} s so they're easy to count. Then ${C.characters.tommy.cooldownSeconds} s to recharge.`,
    pilot: `Helicopter pilot. At night his helicopter lights up his binoculars for ${C.characters.pilot.durationSeconds} s. Then ${C.characters.pilot.cooldownSeconds} s to recharge. Night only.`,
  }[id]);
  const PCOL = ['#9fd0ff', '#9ff2d6'];
  const nameOf = (kind) => (Kit.roster.get(kind) || { name: String(kind).toUpperCase() }).name;
  const buddyFor = (id) => Kit.roster.buddyFor(id);

  // ---------------------------------------------------------------- storage

  const ls = {
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const SKEY = 'spotTT.settings';
  const settings = Object.assign({ mode: 'cpu', difficulty: 'easy', sky: 'day', chars: ['teddy', 'tommy'], bothWrong: C.scoring.bothWrong },
    (() => { try { return JSON.parse(ls.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } })());
  const saveSettings = () => ls.setItem(SKEY, JSON.stringify(settings));
  let prog = M.progress.load(ls);
  const owned = (id) => M.progress.has(prog, C, id);
  function fixChars() {
    settings.chars = [0, 1].map((i) => (CHAR[settings.chars[i]] && owned(settings.chars[i]) ? settings.chars[i] : ['teddy', 'tommy'][i]));
  }
  fixChars();

  // ---------------------------------------------------------------- renderer, scene, cameras

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.autoClear = false;
  const scene = new T.Scene();
  const hemi = new T.HemisphereLight('#ffffff', '#6a8a4a', 0.95);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff3e0', 1.05);
  sun.position.set(-6, 14, 9);
  scene.add(sun);
  const titleFog = new T.Fog('#cdebff', 45, 150);

  A.initTextures();
  A.makeWorld(scene);
  const fx = A.makeFx(scene);

  // one camera per player, each looking down into their own field; layer 1 / 2 holds that field's animals
  const cams = [0, 1].map((i) => {
    const c = new T.OrthographicCamera(-10, 10, 6, -6, 1, 160);
    const d = 60;
    c.position.set(A.FX[i], d * Math.sin(A.TILT), d * Math.cos(A.TILT));
    c.lookAt(A.FX[i], 0, 0);
    c.layers.enable(i + 1);
    return c;
  });
  // the title camera sees the whole farm, both fields and the brothers in front (layer 3)
  const titleCam = new T.PerspectiveCamera(38, 1, 0.5, 400);
  titleCam.position.set(0, 6.2, 25);
  titleCam.lookAt(0, 2.4, 0);
  for (const l of [1, 2, 3]) titleCam.layers.enable(l);

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (isTouch) document.body.classList.add('touch');

  const faceIds = ['teddy', 'tommy', pilotEntry.id, ...C.roster.mystery];
  const faces = Kit.portraits(faceIds.map((id) => Kit.roster.get(id)).filter(Boolean), { size: 152 });
  const faceOf = (char) => faces[CHAR[char] ? CHAR[char].look : char];

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', modeT: 0, time: 0, acc: 0, frozen: false, keepAwake: false,
    match: null, demo: null, view: null,
    lensOpen: [0, 0], lensTarget: [0, 0], litK: [0, 0], frostK: [0, 0], tint: [-1, -1], revealK: 0,
    reveal: null, banner: null, ambientT: 3, final: null, finalNew: [], sparkT: 0,
    pip: { until: 0, born: 0, ids: [], modes: [], hop: false }, treatFly: null, shouted: false, spotOn: [false, false],
  };
  let rects = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 }];
  let upp = 0.03, portrait = false, short = false;
  let pipRect = { x: 0, y: 0, w: 150, h: 168 };
  const cur = () => (st.mode === 'match' || st.mode === 'pause' ? st.match : st.demo);

  // ---------------------------------------------------------------- the animals' views (pooled per field and type)

  const mats = [A.animalMats(), A.animalMats()];
  const fieldViews = [{ ref: null, list: [] }, { ref: null, list: [] }];
  const pools = [{}, {}];
  function takeAnimal(i, type) {
    const p = pools[i][type] || (pools[i][type] = []);
    let v = p.pop();
    if (!v) { v = A.makeAnimal(type, i, mats[i]); scene.add(v.root); }
    v.root.visible = true;
    return v;
  }
  function releaseField(i) {
    const fv = fieldViews[i];
    for (const v of fv.list) { v.root.visible = false; pools[i][v.type].push(v); }
    fv.list.length = 0;
    fv.ref = null;
  }
  function syncAnimals(S, dt) {
    for (let i = 0; i < 2; i++) {
      const f = S ? S.players[i].field : null;
      const fv = fieldViews[i];
      if (fv.ref !== f) {
        releaseField(i);
        if (f) { for (const a of f.animals) fv.list.push(takeAnimal(i, a.type)); fv.ref = f; }
      }
      if (!f) continue;
      const hold = f.frozen || S.phase === 'result' || S.phase === 'final' || st.mode === 'pause';
      fv.list.forEach((v, k) => A.poseAnimal(v, f.animals[k], dt, hold));
    }
  }
  // Tommy Freeze turns only his own field's animals icy: their colours go pale blue and glow a little
  const ICE = new T.Color('#cfefff');
  function tintField(i, k) {
    const q = Math.round(k * 20) / 20;
    if (st.tint[i] === q) return;
    st.tint[i] = q;
    for (const set of Object.values(mats[i])) {
      for (const m of Object.values(set)) {
        if (!m.userData.base) m.userData.base = m.color.clone();
        m.color.copy(m.userData.base).lerp(ICE, 0.3 * q);
        m.emissive.set('#3a9cff');
        m.emissiveIntensity = 0.16 * q;
      }
    }
  }

  // the number badges for the count at the reveal
  const badges = [[], []];
  function badge(i, k) {
    if (!badges[i][k]) { const s = A.makeBadge(i); scene.add(s); badges[i][k] = s; }
    return badges[i][k];
  }
  function hideBadges() { for (const list of badges) for (const b of list) b.visible = false; }

  // Zoom's helicopter, one per field, only built when a pilot plays
  const helis = [null, null];
  function heli(i) {
    if (!helis[i]) { helis[i] = A.makeHeli(i, pilotEntry.look); scene.add(helis[i].group); }
    return helis[i];
  }

  // the brothers (or whoever played) in front of the fence, on the title and final screens
  const kids = {};
  const KID_SPOTS = [[-4.2, 0, 13, Math.PI + 0.35], [4.2, 0, 13, Math.PI - 0.35]];
  let stage = { ids: ['teddy', 'tommy'], modes: ['look', 'look'], slot: {} };
  function setStage(ids, modes) {
    for (const k of Object.values(kids)) k.root.visible = false;
    stage = { ids, modes, slot: {} };
    ids.forEach((id, s) => {
      // the same character twice gets a second copy
      const key = ids.indexOf(id) !== s ? id + '#2' : id;
      if (!kids[key]) { kids[key] = A.makeKid(id); A.setLayer(kids[key].root, 3); scene.add(kids[key].root); }
      const k = kids[key];
      const [x0, y, z, ry] = KID_SPOTS[s];
      // out at the sides of whatever screen this is, clear of the menu in the middle
      const halfW = Math.tan((titleCam.fov * Math.PI) / 360) * (titleCam.position.z - z) * titleCam.aspect;
      const x = Math.sign(x0) * Math.max(2.6, halfW * 0.72);
      k.root.position.set(x, y, z);
      k.root.rotation.y = ry;
      k.root.visible = true;
      stage.slot[s] = k;
    });
  }
  function updateKids(dt) {
    if (st.mode === 'match' || st.mode === 'pause') { for (const k of Object.values(kids)) k.root.visible = false; return; }
    for (let s = 0; s < 2; s++) {
      const k = stage.slot[s];
      if (!k) continue;
      k.root.visible = true;
      let mode = stage.modes[s];
      if (mode === 'look') {
        // now and then one of them lowers the binoculars for his signature move
        const cyc = (st.time + s * 5) % 11;
        if (cyc > 8.6) mode = Kit.roster.signature(k.entry, 'hello');
      }
      if (mode === 'cheer') mode = Kit.roster.signature(k.entry, ((st.time / 2.4) | 0) % 2 ? 'goodbye' : 'hello');
      A.poseKid(k, mode, dt, st.time);
      const hop = mode === 'jumpshot' || mode === 'peace' ? Math.abs(Math.sin(st.time * 4.5)) * 0.35 : 0;
      k.root.position.y = hop;
    }
  }

  // ---------------------------------------------------------------- lighting: each view lit for its own player

  const LIGHT = {
    day: { sky: '#ffffff', ground: '#6a8a4a', hi: 0.95, sun: '#fff3e0', si: 1.05 },
    night: { sky: '#6a7ac4', ground: '#0b0f1a', hi: 0.19, sun: '#a9bcff', si: 0.27 },
    lit: { sky: '#fff4d0', ground: '#6a5a30', hi: 0.95, sun: '#fff0c8', si: 0.85 },
  };
  const tmpC = new T.Color();
  function applyLight(sky, litK) {
    const a = LIGHT[sky === 'night' ? 'night' : 'day'], b = LIGHT.lit, t = sky === 'night' ? smooth(clamp(litK, 0, 1)) : 0;
    hemi.color.set(a.sky).lerp(tmpC.set(b.sky), t);
    hemi.groundColor.set(a.ground).lerp(tmpC.set(b.ground), t);
    hemi.intensity = a.hi + (b.hi - a.hi) * t;
    sun.color.set(a.sun).lerp(tmpC.set(b.sun), t);
    sun.intensity = a.si + (b.si - a.si) * t;
  }

  // ---------------------------------------------------------------- the binocular frames

  const masks = [$('mask0'), $('mask1')];
  const maskKey = ['', ''];
  function paintMasks(force) {
    const v = st.view;
    if (!v || (st.mode !== 'match' && st.mode !== 'pause')) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 0; i < 2; i++) {
      const r = rects[i], P = v.players[i];
      const o = {
        w: r.w, h: r.h, dpr, r: P.lens / upp, lobe: C.lens.lobe, open: smooth(st.lensOpen[i]),
        night: v.sky === 'night', lit: st.litK[i] > 0.5, frost: Math.round(st.frostK[i] * 10) / 10, color: PCOL[i],
      };
      const key = `${o.w},${o.h},${o.r.toFixed(1)},${o.open.toFixed(3)},${o.night},${o.lit},${o.frost}`;
      if (key === maskKey[i] && !force) continue;
      maskKey[i] = key;
      A.paintMask(masks[i], o);
    }
  }

  // ---------------------------------------------------------------- your brother: the fence window and the arrows

  const pip = A.makePip($('pip'));
  const spots = [$('spot0'), $('spot1')];
  function showPip(ids, modes, dur, hop) {
    st.pip = { until: st.time + dur, born: st.time, ids, modes, hop: !!hop };
    pip.show(ids);
  }
  function updatePip(dt) {
    const el = $('pip'), tag = $('pipTag'), P = st.pip;
    const on = st.mode === 'match' && st.time < P.until;
    setCls(el, 'hidden', !on);
    setCls(tag, 'hidden', !on);
    if (!on) return;
    const age = st.time - P.born, left = P.until - st.time;
    const k = Math.min(1, age / 0.2, left / 0.2);
    el.style.transform = `scale(${(0.4 + 0.6 * smooth(clamp(k, 0, 1))).toFixed(3)})`;
    el.style.opacity = String(clamp(k * 1.5, 0, 1));
    setCls(el, 'night', !!(st.view && st.view.sky === 'night'));
    pip.render(P.modes, dt, st.time, P.hop);
    tag.textContent = P.ids.length === 1 ? nameOf(P.ids[0]) : '✋ HIGH FIVE!';
    tag.style.left = `${pipRect.x + pipRect.w / 2}px`;
    tag.style.top = `${pipRect.y - 12}px`;
    tag.style.transform = 'translateX(-50%)';
  }
  // the treat arcs from his window into your card
  function flyTreat(emoji) {
    const c = $('card0').querySelector('.face').getBoundingClientRect();
    st.treatFly = { born: st.time, dur: 0.9, emoji, from: { x: pipRect.x + pipRect.w / 2, y: pipRect.y + pipRect.h * 0.45 }, to: { x: c.left + c.width / 2, y: c.top + c.height / 2 } };
  }
  function updateTreatFly() {
    const el = $('treatFly'), T0 = st.treatFly;
    if (!T0 || st.mode !== 'match') { el.classList.add('hidden'); return; }
    const k = (st.time - T0.born) / T0.dur;
    if (k >= 1) { el.classList.add('hidden'); st.treatFly = null; return; }
    el.classList.remove('hidden');
    el.textContent = T0.emoji;
    const x = T0.from.x + (T0.to.x - T0.from.x) * k, y = T0.from.y + (T0.to.y - T0.from.y) * k - Math.sin(k * Math.PI) * 90;
    el.style.left = `${x - 17}px`;
    el.style.top = `${y - 17}px`;
    el.style.transform = `rotate(${k * 540}deg) scale(${1 + Math.sin(k * Math.PI) * 0.4})`;
  }
  // arrows on your rim for your own hiding animals (your brother spotting, or a high five)
  function updateSpots() {
    const S = st.match, dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 0; i < 2; i++) {
      const on = !!(S && st.mode === 'match' && S.spotting(i));
      if (!on && !st.spotOn[i]) continue;
      st.spotOn[i] = on;
      const r = rects[i];
      const pts = on ? S.spotted(i).map((a) => { const q = M.toLens(C, a.x, a.z, 0.4); return [r.w / 2 + q.sx / upp, r.h / 2 - q.sy / upp]; }) : [];
      A.paintSpots(spots[i], pts, { w: r.w, h: r.h, dpr, r: S ? S.lensFor(i) / upp : 1, lobe: C.lens.lobe, t: st.time });
    }
  }

  // ---------------------------------------------------------------- toasts and the banner (run on the game clock)

  const ptoasts = [[], []];
  function ptoast(i, text, cls = '', dur = 1.5) {
    const el = document.createElement('div');
    el.className = 'ptoast ' + cls;
    el.textContent = text;
    $('pt' + i).appendChild(el);
    ptoasts[i].unshift({ el, born: st.time, dur });
    while (ptoasts[i].length > 3) ptoasts[i].pop().el.remove();
  }
  function updateToasts() {
    for (let i = 0; i < 2; i++) {
      const list = ptoasts[i], r = rects[i];
      for (let k = list.length - 1; k >= 0; k--) {
        const o = list[k], age = st.time - o.born;
        if (age > o.dur) { o.el.remove(); list.splice(k, 1); continue; }
        const kin = Math.min(1, age / 0.16), kout = clamp((o.dur - age) / 0.3, 0, 1);
        o.el.style.opacity = String(Math.min(kin * 1.5, kout));
        o.el.style.top = `${r.h * 0.22 + k * 34 - age * 16}px`;
        o.el.style.transform = `translateX(-50%) scale(${kin < 1 ? 1.5 - 0.5 * smooth(kin) : 1})`;
      }
    }
  }
  function clearToasts() { for (const list of ptoasts) { for (const o of list) o.el.remove(); list.length = 0; } }

  function banner(html, dur = 1.4, cls = '') {
    const el = $('banner');
    el.innerHTML = html;
    el.className = 'banner ' + cls;
    st.banner = { born: st.time, dur };
  }
  function updateBanner() {
    const el = $('banner'), b = st.banner;
    if (!b) return;
    const age = st.time - b.born;
    if (age > b.dur || st.mode !== 'match') { el.classList.add('hidden'); st.banner = null; return; }
    const kin = Math.min(1, age / 0.25);
    const top = portrait ? rects[1].y - 70 : rects[0].y + rects[0].h * 0.36;
    el.style.top = `${top}px`;
    el.style.opacity = String(Math.min(kin * 2, clamp((b.dur - age) / 0.25, 0, 1)));
    el.style.transform = `scale(${kin < 1 ? 1.8 - 0.8 * smooth(kin) : 1})`;
  }

  function nudge(el) {
    if (!el) return;
    el.classList.remove('no');
    void el.offsetWidth;
    el.classList.add('no');
  }

  // ---------------------------------------------------------------- layout

  function place(el, x, y, w, h) {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    if (w !== undefined) el.style.width = `${Math.round(w)}px`;
    if (h !== undefined) el.style.height = `${Math.round(h)}px`;
  }
  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    portrait = h > w * 1.05;
    short = Math.min(w, h) < 520;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('short', short);
    const m = short ? 6 : 10;
    const c0 = $('card0'), c1 = $('card1'), mid = $('mid'), fence = $('fence');
    c0.style.right = c1.style.left = '';
    if (!portrait) {
      // the kit's ? and 中文 buttons live in the middle of the left edge: keep a gutter there so they never cover a lens
      const topH = short ? 50 : 84, gap = short ? 14 : 22, gl = short ? 50 : 58, gr = short ? m : gl;
      const pw = Math.floor((w - gl - gr - gap) / 2), ph = h - topH - m;
      rects = [{ x: gl, y: topH, w: pw, h: ph }, { x: gl + pw + gap, y: topH, w: pw, h: ph }];
      place(fence, gl + pw + 4, topH + 6, gap - 8, ph - 12);
      fence.classList.remove('flat');
      place(c0, m, short ? 4 : 8);
      c1.style.left = 'auto';
      c1.style.right = `${m}px`;
      c1.style.top = `${short ? 4 : 8}px`;
      mid.style.left = '50%';
      mid.style.top = `${short ? 2 : 4}px`;
      mid.style.translate = '-50% 0';
    } else {
      const topH = short ? 58 : 84, gap = 14;
      const pw = w - 2 * m, ph = Math.floor((h - topH - m - gap) / 2);
      rects = [{ x: m, y: topH, w: pw, h: ph }, { x: m, y: topH + ph + gap, w: pw, h: ph }];
      place(fence, m + 6, topH + ph + 4, pw - 12, gap - 8);
      fence.classList.add('flat');
      // each card sits in a top corner of its own binoculars (the ? and 中文 buttons sit on the fence, left)
      place(c0, m + 6, topH + 6);
      c1.style.left = 'auto';
      c1.style.right = `${m + 6}px`;
      c1.style.top = `${topH + ph + gap + 6}px`;
      mid.style.left = '50%';
      mid.style.top = `${short ? 3 : 6}px`;
      mid.style.translate = '-50% 0';
    }
    // one scale for both views (fair: animals look the same size to both), big enough for the bigger binoculars
    const S = st.match;
    const lensMax = S ? Math.max(S.lensFor(0), S.lensFor(1)) : C.lens.radius;
    const needW = 2 * (C.lens.lobe * lensMax + lensMax) + 1.1, needH = 2 * lensMax + 1.4;
    upp = Math.max(needW / rects[0].w, needH / rects[0].h);
    cams.forEach((c, i) => {
      const r = rects[i];
      c.left = (-r.w / 2) * upp; c.right = (r.w / 2) * upp; c.top = (r.h / 2) * upp; c.bottom = (-r.h / 2) * upp;
      c.updateProjectionMatrix();
    });
    for (let i = 0; i < 2; i++) {
      const r = rects[i];
      place(masks[i], r.x, r.y, r.w, r.h);
      place(spots[i], r.x, r.y, r.w, r.h);
      place($('pui' + i), r.x, r.y, r.w, r.h);
    }
    // your brother's button, bar and fence window: VS Computer in the corner of your binoculars, the high five on the fence
    const bud = $('budBtn'), bar = $('budBar');
    const budS = short ? 64 : 92, powS = short ? 64 : 92;
    const two = S ? S.mode === '2p' : settings.mode === '2p';
    const r0 = rects[0];
    bar.classList.toggle('hidden', two || portrait || short || !S);
    if (!two) {
      const pw = short ? 96 : 150, ph = short ? 108 : 168;
      if (!portrait) {
        place(bud, r0.x + r0.w - budS - 14, r0.y + r0.h - budS - (short ? 12 : 22));
        pipRect = { x: r0.x + 10, y: r0.y + r0.h - ph - 10, w: pw, h: ph };
      } else {
        const hasPow = !!(S && S.players[0].power.kind);
        place(bud, r0.x + r0.w - 10 - budS - (hasPow ? powS + 14 : 0), r0.y + r0.h - budS - 14);
        pipRect = { x: r0.x + r0.w - pw - 8, y: r0.y + 8, w: pw, h: ph };
      }
      const c0r = c0.getBoundingClientRect();
      place(bar, c0r.right + 8, c0r.top + Math.max(0, (c0r.height - 46) / 2));
    } else {
      const pw = short ? 120 : 190, ph = short ? 90 : 140;
      if (!portrait) {
        const fxm = rects[0].x + rects[0].w + (rects[1].x - rects[0].x - rects[0].w) / 2, by = r0.y + r0.h - budS - (short ? 12 : 22);
        place(bud, fxm - budS / 2, by);
        pipRect = { x: fxm - pw / 2, y: by - ph - 22, w: pw, h: ph };
      } else {
        const fy = rects[1].y - (rects[1].y - r0.y - r0.h) / 2;
        place(bud, w / 2 - budS / 2, fy - budS / 2);
        // centred on the fence, so it covers both views the same (it sits over the button while it rests anyway)
        pipRect = { x: w / 2 - pw / 2, y: fy - ph / 2, w: pw, h: ph };
      }
    }
    place($('pip'), pipRect.x, pipRect.y, pipRect.w, pipRect.h);
    pip.resize(pipRect.w, pipRect.h);
    renderer.setSize(w, h, false);
    titleCam.aspect = w / h;
    titleCam.updateProjectionMatrix();
    if (stage.slot[0]) setStage(stage.ids, stage.modes);
    const res = $('result');
    if (portrait) { res.style.left = '50%'; res.style.top = `${rects[1].y - 10}px`; res.style.bottom = ''; res.style.translate = '-50% -50%'; }
    else { res.style.left = '50%'; res.style.top = ''; res.style.bottom = `${m + 4}px`; res.style.translate = '-50% 0'; }
    maskKey[0] = maskKey[1] = '';
    paintMasks(true);
  }

  // ---------------------------------------------------------------- HUD

  const grids = [0, 1].map((i) => {
    const g = $('ask' + i).querySelector('.grid');
    const btns = [];
    for (let n = 0; n <= SPOT.RULES.maxAnimals; n++) {
      const b = document.createElement('button');
      b.textContent = String(n);
      if (n === 0) b.className = 'zero';
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        firstGesture();
        b.classList.add('down');
        setTimeout(() => b.classList.remove('down'), 110);
        const S = st.match;
        if (st.mode === 'match' && S && S.players[i].human) S.pick(i, n);
      });
      g.appendChild(b);
      btns.push(b);
    }
    return btns;
  });
  function setHtml(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
  function setCls(el, cls, on) { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }

  function setupHud() {
    const S = st.match;
    S.players.forEach((P, i) => {
      const card = $('card' + i), ch = CHAR[P.char];
      card.querySelector('.face img').src = faceOf(P.char);
      card.querySelector('.face').className = 'face ' + P.char;
      card.querySelector('.n').textContent = ch.name;
      card.querySelector('.who').textContent = S.mode === 'cpu' ? (P.human ? 'YOU' : '🤖 CPU') : i ? '2P' : '1P';
      card.querySelector('.ab').textContent = `${ch.emoji} ${ch.power}`;
      const pow = $('pow' + i);
      pow.classList.toggle('hidden', !P.power.kind);
      pow.classList.toggle('spot', P.power.kind === 'spotlight');
      pow.querySelector('.e').textContent = ch.emoji;
      pow.querySelector('small').textContent = ch.power;
      pow.style.pointerEvents = P.human ? '' : 'none';
      const kb = pow.querySelector('kbd');
      kb.textContent = i && S.mode === '2p' ? '←' : 'A';
      kb.style.display = P.human ? '' : 'none';
      $('pas' + i).classList.toggle('hidden', P.char !== 'teddy');
      const clk = $('clk' + i);
      clk.classList.toggle('hidden', S.mode !== '2p');
    });
    // your brother's button: his face (VS Computer) or both players' faces for the high five
    const bud = $('budBtn'), imgs = bud.querySelectorAll('.pics img');
    bud.classList.toggle('hidden', S.mode === 'demo');
    bud.classList.toggle('two', S.mode === '2p');
    if (S.mode === '2p') {
      imgs[0].src = faceOf(S.players[0].char); imgs[1].src = faceOf(S.players[1].char); imgs[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'HIGH FIVE';
      bud.querySelector('.sv').classList.add('hidden');
    } else {
      const kind = buddyFor(S.lookOf(S.players[0].char));
      imgs[0].src = faces[kind]; imgs[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${nameOf(kind)}`;
      bud.querySelector('.sv').classList.remove('hidden');
      $('budBar').querySelector('img').src = faces[kind];
    }
    $('resH0').textContent = S.mode === 'cpu' ? 'YOU' : 'PLAYER 1';
    $('resH1').textContent = S.mode === 'cpu' ? 'COMPUTER' : 'PLAYER 2';
  }

  const clickBump = [0, 0];
  function updateHud() {
    const S = st.match;
    if (!S) return;
    const v = (st.view = S.view());
    setHtml($('roundNo'), `ROUND ${v.round} OF ${v.rounds}`);
    const clock = $('clock');
    let lbl = 'TIME', num = '';
    if (v.phase === 'ready') { lbl = 'GET READY'; num = v.countdown ? String(v.countdown) : '…'; }
    else if (v.phase === 'observe') { const s = Math.ceil(v.timeLeft - 1e-9); num = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    else if (v.phase === 'answer') { lbl = 'ANSWER!'; num = String(Math.max(0, Math.ceil(v.timeLeft - 1e-9))); }
    else { lbl = 'COUNT'; num = '✓'; }
    setHtml($('clockLbl'), lbl);
    setHtml($('clockNum'), num);
    setCls(clock, 'hurry', v.phase === 'observe' && v.timeLeft <= SPOT.RULES.finalCountdown);
    setCls(clock, 'asking', v.phase === 'answer');
    const an = ANIMAL[v.animal];
    setHtml($('roundInfo'), `${v.sky === 'night' ? '🌙 NIGHT' : '☀️ DAY'} · ${an.emoji} ${an.many} · ${DIFF[v.difficulty]}`);
    const revealDone = st.reveal && st.reveal.stamped;
    // your brother's button and bar: the ring shows his time left (VS Computer) or the high five's rest (two players)
    const bud = $('budBtn');
    if (S.mode === 'cpu') {
      const B = v.buddy;
      bud.style.setProperty('--fill', B ? (B.left / B.visit).toFixed(3) : '1');
      setCls(bud, 'on', !!(B && B.here));
      setCls(bud, 'rest', false);
      setCls(bud.querySelector('.sv'), 'used', !!(B && B.here && !B.save));
      const bar = $('budBar');
      setCls(bar, 'hidden', !B || !B.here || portrait || short);
      if (B) { bar.querySelector('i').style.setProperty('--fill', (B.left / B.visit).toFixed(3)); setCls(bar.querySelector('em'), 'used', !B.save); }
    } else if (v.cheer) {
      const c = v.cheer;
      bud.style.setProperty('--fill', c.rest > 0 ? (1 - c.rest / c.restMax).toFixed(3) : '1');
      setCls(bud, 'rest', !c.ready);
      setCls(bud, 'on', S.players.some((P) => P.spotT > 0));
    }
    S.players.forEach((P, i) => {
      const p = v.players[i], card = $('card' + i);
      // a dot per round: yellow = won, grey = draw
      const dots = [];
      for (let r = 0; r < v.rounds; r++) {
        const res = S.results[r];
        const shown = res && (r < S.results.length - 1 || v.phase !== 'result' || revealDone);
        dots.push(`<i class="${shown ? (res.winner === i ? 'on' : res.winner === null ? 'draw' : '') : ''}"></i>`);
      }
      const pts = v.phase === 'result' && !revealDone ? v.scores[i] - (S.results.length && S.results[S.results.length - 1].winner === i ? 1 : 0) : v.scores[i];
      setHtml(card.querySelector('.pts'), dots.join('') + `<b>${pts}</b>`);
      setCls(card, 'win', v.phase === 'result' && revealDone && v.result && v.result.winner === i);
      // the power button: a ring shows what's left of the freeze / spotlight, or the recharge
      const pow = $('pow' + i), pw = p.power;
      if (pw.kind) {
        let fill = 1, em = 'READY', cls = '';
        if (v.phase !== 'observe') { fill = 0; em = ''; cls = 'cool'; }
        else if (pw.active) { fill = pw.activeLeft / pw.dur; em = 'ON!'; cls = 'on'; }
        else if (pw.dayOnly) { fill = 0; em = '🌙 NIGHT ONLY'; cls = 'day'; }
        else if (pw.coolLeft > 0) { fill = 1 - pw.coolLeft / pw.cool; em = `${Math.ceil(pw.coolLeft)} s`; cls = 'cool'; }
        pow.style.setProperty('--fill', fill.toFixed(3));
        setHtml(pow.querySelector('em'), P.human || cls === 'on' ? em : '🤖');
        setCls(pow, 'on', cls === 'on');
        setCls(pow, 'cool', cls === 'cool');
        setCls(pow, 'day', cls === 'day');
      }
      // the hidden clicker (two players on a keyboard)
      const clk = $('clk' + i);
      setCls(clk, 'bump', st.time - clickBump[i] < 0.12);
      clk.style.visibility = (v.phase === 'observe' || v.phase === 'answer') && !p.locked ? 'visible' : 'hidden';
      // the answer box
      const ask = $('ask' + i);
      const asking = v.phase === 'answer';
      setCls(ask, 'hidden', !asking);
      if (asking) {
        setHtml(ask.querySelector('.q'), `HOW MANY ${an.many}?`);
        const box = ask.querySelector('.ansbox');
        let txt, bc = '';
        if (p.locked) { txt = '✓ LOCKED'; bc = 'locked'; }
        else if (!p.human) { txt = '🤖 …'; bc = 'cpu'; }
        else if (S.mode === '2p') { txt = '●●'; bc = 'masked'; }
        else txt = p.entry === null ? '?' : `${p.entry}${p.pending ? '_' : ''}`;
        setHtml(box, txt);
        box.className = 'ansbox ' + bc;
        setHtml(ask.querySelector('.left b'), String(Math.max(0, Math.ceil(v.timeLeft - 1e-9))));
        const grid = ask.querySelector('.grid');
        setCls(grid, 'hidden', !p.human || p.locked);
        if (S.mode === 'cpu' && p.human) grids[i].forEach((b, n) => setCls(b, 'sel', p.entry === n));
        let hint;
        if (!p.human) hint = p.locked ? 'the computer has answered' : 'the computer is thinking';
        else if (p.locked) hint = S.mode === '2p' ? 'hidden until both are in' : st.shouted ? `🛡️ ${nameOf(v.buddy ? v.buddy.kind : 'tommy')} ANSWERED FOR YOU!` : 'locked in!';
        else if (isTouch) hint = 'tap your number';
        else if (S.mode === '2p') hint = i ? '↑ ↓ to fix your count · → or Enter to lock' : 'W S to fix your count · D or Space to lock';
        else hint = 'type the number, or click it';
        setHtml(ask.querySelector('.hint'), hint);
      }
      // the stamp after the reveal
      const stamp = $('stamp' + i);
      const stampOn = v.phase === 'result' && revealDone;
      setCls(stamp, 'hidden', !stampOn);
      if (stampOn) {
        const bk = S.mode === 'cpu' ? nameOf(v.buddy ? v.buddy.kind : buddyFor(S.lookOf(P.char))) : '';
        const said = p.saved ? `<span>🛡️ ${bk} SAVED YOU!</span>` : p.answer === null ? 'NO ANSWER' : `SAID <b>${p.answer}</b>`;
        setHtml(stamp, `<span class="big2">${p.correct ? '✅' : '❌'}</span><span class="tx">THERE WERE <b>${p.count}</b> ${an.emoji}<br>${said}</span>`);
        stamp.className = 'stamp ' + (p.correct ? 'right' : 'wrong');
      }
    });
    // the round's result in the middle
    const res = $('result');
    const showRes = v.phase === 'result' && revealDone;
    setCls(res, 'hidden', !showRes);
    if (showRes) {
      const r = v.result;
      const names = S.mode === 'cpu' ? ['YOU', 'THE COMPUTER'] : ['PLAYER 1', 'PLAYER 2'];
      let verdict;
      if (r.winner !== null) verdict = S.mode === 'cpu' ? (r.winner === 0 ? 'YOU WIN THE ROUND!' : 'THE COMPUTER WINS THE ROUND!') : `${names[r.winner]} WINS THE ROUND!`;
      else verdict = r.why === 'bothRight' ? 'BOTH RIGHT: A DRAW!' : 'NOBODY GOT IT: A DRAW!';
      setHtml($('verdict'), verdict);
      for (let i = 0; i < 2; i++) {
        setHtml($('resC' + i), String(r.counts[i]));
        setHtml($('resA' + i), r.saved[i] ? `${r.yours[i] === null ? '—' : r.yours[i]} → ${r.answers[i]} 🛡️` : r.answers[i] === null ? '—' : String(r.answers[i]));
        setHtml($('resR' + i), r.saved[i] ? '🛡️ Saved!' : r.correct[i] ? '✅ Correct' : r.answers[i] === null ? '⏰ No answer' : '❌ Incorrect');
      }
      setHtml($('resScore'), `SCORE ${v.scores[0]} – ${v.scores[1]} · ROUND ${v.round} OF ${v.rounds}`);
      setHtml($('nextBtn'), v.round >= v.rounds ? 'FINAL SCORE ▶' : 'NEXT ROUND ▶');
    }
  }

  // ---------------------------------------------------------------- what happens on the rules' events

  function startReveal(S) {
    const order = S.players.map((P) => P.field.animals.map((a, k) => k).sort((a, b) => {
      const A1 = P.field.animals[a], B1 = P.field.animals[b];
      return Math.round(A1.z / 2.4) - Math.round(B1.z / 2.4) || A1.x - B1.x;
    }));
    st.reveal = { t: 0, order, shown: [0, 0], stamped: false };
    hideBadges();
  }
  function updateReveal(dt) {
    const R = st.reveal, S = st.match;
    if (!R || !S) return;
    R.t += dt;
    if (R.t > 0.25) st.lensTarget = [1, 1];
    const step = (n) => clamp(2.4 / Math.max(1, n), 0.07, 0.2);
    let pip = -1, end = 0;
    for (let i = 0; i < 2; i++) {
      const f = S.players[i].field, n = R.order[i].length, sp = step(n);
      end = Math.max(end, 0.5 + n * sp);
      const want = clamp(Math.floor((R.t - 0.5) / sp) + 1, 0, n);
      while (R.shown[i] < want) {
        const k = R.order[i][R.shown[i]];
        const b = badge(i, R.shown[i]);
        b.material.map = A.badgeTexture(R.shown[i] + 1);
        b.material.needsUpdate = true;
        b.visible = true;
        b.userData = { a: f.animals[k], born: R.t, top: (fieldViews[i].list[k] || { top: 1.4 }).top };
        R.shown[i]++;
        pip = Math.max(pip, R.shown[i]);
      }
      for (let k = 0; k < R.shown[i]; k++) {
        const b = badges[i][k], d = b.userData;
        const age = R.t - d.born, s = 1.25 * (1 + 0.6 * Math.max(0, 1 - age / 0.16));
        b.position.set(A.FX[i] + d.a.x, d.top + 0.55, d.a.z);
        b.scale.set(s, s, 1);
      }
    }
    if (pip > 0) SFX.pip(pip);
    if (!R.stamped && R.t > end + 0.35) {
      R.stamped = true;
      const r = S.results[S.results.length - 1];
      if (r.winner === null) (r.why === 'bothRight' ? SFX.right : SFX.draw).call(SFX);
      else if (S.mode === 'cpu' && r.winner === 1) SFX.wrong();
      else SFX.right();
      if (r.winner !== null) { const i = r.winner; for (let k = 0; k < 14; k++) fx.spark(i, A.FX[i] + (Math.random() - 0.5) * 10, 1 + Math.random() * 3, (Math.random() - 0.5) * 6, k % 2 ? '#ffd400' : '#ffffff', { vy: 1.5, life: 1, size: 0.5 }); }
    }
  }

  function onEvent(e, S) {
    const i = e.i;
    switch (e.type) {
      case 'round': {
        st.lensTarget = [0, 0];
        st.reveal = null;
        st.shouted = false;
        hideBadges();
        clearToasts();
        const an = ANIMAL[e.animal];
        banner(`ROUND ${e.round} OF ${e.rounds}<small>count the ${an.many}! ${an.emoji} · ${e.sky === 'night' ? '🌙 NIGHT' : '☀️ DAY'}</small>`, C.timing.roundBanner + 0.1);
        document.body.classList.toggle('night', e.sky === 'night');
        SFX.roundStart();
        maskKey[0] = maskKey[1] = '';
        break;
      }
      case 'count': banner(String(e.n), 0.95, 'num'); SFX.beep(e.n); break;
      case 'go': banner('GO!', 0.8, 'num go'); SFX.go(); SFX.lens(); st.lensTarget = [1, 1]; st.ambientT = 2 + Math.random() * 3; break;
      case 'final': SFX.tick(e.n); break;
      case 'answer': st.lensTarget = [0, 0]; SFX.shut(); break;
      case 'power': {
        const P = S.players[i];
        if (e.kind === 'freeze') { SFX.freeze(); ptoast(i, '❄️ FREEZE!', 'ice'); }
        else { SFX.heli(C.characters.pilot.durationSeconds); ptoast(i, '🚁 SPOTLIGHT!', 'sun'); }
        void P;
        break;
      }
      case 'powerEnd': if (e.kind === 'freeze') SFX.thaw(); break;
      case 'powerReady': if (S.players[i].human) { SFX.ready(); ptoast(i, `${CHAR[S.players[i].char].emoji} READY`, '', 1.1); } break;
      case 'refuse': {
        if (!S.players[i] || !S.players[i].human) break;
        const P = S.players[i];
        if (e.why === 'day') { ptoast(i, '🌙 NIGHT ONLY', 'no'); nudge($('pow' + i)); SFX.nope(); }
        else if (e.why === 'cooling') { ptoast(i, `⏳ ${Math.ceil(P.power.coolT)} s`, 'no', 1); nudge($('pow' + i)); SFX.nope(); }
        else if (e.why === 'passive') { ptoast(i, '🔭 ALWAYS ON!', '', 1.1); }
        else if (e.why === 'empty') { ptoast(i, 'TYPE A NUMBER FIRST', 'no', 1.1); SFX.nope(); }
        break;
      }
      case 'click': clickBump[i] = st.time; if (S.mode === 'cpu') SFX.clicker(); break;
      case 'typed': SFX.typed(); break;
      case 'lock': SFX.lock(); break;
      case 'reveal': startReveal(S); break;
      case 'matchEnd': showFinal(e); break;
      // your brother
      case 'buddyHello': {
        SFX.hello();
        showPip([e.who], [Kit.roster.signature(Kit.roster.get(e.who), 'hello')], C.companion.helloSeconds + C.companion.treatFlySeconds + 0.5, true);
        if (S.phase === 'observe') { ptoast(0, `👀 ${nameOf(e.who)} IS SPOTTING!`, 'sun', 1.8); SFX.spot(); }
        break;
      }
      case 'treat':
        st.pip.modes = ['wave'];
        st.pendingTreat = e;
        flyTreat(e.emoji);
        break;
      case 'treatGot':
        if (st.pendingTreat) { ptoast(0, `${st.pendingTreat.emoji} ${st.pendingTreat.name} FROM ${nameOf(e.who)}!`, 'sun', 2.2); SFX.treat(); st.pendingTreat = null; }
        st.pip.modes = ['look'];
        break;
      case 'buddyBye': showPip([e.who], [Kit.roster.signature(Kit.roster.get(e.who), 'goodbye')], C.companion.byeSeconds, true); break;
      case 'buddySave':
        if (e.how === 'answer') st.shouted = true;
        ptoast(0, `${nameOf(e.who)} SAVED YOU!`, 'save', 2.2);
        SFX.save();
        showPip([e.who], [Kit.roster.signature(Kit.roster.get(e.who), 'hello')], 1.8, true);
        break;
      case 'highFive': {
        const looks = S.players.map((P) => CHAR[P.char].look);
        showPip(looks, looks.map((id) => Kit.roster.signature(Kit.roster.get(id), 'hello')), 2.3, true);
        SFX.cheer();
        SFX.spot();
        // each gets a treat from the other one, and both spot their own hiding animals
        e.treats.forEach((t, i) => { ptoast(i, `${t.emoji} ${t.name} FROM ${CHAR[S.players[1 - i].char].name}!`, 'sun', 2.2); ptoast(i, '👀 SPOT THE HIDING ONES!', '', 1.8); });
        break;
      }
      case 'cheerNo': nudge($('budBtn')); SFX.nope(); break;
    }
  }

  // ---------------------------------------------------------------- input

  const P1KEYS = { KeyW: 'up', KeyS: 'down', KeyA: 'power', KeyD: 'lock', Space: 'action' };
  const P2KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'power', ArrowRight: 'lock', Enter: 'action', NumpadEnter: 'action' };
  const firstGesture = () => {
    const was = Kit.sound.isRunning && Kit.sound.isRunning();
    Kit.sound.init();
    if (!was) Kit.sound.music(st.mode === 'match' ? 'over' : 'title');
  };
  function usePower(i) {
    const S = st.match;
    if (!S || !S.players[i].human) return;
    S.usePower(i);
  }
  function canNext() { return st.match && st.match.phase === 'result' && st.reveal && st.reveal.stamped; }
  function next() { if (canNext()) { SFX.click(); st.match.next(); } }

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    const S = st.match;
    if (st.mode === 'match' && S) {
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      if (c === 'KeyT') { e.preventDefault(); if (!e.repeat) callBuddy(); return; }
      if (S.phase === 'result' || S.phase === 'final') {
        if (c === 'Enter' || c === 'Space' || c === 'KeyN' || c === 'NumpadEnter') { e.preventDefault(); next(); }
        return;
      }
      const two = S.mode === '2p';
      const dig = /^(?:Digit|Numpad)([0-9])$/.exec(c);
      if (dig && !two) { e.preventDefault(); if (!e.repeat) S.typeDigit(0, Number(dig[1])); return; }
      if (c === 'Backspace' && !two) { e.preventDefault(); S.backspace(0); return; }
      let i = -1, act = null;
      if (c in P1KEYS) { i = 0; act = P1KEYS[c]; }
      else if (c in P2KEYS) { i = 1; act = P2KEYS[c]; }
      if (i < 0) return;
      if (!two) i = 0; // against the computer every key is yours
      e.preventDefault();
      if (e.repeat) return; // one press = one animal
      if (act === 'up') S.adjust(i, 1);
      else if (act === 'down') S.adjust(i, -1);
      else if (act === 'power') usePower(i);
      else if (act === 'lock') S.lock(i);
      else if (act === 'action') { if (S.phase === 'answer') S.lock(i); else usePower(i); }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') startMatch();
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Enter' || c === 'Space') { e.preventDefault(); openSetup(); }
      else if (c === 'KeyC') openChars();
      else if (c === 'KeyS') openSettings();
      return;
    }
    if (st.mode === 'setup') {
      if (c === 'Enter') { e.preventDefault(); startMatch(); }
      else if (c === 'Escape' || c === 'Backspace') toMenu();
      else if (c === 'Digit1' || c === 'Numpad1') setMode2('2p');
      else if (c === 'Digit2' || c === 'Numpad2') setMode2('cpu');
      return;
    }
    if (st.mode === 'chars' || st.mode === 'settings') {
      if (c === 'Escape' || c === 'Backspace' || c === 'Enter') { e.preventDefault(); toMenu(); }
      return;
    }
    if (st.mode === 'final') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 1) { e.preventDefault(); startMatch(); }
      else if (c === 'Escape') toMenu();
    }
  });

  [0, 1].forEach((i) => {
    const el = $('pow' + i);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      firstGesture();
      el.classList.add('down');
      setTimeout(() => el.classList.remove('down'), 120);
      if (st.mode === 'match') usePower(i);
    });
  });
  $('nextBtn').addEventListener('click', next);
  // your brother: VS Computer calls him (as often as you like), two players high-five
  function callBuddy() {
    const S = st.match;
    if (!S || st.mode !== 'match') return;
    S.callBuddy();
  }
  $('budBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    firstGesture();
    const el = $('budBtn');
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 120);
    callBuddy();
  });

  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    refreshMute();
  }
  function refreshMute() {
    const m = Kit.sound.isMuted();
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
    $('soundBtn').textContent = m ? '🔇 OFF' : '🔊 ON';
  }
  document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', toggleMute));
  $('soundBtn').addEventListener('click', toggleMute);
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- modes and screens

  const SCREENS = ['title', 'setup', 'chars', 'settings', 'pause', 'final'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    $('hud').classList.toggle('hidden', m !== 'match');
    document.body.classList.toggle('playing', m === 'match' || m === 'pause');
    if (m !== 'match' && m !== 'pause') document.body.classList.remove('night');
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
    layout();
  }

  function startMatch(o = {}) {
    firstGesture();
    SFX.click();
    fixChars();
    const chars = o.chars || settings.chars;
    st.match = new M.Match({
      mode: o.mode || settings.mode, difficulty: o.difficulty || settings.difficulty, sky: o.sky || settings.sky,
      chars, seed: o.seed, bothWrong: o.bothWrong || settings.bothWrong, cfg: o.cfg, buddyFor,
    });
    st.demo = null;
    st.final = null;
    st.reveal = null;
    st.acc = 0;
    st.lensOpen = [0, 0];
    st.lensTarget = [0, 0];
    st.litK = [0, 0];
    st.frostK = [0, 0];
    st.revealK = 0;
    st.pip.until = 0;
    st.treatFly = null;
    st.shouted = false;
    st.pendingTreat = null;
    fx.clear();
    hideBadges();
    clearToasts();
    for (const H of helis) if (H) { H.k = 0; H.t = 0; A.updateHeli(H, 0, C.lens.radius, false, 1); }
    // the first round's event is already waiting in the match: it shows the ROUND 1 OF 5 banner
    setupHud();
    show(null);
    setMode('match');
    st.view = st.match.view();
    updateHud();
    Kit.sound.music('over');
  }

  function pause() {
    if (st.mode !== 'match') return;
    setMode('pause');
    show('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    show(null);
    setMode('match');
    Kit.sound.music('over');
  }

  function startDemo() {
    st.demo = new M.Match({ mode: 'demo', difficulty: 'hard', sky: 'day', chars: ['teddy', 'tommy'], autoNext: 1.5 });
    st.demo.events.length = 0;
  }
  // back on the menus: the brothers look through their binoculars at a fresh demo
  function menuStage() {
    if (st.mode === 'title' || st.mode === 'setup' || st.mode === 'chars' || st.mode === 'settings') return;
    st.match = null;
    st.final = null;
    fx.clear();
    hideBadges();
    clearToasts();
    if (!st.demo) startDemo();
    setStage(['teddy', 'tommy'], ['look', 'look']);
  }
  function toMenu() {
    menuStage();
    show('title');
    setMode('title');
    Kit.sound.music('title');
  }

  // ---- setup: who's playing, how hard, day or night, and characters

  function chipHtml(id, i) {
    const ch = CHAR[id], have = owned(id);
    const next = M.progress.next(prog, C);
    const lock = !have && next && next.id === id ? `🔒 ${next.left} more win${next.left === 1 ? '' : 's'}` : '🔒 locked';
    return `<button class="chip${have ? '' : ' locked'}" role="radio" data-pick="${i}:${id}" aria-checked="${settings.chars[i] === id}">` +
      `<img alt="" class="${id}" src="${faceOf(id)}"><span><b>${ch.name}</b><small>${have ? `${ch.emoji} ${ch.power}` : lock}</small></span></button>`;
  }
  function refreshSetup() {
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode)));
    document.querySelectorAll('[data-diff]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.diff === settings.difficulty)));
    document.querySelectorAll('[data-sky]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sky === settings.sky)));
    $('pickLbl0').textContent = settings.mode === 'cpu' ? 'YOU' : 'PLAYER 1';
    $('pickLbl1').textContent = settings.mode === 'cpu' ? 'COMPUTER' : 'PLAYER 2';
    for (let i = 0; i < 2; i++) $('chips' + i).innerHTML = Object.keys(CHAR).map((id) => chipHtml(id, i)).join('');
  }
  function setMode2(m) { settings.mode = m; saveSettings(); refreshSetup(); SFX.click(); }
  function openSetup() { firstGesture(); SFX.click(); menuStage(); fixChars(); refreshSetup(); show('setup'); setMode('setup'); }

  function openChars() {
    firstGesture();
    SFX.click();
    menuStage();
    const next = M.progress.next(prog, C);
    const cards = Object.keys(CHAR).map((id) => {
      const ch = CHAR[id], have = owned(id);
      const lock = have ? '' : `<span class="lk">🔒 ${next && next.id === id ? `win ${next.left} more game${next.left === 1 ? '' : 's'}` : 'locked'}</span>`;
      return `<div class="ccard${have ? '' : ' locked'}"><img alt="" class="${id}" src="${faceOf(id)}"><b>${ch.name}</b><span class="pw">${ch.emoji} ${ch.power}</span><p>${charDesc(id)}</p>${lock}</div>`;
    });
    for (const id of C.roster.mystery) {
      if (!faces[id]) continue;
      cards.push(`<div class="ccard myst"><img alt="" class="myst" src="${faces[id]}"><b>???</b><span class="pw">❓ ???</span><p>Coming soon: Teddy is still inventing this power.</p></div>`);
    }
    $('charCards').innerHTML = cards.join('');
    $('charProgress').textContent = `🏆 Games won: ${prog.wins}` + (next ? ` · ${next.left} more to unlock ${CHAR[next.id].name}` : ' · every character unlocked!');
    show('chars');
    setMode('chars');
  }

  function openSettings() {
    firstGesture();
    SFX.click();
    menuStage();
    refreshSettings();
    show('settings');
    setMode('settings');
  }
  function refreshSettings() {
    document.querySelectorAll('[data-bw]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.bw === settings.bothWrong)));
    refreshMute();
    const ch = C.characters, u = C.roster.unlocks[0];
    $('proposals').innerHTML = `<b>Ideas Teddy hasn't decided yet</b> (grown-ups can change them in js/config.js): ` +
      `Freeze lasts ${ch.tommy.freezeDurationSeconds} s, then ${ch.tommy.cooldownSeconds} s to recharge · ` +
      `the helicopter shines ${ch.pilot.durationSeconds} s, then ${ch.pilot.cooldownSeconds} s, night only · ` +
      `Teddy's binoculars are ${ch.teddy.viewMultiplier}× bigger · ` +
      `about 1 round in ${Math.round(1 / C.animals.zeroProbability)} has an empty field · ` +
      `the computer is right ${Math.round(C.cpu.accuracy.easy * 100)}% / ${Math.round(C.cpu.accuracy.medium * 100)}% / ${Math.round(C.cpu.accuracy.hard * 100)}% of the time · ` +
      `${u ? `${u.wins} wins unlock ${CHAR[u.id].name} the pilot` : ''}.`;
    // the same in 中文, swapped in by Kit.lang (data-zh carries the whole translation)
    $('proposals').setAttribute('data-zh', `<b>Teddy 还没决定的点子</b>（大人可以在 js/config.js 里改）：` +
      `冻住 ${ch.tommy.freezeDurationSeconds} 秒，然后等 ${ch.tommy.cooldownSeconds} 秒 · ` +
      `直升机照 ${ch.pilot.durationSeconds} 秒，然后等 ${ch.pilot.cooldownSeconds} 秒，只能晚上用 · ` +
      `Teddy 的望远镜大 ${ch.teddy.viewMultiplier} 倍 · 大约 ${Math.round(1 / C.animals.zeroProbability)} 轮里有 1 轮田里一只都没有 · ` +
      `电脑答对 ${Math.round(C.cpu.accuracy.easy * 100)}% / ${Math.round(C.cpu.accuracy.medium * 100)}% / ${Math.round(C.cpu.accuracy.hard * 100)}% · ` +
      `${u ? `赢 ${u.wins} 局解锁飞行员 ${CHAR[u.id].name}` : ''}。`);
  }

  // ---- the final score

  function showFinal(f) {
    const S = st.match;
    const rec = M.progress.record(prog, C, f, S.mode);
    M.progress.save(ls, prog);
    st.final = { f, rec };
    const names = S.mode === 'cpu' ? ['YOU', 'COMPUTER'] : ['PLAYER 1', 'PLAYER 2'];
    const chars = S.players.map((P) => CHAR[P.char]);
    let title, sub;
    if (f.winner === null) { title = "IT'S A DRAW!"; sub = `${f.scores[0]} – ${f.scores[1]} after ${S.rounds} rounds`; }
    else if (S.mode === 'cpu' && f.winner === 1) { title = 'THE COMPUTER WINS!'; sub = `${f.scores[0]} – ${f.scores[1]} · try again!`; }
    else { title = 'WINNER!'; sub = `${S.mode === 'cpu' ? 'YOU' : `${names[f.winner]} (${chars[f.winner].name})`} · ${f.scores[0]} – ${f.scores[1]}`; }
    $('finalTitle').textContent = title;
    $('finalSub').textContent = sub;
    const nSaves = f.results.filter((r) => r.saved[0]).length;
    const fs = $('finalSaves');
    fs.classList.toggle('hidden', !(S.mode === 'cpu' && nSaves));
    if (S.mode === 'cpu' && nSaves) fs.textContent = `🛡️ ${nameOf(buddyFor(S.lookOf(S.players[0].char)))} SAVED YOU ${nSaves} TIME${nSaves === 1 ? '' : 'S'}!`;
    const rows = [`<span></span><span class="h p0">${names[0]}</span><span class="h p1">${names[1]}</span>`];
    f.results.forEach((r, k) => {
      const cell = (i) => `${r.saved[i] ? '🛡️' : r.correct[i] ? '✅' : '❌'} ${r.answers[i] === null ? '—' : r.answers[i]} / ${r.counts[i]}`;
      rows.push(`<span>${k + 1}. ${ANIMAL[r.animal].emoji}${r.sky === 'night' ? '🌙' : ''}</span><span>${cell(0)}</span><span>${cell(1)}</span>`);
    });
    rows.push(`<span class="h">TOTAL</span><span class="tot">${f.scores[0]}</span><span class="tot">${f.scores[1]}</span>`);
    const grid = $('finalGrid');
    grid.style.gridTemplateColumns = 'auto auto auto';
    grid.innerHTML = rows.join('');
    const un = $('finalUnlock');
    const next = M.progress.next(prog, C);
    un.classList.toggle('new', rec.newly.length > 0);
    if (rec.newly.length) un.textContent = `🔓 NEW CHARACTER: ${rec.newly.map((id) => `${CHAR[id].emoji} ${CHAR[id].name} THE HELICOPTER PILOT`).join(', ')}!`;
    else if (next) un.textContent = `🏆 Games won: ${prog.wins} · ${next.left} more win${next.left === 1 ? '' : 's'} to unlock ${CHAR[next.id].emoji} ${CHAR[next.id].name}`;
    else un.textContent = `🏆 Games won: ${prog.wins} · every character unlocked!`;
    // on the farm: the winner does his move, the other one waves (both celebrate a draw)
    const ids = S.players.map((P) => CHAR[P.char].look);
    const modes = [0, 1].map((i) => (f.winner === null || f.winner === i ? 'cheer' : 'wave'));
    setStage(ids, modes);
    hideBadges();
    st.reveal = null;
    startDemo();
    fx.confettiBurst(f.winner === 1 ? 4 : f.winner === 0 ? -4 : 0, 5, 12, 90);
    SFX.fanfare();
    if (rec.newly.length) setTimeout(() => SFX.unlock(), 1300);
    show('final');
    setMode('final');
    Kit.sound.music('title');
  }

  function setupMenus() {
    const m = /^(.*\bTT\b)\s+(.+)$/.exec(SPOT.TITLE);
    const color = (s) => s.replace(/TT/, '<span class="a">T</span><span class="b">T</span>');
    $('logoMain').innerHTML = color(m ? m[1] : SPOT.TITLE);
    $('logoSub').textContent = m ? m[2] : '';
    document.title = `${SPOT.TITLE} · Teddy & Tommy`;
    document.querySelectorAll('[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });
    $('playBtn').addEventListener('click', openSetup);
    $('charsBtn').addEventListener('click', openChars);
    $('settingsBtn').addEventListener('click', openSettings);
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode2(b.dataset.mode)));
    document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); refreshSetup(); SFX.click(); }));
    document.querySelectorAll('[data-sky]').forEach((b) => b.addEventListener('click', () => { settings.sky = b.dataset.sky; saveSettings(); refreshSetup(); SFX.click(); }));
    $('setup').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const [i, id] = b.dataset.pick.split(':');
      if (!owned(id)) { nudge(b); SFX.nope(); return; }
      settings.chars[Number(i)] = id;
      saveSettings();
      refreshSetup();
      SFX.click();
    });
    $('goBtn').addEventListener('click', () => startMatch());
    $('setupBack').addEventListener('click', toMenu);
    $('charsBack').addEventListener('click', toMenu);
    $('settingsBack').addEventListener('click', toMenu);
    document.querySelectorAll('[data-bw]').forEach((b) => b.addEventListener('click', () => { settings.bothWrong = b.dataset.bw; saveSettings(); refreshSettings(); SFX.click(); }));
    $('unlockAll').addEventListener('click', () => { for (const u of C.roster.unlocks) if (!owned(u.id)) prog.unlocked.push(u.id); M.progress.save(ls, prog); SFX.unlock(); refreshSettings(); });
    $('resetProg').addEventListener('click', () => { prog = M.progress.blank(); M.progress.save(ls, prog); fixChars(); saveSettings(); SFX.click(); refreshSettings(); });
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => startMatch());
    $('quitBtn').addEventListener('click', toMenu);
    $('againBtn').addEventListener('click', () => startMatch());
    $('finalMenu').addEventListener('click', toMenu);
  }

  // ---------------------------------------------------------------- main loop

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    const S = st.match;
    if (S && st.mode === 'match') {
      st.acc += dt;
      let n = 0;
      while (st.acc >= DT - 1e-9 && n++ < 8) {
        S.step(DT);
        st.acc -= DT;
        for (const e of S.events) onEvent(e, S);
        S.events.length = 0;
      }
      if (st.acc > DT) st.acc = 0;
      for (const e of S.events) onEvent(e, S); // from next() between ticks
      S.events.length = 0;
    } else if (st.demo && st.mode !== 'pause') {
      st.demo.step(dt);
      st.demo.events.length = 0;
      if (st.demo.phase === 'final') startDemo();
    }
    const W = cur();
    syncAnimals(W, dt);
    for (let i = 0; i < 2; i++) {
      st.lensOpen[i] = approach(st.lensOpen[i], st.lensTarget[i], dt / 0.3);
      const P = W ? W.players[i] : null;
      st.litK[i] = approach(st.litK[i], P && P.lit ? 1 : 0, dt * 2.5);
      st.frostK[i] = approach(st.frostK[i], P && P.field.frozen ? 1 : 0, dt * (P && P.field.frozen ? 5 : 2));
      tintField(i, st.frostK[i]);
      if (helis[i] || (P && P.char === 'pilot')) {
        const H = heli(i);
        A.updateHeli(H, i, W ? W.lensFor(i) : C.lens.radius, !!(P && P.lit) && st.mode !== 'final', dt);
      }
    }
    // little ice sparkles over a frozen field
    st.sparkT -= dt;
    if (st.sparkT <= 0 && W) {
      st.sparkT = 0.08;
      for (let i = 0; i < 2; i++) {
        const f = W.players[i].field;
        if (!f.frozen || !f.animals.length) continue;
        const a = f.animals[(Math.random() * f.animals.length) | 0];
        fx.spark(i, A.FX[i] + a.x + (Math.random() - 0.5), 0.4 + Math.random() * 1.2, a.z + (Math.random() - 0.5), '#c8f4ff', { vy: 0.5, life: 0.8, size: 0.4 });
      }
    }
    updateReveal(dt);
    // after the count, the binoculars come away so you can see the whole field, even the ones that were hiding
    const showAll = !!(S && st.mode !== 'title' && S.phase === 'result' && st.reveal && st.reveal.t > 0.3);
    st.revealK = approach(st.revealK, showAll ? 1 : 0, dt / 0.5);
    for (const mk of masks) mk.style.opacity = String(1 - 0.88 * smooth(st.revealK));
    updateKids(dt);
    // a moo or a cluck now and then while you count (never one per animal)
    if (S && st.mode === 'match' && S.phase === 'observe') {
      st.ambientT -= dt;
      if (st.ambientT <= 0) { SFX.animal(S.roundInfo.type); st.ambientT = 4 + Math.random() * 5; }
    }
    fx.update(dt);
    if (st.mode === 'match' || st.mode === 'pause') updateHud();
    updatePip(dt);
    updateTreatFly();
    updateSpots();
    updateToasts();
    updateBanner();
    paintMasks();
  }

  const CLEAR_TITLE = new T.Color('#9ed8ff');
  function render() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    if (st.mode === 'match' || st.mode === 'pause') {
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      scene.fog = null;
      const v = st.view || (st.match && st.match.view());
      if (!v) return;
      renderer.setScissorTest(true);
      for (let i = 0; i < 2; i++) {
        const r = rects[i], y = h - r.y - r.h;
        renderer.setViewport(r.x, y, r.w, r.h);
        renderer.setScissor(r.x, y, r.w, r.h);
        applyLight(v.sky, st.litK[i]);
        renderer.render(scene, cams[i]);
      }
      renderer.setScissorTest(false);
    } else {
      renderer.setClearColor(CLEAR_TITLE, 1);
      renderer.clear();
      scene.fog = titleFog;
      applyLight('day', 0);
      renderer.render(scene, titleCam);
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  setupMenus();
  refreshMute();
  $('loading').remove();
  startDemo();
  setStage(['teddy', 'tommy'], ['look', 'look']);
  show('title');
  setMode('title');
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = DT) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a match: { mode: '2p' | 'cpu', difficulty: 'easy' | 'medium' | 'hard', sky: 'day' | 'night' | 'mix', chars: ['teddy', 'tommy'], seed }
    start(o = {}) { startMatch(o); return game.state(); },
    state() {
      const S = st.match;
      const v = S ? S.view() : null;
      return {
        screen: st.mode, phase: v && v.phase, round: v && v.round, sky: v && v.sky, animal: v && v.animal,
        timeLeft: v && +v.timeLeft.toFixed(2), scores: v && v.scores,
        players: v && v.players.map((p, i) => ({ char: p.char, human: p.human, lens: +p.lens.toFixed(2), frozen: p.frozen, lit: p.lit, locked: p.locked, entry: p.entry, answer: p.answer, count: p.count, power: { kind: p.power.kind, active: p.power.active, cool: +p.power.coolLeft.toFixed(1), ready: p.power.ready }, visible: S.visibleCount(i) })),
        result: v && v.result, final: v && v.final, progress: prog, buddy: v && v.buddy, cheer: v && v.cheer,
        spotted: S ? [0, 1].map((i) => S.spotted(i).length) : null,
      };
    },
    // the real counts, for tests only (the screen never shows them before the reveal)
    counts() { const S = st.match; return S ? S.players.map((P) => P.field.count) : null; },
    sim: () => st.match,
    power(i = 0) { const S = st.match; return S && S.usePower(i); },
    buddy() { const S = st.match; return S && S.callBuddy(); },
    pick(i, n) { return st.match && st.match.pick(i, n); },
    type(i, d) { return st.match && st.match.typeDigit(i, d); },
    adjust(i, d) { return st.match && st.match.adjust(i, d); },
    lock(i) { return st.match && st.match.lock(i); },
    next() { const S = st.match; if (S && st.reveal) st.reveal.stamped = true; if (S && S.phase === 'result') { S.next(); game.step(DT); } return game.state(); },
    // jump to the last `left` seconds of the observation (default: the end)
    skip(left = 0.02) { const S = st.match; if (S && S.phase === 'ready') S.phaseT = 99; if (S) S.step(DT); if (S && S.phase === 'observe') S.phaseT = Math.max(S.phaseT, S.observeT - left); return game.state(); },
    screen(name) { ({ title: toMenu, setup: openSetup, chars: openChars, settings: openSettings })[name](); return st.mode; },
    menu: toMenu,
    pause, resume,
    unlockAll() { for (const u of C.roster.unlocks) if (!owned(u.id)) prog.unlocked.push(u.id); M.progress.save(ls, prog); return prog; },
    resetProgress() { prog = M.progress.blank(); M.progress.save(ls, prog); fixChars(); return prog; },
    freeze(on = true) { st.frozen = on; },
    keepAwake(on = true) { st.keepAwake = on; },
    check: () => ({ rules: SPOT.check.rules(), sabotage: SPOT.check.sabotage() }),
    soak: (o) => SPOT.check.soak(o),
    layout,
    st,
  };
})();
