#!/bin/bash
# Renders the same frames from the new build and the pre-refactor single file, and pixel-diffs each pair.
cd "$(dirname "$0")"
S=shots/refactor
LEG=(--legacy /Users/macbookair/game/backup/index-before-level2.html)
for scr in title select; do
  node harness.mjs render --screen $scr --out $S/new-$scr.png > /dev/null
  node harness.mjs render --screen $scr "${LEG[@]}" --out $S/legacy-$scr.png > /dev/null
  echo "$scr $(node harness.mjs diff $S/new-$scr.png $S/legacy-$scr.png)"
done
for x in 250 1950 3350 4620; do
  node harness.mjs render --level 1 --x $x --frames 60 --out $S/new-l1-x$x.png > /dev/null
  node harness.mjs render --level 1 --x $x --frames 60 "${LEG[@]}" --out $S/legacy-l1-x$x.png > /dev/null
  echo "x$x $(node harness.mjs diff $S/new-l1-x$x.png $S/legacy-l1-x$x.png)"
done
node harness.mjs render --screen missions --out $S/new-missions.png
