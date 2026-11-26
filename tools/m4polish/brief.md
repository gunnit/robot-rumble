# Mission 4 polish: mock screenshot brief (shared by all painters)

Robot Rumble is a Metal-Slug-style HTML5 canvas game (480x270, pixel art) a parent is making for two kids (8-10),
heroes Ines and Mathias. Missions 1-3 have rich painted pixel-art scenery. Mission 4, CORAL KINGDOM (underwater,
`src/level4.js`, `level4_art.js`, `level4_enemies.js`, `level4_player.js`), was made quickly with another AI and
looks far below the others: gradient water, triangle hills, thin vector-ish coral, robots that are all the same grey,
and a boss that is just the small octopus scaled 3x (chunky pixels). The parent wants it polished to the level of
Mission 2 (the bar they liked). Before anything is built, the kids get a proposal with mock screenshots.

Look first:
- `tools/polish/compare-missions.png` (M1 | M2 | M3 at the same scale): the house standard.
- `tools/m4polish/before/*.png`: Mission 4 today (x300 reef, x2300 kelp, x4000 ruins, boss = final area, intro, ...).

**Your job:** one or two mock screenshots of YOUR piece of Mission 4 (your key, below), painted by the real engine,
at the Mission 2 / Mission 3 standard. It is a mock, but the code will be the starting point of the real build, so
write it as reusable mission art, not a one-off picture.

## Hard rules
- Do NOT edit `src/`, `index.html`, `build.py`, `dev.html`, `tools/harness/`, `tools/mission4/`, or other painters'
  folders. Write only inside `proposals/m4polish/<key>/` (deliverables) and `tools/m4polish/<key>/` (scratch).
- Gameplay geometry stays: same seabed line (`LV.terrain`, read through `groundAt(x)`), same area x ranges
  (Area 1 CORAL GARDEN 0-1700, Area 2 KELP FOREST 1700-3400, Area 3 SUNKEN RUINS 3400-5000, FINAL GLOWING DEEP
  5000-6400; camera stops at 5920 for the boss), same rescues and spawns at the same places. The swim space
  (y 62 down to the seabed) must stay readable: nothing opaque in front of it except low foreground at the very
  bottom; background must be darker / lower-contrast than the play layer so robots, bullets and cages pop.
- Keep the real HUD, font, hearts, score, bubbles/torpedo bullets and cages as the engine draws them unless your key
  says you redesign them.
- Never call `Math.random` / `rand` in drawing code (use `hsh(n)` or a private seeded stream) and never create
  canvases per frame: bake static layers once on first use (offscreen canvases from `document.createElement('canvas')`),
  blit with parallax, animate only small live bits with `G.t`. Same camera and frame count must give the same picture.
  Keep a frame under ~3 ms of drawing (blits, not thousands of `R` calls per frame).
- The Mac restarts often and wipes /tmp. Keep `tools/m4polish/<key>/notes.md` up to date as you go, with a `STATUS:`
  line at the top and the exact final render command, so the work can be resumed after a restart.

## How to build the mock
- Deliverable is a harness fixture: `proposals/m4polish/<key>/scene.js`, loaded after the game with `--extra`.
  One block (`'use strict'; { ... }`), nothing global except registry entries. Mission 4 is `LEVELS[3]`
  (`const L = LEVELS[3];`). Hooks: `L.drawBG(cx)` (screen space, paints everything behind), `L.drawBehind(cx)` and
  `L.drawGround(cx)` (world space: ctx already translated by -cx), `L.drawFront(cx)` (today it translates itself;
  the engine calls it in screen space), `L.drawOverlay(cx)` (screen space). Enemy looks: `ENEMY_TYPES.<t>.draw(e)`.
  See `docs/engine-api.md` sections 1-5 and its "Mission 4" section.
- **Compose, don't clobber**: several painters' scene.js files will be loaded together for the final proposal
  frames (e.g. `--extra deep/scene.js --extra boss/scene.js --extra cast/scene.js`). So wrap the previous hook and
  only take over inside your own x range / your own enemy types:
  `const prevBG = L.drawBG; L.drawBG = cx => mine(cx) ? myBG(cx) : prevBG(cx);`. Cross-fade at area borders is welcome.
- To stage a lively moment (hero firing, a robot bursting, HELP! on a cage), wrap `L.update` / `L.load` and pin things
  when the level is built at your mock camera only, as `proposals/level3/jungle/scene.js` does (read its notes.md
  "How the scene.js works"). Clear the MISSION START band (`G.big = null`) and hold the area banner if you like.
- Render and look, then fix, many times (at least 6 rounds; earlier mocks took 10):

      H=/Users/macbookair/game/tools/harness
      node $H/harness.mjs render --level 4 --x <X> --frames <F> --god --scale 3 \
        --extra /Users/macbookair/game/proposals/m4polish/<key>/scene.js \
        --out /Users/macbookair/game/proposals/m4polish/<key>/<key>.png

  Open PNGs with the Read tool. `--x` builds the mission at that spot (no intro). The render prints JSON:
  `errors` and `warnings` must be `[]`. Also save `before.png` (same command without your `--extra`).
- Compare against Missions 2 and 3 at the same scale before you call it done
  (`node $H/harness.mjs render --level 3 --x 2500 --frames 200 --god --scale 3 --out tools/m4polish/<key>/ref-m3.png`,
  `--level 2 --x 3100`). The test: would a kid believe all pictures come from the same game?

## Where to learn the house style
- `src/level2_sky.js` (header, helpers, `layer/cover/cull/blit`, sprite bakers) and `src/level2_world.js`: static art
  painted pixel by pixel into buffers, crisp edges, no anti-aliasing, dithered gradients, 1px dark outlines (`OUT`)
  on gameplay objects, several parallax layers, small live touches.
- `src/level3_sky.js`, `src/level3_world.js`, `src/level3_enemies.js`, `src/level3_boss.js`: water, a jungle, lava,
  robot animals (sharks, frogs, bees) and the MEGA WHALE SHARK boss: the robot-animal style to match.
- Helpers in those files are private: copy what you need into your scene.js. Today's Mission 4 helpers
  (`L4.drawCreature`, `L4.drawDiver`, `L4.drawSub`) are public.

## Mission 4 as a whole (one dive, getting deeper)
Light changes with depth through the mission: AREA 1 CORAL GARDEN sunny turquoise shallows just under the surface
(rippling surface line and caustic light, bright coral reef, shoals of fish, the old diving bell landmark);
AREA 2 KELP FOREST green-gold light filtering through tall swaying kelp, rocky arches, sea horses (the yellow
mini-submarine is parked here); AREA 3 SUNKEN RUINS deeper blue, a sunken temple city with columns, arches, statues,
a shipwreck, dolphins; FINAL AREA GLOWING DEEP dark navy/violet abyss with bioluminescent corals, glowing jellyfish,
the MEGA OCTOPUS lair. Real animals are friendly and bright; robots are a comic robot army (riveted steel, red eyes,
yellow-black hazard stripes), never scary. Kids must clearly see: fish, starfish, sea horses, octopus, dolphins,
rays, cuttlefish, jellyfish.

## What to hand back
`proposals/m4polish/<key>/`: `scene.js`, `<key>.png` (1440x810), `before.png`, `notes.md` (what the frame shows,
how scene.js is organised and which functions are the reusable art, per-frame cost, an honest "still weak" list).
Final message: the render command, the files, what changed in the look, what is still weak.
