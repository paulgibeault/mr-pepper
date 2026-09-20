/* flame.js — a gas ring, seen from the side: jets fan outward from the cap,
 * clean blue. Only a low flame burns orange at the tips. The flame IS the
 * drop speed (core's heat, 0..1): hotter means longer, bluer jets.
 *
 * Cheap on purpose. Two jet sprites are painted once per size; a frame is 13
 * rotated blits. The flicker is two alternating groups that sit still for
 * most of a 7–9 s cycle and then swell once — and `key()` quantises that
 * swell, so the renderer only repaints while it is actually moving.
 */

const JETS = 13;
const SPREAD = 78;                         // degrees either side of straight up
const SWELL = [[0.64, 1], [0.72, 0.95], [0.8, 1.04], [0.9, 0.99], [1, 1]];
const PERIOD = [7000, 9000];
const OFFSET = [0, 3500];

function swell(now, k) {
  const u = ((now + OFFSET[k]) % PERIOD[k]) / PERIOD[k];
  if (u <= SWELL[0][0]) return 1;
  for (let i = 1; i < SWELL.length; i++) {
    if (u <= SWELL[i][0]) {
      const [u0, v0] = SWELL[i - 1], [u1, v1] = SWELL[i];
      return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
    }
  }
  return 1;
}

function jetSprite(px, tip) {
  const w = Math.max(4, Math.round(px * 0.46)), h = Math.max(8, Math.round(px));
  const sp = document.createElement('canvas');
  sp.width = w; sp.height = h;
  const c = sp.getContext('2d');
  c.scale(w / 20, h / 60);
  const path = (d) => new Path2D(d);
  const outer = c.createLinearGradient(0, 60, 0, 0);
  if (tip) {
    outer.addColorStop(0, 'rgba(79,141,255,0)'); outer.addColorStop(0.4, 'rgba(255,140,50,0.25)');
    outer.addColorStop(0.72, 'rgba(255,154,58,0.9)'); outer.addColorStop(1, 'rgba(255,179,71,0)');
  } else {
    outer.addColorStop(0, 'rgba(79,141,255,0.85)'); outer.addColorStop(0.55, 'rgba(58,108,240,0.5)');
    outer.addColorStop(1, 'rgba(47,85,216,0)');
  }
  c.fillStyle = outer;
  c.fill(path('M10 2 C14 20 18 40 16 54 C15 59 5 59 4 54 C2 40 6 20 10 2 Z'));
  if (!tip) {
    const core = c.createLinearGradient(0, 60, 0, 30);
    core.addColorStop(0, '#f2fdff'); core.addColorStop(1, '#5cc8ff');
    c.fillStyle = core;
    c.fill(path('M10 30 C12 40 14 50 13 56 C12 59 8 59 7 56 C6 50 8 40 10 30 Z'));
  }
  return sp;
}

export function createFlame() {
  let blue = null, orange = null, size = 0;

  return {
    /* Changes only when the picture would: the renderer's repaint key. */
    key(now, motion) {
      if (!motion) return '1,1';
      return `${swell(now, 0).toFixed(2)},${swell(now, 1).toFixed(2)}`;
    },

    draw(ctx, L, dpr, hot, now, motion) {
      const B = L.burner;
      if (B.room < 8) return;
      const long = Math.min(B.room * 1.05, L.cell * (0.55 + 0.6 * hot));
      const px = Math.ceil(L.cell * 1.2 * dpr);
      if (px !== size) { size = px; blue = jetSprite(px, false); orange = jetSprite(px, true); }
      const low = Math.max(0, 1 - hot / 0.3);          // orange tips: gone by a medium flame

      // what the flame throws on the underside of the pot
      const glow = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, B.r * 1.9);
      glow.addColorStop(0, low > 0.5 ? 'rgba(255,150,60,0.2)' : `rgba(80,140,255,${(0.16 + hot * 0.16).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(B.x - B.r * 2, B.top, B.r * 4, L.H - B.top);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const s = [motion ? swell(now, 0) : 1, motion ? swell(now, 1) : 1];
      for (let i = 0; i < JETS; i++) {
        const a = ((-SPREAD + (i * 2 * SPREAD) / (JETS - 1)) * Math.PI) / 180;
        // jets aimed at the viewer are foreshortened; the outer ones lie nearly flat
        const len = long * (0.72 + 0.28 * Math.abs(Math.sin(a))) * s[i % 2];
        const w = len * 0.46;
        ctx.save();
        ctx.translate(B.x + B.r * Math.sin(a), B.y + L.cell * 0.07 * Math.cos(a));
        ctx.rotate(a * 0.82);
        ctx.drawImage(blue, -w / 2, -len, w, len);
        if (low > 0) { ctx.globalAlpha = low; ctx.drawImage(orange, -w / 2, -len, w, len); }
        ctx.restore();
      }
      ctx.restore();
    },
  };
}
