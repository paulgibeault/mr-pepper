/* sprites.js — every piece, drawn in a 0..1 box. No state, no layout.
 *
 * Every flavor is a colour AND a shape, on spices and on the badge each
 * ingredient carries, so nothing in the game is told apart by hue alone.
 */

import { WILD, LINK } from './core.js';

export const FLAVORS = [
  { name: 'Heat',  color: '#e5484d', dark: '#8a1c21', light: '#ffb3b0' },
  { name: 'Earth', color: '#f0b429', dark: '#8a5a00', light: '#ffe7a3' },
  { name: 'Herb',  color: '#46a758', dark: '#1c5a2b', light: '#b4ecbf' },
  { name: 'Sour',  color: '#9d6ce0', dark: '#4a2885', light: '#dcc8ff' },
  { name: 'Brine', color: '#4fb3e8', dark: '#175a85', light: '#c4eaff' },
];
const PEPPER = { name: 'Pepper', color: '#3a3533', dark: '#0e0d0c', light: '#b8b0aa' };
export const flavor = (f) => (f === WILD ? PEPPER : FLAVORS[f]);

// ── glyphs, in a unit box centred on (0,0), about ±0.22 ──────────────────
export function glyph(c, f) {
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
export function drawSpice(c, f) {
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
    c.strokeStyle = 'rgba(255,255,255,0.32)'; c.lineWidth = 0.03; c.lineCap = 'round';   // light on the glaze
    c.beginPath(); c.arc(0.5, 0.5, 0.4, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    c.lineCap = 'butt';
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

export function drawIngredient(c, f, img) {
  const F = FLAVORS[f];
  if (img) {
    c.drawImage(img, 0.05, 0.01, 0.86, 0.86);
    return badge(c, f);
  }
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
  badge(c, f);
}

// the flavor badge: the same shape the matching spice wears
function badge(c, f) {
  const F = FLAVORS[f];
  c.fillStyle = '#1a110d';
  c.beginPath(); c.arc(0.78, 0.79, 0.17, 0, Math.PI * 2); c.fill();
  c.strokeStyle = F.color; c.lineWidth = 0.025; c.stroke();
  c.save(); c.translate(0.78, 0.79); c.scale(0.58, 0.58);
  c.fillStyle = c.strokeStyle = F.light;
  glyph(c, f);
  c.restore();
}

/* The string between two bowls. A brass ring is riveted to each rim, facing
 * its partner; the cord runs through both and is knotted between them, so it
 * has something to hold on to — and something to be cut from. Drawn from the
 * RIGHT- or DOWN-linked half only, at (x, y) = that half's cell, size c. */
const TWINE = '#efe4cf', BRASS = '#e3b04b', INK = 'rgba(0,0,0,0.55)';
export function drawTwine(ctx, x, y, link, c) {
  if (link !== LINK.RIGHT && link !== LINK.DOWN) return;
  ctx.save();
  ctx.translate(link === LINK.RIGHT ? x + c : x + c / 2, link === LINK.RIGHT ? y + c / 2 : y + c);
  if (link === LINK.DOWN) ctx.rotate(Math.PI / 2);
  const r = c * 0.13, ring = c * 0.062;
  ctx.lineCap = 'round';
  for (const sx of [-r, r]) {
    ctx.beginPath(); ctx.arc(sx, 0, ring, 0, Math.PI * 2);
    ctx.fillStyle = '#1a110d'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = c * 0.065; ctx.stroke();
    ctx.strokeStyle = BRASS; ctx.lineWidth = c * 0.036; ctx.stroke();
  }
  for (const [w, col] of [[c * 0.085, INK], [c * 0.048, TWINE]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, 0); ctx.lineTo(-c * 0.07, c * 0.13);
    ctx.moveTo(0, 0); ctx.lineTo(c * 0.07, c * 0.13);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, c * 0.058, 0, Math.PI * 2);
  ctx.fillStyle = TWINE; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, c * 0.02); ctx.stroke();
  ctx.restore();
}

/* The same glyphs as markup, for the menu (the shapes must match the pot). */
const STAR = Array.from({ length: 8 }, (_, i) => {
  const r = i % 2 ? 9 : 27, a = (i * Math.PI) / 4 - Math.PI / 2;
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');
const GLYPH_SVG = [
  '<path d="M50 24 69 50 50 76 31 50Z"/>',
  '<circle cx="50" cy="50" r="17" fill="none" stroke="currentColor" stroke-width="9"/>',
  '<path d="M30 70Q29 29 71 29 71 71 30 70Z"/>',
  `<polygon points="${STAR}"/>`,
  '<rect x="33" y="33" width="34" height="34" rx="4"/>',
];
export const glyphSvg = (f) =>
  `<svg viewBox="20 20 60 60" aria-hidden="true" fill="currentColor" style="color:${FLAVORS[f].color}">${GLYPH_SVG[f]}</svg>`;

/* One burner jet, for the flame picker: blue, or orange-tipped when low. */
export const jetSvg = (low) => `<svg class="jet" viewBox="0 0 20 60" aria-hidden="true">
<defs><linearGradient id="jet${low ? 'L' : 'B'}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4f8dff"/>
<stop offset="${low ? 0.45 : 0.6}" stop-color="${low ? '#6a7fe0' : '#3a6cf0'}" stop-opacity="0.7"/><stop offset="1" stop-color="${low ? '#ff9a3a' : '#2f55d8'}" stop-opacity="${low ? 0.9 : 0}"/></linearGradient></defs>
<path d="M10 2C14 20 18 40 16 54 15 59 5 59 4 54 2 40 6 20 10 2Z" fill="url(#jet${low ? 'L' : 'B'})"/>
<path d="M10 30C12 40 14 50 13 56 12 59 8 59 7 56 6 50 8 40 10 30Z" fill="#dff6ff"/></svg>`;
