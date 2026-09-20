/* input.js — hands to commands. The whole screen is the control surface:
 *
 *   drag sideways      move, one column per ~cell of travel (relative, so
 *                      your finger never has to cover the pinch)
 *   tap left / right   turn counter-clockwise / clockwise
 *   press and hold     soft drop, until you let go
 *   drag down & hold   soft drop, until you let go
 *   flick down         throw it to the bottom — works mid-drop too, as long
 *                      as the piece you started dragging is still falling
 *
 * Keyboard: ←/→ move (with auto-repeat), ↓ soft drop, ↑ or X clockwise,
 * Z counter-clockwise, Space hard drop, P or Esc pause.
 */

const TAP_MS = 300;
const TAP_SLOP = 10;
const HOLD_MS = 200;
const HOLD_SLOP = 5;   // tighter than TAP_SLOP: any real drag should cancel the hold fast
const DAS_MS = 170;
const ARR_MS = 45;

export function bindInput(el, { emit, cell, onPause, active, pieces }) {
  let g = null;   // the gesture in flight

  el.addEventListener('pointerdown', (e) => {
    if (g) return;
    g = {
      id: e.pointerId, t0: e.timeStamp, x0: e.clientX, y0: e.clientY,
      stepX: e.clientX, softY: e.clientY, moved: false, soft: false,
      trail: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
      holdTimer: 0, piece0: pieces(),
    };
    // A finger that just sits there for a beat drops faster too — no drag needed.
    const held = g;
    held.holdTimer = setTimeout(() => {
      if (g !== held || held.soft) return;
      held.soft = true;
      emit('softOn');
    }, HOLD_MS);
    try { el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const c = cell();
    const step = c * 0.85;
    // Any real movement — including the start of a slow horizontal drag —
    // cancels the stationary-hold timer so it can't hijack the drag.
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > HOLD_SLOP) clearTimeout(g.holdTimer);
    while (e.clientX - g.stepX >= step) { emit('right'); g.stepX += step; g.moved = true; g.softY = e.clientY; }
    while (g.stepX - e.clientX >= step) { emit('left'); g.stepX -= step; g.moved = true; g.softY = e.clientY; }
    if (!g.soft && e.clientY - g.softY > c * 1.1) { g.soft = true; emit('softOn'); }
    g.trail.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (g.trail.length > 12) g.trail.shift();
  });

  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const c = cell();
    const done = g; g = null;
    clearTimeout(done.holdTimer);
    if (done.soft) emit('softOff');
    if (e.type === 'pointercancel') return;
    // Soft-dropping (drag or hold) can lock the piece the instant it grounds,
    // with no delay. If that already happened mid-gesture, a flick recognized
    // at release would slam whatever spawned next — so once the piece has
    // moved on, the gesture is spent. Still falling? A flick still slams it.
    if (pieces() !== done.piece0) return;
    // a flick: fast and mostly downward over the last ~120 ms
    const then = done.trail.find((p) => e.timeStamp - p.t <= 120) || done.trail[0];
    const dt = Math.max(1, e.timeStamp - then.t);
    const dy = e.clientY - then.y, dx = e.clientX - then.x;
    if (dy > c * 0.8 && dy / dt > c * 0.012 && Math.abs(dx) < dy * 0.6) { emit('hard'); return; }
    const still = Math.hypot(e.clientX - done.x0, e.clientY - done.y0) < TAP_SLOP;
    if (!done.moved && !done.soft && still && e.timeStamp - done.t0 < TAP_MS) {
      const r = el.getBoundingClientRect();
      emit(e.clientX < r.left + r.width / 2 ? 'ccw' : 'cw');
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── keyboard ───────────────────────────────────────────────────────────
  const held = new Map();   // key → { delay, repeat } timers
  const release = (k) => {
    const h = held.get(k);
    if (!h) return;
    clearTimeout(h.delay); clearInterval(h.repeat);
    held.delete(k);
  };
  const autoRepeat = (k, cmd) => {
    emit(cmd);
    const h = { delay: 0, repeat: 0 };
    h.delay = setTimeout(() => { h.repeat = setInterval(() => emit(cmd), ARR_MS); }, DAS_MS);
    held.set(k, h);
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    // Outside play the keys belong to the menus (Space presses buttons).
    if (!active()) { if (k === 'p' || k === 'P' || k === 'Escape') onPause(); return; }
    let used = true;
    if (k === 'ArrowLeft') { release('ArrowRight'); autoRepeat(k, 'left'); }
    else if (k === 'ArrowRight') { release('ArrowLeft'); autoRepeat(k, 'right'); }
    else if (k === 'ArrowDown') emit('softOn');
    else if (k === 'ArrowUp' || k === 'x' || k === 'X') emit('cw');
    else if (k === 'z' || k === 'Z') emit('ccw');
    else if (k === ' ') emit('hard');
    else if (k === 'p' || k === 'P' || k === 'Escape') onPause();
    else used = false;
    if (used) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') emit('softOff');
    release(e.key);
  });
  window.addEventListener('blur', () => { for (const k of [...held.keys()]) release(k); });
}
