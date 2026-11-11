// Live check against the published HTTPS site using the REAL transport (PeerJS/WebRTC): TV and phone in separate browser contexts.
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');
const BASE = process.env.BASE || 'https://ondmindmanagement-hub.github.io/unfire-rally';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = { errors: [] };
  const b = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const tvCtx = await b.createBrowserContext(), phCtx = await b.createBrowserContext();
    const tv = await tvCtx.newPage(); await tv.setViewport({ width: 1280, height: 720 });
    tv.on('pageerror', (e) => out.errors.push('tv ' + e.message));
    await tv.goto(BASE + '/tv/index.html', { waitUntil: 'networkidle2' });
    for (let i = 0; i < 30; i++) { if ((await tv.$eval('#netstate', (e) => e.textContent)).startsWith('Listo')) break; await sleep(500); }
    out.tvState = await tv.$eval('#netstate', (e) => e.textContent); out.code = await tv.$eval('#code', (e) => e.textContent);
    const ph = await phCtx.newPage(); await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    ph.on('pageerror', (e) => out.errors.push('phone ' + e.message));
    await ph.goto(BASE + '/controller/index.html?c=' + out.code, { waitUntil: 'networkidle2' });
    await ph.type('#name', 'Test'); await ph.click('#go');
    for (let i = 0; i < 40; i++) { out.phoneNet = await ph.$eval('#net', (e) => e.textContent); if (/ms/.test(out.phoneNet)) break; await sleep(500); }
    out.slots = await tv.$$eval('.slot.on', (x) => x.map((e) => e.textContent));
    await tv.bringToFront(); await tv.click('#play'); await sleep(800);
    const before = await tv.evaluate(() => window.__kinekt.stats.humanSwings);
    await ph.bringToFront(); const box = await ph.$eval('#racket', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const t0 = Date.now(); await ph.touchscreen.tap(box.x, box.y);
    for (let i = 0; i < 40; i++) { if ((await tv.evaluate(() => window.__kinekt.stats.humanSwings)) > before) break; await sleep(25); }
    out.swingDeliveredMs = Date.now() - t0; out.swingArrived = (await tv.evaluate(() => window.__kinekt.stats.humanSwings)) > before;
  } catch (e) { out.failure = String(e.stack || e); }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
