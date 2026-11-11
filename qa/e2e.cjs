// Unfire Kinekt · end-to-end QA (headless Chrome): TV + phone controller in the same browser (BroadcastChannel transport).
// Verifies: no JS errors, lobby, phone join, motion-sensor swing detection (synthetic DeviceMotion), touch fallback,
// AI-vs-AI rules engine over many points, scoring progression, no NaN, fps. Screenshots in qa/.
const puppeteer = require('/Users/omarbaro/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8793';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = { errors: [], external: [], steps: {} };
  const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const tv = await browser.newPage(); await tv.setViewport({ width: 1600, height: 900 });
    const watch = (p, tag) => { p.on('pageerror', (e) => out.errors.push(tag + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') out.errors.push(tag + ' console: ' + m.text()); });
      p.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) out.external.push(u); }); };
    watch(tv, 'tv');
    await tv.goto(BASE + '/tv/index.html?local', { waitUntil: 'networkidle0' });
    await sleep(1200);
    const code = await tv.$eval('#code', (e) => e.textContent.trim());
    out.steps.code = code; await tv.screenshot({ path: __dirname + '/01_lobby.png' });
    // phone
    const ph = await browser.newPage(); await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); watch(ph, 'phone');
    await ph.goto(BASE + '/controller/index.html?local&c=' + code, { waitUntil: 'networkidle0' });
    await ph.type('#name', 'Omar'); await ph.click('#go'); await sleep(800);
    out.steps.joined = await tv.$$eval('.slot.on', (x) => x.map((e) => e.textContent));
    await ph.screenshot({ path: __dirname + '/02_controller.png' });
    // start match from TV
    await tv.bringToFront(); await tv.click('#play'); await sleep(1500);
    // motion: enable + synthetic gyro swing
    await ph.bringToFront(); await ph.click('#motion'); await sleep(1400); // calibration window
    const swingsBefore = await tv.evaluate(() => window.__kinekt.stats.humanSwings);
    await ph.evaluate(async () => {
      const fire = (w, beta) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { rotationRate: { alpha: w * 0.3, beta, gamma: w }, acceleration: { x: 0, y: 0, z: 0 }, accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 }, interval: 16 }));
      for (let s = 0; s < 3; s++) { for (let i = 0; i < 6; i++) { fire(150 + i * 180, 120); await new Promise((r) => setTimeout(r, 16)); } for (let i = 0; i < 6; i++) { fire(900 - i * 160, 60); await new Promise((r) => setTimeout(r, 16)); } for (let i = 0; i < 10; i++) { fire(20, 0); await new Promise((r) => setTimeout(r, 16)); } await new Promise((r) => setTimeout(r, 450)); }
    });
    await sleep(500);
    out.steps.motionSwingsDetected = (await tv.evaluate(() => window.__kinekt.stats.humanSwings)) - swingsBefore;
    // touch fallback swipe
    const box = await ph.$eval('#racket', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const b2 = await tv.evaluate(() => window.__kinekt.stats.humanSwings);
    await ph.touchscreen.tap(box.x, box.y); await sleep(500);
    out.steps.touchSwingDetected = (await tv.evaluate(() => window.__kinekt.stats.humanSwings)) - b2;
    // let the match play itself: human auto-swing helper on (simulates a player swinging when the ball arrives)
    await tv.bringToFront(); await tv.evaluate(() => { window.__kinekt.autoHumans = true; window.__kinekt.timeScale = 3; });
    const samples = [];
    for (let i = 0; i < 9; i++) {
      await sleep(5000);
      samples.push(await tv.evaluate(() => { const m = window.__kinekt, b = m.ball; return { t: +m.t.toFixed(1), frames: m.frames, pts: m.stats.points, hits: m.stats.hits, faults: m.stats.faults, maxRally: m.stats.maxRally, humanHits: m.stats.humanHits, humanSwings: m.stats.humanSwings, score: { p: m.score.p, g: m.score.g, s: m.score.s, tb: m.score.tb, done: m.score.done }, nan: [b.p.x, b.p.y, b.p.z, b.v.x].some((v) => !isFinite(v)) }; }));
      if (i === 3) await tv.screenshot({ path: __dirname + '/03_rally.png' });
    }
    out.samples = samples; await tv.screenshot({ path: __dirname + '/04_later.png' });
    const a = samples[0], z = samples[samples.length - 1];
    out.fps = +((z.frames - a.frames) / (z.t - a.t)).toFixed(1);
    out.verdict = {
      noErrors: out.errors.length === 0, noExternal: out.external.length === 0, phoneJoined: out.steps.joined.length > 0,
      motionWorks: out.steps.motionSwingsDetected >= 2, touchWorks: out.steps.touchSwingDetected === 1,
      pointsProgress: z.pts >= 4, rallies: z.maxRally >= 2, humanHits: z.humanHits > 0, noNaN: samples.every((s) => !s.nan),
    };
  } catch (e) { out.failure = String(e.stack || e); }
  fs.writeFileSync(__dirname + '/e2e_result.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ verdict: out.verdict, fps: out.fps, steps: out.steps, errors: out.errors.slice(0, 5), external: out.external.slice(0, 3), last: out.samples && out.samples.slice(-1)[0], failure: out.failure }, null, 1));
  await browser.close();
})();
