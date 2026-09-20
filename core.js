/* core.js — Mr Pepper's rules, and nothing else.
 *
 * No DOM, no clock, no Math.random: the whole game is `tick(state)` plus
 * `command(state, cmd)` over a plain JSON-able state with a seeded RNG inside
 * it. That is what makes a run saveable on suspend, a Daily Special
 * reproducible, the rules testable under `node --test`, and — later — versus
 * a matter of exchanging chain events between two independent sims.
 *
 * The board is `cols × rows`, row 0 at the top. A cell is null or
 *   { f, ing, link }   f: flavor id (WILD for a peppercorn)
 *                      ing: true for an ingredient (never falls)
 *                      link: which neighbour this spice half is tied to
 * One tick is 1/60 s. Things the renderer or the sound wants to know about
 * are pushed on `state.events`, which the caller drains after every tick.
 */

export const WILD = 9;
export const LINK = { NONE: 0, UP: 1, RIGHT: 2, DOWN: 3, LEFT: 4 };
const DX = [0, 0, 1, 0, -1];
const DY = [0, -1, 0, 1, 0];
const OPPOSITE = [0, 3, 4, 1, 2];

export const TICK_HZ = 60;
export const CLEAR_TICKS = 20;      // how long a cleared run flashes before it goes
export const SETTLE_TICKS = 7;      // one row of orphan fall
export const SOFT_TICKS = 2;        // rows fall this fast while soft-dropping
export const LOCK_MIN_TICKS = 26;   // slide time on the ground, however hot the flame
export const MILL_CAP = 5;
const FLAME_BASE = [46, 30, 18];    // ticks per row: low, medium, high
export const FLAME_POINTS = [100, 200, 300];   // per ingredient seasoned, before doubling
const MIN_INTERVAL = 5;

// ── seeded randomness (mulberry32, state kept in s.rng) ──────────────────
function rand(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s, n) => Math.floor(rand(s) * n);

// ── board helpers ────────────────────────────────────────────────────────
const idx = (s, x, y) => y * s.cols + x;
export function at(s, x, y) {
  if (x < 0 || x >= s.cols || y < 0 || y >= s.rows) return undefined;
  return s.grid[idx(s, x, y)];
}

/* The two halves of the falling pinch, as [x, y, link, flavor]. (x, y) is the
 * bottom-left of its bounding box; clockwise from horizontal puts `a` on top. */
export function pieceCells(p) {
  switch (p.o) {
    case 0: return [[p.x, p.y, LINK.RIGHT, p.a], [p.x + 1, p.y, LINK.LEFT, p.b]];
    case 1: return [[p.x, p.y - 1, LINK.DOWN, p.a], [p.x, p.y, LINK.UP, p.b]];
    case 2: return [[p.x + 1, p.y, LINK.LEFT, p.a], [p.x, p.y, LINK.RIGHT, p.b]];
    default: return [[p.x, p.y, LINK.UP, p.a], [p.x, p.y - 1, LINK.DOWN, p.b]];
  }
}

// Above the rim (y < 0) is open air: a pinch may stand half out of the pot.
function fits(s, p) {
  for (const [x, y] of pieceCells(p)) {
    if (x < 0 || x >= s.cols || y >= s.rows) return false;
    if (y >= 0 && s.grid[idx(s, x, y)]) return false;
  }
  return true;
}

export function ghostY(s) {
  if (!s.piece) return 0;
  const p = { ...s.piece };
  while (fits(s, { ...p, y: p.y + 1 })) p.y++;
  return p.y;
}

// ── level generation ─────────────────────────────────────────────────────
/* Ingredients sit in the lower part of the pot, never closer than the classic
 * rule allows: no same flavor two cells away in a line, so nothing starts as
 * a run of three. Head-room shrinks as levels climb. */
export function ingredientRows(rows, level) {
  const head = level >= 19 ? 3 : level >= 17 ? 4 : level >= 15 ? 5 : 6;
  return Math.max(2, rows - head);
}

/* How many ingredients a dish is stocked with. */
export function stockCount(cols, rows, level) {
  return Math.min(4 * (level + 1), Math.floor(cols * ingredientRows(rows, level) * 0.8));
}

function stock(s) {
  const h = ingredientRows(s.rows, s.level);
  const top = s.rows - h;
  const want = stockCount(s.cols, s.rows, s.level);
  let placed = 0;
  for (let tries = 0; placed < want && tries < 4000; tries++) {
    const x = randInt(s, s.cols);
    const y = top + randInt(s, h);
    if (s.grid[idx(s, x, y)]) continue;
    const first = (placed + randInt(s, s.flavors)) % s.flavors;
    for (let k = 0; k < s.flavors; k++) {
      const f = (first + k) % s.flavors;
      let ok = true;
      for (let d = 1; d <= 4 && ok; d++) {
        const c = at(s, x + DX[d] * 2, y + DY[d] * 2);
        if (c && c.f === f) ok = false;
      }
      if (!ok) continue;
      s.grid[idx(s, x, y)] = { f, ing: true, link: LINK.NONE };
      placed++;
      break;
    }
  }
  s.remaining = placed;
}

function rollPinch(s) {
  return { a: randInt(s, s.flavors), b: randInt(s, s.flavors) };
}

// ── lifecycle ────────────────────────────────────────────────────────────
export function newGame(opts = {}) {
  const s = {
    v: 1,
    cols: opts.cols || 8,
    rows: opts.rows || 16,
    flavors: opts.flavors || 3,
    flame: opts.flame == null ? 1 : opts.flame,
    level: opts.level || 0,
    rng: (opts.seed == null ? 1 : opts.seed) >>> 0,
    score: 0,
    mill: 0,
    events: [],
  };
  startLevel(s);
  return s;
}

export function nextLevel(s) {
  s.level++;
  startLevel(s);
}

function startLevel(s) {
  s.grid = new Array(s.cols * s.rows).fill(null);
  s.pieces = 0;
  s.maxChain = 0;
  s.chain = 0;
  s.turnIngs = 0;
  s.soft = false;
  s.piece = null;
  s.dying = [];
  s.t = 0;
  stock(s);
  s.total = s.remaining;
  s.next = rollPinch(s);
  s.events.push({ type: 'level', level: s.level });
  spawn(s);
}

function interval(s) {
  const base = FLAME_BASE[s.flame] * Math.pow(0.94, Math.floor(s.pieces / 10));
  return Math.max(MIN_INTERVAL, Math.round(base));
}

function spawn(s) {
  const p = { x: (s.cols >> 1) - 1, y: 0, o: 0, a: s.next.a, b: s.next.b };
  s.next = rollPinch(s);
  if (s.mill >= MILL_CAP) {
    s.mill = 0;
    s.next.a = WILD;
    s.events.push({ type: 'mill' });
  }
  s.chain = 0;
  s.turnIngs = 0;
  s.soft = false;
  s.fallT = 0;
  s.lockT = 0;
  if (!fits(s, p)) {
    s.piece = null;
    s.phase = 'over';
    s.events.push({ type: 'over' });
    return;
  }
  s.piece = p;
  s.pieces++;
  s.phase = 'fall';
  s.events.push({ type: 'spawn' });
}

// ── player commands ──────────────────────────────────────────────────────
export function command(s, cmd) {
  if (cmd === 'softOff') { s.soft = false; return true; }
  if (s.phase !== 'fall') return false;
  const p = s.piece;
  switch (cmd) {
    case 'softOn': s.soft = true; return true;
    case 'left':
    case 'right': {
      const q = { ...p, x: p.x + (cmd === 'left' ? -1 : 1) };
      if (!fits(s, q)) return false;
      s.piece = q;
      s.events.push({ type: 'move' });
      return true;
    }
    case 'cw':
    case 'ccw': {
      const q = { ...p, o: (p.o + (cmd === 'cw' ? 1 : 3)) % 4 };
      // Lying down against a wall or a neighbour: kick one cell left.
      const kicked = { ...q, x: q.x - 1 };
      const r = fits(s, q) ? q : (q.o % 2 === 0 && fits(s, kicked)) ? kicked : null;
      if (!r) return false;
      s.piece = r;
      s.events.push({ type: 'rotate' });
      return true;
    }
    case 'hard':
      p.y = ghostY(s);
      lock(s);
      return true;
    default:
      return false;
  }
}

// ── the tick ─────────────────────────────────────────────────────────────
export function tick(s) {
  switch (s.phase) {
    case 'fall': {
      const p = s.piece;
      const grounded = !fits(s, { ...p, y: p.y + 1 });
      const step = s.soft ? Math.min(SOFT_TICKS, interval(s)) : interval(s);
      if (grounded) {
        s.lockT++;
        if (s.soft || s.lockT >= Math.max(step, LOCK_MIN_TICKS)) lock(s);
      } else if (++s.fallT >= step) {
        p.y++;
        s.fallT = 0;
        s.lockT = 0;
      }
      break;
    }
    case 'clear':
      if (--s.t <= 0) {
        for (const i of s.dying) s.grid[i] = null;
        s.dying = [];
        s.phase = 'settle';
        s.t = SETTLE_TICKS;
      }
      break;
    case 'settle':
      if (--s.t <= 0) {
        if (settleStep(s)) s.t = SETTLE_TICKS;
        else resolve(s);
      }
      break;
    default:
      break;
  }
}

function lock(s) {
  for (const [x, y, link, f] of pieceCells(s.piece)) {
    if (y < 0) continue;                    // the half above the rim is lost
    s.grid[idx(s, x, y)] = { f, ing: false, link };
  }
  // A half whose partner never made it into the pot is a loose spice.
  for (const [x, y, link] of pieceCells(s.piece)) {
    if (y < 0) continue;
    if (!at(s, x + DX[link], y + DY[link])) s.grid[idx(s, x, y)].link = LINK.NONE;
  }
  s.piece = null;
  s.events.push({ type: 'lock' });
  resolve(s);
}

/* Every run of four or more in a line, per flavor. A peppercorn stands in for
 * whatever flavor the run needs, but a run has to contain the real thing. */
export function findMatches(s) {
  const hit = new Set();
  const scan = (len, other, cellIndex) => {
    for (let f = 0; f < s.flavors; f++) {
      for (let j = 0; j < other; j++) {
        let start = 0;
        let real = 0;
        for (let i = 0; i <= len; i++) {
          const c = i < len ? s.grid[cellIndex(i, j)] : null;
          const ok = c && (c.f === f || c.f === WILD);
          if (ok) { if (c.f === f) real++; continue; }
          if (i - start >= 4 && real > 0) {
            for (let k = start; k < i; k++) hit.add(cellIndex(k, j));
          }
          start = i + 1;
          real = 0;
        }
      }
    }
  };
  scan(s.cols, s.rows, (i, j) => j * s.cols + i);   // rows
  scan(s.rows, s.cols, (i, j) => i * s.cols + j);   // columns
  return hit;
}

/* The tell: every cell that would dissolve if the pinch in hand were dropped
 * where it hangs — the landed halves included. Empty when it makes nothing.
 * Reads the state, never writes it. */
export function landingMatches(s) {
  if (!s.piece || s.phase !== 'fall') return new Set();
  const grid = s.grid.slice();
  const dy = ghostY(s) - s.piece.y;
  for (const [x, y, link, f] of pieceCells(s.piece)) {
    if (y + dy >= 0) grid[idx(s, x, y + dy)] = { f, ing: false, link };
  }
  return findMatches({ ...s, grid });
}

function resolve(s) {
  const hit = findMatches(s);
  if (hit.size === 0) { endTurn(s); return; }
  s.chain++;
  s.maxChain = Math.max(s.maxChain || 0, s.chain);
  let ings = 0;
  const flavors = [];
  for (const i of hit) {
    const c = s.grid[i];
    if (c.ing) {
      ings++;
      s.turnIngs++;
      s.score += FLAME_POINTS[s.flame] * Math.pow(2, Math.min(s.turnIngs, 6) - 1);
    }
    if (c.f !== WILD && !flavors.includes(c.f)) flavors.push(c.f);
    // Cut the string: the surviving half becomes a loose spice.
    if (c.link) {
      const x = i % s.cols, y = (i / s.cols) | 0;
      const partner = at(s, x + DX[c.link], y + DY[c.link]);
      if (partner && partner.link === OPPOSITE[c.link]) partner.link = LINK.NONE;
    }
  }
  s.remaining -= ings;
  s.dying = [...hit];
  s.phase = 'clear';
  s.t = CLEAR_TICKS;
  s.events.push({ type: 'clear', chain: s.chain, ings, cells: s.dying.slice(), flavors });
}

/* One row of fall for everything unsupported. Bottom-up, so a unit moves at
 * most one row per step and a stack falls together. Tied pairs fall as one. */
function settleStep(s) {
  let moved = false;
  const free = (x, y) => y < s.rows && !s.grid[idx(s, x, y)];
  const drop = (x, y) => {
    s.grid[idx(s, x, y + 1)] = s.grid[idx(s, x, y)];
    s.grid[idx(s, x, y)] = null;
    moved = true;
  };
  for (let y = s.rows - 2; y >= 0; y--) {
    for (let x = 0; x < s.cols; x++) {
      const c = s.grid[idx(s, x, y)];
      if (!c || c.ing || c.link === LINK.LEFT) continue;
      if (c.link === LINK.RIGHT) {
        if (free(x, y + 1) && free(x + 1, y + 1)) { drop(x, y); drop(x + 1, y); }
      } else if (free(x, y + 1)) {
        // A vertical pair: the lower half goes first (rows are walked
        // bottom-up), which is what opens the cell under the upper half.
        drop(x, y);
      }
    }
  }
  if (moved) s.events.push({ type: 'settle' });
  return moved;
}

function endTurn(s) {
  s.mill = Math.min(MILL_CAP, s.mill + Math.max(0, s.turnIngs - 1) + 2 * Math.max(0, s.chain - 1));
  if (s.remaining <= 0) {
    s.phase = 'won';
    s.events.push({ type: 'won' });
    return;
  }
  spawn(s);
}

/* How hot the flame is right now, 0..1 — for the renderer and the sound. */
export function heat(s) {
  return 1 - (interval(s) - MIN_INTERVAL) / (FLAME_BASE[0] - MIN_INTERVAL);
}

/* How close the pot is to boiling over, 0..1: the highest spice or
 * ingredient in the two spawn columns and their neighbours. */
export function danger(s) {
  const mid = s.cols >> 1;
  for (let y = 0; y < s.rows; y++) {
    for (let x = mid - 2; x <= mid + 1; x++) {
      if (at(s, x, y)) return Math.max(0, 1 - y / 5);
    }
  }
  return 0;
}
