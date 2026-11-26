# Mission 1 repaint: mock screenshot brief (shared by the four area painters)

Robot Rumble is a Metal-Slug-style HTML5 canvas game (480x270, pixel art) a parent is making for two kids (8-10).
It has 3 missions. Missions 2 (VIGO HILLS) and 3 (VOLCANO ISLAND) have rich painted pixel-art scenery; Mission 1
(ROBOT JUNGLE, `src/level1.js`) is the original and looks flat next to them: gradient sky, circle clouds, sine-wave
mountains, flat-colour ground, vector props. See `tools/polish/compare-missions.png` (M1 | M2 | M3 at the same scale)
and `tools/polish/sheet-m1.png`, `sheet-m2.png`, `sheet-m3.png`.

**Your job:** one mock screenshot of ONE Mission 1 area repainted to the Mission 2 / Mission 3 standard, painted by
the real engine, for a proposal the parent will show the kids. It is a throwaway mock, but the painting code will be
the starting point of the real repaint, so write it as reusable area scenery, not a one-off picture.

## Hard rules
- Do NOT edit `src/`, `index.html`, `build.py`, `dev.html`, `tools/harness/` or anything in `proposals/level3/`.
  Write only inside `proposals/polish/<key>/` (deliverables) and `tools/polish/<key>/` (scratch renders, probes).
- Gameplay geometry stays exactly as it is: same platforms (`L1.plats`: positions, tops, widths), same ground line
  (`GROUND` = 232, flat), same props, enemies and prisoners at the same places. You repaint how things LOOK:
  sky, far and middle scenery, decor, the ground strip, the platforms, the foreground. A platform must still read as
  something you can stand on, with its top edge exactly at `pl.y` from `pl.x` to `pl.x + pl.w`.
- Keep the real hero sprite, HUD, font, bullets, pickups, prisoners and the real Mission 1 robots (soldier, drone,
  tank, crab) as the engine draws them. Do not redesign characters.
- Never call `Math.random` / `rand` in drawing code (use `hsh(n)` or a private seeded stream) and never create
  canvases per frame: bake static layers once on first use, blit with parallax, animate only small live bits with
  `G.t`. Same camera and frame count must give the same picture.
- The Mac restarts often. Keep `tools/polish/<key>/notes.md` up to date as you go, with a `STATUS:` line at the top
  and the exact final render command, so the work can be resumed.

## How to build the mock
- Deliverable is a harness fixture: `proposals/polish/<key>/scene.js`, loaded after the game with `--extra`.
  It is one block (`'use strict'; { ... }`), nothing global. It replaces draw hooks on the level object:
  `const L = LEVELS[0];` then `L.drawBG`, `L.drawBehind`, `L.drawGround`, `L.drawPlat`, `L.drawFront`
  (signatures in `src/level1.js` from line 560 and `docs/engine-api.md` section 5). Keep the originals
  (`const old = L.drawBG`) and fall back to them outside your area so the rest of the mission still draws.
- To stage a lively moment (hero mid-shot, a robot bursting, a prisoner shouting HELP!), wrap `L.update` / `L.load`
  and pin things each frame, as `proposals/level3/jungle/scene.js` does (read its `notes.md` first: "How the scene.js
  works"). Clear the MISSION START band (`G.big`) and hold the area-name banner if you want it shown.
- Render and look, then fix, many times (at least 6 rounds; the Mission 3 mocks took 10):

      H=/Users/macbookair/game/tools/harness
      node $H/harness.mjs render --level 1 --x <X> --frames <F> --god --scale 3 \
        --extra /Users/macbookair/game/proposals/polish/<key>/scene.js \
        --out /Users/macbookair/game/proposals/polish/<key>/<key>.png

  Open PNGs with the Read tool. `--x` builds the mission at that spot (no intro); `tools/harness/README.md` explains
  the options. The render prints JSON: `errors` and `warnings` must be `[]`.
- Also save `before.png`: the same command without `--extra` but with the same `--x`/`--frames`, so the proposal can
  show before and after.
- Compare against Mission 2 and 3 at the same scale before you call it done, e.g.
  `node $H/harness.mjs render --level 2 --x 3100 --frames 260 --god --scale 3 --out tools/polish/<key>/ref-m2.png`
  and `--level 3 --x 2500`. Put yours next to them (`node tools/polish/sheet.mjs out.png 2 a.png b.png`).
  The test: would a kid believe all three pictures come from the same game?

## Where to learn the house style
- `src/level2_sky.js` (header comment, helpers lines 20-180, `layer/cover/cull/blit`, `cloudSprite`, `sunSprite`,
  `raySprite`) and `src/level2_world.js`: static art painted pixel by pixel into buffers, crisp edges, no
  anti-aliasing, dithered gradients, 1px dark outlines (`OUT`) on gameplay objects, several parallax layers, light
  from the sun side, textured soil with stones and roots under a detailed ground edge, small live touches
  (birds, smoke, sparkles, swaying things).
- `src/level3_sky.js`, `src/level3_world.js`: the same approach for a jungle, water and lava.
- Their helpers are private to their files: copy what you need into your scene.js.
- `docs/engine-api.md` sections 1-3 and 5 for the globals (`R`, `RO`, `spr`, `makeSprite`, `text`, `hsh`, `mix`, `G`).

## Mission 1 as a whole (keep the four areas one journey)
The light moves on through the mission, as it already does: AREA 1 THE JUNGLE bright morning; AREA 2 ENEMY CAMP hot
midday going to afternoon; AREA 3 THE BIG BRIDGE golden sunset; FINAL AREA ROBOT BASE dusk/night with the base's
own lights. The robots are a comic army (grey steel, red eyes, yellow-black hazard stripes), never scary.
Keep what is recognisable from today's Mission 1 (the stone head statue, the ruins, palms, tents, watchtower, jeep,
radio mast, the arched bridge and the waterfall, the ROBOT BASE gate and the big door the Mega Crab comes out of):
same things, painted properly.

## What to hand back
`proposals/polish/<key>/`: `scene.js`, `<key>.png` (1440x810), `before.png`, `notes.md` (what the frame shows, how
scene.js is organised and which functions are the reusable area scenery, per-frame cost concerns, an honest
"still weak" list). Final message: the render command, the files, what you changed in the look, what is still weak.
