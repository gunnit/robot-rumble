# Mission 5 proposal: mock screenshot brief (shared by all painters)

Robot Rumble is a Metal-Slug-style HTML5 canvas game (480x270, pixel art) a parent is making for two kids (8-10);
heroes Ines and Mathias. Missions so far: 1 ROBOT JUNGLE, 2 VIGO HILLS (Galicia), 3 VOLCANO ISLAND, 4 CORAL KINGDOM.
The parent asked for the next mission: **alien robots, green, with ONE eye; the scenery is a spaceship.**
Before a mission is built, the family gets a proposal: mock screenshots painted by the real engine. They judge from
pictures, and every mission must look clearly better than the one before. The bar: `proposals/level3/proposal-sheet.png`
(look at it first, with the Read tool) and `proposals/m4polish/built-sheet.png`.

**Your job:** ONE mock screenshot of your area (your key, below) at that standard or better.

## Mission 5: ALIEN MOTHERSHIP (working title)
The robot armies of Missions 1-4 were sent by a green alien mothership parked above the Earth. Its robots, the
**OGGLES** (green, one big eye each), are beaming up cows from Vigo Hills. Ines and Mathias get beamed up too, fight
through the ship and free the cows.

| Key | Area | x range | Hero in the frame | Score shown |
|---|---|---|---|---|
| `hangar` | AREA 1: THE HANGAR | 0-1600 | Ines (`--hero 0`) | 0052300 |
| `garden` | AREA 2: STAR GARDEN | 1600-3300 | Mathias (`--hero 1`) | 0071850 |
| `space` | AREA 3: SPACE WALK | 3300-5000 | Ines (`--hero 0`) | 0098400 |
| `bridge` | FINAL AREA: THE BRIDGE | 5000-6400 (boss camera locks at 5920) | Mathias (`--hero 1`) | 0204650 |

The whole mission is one trip through the ship: hangar (you arrive) -> garden dome (where the cows are kept) ->
outside on the hull (space, the Earth below) -> the bridge (the boss). Your frame-specific brief is in the message
that sent you here.

## The look of the ship (all four frames must read as ONE ship)
- **Green is reserved for the robots.** Oggles, their beams, their glow and small screens showing an eye icon are
  green (`M5.PAL.G`, `BEAM`). NO green scenery: hull, plants, lights and space are blue-violet, magenta, cyan, amber,
  pink, teal, orange. This is what makes the robots pop. Check it in every render.
- **Hull:** blue-violet steel (`M5.PAL.S`, dark -> light): big wall panels with 1px dark seams and a lighter top edge,
  ribs / bulkheads, round portholes with thick rims and stars behind, pipes and cable bundles, vents.
  Retro sci-fi, friendly and colourful, never grim.
- **Lights:** magenta guide strips low (`MAG`), cyan strips high (`CYAN`), amber-and-black hazard stripes on doors,
  pads and moving parts (`AMB`). Signs in made-up alien glyphs (chunky circles, dots, bars) in cyan on dark plaques.
- **Space** behind windows: near-black violet (`M5.PAL.SP`), stars in three sizes (a few tinted), and the **Earth**:
  a blue marble with white cloud swirls, lit from one side, a thin pale-blue atmosphere rim.
- **Deck:** the walkable floor is a metal deck with a bright 1px top edge. The play lane (roughly y 150-232 on
  screen) must stay readable: background darker and lower in contrast than the play layer, nothing opaque in front
  of it except low foreground at the very bottom. Robots, the hero, bullets and pods must pop.
- House style: static art painted pixel by pixel into buffers once, crisp edges, NO anti-aliasing (no `arc`,
  `lineTo` strokes or gradients for anything hard-edged; soft light only for glows), dithered gradients, 1px dark
  outlines (`OUT`) on gameplay objects, several parallax layers, small live touches (blinking lamps, drifting
  stars, steam). Learn it from `src/level2_sky.js`, `src/level2_world.js`, `src/level3_world.js`,
  `src/level3_boss.js` and the proposal scenes in `proposals/level3/*/scene.js` (+ their notes.md).

## The cast (shared, do not redesign): `proposals/level5/kit.js`
Read its header. It gives you `M5.PAL`, pixel-buffer helpers `M5.px`, `M5.glow`, `M5.bang` (the red !), `M5.bubble`,
and the robots: `M5.oggle` (trooper), `M5.drone` (eye saucer, optional tractor beam), `M5.roller` (roly eye),
`M5.cow`, `M5.pod` (cow in a glass pod), plus posed registry stand-ins (`ENEMY_TYPES.oggle / eyedrone / roller`,
`POW_KINDS.cow`, `EB_TYPES.ogring`) whose spawn spec sets the pose: `{ t: 'oggle', x, pose: 'warn', face: -1 }`.
See them: `tools/m5/cast-r2.png`. Every robot warns before it attacks (antenna lamp blinks, eye turns yellow, red !).
You MAY add robots or machines of your own for your area, in the same language: green armour (`M5.PAL.G`), ONE eye
(steel bezel, white lens, red iris), an antenna lamp, comic and never scary. Do not edit kit.js; if something in it
blocks you, write it down in your notes and work around it in your scene.

## Hard rules
- Write ONLY inside `proposals/level5/<key>/` (deliverables) and `tools/m5/<key>/` (scratch renders, notes).
  Never touch `src/`, `index.html`, `build.py`, `dev.html`, `docs/`, `tools/harness/`, `kit.js` or other painters' folders.
- Your scene is a harness fixture: `proposals/level5/<key>/scene.js`, one block (`'use strict'; { ... }`), nothing
  global except registry entries. It pushes its own temporary mission 5 (`LEVELS.push({...})`: mission 'MISSION 5',
  title 'ALIEN MOTHERSHIP', end 6400, the four sections above) with your scenery hooks and your staged moment, as
  `proposals/level3/jungle/scene.js` and `proposals/level3/boss/scene.js` do (read their notes.md "How the scene.js
  works"): stage things in `load()` / `update()` (pin the hero, hold poses, hold the area banner, clear
  `G.big`, set `G.score`, give a weapon, hold fire so the muzzle flash and shots show).
- Keep the real HUD, font, hearts, score and hero as the engine draws them (`docs/engine-api.md`).
- Never call `Math.random` / `rand` in drawing code (use `hsh(n)`), never create canvases per frame: bake static
  layers once, blit with parallax, animate small live bits with `G.t`. The same command must give the same picture.
- This Mac is an 8 GB M1 that restarts often. ONE render at a time, in the foreground; no background processes, no
  subagents, no dev server. Keep `tools/m5/<key>/notes.md` up to date as you go, with a `STATUS:` line at the top
  and the exact final render command, so the work can be resumed.

## Render, look, fix (at least 8 rounds; the Mission 3 frames took 10)
    cd /Users/macbookair/game
    node tools/harness/harness.mjs render --level 5 --x <X> --frames <F> --hero <0|1> --god --scale 3 \
      --extra proposals/level5/kit.js --extra proposals/level5/<key>/scene.js \
      --out tools/m5/<key>/rN.png
Open each PNG with the Read tool and criticise it honestly before the next round (composition first, then detail):
does it read at a glance? is it clearly a spaceship? do the green robots pop? is anything a flat untextured block,
a neon line, an anti-aliased blur? is the play lane clear? would a kid want to play this? The render prints JSON:
`errors` and `warnings` must be `[]`. Final frame: `proposals/level5/<key>/<key>.png` (1440x810, `--scale 3`).

## What to hand back
`proposals/level5/<key>/scene.js`, `<key>.png`, `notes.md` (what the frame shows, the exact render command, how the
real area would play: the robots here and how each one warns, the rescue, anything new; an honest "still weak" list).
Final message to the director: the render command, what the frame shows, your gameplay ideas in 5 lines, what is
still weak.
