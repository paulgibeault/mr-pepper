/* render.js — the pot, drawn. Reads core state, never writes it.
 *
 * Every flavor is a colour AND a shape, on spices and on the badge each
 * ingredient carries, so nothing in the game is told apart by hue alone.
 * Cells are cached as sprites per cell size; a frame is a few dozen blits.
 */

import { WILD, LINK, pieceCells, ghostY, heat, danger, CLEAR_TICKS, MILL_CAP } from './core.js';

export const FLAVORS = [
  { name: 'Heat',  color: '#e5484d', dark: '#8a1c21', light: '#ffb3b0' },
  { name: 'Earth', color: '#f0b429', dark: '#8a5a00', light: '#ffe7a3' },
  { name: 'Herb',  color: '#46a758', dark: '#1c5a2b', light: '#b4ecbf' },
  { name: 'Sour',  color: '#9d6ce0', dark: '#4a2885', light: '#dcc8ff' },
  { name: 'Brine', color: '#4fb3e8', dark: '#175a85', light: '#c4eaff' },
];
const PEPPER = { name: 'Pepper', color: '#3a3533', dark: '#0e0d0c', light: '#b8b0aa' };
const flavor = (f) => (f === WILD ? PEPPER : FLAVORS[f]);

const STOCK = [58, 40, 26];            // the broth before anything has gone in
const TWINE = '#dccba4';

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── glyphs, in a unit box centred on (0,0), about ±0.22 ──────────────────
function glyph(c, f) {
  c.beginPath();
  switch (f) {
    case 0:                             // Heat: a diamond
      c.moveTo(0, -0.24); c.lineTo(0.18, 0); c.lineTo(0, 0.24); c.lineTo(-0.18, 0);
      c.closePath(); c.fill(); break;
    case 1:                             // Earth: a seed — a ring
      c.arc(0, 0, 0.17, 0, Math.PI * 2);
      c.lineWidth = 0.09; c.stroke(); break;
    case 2:                             // Herb: a leaf
      c.moveTo(-0.19, 0.19);
      c.quadraticCurveTo(-0.2, -0.2, 0.2, -0.2);
      c.quadraticCurveTo(0.2, 0.2, -0.19, 0.19);
      c.fill(); break;
    case 3:                             // Sour: a four-point star
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 0.08 : 0.26;
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill(); break;
    case 4:                             // Brine: a crystal — a square
      c.rect(-0.16, -0.16, 0.32, 0.32); c.fill(); break;
    default:                            // Pepper: cracked corn specks
      for (const [x, y, r] of [[-0.1, -0.06, 0.06], [0.1, 0.02, 0.05], [-0.02, 0.13, 0.045]]) {
        c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2);
      }
      c.fill();
  }
}

// ── sprites, drawn in a 0..1 box ─────────────────────────────────────────
/* A spice is a round pinch bowl seen from above — a dark rim, the ground
 * spice heaped inside, its flavor's shape pressed into the heap. Two bowls on
 * a length of twine make a pinch; the halves never merge into one outline. */
function drawSpice(c, f) {
  const F = flavor(f);
  if (f === WILD) {                     // a peppercorn: no bowl, just the corn
    const g = c.createRadialGradient(0.4, 0.36, 0.04, 0.5, 0.5, 0.44);
    g.addColorStop(0, '#6a625d'); g.addColorStop(0.5, F.color); g.addColorStop(1, F.dark);
    c.fillStyle = g;
    c.beginPath(); c.arc(0.5, 0.5, 0.41, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.025; c.stroke();
  } else {
    c.fillStyle = F.dark;
    c.beginPath(); c.arc(0.5, 0.5, 0.44, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.025; c.stroke();
    const g = c.createRadialGradient(0.42, 0.36, 0.04, 0.5, 0.5, 0.36);
    g.addColorStop(0, F.light); g.addColorStop(0.55, F.color); g.addColorStop(1, F.color);
    c.fillStyle = g;
    c.beginPath(); c.arc(0.5, 0.5, 0.35, 0, Math.PI * 2); c.fill();
  }
  c.save(); c.translate(0.5, 0.5); c.scale(1.05, 1.05);
  c.fillStyle = c.strokeStyle = f === WILD ? PEPPER.light : 'rgba(20,10,5,0.55)';
  glyph(c, f);
  c.restore();
}

function drawIngredient(c, f) {
  const F = FLAVORS[f];
  c.lineWidth = 0.03; c.strokeStyle = 'rgba(0,0,0,0.4)';
  const body = c.createRadialGradient(0.4, 0.38, 0.05, 0.5, 0.55, 0.5);
  body.addColorStop(0, F.light); body.addColorStop(0.35, F.color); body.addColorStop(1, F.dark);
  c.fillStyle = body;
  switch (f) {
    case 0: {                           // tomato
      c.beginPath(); c.ellipse(0.5, 0.56, 0.38, 0.34, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#3d8f3a';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.05 : 0.17, a = (i * Math.PI) / 5 - Math.PI / 2;
        c[i ? 'lineTo' : 'moveTo'](0.5 + Math.cos(a) * r, 0.25 + Math.sin(a) * r * 0.7);
      }
      c.closePath(); c.fill();
      break;
    }
    case 1: {                           // potato
      c.save(); c.translate(0.5, 0.55); c.rotate(-0.35);
      c.beginPath(); c.ellipse(0, 0, 0.42, 0.3, 0, 0, Math.PI * 2);
      c.restore(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(80,45,0,0.55)';
      for (const [x, y] of [[0.34, 0.5], [0.55, 0.42], [0.62, 0.62], [0.42, 0.68]]) {
        c.beginPath(); c.arc(x, y, 0.025, 0, Math.PI * 2); c.fill();
      }
      break;
    }
    case 2: {                           // broccoli
      c.fillStyle = '#a9d48f';
      c.beginPath(); c.roundRect(0.41, 0.5, 0.18, 0.4, 0.05); c.fill(); c.stroke();
      c.fillStyle = body;
      for (const [x, y, r] of [[0.3, 0.46, 0.18], [0.7, 0.46, 0.18], [0.5, 0.34, 0.22], [0.5, 0.52, 0.17]]) {
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.beginPath(); c.arc(0.5, 0.42, 0.2, 0, Math.PI * 2); c.fill();
      break;
    }
    case 3: {                           // eggplant
      c.save(); c.translate(0.5, 0.56); c.rotate(0.6);
      c.beginPath(); c.ellipse(0, 0.04, 0.25, 0.38, 0, 0, Math.PI * 2);
      c.restore(); c.fill(); c.stroke();
      c.fillStyle = '#3d8f3a';
      c.beginPath(); c.ellipse(0.71, 0.24, 0.13, 0.09, 0.6, 0, Math.PI * 2); c.fill();
      break;
    }
    default: {                          // clam
      c.beginPath();
      c.moveTo(0.5, 0.86);
      c.lineTo(0.1, 0.56);
      c.arc(0.5, 0.56, 0.4, Math.PI, 0);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(10,50,80,0.45)'; c.lineWidth = 0.025;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(0.5, 0.84);
        c.lineTo(0.5 + i * 0.15, 0.56 - Math.sqrt(Math.max(0, 0.16 - (i * 0.15) ** 2)) * 0.9);
        c.stroke();
      }
    }
  }
  // the flavor badge: the same shape the matching spice wears
  c.fillStyle = 'rgba(22,15,12,0.88)';
  c.beginPath(); c.arc(0.77, 0.78, 0.18, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(0.77, 0.78); c.scale(0.62, 0.62);
  c.fillStyle = c.strokeStyle = F.light;
  glyph(c, f);
  c.restore();
}

// ── layout ───────────────────────────────────────────────────────────────
/* The pot takes every pixel a small screen has: 8×16 is 1:2, a phone is about
 * 1:2.17, and the difference is the strip the order rail sits in. On a wide
 * screen the pot is bound by height and simply sits in the middle. */
export function layout(W, H, cols, rows) {
  const hudH = Math.max(56, Math.min(88, H * 0.09));
  const cell = Math.max(8, Math.floor(Math.min((W - 8) / (cols + 0.7), (H - hudH - 6) / (rows + 1.75))));
  const potW = cols * cell, potH = rows * cell;
  const spare = H - hudH - (rows + 1.75) * cell;
  return {
    W, H, cell, hudH, potW, potH,
    wall: Math.round(cell * 0.3),
    x0: Math.round((W - potW) / 2),
    y0: Math.round(hudH + cell * 0.55 + spare * 0.35),
    handX: W / 2, handY: hudH * 0.5,
  };
}

// ── the renderer ─────────────────────────────────────────────────────────
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let L = layout(320, 640, 8, 16);
  let dpr = 1;
  const sprites = new Map();
  const view = {
    tint: STOCK.slice(), particles: [], spawnAt: -1e9, flash: 0, motion: true,
  };

  function sprite(kind, f) {
    const key = `${kind}:${f}`;
    let sp = sprites.get(key);
    if (!sp) {
      const px = Math.ceil(L.cell * dpr);
      sp = document.createElement('canvas');
      sp.width = sp.height = px;
      const c = sp.getContext('2d');
      c.scale(px, px);
      if (kind === 'i') drawIngredient(c, f); else drawSpice(c, f);
      sprites.set(key, sp);
    }
    return sp;
  }

  function resize(W, H, cols, rows) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    L = layout(W, H, cols, rows);
    sprites.clear();
    return L;
  }

  function blit(sp, x, y, scale = 1) {
    const c = L.cell, d = c * scale, o = (c - d) / 2;
    ctx.drawImage(sp, x + o, y + o, d, d);
  }

  // The string between two bowls: a cord lapped over each rim, knotted in
  // the middle. Drawn from the RIGHT- or DOWN-linked half only.
  function twine(x, y, link, c = L.cell) {
    if (link !== LINK.RIGHT && link !== LINK.DOWN) return;
    const across = link === LINK.RIGHT;
    const jx = across ? x + c : x + c / 2, jy = across ? y + c / 2 : y + c;
    const reach = c * 0.2;
    ctx.lineCap = 'round';
    for (const [w, col] of [[c * 0.13, 'rgba(0,0,0,0.45)'], [c * 0.08, TWINE]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(jx - (across ? reach : 0), jy - (across ? 0 : reach));
      ctx.lineTo(jx + (across ? reach : 0), jy + (across ? 0 : reach));
      ctx.stroke();
    }
    ctx.fillStyle = TWINE; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(1, c * 0.025);
    ctx.beginPath(); ctx.arc(jx, jy, c * 0.085, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function pinch(cells, ox, oy, alpha = 1) {
    ctx.globalAlpha = alpha;
    for (const [cx, cy, , f] of cells) blit(sprite('s', f), ox + cx * L.cell, oy + cy * L.cell);
    for (const [cx, cy, link] of cells) twine(ox + cx * L.cell, oy + cy * L.cell, link);
    ctx.globalAlpha = 1;
  }

  function drawFlame(s, now) {
    const { x0, y0, potW, potH, wall, cell } = L;
    const top = y0 + potH + wall, room = Math.min(cell * 1.15, L.H - top);
    if (room < 6) return;
    const base = top + room;
    const hot = s ? heat(s) : 0.2;
    ctx.fillStyle = '#0d0b0a';
    ctx.beginPath(); ctx.roundRect(x0 - wall, base - room * 0.22, potW + wall * 2, room * 0.22, 4); ctx.fill();
    const n = 9, w = potW / n;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? `rgba(255,${Math.round(225 + hot * 25)},${Math.round(120 + hot * 100)},0.95)` : `rgba(255,${Math.round(105 + hot * 50)},30,0.9)`;
      for (let i = 0; i < n; i++) {
        const flick = view.motion ? Math.sin(now / (90 - hot * 40) + i * 1.9) * 0.18 + Math.sin(now / 53 + i) * 0.08 : 0;
        const h = room * 0.8 * (0.4 + 0.6 * hot + flick) * (pass ? 0.45 : 1);
        const bx = x0 + w * (i + 0.5), half = w * (pass ? 0.2 : 0.46);
        const by = base - room * 0.2;
        ctx.beginPath();
        ctx.moveTo(bx - half, by);
        ctx.quadraticCurveTo(bx - half * 0.6, by - h * 0.5, bx + flick * w, by - h);
        ctx.quadraticCurveTo(bx + half * 0.6, by - h * 0.5, bx + half, by);
        ctx.fill();
      }
    }
  }

  function drawPot(s) {
    const { x0, y0, potW, potH, wall, cell } = L;
    const rim = Math.round(cell * 0.28);
    // handles
    ctx.fillStyle = '#4b4f55';
    ctx.beginPath(); ctx.roundRect(x0 - wall - cell * 0.5, y0 + cell * 0.5, cell * 0.6, cell * 0.42, cell * 0.15); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x0 + potW + wall - cell * 0.1, y0 + cell * 0.5, cell * 0.6, cell * 0.42, cell * 0.15); ctx.fill();
    // body
    const steel = ctx.createLinearGradient(x0 - wall, 0, x0 + potW + wall, 0);
    steel.addColorStop(0, '#6b7077'); steel.addColorStop(0.12, '#c7ccd2');
    steel.addColorStop(0.5, '#8d939a'); steel.addColorStop(1, '#4a4e54');
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.roundRect(x0 - wall, y0 - rim, potW + wall * 2, potH + rim + wall, [4, 4, wall * 1.6, wall * 1.6]);
    ctx.fill();
    // broth
    const [r, g, b] = view.tint;
    const broth = ctx.createLinearGradient(0, y0, 0, y0 + potH);
    broth.addColorStop(0, `rgb(${r * 0.3 | 0},${g * 0.3 | 0},${b * 0.3 | 0})`);
    broth.addColorStop(1, `rgb(${r | 0},${g | 0},${b | 0})`);
    ctx.fillStyle = broth;
    ctx.fillRect(x0, y0, potW, potH);
    // a faint lattice, so columns can be read against an empty pot
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let x = 1; x < (s ? s.cols : 8); x++) ctx.fillRect(x0 + x * cell, y0, 1, potH);
    if (s) {
      const d = danger(s);
      if (d > 0) {
        const glow = ctx.createLinearGradient(0, y0, 0, y0 + cell * 5);
        glow.addColorStop(0, `rgba(255,70,40,${0.45 * d})`); glow.addColorStop(1, 'rgba(255,70,40,0)');
        ctx.fillStyle = glow; ctx.fillRect(x0, y0, potW, cell * 5);
      }
    }
  }

  function drawCells(s, now) {
    const { x0, y0, cell } = L;
    const dying = s.phase === 'clear' ? new Set(s.dying) : null;
    const k = dying ? 1 - s.t / CLEAR_TICKS : 0;
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c) continue;
      const x = x0 + (i % s.cols) * cell;
      let y = y0 + ((i / s.cols) | 0) * cell;
      if (c.ing && view.motion) y += Math.sin(now / 520 + i * 1.7) * cell * 0.03;
      const sp = sprite(c.ing ? 'i' : 's', c.f);
      if (dying && dying.has(i)) {
        blit(sp, x, y, k < 0.4 ? 1.08 : Math.max(0, 1 - (k - 0.4) / 0.6));
        if (k < 0.4) {
          ctx.fillStyle = `rgba(255,255,255,${0.75 - k})`;
          ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2); ctx.fill();
        }
        continue;
      }
      blit(sp, x, y);
    }
    // cords go on last, so the bowl drawn after never covers half of one
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      if (!c || c.ing || !c.link || (dying && dying.has(i))) continue;
      twine(x0 + (i % s.cols) * cell, y0 + ((i / s.cols) | 0) * cell, c.link);
    }
  }

  function drawPiece(s, now) {
    if (!s.piece || s.phase !== 'fall') return;
    const { x0, y0, cell } = L;
    const cells = pieceCells(s.piece);
    // where it will land
    const gy = ghostY(s) - s.piece.y;
    if (gy > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = Math.max(1.5, cell * 0.05);
      ctx.setLineDash([cell * 0.14, cell * 0.1]);
      for (const [cx, cy, , f] of cells) {
        if (cy + gy < 0) continue;
        ctx.strokeStyle = flavor(f).light; ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(x0 + (cx + 0.5) * cell, y0 + (cy + gy + 0.5) * cell, cell * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // the throw: out of your hand, over the rim, into the mouth of the pot
    const k = view.motion ? Math.min(1, (now - view.spawnAt) / 170) : 1;
    if (k < 1) {
      const tx = x0 + (s.piece.x + 1) * cell, ty = y0 + (s.piece.y + 0.5) * cell;
      const px = L.handX + (tx - L.handX) * k, py = L.handY + (ty - L.handY) * k - Math.sin(k * Math.PI) * cell * 0.8;
      pinch(cells, px - (s.piece.x + 1) * cell, py - (s.piece.y + 0.5) * cell);
    } else {
      pinch(cells, x0, y0);
    }
  }

  function drawHand(s) {
    const c = L.cell, sc = Math.min(1, (L.hudH * 0.5) / c);
    const px = Math.ceil(c * sc);
    const x = Math.round(L.handX - px), y = Math.round(L.handY - px / 2 - L.hudH * 0.08);
    ctx.drawImage(sprite('s', s.next.a), x, y, px, px);
    ctx.drawImage(sprite('s', s.next.b), x + px, y, px, px);
    twine(x, y, LINK.RIGHT, px);
    // the mill: five peppercorns, filling as you chain
    const r = Math.max(2.5, L.hudH * 0.045), gap = r * 3;
    for (let i = 0; i < MILL_CAP; i++) {
      ctx.beginPath();
      ctx.arc(L.handX + (i - (MILL_CAP - 1) / 2) * gap, y + px + r * 2.2, r, 0, Math.PI * 2);
      ctx.fillStyle = i < s.mill ? '#f1e9df' : 'rgba(255,255,255,0.16)';
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

  let last = 0;
  function draw(s, now) {
    const dt = Math.min(50, now - last); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, L.H);
    bg.addColorStop(0, '#221a16'); bg.addColorStop(1, '#120e0c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, L.W, L.H);
    drawFlame(s, now);
    drawPot(s);
    if (!s) return;
    drawCells(s, now);
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
  }

  return {
    resize, draw, dissolved, view,
    get layout() { return L; },
    freshBroth() { view.tint = STOCK.slice(); view.particles.length = 0; },
  };
}
