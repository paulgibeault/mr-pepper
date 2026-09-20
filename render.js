/* render.js — the pot, drawn. Reads core state, never writes it.
 *
 * Three layers of thrift, because this runs on a phone's battery:
 *   scene.js   everything still (wall, pot, broth, stove), painted once
 *   sprites    each piece cached per cell size; a frame is a few dozen blits
 *   the key    draw() returns early unless the picture would change — a pinch
 *              hanging between two ticks costs nothing
 */

import { pieceCells, ghostY, heat, danger, landingMatches, CLEAR_TICKS, MILL_CAP, LINK } from './core.js';
import { FLAVORS, flavor, drawSpice, drawIngredient, drawTwine } from './sprites.js';
import { createScene } from './scene.js';
import { createFlame } from './flame.js';
import { loadAssets } from './assets.js';

export { FLAVORS };

const STOCK = [58, 40, 26];            // the broth before anything has gone in

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── layout ───────────────────────────────────────────────────────────────
/* The pot takes every pixel a small screen has: 8×16 is 1:2, a phone is about
 * 1:2.17, and the difference is the order rail above and the burner below. On
 * a wide screen the pot is bound by height and simply sits in the middle. */
export function layout(W, H, cols, rows) {
  const hudH = Math.max(64, Math.min(96, H * 0.113));
  const cell = Math.max(8, Math.floor(Math.min((W - 8) / (cols + 0.7), (H - hudH - 4) / (rows + 1.7))));
  const potW = cols * cell, potH = rows * cell;
  const spare = H - hudH - (rows + 1.7) * cell;
  const wall = Math.round(cell * 0.22);
  const x0 = Math.round((W - potW) / 2);
  const y0 = Math.round(hudH + cell * 0.4 + spare * 0.35);
  const top = y0 + potH + wall;          // the underside of the pot
  const room = Math.min(cell * 1.3, H - top);
  return {
    W, H, cell, hudH, potW, potH, wall, x0, y0,
    handX: W / 2, handY: hudH * 0.5,
    burner: { x: W / 2, y: top + room * 0.78, r: cell * 2.05, top, room },
  };
}
// ── the renderer ─────────────────────────────────────────────────────────
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let L = layout(320, 640, 8, 16);
  let dpr = 1;
  let cols = 8;
  const sprites = new Map();
  const scene = createScene();
  const flame = createFlame();
  const view = {
    tint: STOCK.slice(), particles: [], spawnAt: -1e9, flash: 0, motion: true, aids: true,
    painted: 0,                        // frames actually drawn — the rest were skipped
  };
  let stale = true;                      // the whole scene needs repainting
  let steeped = false;                   // only the broth does
  let lastKey = '';
  const art = loadAssets(() => { sprites.clear(); stale = true; lastKey = ''; view.onArt?.(); });

  function sprite(kind, f) {
    const key = `${kind}:${f}`;
    let sp = sprites.get(key);
    if (!sp) {
      const px = Math.ceil(L.cell * dpr);
      sp = document.createElement('canvas');
      sp.width = sp.height = px;
      const c = sp.getContext('2d');
      c.scale(px, px);
      if (kind === 'i') drawIngredient(c, f, art[`ing${f}`]); else drawSpice(c, f);
      sprites.set(key, sp);
    }
    return sp;
  }

  function resize(W, H, nCols, rows) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    L = layout(W, H, nCols, rows);
    cols = nCols;
    sprites.clear();
    stale = true;
    return L;
  }

  function blit(sp, x, y, scale = 1) {
    const c = L.cell, d = c * scale, o = (c - d) / 2;
    ctx.drawImage(sp, x + o, y + o, d, d);
  }

  function pinch(cells, ox, oy) {
    for (const [cx, cy, , f] of cells) blit(sprite('s', f), ox + cx * L.cell, oy + cy * L.cell);
    for (const [cx, cy, link] of cells) drawTwine(ctx, ox + cx * L.cell, oy + cy * L.cell, link, L.cell);
  }

  function drawDanger(s) {
    const d = danger(s);
    if (d <= 0) return;
    const { x0, y0, potW, cell } = L;
    const glow = ctx.createLinearGradient(0, y0, 0, y0 + cell * 5);
    glow.addColorStop(0, `rgba(255,70,40,${0.45 * d})`); glow.addColorStop(1, 'rgba(255,70,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(x0, y0, potW, cell * 5);
  }

  function drawCells(s) {
    const { x0, y0, cell } = L;
    const dying = s.phase === 'clear' ? new Set(s.dying) : null;
    const k = dying ? 1 - s.t / CLEAR_TICKS : 0;
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c) continue;
      const x = x0 + (i % s.cols) * cell, y = y0 + ((i / s.cols) | 0) * cell;
      const sp = sprite(c.ing ? 'i' : 's', c.f);
      if (dying && dying.has(i)) {
        // white-hot, a ring going out, then gone
        blit(sp, x, y, k < 0.4 ? 1.1 : Math.max(0, 1 - (k - 0.4) / 0.6));
        const cx = x + cell / 2, cy = y + cell / 2;
        if (k < 0.4) {
          ctx.fillStyle = `rgba(255,248,230,${0.75 - k})`;
          ctx.beginPath(); ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,225,190,${0.9 * (1 - k)})`; ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.arc(cx, cy, cell * (0.4 + 0.5 * k), 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      blit(sp, x, y);
    }
    // cords go on last, so the bowl drawn after never covers half of one
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c || c.ing || !c.link || (dying && dying.has(i))) continue;
      drawTwine(ctx, x0 + (i % s.cols) * cell, y0 + ((i / s.cols) | 0) * cell, c.link, cell);
    }
  }

  // The tell is a full match scan, so it is worked out once per position of
  // the pinch, not per frame. The pot cannot change while a pinch is falling.
  const NONE = new Set();
  let tellKey = '', tell = NONE;
  function tellFor(s) {
    const p = s.piece, key = `${s.rng}:${s.pieces}:${p.x}:${p.o}`;
    if (key !== tellKey) { tellKey = key; tell = landingMatches(s); }
    return tell;
  }

  function drawPiece(s, now) {
    if (!s.piece || s.phase !== 'fall') return;
    const { x0, y0, cell } = L;
    const cells = pieceCells(s.piece);
    const gy = ghostY(s) - s.piece.y;
    if (gy > 0) {
      const hits = view.aids ? tellFor(s) : NONE;
      if (view.aids) {
        // the drop lane: a breath of light from the pinch down to where it lands
        for (const [cx, cy] of cells) {
          const top = y0 + (cy + 1) * cell, h = (gy - 1) * cell;
          if (h <= 0) continue;
          const lane = ctx.createLinearGradient(0, top, 0, top + h);
          lane.addColorStop(0, 'rgba(255,236,200,0)'); lane.addColorStop(1, 'rgba(255,236,200,0.07)');
          ctx.fillStyle = lane; ctx.fillRect(x0 + cx * cell, top, cell, h);
        }
        // the tell: the run this drop would make lights up
        ctx.lineWidth = Math.max(1, cell * 0.03);
        for (const i of hits) {
          if (!s.grid[i]) continue;
          ctx.strokeStyle = flavor(s.grid[i].f).light; ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.arc(x0 + ((i % s.cols) + 0.5) * cell, y0 + (((i / s.cols) | 0) + 0.5) * cell, cell * 0.46, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // where it will land — solid and bright when that half completes a run
      ctx.lineWidth = Math.max(1.5, cell * 0.05);
      for (const [cx, cy, , f] of cells) {
        if (cy + gy < 0) continue;
        const sure = view.aids && hits.has((cy + gy) * s.cols + cx);
        ctx.setLineDash(sure ? [] : [cell * 0.14, cell * 0.1]);
        ctx.strokeStyle = flavor(f).light; ctx.globalAlpha = sure ? 0.95 : 0.55;
        ctx.beginPath();
        ctx.arc(x0 + (cx + 0.5) * cell, y0 + (cy + gy + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // the throw: out of your hand, over the rim, into the mouth of the pot
    const k = throwing(now);
    if (k < 1) {
      const tx = x0 + (s.piece.x + 1) * cell, ty = y0 + (s.piece.y + 0.5) * cell;
      const px = L.handX + (tx - L.handX) * k, py = L.handY + (ty - L.handY) * k - Math.sin(k * Math.PI) * cell * 0.8;
      pinch(cells, px - (s.piece.x + 1) * cell, py - (s.piece.y + 0.5) * cell);
    } else {
      pinch(cells, x0, y0);
    }
  }
  const throwing = (now) => (view.motion ? Math.min(1, (now - view.spawnAt) / 170) : 1);

  function drawHand(s) {
    const c = L.cell, sc = Math.min(1, (L.hudH * 0.36) / c);
    const px = Math.ceil(c * sc);
    const x = Math.round(L.handX - px), y = Math.round(L.handY - px / 2);
    ctx.drawImage(sprite('s', s.next.a), x, y, px, px);
    ctx.drawImage(sprite('s', s.next.b), x + px, y, px, px);
    drawTwine(ctx, x, y, LINK.RIGHT, px);
    // the mill: five peppercorns, filling as you chain
    const r = Math.max(2.5, L.hudH * 0.042), gap = r * 3.1;
    for (let i = 0; i < MILL_CAP; i++) {
      ctx.beginPath();
      ctx.arc(L.handX + (i - (MILL_CAP - 1) / 2) * gap, y + px + r * 2.6, r, 0, Math.PI * 2);
      ctx.fillStyle = i < s.mill ? '#f4ebdd' : 'rgba(255,255,255,0.16)';
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    const ps = view.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += 0.0006 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / 300);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /* Everything the picture depends on, as a string. Same key, same picture:
   * skip the frame. Anything running on the wall clock (the throw, powder,
   * the flash) forces frames only while it lasts. */
  function frameKey(s, now) {
    const f = flame.key(now, view.motion);
    if (!s) return f;
    const p = s.piece;
    return `${f}|${s.phase}|${s.t}|${s.score}|${s.mill}|${s.pieces}|${s.level}|${p ? `${p.x},${p.y},${p.o}` : ''}`;
  }

  let last = 0, wasLive = false;
  function draw(s, now) {
    const dt = Math.min(50, now - last); last = now;
    const live = s && (throwing(now) < 1 || view.particles.length > 0 || view.flash > 0);
    const key = frameKey(s, now);
    // one more frame after anything live ends, so its last picture is the resting one
    if (!stale && !steeped && !live && !wasLive && key === lastKey) return;
    wasLive = !!live;
    lastKey = key;
    view.painted++;
    if (stale) { scene.paint(L, dpr, art, view.tint, cols); stale = false; steeped = false; }
    if (steeped) { scene.steep(L, art, view.tint, cols); steeped = false; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scene.canvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    flame.draw(ctx, L, dpr, s ? heat(s) : 0.35, now, view.motion);
    if (!s) return;
    drawDanger(s);
    drawCells(s);
    drawPiece(s, now);
    drawParticles(dt);
    if (view.flash > 0) {
      ctx.fillStyle = `rgba(255,190,90,${view.flash * 0.35})`;
      ctx.fillRect(L.x0, L.y0, L.potW, L.potH);
      view.flash = Math.max(0, view.flash - dt / 260);
    }
    drawHand(s);
  }

  /* A run dissolved: the broth takes its colour, and powder drifts down. */
  function dissolved(s, cells) {
    for (const i of cells) {
      const c = s.grid[i];
      if (!c) continue;
      const rgb = hexRgb(flavor(c.f).color);
      for (let k = 0; k < 3; k++) view.tint[k] += (rgb[k] * 0.55 - view.tint[k]) * 0.035;
      if (!view.motion || view.particles.length > 220) continue;
      const x = L.x0 + ((i % s.cols) + 0.5) * L.cell, y = L.y0 + (((i / s.cols) | 0) + 0.5) * L.cell;
      for (let n = 0; n < 6; n++) {
        view.particles.push({
          x, y, vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.08,
          life: 500 + Math.random() * 500, size: Math.max(2, L.cell * 0.09),
          color: Math.random() < 0.5 ? flavor(c.f).color : flavor(c.f).light,
        });
      }
    }
    steeped = true;                      // the broth changed colour; the rest of the scene has not
  }

  /* The middle of a set of cells, in CSS px on the stage — for the callout. */
  function centreOf(s, cells) {
    let x = 0, y = 0;
    for (const i of cells) { x += (i % s.cols) + 0.5; y += ((i / s.cols) | 0) + 0.5; }
    const n = Math.max(1, cells.length);
    return { x: L.x0 + (x / n) * L.cell, y: L.y0 + (y / n) * L.cell };
  }

  return {
    resize, draw, dissolved, centreOf, view,
    get layout() { return L; },
    invalidate() { lastKey = ''; },
    freshBroth() { view.tint = STOCK.slice(); view.particles.length = 0; stale = true; },
  };
}
