# Mr Pepper — design

*2026-09-19. "A new game for the fleet that uses the mechanics of Dr. Mario …
Mr Pepper … throws pairs of spices into the pot."*

Design stance, in one paragraph: the puzzle is the classic one and is not to
be improved — two-cell pieces, four in a line, the cut half falls, chains. What
is ours is everything around it: **you** are Mr Pepper, so there is no mascot
and the kitchen talks to you; the pot answers instead of a character (broth
that takes the colour of what you cleared, a flame that is the drop speed, a
rim that glows when it is about to boil over); and the one new rule, the mill,
is earned by playing the classic game well rather than bolted beside it.

## Decisions — 2026-09-19 (Paul)

1. **Solo first; multiplayer definitely later.** So the rules are a pure,
   seeded, fixed-tick reducer (`core.js`): that is what solo needs for
   save/resume and a Daily Special, and it is all versus will need — two
   independent sims exchanging chain events.
2. **The play area fills a small screen.** 8×16 is 1:2; a phone is ~1:2.17;
   the difference is the order rail. Landscape and desktop do not need to
   fill: the pot is height-bound and centred. The core takes `cols × rows`, so
   other cookware (a wide skillet) stays possible.
3. **More flavors for higher difficulty.** Flavor count is the coarsest lever
   (6 → 10 → 15 distinct pinches), so it is the *kitchen*, not the level:
   Home Kitchen 3, Bistro 4, Spice Market 5. Within a kitchen: ingredient
   count and head-room (dish number) and the flame.
4. **No character. The player is Mr Pepper.**

## The translation

| Classic | Here |
|---|---|
| bottle | the pot, in cutaway |
| virus | an ingredient that needs seasoning — never falls |
| colour | a **flavor**: colour *and* shape (Heat ◆, Earth ○, Herb leaf, Sour ✦, Brine ■), worn by spices and as a badge on every ingredient |
| capsule | a **pinch**: two round pinch bowls on a knotted length of twine — deliberately *not* a capsule: the halves never merge into one outline. Clear one and the string is cut |
| speed | the flame (low / medium / high), creeping up every 10 pinches |
| top-out | the pot boils over |
| level | a dish; 4 × dish-number ingredients, head-room shrinking late |

**The mill** (the one addition). Each ingredient past the first in a turn adds
1, each chain step past the first adds 2; at 5 the next pinch carries a
**peppercorn** half that stands in for any flavor. A run still needs at least
one real spice or ingredient in it. It is a wildcard, not a bomb, so it helps
most exactly where 4–5 flavors make the queue unkind.

## Controls

Whole-screen, relative: drag sideways to move (one column per ~cell), tap the
left/right half to turn, drag down to soft-drop, flick down to throw. A resting
pinch gets at least 26 ticks of slide time however hot the flame; a soft drop
locks on contact. Keys: ← → ↓, ↑/X and Z, Space, P.

## Built

Core + rule tests; canvas renderer; touch + keyboard; menu / pause / served /
boiled-over; run saved on suspend and resumed *paused*; `Arcade.records` for
best score and furthest dish per kitchen; reduced-motion and power-saver gate
the ambient motion; a sound pack (playtested 2026-09-19 — fine as shipped, no
workbench audition asked for); fleet CI/CD (catalog entry, Pages via GitHub
Actions); headless end-to-end test (`tools/e2e.mjs`).

**The cookbook** (2026-09-19). One `Arcade.stats` category per kitchen
(`cookbook-<id>`), keyed by the dish's position in `dishes.js`'s list — not by
level, which keeps climbing past the list and wraps (`dishName`). A win
records `{ times, best }` for that dish; the sheet lists all 24, served ones
lit with their count and best score, the rest dimmed as "not yet served". Pure
data lives in `dishes.js` (no DOM, no Arcade) so it can be unit tested on its
own; `main.js` is the only place that touches `Arcade.stats` for it.

**The kitchen redesign** (2026-09-20). A copper pot in a dark kitchen, lit by
its own burner. What changed and why it is built the way it is:

- *The order ticket.* The rail's left side is a clipped paper ticket — order
  number, dish, a progress bar, how many are left to season — and the same
  paper comes back full-size as the served / boiled-over receipt (ingredients,
  pinches thrown, longest chain, score, "new best for this dish"). `core.js`
  carries `s.total` and `s.maxChain` for it; older saves lack them and the HUD
  falls back.
- *Twine that holds.* A cord lying over two round rims would slip straight
  off, so each bowl has a brass ring riveted to its rim, facing its partner;
  the cord runs through both and is knotted between. The rings belong to the
  cord (`drawTwine`), so bowl sprites stay symmetric, and a cut takes rings and
  knot together.
- *The tell and the drop lane.* When the drop in hand would make four, its
  landing ring turns solid and the run lights up (`landingMatches` in core:
  the ordinary match scan run on a copy of the grid — no new rule). Worked out
  once per position of the pinch, not per frame.
- *A gas ring, not a campfire.* Jets fan outward from a cap, clean blue; only
  a low flame tips orange (gone by `heat` 0.3). Two alternating groups sit
  still for ~2/3 of a 7 s / 9 s cycle and swell once.
- *Painted art, drawn fallbacks.* `assets/` holds the wall, the hammered
  copper and five ingredients (WebP, ~110 KB with the fonts). Nothing waits on
  them: every image has a vector or flat-colour stand-in.
- *Battery.* `scene.js` paints everything still into one offscreen canvas
  (repainted on resize, art arriving, or the broth taking colour); `draw()`
  builds a key from whatever the picture depends on and returns early when it
  has not changed — a pinch hanging between ticks costs nothing. Measured: ~46
  of 300 frames painted over 5 s of a falling pinch. Ingredients no longer bob.
- *Modules.* `render.js` orchestrates; `scene.js` (still things), `sprites.js`
  (pieces, in a 0..1 box, plus the menu's SVG glyphs), `flame.js`, `assets.js`.
- Fonts are self-hosted (Young Serif, DM Mono; OFL texts beside them) because
  the game must boot offline.

## Next

- Recipe-shaped stockings (a dish's flavor mix leaning toward its theme).
- *Mise en place* (untimed, N pinches) and the *Daily Special* (one seed a day).
- Fleet: catalog entry (`inDevelopment: true`), CI, acceptance run.
- Later: versus (over-salting), cookware, optional tilt.
