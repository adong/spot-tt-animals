/* Spot TT Animals: the pictures. Canvas textures, the farm (two fields side by side with a fence between, corn all
   round, a barn on the hill), the five animals built from boxes, Zoom's helicopter with its spotlight, the brothers
   with their binoculars, the number badges for the count, and the binocular frame painted on a 2D canvas.

   Layers keep the fields apart: the farm is on layer 0, everything in field 0 on layer 1 and field 1 on layer 2.
   Each player's camera sees layer 0 and only its own field's layer. */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const SPOT = window.SPOT;
  const C = SPOT.CONFIG;
  const FW = C.field.width, FD = C.field.depth, GAP = 0.9;
  const FX = [-(FW / 2 + GAP), FW / 2 + GAP]; // world x of each field's middle; the fence is at x = 0
  const TILT = (C.lens.tilt * Math.PI) / 180;
  const tex = {};
  const geoCache = new Map();
  const boxGeo = (w, h, d) => {
    const k = `${w},${h},${d}`;
    if (!geoCache.has(k)) geoCache.set(k, new T.BoxGeometry(w, h, d));
    return geoCache.get(k);
  };
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
  function box(w, h, d, m, x, y, z, parent) {
    const me = new T.Mesh(boxGeo(w, h, d), m);
    me.position.set(x, y, z);
    if (parent) parent.add(me);
    return me;
  }
  function setLayer(obj, n) { obj.traverse((o) => o.layers.set(n)); }
  const rand = (a, b) => a + Math.random() * (b - a);
  const smoothstep = (k) => k * k * (3 - 2 * k);
  // a fixed random stream, so the farm looks the same every time
  let seed = 12345;
  const srand = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };

  // ---------------------------------------------------------------- textures

  function initTextures() {
    // the field: brown soil in rows, with little corn sprouts along them
    let [c, x] = G.makeCanvas(512, 512);
    x.fillStyle = '#93623a';
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(70,40,20,0.18)' : 'rgba(190,140,90,0.16)';
      x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 2 + Math.random() * 3);
    }
    for (let r = 0; r < 8; r++) {
      const y = r * 64 + 32;
      x.fillStyle = 'rgba(60,34,16,0.35)';
      x.fillRect(0, y - 9, 512, 18);
      x.fillStyle = 'rgba(200,150,100,0.25)';
      x.fillRect(0, y + 9, 512, 4);
      for (let k = 0; k < 9; k++) {
        const sx = k * 57 + (r % 2) * 28 + Math.random() * 10, sy = y - 2;
        x.fillStyle = '#3f9a2c';
        x.beginPath(); x.ellipse(sx - 5, sy, 7, 3, -0.5, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.ellipse(sx + 5, sy, 7, 3, 0.5, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#5cc23f';
        x.beginPath(); x.ellipse(sx, sy - 4, 3, 7, 0, 0, Math.PI * 2); x.fill();
      }
    }
    for (let i = 0; i < 40; i++) { // pebbles
      x.fillStyle = 'rgba(220,210,190,0.7)';
      x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 3, 2, 0, 0, Math.PI * 2); x.fill();
    }
    tex.soil = G.toTexture(c);
    tex.soil.wrapS = tex.soil.wrapT = T.RepeatWrapping;

    // grass all round
    [c, x] = G.makeCanvas(256, 256);
    x.fillStyle = '#6cbf45';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,30,0.35)' : 'rgba(170,230,110,0.3)';
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 4 + Math.random() * 4);
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = ['#fff7a8', '#ffffff', '#ffb3d1'][i % 3];
      x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2.5, 0, Math.PI * 2); x.fill();
    }
    tex.grass = G.toTexture(c);
    tex.grass.wrapS = tex.grass.wrapT = T.RepeatWrapping;
    tex.grass.repeat.set(40, 40);

    // cow patches
    [c, x] = G.makeCanvas(256, 256);
    x.fillStyle = '#fbfaf6';
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#1d1b20';
    for (let i = 0; i < 7; i++) {
      const cx = Math.random() * 256, cy = Math.random() * 256, r = 22 + Math.random() * 30;
      x.beginPath();
      for (let a = 0; a <= 12; a++) { const t = (a / 12) * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.45); x[a ? 'lineTo' : 'moveTo'](cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); }
      x.fill();
    }
    tex.cow = G.toTexture(c);

    // fence planks
    [c, x] = G.makeCanvas(128, 32);
    x.fillStyle = '#b07a45';
    x.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(90,50,20,0.35)'; x.fillRect(0, Math.random() * 32, 128, 1.5); }
    x.fillStyle = 'rgba(255,230,190,0.25)';
    x.fillRect(0, 2, 128, 3);
    tex.wood = G.toTexture(c);

    // barn boards
    [c, x] = G.makeCanvas(128, 128);
    x.fillStyle = '#c8392f';
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(80,10,10,0.35)'; x.fillRect(i * 16, 0, 2, 128); }
    tex.barn = G.toTexture(c);

    // a soft blob shadow
    tex.shadow = G.radialTexture(64, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
    tex.glow = G.glowTexture();
    tex.dot = G.dotTexture();
  }

  // the number badges for the count at the end of a round: yellow for the count, made when first needed
  const numberTex = {};
  function badgeTexture(n) {
    if (numberTex[n]) return numberTex[n];
    const [c, x] = G.makeCanvas(128, 128);
    x.fillStyle = '#14121f';
    x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffd400';
    x.beginPath(); x.arc(64, 64, 51, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#14121f';
    x.font = `${n >= 10 ? 58 : 68}px ${G.FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String(n), 64, 70);
    return (numberTex[n] = G.toTexture(c));
  }

  // ---------------------------------------------------------------- the farm

  function makeWorld(scene) {
    const g = new T.Group();
    scene.add(g);
    const grass = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshStandardMaterial({ map: tex.grass, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    g.add(grass);
    for (const fx of FX) {
      const t = tex.soil.clone();
      t.needsUpdate = true;
      t.repeat.set((FW + 1) / 4.5, (FD + 1) / 4.5);
      const soil = new T.Mesh(new T.PlaneGeometry(FW + 1, FD + 1), new T.MeshStandardMaterial({ map: t, roughness: 1 }));
      soil.rotation.x = -Math.PI / 2;
      soil.position.set(fx, 0, 0);
      g.add(soil);
    }
    makeCorn(g);
    makeFences(g);
    makeFarm(g);
    // a few young corn plants inside each field: thin, so they never hide an animal
    const sprout = std('#4caf35'), cob = std('#ffd23f');
    for (const fx of FX) {
      for (let k = 0; k < 9; k++) {
        const p = new T.Group();
        p.position.set(fx + srand(-FW / 2 + 1, FW / 2 - 1), 0, srand(-FD / 2 + 1, FD / 2 - 1));
        box(0.06, 0.75, 0.06, sprout, 0, 0.37, 0, p);
        for (let l = 0; l < 3; l++) { const lf = box(0.38, 0.04, 0.08, sprout, 0.15, 0.25 + l * 0.17, 0, p); lf.rotation.set(0, l * 2.1, -0.5); lf.position.set(Math.cos(l * 2.1) * 0.15, 0.25 + l * 0.17, -Math.sin(l * 2.1) * 0.15); }
        box(0.07, 0.16, 0.07, cob, 0.05, 0.5, 0.03, p);
        p.rotation.y = srand(0, 6);
        g.add(p);
      }
    }
    return { group: g };
  }

  function makeCorn(g) {
    const spots = [];
    const ROW = 0.62;
    // behind both fields (the far side), four rows deep
    for (let r = 0; r < 4; r++) for (let x = -2 * (FW / 2 + GAP) - 3; x <= 2 * (FW / 2 + GAP) + 3; x += ROW) spots.push([x + srand(-0.15, 0.15), -FD / 2 - 0.9 - r * 0.7 + srand(-0.12, 0.12)]);
    // down the outer sides
    for (const side of [-1, 1]) for (let r = 0; r < 4; r++) for (let z = -FD / 2 - 0.4; z <= FD / 2 + 1.2; z += ROW) spots.push([side * (FW + 2 * GAP + 0.3 + r * 0.7) + srand(-0.12, 0.12), z + srand(-0.15, 0.15)]);
    const n = spots.length;
    const stalkM = std('#4f9f33'), leafM = std('#61b83d'), cobM = std('#ffd23f'), tassM = std('#c99a3a');
    const stalk = new T.InstancedMesh(new T.BoxGeometry(0.1, 1, 0.1).translate(0, 0.5, 0), stalkM, n);
    const leaves = new T.InstancedMesh(new T.BoxGeometry(0.62, 0.05, 0.14).translate(0.31, 0, 0), leafM, n * 3);
    const cobs = new T.InstancedMesh(new T.BoxGeometry(0.13, 0.32, 0.13), cobM, n);
    const tass = new T.InstancedMesh(new T.BoxGeometry(0.06, 0.3, 0.06).translate(0, 0.15, 0), tassM, n);
    const o = new T.Object3D();
    spots.forEach(([x, z], i) => {
      const h = srand(1.9, 2.7), ry = srand(0, 6.28);
      o.position.set(x, 0, z); o.rotation.set(srand(-0.05, 0.05), ry, srand(-0.05, 0.05)); o.scale.set(1, h, 1); o.updateMatrix();
      stalk.setMatrixAt(i, o.matrix);
      for (let l = 0; l < 3; l++) {
        o.position.set(x, h * (0.3 + l * 0.2), z); o.rotation.set(0, ry + l * 2.2, -0.45 - srand(0, 0.3)); o.scale.set(1, 1, 1); o.updateMatrix();
        leaves.setMatrixAt(i * 3 + l, o.matrix);
      }
      o.position.set(x + 0.08, h * 0.55, z); o.rotation.set(0, ry, 0.25); o.updateMatrix();
      cobs.setMatrixAt(i, o.matrix);
      o.position.set(x, h, z); o.rotation.set(0, 0, srand(-0.3, 0.3)); o.updateMatrix();
      tass.setMatrixAt(i, o.matrix);
    });
    for (const m of [stalk, leaves, cobs, tass]) { m.instanceMatrix.needsUpdate = true; g.add(m); }
  }

  function makeFence(g, x0, z0, x1, z1, h, m, postM) {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    const posts = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= posts; k++) {
      const t = k / posts;
      box(0.16, h + 0.15, 0.16, postM, x0 + (x1 - x0) * t, (h + 0.15) / 2, z0 + (z1 - z0) * t, g);
    }
    for (const y of h > 0.8 ? [h * 0.45, h * 0.88] : [h * 0.7]) {
      const r = box(0.08, 0.16, len, m, (x0 + x1) / 2, y, (z0 + z1) / 2, g);
      r.rotation.y = ang;
    }
  }
  function makeFences(g) {
    const m = new T.MeshStandardMaterial({ map: tex.wood, roughness: 0.9 });
    const postM = std('#8e5a2e');
    // Teddy's fence: right down the middle, between the two fields
    makeFence(g, 0, -FD / 2 - 0.6, 0, FD / 2 + 0.8, 1.15, m, postM);
    // a low rail along the near edge, so nothing tall stands between you and the animals
    for (const fx of FX) makeFence(g, fx - FW / 2 - 0.5, FD / 2 + 0.8, fx + FW / 2 + 0.5, FD / 2 + 0.8, 0.45, m, postM);
    // a sign on the middle fence post (canvas text, so it asks Kit.lang for its word and redraws on a switch)
    const [c, x] = G.makeCanvas(256, 128);
    const signTex = G.toTexture(c);
    const draw = () => {
      x.clearRect(0, 0, 256, 128);
      x.fillStyle = '#fff3d6'; G.roundRect(x, 6, 6, 244, 116, 18); x.fill();
      x.strokeStyle = '#14121f'; x.lineWidth = 8; G.roundRect(x, 6, 6, 244, 116, 18); x.stroke();
      x.fillStyle = '#14121f'; x.font = `44px ${G.FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(Kit.lang.t('FENCE'), 128, 66);
      signTex.needsUpdate = true;
    };
    draw();
    Kit.lang.onChange(draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    const sign = new T.Mesh(new T.PlaneGeometry(1.4, 0.7), new T.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(0, 1.25, FD / 2 + 0.95);
    g.add(sign);
  }

  function makeFarm(g) {
    // the red barn on the hill behind the corn, a silo, trees and hay bales: for the title screen
    const hill = new T.Mesh(new T.SphereGeometry(30, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ map: tex.grass, roughness: 1 }));
    hill.scale.set(1.6, 0.22, 0.5);
    hill.position.set(-6, -0.3, -30);
    g.add(hill);
    const barn = new T.Group();
    const wall = new T.MeshStandardMaterial({ map: tex.barn, roughness: 0.9 });
    const white = std('#f6f1e6'), roof = std('#5a3b36'), dark = std('#3a2420');
    box(7, 4.2, 5.5, wall, 0, 2.1, 0, barn);
    const r1 = box(4.4, 0.3, 6, roof, -1.75, 5.0, 0, barn); r1.rotation.z = 0.62;
    const r2 = box(4.4, 0.3, 6, roof, 1.75, 5.0, 0, barn); r2.rotation.z = -0.62;
    const gable = new T.Mesh(new T.CylinderGeometry(0.01, 3.7, 2.4, 4, 1), wall);
    gable.rotation.y = Math.PI / 4; gable.scale.set(1, 1, 0.01); gable.position.set(0, 5.3, 2.76); barn.add(gable);
    box(2.6, 3, 0.2, dark, 0, 1.5, 2.78, barn);
    const x1 = box(0.25, 3.6, 0.1, white, 0, 1.5, 2.9, barn); x1.rotation.z = 0.7;
    const x2 = box(0.25, 3.6, 0.1, white, 0, 1.5, 2.9, barn); x2.rotation.z = -0.7;
    box(2.9, 0.22, 0.12, white, 0, 3.05, 2.9, barn);
    box(1.1, 0.9, 0.1, white, 0, 4.7, 2.85, barn);
    barn.position.set(-9, 1.6, -27);
    barn.rotation.y = 0.15;
    g.add(barn);
    const silo = new T.Group();
    const sm = std('#d7dbe0', { roughness: 0.5, metalness: 0.3 });
    const cyl = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 8, 18), sm); cyl.position.y = 4; silo.add(cyl);
    const dome = new T.Mesh(new T.SphereGeometry(1.65, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#c8392f')); dome.position.y = 8; silo.add(dome);
    silo.position.set(-2.5, 1.6, -28.5);
    g.add(silo);
    const trunk = std('#7a4b2a'), leafA = std('#3f9a3a'), leafB = std('#57b84a');
    for (let k = 0; k < 14; k++) {
      const t = new T.Group();
      box(0.5, 2, 0.5, trunk, 0, 1, 0, t);
      const crown = new T.Mesh(new T.IcosahedronGeometry(1.7, 0), k % 2 ? leafA : leafB); crown.position.y = 3; t.add(crown);
      const s = srand(0.8, 1.4);
      t.scale.setScalar(s);
      const side = k % 2 ? 1 : -1;
      t.position.set(side * srand(24, 42), 0, srand(-30, -10));
      g.add(t);
    }
    const hay = std('#e8c25a'), hayEnd = std('#d4a83e');
    for (const [x, z] of [[24, 4], [26, 6], [-25, 5], [-27, 2], [12, -16], [15, -15]]) {
      const b = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 1.3, 14), [hay, hayEnd, hayEnd]);
      b.rotation.z = Math.PI / 2;
      b.position.set(x, 0.9, z);
      g.add(b);
    }
  }

  // ---------------------------------------------------------------- the animals (all face +z; heading turns them)

  // each field has its own materials, so Tommy's freeze can tint only his field
  function animalMats() {
    return {
      cow: { hide: new T.MeshStandardMaterial({ map: tex.cow, roughness: 0.8 }), pink: std('#f2a3a8'), dark: std('#1d1b20'), horn: std('#f3e7c8'), hoof: std('#3b302a') },
      sheep: { wool: std('#f7f3ea', { roughness: 1 }), face: std('#2a2528'), eye: std('#ffffff') },
      chicken: { body: std('#fbfaf5'), wing: std('#e9e6dc'), comb: std('#e8352f'), beak: std('#ffb52e'), leg: std('#f09a2a'), eye: std('#141218') },
      hen: { body: std('#b8642d'), wing: std('#8e4a20'), comb: std('#e8352f'), beak: std('#ffc23e'), leg: std('#e8902a'), eye: std('#141218') },
      rooster: { body: std('#a83a22'), neck: std('#f0a531'), tail: std('#1f4a3a'), tail2: std('#2a7a4f'), comb: std('#ff2a2a'), beak: std('#ffc23e'), leg: std('#e8902a'), eye: std('#141218'), wing: std('#7a2a1a') },
    };
  }
  function legPivot(parent, x, y, z, w, len, m, hoof) {
    const p = new T.Group();
    p.position.set(x, y, z);
    parent.add(p);
    box(w, len, w, m, 0, -len / 2, 0, p);
    if (hoof) box(w * 1.08, 0.1, w * 1.08, hoof, 0, -len + 0.05, 0.01, p);
    return p;
  }
  const BUILD = {
    cow(M) {
      const root = new T.Group(), body = new T.Group();
      root.add(body);
      box(0.86, 0.72, 1.5, M.hide, 0, 0.82, 0, body);
      box(0.32, 0.14, 0.4, M.pink, 0, 0.42, -0.35, body); // udder
      const head = new T.Group();
      head.position.set(0, 1.0, 0.82);
      body.add(head);
      box(0.56, 0.52, 0.5, M.hide, 0, 0, 0.12, head);
      box(0.5, 0.28, 0.22, M.pink, 0, -0.12, 0.42, head);
      box(0.07, 0.07, 0.04, M.dark, -0.12, -0.08, 0.54, head);
      box(0.07, 0.07, 0.04, M.dark, 0.12, -0.08, 0.54, head);
      box(0.09, 0.11, 0.04, M.dark, -0.15, 0.1, 0.38, head);
      box(0.09, 0.11, 0.04, M.dark, 0.15, 0.1, 0.38, head);
      box(0.08, 0.2, 0.08, M.horn, -0.2, 0.33, 0.05, head).rotation.z = 0.35;
      box(0.08, 0.2, 0.08, M.horn, 0.2, 0.33, 0.05, head).rotation.z = -0.35;
      box(0.26, 0.1, 0.14, M.dark, -0.38, 0.16, 0.05, head);
      box(0.26, 0.1, 0.14, M.dark, 0.38, 0.16, 0.05, head);
      const legs = [[-0.28, 0.5], [0.28, 0.5], [-0.28, -0.52], [0.28, -0.52]].map(([x, z]) => legPivot(body, x, 0.52, z, 0.2, 0.52, M.hide, M.hoof));
      const tail = new T.Group();
      tail.position.set(0, 1.08, -0.76);
      body.add(tail);
      box(0.06, 0.62, 0.06, M.hide, 0, -0.3, -0.03, tail);
      box(0.12, 0.16, 0.12, M.dark, 0, -0.62, -0.03, tail);
      return { root, body, head, legs, tail, size: 1.3, top: 1.55 };
    },
    sheep(M) {
      const root = new T.Group(), body = new T.Group();
      root.add(body);
      box(0.78, 0.56, 0.98, M.wool, 0, 0.66, 0, body);
      const puffs = [[-0.3, 0.86, 0.3, 0.3], [0.3, 0.86, 0.3, 0.3], [-0.3, 0.86, -0.3, 0.3], [0.3, 0.86, -0.3, 0.3], [0, 0.98, 0, 0.36], [0, 0.7, 0.5, 0.3], [0, 0.72, -0.5, 0.3], [-0.42, 0.62, 0, 0.3], [0.42, 0.62, 0, 0.3]];
      for (const [x, y, z, r] of puffs) { const p = new T.Mesh(new T.IcosahedronGeometry(r, 0), M.wool); p.position.set(x, y, z); body.add(p); }
      const head = new T.Group();
      head.position.set(0, 0.85, 0.6);
      body.add(head);
      box(0.32, 0.38, 0.38, M.face, 0, -0.04, 0.1, head);
      const cap = new T.Mesh(new T.IcosahedronGeometry(0.22, 0), M.wool); cap.position.set(0, 0.17, 0.05); head.add(cap);
      box(0.22, 0.08, 0.1, M.face, -0.24, 0.05, 0.05, head).rotation.z = 0.3;
      box(0.22, 0.08, 0.1, M.face, 0.24, 0.05, 0.05, head).rotation.z = -0.3;
      box(0.08, 0.08, 0.03, M.eye, -0.09, 0.04, 0.3, head);
      box(0.08, 0.08, 0.03, M.eye, 0.09, 0.04, 0.3, head);
      const legs = [[-0.22, 0.32], [0.22, 0.32], [-0.22, -0.32], [0.22, -0.32]].map(([x, z]) => legPivot(body, x, 0.42, z, 0.12, 0.42, M.face));
      return { root, body, head, legs, size: 1.0, top: 1.25 };
    },
    chicken(M) { return bird(M, { w: 0.5, h: 0.46, d: 0.6, comb: 2, tail: 'chicken' }); },
    hen(M) { return bird(M, { w: 0.56, h: 0.52, d: 0.64, comb: 1, tail: 'hen' }); },
    rooster(M) { return bird(M, { w: 0.52, h: 0.5, d: 0.62, comb: 3, tail: 'rooster', neck: true }); },
  };
  function bird(M, o) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const S = 1.35; // toy-sized up, so a chicken is easy to see through binoculars
    body.scale.setScalar(S);
    box(o.w, o.h, o.d, M.body, 0, 0.5, 0, body);
    box(0.06, o.h * 0.7, o.d * 0.7, M.wing, -o.w / 2 - 0.03, 0.5, -0.03, body);
    box(0.06, o.h * 0.7, o.d * 0.7, M.wing, o.w / 2 + 0.03, 0.5, -0.03, body);
    if (o.tail === 'rooster') {
      for (let k = 0; k < 4; k++) {
        const f = box(0.1, 0.5, 0.12, k % 2 ? M.tail2 : M.tail, (k - 1.5) * 0.08, 0.82, -o.d / 2 - 0.05, body);
        f.rotation.x = -0.5 - k * 0.12;
      }
    } else box(o.w * 0.7, 0.24, 0.16, M.body, 0, 0.74, -o.d / 2 + 0.02, body).rotation.x = -0.6;
    if (o.neck) box(o.w * 0.66, 0.3, 0.3, M.neck, 0, 0.76, o.d / 2 - 0.12, body);
    const head = new T.Group();
    head.position.set(0, 0.86, o.d / 2 - 0.06);
    body.add(head);
    box(0.26, 0.28, 0.26, o.neck ? M.neck : M.body, 0, 0.05, 0, head);
    box(0.1, 0.07, 0.14, M.beak, 0, 0.03, 0.18, head);
    box(0.06, 0.1, 0.05, M.comb, 0, -0.06, 0.15, head); // wattle
    for (let k = 0; k < o.comb; k++) box(0.06, 0.1 + (k === 1 ? 0.05 : 0), 0.07, M.comb, 0, 0.22 + (k === 1 ? 0.02 : 0), 0.06 - k * 0.07, head);
    box(0.04, 0.05, 0.03, M.eye, -0.1, 0.08, 0.1, head);
    box(0.04, 0.05, 0.03, M.eye, 0.1, 0.08, 0.1, head);
    const legs = [-0.1, 0.1].map((x) => {
      const p = legPivot(body, x, 0.28, 0.02, 0.05, 0.28, M.leg);
      box(0.16, 0.03, 0.18, M.leg, 0, -0.28, 0.05, p);
      return p;
    });
    return { root, body, head, legs, size: 0.75, top: 1.35, bird: true };
  }

  function makeAnimal(type, field, mats) {
    const v = BUILD[type](mats[type]);
    v.type = type;
    v.field = field;
    v.phase = Math.random() * 10;
    v.peckT = Math.random() * 3;
    v.headX = 0;
    const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.03;
    sh.scale.set(v.size * 1.1, v.size * 1.6, 1);
    v.root.add(sh);
    v.shadow = sh;
    setLayer(v.root, field + 1);
    return v;
  }

  // pose an animal from its rules state: position, facing, legs, grazing / pecking. Frozen animals hold still.
  function poseAnimal(v, a, dt, frozen) {
    v.root.position.set(FX[v.field] + a.x, 0, a.z);
    v.root.rotation.y = a.heading;
    if (frozen) return;
    const walking = a.speed > 0.05;
    v.phase += (walking ? 3 + a.speed * 6 : 0) * dt;
    const swing = walking ? Math.sin(v.phase) * (v.bird ? 0.7 : 0.45) : 0;
    v.legs.forEach((l, k) => { l.rotation.x += ((k % 2 === (k > 1 ? 1 : 0) ? swing : -swing) - l.rotation.x) * Math.min(1, dt * 14); });
    v.body.position.y = walking ? Math.abs(Math.sin(v.phase)) * (v.bird ? 0.06 : 0.04) : 0;
    let hx = 0;
    if (!walking && a.state === 'graze') {
      if (v.bird) { v.peckT += dt; const p = (v.peckT * 2.2) % 1; hx = p < 0.35 ? Math.sin((p / 0.35) * Math.PI) * 1.0 : 0; }
      else hx = 0.55 + Math.sin(v.phase * 0.3 + a.id) * 0.05;
    } else if (v.bird && walking) hx = Math.sin(v.phase * 2) * 0.15;
    v.headX += (hx - v.headX) * Math.min(1, dt * (v.bird ? 20 : 4));
    v.head.rotation.x = v.headX;
    if (v.tail) v.tail.rotation.z = Math.sin(performance.now() / 300 + a.id) * 0.35;
  }

  // ---------------------------------------------------------------- the helicopter (Zoom flies it) and its spotlight

  function makeHeli(field, pilotLook) {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const yellow = std('#ffcf2e', { roughness: 0.5 }), red = std('#ff3d5a', { roughness: 0.5 }), dark = std('#2a2a33'), glass = new T.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.45, roughness: 0.1 });
    const shell = new T.Mesh(new T.SphereGeometry(0.85, 16, 12), yellow);
    shell.scale.set(1, 0.85, 1.25);
    shell.position.y = 0.2;
    body.add(shell);
    const bubble = new T.Mesh(new T.SphereGeometry(0.62, 16, 12), glass);
    bubble.scale.set(1, 0.85, 1);
    bubble.position.set(0, 0.42, 0.52);
    body.add(bubble);
    box(0.28, 0.24, 2.2, yellow, 0, 0.4, -1.6, body);
    box(0.08, 0.6, 0.4, red, 0, 0.7, -2.65, body);
    const tailRotor = new T.Group();
    tailRotor.position.set(0.12, 0.62, -2.62);
    body.add(tailRotor);
    box(0.04, 0.9, 0.12, dark, 0, 0, 0, tailRotor);
    for (const x of [-0.5, 0.5]) { box(0.08, 0.08, 1.8, dark, x, -0.62, 0.1, body); box(0.06, 0.4, 0.06, dark, x, -0.42, 0.5, body); box(0.06, 0.4, 0.06, dark, x, -0.42, -0.3, body); }
    box(0.86, 0.12, 0.5, red, 0, 0.12, 0.98, body); // the nose stripe
    box(0.12, 0.3, 0.12, dark, 0, 1.0, 0, body);
    const rotor = new T.Group();
    rotor.position.set(0, 1.15, 0);
    body.add(rotor);
    box(4.2, 0.05, 0.22, dark, 0, 0, 0, rotor);
    box(0.22, 0.05, 4.2, dark, 0, 0, 0, rotor);
    // Zoom in the cockpit, from the shoulders up, waving
    const pilot = Kit.people.build(pilotLook);
    pilot.root.scale.setScalar(0.42);
    pilot.root.position.set(0, -0.15, 0.45);
    pilot.root.rotation.y = Math.PI; // he faces forward (+z)
    body.add(pilot.root);
    // the light: a soft cone down to the field and a warm pool on the ground
    const beam = new T.Mesh(new T.ConeGeometry(6.5, 8, 28, 1, true), new T.MeshBasicMaterial({ color: '#fff2b8', transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    const pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex.glow, color: '#ffe9a0', transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(FW * 1.25, FD * 1.35, 1);
    pool.position.set(FX[field], 0.04, 0);
    root.visible = false;
    beam.visible = false;
    pool.visible = false;
    const g = new T.Group();
    g.add(root, beam, pool);
    setLayer(g, field + 1);
    return { group: g, root, body, rotor, tailRotor, beam, pool, pilot, t: 0, k: 0 };
  }
  // where the helicopter hovers, given how high up the view (screen units from the middle) it should appear
  function heliSpot(field, screenY) {
    const h = 7.2, z = (h * Math.cos(TILT) - screenY) / Math.sin(TILT);
    return { x: FX[field] + 1.2, y: h, z };
  }
  function updateHeli(H, field, lensR, on, dt) {
    H.k += ((on ? 1 : 0) - H.k) * Math.min(1, dt * 3.5);
    if (on) H.t += dt;
    const vis = H.k > 0.02;
    H.root.visible = H.beam.visible = H.pool.visible = vis;
    if (!vis) { H.t = 0; return; }
    // it flies in from the right where you can see Zoom wave, then climbs to the top rim, out of the way
    const arrive = Math.min(1, H.t / 0.9), e = 1 - Math.pow(1 - arrive, 3);
    const climb = smoothstep(Math.min(1, Math.max(0, (H.t - 1.6) / 0.7)));
    const s = heliSpot(field, lensR * 0.45 + (lensR * 0.55 + 0.7) * climb);
    H.root.position.set(s.x + (1 - e) * 12 + Math.sin(H.t * 1.3) * 0.25, s.y + Math.sin(H.t * 2.1) * 0.12, s.z);
    H.root.rotation.set(0.08, Math.PI * 0.85, (1 - e) * 0.3);
    H.rotor.rotation.y += dt * 28;
    H.tailRotor.rotation.x += dt * 34;
    Kit.people.pose(H.pilot, H.t * 4, 'wave', Math.min(1, dt * 10));
    H.beam.position.set(H.root.position.x - 0.6, s.y / 2 + 0.1, s.z + 2.2);
    H.beam.rotation.set(-0.42, 0, 0.12);
    H.beam.material.opacity = 0.12 * H.k;
    H.pool.material.opacity = 0.55 * H.k * e;
  }

  // ---------------------------------------------------------------- the brothers with binoculars (title and final)

  function makeKid(id) {
    const entry = Kit.roster.get(id);
    const p = Kit.people.build(entry.look);
    const bino = new T.Group();
    const blk = std('#1f1f26', { roughness: 0.5 }), lens = std('#9fd9ff', { emissive: '#3a7fb8', emissiveIntensity: 0.6, roughness: 0.2 });
    for (const x of [-0.11, 0.11]) {
      const tube = new T.Mesh(new T.CylinderGeometry(0.085, 0.095, 0.3, 12), blk);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x, 0, -0.15);
      bino.add(tube);
      const glass = new T.Mesh(new T.CircleGeometry(0.075, 12), lens);
      glass.position.set(x, 0, -0.305);
      glass.rotation.y = Math.PI;
      bino.add(glass);
    }
    box(0.14, 0.06, 0.12, blk, 0, 0.02, -0.1, bino);
    bino.position.set(0, 0.03, -0.24);
    p.head.add(bino);
    return { p, root: p.root, id, entry, bino, phase: Math.random() * 6 };
  }
  // 'look' holds the binoculars up to his eyes; anything else is a Kit pose (boxing, jumpshot, peace, wave...)
  function poseKid(k, mode, dt, t) {
    const p = k.p, e = Math.min(1, dt * 10);
    k.phase += dt;
    if (mode === 'look') {
      Kit.people.pose(p, 0, 'stand', e);
      const ease = (o, prop, v) => { o[prop] += (v - o[prop]) * e; };
      ease(p.armL.rotation, 'x', 2.55); ease(p.armR.rotation, 'x', 2.55);
      ease(p.armL.rotation, 'z', 0.42); ease(p.armR.rotation, 'z', -0.42);
      ease(p.head.rotation, 'y', Math.sin(t * 0.6 + k.phase) * 0.35);
      ease(p.head.rotation, 'x', -0.05);
      k.bino.visible = true;
    } else {
      Kit.people.pose(p, t * (mode === 'boxing' ? 5 : 6), mode, e);
      p.head.rotation.y += (0 - p.head.rotation.y) * e;
      k.bino.visible = false;
    }
  }

  // ---------------------------------------------------------------- little effects: badges, sparkles, confetti

  function makeFx(scene) {
    const parts = [];
    const pool = [];
    const mats = {};
    function spark(field, x, y, z, color, o = {}) {
      let s = pool.pop();
      const key = color;
      if (!mats[key]) mats[key] = new T.SpriteMaterial({ map: tex.dot, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      if (!s) { s = new T.Sprite(mats[key]); scene.add(s); }
      s.material = mats[key];
      s.layers.set(field < 0 ? 0 : field + 1);
      s.visible = true;
      s.position.set(x, y, z);
      const size = o.size || 0.25;
      s.scale.set(size, size, 1);
      parts.push({ s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 0.8, age: 0, size, grav: o.grav || 0 });
    }
    const confMats = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ffffff', '#9fd0ff', '#9ff2d6'].map((c) => new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
    const confGeo = new T.PlaneGeometry(0.16, 0.24);
    const confetti = [];
    function confettiBurst(x, y, z, n = 60) {
      for (let k = 0; k < n; k++) {
        const m = new T.Mesh(confGeo, confMats[k % confMats.length]);
        m.position.set(x + rand(-3, 3), y + rand(0, 3), z + rand(-1.5, 1.5));
        scene.add(m);
        confetti.push({ m, vx: rand(-1, 1), vy: rand(0.5, 3), vz: rand(-1, 1), spin: rand(2, 8), age: 0, life: rand(2.5, 4) });
      }
    }
    function update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { p.s.visible = false; pool.push(p.s); parts.splice(i, 1); continue; }
        p.vy -= p.grav * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        const k = 1 - p.age / p.life;
        p.s.scale.set(p.size * (0.4 + k), p.size * (0.4 + k), 1);
        p.s.material.opacity = Math.min(1, k * 1.5);
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.age += dt;
        if (c.age > c.life) { scene.remove(c.m); confetti.splice(i, 1); continue; }
        c.vy -= 2.2 * dt;
        c.m.position.x += c.vx * dt; c.m.position.y += Math.max(-2.2, c.vy) * dt; c.m.position.z += c.vz * dt;
        c.m.rotation.x += c.spin * dt; c.m.rotation.y += c.spin * 0.7 * dt;
      }
    }
    function clear() {
      for (const p of parts) { p.s.visible = false; pool.push(p.s); }
      parts.length = 0;
      for (const c of confetti) scene.remove(c.m);
      confetti.length = 0;
    }
    return { spark, confettiBurst, update, clear };
  }

  function makeBadge(field) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: badgeTexture(1), transparent: true, depthTest: false, depthWrite: false }));
    s.renderOrder = 20;
    s.layers.set(field + 1);
    s.visible = false;
    return s;
  }

  // ---------------------------------------------------------------- the binocular frame (a 2D canvas over each view)

  // o: { w, h, dpr, r (lens radius in px), lobe, open (0 closed .. 1 open), night, lit, frozen, color, frost (0..1) }
  function paintMask(cv, o) {
    const W = Math.round(o.w * o.dpr), H = Math.round(o.h * o.dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d');
    x.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    x.clearRect(0, 0, o.w, o.h);
    const cx = o.w / 2, cy = o.h / 2, R = o.r, off = o.lobe * R, r = R * Math.max(0, o.open);
    // the binoculars' body: dark rubber with a soft sheen
    const body = x.createLinearGradient(0, 0, 0, o.h);
    body.addColorStop(0, '#2b2a36');
    body.addColorStop(0.5, '#17161f');
    body.addColorStop(1, '#0d0c13');
    x.fillStyle = body;
    x.fillRect(0, 0, o.w, o.h);
    // the eyepiece rims (stroked, then the inside is cut away so only the outer half shows)
    const rimW = Math.max(6, R * 0.09);
    for (const s of [-1, 1]) {
      x.lineWidth = rimW * 2;
      x.strokeStyle = '#3a3946';
      x.beginPath(); x.arc(cx + s * off, cy, R, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 3;
      x.strokeStyle = o.color;
      x.globalAlpha = 0.9;
      x.beginPath(); x.arc(cx + s * off, cy, R + rimW * 0.95, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 1;
    }
    // the bridge between the two tubes
    x.fillStyle = '#26252f';
    G.roundRect(x, cx - R * 0.28, cy - R * 1.12, R * 0.56, R * 0.3, 8);
    x.fill();
    if (r > 0.5) {
      x.globalCompositeOperation = 'destination-out';
      x.beginPath();
      x.arc(cx - off, cy, r, 0, Math.PI * 2);
      x.arc(cx + off, cy, r, 0, Math.PI * 2);
      x.fill();
      x.globalCompositeOperation = 'source-over';
      // lens shading inside both openings: darker towards the edge (much darker at night, warm under the spotlight)
      x.save();
      x.beginPath();
      x.arc(cx - off, cy, r, 0, Math.PI * 2);
      x.arc(cx + off, cy, r, 0, Math.PI * 2);
      x.clip();
      x.translate(cx, cy);
      x.scale(1 + o.lobe, 1);
      const g = x.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.05);
      if (o.night && !o.lit) {
        g.addColorStop(0, 'rgba(8,14,40,0.10)');
        g.addColorStop(0.75, 'rgba(6,10,30,0.45)');
        g.addColorStop(1, 'rgba(2,4,14,0.85)');
      } else if (o.lit) {
        g.addColorStop(0, 'rgba(255,240,180,0.06)');
        g.addColorStop(1, 'rgba(60,40,0,0.35)');
      } else {
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.8, 'rgba(0,0,0,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0.42)');
      }
      x.fillStyle = g;
      x.fillRect(-o.w, -o.h, o.w * 2, o.h * 2);
      x.restore();
      // a little glint on the glass
      x.fillStyle = 'rgba(255,255,255,0.10)';
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * off - r * 0.35, cy - r * 0.45, r * 0.22, r * 0.09, -0.6, 0, Math.PI * 2); x.fill(); }
      // Tommy Freeze: frost creeps in round the edge (never across the middle, where the animals are)
      if (o.frost > 0) {
        x.save();
        x.globalAlpha = Math.min(1, o.frost);
        x.beginPath();
        x.arc(cx - off, cy, r, 0, Math.PI * 2);
        x.arc(cx + off, cy, r, 0, Math.PI * 2);
        x.clip();
        x.save();
        x.translate(cx, cy);
        x.scale(1 + o.lobe, 1);
        const fg = x.createRadialGradient(0, 0, r * 0.62, 0, 0, r * 1.02);
        fg.addColorStop(0, 'rgba(200,240,255,0)');
        fg.addColorStop(0.75, 'rgba(200,240,255,0.18)');
        fg.addColorStop(1, 'rgba(225,248,255,0.7)');
        x.fillStyle = fg;
        x.fillRect(-o.w, -o.h, o.w * 2, o.h * 2);
        x.restore();
        x.fillStyle = 'rgba(235,250,255,0.95)';
        x.font = `${Math.round(r * 0.15)}px ${G.EMOJI_FONT}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        for (const s of [-1, 1]) {
          for (let k = 0; k < 7; k++) {
            const a = (s < 0 ? Math.PI * 0.62 : -Math.PI * 0.38) + (k / 6) * Math.PI * 0.76; // the outer half of each lens
            x.fillText('❄️', cx + s * off + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
          }
        }
        x.restore();
      }
    }
    // the lens caps, while the binoculars are shut
    if (o.open < 1) {
      x.save();
      x.globalAlpha = 1 - Math.max(0, o.open);
      for (const s of [-1, 1]) {
        const g = x.createRadialGradient(cx + s * off - R * 0.3, cy - R * 0.3, R * 0.1, cx + s * off, cy, R);
        g.addColorStop(0, '#3d3c4a');
        g.addColorStop(1, '#1b1a23');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx + s * off, cy, R, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.08)';
        x.lineWidth = 2;
        for (const k of [0.55, 0.8]) { x.beginPath(); x.arc(cx + s * off, cy, R * k, 0, Math.PI * 2); x.stroke(); }
      }
      x.fillStyle = 'rgba(255,255,255,0.13)';
      x.font = `${Math.round(R * 0.5)}px ${G.FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('T', cx - off, cy + R * 0.04);
      x.fillText('T', cx + off, cy + R * 0.04);
      x.restore();
    }
  }

  SPOT.art = { FX, FW, FD, TILT, tex, initTextures, makeWorld, animalMats, makeAnimal, poseAnimal, makeHeli, updateHeli, heliSpot, makeKid, poseKid, makeFx, makeBadge, badgeTexture, paintMask, setLayer };
})();
