# Mission 3 level (KEY = level) - notes

Owner of: src/level3.js (took over from the skeleton). Scratch: tools/m3/work-level/
Backup of the skeleton version: work-level/level3-skeleton-orig.js

## Progress log
- [start] Read spec, engine-api, skeleton notes, level3.js (skeleton already had data, wiring, liquid rules, toss,
  bomb schedule, a motorboat intro of 186 f, 7 animals with 5 frames, 2 tracks, card). Plan: keep data + wiring,
  upgrade animals (more poses, flying away, own calls), sailboat intro (~5 s), music, card for 3-card layout.
- [r1] Work copy work-level/level3.js (tools: lm.mjs one-boot multi-frame runner, zoo.mjs pose sheet, intro.mjs,
  card.mjs, music.mjs structural check, sheet.mjs, crop.mjs, runw.sh = run.sh with the work copy).
  Animals rewritten: 12 poses each (stand blink look call happy jump salute toss m0-m3), bigger (turtle 38x23,
  pelican 40x37, parrot 38x40, monkey 30x32 front-facing head, toucan 38x33, iguana 44x22, flamingo 46x42), birds
  get real flight frames, walkers 4-frame runs; drawTied: call frame synced with HELP!, peek over bars, happy jumps;
  drawFreed: hop out, salute (wing/paw at brow + twinkle), holds the present up over its head, toss frame at t 40
  (item launched from K.hand, o.l3dir/o.l3tx set in tossItems), its own dance (spin/flap/flip/hop/pushup/twirl),
  flies or runs home. Own calls in K.call.
  Intro (300 f = 5 s): sailboat (HULL + RIG sprites, 6 rig frames: full x2 flutter, lowering, furled) drawn as a
  private prop 'l3boat' unshifted into G.props (drawn after the ground, before palms) -> a shadow, a wave wash that
  carries it up the beach then recedes, bow wave, wake; beaches t150, sail drops 158-182, hero stands 188, hops 198,
  lands x 139, LET'S GO! 236, MISSION 3 START! + say 252, banner 266, bars out 272-300. Enter skips to 252.
  Music: TRACKS.island (calypso C, 16 bars, 236 bpm sixteenth steps, triangle lead), TRACKS.islandlava (A minor
  version, 256, switched in from AREA 3 by musicByArea()), TRACKS.whaleboss (A minor, 16 bars eighths 184).
  Card: new big robot shark (5 angles), palm, volcano with jungle + lava trickle, leap cycle 220 f.
  sim L3 seed 1 (work copy): errors [] completed false hits [4,27,71,0] (bot stuck at lava: integration).
- [r2] In situ (free.mjs: walk into each cage, strips per animal): animals were hidden behind the hero who touched
  the cage -> freed animals hop HOP=20 px clear (o.l3side, set in tossItems), stand on a crate when they land on one
  (crateLift: pelican 1560, iguana 4440), salute facing the hero, then turn to toss. Toss starts from K.hand (+lift).
  All 7 tosses land exactly 40 px ahead of the hero (log in free.mjs output). Walkers running home over lava (the
  iguana at 4420 runs left into river 1) now hop column to column (runnerY, o.y overridden after updatePows).
  Bomb schedule now 210 +-20% frames (~3.5 s), 105 in the 4440 lock (bombs.mjs: gaps 213/247/225 -> before change;
  lock 110/138/108/107/140/134; none in the crater). Parity after r1: L1 true [] [0,0,5,9] 14150, L2 true [] [1,4,1,10] 33000.
- [r3/final] Contact sheet work-level/sheet.png (12 frames: intro x3, pose sheets x2, in-game strips x4, card, mission
  select, iguana on the columns). Intro sheet final/intro-sheet.png. src/level3.js == work-level/level3.js.
  FINAL TESTS (src): run.sh sim --level 3 --seed 1: completed false, errors [], hits [3,8,95,0], deaths 34, score 26250,
  freed 6, x 4070 (bot stuck at lava river 1: integration). Seeds 2/3 x heroes 0/1: errors [] everywhere
  ([3,6,94,0] x 4093; [3,8,100,0] x 4093; hero 0 and hero 1 give identical runs).
  Parity: L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
  skip.mjs: Enter at t31 -> intro ends f79, hero 140/214 on ground; full intro ends f300 hero 139; music island ->
  islandlava at x 4000 (section 2) -> whaleboss in the boss lock. bombs.mjs: AREA 3 only, lock rate doubled.
  free.mjs: all 7 tosses land 40.0 px ahead of the hero, on screen.
## Open / weak
- Music checked structurally only. Card shots fly level under the leaping shark. HELP! bubble is in the POW layer (the
  world's front plants can cover it). No menuBG for Mission 3 (hero select shows the jungle).
