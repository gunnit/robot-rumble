H=tools/harness/harness.mjs
r(){ node $H render --level $1 --x $2 --frames ${3:-150} --scale 1 --out tools/audit/shots/l$1-$2.png >/dev/null 2>&1; }
for x in 300 1150 1900 2500 3300 3750 4500 4700; do r 1 $x & done; wait
for x in 300 1000 1700 2300 3000 3600 4600 5800; do r 2 $x & done; wait
for x in 300 1250 2400 3000 3450 4200 4500 5800; do r 3 $x & done; wait
for x in 300 1000 1900 2700 3500 4100 5200 6000; do r 4 $x & done; wait
for x in 300 1150 1800 2250 3500 4450 5200 6000; do r 5 $x & done; wait
for x in 300 1200 1900 2600 3600 5400 6450 7200 8250 9850; do r 6 $x & done; wait
for x in 300 1150 1800 3500 4400 5500 6500 7300 9000 10050; do r 7 $x & done; wait
