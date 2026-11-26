# Mission 4 polish build: rules for everyone working on it (Nov 14)

The user approved the proposal (`proposals/m4polish/proposal.md`, sheet `proposal-sheet.png`) with all my picks:
all four areas repainted, the boat opening scene, the robot cast redesign + the three new robots (puffer, crab, eel),
the big MEGA OCTOPUS (keep it this big), its glass brain dome as a weak spot (double damage), and difficulty brought to
Mission 2's level. Missions 1, 2 and 3 must not change in look or play.

## Shared rules
- The Mac restarts often and kills background work. Keep `tools/m4polish/build/notes-<key>.md` current, `STATUS:`
  line first (what is done, what is next, exact test commands), so anyone can resume. Scratch in
  `tools/m4polish/build/<key>/`. Nothing durable in /tmp.
- Edit only the files your task names (below). Several people work at once. The coordinator owns
  `src/manifest.json`, `src/level4.js` (spawns, locks, rescues, music), `src/level4_scenery.js` (the area joiner),
  `src/level4_art.js`, `src/level4_player.js`, `src/engine.js`, `src/screens.js`, `src/main.js`, `build.py`,
  `index.html`, `tools/harness/`, `tools/mission4/`. Do not run `python3 build.py`.
- Your mock `proposals/m4polish/<key>/scene.js` is the starting point; turn it into a real game file. NO mock staging
  in game files: nothing may wrap `L.load` / `L.update`, pin the hero, enemies, shots, banners, scores, or depend on a
  "mock camera". Layout tuned for the mock frame must become real positions that look right along the whole area
  (walk it: render every ~300 px). Delete the mock's "glue" (hook wrapping, crossfades with neighbours).
- Never `Math.random` / `rand` in drawing code or at load time (`hsh(n)` or a private seeded stream): Missions 1-3's
  seeded sims must stay identical. Never create canvases per frame. Private code inside a block (`'use strict'; { }`).
  Shared names only through `L4` / `L4ART` / registries. `const Math = globalThis.Math;` at the top of a block speeds
  up the harness (its sandbox makes reading Math slow).
- Per-frame drawing cost: keep your part under ~2 ms in the harness; bake static art in `steps`.
- Check with the harness (`tools/harness/README.md`): `errors` and `warnings` must be `[]` (no `--extra` any more: your
  file is in the manifest). Mission 4 checks: `node tools/mission4/test.mjs` (12 checks), dodging bot
  `node tools/mission4/sim.mjs 0 1` and `node tools/mission4/sim.mjs 1 2 sub`, never-dodging bot
  `node tools/m4polish/sim-nododge.mjs 0 1` (prints hits per area). Run heavy things one at a time (`nice`): several
  workers share one Mac.
- Backups before this build: `backup/index-before-m4polish.html`, `backup/src-before-m4polish/`.

## Area files: `src/level4_<key>.js` (reef, kelp, ruins, deep)

`src/level4_scenery.js` (read it: it is short) owns L4's draw hooks and calls the four area modules. Each area file
replaces its placeholder with:

```js
'use strict';
// header comment: what this area paints
var L4ART = L4ART || {};
{
  // private helpers, palettes, painters ...
  L4ART.<key> = {
    x0, x1,          // reef 0-1700, kelp 1700-3400, ruins 3400-5000, deep 5000-6400
    steps: [f, f],   // bake steps, run once in order (idle time on the menus, or on the spot when first needed).
                     // No step much over ~100 ms in the harness. Nothing below runs before all steps ran.
    bg(g, cx),       // the whole backdrop for camera cx, drawn into the 2D context g (NOT the global ctx: g may be a
                     // scratch canvas for the crossfade). Screen space, opaque over x -10..W+10, y -10..H+10: water,
                     // light shafts, far and mid parallax layers. Must be right for every camera the area can be seen
                     // from: the backdrop crossfades over 300 px of camera travel centred on camera-centre 1700, 3400,
                     // 5000, so bg is called for camera x: reef 0..1610, kelp 1310..3310, ruins 3010..4910,
                     // deep 4610..5920. Never draw another area's art or the old art.
    behind(cx),      // world space (ctx translated by -cx): scenery standing on the seabed and things in the water
                     // behind the play layer, anchored at x0 <= x < x1 (may overhang the ends by up to ~100 px, so
                     // your edge pieces must look fine half-covered by the neighbour's). Cull off-screen pieces.
    ground(cx),      // world space: the seabed from the line groundAt(x) down to the canvas bottom, x0..x1 (the joiner
                     // clips to exactly x0..x1). Use L4ART.groundAt(x), not groundAt(x) (menus have another LV).
    front(cx),       // screen space: low foreground at the very bottom only (the joiner clips to the screen part
                     // showing x0..x1). Never over the swim space y 62..seabed except thin edge pieces.
    overlay(cx)      // screen space: caustics, light, drifting specks; called at globalAlpha = backdrop weight.
                     // Optional. Not the controls hint (the joiner draws it).
  };
}
```
- Seams: your ground stops exactly at x0 and x1: make both ends look finished on their own (a natural edge: sand
  drift, a rock). Say in your notes what your ends look like and what you'd want from the neighbour; the coordinator
  joins neighbours afterwards. The seabed line itself (`terrain`) is gameplay: do not change it.
- Real friendly animals in the scenery are welcome (background fish, turtles, dolphins...) but must be clearly
  background (behind the play layer, smaller or hazier) so kids never try to shoot or rescue them.
- Rescue cages, robots, the hero, the mini-sub, pickups and bullets are not yours (see below).

## Other pieces
- **reef** also owns `src/level4_intro.js`: the boat opening scene. It sets `LEVELS.find(l=>l.title==='CORAL
  KINGDOM').intro = { start, update, draw }` (and may set `startText` / `startSay`), Enter skips, it hands over a
  playable swimmer at the end like today's intro (`finishIntro` in level4.js: hero y 155, `G.banner` area name,
  `G.big` MISSION 4 START!, `say`). The diver in it uses `L4.drawDiver` (the cast's new gear) at draw time, so both
  match. Also the mission card art: `L4ART.card(x, y, w, h)` (screen space, 180x96, clipped; `G.p` may be null and
  `LV` may be another mission: no `groundAt`): a slice of the reef with the hero diver squaring up to a robot octopus.
- **kelp** also owns `src/level4_kit.js` (loads after level4.js): the yellow mini-sub look (`L4.drawSub(x, y, dir, hp,
  pilot, t)`, same size, no see-through light cone over the play area, or a much subtler one), the rescue cages and
  the seven friendly animals inside / swimming away (override `POW_KINDS.ocean{fish,star,horse,octopus,dolphin,ray,
  cuttle}.draw`; same box 44x40 above o.y; HELP! blinking like Missions 2/3), and the pickups' look
  (`ITEMS.oceanPearl.draw`, `ITEMS.oceanCharge.draw`). Look only: no behaviour change.
- **cast** owns `src/level4_cast.js` (looks: the four robots, their bullets `EB_TYPES.oceanBolt/oceanInk.draw`, the diver
  `L4.drawDiver(p)`) and `src/level4_enemies.js` (behaviour of roboctopus, roboray, robojelly, robocuttle and the three
  new types robopuffer, robocrab, roboeel). Widen each hitbox to match the new drawing, make shots leave from the
  nozzle / tanks, and let the octopus and captain face the hero. Every attack keeps a readable tell of at least ~0.5 s
  and an escape. New types: register them with working behaviour and tells; do not place them in the level (the
  coordinator does, in level4.js). Give the coordinator a short list per type: hp, score, what it does, how long its
  tell is, where it works best (open sand for the crab, the eel as a spawn with its pipe on the seabed, never in a
  lock wave).
- **boss** owns `src/level4_boss.js` (moved out of level4_enemies.js unchanged; now yours): the MEGA OCTOPUS look from the
  mock, and its fight. Keep it this big. Grow its hitbox to match (dome included) and make the glass brain dome a weak
  spot taking double damage (show it: the dome flashes when hit). Bubble-fan shots leave the nozzle. Fairness target:
  with the never-dodging bot (`tools/m4polish/sim-nododge.mjs`; to test only the boss, copy it to your scratch and
  start at the boss) the boss alone should cost about 4-6 hits (today 12) and take roughly 40-60 s; the dodging bot
  (`tools/mission4/sim.mjs`) must still win with both heroes and with the sub. Every attack: a tell of at least
  ~0.6 s and a clear way out (UP!/DOWN! hint for the sweep). Keep the funny defeat and `bossDefeated` flow
  (`L4.bossHP` keeps its hp over a continue).
- **deep**: grow the lair hatch ~20 px so the big boss reads as coming out of it.
