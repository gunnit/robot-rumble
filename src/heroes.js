'use strict';
// ============================================================
// Heroes
// ============================================================
const SKIN = '#f8cfa8', SKIND = '#d9a07c';
const BOOT = '#5b3a26', BOOTD = '#3f281a', BOOTL = '#7d5236', SOLE = '#2a1a12';
const FACE = { k: OUT, s: SKIN, S: SKIND, w: '#ffffff', e: '#2b1d14', m: '#b0473a', p: '#f4978e' };
const INES_HAIR = { h: '#e8762c', H: '#b4521a', j: '#ffab5e', y: '#ffd84d' };
const HEROES = [
  {
    name: 'INES', col: '#d7a6ef',
    out: '#9b59b6', outD: '#6c3483', outL: '#c58fe0', pants: '#33467d', pantsD: '#243258',
    strap: '#7a5230', acc: '#ffd84d', pack: '#6b7a3a', packL: '#8a9a4e',
    head: makeSprite([
      '....kkkkkk....',
      '..kkhhjjjhkk..',
      '.khhhjjjhhhhk.',
      '.khhhhhhhhhhhk',
      'khhhhhhhhhhhhk',
      'khhhhhhhhhHhhk',
      'khhhhhhHsHsHsk',
      'khhhhhHsssHHk.',
      'khHhhhsssswek.',
      'khHhhSssssweSk',
      '.kHhhSsssssssk',
      '.kHHkSssspssk.',
      '..kk.kSssmsk..',
      '......kkkkk...'
    ], { ...FACE, ...INES_HAIR }),
    tail: makeSprite([
      '....kk.',
      '...kyyk',
      '..khhyk',
      '.khhhhk',
      'khhjhk.',
      'khhhHk.',
      '.kHHk..',
      '..kk...'
    ], { k: OUT, ...INES_HAIR })
  },
  {
    name: 'MATHIAS', col: '#8be0a8',
    out: '#2ecc71', outD: '#1d8a4a', outL: '#7be3a6', pants: '#6b6b45', pantsD: '#4d4d31',
    strap: '#6b4423', acc: '#ffd84d', pack: '#7a5a3a', packL: '#9a7a52',
    head: makeSprite([
      '...kkkkkkk.....',
      '..kcqqqccck....',
      '.kcqqcccccck...',
      '.kcccccccccckkk',
      'kCcccccccccCCCk',
      'kCCCCCCCCCCkkk.',
      'khhhhhhsssHHk..',
      'khHhhhsssswek..',
      'khHhhSssssweSk.',
      '.kHhhSsssssssk.',
      '.kHhkSsssssk...',
      '..kk.kSssmsk...',
      '......kkkkk....'
    ], { ...FACE, h: '#6e4b2a', H: '#4a3019', c: '#e03b3b', C: '#962323', q: '#ff8080' })
  }
];
// 6-frame run cycle: [backLeg, frontLeg] as [x, lift]
const RUN6 = [[[-6, 0], [2, 0]], [[-4, 1], [1, 0]], [[-2, 3], [-1, 0]], [[2, 0], [-6, 0]], [[1, 0], [-4, 1]], [[-1, 0], [-2, 3]]];

function heroLeg(h, lx, lift, back) {
  const y = -11 - lift;
  RO(lx, y, 4, 8, back ? h.pantsD : h.pants);
  if (!back) R(lx, y, 1, 8, h.pantsD);
  RO(lx, y + 8, 5, 3, back ? BOOTD : BOOT);
  R(lx, y + 10, 5, 1, SOLE);
  if (!back) R(lx + 1, y + 8, 3, 1, BOOTL);
}
function flashAt(x, y, big) {
  const a = big ? 6 : 4;
  R(x - a, y - 1, a * 2 + 1, 3, '#ffb52e'); R(x - 1, y - a, 3, a * 2 + 1, '#ffb52e');
  R(x - 2, y - 2, 5, 5, '#ffe066'); R(x - 1, y - 1, 3, 3, '#ffffff');
}

// Draws a hero with feet at (x, y). o = { pose, t, aim, weapon, muzzle, knife, rot }
function drawHero(h, x, y, facing, o) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  if (o.rot) { ctx.translate(0, -14); ctx.rotate(o.rot); ctx.translate(0, 14); }
  const crouch = o.pose === 'crouch';
  let legs = [[-4, 0], [0, 0]], bob = 0;
  if (o.pose === 'run') { const f = Math.floor(o.t / 4) % 6; legs = RUN6[f]; bob = f === 2 || f === 5 ? -1 : 0; }
  else if (o.pose === 'jump') legs = [[-5, 3], [1, 1]];
  else if (o.pose === 'idle') bob = Math.floor(o.t / 32) % 2;
  const dy = (crouch ? 8 : 0) + bob, ty = -21 + dy;
  const r = o.muzzle > 2 ? 1 : 0; // recoil

  // back leg
  if (crouch) { RO(-8, -6, 7, 3, h.pantsD); RO(-9, -3, 5, 3, BOOTD); R(-9, -1, 5, 1, SOLE); }
  else heroLeg(h, legs[0][0], legs[0][1], true);
  // backpack + ponytail
  RO(-9, ty + 1, 4, 7, h.pack); R(-9, ty + 1, 4, 1, h.packL); R(-8, ty + 4, 2, 1, OUT);
  if (h.tail) spr(h.tail, -13, ty - 11 + (o.pose === 'run' ? Math.floor(o.t / 6) % 2 : 0) - (o.pose === 'jump' ? 1 : 0));
  // rear arm: its hand steadies the gun
  if (!o.knife && o.aim === 'fwd') { RO(-2, ty + 4, 8, 2, h.outD); RO(6 - r, ty + 4, 2, 2, SKIND); }
  // hips + torso
  RO(-5, -13 + dy, 10, 2, h.pants);
  RO(-5, ty, 10, 9, h.out);
  R(-5, ty, 2, 9, h.outD); R(-3, ty, 7, 1, h.outL); R(4, ty + 1, 1, 6, h.outL);
  R(-1, ty, 3, 1, SKIND);
  for (let i = 0; i < 7; i++) R(-4 + i, ty + 1 + i, 2, 1, h.strap);
  R(-5, ty + 7, 10, 2, '#4a2f1b'); R(1, ty + 7, 2, 2, h.acc);
  // head
  spr(h.head, -7, ty - h.head.h + 1);
  // front leg
  if (crouch) { RO(-1, -7, 7, 3, h.pants); RO(4, -5, 3, 3, h.pants); RO(3, -3, 6, 3, BOOT); R(3, -1, 6, 1, SOLE); R(4, -3, 4, 1, BOOTL); }
  else heroLeg(h, legs[1][0], legs[1][1], false);
  // front arm + weapon
  if (o.knife > 0) {
    RO(-1, ty + 2, 5, 3, h.out); RO(4, ty + 3, 5, 2, SKIN);
    RO(9, ty + 2, 8, 2, '#dfe6e9'); R(9, ty + 3, 8, 1, '#95a5a6'); RO(7, ty + 2, 2, 3, '#5b3a1e');
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(4, ty + 4, 17, -1.3, 1.1); ctx.stroke();
  } else {
    const wp = weaponOf(o.weapon);
    if (o.aim === 'up') { RO(1, ty - 2, 3, 5, h.out); RO(4, ty - 5, 3, 3, SKIN); }
    else if (o.aim === 'down') { RO(0, ty + 3, 3, 5, h.out); RO(0, ty + 8, 3, 2, SKIN); }
    else { R(-1, ty + 2, 5, 3, h.out); R(-1, ty + 2, 5, 1, h.outL); R(-1, ty + 5, 5, 1, OUT); R(-2, ty + 2, 1, 3, h.outD); RO(4 - r, ty + 3, 3, 2, SKIN); }
    wp.drawGun(o.aim, ty, r);
    if (o.muzzle > 0) {
      const m = wp.muzzle(o.aim);
      if (wp.flash) wp.flash(m[0], m[1] + dy - bob, o.aim); else flashAt(m[0], m[1] + dy - bob, wp.bigFlash);
    }
  }
  ctx.restore();
}
