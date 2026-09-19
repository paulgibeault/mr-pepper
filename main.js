/* main.js — Mr Pepper: the kitchen around the rules.
 *
 * core.js is the game; this file is everything that touches a browser: the
 * fixed-step clock, the Arcade SDK contract (ready → state, suspend/resume,
 * records, save-import), the sheets, and handing core events to the renderer
 * and the sound pack.
 */

import * as Core from './core.js';
import { createRenderer } from './render.js';
import { bindInput } from './input.js';
import { initAudio, sfx } from './audio.js';

const STEP_MS = 1000 / Core.TICK_HZ;

const KITCHENS = [
  { id: 'home',   name: 'Home Kitchen', note: '3 flavors', flavors: 3 },
  { id: 'bistro', name: 'Bistro',       note: '4 flavors', flavors: 4 },
  { id: 'market', name: 'Spice Market', note: '5 flavors', flavors: 5 },
];
const FLAMES = [
  { name: 'Low', note: 'simmer' }, { name: 'Medium', note: 'boil' }, { name: 'High', note: 'rolling' },
];
const DISHES = [
  'Tomato Soup', 'Chili', 'Minestrone', 'Curry', 'Gumbo', 'Ratatouille', 'Pho', 'Goulash',
  'Paella', 'Tagine', 'Ramen', 'Bouillabaisse', 'Mole', 'Jambalaya', 'Laksa', 'Borscht',
  'Cioppino', 'Birria', 'Dal', 'Pozole', 'Rendang', 'Feijoada', 'Cassoulet', 'Vindaloo',
];
const MAX_START = 20;
const dishName = (level) => DISHES[level % DISHES.length];

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const R = createRenderer($('view'));

let s = null;                 // the core state, or null in the menu
let mode = 'menu';            // menu | play | paused | served | over
let prefs = { kitchen: 0, flame: 1, level: 0 };
let acc = 0;
let loop = null;

// ── sheets ───────────────────────────────────────────────────────────────
const SHEETS = { menu: 'menu', paused: 'paused', served: 'served', over: 'over' };
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
    b.append(it.name);
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

function renderHud() {
  if (!s) return;
  $('hud-level').textContent = `Dish ${s.level + 1}`;
  $('hud-dish').textContent = dishName(s.level);
  $('hud-score').textContent = s.score.toLocaleString();
  $('hud-left').textContent = String(Math.max(0, s.remaining));
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
        $('served-dish').textContent = `${dishName(s.level)}, table ${1 + (s.rng % 12)}.`;
        $('served-score').textContent = s.score.toLocaleString();
        renderHud();
        show('served');
        persistRun();
        break;
      }
      case 'over':
        sfx('over');
        record();
        $('over-dish').textContent = `${dishName(s.level)} — ${s.remaining} left to season.`;
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
  const paintLevel = () => { $('level').textContent = String(prefs.level + 1); };
  $('level-down').addEventListener('click', () => { prefs.level = Math.max(0, prefs.level - 1); paintLevel(); savePrefs(); });
  $('level-up').addEventListener('click', () => { prefs.level = Math.min(MAX_START - 1, prefs.level + 1); paintLevel(); savePrefs(); });

  function openMenu() {
    const run = Arcade.state.get('run');
    $('continue').hidden = !(run && run.s && run.s.v === 1 && run.s.phase !== 'over');
    paintKitchen(); paintFlame(); paintLevel(); renderBest();
    s = null;
    show('menu');
  }

  $('play').addEventListener('click', () => startNew(prefs.level));
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
  });

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
    window.__pepper = { get s() { return s; }, get mode() { return mode; }, emit, Core };
  }

  openMenu();
}

boot();
