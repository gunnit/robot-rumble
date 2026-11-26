'use strict';
// Polish proposal mock: mission cards that remember your stars and best score, and a star total on the title.
// Harness fixture (--extra); draws on top of the real screens. Mock data only: nothing is saved yet.
{
  const REC = [{ stars: 3, best: 14150 }, { stars: 2, best: 31950 }, { stars: 0, best: 0 }];
  const star = (x, y, on) => { drawStar(x, y, 7, OUT); drawStar(x, y, 5.5, on ? '#ffd23f' : '#3a3a4a'); if (on) drawStar(x - 1, y - 1.5, 2, '#fff6c2'); };
  const orig = draw;
  draw = function () {
    orig.apply(this, arguments);
    if (G.state === 'missions') {
      const n = LEVELS.length, gap = 28, bw = Math.min(196, Math.floor((W - 40 - gap * (n - 1)) / n));
      const x0 = Math.round(W / 2 - (n * bw + (n - 1) * gap) / 2);
      for (let i = 0; i < n; i++) {
        const bx = x0 + i * (bw + gap), by = 46, px = bx + 8, py = by + 8, pw = bw - 16, ph = 96, r = REC[i];
        ctx.fillStyle = 'rgba(8,8,24,0.78)'; ctx.fillRect(px, py + ph - 19, pw, 19);
        R(px, py + ph - 20, pw, 1, OUT);
        for (let s = 0; s < 3; s++) star(px + 12 + s * 16, py + ph - 10, s < r.stars);
        if (r.best) { text('BEST', px + pw - 3, py + ph - 17, '#9aa3c0', 1, 'right', null); text(String(r.best), px + pw - 3, py + ph - 9, '#ffe066', 1, 'right', null); }
        else text('NEW!', px + pw - 3, py + ph - 13, (G.t >> 4) & 1 ? '#ffe066' : '#ff9a1f', 1, 'right', null);
      }
    } else if (G.state === 'title') {
      const tot = REC.reduce((a, r) => a + r.stars, 0);
      panel(W / 2 - 60, 226, 120, 18);
      star(W / 2 - 46, 235, true);
      text(tot + ' / ' + REC.length * 3 + ' STARS', W / 2 + 8, 231, '#ffe066', 1, 'center');
    }
  };
}
