/* Unfire Rally · Tennis — game engine (TV / host). Three.js r147 (MIT). All art procedural & original.
   Units: metres, seconds. Court along Z (net at z=0). Team 0 = near side (z>0), team 1 = far side (z<0). */
(function () {
'use strict';
const T = THREE;
const C = { L: 23.77, HL: 11.885, SW: 4.115, DW: 5.485, SVC: 6.40, NET: 0.914, POST: 1.07, R: 0.033, G: 9.81 };
const SURF = {
  hard:  { name: 'Pista rápida', court: '#2c5fa8', out: '#2f7d5b', vy: 0.74, vh: 0.80 },
  clay:  { name: 'Tierra batida', court: '#c4622d', out: '#b2552a', vy: 0.79, vh: 0.74 },
  grass: { name: 'Hierba', court: '#5aa53f', out: '#4c9437', vy: 0.66, vh: 0.86 },
};
const PT = ['0', '15', '30', '40'];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sgn = (v) => (v < 0 ? -1 : 1);

// ------------------------------------------------------------------ audio (procedural, original)
const Sfx = {
  ctx: null,
  init() { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  noise(dur, f, q, gain, t0 = 0) {
    const a = this.ctx; if (!a) return; const n = a.createBufferSource(); const len = Math.max(1, a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    n.buffer = buf; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const g = a.createGain(); g.gain.value = gain; n.connect(bp).connect(g).connect(a.destination); n.start(a.currentTime + t0);
  },
  tone(f, dur, gain, type = 'sine') {
    const a = this.ctx; if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  },
  hit(p) { this.noise(0.06, 2600, 1.4, 0.55 * p + 0.2); this.tone(520 + 200 * p, 0.05, 0.18, 'triangle'); },
  bounce() { this.noise(0.05, 900, 1.2, 0.25); this.tone(180, 0.06, 0.12); },
  net() { this.noise(0.12, 400, 0.8, 0.35); },
  crowd(intensity) { if (!this.ctx) return; for (let i = 0; i < 6; i++) this.noise(1.4 + Math.random(), rnd(900, 2400), 0.6, 0.06 * intensity, i * 0.08); },
  ooh() { if (!this.ctx) return; const a = this.ctx, o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(210, a.currentTime); o.frequency.linearRampToValueAtTime(150, a.currentTime + 0.9);
    f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.linearRampToValueAtTime(0.05, a.currentTime + 0.2); g.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1);
    o.connect(f).connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 1.05); },
};

// ------------------------------------------------------------------ scene
class Stadium {
  constructor(scene, surface) {
    this.scene = scene; this.group = new T.Group(); scene.add(this.group); this.build(surface);
  }
  courtTexture(s) {
    const W = 1024, H = 2048, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const OW = 18.3, OL = 36.6, px = W / OW, pz = H / OL; // outer area metres
    g.fillStyle = s.out; g.fillRect(0, 0, W, H);
    const X = (x) => W / 2 + x * px, Z = (z) => H / 2 + z * pz;
    g.fillStyle = s.court; g.fillRect(X(-C.DW), Z(-C.HL), 2 * C.DW * px, 2 * C.HL * pz);
    if (s === SURF.grass) { for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.04)'; g.fillRect(0, Z(-OL / 2 + i * OL / 24), W, OL / 24 * pz); } }
    // subtle surface grain
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.04})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.strokeStyle = '#f4f6f8'; g.lineWidth = 0.05 * px;
    const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); };
    [C.DW, -C.DW, C.SW, -C.SW].forEach((x) => line(x, -C.HL, x, C.HL));
    [C.HL, -C.HL].forEach((z) => line(-C.DW, z, C.DW, z));
    [C.SVC, -C.SVC].forEach((z) => line(-C.SW, z, C.SW, z));
    line(0, -C.SVC, 0, C.SVC); line(0, C.HL, 0, C.HL - 0.15); line(0, -C.HL, 0, -C.HL + 0.15);
    const tx = new T.CanvasTexture(cv); tx.anisotropy = 8; tx.encoding = T.sRGBEncoding; return tx;
  }
  build(surface) {
    const s = SURF[surface] || SURF.hard; this.surface = s;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    const ground = new T.Mesh(new T.PlaneGeometry(18.3, 36.6), new T.MeshStandardMaterial({ map: this.courtTexture(s), roughness: 0.92 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.group.add(ground);
    const apron = new T.Mesh(new T.PlaneGeometry(52, 64), new T.MeshStandardMaterial({ color: 0x3f7f3a, roughness: 1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; apron.receiveShadow = true; this.group.add(apron);
    // net
    const netTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); g.strokeStyle = 'rgba(230,236,245,0.85)'; g.lineWidth = 2; for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(60, 5); return t; })();
    const net = new T.Mesh(new T.PlaneGeometry(2 * C.DW + 0.9, C.NET), new T.MeshStandardMaterial({ map: netTex, transparent: true, side: T.DoubleSide, roughness: 1 }));
    net.position.set(0, C.NET / 2, 0); net.castShadow = true; this.group.add(net);
    const tape = new T.Mesh(new T.BoxGeometry(2 * C.DW + 0.9, 0.06, 0.02), new T.MeshStandardMaterial({ color: 0xffffff })); tape.position.y = C.NET; this.group.add(tape);
    [-1, 1].forEach((k) => { const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, C.POST, 16), new T.MeshStandardMaterial({ color: 0x20252f, metalness: 0.6, roughness: 0.4 })); p.position.set(k * (C.DW + 0.45), C.POST / 2, 0); p.castShadow = true; this.group.add(p); });
    // stands + crowd (instanced, original low-poly)
    this.crowd = this.buildCrowd();
    // light towers glow
    [[-16, -20], [16, -20], [-16, 20], [16, 20]].forEach(([x, z]) => { const m = new T.Mesh(new T.BoxGeometry(2.2, 0.5, 0.3), new T.MeshBasicMaterial({ color: 0xfff6dd })); m.position.set(x, 18, z); m.lookAt(0, 0, 0); this.group.add(m); });
  }
  buildCrowd() {
    const rows = 7, perRow = 56, sides = [];
    const stand = new T.MeshStandardMaterial({ color: 0x1f5a40, roughness: 0.85 });
    const seats = [];
    const addStand = (cx, cz, rotY, len) => {
      for (let r = 0; r < rows; r++) {
        const step = new T.Mesh(new T.BoxGeometry(len, 0.55, 0.9), stand);
        const d = r * 0.9, h = 0.4 + r * 0.55;
        step.position.set(cx + Math.sin(rotY) * d, h - 0.25, cz + Math.cos(rotY) * d); step.rotation.y = rotY; this.group.add(step);
        for (let i = 0; i < perRow * len / 40; i++) { const u = (i + 0.5) / (perRow * len / 40) - 0.5; if (Math.random() < 0.12) continue;
          seats.push({ x: cx + Math.sin(rotY) * d + Math.cos(rotY) * u * len, y: h + 0.05, z: cz + Math.cos(rotY) * d - Math.sin(rotY) * u * len, ph: Math.random() * 6.28, sp: rnd(0.8, 1.4) }); }
      }
    };
    addStand(-11.5, 0, -Math.PI / 2, 36); addStand(11.5, 0, Math.PI / 2, 36); addStand(0, -21, Math.PI, 26); addStand(0, 21, 0, 26);
    const n = seats.length;
    const body = new T.InstancedMesh(new T.BoxGeometry(0.42, 0.62, 0.3), new T.MeshStandardMaterial({ roughness: 0.8 }), n);
    const head = new T.InstancedMesh(new T.SphereGeometry(0.15, 10, 8), new T.MeshStandardMaterial({ roughness: 0.7 }), n);
    const pal = [0xffffff, 0xf3efe2, 0x9cc7ef, 0xf6d36b, 0xf2a7b8, 0xbfe3c8, 0xffffff, 0x2d3a4a, 0xe8e2d0, 0xd9e8f7];
    const skin = [0xf2c9a8, 0xd9a07a, 0xa86f4c, 0x6e4a33, 0xffe0c4];
    const c = new T.Color();
    seats.forEach((s, i) => { body.setColorAt(i, c.setHex(pal[i % pal.length])); head.setColorAt(i, c.setHex(skin[(i * 7) % skin.length])); });
    this.group.add(body, head); return { seats, body, head, excite: 0 };
  }
  animateCrowd(t, ballX) {
    const { seats, body, head } = this.crowd; const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1);
    const ex = this.crowd.excite = Math.max(0, this.crowd.excite - 0.016);
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i]; const jump = ex > 0.05 ? Math.max(0, Math.sin(t * 9 * s.sp + s.ph)) * 0.35 * ex : Math.sin(t * 1.3 + s.ph) * 0.015;
      m.compose(new T.Vector3(s.x, s.y + 0.31 + jump, s.z), q.setFromEuler(e.set(0, 0, 0)), sc); body.setMatrixAt(i, m);
      const look = clamp((ballX - s.x) * 0.04, -0.4, 0.4);
      m.compose(new T.Vector3(s.x + look * 0.1, s.y + 0.78 + jump, s.z), q, sc); head.setMatrixAt(i, m);
    }
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ player (original stylised athlete)
class Athlete {
  constructor(scene, team, idx, colors) {
    this.team = team; this.idx = idx; this.dir = team === 0 ? -1 : 1; // facing toward -z for near team
    this.pos = new T.Vector3(0, 0, team === 0 ? 12.3 : -12.3); this.vel = new T.Vector3(); this.target = this.pos.clone();
    this.human = false; this.slot = -1; this.speed = 6.2; this.swingT = 1; this.swingKind = 'fh'; this.runPh = 0; this.serveUp = 0;
    const g = this.g = new T.Group(); scene.add(g);
    const mat = (c, r = 0.6, m = 0) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const skin = mat(colors.skin, 0.7), shirt = mat(colors.shirt, 0.55), shorts = mat(colors.shorts, 0.7), shoe = mat(0xf4f4f6, 0.5);
    const cyl = (r1, r2, h, m) => { const x = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 14), m); x.castShadow = true; return x; };
    this.hip = new T.Group(); this.hip.position.y = 0.95; g.add(this.hip);
    const torso = cyl(0.2, 0.16, 0.62, shirt); torso.position.y = 0.33; this.hip.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(0.13, 18, 14), skin); head.position.y = 0.78; head.castShadow = true; this.hip.add(head);
    const band = cyl(0.135, 0.135, 0.04, mat(colors.accent, 0.4)); band.position.y = 0.82; this.hip.add(band);
    const sh = cyl(0.19, 0.17, 0.22, shorts); sh.position.y = -0.02; this.hip.add(sh);
    const leg = (x) => { const p = new T.Group(); p.position.set(x, -0.08, 0); const l = cyl(0.065, 0.055, 0.82, skin); l.position.y = -0.41; p.add(l); const s = new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.26), shoe); s.position.set(0, -0.83, -0.05 * this.dir * -1); s.castShadow = true; p.add(s); this.hip.add(p); return p; };
    this.legL = leg(-0.1); this.legR = leg(0.1);
    const arm = (x) => { const p = new T.Group(); p.position.set(x, 0.58, 0); const a = cyl(0.05, 0.045, 0.62, skin); a.position.y = -0.31; p.add(a); this.hip.add(p); return p; };
    this.armL = arm(-0.24); this.armR = arm(0.24);
    // racket in right hand
    this.racket = new T.Group(); this.racket.position.y = -0.6; this.armR.add(this.racket);
    const handle = cyl(0.016, 0.016, 0.28, mat(0x111111)); handle.position.y = -0.12; this.racket.add(handle);
    const frame = new T.Mesh(new T.TorusGeometry(0.15, 0.012, 8, 28), mat(colors.racket, 0.3, 0.5)); frame.scale.set(1, 1.25, 1); frame.position.y = -0.45; frame.castShadow = true; this.racket.add(frame);
    const strings = new T.Mesh(new T.CircleGeometry(0.145, 24), new T.MeshStandardMaterial({ color: 0xeaeaea, transparent: true, opacity: 0.35, side: T.DoubleSide })); strings.scale.set(1, 1.25, 1); strings.position.y = -0.45; this.racket.add(strings);
    const ring = new T.Mesh(new T.RingGeometry(0.45, 0.55, 32), new T.MeshBasicMaterial({ color: colors.accent, transparent: true, opacity: 0.0 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring); this.ring = ring;
    this.g.rotation.y = this.team === 0 ? Math.PI : 0;
  }
  swing(kind) { if (this.swingT < 0.6) return false; this.swingT = 0; this.swingKind = kind; return true; }
  update(dt, t) {
    const d = this.target.clone().sub(this.pos); d.y = 0; const dist = d.length();
    const want = dist > 0.05 ? d.normalize().multiplyScalar(Math.min(this.speed, dist * 6)) : new T.Vector3();
    this.vel.lerp(want, clamp(dt * 9, 0, 1)); this.pos.addScaledVector(this.vel, dt);
    this.g.position.copy(this.pos);
    const sp = this.vel.length(); this.runPh += dt * (4 + sp * 2.2);
    const a = sp > 0.3 ? Math.sin(this.runPh) * Math.min(0.75, sp * 0.18) : 0;
    this.legL.rotation.x = a; this.legR.rotation.x = -a; this.armL.rotation.x = -a * 0.8;
    this.hip.position.y = 0.95 + (sp > 0.3 ? Math.abs(Math.sin(this.runPh)) * 0.04 : 0);
    // swing animation 0..0.42s
    this.swingT += dt; const st = clamp(this.swingT / 0.42, 0, 1);
    if (this.swingKind === 'serve' && st < 1) { this.armR.rotation.set(-Math.PI * (0.6 + 0.9 * Math.sin(st * Math.PI)), 0, 0); }
    else if (st < 1) { const s = this.swingKind === 'bh' ? -1 : 1; const e = Math.sin(st * Math.PI);
      this.armR.rotation.set(-1.25 * e, s * (-1.6 + 3.2 * st) * 0.8, s * 0.6 * e); this.hip.rotation.y = s * (-0.6 + 1.2 * st) * 0.5; }
    else { this.armR.rotation.x += (-0.35 - this.armR.rotation.x) * 0.2; this.armR.rotation.y *= 0.8; this.armR.rotation.z *= 0.8; this.hip.rotation.y *= 0.85; }
    this.ring.material.opacity = this.human ? 0.55 + 0.25 * Math.sin(t * 4) : 0;
  }
}

// ------------------------------------------------------------------ match / rules
class Score {
  constructor(games = 4) { this.gamesToWin = games; this.p = [0, 0]; this.g = [0, 0]; this.s = [0, 0]; this.tb = false; this.server = 0; this.done = false; this.winner = -1; }
  pointLabel() {
    if (this.tb) return `${this.p[0]}-${this.p[1]} (TB)`;
    const [a, b] = this.p;
    if (a >= 3 && b >= 3) { if (a === b) return 'IGUALES'; return (a > b ? 'VENTAJA ' : 'VENTAJA ') + (a > b ? 'A' : 'B'); }
    return `${PT[Math.min(a, 3)]}-${PT[Math.min(b, 3)]}`;
  }
  win(team) { // returns event text
    if (this.done) return '';
    const o = 1 - team; this.p[team]++;
    const [a, b] = [this.p[team], this.p[o]];
    const need = this.tb ? 7 : 4;
    if (a >= need && a - b >= 2) { return this.game(team); }
    return this.tb ? 'Punto' : (this.p[0] >= 3 && this.p[1] >= 3 ? (this.p[0] === this.p[1] ? 'Iguales' : 'Ventaja') : 'Punto');
  }
  game(team) {
    const wasTb = this.tb; this.g[team]++; this.p = [0, 0]; this.tb = false; this.server = 1 - this.server;
    const N = this.gamesToWin, [a, b] = [this.g[team], this.g[1 - team]];
    if (wasTb || (a >= N && a - b >= 2)) { this.s[team]++; this.g = [0, 0]; this.done = true; this.winner = team; return 'Juego, set y partido'; }
    if (this.g[0] === N && this.g[1] === N) { this.tb = true; return 'Juego · Tie-break'; }
    return 'Juego';
  }
  pointsPlayed() { return this.p[0] + this.p[1]; }
}

class Match {
  constructor(ui) {
    this.ui = ui; this.t = 0;
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(innerWidth, innerHeight); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    document.getElementById('stage').appendChild(r.domElement);
    const sc = this.scene = new T.Scene(); sc.background = new T.Color(0xcfe3f2); sc.fog = new T.Fog(0xdbe8f0, 120, 420);
    this.cam = new T.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 300); this.cam.position.set(0, 6, 20);
    sc.add(new T.HemisphereLight(0xdcecff, 0x4a6b3a, 0.85));
    const sun = new T.DirectionalLight(0xfff1d6, 1.6); sun.position.set(-10, 24, -14); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -20, near: 1, far: 60 }); sun.shadow.bias = -0.0005; sc.add(sun);
    this.stadium = new Stadium(sc, 'grass');
    this.outdoor = window.RallyOutdoor ? RallyOutdoor.build(sc, sc) : null;
    const bm = new T.MeshStandardMaterial({ color: 0xd8f24a, roughness: 0.6, emissive: 0x2a3300 });
    this.ballMesh = new T.Mesh(new T.SphereGeometry(C.R * 1.6, 20, 14), bm); this.ballMesh.castShadow = true; sc.add(this.ballMesh);
    this.shadowBlob = new T.Mesh(new T.CircleGeometry(0.09, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })); this.shadowBlob.rotation.x = -Math.PI / 2; sc.add(this.shadowBlob);
    this.trail = []; for (let i = 0; i < 10; i++) { const m = new T.Mesh(new T.SphereGeometry(C.R * 1.3 * (1 - i / 12), 8, 6), new T.MeshBasicMaterial({ color: 0xeaff7a, transparent: true, opacity: 0.25 * (1 - i / 10) })); sc.add(m); this.trail.push(m); }
    this.ball = { p: new T.Vector3(), v: new T.Vector3(), spin: 0, live: false, lastTeam: -1, bounces: 0, bounceSide: 0, serve: false, served: false, fault: 0, netTouch: false, held: true };
    this.colors = [{ shirt: 0xf7f8fa, shorts: 0xf7f8fa, accent: 0x2f7cf6, racket: 0x2f7cf6, skin: 0xf0c3a0 }, { shirt: 0xf7f8fa, shorts: 0xeef0f3, accent: 0xff8a3d, racket: 0xff6a2a, skin: 0x9a6a4a }];
    this.players = []; this.setup(1);
    this.diff = 0.75; this.camMode = 'tv'; this.paused = true; this.pending = null; this.stats = { hits: 0, rallies: 0, points: 0, faults: 0, humanSwings: 0, humanHits: 0, maxRally: 0, rally: 0 };
    addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); });
    this.clock = new T.Clock(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  setup(perTeam) {
    this.players.forEach((p) => this.scene.remove(p.g)); this.players = [];
    for (let team = 0; team < 2; team++) for (let i = 0; i < perTeam; i++) {
      const c = Object.assign({}, this.colors[team]); if (i === 1) c.skin = team ? 0xf2d0b5 : 0x7a4f36;
      const a = new Athlete(this.scene, team, i, c); this.players.push(a);
    }
    this.perTeam = perTeam; this.layout(true);
  }
  team(t) { return this.players.filter((p) => p.team === t); }
  setSurface(k) { this.stadium.build(k); }
  // --- humans
  assign(slot) {
    // slot 0 -> near team player 0, slot 1 -> far team player 0 (2P), slots 2/3 -> partners in doubles
    const want = this.humanCount();
    const per = want >= 3 ? 2 : 1; if (per !== this.perTeam) this.setup(per);
    const order = per === 2 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0]];
    const [team, idx] = order[slot] || order[0]; const p = this.players.find((x) => x.team === team && x.idx === idx);
    if (p) { p.human = true; p.slot = slot; }
    this.camMode = this.players.some((x) => x.human && x.team === 1) ? 'broadcast' : 'tv';
    return p;
  }
  release(slot) { this.players.forEach((p) => { if (p.slot === slot) { p.human = false; p.slot = -1; } }); }
  humanCount() { return this.ui.humans().length; }
  byslot(slot) { return this.players.find((p) => p.slot === slot); }
  // --- layout for a point
  layout(instant) {
    const s = this.score || { server: 0, pointsPlayed: () => 0 }; const server = s.server, even = (s.pointsPlayed() % 2) === 0;
    for (const p of this.players) {
      const z = p.team === 0 ? 1 : -1; const side = (even ? 1 : -1) * (p.team === 0 ? 1 : -1);
      let x, zz;
      if (p.team === server) {
        if (p.idx === 0) { x = side * rnd(0.6, 1.2); zz = z * (C.HL + 0.25); } else { x = -side * 2.4; zz = z * 2.6; }
      } else {
        if (p.idx === 0) { x = side * (this.perTeam === 1 ? 2.6 : 2.9); zz = z * (C.HL + 0.6); } else { x = -side * 2.4; zz = z * 3.2; }
      }
      p.target.set(x, 0, zz); if (instant) { p.pos.copy(p.target); p.vel.set(0, 0, 0); }
    }
  }
  start(games, surface, diff) {
    Sfx.init(); window.RallyOutdoor && Sfx.ctx && RallyOutdoor.Ambience.start(Sfx.ctx); this.score = new Score(games); if (surface) this.setSurface(surface); if (diff != null) this.diff = diff;
    this.stats = { hits: 0, rallies: 0, points: 0, faults: 0, humanSwings: 0, humanHits: 0, maxRally: 0, rally: 0 };
    this.paused = false; this.newPoint(true);
  }
  server() { return this.team(this.score.server)[0]; }
  newPoint(first) {
    const b = this.ball; this.layout(first); Object.assign(b, { live: false, lastTeam: -1, bounces: 0, bounceSide: 0, serve: true, served: false, netTouch: false, held: true, spin: 0 });
    if (!first) b.fault = 0; else b.fault = 0;
    this.stats.rally = 0; this.serveClock = 0; this.ui.score(this.score);
  }
  // --- physics
  heldBallPos() { const s = this.server(); return s.pos.clone().add(new T.Vector3(s.team === 0 ? 0.25 : -0.25, 1.05, 0)); }
  solve(from, target, speed, spin) {
    // horizontal speed -> flight time; solve vy to land at target (ignoring drag, compensated) with net clearance
    const dx = target.x - from.x, dz = target.z - from.z, dh = Math.hypot(dx, dz);
    let t = dh / speed; const gEff = C.G + spin * 3.2;
    for (let k = 0; k < 12; k++) {
      const vy = (0 - from.y + 0.5 * gEff * t * t) / t; const tn = Math.abs(from.z) / Math.abs(dz / t);
      const yNet = from.y + vy * tn - 0.5 * gEff * tn * tn;
      if (Math.sign(from.z) === Math.sign(target.z) || yNet > C.NET + 0.25) return new T.Vector3(dx / t * 1.035, vy, dz / t * 1.035);
      t *= 1.07;
    }
    const vy = (0 - from.y + 0.5 * gEff * t * t) / t; return new T.Vector3(dx / t, vy, dz / t);
  }
  strike(p, power, spin, aim, kind) {
    const b = this.ball, opp = p.team === 0 ? -1 : 1;
    let target;
    if (kind === 'serve') {
      const sx = sgn(p.pos.x) * (p.team === 0 ? 1 : -1);
      target = new T.Vector3(-sgn(p.pos.x) * clamp(1.8 + aim * 1.6, 0.4, 3.9), 0, opp * rnd(4.2, 6.0 - (1 - power) * 0.8));
      b.serve = true; b.served = true; b.serveBoxX = -sgn(p.pos.x);
      const pF = (b.fault ? 0.06 : 0.16) + (p.human ? Math.max(0, power - 0.85) * 0.8 : (1 - this.diff) * 0.1);
      if (Math.random() < pF) { if (Math.random() < 0.55) target.z = opp * rnd(6.7, 7.8); else target.x = -sgn(p.pos.x) * rnd(4.3, 5); }
    } else {
      const depth = clamp(7 + power * 4.2 + rnd(-0.6, 0.6), 4.5, 11.4);
      target = new T.Vector3(clamp(aim * 3.6 + rnd(-0.5, 0.5), -3.9, 3.9), 0, opp * depth); b.serve = false;
      const pErr = p.human ? (p.errBias || 0) : clamp(0.07 + (power - 0.6) * 0.25 + (1 - this.diff) * 0.12, 0.03, 0.4);
      if (Math.random() < pErr) { const k = Math.random();
        if (k < 0.4) target.z = opp * rnd(12.3, 13.6);            // long
        else if (k < 0.75) target.x = sgn(target.x || 1) * rnd(4.4, 5.4); // wide
        else { target.z = opp * 0.9; this.netShot = true; }         // into the net
        this.stats.errors = (this.stats.errors || 0) + 1; }
    }
    const speed = kind === 'serve' ? 24 + power * 14 : 13 + power * 15;
    b.spin = clamp(spin, -1, 1); b.v.copy(this.solve(b.p, target, speed, b.spin)); if (this.netShot) { this.netShot = false; b.v.y = Math.min(b.v.y, 0.4); b.v.x *= 1; } b.live = true; b.held = false; b.lastTeam = p.team; b.bounces = 0; b.bounceSide = 0; b.netTouch = false;
    this.stats.hits++; this.stats.rally++; this.stats.maxRally = Math.max(this.stats.maxRally, this.stats.rally);
    Sfx.hit(power); this.ui.flash && this.ui.flash(p, kind);
    for (const q of this.players) if (q.human && q === p) this.ui.feedback(q.slot, { t: 'hit', power, kind });
  }
  inReach(p) {
    const b = this.ball; if (!b.live || b.lastTeam === p.team) return false;
    const d = new T.Vector3(b.p.x - p.pos.x, 0, b.p.z - p.pos.z).length();
    return d < 1.75 && b.p.y > 0.12 && b.p.y < 2.9 && Math.sign(b.p.z) === (p.team === 0 ? 1 : -1) && !(b.serve && b.bounces === 0);
  }
  humanSwing(slot, m) {
    const p = this.byslot(slot); if (!p || this.paused) return;
    this.stats.humanSwings++; const b = this.ball, power = clamp(m.power ?? 0.7, 0.15, 1), spin = clamp(m.spin ?? 0.2, -1, 1);
    if (b.held && this.server() === p && !this.pending) { p.swing('serve'); this.tossThenServe(p, power, m.aim ?? rnd(-0.6, 0.6)); return; }
    const kind = (b.p.x - p.pos.x) * (p.team === 0 ? 1 : -1) >= 0 ? 'fh' : 'bh';
    p.swing(kind); p.buffer = { until: this.t + 0.22, power, spin, aim: m.aim };
    this.tryHumanHit(p);
  }
  tryHumanHit(p) {
    if (p.buffer && this.t > p.buffer.until) p.buffer = null;
    if (!p.buffer || !this.inReach(p)) return;
    const b = this.ball; const rel = (b.p.z - p.pos.z) * (p.team === 0 ? -1 : 1); // >0 ball still in front = early
    const timingAim = clamp(-rel * 0.9 * sgn(b.p.x - p.pos.x || 1), -1, 1);
    const aim = p.buffer.aim != null ? clamp(p.buffer.aim, -1, 1) : timingAim;
    p.errBias = clamp(Math.max(0, Math.abs(rel) - 0.6) * 0.45 + Math.max(0, p.buffer.power - 0.92) * 0.6, 0, 0.5);
    this.strike(p, p.buffer.power, p.buffer.spin, aim, 'rally'); p.buffer = null; this.stats.humanHits++;
  }
  tossThenServe(p, power, aim) {
    const b = this.ball; b.held = false; b.p.copy(this.heldBallPos()); b.v.set(0, 5.2, 0); b.live = false; this.pending = { t: this.t + 0.5, p, power, aim };
  }
  aiThink(dt) {
    const b = this.ball;
    for (const p of this.players) {
      if (p.human) continue;
      if (b.held && this.server() === p && !this.pending) {
        this.serveClock += dt; if (this.serveClock > 1.4) { p.swing('serve'); this.tossThenServe(p, rnd(0.55, 0.95) * this.diff + 0.1, rnd(-1, 1)); }
        continue;
      }
      if (this.inReach(p) && (!p.aiDelay || this.t > p.aiDelay)) {
        if (Math.random() < 0.06 * (1.2 - this.diff)) { p.aiDelay = this.t + 0.5; continue; } // miss-hit chance
        const kind = (b.p.x - p.pos.x) * (p.team === 0 ? 1 : -1) >= 0 ? 'fh' : 'bh'; p.swing(kind);
        const opp = this.team(1 - p.team)[0]; const aim = clamp(-sgn(opp.pos.x || rnd(-1, 1)) * rnd(0.45, 1) + rnd(-0.25, 0.25), -1, 1);
        this.strike(p, rnd(0.45, 0.9) * (0.7 + 0.3 * this.diff), rnd(-0.2, 0.8), aim, 'rally'); p.aiDelay = this.t + 0.25;
      }
    }
  }
  predictIntercept(p) {
    // simulate ball forward, return first reachable point on p's side after bounce (or volley zone)
    const b = this.ball; const pos = b.p.clone(), v = b.v.clone(); let bounced = b.bounces > 0 && b.bounceSide === (p.team === 0 ? 1 : -1);
    const side = p.team === 0 ? 1 : -1; let best = null;
    for (let i = 0; i < 400; i++) {
      const dt = 1 / 120; v.y -= (C.G + b.spin * 3.2) * dt; pos.addScaledVector(v, dt);
      if (pos.y < C.R && v.y < 0) { pos.y = C.R; v.y = -v.y * this.stadium.surface.vy; v.x *= this.stadium.surface.vh; v.z *= this.stadium.surface.vh; if (Math.sign(pos.z) === side) { if (bounced) break; bounced = true; } }
      if (Math.sign(pos.z) === side && (bounced ? pos.y > 0.55 && pos.y < 1.4 && v.y < 2 : Math.abs(pos.z) < 5 && pos.y < 1.8 && p.idx === 1)) { best = pos.clone(); if (bounced) break; }
    }
    return best;
  }
  movePlayers() {
    const b = this.ball;
    for (const team of [0, 1]) {
      const mates = this.team(team), side = team === 0 ? 1 : -1;
      const incoming = (b.live && b.lastTeam === 1 - team) || (b.serve && b.lastTeam === 1 - team);
      if (incoming) {
        const pt = this.predictIntercept(mates[0]);
        // the closest teammate chases; partner holds
        let chaser = mates[0]; if (mates.length > 1 && pt) chaser = mates.reduce((a, c) => (c.pos.distanceTo(pt) < a.pos.distanceTo(pt) ? c : a));
        for (const p of mates) {
          if (p === chaser && pt) { const off = sgn(pt.x - p.pos.x) * 0.55; p.target.set(clamp(pt.x - off, -7, 7), 0, clamp(pt.z + side * 0.35, side > 0 ? 0.8 : -14.5, side > 0 ? 14.5 : -0.8)); p.speed = p.human ? 7.2 : 5.6 + this.diff * 1.4; }
          else if (p !== chaser) p.target.set(-sgn(chaser.pos.x || 1) * 2.4, 0, side * (p.idx === 1 ? 3 : C.HL + 0.4));
        }
      } else if (b.live && b.lastTeam === team) {
        for (const p of mates) p.target.set(p.idx === 1 ? -sgn(b.p.x || 1) * 2.2 : clamp(b.p.x * 0.3, -2, 2), 0, side * (p.idx === 1 ? 3.2 : C.HL + 0.5));
      }
    }
  }
  pointTo(team, why) {
    if (!this.ball.live && !this.ball.served) return;
    this.ball.live = false; this.ball.served = false; this.stats.points++; this.stats.rallies++;
    const ev = this.score.win(team); this.stadium.crowd.excite = 1; Sfx.crowd(this.stats.rally > 4 ? 1.4 : 0.9);
    this.ui.call(`${why} · ${ev}`, team, this.score); this.ui.score(this.score);
    this.players.filter((p) => p.human).forEach((p) => this.ui.feedback(p.slot, { t: 'point', won: p.team === team }));
    if (this.score.done) { this.ui.end(this.score, this.stats); this.paused = true; return; }
    this.nextAt = this.t + 2.4;
  }
  fault(why) {
    const b = this.ball; b.live = false; b.served = false; this.stats.faults++;
    if (b.fault === 0) { b.fault = 1; this.ui.call(why + ' · Primer saque fallado'); Sfx.ooh(); this.nextServeAt = this.t + 1.6; }
    else { b.fault = 0; b.served = true; this.pointTo(1 - b.lastTeam, 'Doble falta'); }
  }
  physics(dt) {
    const b = this.ball, S = this.stadium.surface;
    if (this.pending && this.t >= this.pending.t) { const { p, power, aim } = this.pending; this.pending = null; b.p.copy(p.pos).add(new T.Vector3(p.team === 0 ? 0.2 : -0.2, 2.75, 0)); this.strike(p, power, 0.15, aim, 'serve'); }
    if (b.held) { if (!this.pending) { b.p.copy(this.heldBallPos()); b.v.set(0, 0, 0); } else { b.v.y -= C.G * dt; b.p.addScaledVector(b.v, dt); } return; }
    if (!b.live && !this.pending) { b.v.y -= C.G * dt; b.v.multiplyScalar(1 - 0.6 * dt); b.p.addScaledVector(b.v, dt); if (b.p.y < C.R && b.v.y < 0) { b.p.y = C.R; b.v.y *= -0.5; b.v.x *= 0.8; b.v.z *= 0.8; } return; }
    const prevZ = b.p.z, sp = b.v.length();
    b.v.y -= (C.G + b.spin * 3.2) * dt; b.v.multiplyScalar(1 - 0.0045 * sp * dt); b.p.addScaledVector(b.v, dt);
    // net
    if (Math.sign(prevZ) !== Math.sign(b.p.z) && Math.abs(b.p.x) < C.DW + 0.45) {
      if (b.p.y < C.NET + C.R) {
        if (b.p.y > C.NET - 0.07 && Math.random() < 0.45) { b.v.multiplyScalar(0.35); b.netTouch = true; Sfx.net(); }
        else { b.p.z = prevZ; b.v.z *= -0.12; b.v.x *= 0.3; b.v.y *= 0.3; Sfx.net(); b.netStuck = true; }
      }
    }
    if (b.p.y < C.R && b.v.y < 0) {
      b.p.y = C.R; b.v.y = -b.v.y * S.vy; b.v.x *= S.vh; b.v.z = b.v.z * S.vh + sgn(b.v.z) * b.spin * 0.6; Sfx.bounce();
      this.onBounce();
    }
    if (b.live && b.netStuck && Math.abs(b.v.z) < 0.6 && b.p.y < 0.2) { b.netStuck = false; return b.serve ? this.fault('Red') : this.pointTo(1 - b.lastTeam, 'Red'); }
    if (b.live && (Math.abs(b.p.z) > 30 || Math.abs(b.p.x) > 20)) { if (b.bounces === 0) return b.serve ? this.fault('Fuera') : this.pointTo(1 - b.lastTeam, 'Fuera'); else return this.pointTo(b.lastTeam, 'Ganador'); }
  }
  onBounce() {
    const b = this.ball; const side = sgn(b.p.z); b.bounces++;
    if (!b.live) return;
    const recv = b.lastTeam === 0 ? -1 : 1;
    if (b.bounces === 1) {
      if (b.serve) {
        const ok = side === recv && Math.abs(b.p.z) <= C.SVC + 0.02 && Math.abs(b.p.x) <= C.SW + 0.02 && sgn(b.p.x) === b.serveBoxX * (b.lastTeam === 0 ? 1 : 1);
        if (!ok) return this.fault(Math.abs(b.p.z) > C.SVC ? 'Saque largo' : 'Saque fuera');
        if (b.netTouch) { b.live = false; b.served = false; this.ui.call('Let · Repetir saque'); this.nextServeAt = this.t + 1.4; return; }
        b.serve = false; b.bounceSide = side; return;
      }
      const W = this.perTeam === 2 ? C.DW : C.SW;
      if (side !== recv || Math.abs(b.p.x) > W + 0.02 || Math.abs(b.p.z) > C.HL + 0.02) return this.pointTo(1 - b.lastTeam, side !== recv ? 'No pasa la red' : 'Fuera');
      b.bounceSide = side;
    } else if (b.bounces >= 2) { return this.pointTo(b.lastTeam, b.stats ? 'Ganador' : 'Ganador'); }
  }
  camera(dt) {
    const b = this.ball; let pos, look;
    if (this.camMode === 'broadcast') { pos = new T.Vector3(b.p.x * 0.15, 15, 0.1); pos.set(-19, 11, b.p.z * 0.25); look = new T.Vector3(0, 0, b.p.z * 0.25); }
    else { const me = this.players.find((p) => p.human && p.team === 0) || this.team(0)[0]; pos = new T.Vector3(me.pos.x * 0.55, 4.6, Math.max(me.pos.z + 7.5, 17.5)); look = new T.Vector3(b.p.x * 0.25, 0.5, -3.5); }
    this.cam.position.lerp(pos, clamp(dt * 2.4, 0, 1)); this.camLook = (this.camLook || look.clone()).lerp(look, clamp(dt * 3, 0, 1)); this.cam.lookAt(this.camLook);
  }
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta()) * (this.timeScale || 1); this.t += dt;
    if (!this.paused) {
      const steps = 4 * Math.ceil(this.timeScale || 1), h = dt / steps;
      for (let i = 0; i < steps; i++) this.physics(h);
      if (this.nextAt && this.t > this.nextAt) { this.nextAt = 0; this.newPoint(); }
      if (this.nextServeAt && this.t > this.nextServeAt) { this.nextServeAt = 0; const f = this.ball.fault; this.newPoint(); this.ball.fault = f; this.serveClock = 0; }
      this.movePlayers(); this.aiThink(dt); for (const p of this.players) if (p.human) this.tryHumanHit(p);
      if (this.autoHumans) for (const p of this.players) if (p.human) { if (this.ball.held && this.server() === p && !this.pending && this.t % 2 < dt) this.humanSwing(p.slot, { power: 0.7 }); else if (this.inReach(p) && (!p.buffer || this.t > p.buffer.until)) this.humanSwing(p.slot, { power: rnd(0.5, 0.9), spin: 0.3 }); }
    }
    for (const p of this.players) p.update(dt, this.t);
    const b = this.ball; this.ballMesh.position.copy(b.p); this.shadowBlob.position.set(b.p.x, 0.012, b.p.z); this.shadowBlob.scale.setScalar(1 + b.p.y * 0.25); this.shadowBlob.material.opacity = 0.35 / (1 + b.p.y * 0.4);
    for (let i = this.trail.length - 1; i > 0; i--) this.trail[i].position.copy(this.trail[i - 1].position); this.trail[0].position.copy(b.p);
    this.trail.forEach((m) => (m.visible = b.live));
    this.stadium.animateCrowd(this.t, b.p.x); this.outdoor && this.outdoor.update(this.t); this.camera(dt);
    this.renderer.render(this.scene, this.cam);
    this.frames = (this.frames || 0) + 1;
  }
}
window.KinektTennis = { Match, Sfx, SURF, C };
})();
