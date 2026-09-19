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

## Built (this pass)

Core + 14 rule tests; canvas renderer; touch + keyboard; menu / pause / served
/ boiled-over; run saved on suspend and resumed *paused*; `Arcade.records` for
best score and furthest dish per kitchen; reduced-motion and power-saver gate
the ambient motion; first-pass sound pack; headless smoke test.

## Next

- **Playtest the touch controls** — the go/no-go. Tunables live at the top of
  `input.js` (step 0.85 cell, flick 0.012 cell/ms) and `core.js`.
- **Audio pass on the workbench** — the pack has not been auditioned. Add a
  simmer bed (`stream`, retuned by heat).
- Cookbook (dishes served, per kitchen) and recipe-shaped stockings.
- *Mise en place* (untimed, N pinches) and the *Daily Special* (one seed a day).
- Fleet: catalog entry (`inDevelopment: true`), CI, acceptance run.
- Later: versus (over-salting), cookware, optional tilt.
