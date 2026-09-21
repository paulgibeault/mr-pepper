/* main.js — Mr Pepper: the kitchen around the rules.
 *
 * core.js is the game; this file is everything that touches a browser: the
 * fixed-step clock, the Arcade SDK contract (ready → state, suspend/resume,
 * records, save-import), the sheets, and handing core events to the renderer
 * and the sound pack.
 */

import * as Core from './core.js';
import { createRenderer } from './render.js';
import { FLAVORS, glyphSvg, jetSvg } from './sprites.js';
import { bindInput } from './input.js';
import { initAudio, sfx } from './audio.js';
import { DISHES, MAX_START, dishIndex, dishName } from './dishes.js';

const STEP_MS = 1000 / Core.TICK_HZ;

// `marks` is the picture on each choice: a kitchen shows the flavors it cooks
// with (the same shapes as in the pot), a flame shows its jets.
const KITCHENS = [
  { id: 'home',   name: 'Home Kitchen', flavors: 3 },
  { id: 'bistro', name: 'Bistro',       flavors: 4 },
  { id: 'market', name: 'Spice Market', flavors: 5 },
].map((k) => ({ ...k, note: `${k.flavors} flavors`, marks: FLAVORS.slice(0, k.flavors).map((_, f) => glyphSvg(f)).join('') }));
const FLAMES = ['Low', 'Medium', 'High'].map((name, i) => ({
  name, note: `${Core.FLAME_POINTS[i]} a seasoning`, marks: jetSvg(i === 0).repeat(i + 1),
}));
const cookbookKey = (kitchenId) => `cookbook-${kitchenId}`;

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const R = createRenderer($('view'));

let s = null;                 // the core state, or null in the menu
let mode = 'menu';            // menu | play | paused | served | over
let prefs = { kitchen: 0, flame: 1, level: 0 };
let acc = 0;
let loop = null;
let seenScore = 0;             // the score as of the last clear, for the callout

// ── sheets ───────────────────────────────────────────────────────────────
const SHEETS = { menu: 'menu', cookbook: 'cookbook', paused: 'paused', served: 'served', over: 'over' };
function show(next) {
  mode = next;
  for (const [m, id] of Object.entries(SHEETS)) $(id).hidden = m !== mode;
  $('rail').hidden = !s;
  if (mode === 'play') { acc = 0; loop.start(); } else { loop.stop(); loop.kick(); }
}

function segmented(el, items, get, set) {
  el.textContent = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    const marks = document.createElement('span');
    marks.className = 'marks';
    marks.innerHTML = it.marks;                       // our own constant markup
    b.append(marks, it.name);
    const small = document.createElement('small');
    small.textContent = it.note;
    b.append(small);
    b.addEventListener('click', () => { set(i); paint(); });
    el.append(b);
  });
  const paint = () => [...el.children].forEach((b, i) => b.setAttribute('aria-checked', String(i === get())));
  paint();
  return paint;
}

function savePrefs() { Arcade.state.set('prefs', prefs); renderBest(); }

function renderBest() {
  const k = KITCHENS[prefs.kitchen];
  const best = Arcade.records.get(`score-${k.id}`);
  const far = Arcade.records.get(`dishes-${k.id}`);
  $('best').textContent = best
    ? `${k.name} best: ${best.value.toLocaleString()}${far ? ` · dish ${far.value} served` : ''}`
    : '';
}

function renderCookbook() {
  const k = KITCHENS[prefs.kitchen];
  const book = Arcade.stats.get(cookbookKey(k.id));
  const list = $('cookbook-list');
  const cooked = Object.keys(book).length;
  $('cookbook-kitchen').textContent = `${k.name} — ${cooked} of ${DISHES.length} dishes served.`;
  list.textContent = '';
  DISHES.forEach((name, i) => {
    const entry = book[i];
    const row = document.createElement('div');
    row.className = entry ? 'dish cooked' : 'dish unmade';
    const label = document.createElement('span');
    label.className = 'dish-name';
    label.textContent = name;
    const meta = document.createElement('span');
    meta.className = 'dish-meta';
    meta.textContent = entry
      ? `${entry.times}× · best ${entry.best.toLocaleString()}`
      : 'not yet served';
    row.append(label, meta);
    list.append(row);
  });
}

function recordCookbook() {
  const k = KITCHENS[prefs.kitchen];
  const dish = dishIndex(s.level);
  Arcade.stats.update(cookbookKey(k.id), (prev) => {
    const cur = prev[dish] || { times: 0, best: 0 };
    return { ...prev, [dish]: { times: cur.times + 1, best: Math.max(cur.best, s.score) } };
  });
}

const orderNo = (level) => `Order ${String(level + 1).padStart(2, '0')}`;

function renderHud() {
  if (!s) return;
  const left = Math.max(0, s.remaining), total = s.total || left || 1;   // `total`: absent in older saves
  $('hud-level').textContent = orderNo(s.level);
  $('hud-dish').textContent = dishName(s.level);
  $('hud-score').textContent = s.score.toLocaleString();
  $('hud-left').textContent = String(left);
  $('hud-bar').style.width = `${Math.round((1 - left / total) * 100)}%`;
  const best = Arcade.records.get(`score-${KITCHENS[prefs.kitchen].id}`);
  $('hud-best').textContent = best ? `Best ${best.value.toLocaleString()}` : '';
}

/* What the run just cleared was worth, rising from where it dissolved. */
function callout(e, gained) {
  if (gained <= 0 && e.chain < 2) return;
  const el = $('callout'), at = R.centreOf(s, e.cells);
  const F = FLAVORS[e.flavors[0]] || FLAVORS[0];
  $('callout-title').textContent = e.chain > 1 ? `Chain ×${e.chain}` : '';
  $('callout-points').textContent = gained > 0 ? `+${gained.toLocaleString()}` : '';
  el.style.setProperty('--glow', F.color);
  el.style.setProperty('--tone', F.light);
  const x = Math.max(76, Math.min(R.layout.W - 76, at.x));      // keep it on the screen
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(at.y)}px) translate(-50%, -120%)`;
  el.classList.remove('go');
  void el.offsetWidth;                              // restart the one-shot animation
  el.classList.add('go');
}

// ── runs ─────────────────────────────────────────────────────────────────
function persistRun() {
  if (s && (mode === 'play' || mode === 'paused' || mode === 'served')) {
    Arcade.state.set('run', { kitchen: prefs.kitchen, s: { ...s, events: [] } });
  }
}
function dropRun() { Arcade.state.set('run', null); $('continue').hidden = true; }

function record() {
  const k = KITCHENS[prefs.kitchen];
  if (s.score > 0) {
    Arcade.records.best(`score-${k.id}`, {
      value: s.score, direction: 'higher', format: 'integer', label: `${k.name} — best score`,
    });
  }
}

function begin(state) {
  s = state;
  s.events = [];
  seenScore = s.score;
  R.freshBroth();
  R.view.spawnAt = performance.now();
  fit();
  renderHud();
  show('play');
}

function startNew(level) {
  const seed = (Math.random() * 0x100000000) >>> 0;
  begin(Core.newGame({
    flavors: KITCHENS[prefs.kitchen].flavors, flame: prefs.flame, level, seed,
  }));
  persistRun();
}

// ── core events → everything else ────────────────────────────────────────
function drain(now) {
  for (const e of s.events.splice(0)) {
    switch (e.type) {
      case 'spawn': R.view.spawnAt = now; break;
      case 'move': sfx('move'); break;
      case 'rotate': sfx('rotate'); break;
      case 'lock': sfx('lock'); break;
      case 'settle': sfx('settle'); break;
      case 'mill': sfx('mill'); break;
      case 'clear':
        sfx('clear', { chain: e.chain, ings: e.ings });
        R.dissolved(s, e.cells);
        callout(e, s.score - seenScore);
        seenScore = s.score;
        if (e.chain > 1) R.view.flash = Math.min(1, 0.4 + e.chain * 0.2);
        renderHud();
        break;
      case 'won': {
        sfx('won');
        record();
        const k = KITCHENS[prefs.kitchen];
        Arcade.records.best(`dishes-${k.id}`, {
          value: s.level + 1, direction: 'higher', format: 'integer', label: `${k.name} — furthest dish served`,
        });
        const was = Arcade.stats.get(cookbookKey(k.id))[dishIndex(s.level)];
        recordCookbook();
        $('served-order').textContent = `${orderNo(s.level)} · ${k.name}`;
        $('served-name').textContent = dishName(s.level);
        $('served-dish').textContent = `Table ${1 + (s.rng % 12)}.`;
        $('served-ings').textContent = String(s.total ?? '—');
        $('served-pinches').textContent = String(s.pieces);
        $('served-chain').textContent = s.maxChain > 1 ? `×${s.maxChain}` : '—';
        $('served-score').textContent = s.score.toLocaleString();
        $('served-best').textContent = was && s.score > was.best ? `New best for this dish — was ${was.best.toLocaleString()}` : '';
        $('next').textContent = `Next order — ${dishName(s.level + 1)}`;
        renderHud();
        show('served');
        persistRun();
        break;
      }
      case 'over':
        sfx('over');
        record();
        $('over-order').textContent = `${orderNo(s.level)} · ${KITCHENS[prefs.kitchen].name}`;
        $('over-name').textContent = dishName(s.level);
        $('over-dish').textContent = `${s.remaining} left to season.`;
        $('over-score').textContent = s.score.toLocaleString();
        dropRun();
        show('over');
        break;
      default: break;
    }
  }
}

function frame(delta) {
  const now = performance.now();
  if (mode === 'play' && s) {
    acc = Math.min(acc + delta, STEP_MS * 8);      // never spiral after a stall
    while (acc >= STEP_MS && mode === 'play') {
      Core.tick(s);
      drain(now);
      acc -= STEP_MS;
    }
  }
  R.draw(s, now);
}

function emit(cmd) {
  if (mode !== 'play' || !s) return;
  Core.command(s, cmd);
  drain(performance.now());
}

function pause() {
  if (mode === 'play') { persistRun(); show('paused'); }
  else if (mode === 'paused') show('play');
}

// ── sizing & settings ────────────────────────────────────────────────────
function fit() {
  const r = stage.getBoundingClientRect();
  const L = R.resize(Math.max(1, r.width), Math.max(1, r.height), s ? s.cols : 8, s ? s.rows : 16);
  stage.style.setProperty('--rail-h', `${L.hudH}px`);
  stage.style.setProperty('--rail-w', `${Math.max(340, L.potW + L.cell * 4)}px`);
  if (loop && !loop.running()) loop.kick();
}

function applySettings() {
  const saving = Arcade.settings.powerSaver ? Arcade.settings.powerSaver() : false;
  R.view.motion = !Arcade.settings.reducedMotion() && !saving;
}

// ── boot ─────────────────────────────────────────────────────────────────
async function boot() {
  await Arcade.ready;
  initAudio();

  prefs = { ...prefs, ...(Arcade.state.get('prefs') || {}) };
  loop = Arcade.loop(frame);
  applySettings();
  Arcade.onSettingsChange(() => { applySettings(); if (!loop.running()) loop.kick(); });

  const paintKitchen = segmented($('kitchen'), KITCHENS, () => prefs.kitchen, (i) => { prefs.kitchen = i; savePrefs(); });
  const paintFlame = segmented($('flame'), FLAMES, () => prefs.flame, (i) => { prefs.flame = i; savePrefs(); });
  const paintLevel = () => {
    $('level-note').textContent = `Dish ${prefs.level + 1} · ${Core.stockCount(8, 16, prefs.level)} ingredients`;
    $('level-dish').textContent = dishName(prefs.level);
  };
  $('level-down').addEventListener('click', () => { prefs.level = Math.max(0, prefs.level - 1); paintLevel(); savePrefs(); });
  $('level-up').addEventListener('click', () => { prefs.level = Math.min(MAX_START - 1, prefs.level + 1); paintLevel(); savePrefs(); });

  function openMenu() {
    const run = Arcade.state.get('run');
    const live = run && run.s && run.s.v === 1 && run.s.phase !== 'over';
    $('continue').hidden = !live;
    if (live) {
      $('continue-order').textContent = `On the stove · ${orderNo(run.s.level)}`;
      $('continue-dish').textContent = `Back to the ${dishName(run.s.level)}`;
    }
    paintKitchen(); paintFlame(); paintLevel(); renderBest();
    s = null;
    show('menu');
  }

  $('play').addEventListener('click', () => startNew(prefs.level));
  $('cookbook-open').addEventListener('click', () => { renderCookbook(); show('cookbook'); });
  $('cookbook-back').addEventListener('click', () => show('menu'));
  $('continue').addEventListener('click', () => {
    const run = Arcade.state.get('run');
    if (!run || !run.s) return openMenu();
    prefs.kitchen = run.kitchen ?? prefs.kitchen;
    begin(run.s);
    if (s.phase === 'won') { Core.nextLevel(s); R.freshBroth(); renderHud(); }
    show('paused');                                 // never drop someone into a live pot
  });
  $('pause').addEventListener('click', pause);
  $('resume').addEventListener('click', pause);
  $('quit').addEventListener('click', () => { persistRun(); openMenu(); });
  $('next').addEventListener('click', () => {
    Core.nextLevel(s);
    R.freshBroth();
    renderHud();
    persistRun();
    show('play');
  });
  $('retry').addEventListener('click', () => startNew(s ? s.level : prefs.level));
  $('to-menu').addEventListener('click', openMenu);

  bindInput($('view'), {
    emit, onPause: pause,
    cell: () => R.layout.cell,
    active: () => mode === 'play',
    pieces: () => (s ? s.pieces : 0),
  });

  R.view.onArt = () => { if (!loop.running()) loop.kick(); };    // the painted art arrived
  new ResizeObserver(fit).observe(stage);
  fit();

  // Hidden means off the heat: the loop parks itself (Arcade.loop), and the
  // run is written down in case the frame is evicted while we're away.
  Arcade.onSuspend(() => { if (mode === 'play') { persistRun(); show('paused'); } else persistRun(); });
  Arcade.onStateReplaced(() => {
    prefs = { kitchen: 0, flame: 1, level: 0, ...(Arcade.state.get('prefs') || {}) };
    openMenu();
  });

  // ?dev=1 — a handle for test drivers and the console; never for the game.
  if (new URLSearchParams(location.search).has('dev')) {
    window.__pepper = { get s() { return s; }, get mode() { return mode; }, get painted() { return R.view.painted; }, emit, Core };
  }

  openMenu();
}

boot();
