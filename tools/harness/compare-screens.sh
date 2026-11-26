#!/bin/bash
# End/pause screens: new build vs the pre-refactor single file, pixel diff. The harness renders them like real
# play (200 frames in, no MISSION START band), and the win screen at frame 150, when its blinking Enter prompt is
# on, so a change to the prompt shows up here.
# Expected while Mission 1 is the only mission: win, over and pause identical (both say PRESS ENTER TO PLAY AGAIN).
# Once Mission 2 is loaded the Mission 1 win prompt reads PRESS ENTER FOR MISSION 2! instead: an intended
# difference, only in the prompt line (box about [498,642,947,665] at scale 3).
cd "$(dirname "$0")"
S=shots/refactor
LEG=(--legacy /Users/macbookair/game/backup/index-before-level2.html)
for scr in win over pause; do
  node harness.mjs render --screen $scr --out $S/new-$scr.png > /dev/null
  node harness.mjs render --screen $scr "${LEG[@]}" --out $S/legacy-$scr.png > /dev/null
  echo "$scr $(node harness.mjs diff $S/new-$scr.png $S/legacy-$scr.png)"
done
node harness.mjs render --screen allclear --out $S/new-allclear.png
