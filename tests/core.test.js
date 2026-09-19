import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, nextLevel, tick, command, at, findMatches, pieceCells, ghostY,
  ingredientRows, WILD, LINK, CLEAR_TICKS, SETTLE_TICKS, MILL_CAP,
} from '../core.js';

// An empty pot with a known pinch in hand, for hand-built positions.
function empty(opts = {}) {
  const s = newGame({ seed: 7, ...opts });
  s.grid.fill(null);
  s.remaining = 99;
  s.events = [];
  return s;
}
const put = (s, x, y, f, extra = {}) => {
  s.grid[y * s.cols + x] = { f, ing: false, link: LINK.NONE, ...extra };
};
function run(s, max = 2000) {
  for (let i = 0; i < max && s.phase !== 'fall' && s.phase !== 'won' && s.phase !== 'over'; i++) tick(s);
}

test('same seed, same pot; different seed, different pot', () => {
  const a = newGame({ seed: 42, level: 5 });
  const b = newGame({ seed: 42, level: 5 });
  const c = newGame({ seed: 43, level: 5 });
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.next, b.next);
  assert.notDeepEqual(a.grid, c.grid);
});

test('state survives a JSON round trip mid-run', () => {
  const a = newGame({ seed: 3, level: 2 });
  for (let i = 0; i < 40; i++) tick(a);
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 600; i++) { tick(a); tick(b); }
  assert.deepEqual(a, b);
});

test('stocking: 4 per level, below the head-room, never a ready-made run', () => {
  for (const flavors of [3, 4, 5]) {
    for (const level of [0, 4, 10, 19, 24]) {
      const s = newGame({ seed: level * 31 + flavors, level, flavors });
      const ings = s.grid.filter(Boolean);
      assert.equal(s.remaining, ings.length);
      assert.equal(ings.length, Math.min(4 * (level + 1), Math.floor(8 * ingredientRows(16, level) * 0.8)));
      const top = 16 - ingredientRows(16, level);
      s.grid.forEach((c, i) => { if (c) assert.ok(((i / 8) | 0) >= top); });
      assert.equal(findMatches(s).size, 0);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
        const c = at(s, x, y);
        if (!c) continue;
        for (const [dx, dy] of [[2, 0], [0, 2]]) {
          const d = at(s, x + dx, y + dy);
          assert.ok(!d || d.f !== c.f, `same flavor two apart at ${x},${y}`);
        }
      }
    }
  }
});

test('moves stop at the walls; rotation kicks left off the right wall', () => {
  const s = empty();
  for (let i = 0; i < 10; i++) command(s, 'right');
  assert.equal(s.piece.x, 6);
  command(s, 'cw');                    // upright in column 6
  command(s, 'right');
  assert.equal(s.piece.x, 7);
  assert.equal(command(s, 'cw'), true); // lying down needs column 8: kick
  assert.equal(s.piece.x, 6);
  assert.equal(s.piece.o % 2, 0);
});

test('four full turns bring the pinch back, halves swapped half-way', () => {
  const s = empty();
  s.piece.a = 0; s.piece.b = 1; s.piece.y = 5;
  const before = pieceCells(s.piece).map((c) => c.join());
  command(s, 'cw'); command(s, 'cw');
  const half = pieceCells(s.piece);
  assert.deepEqual(half.map(([x, , , f]) => [x, f]).sort(), [[3, 1], [4, 0]]);
  command(s, 'cw'); command(s, 'cw');
  assert.deepEqual(pieceCells(s.piece).map((c) => c.join()), before);
});

test('hard drop lands on the ghost and four in a line clears', () => {
  const s = empty();
  put(s, 3, 15, 0); put(s, 3, 14, 0);
  s.piece.a = 0; s.piece.b = 0;
  command(s, 'cw');                    // upright over column 3
  assert.equal(ghostY(s), 13);
  command(s, 'hard');
  assert.equal(s.phase, 'clear');
  run(s);
  for (let y = 12; y < 16; y++) assert.equal(at(s, 3, y), null);
});

test('cutting the string: the surviving half falls, and can chain', () => {
  const s = empty();
  // Column 0: three reds at rows 9-11 on a plinth. Column 1: three golds at
  // rows 12-14 on an ingredient. A red|gold pinch lands across the two at row
  // 8: red completes column 0, the string is cut, and gold falls three rows
  // onto the golds for a second clear.
  put(s, 0, 15, 2); put(s, 0, 14, 1); put(s, 0, 13, 2); put(s, 0, 12, 1);
  put(s, 0, 11, 0); put(s, 0, 10, 0); put(s, 0, 9, 0);
  s.grid[15 * 8 + 1] = { f: 2, ing: true, link: 0 };
  put(s, 1, 14, 1); put(s, 1, 13, 1); put(s, 1, 12, 1);
  s.piece.a = 0; s.piece.b = 1;
  for (let i = 0; i < 5; i++) command(s, 'left');
  command(s, 'hard');
  const events = [];
  for (let i = 0; i < 400 && s.phase !== 'fall'; i++) { tick(s); events.push(...s.events.splice(0)); }
  const clears = events.filter((e) => e.type === 'clear');
  assert.equal(clears.length, 2);
  assert.deepEqual(clears.map((e) => e.chain), [1, 2]);
  assert.equal(at(s, 1, 12), null);
  assert.ok(s.mill >= 2, 'a chain charges the mill');
});

test('tied pairs fall together or not at all', () => {
  const s = empty();
  s.grid[15 * 8 + 5] = { f: 2, ing: true, link: 0 };   // holds up the right half
  put(s, 4, 10, 0, { link: LINK.RIGHT });
  put(s, 5, 10, 1, { link: LINK.LEFT });
  put(s, 0, 3, 0, { link: LINK.DOWN });
  put(s, 0, 4, 1, { link: LINK.UP });
  s.piece = null; s.phase = 'settle'; s.t = 1;
  run(s);
  assert.equal(at(s, 4, 14).f, 0);     // stopped with its partner, above the ingredient
  assert.equal(at(s, 5, 14).f, 1);
  assert.equal(at(s, 4, 15), null);
  assert.equal(at(s, 0, 14).f, 0);
  assert.equal(at(s, 0, 15).f, 1);
});

test('ingredients never fall', () => {
  const s = empty();
  s.grid[5 * 8 + 2] = { f: 0, ing: true, link: 0 };
  s.piece = null; s.phase = 'settle'; s.t = 1;
  run(s);
  assert.ok(at(s, 2, 5).ing);
});

test('a peppercorn completes a run, but four peppercorns are not a run', () => {
  const s = empty();
  put(s, 0, 15, 1); put(s, 1, 15, 1); put(s, 2, 15, WILD); put(s, 3, 15, 1);
  assert.equal(findMatches(s).size, 4);
  s.grid.fill(null);
  for (let x = 0; x < 4; x++) put(s, x, 15, WILD);
  assert.equal(findMatches(s).size, 0);
});

test('scoring doubles per ingredient within a turn; clearing the last wins', () => {
  const s = empty({ flame: 0 });
  for (let y = 13; y < 16; y++) s.grid[y * 8 + 3] = { f: 0, ing: true, link: 0 };
  s.remaining = 3;
  s.piece.a = 0; s.piece.b = 0;
  command(s, 'cw');
  command(s, 'hard');
  run(s);
  assert.equal(s.score, 100 + 200 + 400);
  assert.equal(s.phase, 'won');
  assert.equal(s.mill, 2);
  nextLevel(s);
  assert.equal(s.level, 1);
  assert.equal(s.remaining, 8);
  assert.equal(s.score, 700, 'score carries');
});

test('a full mill puts a peppercorn in the next pinch, once', () => {
  const s = empty();
  s.mill = MILL_CAP;
  command(s, 'hard');
  run(s);
  assert.equal(s.next.a, WILD);
  assert.equal(s.mill, 0);
  command(s, 'hard');
  run(s);
  assert.equal(s.piece.a, WILD);
  assert.notEqual(s.next.a, WILD);
});

test('the pot boils over when the mouth is blocked', () => {
  const s = empty();
  put(s, 3, 0, 0);
  s.piece.x = 0;
  command(s, 'hard');
  run(s);
  assert.equal(s.phase, 'over');
});

test('soft drop locks on contact; a resting pinch gets slide time otherwise', () => {
  const s = empty();
  s.piece.y = 15;
  tick(s); tick(s);
  assert.equal(s.phase, 'fall', 'still sliding');
  command(s, 'left');
  assert.equal(s.piece.x, 2);
  command(s, 'softOn');
  tick(s);
  assert.ok(at(s, 2, 15), 'locked');
});

void CLEAR_TICKS; void SETTLE_TICKS;
