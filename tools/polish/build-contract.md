# Mission 1 polish build: rules for everyone working on it (Nov 13)

The user approved the proposal (`proposals/polish/proposal.md`): Mission 1 gets repainted (all four areas), a
parachute opening scene, a repainted Mega Crab, a fairness retune to Mission 2's numbers, and mission cards that
remember stars (done). Missions 2 and 3 are not to change in look or play.

## Shared rules
- The Mac restarts often and kills background work. Keep `tools/polish/build/notes-<key>.md` current, `STATUS:` line
  first, so anyone can resume. Scratch goes in `tools/polish/build/<key>/`. Nothing durable in /tmp.
- Edit only the files your task names. Several people are working at once; `src/manifest.json`, `src/level1_art.js`,
  `src/engine.js`, `src/screens.js`, `src/main.js`, `build.py`, `index.html` and `tools/harness/` belong to the
  coordinator. Do not run `python3 build.py`.
- Never `Math.random` / `rand` in drawing code (`hsh(n)` or a private seeded stream). Never create canvases per
  frame. Private code inside a block (`'use strict'; { ... }`); see "Names are shared" in `docs/engine-api.md`.
- Check with the harness (`tools/harness/README.md`): `errors` and `warnings` must be `[]`.
  Mission 2 and 3 must stay identical: `sim --level 2 --seed 1` = hits [0,2,0,1,7], score 31950, 152.4 s;
  `sim --level 3 --seed 1` = hits [4,3,0,7], score 31100, 194 s.
- Backups of the game before this build: `backup/index-before-polish.html`, `backup/src-before-polish/`.

## Area files: `src/level1_<key>.js` (jungle, camp, bridge, base)

`src/level1_art.js` (read it: it is short) owns the level's draw hooks and calls the four area modules. Each area
file replaces its placeholder with:

```js
'use strict';
// header comment: what this area paints
var L1ART = L1ART || {};
{
  // private helpers, palettes, painters ...
  L1ART.<key> = {
    x0, x1,          // the area's ground range: jungle 0-1620, camp 1620-3060, bridge 3060-4340, base 4340-6000
    steps: [f, f],   // bake steps, run once in order (start-up loading screen: one or more per frame). Split the
                     // bake so that no step is much over ~100 ms in the harness; nothing may be drawn before all ran
                     // (level1_art.js guarantees they all ran before it calls anything below)
    bg(g, cx),       // the whole backdrop for camera cx, drawn into the 2D context g (NOT the global ctx: g may be
                     // a scratch canvas for the crossfade). Screen space. Opaque from x -10..W+10, y -10..GROUND+10.
                     // Must be right for every camera the area can be seen from (see "Cameras") and must not draw
                     // any other area's art or the old art.
    behind(cx),      // world space (ctx is already translated by -cx): the area's decor = L1ART.decor('<key>')
                     // (its L.decor entries, already filtered) plus anything the area adds. Cull what is off screen.
    ground(cx),      // world space: the ground strip from x0 to x1 only (down to the bottom of the canvas)
    plat(pl),        // world space: one platform (only platforms with x0 <= pl.x < x1 are passed)
    front(cx)        // screen space: foreground (parallax 1.3) for the part of the screen showing this area
  };
}
```

- Decor ownership (`L1ART.decor(key)`): jungle = statue, ruin, bush, fern, palms with x < 1620. camp = the
  'CAMP >' sign (x 1585), flag, radio, jeep, drums, tents, sandbags, palms at 2350 and 2990. bridge = the 'BRIDGE'
  sign (x 3020) and the truss. base = gate, pipes, wall.
- Cameras: the sky crossfades over 300 px of camera travel around camera-centre x 1600, 3020 and 4380, so `bg` is
  called for camera x: jungle 0..1510, camp 1210..2930, bridge 2630..4290, base 3990..4620. The menus also scroll
  the jungle (camera 0..1400) and the hero-select screen draws it at camera 200.
- No mock staging: nothing may wrap `L.load` / `L.update`, pin the hero, enemies, shots, banners or scores, or
  depend on a "mock camera". Layout tuned for the mock frame must become real world/strip positions that look
  right along the whole area, not only at the proposal camera (walk it: render every ~300 px).
- Do not touch `LEVELS[0]`'s hooks yourself and do not keep or call the old painters: `level1_art.js` does the
  switching. Do not change `L.plats`, `L.grounds`, `L.decor`, spawns or anything gameplay.
- The base keeps using `G.door` (0..1, set by level1.js) for the boss door and must not call `rand()`.
- Seams: your ground stops exactly at x0 and x1. Make your two ends look finished on their own (a natural edge:
  bank, kerb, grass thinning out). The coordinator joins neighbours afterwards; say in your notes what your ends
  look like and what you would want from the neighbour.
- Test your file alone: the other areas show the old art until their files land (that is expected). Render with
  `node tools/harness/harness.mjs render --level 1 --x <X> --frames 150 --god --scale 3 --out ...` (no `--extra`).
  Also run `node tools/harness/harness.mjs sim --level 1 --seed 1`: it must complete with `errors []`.
- Report per-frame cost and the time of each bake step (measure in the harness).

## Other files of this build
- `src/level1_crab.js`: the repainted Mega Crab. Replaces `ENEMY_TYPES.crab.draw` only. Same silhouette, size,
  hitbox and attack geometry as `drawCrab` in level1.js (orbs leave the big claw's cannon at local (-100, -51),
  missiles leave the pod at local (+24, -92), `e.oy` lifts the body in the stomp, `e.claw`, `e.hatch`, `e.walk`,
  phase 2 below half health). After painting, still inside the crab's translate, it calls
  `ENEMY_TYPES.crab.tells && ENEMY_TYPES.crab.tells(e)`.
- `ENEMY_TYPES.crab.tells(e)` (in level1.js, owned by the fairness tuner): every warning visual of the crab that the
  retune adds (claw glow, aim line...), drawn in the crab's local coordinates (origin = `e.x`, `e.y + e.oy`).
  The old `drawCrab` calls it the same way, so the tells work with either painting.
- `src/level1_intro.js`: the parachute opening scene; sets `LEVELS[0].intro` (and `startText` / `startSay`).
- `src/level1.js`: enemy behaviour and tells belong to the fairness tuner until it reports done. The old scenery
  painters at the bottom of the file get deleted by the coordinator at the end.
