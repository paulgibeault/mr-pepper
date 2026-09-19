# Mr Pepper

Throw pairs of spices into the pot; line up four of a flavor to season the
ingredients; season them all to serve the dish. A game for
[Paul's Arcade](https://paulgibeault.github.io/) — `gameId: mr-pepper`.

    npm test                                   # the rules, under node --test
    ../paulgibeault.github.io/dev.sh .         # stage with the launcher → http://127.0.0.1:4791/mr-pepper/
    node tools/smoke.mjs                       # the real page, headless (needs the dev server up)
    node tools/make-icon.mjs                   # icon.svg → icon.png

| File | What it is |
|---|---|
| `core.js` | The rules: a seeded, fixed-tick state machine. No DOM, no clock. |
| `render.js` | The pot, drawn on one canvas. Reads state, never writes it. |
| `input.js` | Touch gestures and keys → core commands. |
| `main.js` | The clock, the sheets, and the Arcade SDK contract. |
| `soundpack.js`, `audio.js` | The sound pack (WebAudio graphs) and its one registration site. |
| `docs/design.md` | The concept, the decisions, and what comes next. |

`?dev=1` exposes `window.__pepper` (state, mode, `emit`) for test drivers.
