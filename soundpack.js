// Mr Pepper sound pack — first pass, NOT yet auditioned on the workbench.
//
// Loaded as a plain script after /arcade-audio.js; audio.js registers it with
// Arcade.audio, and the launcher's tools/soundpack renderer can load this same
// file to produce audition WAVs.
//
// ── a small tiled kitchen, one pot on ───────────────────────────────────
// The materials are WATER (everything that lands, lands in broth), DRY SPICE
// (what a clear sounds like: a pinch hitting hot liquid and fizzing away),
// STEEL (the pot, struck — the only pitched thing in the room) and the MILL.
//
// Contour grammar follows the fleet: rising is good, falling is over. The one
// ladder is the chain: each step of a chain strikes the pot a pentatonic step
// higher, so a long chain audibly climbs.
//
//   move     the pinch shifts a column      barely there: twine on a fingertip
//   rotate   the pinch turns                the same, a little longer
//   lock     the pinch lands                a plop and the pot's floor
//   settle   a cut-loose half lands         a smaller plop
//   clear    a run dissolves                fizz, a bubble per ingredient, the pot rung
//   mill     the mill is full               pepper ground: a ratchet
//   won      the dish is served             the pass bell, twice
//   over     the pot boils over             a long hiss falling, and a thud

(function (global) {
  const S = global.ArcadeAudioElements;
  if (!S) return;

  const ROOM = { dur: 0.7, decay: 0.3, preDelay: 0.008, wet: 0.26, shelfHz: 4200, shelfDb: -4, seed: 9001 };

  const SENDS = {
    'move': 0.03, 'rotate': 0.04, 'lock': 0.10, 'settle': 0.10,
    'clear': 0.16, 'mill': 0.10, 'won': 0.28, 'over': 0.22,
  };

  const LADDER = [0, 2, 4, 7, 9, 12, 14, 16];   // major pentatonic, in semitones
  const seed = (r) => (r() * 1e6) | 0;

  const CUES = {
    'move': function (ctx, o, t, p, r) {
      return S.rustle(ctx, o, t, { dur: 0.03, f0: 2200, f1: 3000, Q: 1.2, gain: 0.035, attack: 0.004, seed: seed(r) });
    },
    'rotate': function (ctx, o, t, p, r) {
      return S.rustle(ctx, o, t, { dur: 0.055, f0: 1500 * S.cents(r, 80), f1: 2900, Q: 1.4, gain: 0.06, attack: 0.008, seed: seed(r) });
    },
    'lock': function (ctx, o, t, p, r) {
      S.droplet(ctx, o, t, { f0: S.between(r, 230, 290), f1: S.between(r, 820, 980), dur: 0.06, tone: 2200, gain: 0.17, seed: seed(r) });
      S.thump(ctx, o, t + 0.004, { f0: S.between(r, 115, 135), f1: 68, dur: 0.09, gain: 0.13, seed: seed(r) });
      return 0.16;
    },
    'settle': function (ctx, o, t, p, r) {
      return S.droplet(ctx, o, t, { f0: S.between(r, 340, 420), f1: S.between(r, 1200, 1500), dur: 0.045, gain: 0.10, seed: seed(r) });
    },
    'clear': function (ctx, o, t, p, r) {
      const chain = Math.max(1, (p && p.chain) || 1);
      const ings = (p && p.ings) || 0;
      // the fizz: dry spice meeting hot broth
      S.rustle(ctx, o, t, { dur: 0.30, f0: 3200, f1: 5600, Q: 0.9, gain: 0.10, attack: 0.012, seed: seed(r) });
      // a bubble for each ingredient seasoned
      for (let i = 0; i < Math.min(ings, 4); i++) {
        S.droplet(ctx, o, t + 0.05 + i * S.between(r, 0.045, 0.07), {
          f0: S.between(r, 420, 520), f1: S.between(r, 1500, 1900), dur: 0.05, gain: 0.13, seed: seed(r),
        });
      }
      // the pot, rung — one step up the ladder per link of the chain
      const step = LADDER[Math.min(chain - 1, LADDER.length - 1)];
      S.strike(ctx, o, t, { dur: 0.004, hp: 3000, gain: 0.08, seed: seed(r) });
      S.body(ctx, o, t, {
        f0: 440 * Math.pow(2, step / 12) * S.cents(r, 6), gain: 0.16 + Math.min(chain, 4) * 0.02,
        partials: [
          { ratio: 1.0, gain: 1.0, decay: 0.55 },
          { ratio: 2.71, gain: 0.35, decay: 0.28 },
          { ratio: 5.18, gain: 0.16, decay: 0.12 },
        ],
      });
      return 0.6;
    },
    'mill': function (ctx, o, t, p, r) {
      return S.ratchet(ctx, o, t, { detents: 8, dur: 0.5, end: 1.7, f: 880, hp: 2400, gain: 0.15, seed: seed(r) });
    },
    'won': function (ctx, o, t, p, r) {
      for (const [dt, g] of [[0.15, 1], [0.42, 0.85]]) {
        S.strike(ctx, o, t + dt, { dur: 0.004, hp: 3600, gain: 0.12, seed: seed(r) });
        S.body(ctx, o, t + dt, {
          f0: 1760 * S.cents(r, 4), gain: 0.2 * g,
          partials: [
            { ratio: 1.0, gain: 1.0, decay: 1.5 },
            { ratio: 2.0, gain: 0.3, decay: 0.9 },
            { ratio: 2.92, gain: 0.22, decay: 0.5 },
            { ratio: 5.4, gain: 0.1, decay: 0.2 },
          ],
        });
      }
      return 2.0;
    },
    'over': function (ctx, o, t, p, r) {
      S.rustle(ctx, o, t, { dur: 1.3, f0: 4200, f1: 900, Q: 0.8, gain: 0.16, attack: 0.05, seed: seed(r) });
      S.thump(ctx, o, t + 0.5, { f0: 95, f1: 42, dur: 0.5, attack: 0.02, gain: 0.22, seed: seed(r) });
      return 1.5;
    },
  };

  S.registerPack({ name: 'mr-pepper', ROOM, SENDS, CUES });
})(typeof window !== 'undefined' ? window : globalThis);
