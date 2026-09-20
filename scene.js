/* scene.js — everything that does not move: the kitchen wall, the copper pot,
 * the broth, the grate and the burner it stands on.
 *
 * Painted ONCE into an offscreen canvas and blitted per frame; repainted only
 * when the screen is resized, the art arrives, or a cleared run has tinted
 * the broth. This is most of what keeps a frame cheap.
 */

const GROUND = '#0e0b0a';
const IRON = '#0d0b0a';

function wall(c, L, art) {
  c.fillStyle = GROUND;
  c.fillRect(0, 0, L.W, L.H);
  const img = art.kitchen;
  if (!img) return;
  // Height-fit and bottom-centred, so the photo's burner sits under ours. On a
  // wide screen the tiles stop short of the edges and fade into the dark.
  const k = Math.max(L.H / img.naturalHeight, Math.min(L.W, L.H * 0.6) / img.naturalWidth);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  const x = (L.W - w) / 2;
  c.drawImage(img, x, L.H - h, w, h);
  if (x > 0) {
    const fade = Math.min(x + w * 0.2, 160);
    for (const [from, to] of [[x, x + fade], [x + w, x + w - fade]]) {
      const g = c.createLinearGradient(from, 0, to, 0);
      g.addColorStop(0, GROUND); g.addColorStop(1, 'rgba(14,11,10,0)');
      c.fillStyle = g;
      c.fillRect(Math.min(from, to), 0, fade, L.H);
    }
  }
}

function copper(c, art, tile) {
  if (!art.copper) return '#a85a30';
  const p = c.createPattern(art.copper, 'repeat');
  const k = tile / art.copper.naturalWidth;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  return p;
}

function pot(c, L, art, tint, cols) {
  const { x0, y0, potW, potH, wall: w, cell } = L;
  const left = x0 - w, right = x0 + potW + w, top = y0;    // the mouth is open: nothing crosses it
  const metal = copper(c, art, cell * 3.6);

  // handles: only as wide as the screen has room for
  const hw = Math.max(0, Math.min(cell * 0.42, left - 1)), hy = y0 + cell * 0.9, hh = cell * 1.1;
  if (hw > 4) {
    c.lineWidth = Math.max(3, cell * 0.14);
    for (const [hx, col] of [[left, '#9a5229'], [right, '#6f391b']]) {
      const out = hx === left ? -1 : 1;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(hx, hy);
      c.arcTo(hx + out * hw, hy, hx + out * hw, hy + hh / 2, hw * 0.8);
      c.arcTo(hx + out * hw, hy + hh, hx, hy + hh, hw * 0.8);
      c.lineTo(hx, hy + hh);
      c.stroke();
    }
  }

  // body: hammered copper, shaded so the wall still reads as round
  const body = new Path2D();
  body.roundRect(left, top, right - left, potH + (y0 - top) + w, [4, 4, w * 2.6, w * 2.6]);
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
  c.fillStyle = metal; c.fill(body);
  c.restore();
  const shade = c.createLinearGradient(left, 0, right, 0);
  for (const [at, col] of [[0, 'rgba(20,6,0,0.62)'], [0.05, 'rgba(255,225,195,0.28)'], [0.12, 'rgba(0,0,0,0.12)'],
    [0.5, 'rgba(30,8,0,0.34)'], [0.88, 'rgba(30,8,0,0.4)'], [0.95, 'rgba(255,215,180,0.18)'], [1, 'rgba(20,6,0,0.68)']]) {
    shade.addColorStop(at, col);
  }
  c.fillStyle = shade; c.fill(body);

  inside(c, L, art, tint, cols);
  rim(c, L, art, left, right);
}

/* The broth, which takes the colour of what has dissolved in it. Kept apart
 * from the rest of the pot so a clear repaints this and nothing else. */
function inside(c, L, art, tint, cols) {
  const { x0, y0, potW, potH, wall: w, cell } = L;
  const mouth = new Path2D();
  mouth.roundRect(x0, y0, potW, potH, [0, 0, w * 1.6, w * 1.6]);
  c.save();
  c.clip(mouth);
  const [r, g, b] = tint;
  const broth = c.createLinearGradient(0, y0, 0, y0 + potH);
  broth.addColorStop(0, `rgb(${r * 0.2 | 0},${g * 0.2 | 0},${b * 0.2 | 0})`);
  broth.addColorStop(0.45, `rgb(${r * 0.48 | 0},${g * 0.44 | 0},${b * 0.46 | 0})`);
  broth.addColorStop(1, `rgb(${r | 0},${g | 0},${b | 0})`);
  c.fillStyle = broth; c.fillRect(x0, y0, potW, potH);
  // a breath of hammered texture — grey, so it brings no hue to fight the
  // flavors; stretched once, so the dents are cell-sized and nothing repeats
  if (art.copperGrey) {
    c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.4;
    c.drawImage(art.copperGrey, x0 + (potW - potH) / 2, y0, potH, potH);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  // a faint lattice, so columns can be read against an empty pot
  c.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 1; x < cols; x++) c.fillRect(x0 + x * cell, y0, 1, potH);
  // the walls curve away, and the rim throws a shadow in
  const edge = cell * 0.55;
  for (const [from, to] of [[x0, x0 + edge], [x0 + potW, x0 + potW - edge]]) {
    const sh = c.createLinearGradient(from, 0, to, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(Math.min(from, to), y0, edge, potH);
  }
  const lip = c.createLinearGradient(0, y0, 0, y0 + cell * 0.7);
  lip.addColorStop(0, 'rgba(0,0,0,0.7)'); lip.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = lip; c.fillRect(x0, y0, potW, cell * 0.7);
  c.restore();
}

// the rolled rim: two lips, the mouth left open for what is thrown in
function rim(c, L, art, left, right) {
  const { y0: top, cell } = L;
  const rimH = Math.round(cell * 0.33), rimW = cell * 0.72;
  for (const rx of [left - cell * 0.24, right + cell * 0.24 - rimW]) {
    const lipPath = new Path2D();
    lipPath.roundRect(rx, top - rimH * 0.45, rimW, rimH, rimH / 2);
    c.fillStyle = copper(c, art, cell * 2.6); c.fill(lipPath);
    const v = c.createLinearGradient(0, top - rimH * 0.45, 0, top + rimH * 0.55);
    v.addColorStop(0, 'rgba(255,235,210,0.5)'); v.addColorStop(0.45, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,6,0,0.55)');
    c.fillStyle = v; c.fill(lipPath);
  }
}

/* The burner's ironwork. `burner` (in the layout) is where flame.js lights it. */
function stove(c, L) {
  const { x0, potW, wall: w, cell, burner: B } = L;
  if (B.room < 8) return;
  const gy = B.top;
  c.fillStyle = IRON;
  c.beginPath(); c.roundRect(x0 - w + cell * 0.15, gy, potW + w * 2 - cell * 0.3, Math.max(3, cell * 0.12), 2); c.fill();
  for (const lx of [x0 + cell * 0.4, x0 + potW - cell * 0.55]) c.fillRect(lx, gy, cell * 0.15, L.H - gy);
  c.fillRect(B.x - B.r * 0.7, B.y + cell * 0.18, B.r * 1.4, L.H - B.y);
  const cap = c.createLinearGradient(0, B.y - cell * 0.05, 0, B.y + cell * 0.28);
  cap.addColorStop(0, '#6a5f58'); cap.addColorStop(0.7, '#1c1714');
  c.fillStyle = cap;
  c.beginPath(); c.ellipse(B.x, B.y + cell * 0.1, B.r * 1.06, cell * 0.16, 0, 0, Math.PI * 2); c.fill();
}

export function createScene() {
  const canvas = document.createElement('canvas');
  const c = canvas.getContext('2d');
  return {
    canvas,
    paint(L, dpr, art, tint, cols) {
      const w = Math.round(L.W * dpr), h = Math.round(L.H * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }   // a new backing store only when the size changed
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      wall(c, L, art);
      pot(c, L, art, tint, cols);
      stove(c, L);
    },
    /* The broth took colour: repaint the inside of the pot, nothing else. */
    steep(L, art, tint, cols) { inside(c, L, art, tint, cols); },
  };
}
