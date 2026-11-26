# Mission 4 polish: restart-safe notes

SOUND PASS [Nov 14, after the user offered Higgsfield]: DONE. 17 sampled sounds (Higgsfield Seed Audio, ~22 credits)
in tools/m4polish/sfx/: prompts.tsv, raw/ (downloads), cut.sh (trim + loudnorm + mono MP3 56k/32k; ambience = 11 s
crossfaded loop) -> cut/, embed.py -> src/level4_sounds.js (base64; L4SND.play(name,{vol,rate,fb}) with the old synth
as fallback until decoded; L4SND.tick() keeps the ambience under coral/octoboss music; wraps Music.play/stop).
Hooked in level4_player/enemies/boss/intro/level4.js; main.js warms the decode on non-play screens. listen.html =
self-contained audition page. Checks: all unchanged (nododge [1,3,2,4] 153.4 s; M1-3 identical; loop/flow/API ok);
browser: 17/17 decode, ambience only in Mission 4. index.html 2.54 MB (42 files). Sounds not heard by Claude.
STATUS: [Nov 14 ~18:00] DONE. index.html built (41 files, 2.26 MB) and tested. Final checks: test.mjs 12/12 (src and
built); dodging bot wins swimming 160.8 s / sub 108.3 s, no continues; never-dodging [1,3,2,4] 153.4 s, 1 life,
0 continues; loop ALL OK (src and built); FLOW 27 ok; API 37 ok; selftest DONE; M1 [1,2,4,5] 15050 143.8,
M2 [0,2,0,1,7] 31950 152.4, M3 [4,3,0,7] 31100 194 unchanged. Real browser (index.html): boot bar 0.4 s, Mission 4 art
baked in menu idle time within ~1.5 s, 1-3 ms per frame, no console errors. Mission card diver moved fully into view
(level4_reef.js card dx 30). Pictures: proposals/m4polish/built-sheet.png (before | now), built/*.png.
Known leftovers: the general harness bot (tools/harness sim) can't swim to depth, so `sim --level 4` stalls (use
tools/mission4/sim.mjs or tools/m4polish/sim-nododge.mjs); nobody has played it by hand yet; sounds of the new robots
are simple tones.
STATUS UPDATE [Nov 14 ~17:30]: ALL SIX PIECES LANDED (boss too: dome x2, hearts at 70/35%, hp 250). Coordinator:
src/level4_art.js removed from the manifest (moved to tools/m4polish/build/coord/level4_art.old.js; joiner has no old
fallback any more; level4.js POW draw is a stub, level4_kit.js paints them). Idle bake also runs the robots'
(L4.castPump) and the boss's (L4.bossArt) steps. Difficulty tuned in level4_enemies.js: FIRST=60 (first warning
1 s after waking; was ~1.6 s and robots died before attacking), hp octopus 7 / ray 6 / jelly 6 / puffer 6 / crab 7;
robot ink not poppable (pearls/spikes/shells still are); level4.js: puffer at 1360 removed. Tried two extra lock
fights (4480, 5460): +50 s, no hits -> removed. RESULT never-dodging bot: [1,3,2,4]=10 hits, 153.4 s, 1 life lost,
0 continues (M2 bar 10-14, 150-170 s). Next: suite2.txt results, build.py, browser check, final sheet.
STATUS UPDATE [Nov 14 ~16:30]: reef(+intro,+card), kelp(+kit), ruins, deep, cast landed in src (each worker's notes
in tools/m4polish/build/notes-<key>.md). Boss still working (told: REAL hit target 3-5 + heart drops at 70%/35%).
IMPORTANT: sim-nododge hits were double-counted (RIDES.scuba.hurt re-calls hurtPlayer); fixed in sim-nododge.mjs and
sim-probe.mjs (logs each hit's cause). Real baseline before polish: [0,0,1,6]. Coordinator added: new robots placed
in level4.js spawns + lock waves; hearts rule in level4.js (INK CAPTAIN always drops a heart; first robot beaten in an
area on the last heart drops one); seam rocks at 1700/3400/5000 in level4_scenery.js. With the old boss:
nododge [0,1,2,7] 144.3 s, 2 lives lost, 0 continues. Next: boss lands -> strip old painters from level4_art.js and
the OLD fallback in the joiner, re-measure, full suite (tools/m4polish/build/coord/suite.txt), build, browser.
STATUS: [Nov 14] BUILDING. User said "Build it" (all my picks: big boss, all 3 new robots, dome weak spot, M2
difficulty). Rules: tools/m4polish/build-contract.md. The six painters were resumed (SendMessage) to turn their mocks
into src/level4_{reef,intro,kelp,kit,ruins,deep,cast,boss}.js + level4_enemies.js; each keeps
tools/m4polish/build/notes-<key>.md. Coordinator done so far: backups (backup/src-before-m4polish/,
backup/index-before-m4polish.html), boss moved to src/level4_boss.js, placeholders + manifest order, joiner
src/level4_scenery.js (L4ART: crossfade, clipping, bake pump, L4ART.groundAt, menuBG), main.js idle bake on menus,
level4.js load() bakeAll + card via L4ART.card. Checked after the split: test.mjs 12/12, nododge [0,0,2,12] 124.5 s
identical. TODO coordinator: place new robots + retune spawns/locks to M2 numbers (after cast's per-type list),
seams, delete old painters in level4_art.js, loop/flow/API tests, M1-3 sims identical, build.py, browser check.
If a restart killed the workers: re-dispatch fresh agents with "read tools/m4polish/build-contract.md and
tools/m4polish/build/notes-<key>.md, your key is K, resume".
(Old) PROPOSAL READY, waiting for the user's pick. All six painters DONE (each has
proposals/m4polish/<key>/notes.md with render commands + "still weak" list). Proposal: proposals/m4polish/proposal.md
+ proposal-sheet.png (built by tools/m4polish/sheet.mjs from proposals/m4polish/final/ composites).
Composite load order: --extra cast/scene.js FIRST, then the area scene, then boss/scene.js last.
Open choices put to the user: boss size, which new robots, brain-dome weak spot, difficulty to M2 level. Sheet builder: tools/m4polish/sheet.mjs. Never-dodging bot: tools/m4polish/sim-nododge.mjs
(run ONE game at a time, niced; the user stopped a 12-way parallel run while 6 painters were busy).
Six painters dispatched in parallel (keys reef, kelp, ruins, deep, boss, cast),
each following tools/m4polish/brief.md; deliverables in proposals/m4polish/<key>/, scratch in tools/m4polish/<key>/.
Nothing in src/ changed yet. Next: collect mocks, build proposals/m4polish/proposal-sheet.png + proposal.md, show the
user, wait for their pick ("build it"), then build.

If a restart killed a painter: re-dispatch it with "read tools/m4polish/brief.md, your key is K, resume from
tools/m4polish/K/notes.md" (piece descriptions: see the dispatch list below).
- reef: Area 1 CORAL GARDEN frame (x 550-900) + new opening scene mock (boat, back-roll splash) reef-intro.png
- kelp: Area 2 KELP FOREST frame (x 1800-2400, parked mini-sub at 1800)
- ruins: Area 3 SUNKEN RUINS frame (x 3700-4100, dolphin cage 3820, INK CAPTAIN lock 4000)
- deep: FINAL GLOWING DEEP frame (x 5200-5600) + boss lair backdrop deep-lair.png (camera 5920)
- boss: MEGA OCTOPUS redesign (draw only), boss.png + boss-low.png
- cast: robot redesign (roboctopus, roboray, robojelly, robocuttle) + 2-3 new robot types, cast.png lineup + cast-action.png

## Diagnosis of Mission 4 today (before)
- Size: ~33 KB of code vs ~750 KB for Mission 3. 13 spawns + 3 small arenas (M2: ~45 enemies, mini-bosses, boss).
- Look: gradient water, triangle hills, thin coral, all robots the same grey tint of the friendly animals, boss =
  small octopus scaled 3x. Renders: tools/m4polish/before/.
- Play: tools/mission4/sim.mjs (a bot that dodges) seed 1 hero 0: completed 124.5 s, 1 death, 7/7 freed, 19800.
  The standard harness bot (never dodges, used for all reference numbers) gets stuck in Area 2 at x 2048:
  236 hits, 39 deaths, 13 continues in 30000 frames (it can't change depth: robots float out of its row).
- Never-dodging M4 bot (tools/m4polish/sim-nododge.mjs, swims to target depth, never dodges): hero 0 seed 1 and
  hero 1 seed 2 give the SAME result (M4 uses no randomness): completed, hits per area [0,0,2,12] = 14, 2 lives lost,
  0 continues, 124.5 s, 7/7 freed, 19800. Mission 2 bar: 10-14 hits spread over the areas, 150-170 s.
  => Areas 1-2 are a walk (0 hits), then a spike at the boss (12 hits). Too short and unevenly paced.
