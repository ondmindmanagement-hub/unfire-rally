/* Unfire Rally · outdoor tournament environment + ambient soundscape.
   Everything is generated in code (geometry, canvas textures, Web Audio DSP synthesis): no AI-generated media, no samples,
   no third-party assets — free to use commercially. */
(function () {
'use strict';
const T = THREE;
const rnd = (a, b) => a + Math.random() * (b - a);

function skyDome() {
  const geo = new T.SphereGeometry(400, 32, 16);
  const mat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { top: { value: new T.Color(0x3d8be0) }, mid: { value: new T.Color(0x8cc4f0) }, hor: { value: new T.Color(0xe9f2f7) }, sunDir: { value: new T.Vector3(-0.35, 0.55, -0.75).normalize() } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vp;
      void main(){ float h = max(vp.y, 0.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h));
        float s = max(dot(vp, sunDir), 0.0); c += vec3(1.0,0.93,0.75) * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.18);
        if (vp.y < 0.0) c = mix(hor, vec3(0.55,0.62,0.55), smoothstep(0.0, 0.25, -vp.y)); gl_FragColor = vec4(c, 1.0); }`,
  });
  return new T.Mesh(geo, mat);
}

function cloudTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
  for (let i = 0; i < 26; i++) { const x = rnd(40, 216), y = rnd(45, 90), r = rnd(18, 44);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t;
}

function textTexture(text, bg, fg, w = 1024, h = 128) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `800 ${Math.round(h * 0.52)}px -apple-system, Helvetica, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; const n = Math.max(1, Math.floor(w / (g.measureText(text).width + 120)));
  for (let i = 0; i < n; i++) g.fillText(text, (i + 0.5) * w / n, h / 2 + 2);
  const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}

function build(scene, stadiumGroup) {
  const g = new T.Group(); g.name = 'outdoor'; stadiumGroup.add(g);
  g.add(skyDome());
  // clouds
  const ctex = cloudTexture(); const clouds = [];
  for (let i = 0; i < 16; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: ctex, transparent: true, opacity: rnd(0.55, 0.9), depthWrite: false, fog: false }));
    const a = rnd(0, Math.PI * 2), d = rnd(140, 300); s.position.set(Math.cos(a) * d, rnd(55, 110), Math.sin(a) * d); s.scale.set(rnd(60, 120), rnd(22, 40), 1); g.add(s); clouds.push(s); }
  // ground: meadow
  const meadow = new T.Mesh(new T.CircleGeometry(380, 64), new T.MeshStandardMaterial({ color: 0x5f9a43, roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.05; meadow.receiveShadow = true; g.add(meadow);
  // mountains (low-poly ring, original)
  const mtn = new T.Group(); g.add(mtn);
  const mMat = [new T.MeshStandardMaterial({ color: 0x6f8aa6, roughness: 1, flatShading: true }), new T.MeshStandardMaterial({ color: 0x8aa3ba, roughness: 1, flatShading: true })];
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1), d = rnd(230, 300), h = rnd(35, 85);
    const m = new T.Mesh(new T.ConeGeometry(rnd(40, 70), h, 6 + Math.floor(rnd(0, 3))), mMat[i % 2]); m.position.set(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d); m.rotation.y = rnd(0, 3); mtn.add(m);
    if (h > 65) { const cap = new T.Mesh(new T.ConeGeometry(m.geometry.parameters.radius * 0.28, h * 0.28, 6), new T.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.9, flatShading: true })); cap.position.set(m.position.x, h - 4 - h * 0.14, m.position.z); mtn.add(cap); } }
  // trees: instanced pines + round trees around the venue
  const N = 260, trunkG = new T.CylinderGeometry(0.25, 0.35, 2.4, 6), pineG = new T.ConeGeometry(2.2, 6.5, 7), roundG = new T.IcosahedronGeometry(2.6, 0);
  const trunks = new T.InstancedMesh(trunkG, new T.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 }), N);
  const pines = new T.InstancedMesh(pineG, new T.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.9, flatShading: true }), N);
  const rounds = new T.InstancedMesh(roundG, new T.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.9, flatShading: true }), N);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), col = new T.Color(); let ip = 0, ir = 0;
  for (let i = 0; i < N; i++) {
    let x, z; do { x = rnd(-170, 170); z = rnd(-170, 170); } while (Math.abs(x) < 34 && Math.abs(z) < 42);
    const s = rnd(0.8, 1.6); q.setFromEuler(e.set(0, rnd(0, 6), 0));
    m4.compose(new T.Vector3(x, 1.2 * s, z), q, sc.set(s, s, s)); trunks.setMatrixAt(i, m4);
    if (Math.random() < 0.55) { m4.compose(new T.Vector3(x, (2.4 + 3) * s, z), q, sc.set(s, s, s)); pines.setMatrixAt(ip, m4); pines.setColorAt(ip++, col.setHSL(rnd(0.3, 0.38), rnd(0.35, 0.5), rnd(0.22, 0.32))); }
    else { m4.compose(new T.Vector3(x, (2.4 + 1.8) * s, z), q, sc.set(s, s * rnd(0.85, 1.15), s)); rounds.setMatrixAt(ir, m4); rounds.setColorAt(ir++, col.setHSL(rnd(0.22, 0.32), rnd(0.4, 0.55), rnd(0.3, 0.42))); }
  }
  pines.count = ip; rounds.count = ir; [trunks, pines, rounds].forEach((m) => { m.castShadow = false; g.add(m); });
  // flower beds & hedges next to the stands (tournament garden look)
  const hedge = new T.MeshStandardMaterial({ color: 0x2f6e36, roughness: 1, flatShading: true });
  [[-26, 0, 2, 50], [26, 0, 2, 50], [0, -31, 40, 2], [0, 31, 40, 2]].forEach(([x, z, w, d]) => { const h = new T.Mesh(new T.BoxGeometry(w, 1.6, d), hedge); h.position.set(x, 0.8, z); g.add(h); });
  const flowers = new T.InstancedMesh(new T.SphereGeometry(0.22, 6, 4), new T.MeshStandardMaterial({ roughness: 0.7 }), 600); const fc = [0xff6b8a, 0xffd34d, 0xffffff, 0xb07cff, 0xff8a3d];
  for (let i = 0; i < 600; i++) { const side = i % 4; const u = rnd(-20, 20); const p = side === 0 ? [-27.5, u * 1.2] : side === 1 ? [27.5, u * 1.2] : side === 2 ? [u, -32.5] : [u, 32.5];
    m4.compose(new T.Vector3(p[0] + rnd(-0.6, 0.6), 0.25, p[1] + rnd(-0.6, 0.6)), q, sc.set(1, 1, 1)); flowers.setMatrixAt(i, m4); flowers.setColorAt(i, col.setHex(fc[i % fc.length])); }
  g.add(flowers);
  // tournament dressing: green backstop walls with our own wordmark, umpire chair, flags
  const wall = new T.MeshStandardMaterial({ map: textTexture('UNFIRE RALLY', '#0f4d36', '#e9f5ee'), roughness: 0.8 });
  [[0, -17.6, 0], [0, 17.6, Math.PI]].forEach(([x, z, r]) => { const w = new T.Mesh(new T.PlaneGeometry(22, 1.4), wall); w.position.set(x, 0.7, z); w.rotation.y = r; g.add(w); });
  const wallS = new T.MeshStandardMaterial({ map: textTexture('UNFIRE  ·  RALLY  ·  OPEN', '#0f4d36', '#cfe9da', 2048, 128), roughness: 0.8 });
  [[-10.4, 0, Math.PI / 2], [10.4, 0, -Math.PI / 2]].forEach(([x, z, r]) => { const w = new T.Mesh(new T.PlaneGeometry(36, 1.1), wallS); w.position.set(x, 0.55, z); w.rotation.y = r; g.add(w); });
  const chair = new T.Group(); const cm = new T.MeshStandardMaterial({ color: 0x1d5c45, roughness: 0.7 });
  const leg = new T.Mesh(new T.BoxGeometry(0.9, 2.2, 0.9), cm); leg.position.y = 1.1; chair.add(leg);
  const seat = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 1.1), cm); seat.position.y = 2.6; chair.add(seat);
  const umb = new T.Mesh(new T.ConeGeometry(1.1, 0.5, 8), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); umb.position.y = 3.9; chair.add(umb);
  chair.position.set(-6.6, 0, 0); g.add(chair);
  const flagCols = [0x2f7cf6, 0xff8a3d, 0x3ddc84, 0xffd34d, 0xff5d6c, 0x9b7bff, 0xffffff, 0x3ee6d2];
  const flags = [];
  flagCols.forEach((c, i) => { const x = -14 + i * 4; const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 9, 6), new T.MeshStandardMaterial({ color: 0xdfe5ec, metalness: 0.5, roughness: 0.4 })); pole.position.set(x, 4.5 + 4.9, -27); g.add(pole);
    const fg = new T.PlaneGeometry(2.4, 1.4, 12, 1); const f = new T.Mesh(fg, new T.MeshStandardMaterial({ color: c, side: T.DoubleSide, roughness: 0.8 })); f.position.set(x + 1.2, 8.9 + 4.9, -27); g.add(f); flags.push(f); });
  // shade awnings over the side stands
  const aw = new T.MeshStandardMaterial({ color: 0x1d5c45, roughness: 0.7, side: T.DoubleSide });
  [[-17.5, Math.PI / 2], [17.5, -Math.PI / 2]].forEach(([x, r]) => { const a = new T.Mesh(new T.PlaneGeometry(36, 5), aw); a.position.set(x, 7.6, 0); a.rotation.set(-Math.PI / 2 + 0.25 * Math.sign(x), r, 0); a.rotation.order = 'YXZ'; a.rotation.y = r; a.rotation.x = -1.3; g.add(a); });
  // birds (simple flapping V shapes)
  const birds = []; const bm = new T.MeshBasicMaterial({ color: 0x2a2f38, side: T.DoubleSide });
  for (let i = 0; i < 9; i++) { const b = new T.Group(); const w1 = new T.Mesh(new T.PlaneGeometry(0.9, 0.18), bm), w2 = w1.clone(); w1.position.x = -0.45; w2.position.x = 0.45; b.add(w1, w2); b.userData = { w1, w2, a: rnd(0, 6), r: rnd(40, 90), h: rnd(28, 45), s: rnd(0.08, 0.16), ph: rnd(0, 6) }; g.add(b); birds.push(b); }
  return {
    update(t) {
      clouds.forEach((s, i) => { s.position.x += 0.012 * (1 + i % 3); if (s.position.x > 320) s.position.x = -320; });
      flags.forEach((f, i) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k) + 1.2; p.setZ(k, Math.sin(t * 6 + x * 2.2 + i) * 0.18 * (x / 2.4)); } p.needsUpdate = true; });
      birds.forEach((b) => { const u = b.userData; u.a += u.s * 0.016; b.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t + u.ph) * 2, Math.sin(u.a) * u.r); b.rotation.y = -u.a; const fl = Math.sin(t * 9 + u.ph) * 0.6; u.w1.rotation.z = fl; u.w2.rotation.z = -fl; });
    },
  };
}

// ------------------------------------------------ ambient soundscape (pure DSP synthesis, original, royalty-free)
const Ambience = {
  started: false,
  start(ctx) {
    if (this.started || !ctx) return; this.started = true; this.ctx = ctx;
    const master = this.master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
    // looping noise buffer
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); d[i] = b * 6; } // brown-ish
    const loop = (filterType, f, q, gain) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(fl).connect(g).connect(master); s.start(); return { g, fl }; };
    // wind through trees (slowly modulated)
    this.wind = loop('lowpass', 520, 0.4, 0.05); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.03; lfo.connect(lg).connect(this.wind.g.gain); lfo.start();
    // distant crowd murmur (band-limited, gently varying)
    this.murmur = loop('bandpass', 420, 0.7, 0.035); const l2 = ctx.createOscillator(), g2 = ctx.createGain(); l2.frequency.value = 0.13; g2.gain.value = 0.012; l2.connect(g2).connect(this.murmur.g.gain); l2.start();
    this.birdTimer = setInterval(() => { if (Math.random() < 0.55) this.bird(); }, 1700);
  },
  bird() { // FM chirp phrases (synthesised songbird-like call)
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return; const t0 = ctx.currentTime + Math.random() * 0.3; const base = rnd(2600, 4200); const n = 2 + Math.floor(Math.random() * 4);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = rnd(-0.9, 0.9); pan.connect(this.master); }
    for (let i = 0; i < n; i++) { const t = t0 + i * rnd(0.09, 0.16); const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(base * rnd(0.9, 1.1), t); o.frequency.exponentialRampToValueAtTime(base * rnd(1.15, 1.45), t + 0.06);
      m.frequency.value = rnd(30, 70); mg.gain.value = rnd(80, 220); m.connect(mg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(pan || this.master); o.start(t); m.start(t); o.stop(t + 0.1); m.stop(t + 0.1); }
  },
  hush(on) { if (!this.master) return; this.master.gain.setTargetAtTime(on ? 0.45 : 0.9, this.ctx.currentTime, 0.4); },
};

window.RallyOutdoor = { build, Ambience };
})();
