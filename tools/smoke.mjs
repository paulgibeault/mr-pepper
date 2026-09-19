/* tools/smoke.mjs — drive the real page in headless Chromium.
 *
 *   ./dev.sh ../dr-pepper                      (from the launcher repo)
 *   node tools/smoke.mjs [url] [screenshot-dir]
 *
 * Playwright is borrowed from the launcher checkout next door (it is the
 * fleet's only browser-test dependency); set ARCADE_LAUNCHER to point at it.
 * Uses the ?dev=1 handle (window.__pepper) to build positions, then plays them
 * through the same input paths a player uses.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';

const launcher = process.env.ARCADE_LAUNCHER || path.resolve(import.meta.dirname, '../../paulgibeault.github.io');
const { chromium } = createRequire(path.join(launcher, 'package.json'))('playwright');

const url = process.argv[2] || 'http://127.0.0.1:4791/mr-pepper/?dev=1';
const shots = process.argv[3] || null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const problems = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
const mode = () => page.evaluate(() => window.__pepper.mode);
const waitMode = (m) => page.waitForFunction((x) => window.__pepper.mode === x, m, { timeout: 8000 });

await page.goto(url);
await page.waitForFunction(() => window.__pepper);
await shot('1-menu');

// menu → play
await page.click('#kitchen button:nth-child(3)');
for (let i = 0; i < 4; i++) await page.click('#level-up');
await page.click('#play');
await waitMode('play');
await page.waitForTimeout(400);
await shot('2-play');
assert.equal(await page.evaluate(() => window.__pepper.s.remaining), 20, 'dish 5 stocks 20');

// keyboard: move, turn
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowUp');
assert.deepEqual(await page.evaluate(() => [window.__pepper.s.piece.x, window.__pepper.s.piece.o]), [2, 1]);

// touch-style drag: three columns right
const cell = await page.evaluate(() => Math.floor(document.getElementById('view').clientWidth / 8.7));
await page.mouse.move(100, 500); await page.mouse.down();
await page.mouse.move(100 + cell * 3, 500, { steps: 12 }); await page.mouse.up();
assert.equal(await page.evaluate(() => window.__pepper.s.piece.x), 5, 'drag moves one column per cell');

// tap the right half: clockwise
await page.mouse.click(300, 500);
assert.equal(await page.evaluate(() => window.__pepper.s.piece.o), 2);

// a winning throw: three tomatoes in column 0, an upright red pinch on top
await page.evaluate(() => {
  const { s, emit } = window.__pepper;
  s.grid.fill(null);
  for (let y = 13; y < 16; y++) s.grid[y * 8] = { f: 0, ing: true, link: 0 };
  s.remaining = 3;
  Object.assign(s.piece, { a: 0, b: 0, o: 0, x: 3, y: 0 });
  emit('cw');
  for (let i = 0; i < 5; i++) emit('left');
});
await shot('3-before-throw');
await page.keyboard.press('Space');
await page.waitForTimeout(150);
await shot('4-clearing');
await waitMode('served');
await shot('5-served');
assert.equal(await page.textContent('#served-score'), '1,400');

// next dish, then pause / resume
await page.click('#next');
await waitMode('play');
assert.equal(await page.evaluate(() => window.__pepper.s.level), 5);
await page.click('#pause');
assert.equal(await mode(), 'paused');
const y0 = await page.evaluate(() => window.__pepper.s.piece.y);
await page.waitForTimeout(900);
assert.equal(await page.evaluate(() => window.__pepper.s.piece.y), y0, 'nothing falls while paused');
await page.click('#resume');

// boil over
await page.evaluate(() => {
  const { s, emit } = window.__pepper;
  for (let y = 1; y < 16; y++) s.grid[y * 8 + 3] = { f: y % 2, ing: false, link: 0 };
  s.piece.x = 0; s.piece.y = 0; s.piece.o = 0;
  s.grid[3] = { f: 2, ing: false, link: 0 };
  emit('hard');
});
await waitMode('over');
await shot('6-over');

const saved = await page.evaluate(() => ({
  records: Object.fromEntries(Object.entries(Arcade.records.list()).map(([k, v]) => [k, v.value])),
  run: Arcade.state.get('run'),
}));
assert.equal(saved.records['score-market'], 1400);
assert.equal(saved.records['dishes-market'], 5);
assert.equal(saved.run, null, 'a boiled-over run is not resumable');

// a run in progress survives a reload, and resumes paused
await page.click('#retry');
await waitMode('play');
await page.reload();
await page.waitForFunction(() => window.__pepper);
assert.equal(await page.isVisible('#continue'), true);
await page.click('#continue');
assert.equal(await mode(), 'paused');

// landscape: the pot is height-bound and centred
await page.setViewportSize({ width: 1280, height: 720 });
await page.click('#resume');
await page.waitForTimeout(300);
await shot('7-landscape');

await browser.close();
assert.deepEqual(problems, [], 'console must stay clean');
console.log('smoke: ok');
