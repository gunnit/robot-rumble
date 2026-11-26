'use strict';
// ============================================================
// Screens: HUD, play frame, title, mission select, hero select, win, all clear, game over, pause
// Global: panel, drawStar, logoText (helpers content may use) and drawPlay, draw (window.*, for main.js and the
// harness). Everything else is private to the block below, so a content file may reuse any of its names.
// ============================================================
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(10,12,26,0.62)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y + h, w, 1);
}
function drawStar(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
// Big two-tone title text: darker base with a lighter top half
function logoText(s, y, sc, base, top, shadow) {
  text(s, W / 2, y, base, sc, 'center', shadow);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, Math.round(sc * 3)); ctx.clip();
  text(s, W / 2, y, top, sc, 'center', null);
  ctx.restore();
}

{
function grenadeIcon(x, y) { RO(x, y + 1, 5, 6, '#3e6b35'); R(x, y + 1, 5, 1, '#5f9a52'); R(x + 1, y - 1, 3, 2, '#9aa3ab'); }
const blinkOn = n => Math.floor(G.t / n) % 2 === 0;

function drawHUD() {
  const p = G.p, h = HEROES[G.hero];
  // hero panel: portrait, hearts, lives
  panel(4, 4, 118, 28);
  RO(8, 8, 18, 20, h.outD); R(8, 8, 18, 6, h.out);
  ctx.save(); ctx.beginPath(); ctx.rect(8, 8, 18, 20); ctx.clip(); spr(h.head, 10, 11); ctx.restore();
  text(h.name, 31, 8, h.col);
  for (let i = 0; i < 3; i++) drawHeart(31 + i * 10, 19, 1, i < p.hearts);
  text('X' + G.lives, 117, 19, '#ffffff', 1, 'right');
  // weapon panel (a ride shows its own gauges here)
  panel(126, 4, 104, 28);
  if (p.ride) RIDES[p.ride.type].hud(p.ride);
  else {
    const wp = weaponOf(p.weapon);
    wp.icon(131, 9);
    text(wp.label, 154, 8, '#ffe066');
    if (wp.ammo !== Infinity) {
      text(String(p.ammo), 226, 8, '#ffffff', 1, 'right');
      R(170, 20, 56, 4, '#2a2a3a'); R(170, 20, Math.round(56 * Math.min(1, p.ammo / wp.ammo)), 4, p.ammo < wp.ammo * 0.2 && G.t % 20 < 10 ? '#ff6b6b' : '#ffd23f');
    }
    grenadeIcon(133, 19);
    text('X' + p.bombs, 141, 20, p.bombs ? '#ffffff' : '#ff6b6b');
  }
  // score
  panel(W - 104, 4, 100, 28);
  text('SCORE', W - 9, 8, '#9aa3c0', 1, 'right');
  text(String(G.score).padStart(7, '0'), W - 9, 19, '#ffe066', 1, 'right');

  const boss = G.enemies.find(e => ENEMY_TYPES[e.type].boss);
  if (boss && !offStage(boss) && G.state !== 'over') {
    const bw = 200, bx = W / 2 - bw / 2, by = 44;
    panel(bx - 6, by - 10, bw + 12, 19);
    text(ENEMY_TYPES[boss.type].bossName || 'BOSS', bx, by - 7, '#ff6f61', 1, 'left');
    text(Math.ceil(100 * boss.hp / boss.max) + '%', bx + bw, by - 7, '#ffffff', 1, 'right');
    R(bx, by + 2, bw, 4, '#3a1414');
    R(bx, by + 2, Math.max(0, Math.round(bw * boss.hp / boss.max)), 4, boss.hp < boss.max / 2 ? '#ff3b30' : '#ff8c2e');
    R(bx, by + 2, Math.max(0, Math.round(bw * boss.hp / boss.max)), 1, '#ffd0a0');
  }
  if (G.banner) {
    ctx.globalAlpha = Math.min(1, G.banner.t / 30, (200 - G.banner.t) / 15);
    text(G.banner.s, W / 2, 44, '#ffffff', 2, 'center');
    ctx.globalAlpha = 1;
  }
  if (G.big) {
    const t = G.big.t, slide = Math.max(0, t - 95) * 30 - Math.max(0, 15 - t) * 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 96, W, 36);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 96, W, 2); ctx.fillRect(0, 130, W, 2);
    text(G.big.s, W / 2 + slide, 104, '#ffe066', 3, 'center');
  }
  if (G.goT > 0 && Math.floor(G.goT / 15) % 2) { text('GO', W - 40, 100, '#ffe066', 3, 'right'); text('>', W - 14, 100, '#ffe066', 3, 'right'); }
  if (G.warnT > 0) {
    const on = Math.floor(G.warnT / 10) % 2;
    ctx.fillStyle = 'rgba(160,0,0,0.4)'; ctx.fillRect(0, 96, W, 40);
    for (let x = -((G.t * 2) % 16); x < W; x += 16) { R(x, 96, 8, 3, '#ffd23f'); R(x, 133, 8, 3, '#ffd23f'); }
    if (on) text('WARNING!', W / 2, 105, '#ff4d4d', 3, 'center');
  }
}

// One game frame: level backdrop (screen space), world (translated by -cx), front layers, HUD
function drawPlay() {
  if (LV.drawScene && LV.drawScene()) return;
  const cx = Math.round(G.cam.x);
  const sx = G.shake ? Math.round(rand(-G.shake, G.shake)) : 0;
  const sy = G.shake ? Math.round(rand(-G.shake, G.shake)) : 0;
  ctx.save(); ctx.translate(sx, sy);
  if (LV.drawBG) LV.drawBG(cx); else { ctx.fillStyle = '#8fc8f0'; ctx.fillRect(-10, -10, W + 20, H + 20); }
  ctx.save(); ctx.translate(-cx, 0);
  if (LV.drawBehind) LV.drawBehind(cx);
  if (LV.drawGround) LV.drawGround(cx);
  if (LV.drawPlat) for (const pl of LV.plats) if (pl.x <= cx + W + 20 && pl.x + pl.w >= cx - 20) LV.drawPlat(pl);
  for (const o of G.props) drawProp(o);
  drawMarkers();
  for (const o of G.pows) drawPow(o);
  for (const it of G.items) drawItem(it);
  for (const e of G.enemies) if (e.active) drawEnemy(e);
  drawPlayer();
  drawGrenades();
  for (const b of G.pb) drawPB(b);
  for (const b of G.eb) drawEB(b);
  drawFx();
  ctx.restore();
  if (LV.drawFront) LV.drawFront(cx);
  if (LV.drawOverlay) LV.drawOverlay(cx);
  ctx.restore();
  if (G.sflash > 0) { ctx.fillStyle = 'rgba(255,250,230,' + G.sflash.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (LV.drawHUD) LV.drawHUD();
  if (G.intro && LV.intro.draw) LV.intro.draw();
}

// Mission 1 scenery scrolling behind the menus
function drawMenuBG() {
  const L = LEVELS[0], cx = Math.floor(G.t * 0.6) % 1400;
  L.drawBG(cx);
  ctx.save(); ctx.translate(-cx, 0); L.drawBehind(cx); L.drawGround(cx); ctx.restore();
  L.drawFront(cx);
}

function drawTitle() {
  drawMenuBG();
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(8,8,24,0.65)'); vg.addColorStop(0.6, 'rgba(8,8,24,0.2)'); vg.addColorStop(1, 'rgba(8,8,24,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const bob = Math.round(Math.sin(G.t * 0.05) * 2);
  logoText('ROBOT', 14 + bob, 5, '#ff9a1f', '#ffe066', '#3a1200');
  logoText('RUMBLE', 54 + bob, 5, '#e8541e', '#ffb347', '#3a0a00');
  ctx.fillStyle = '#c0392b'; ctx.fillRect(W / 2 - 96, 97, 192, 13); ctx.fillStyle = '#7b241c'; ctx.fillRect(W / 2 - 96, 109, 192, 1);
  text('A MISSION FOR INES & MATHIAS', W / 2, 100, '#ffffff', 1, 'center', '#5a1010');
  for (let i = 0; i < 2; i++) {
    ctx.save(); ctx.translate(i ? W - 62 : 62, GROUND); ctx.scale(3, 3);
    drawHero(HEROES[i], 0, 0, i ? -1 : 1, { pose: 'idle', t: G.t + i * 16, aim: (G.t + i * 120) % 240 < 40 ? 'up' : 'fwd', muzzle: (G.t + i * 120) % 240 < 40 && G.t % 8 < 3 ? 3 : 0 });
    ctx.restore();
  }
  if (blinkOn(30)) text('PRESS ENTER TO START', W / 2, 124, '#ffe066', 2, 'center');
  panel(116, 150, 248, 70);
  text('ARROWS: MOVE, AIM UP, CROUCH', W / 2, 157, '#ffffff', 1, 'center');
  text('Z: JUMP   X: SHOOT   C: GRENADE', W / 2, 171, '#ffffff', 1, 'center');
  text('RESCUE EVERYONE FOR POWER-UPS!', W / 2, 188, '#8be0a8', 1, 'center');
  text('P: PAUSE   M: MUSIC ON/OFF', W / 2, 204, '#9aa3c0', 1, 'center');
  // records: stars won over all missions, and the best score
  const got = LEVELS.reduce((a, L, i) => a + (G.rec[i] ? G.rec[i].stars | 0 : 0), 0);
  if (got) { miniStar(W / 2 - 46, 240, true); text(got + ' / ' + LEVELS.length * 3 + ' STARS', W / 2 + 6, 236, '#ffe066', 1, 'center'); }
  if (G.best) text('BEST SCORE ' + G.best, W / 2, 250, '#ffe066', 1, 'center');
}

// Card stripes + border shared by the mission and hero select screens
function selectCard(bx, by, bw, bh, sel, c1, c2) {
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, sel ? c1 : '#2a2a3a'); g.addColorStop(1, sel ? c2 : '#15151f');
  ctx.globalAlpha = sel ? 0.55 : 0.6; ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh); ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 4; ctx.beginPath();
  for (let x = bx - bh + (G.t % 12); x < bx + bw; x += 12) { ctx.moveTo(x, by + bh); ctx.lineTo(x + bh, by); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = sel ? '#ffe066' : '#555566'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  if (sel) {
    const a = Math.floor(G.t / 10) % 2 * 2;
    text('>', bx - 12 - a, by + 76, '#ffe066', 2, 'left');
    text('<', bx + bw + 2 + a, by + 76, '#ffe066', 2, 'left');
  }
}

const CARD_COLS = [['#3f9a52', '#1b5a32', '#8be0a8'], ['#3b8fd1', '#1d4f7a', '#bfe3ff'], ['#d35400', '#7e3200', '#ffc08a']];
// The boss named on a mission card: the boss of the mission's (last) boss lock, else any boss type in its waves
function bossOf(L) {
  const locks = (L.locks || []).slice().reverse();
  for (const l of [...locks.filter(l => l.boss), ...locks]) for (const w of l.waves) { const t = ENEMY_TYPES[w.t]; if (t && t.boss) return t; }
  return null;
}

function lockIcon(x, y) {
  const b = Math.round(Math.sin(G.t * 0.08) * 2);
  RO(x - 8, y - 15 + b, 3, 12, '#9aa3ab'); RO(x + 5, y - 15 + b, 3, 12, '#9aa3ab'); RO(x - 8, y - 17 + b, 16, 3, '#9aa3ab');
  R(x - 7, y - 17 + b, 14, 1, '#d5dbe0');
  RO(x - 11, y - 4 + b, 22, 17, '#f1c40f'); R(x - 11, y - 4 + b, 22, 2, '#fff3a0'); R(x - 11, y + 11 + b, 22, 2, '#b7950b');
  R(x - 2, y + b, 4, 4, OUT); R(x - 1, y + 3 + b, 2, 5, OUT);
}

// Filled pixel ellipse (crisp edges, unlike circ)
function pixelDisc(x, y, r, col, ry = r) {
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(r * Math.sqrt(1 - (dy / ry) * (dy / ry))); R(x - w, y + dy, w * 2 + 1, 1, col); }
}
// Tree crown from overlapping ellipses [x, y, rx, ry] with one shared outline (like blob)
function crown(parts, col) {
  for (const [x, y, rx, ry] of parts) pixelDisc(x, y, rx + 1, OUT, ry + 1);
  for (const [x, y, rx, ry] of parts) pixelDisc(x, y, rx, col, ry);
}

// Locked card art while Mission 2 is being built: Vigo by night. A stone house on a hill with chestnut and
// cherry trees, the moon over the ría and the city lights on the far shore, and a bobbing padlock.
function drawLockedPreview(px, py, pw, ph) {
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, '#10122a'); g.addColorStop(1, '#2c2048');
  ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
  const mx = px + pw - 30, my = py + 17;
  for (let s = 0; s < 24; s++) {
    const sx = px + Math.floor(hsh(s) * pw), sy = py + Math.floor(hsh(s + 40) * ph * 0.55);
    if (Math.abs(sx - mx) > 11 || Math.abs(sy - my) > 11) R(sx, sy, 1, 1, (G.t + s * 17) % 80 < 40 ? '#ffffff' : '#6a6a90');
  }
  // moon with a soft halo
  pixelDisc(mx, my, 10, 'rgba(255,246,200,0.08)'); pixelDisc(mx, my, 7, '#e9e4c4'); pixelDisc(mx - 1, my - 1, 6, '#fbf7dc');
  R(mx + 1, my - 3, 2, 2, '#d8d1aa'); R(mx - 3, my + 2, 3, 2, '#d8d1aa'); R(mx + 3, my + 3, 1, 1, '#d8d1aa');
  // the ría: far shore with Vigo's lights, then water with the moon's reflection
  const sea = py + ph - 36;
  R(px, sea - 4, pw, 4, '#191633');
  for (let i = 0; i < 16; i++) R(px + 70 + Math.floor(hsh(i + 90) * (pw - 74)), sea - 3 + (i % 2), 1, 1, (G.t + i * 23) % 140 < 120 ? '#ffd23f' : '#8a7430');
  R(px, sea, pw, 22, '#1b2350');
  for (let i = 0; i < 9; i++) R(px + 66 + Math.floor(hsh(i + 60) * (pw - 70)), sea + 3 + i * 2, 4, 1, '#2c3a78');
  for (let i = 0; i < 6; i++) R(mx - 4 + Math.round(Math.sin(G.t * 0.06 + i * 1.3) * 2), sea + 2 + i * 3, 8 - (i & 1) * 3, 1, '#d8d2a0');
  // the hill: a plateau for the house, then a slope down to the water, in 2px columns
  const top = x => Math.round(ph - (x < 46 ? 36 : x < 126 ? 17 + 19 * (0.5 + 0.5 * Math.cos((x - 46) / 80 * Math.PI)) : 17 + 2 * Math.sin(x * 0.08)));
  for (let x = 0; x < pw; x += 2) {
    const t = top(x);
    R(px + x, py + t, 2, ph - t, '#16132a'); R(px + x, py + t, 2, 1, '#3d396a');
    if (hsh(x + 3) > 0.6) R(px + x + (hsh(x) > 0.5 ? 1 : 0), py + t - 1, 1, 1, '#3d396a');
  }
  // trees: a big chestnut beside the house, cherry trees in blossom down at the shore
  const tree = (x, cherry) => {
    const tx = px + x, ty = py + top(x);
    if (cherry) {
      RO(tx - 1, ty - 7, 2, 7, '#2a1f2a');
      crown([[tx - 3, ty - 11, 6, 4], [tx + 3, ty - 13, 5, 4], [tx, ty - 15, 5, 3]], '#7a4466');
      for (let i = 0; i < 12; i++) R(tx - 8 + Math.floor(hsh(i + x) * 16), ty - 18 + Math.floor(hsh(i + x + 30) * 10), 1, 1, i % 3 ? '#d48fb2' : '#f2cde0');
    } else {
      RO(tx - 2, ty - 10, 4, 10, '#2a1f2a');
      crown([[tx - 5, ty - 15, 8, 6], [tx + 5, ty - 17, 7, 6], [tx, ty - 22, 7, 5]], '#1d3a33');
      for (let i = 0; i < 10; i++) R(tx - 11 + Math.floor(hsh(i + 7) * 22), ty - 25 + Math.floor(hsh(i + 17) * 13), 2, 1, i % 3 ? '#2b5346' : '#7f9a44');
    }
  };
  tree(58, false); tree(126, true); tree(152, true);
  // the house: granite walls, a stepped clay-tile roof, a chimney with smoke and two lit windows
  const hx = px + 12, gy = py + top(20);
  RO(hx, gy - 12, 24, 12, '#3a3760');
  R(hx + 2, gy - 10, 4, 1, '#4a4774'); R(hx + 13, gy - 4, 5, 1, '#4a4774'); R(hx + 18, gy - 9, 3, 1, '#4a4774'); R(hx + 3, gy - 3, 3, 1, '#4a4774');
  RO(hx + 17, gy - 22, 4, 6, '#3a3760'); R(hx + 17, gy - 22, 4, 1, '#55527f');
  for (let i = 0; i < 4; i++) { const rx = hx - 3 + i * 4, rw = 30 - i * 8; R(rx - 1, gy - 15 - i * 2, rw + 2, 3, OUT); }
  for (let i = 0; i < 4; i++) { const rx = hx - 3 + i * 4, rw = 30 - i * 8; R(rx, gy - 14 - i * 2, rw, 2, '#6a3450'); R(rx, gy - 14 - i * 2, rw, 1, '#8a4a68'); }
  for (let i = 0; i < 3; i++) { // chimney smoke
    const k = Math.floor((G.t * 0.25 + i * 6) % 18);
    R(hx + 18 + Math.floor(k / 4), gy - 25 - k, 2, 2, 'rgba(170,160,210,' + (0.4 * (1 - k / 18)).toFixed(2) + ')');
  }
  const lit = G.t % 120 < 100 ? '#ffd23f' : '#d9a92a';
  R(hx + 1, gy - 10, 7, 6, 'rgba(255,210,63,0.18)'); R(hx + 16, gy - 10, 7, 6, 'rgba(255,210,63,0.18)');
  RO(hx + 3, gy - 8, 3, 3, lit); RO(hx + 18, gy - 8, 3, 3, lit);
  RO(hx + 10, gy - 7, 4, 7, '#2b1d2a'); R(hx + 10, gy - 1, 4, 1, '#8a6a20');
  lockIcon(px + pw / 2 + (G.lockT > 0 ? Math.round(Math.sin(G.lockT * 1.7) * G.lockT / 8) : 0), py + ph / 2 - 2);
}

// Card art for a mission without its own preview(): the card colours and the hero
function drawPlainPreview(px, py, pw, ph, c1, c2) {
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
  R(px, py + ph - 14, pw, 14, OUT); R(px, py + ph - 13, pw, 2, c1);
  ctx.save(); ctx.translate(Math.round(px + pw / 2), py + ph - 14); ctx.scale(2, 2);
  drawHero(HEROES[G.hero], 0, 0, 1, { pose: 'idle', t: G.t, aim: 'fwd' });
  ctx.restore();
}

// Small star with an outline (mission cards, title)
function miniStar(x, y, on) {
  drawStar(x, y, 7, OUT); drawStar(x, y, 5.5, on ? '#ffd23f' : '#3a3a4a');
  if (on) drawStar(x - 1, y - 1.5, 2, '#fff6c2');
}
// Strip along the bottom of a card's picture: the best stars and score of that mission, or NEW! before the first win
function cardRecord(r, x, y, w, sel) {
  const stars = r ? r.stars | 0 : 0;
  ctx.fillStyle = 'rgba(8,8,24,0.78)'; ctx.fillRect(x, y, w, 19);
  R(x, y - 1, w, 1, OUT);
  for (let s = 0; s < 3; s++) miniStar(x + 12 + s * 16, y + 9, s < stars);
  if (stars) { text('BEST', x + w - 3, y + 2, '#9aa3c0', 1, 'right', null); text(String(r.best | 0), x + w - 3, y + 10, '#ffe066', 1, 'right', null); }
  else text('NEW!', x + w - 3, y + 6, sel && (G.t >> 4) & 1 ? '#ff9a1f' : '#ffe066', 1, 'right', null);
}

// big: titles at 2x (narrow cards with 3+ missions drop them all to 1x when one doesn't fit)
function missionCard(i, bx, by, bw, bh, big) {
  const L = LEVELS[i], sel = !!L && G.level === i, cx = bx + bw / 2;
  const [c1, c2, c3] = CARD_COLS[i % CARD_COLS.length];
  selectCard(bx, by, bw, bh, sel, c1, c2);
  if (!L && G.lockT > 0 && G.lockT % 10 < 5) { ctx.strokeStyle = '#ff9a1f'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2); }
  const px = bx + 8, py = by + 8, pw = bw - 16, ph = 96;
  ctx.fillStyle = OUT; ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  if (L) {
    // the picture sits 12 px higher than its frame, so the record strip below covers soil, not the characters' feet
    ctx.save(); ctx.translate(0, -12);
    if (L.preview) L.preview(px, py, pw, ph); else drawPlainPreview(px, py, pw, ph, c1, c2);
    ctx.restore();
    if (!sel) { ctx.fillStyle = 'rgba(10,10,30,0.55)'; ctx.fillRect(px, py, pw, ph); }
    cardRecord(G.rec[i], px, py + ph - 19, pw, sel);
  } else drawLockedPreview(px, py, pw, ph);
  ctx.restore();
  if (L) {
    const boss = bossOf(L), n = (L.sections || []).length, room = bw - 8;
    const areas = n + (n === 1 ? ' AREA' : ' AREAS'), bossLine = boss && boss.bossName ? 'BOSS: ' + boss.bossName : '';
    // narrow cards (3+ missions): areas and boss on separate lines when they don't fit on one
    text(L.mission || 'MISSION ' + (i + 1), cx, by + 112, sel ? '#ffe066' : '#777788', 1, 'center');
    text(L.title || '', cx, by + (big ? 124 : 127), sel ? '#ffffff' : '#777788', big ? 2 : 1, 'center');
    const info = areas + (bossLine ? '   ' + bossLine : ''), ic = sel ? c3 : '#666677';
    if (info.length * 6 - 1 <= room) text(info, cx, by + 146, ic, 1, 'center');
    else if (!bossLine || bossLine.length * 6 - 1 <= room) { text(areas, cx, by + 142, ic, 1, 'center'); if (bossLine) text(bossLine, cx, by + 154, ic, 1, 'center'); }
    else { text(areas, cx, by + 140, ic, 1, 'center'); text('BOSS:', cx, by + 151, ic, 1, 'center'); text(boss.bossName, cx, by + 161, ic, 1, 'center'); } // a long boss name gets its own line
  } else {
    text('MISSION ' + (i + 1), cx, by + 112, '#9a9ab0', 1, 'center');
    text('COMING SOON', cx, by + 124, G.lockT > 0 && G.lockT % 10 < 5 ? '#ffe066' : '#b8a060', 2, 'center');
    text('A NEW ADVENTURE!', cx, by + 146, '#8a8aa0', 1, 'center');
  }
}

// Mission select: a card for every mission (a locked one while Mission 2 is being built)
function drawMissions() {
  drawMenuBG();
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, W, H);
  logoText('CHOOSE YOUR MISSION!', 14, 3, '#ff9a1f', '#ffe066', '#3a1200');
  const total = Math.max(2, LEVELS.length), n = Math.min(3, total), first = clamp(G.level - 1, 0, total - n);
  const gap = 28, bw = Math.min(196, Math.floor((W - 40 - gap * (n - 1)) / n));
  const x0 = Math.round(W / 2 - (n * bw + (n - 1) * gap) / 2);
  const big = LEVELS.every(L => String(L.title || '').length * 12 - 2 <= bw - 8);
  for (let i = 0; i < n; i++) missionCard(first + i, x0 + i * (bw + gap), 46, bw, 172, big);
  if (total > n) {
    text('MISSION ' + (G.level + 1) + ' / ' + LEVELS.length, W / 2, 225, '#a4dce5', 1, 'center');
    if (first > 0) text('<', 8, 124, '#ffe066', 1, 'center');
    if (first + n < total) text('>', W - 8, 124, '#ffe066', 1, 'center');
  }
  if (blinkOn(25)) text(LEVELS.length > 1 ? 'LEFT / RIGHT: CHOOSE      ENTER: GO!' : 'ENTER: GO!', W / 2, 238, '#ffffff', 1, 'center');
}

function drawSelect() {
  const L = LEVELS[0], M = LEVELS[G.level];
  if (G.level > 0 && M && M.menuBG) M.menuBG();
  else { L.drawBG(200); ctx.save(); ctx.translate(-200, 0); L.drawGround(200); ctx.restore(); }
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, W, H);
  logoText('CHOOSE YOUR HERO!', 14, 3, '#ff9a1f', '#ffe066', '#3a1200');
  const lines = ['LOVES ADVENTURE!', 'NEVER GIVES UP!'];
  for (let i = 0; i < 2; i++) {
    const h = HEROES[i], cx = i ? 330 : 150, sel = G.hero === i;
    const bx = cx - 72, by = 48, bw = 144, bh = 172;
    selectCard(bx, by, bw, bh, sel, h.out, h.outD);
    ctx.save(); ctx.translate(cx, by + 120); ctx.scale(3, 3);
    if (!sel) ctx.globalAlpha = 0.45;
    drawHero(h, 0, 0, i ? -1 : 1, sel ? { pose: 'run', t: G.t, aim: 'fwd', muzzle: G.t % 24 < 3 ? 3 : 0 } : { pose: 'idle', t: G.t, aim: 'fwd' });
    ctx.restore(); ctx.globalAlpha = 1;
    text(h.name, cx, by + 128, sel ? '#ffffff' : '#777788', 2, 'center');
    text(lines[i], cx, by + 148, sel ? h.col : '#666677', 1, 'center');
  }
  if (blinkOn(25)) text('LEFT / RIGHT: CHOOSE      ENTER: GO!', W / 2, 238, '#ffffff', 1, 'center');
}

function drawOver() {
  drawPlay();
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  logoText('GAME OVER', 52, 4, '#c0392b', '#ff6b6b', '#200000');
  text('CONTINUE?', W / 2, 112, '#ffffff', 2, 'center');
  const n = Math.max(0, Math.ceil(G.overT / 60) - 1);
  logoText(String(n), 134, 5, '#ff9a1f', '#ffe066', '#3a1200');
  if (blinkOn(25)) text('PRESS ENTER TO KEEP GOING!', W / 2, 196, '#ffe066', 1, 'center');
}

function drawFireworks() { for (const f of G.fw) { ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); } }

function drawWin() {
  drawPlay();
  ctx.fillStyle = 'rgba(0,0,20,0.62)'; ctx.fillRect(0, 0, W, H);
  drawFireworks();
  const h = HEROES[G.hero];
  logoText('MISSION', 16, 4, '#ff9a1f', '#ffe066', '#3a1200');
  logoText('COMPLETE!', 48, 4, '#e8541e', '#ffb347', '#3a0a00');
  text('GREAT JOB, ' + h.name + '!', W / 2, 88, h.col, 2, 'center');
  // stars: finishing, freeing every prisoner, never needing a continue
  const stars = missionStars();
  for (let i = 0; i < 3; i++) {
    const shown = G.endT > 40 + i * 20, on = i < stars && shown;
    const pop = shown && G.endT < 52 + i * 20 ? 1.3 : 1;
    drawStar(W / 2 - 34 + i * 34, 122, 13 * pop, OUT);
    drawStar(W / 2 - 34 + i * 34, 122, 11 * pop, on ? '#ffd23f' : '#3a3a4a');
    if (on) drawStar(W / 2 - 36 + i * 34, 119, 4, '#fff6c2');
  }
  const s = Math.floor(G.time / 60);
  const shownScore = Math.min(G.score, Math.floor(G.score * Math.min(1, G.endT / 90)));
  panel(W / 2 - 100, 142, 200, 50);
  text('SCORE', W / 2 - 90, 149, '#9aa3c0'); text(String(shownScore), W / 2 + 90, 149, '#ffe066', 1, 'right');
  text(LV.freedLabel || 'PRISONERS FREED', W / 2 - 90, 163, '#9aa3c0'); text(G.freed.size + ' / ' + LV.pows.length, W / 2 + 90, 163, '#ffffff', 1, 'right');
  text('TIME', W / 2 - 90, 177, '#9aa3c0'); text(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), W / 2 + 90, 177, '#ffffff', 1, 'right');
  if (LV.drawWinExtras) LV.drawWinExtras();
  ctx.save(); ctx.translate(62, 236 - Math.abs(Math.sin(G.endT * 0.12)) * 14); ctx.scale(2, 2);
  drawHero(h, 0, 0, 1, { pose: 'jump', t: G.endT, aim: 'up', muzzle: G.endT % 20 < 3 ? 3 : 0 });
  ctx.restore();
  const next = LEVELS[G.level + 1];
  const prompt = next ? 'PRESS ENTER FOR ' + (next.mission || 'MISSION ' + (G.level + 2)) + '!' : LEVELS.length > 1 ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER TO PLAY AGAIN';
  if (G.endT > 120 && blinkOn(25)) text(prompt, W / 2, 214, '#ffe066', 1, 'center');
}

// Pixel star (7x7) for sprites drawn at 3x, where drawStar's smooth edges would show
const STAR7 = ['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'xx...xx'];
function pixelStar(x, y, col) {
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (STAR7[r][c] === 'x') R(x - 3 + c, y - 3 + r, 1, 1, col);
}

// Trophy, 1px units with its base centred on (x, y): drawn at 3x like the heroes
function drawTrophy(x, y) {
  const GD = '#f1c40f', GL = '#fff3a0', GDD = '#b7950b';
  RO(x - 13, y - 24, 3, 7, GD); RO(x + 10, y - 24, 3, 7, GD); R(x - 11, y - 18, 2, 2, GD); R(x + 9, y - 18, 2, 2, GD);
  RO(x - 9, y - 26, 18, 12, GD); R(x - 9, y - 26, 18, 2, GL); R(x - 7, y - 23, 1, 6, GL); R(x + 6, y - 24, 2, 9, GDD);
  RO(x - 5, y - 14, 10, 2, GDD); RO(x - 2, y - 12, 4, 4, GDD); R(x - 2, y - 12, 1, 4, GD);
  RO(x - 8, y - 8, 16, 3, '#8a5a2b'); R(x - 8, y - 8, 16, 1, '#b07a45');
  RO(x - 11, y - 5, 22, 5, '#6b4423'); R(x - 11, y - 5, 22, 1, '#a9743f');
  pixelStar(x + 1, y - 19, GDD); pixelStar(x, y - 20, '#fff6c2');
}

// After the last mission: night sky, fireworks, both heroes cheering around the trophy on the jungle grass
function drawAllClear() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0b2a'); g.addColorStop(1, '#4a2a6a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = (G.t + i * 13) % 90 < 45 ? '#ffffff' : '#7a7aa0'; ctx.fillRect(Math.floor(hsh(i) * W), Math.floor(hsh(i + 70) * 170), 1, 1); }
  drawFireworks();
  ctx.save(); ctx.translate(-200, 0); LEVELS[0].drawGround(200); ctx.restore();
  ctx.fillStyle = 'rgba(16,10,48,0.4)'; ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6); // moonlight on the grass
  logoText('ALL MISSIONS', 14, 4, '#ff9a1f', '#ffe066', '#3a1200');
  logoText('COMPLETE!', 46, 4, '#e8541e', '#ffb347', '#3a0a00');
  const h = HEROES[G.hero];
  text('YOU SAVED THE DAY, ' + h.name + '!', W / 2, 84, h.col, 2, 'center');
  panel(W / 2 - 100, 104, 200, 36);
  text('FINAL SCORE', W / 2 - 90, 111, '#9aa3c0'); text(String(Math.min(G.score, Math.floor(G.score * Math.min(1, G.endT / 90)))), W / 2 + 90, 111, '#ffe066', 1, 'right');
  text('BEST SCORE', W / 2 - 90, 125, '#9aa3c0'); text(String(G.best), W / 2 + 90, 125, '#ffffff', 1, 'right');
  const ty = GROUND - Math.round(Math.abs(Math.sin(G.endT * 0.05)) * 4);
  ctx.save(); ctx.translate(W / 2, ty); ctx.scale(3, 3);
  drawTrophy(0, 0);
  if (G.endT % 50 < 8) { const gy = -24 + (G.endT % 50 >> 1); R(-6, gy - 1, 1, 3, '#ffffff'); R(-7, gy, 3, 1, '#ffffff'); } // a glint on the cup
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    ctx.save(); ctx.translate(i ? W - 90 : 90, GROUND - Math.abs(Math.sin(G.endT * 0.12 + i * 1.6)) * 18); ctx.scale(3, 3);
    drawHero(HEROES[i], 0, 0, i ? -1 : 1, { pose: 'jump', t: G.endT, aim: 'up', muzzle: (G.endT + i * 10) % 20 < 3 ? 3 : 0 });
    ctx.restore();
  }
  if (G.endT > 120 && blinkOn(25)) text('PRESS ENTER', W / 2, 250, '#ffe066', 1, 'center');
}

function drawPause() {
  drawPlay();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  if (LV.drawPause) { LV.drawPause(); return; }
  logoText('PAUSED', 64, 4, '#9aa3c0', '#ffffff', '#000000');
  panel(116, 112, 248, 56);
  text(LV.controls ? LV.controls[0] : 'ARROWS: MOVE, AIM UP, CROUCH', W / 2, 119, '#ffffff', 1, 'center');
  text(LV.controls ? LV.controls[1] : 'Z: JUMP   X: SHOOT   C: GRENADE', W / 2, 133, '#ffffff', 1, 'center');
  text('M: MUSIC ' + (Music.on ? 'ON' : 'OFF') + '   Q: QUIT TO TITLE', W / 2, 150, '#9aa3c0', 1, 'center');
  const ride = G.p && G.p.ride && RIDES[G.p.ride.type];
  if (ride && ride.help) text(ride.help, W / 2, 174, '#8be0a8', 1, 'center'); // the ride's own keys
  else if (LV.pauseHint) text(LV.pauseHint, W / 2, 174, '#cbe7e3', 1, 'center');
  if (blinkOn(25)) text('PRESS P OR ENTER TO KEEP PLAYING', W / 2, 190, '#ffe066', 1, 'center');
}

function draw() {
  switch (G.state) {
    case 'title': drawTitle(); break;
    case 'missions': drawMissions(); break;
    case 'select': drawSelect(); break;
    case 'play': drawPlay(); break;
    case 'pause': drawPause(); break;
    case 'over': drawOver(); break;
    case 'win': drawWin(); break;
    case 'allclear': drawAllClear(); break;
  }
  if (!Music.on && G.state !== 'play' && G.state !== 'pause') text('MUSIC OFF', W - 6, H - 10, '#888888', 1, 'right');
  if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + G.fade.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
}

window.drawPlay = drawPlay;
window.draw = draw;
}
