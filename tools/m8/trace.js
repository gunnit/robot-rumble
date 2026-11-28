// Harness extra (sim): logs every hit the hero takes (when, where, his weapon, what was near, what the boss was
// doing), when each lock starts and ends, and a progress line every 10 s, to stderr. Use:
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/trace.js 2> trace.txt
{
  const orig = hurtPlayer;
  const big = () => { const e = G.enemies.find(e => e.type === 'ogglerex' || e.type === 'clubtail'); return e ? ' <' + e.type + ':' + e.state + ' hp=' + Math.round(e.hp) + ' d=' + Math.round(e.x - G.p.x) + '>' : ''; };
  const near = () => {
    const p = G.p, out = [];
    for (const e of G.enemies) if (e.active && !e.dead && Math.abs(e.x - p.x) < 90) out.push(e.type + ':' + (e.state || e.mode || '') + '@' + Math.round(e.x - p.x));
    for (const b of G.eb) if (Math.hypot(b.x - p.x, b.y - (p.y - 16)) < 40) out.push('eb.' + b.k);
    return out.join(' ');
  };
  hurtPlayer = function () {
    const p = G.p, h0 = p.hearts, r0 = p.ride ? p.ride.pips ?? p.ride.armour ?? p.ride.hp : null, d0 = p.dead;
    orig();
    const q = G.p, hit = q.hearts < h0 || (!d0 && q.dead) || (r0 != null && (!q.ride || (q.ride.pips ?? q.ride.armour ?? q.ride.hp) < r0));
    if (hit) console.log('HIT  t=' + (G.time / 60).toFixed(1) + ' x=' + Math.round(p.x) + ' sec=' + G.section + (r0 != null ? ' ride' : ' hearts ' + h0 + '>' + q.hearts) + ' lives=' + G.lives + ' ' + p.weapon + (L8.note ? ' [' + L8.note() + ']' : '') + ' | ' + near() + big());
  };
  const upd = updatePlay;
  let last = -1, locks = new Map(), sec = -1;
  updatePlay = function () {
    upd();
    if (!G.p) return;
    if (G.section !== sec) { sec = G.section; console.log('SEC  t=' + (G.time / 60).toFixed(1) + ' area ' + (sec + 1) + ' hearts=' + G.p.hearts + ' lives=' + G.lives + ' ' + G.p.weapon); }
    for (const l of G.locks) {
      const st = locks.get(l.at) || 0;
      if (!st && l.active) { locks.set(l.at, G.time); console.log('LOCK t=' + (G.time / 60).toFixed(1) + ' @' + l.at + ' starts'); }
      else if (st > 0 && l.done) { locks.set(l.at, -1); console.log('LOCK t=' + (G.time / 60).toFixed(1) + ' @' + l.at + ' done after ' + ((G.time - st) / 60).toFixed(1) + ' s'); }
    }
    const s = Math.floor(G.time / 600);
    if (s !== last) {
      last = s;
      const lk = G.locks.find(l => l.active && !l.done);
      console.log('at   t=' + (G.time / 60).toFixed(0) + ' x=' + Math.round(G.p.x) + ' cam=' + Math.round(G.cam.x) + ' hearts=' + G.p.hearts + ' lives=' + G.lives + ' cont=' + G.continues + (G.p.ride ? ' ride' : '') + (lk ? ' LOCK@' + lk.at : ''));
    }
  };
}
