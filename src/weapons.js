'use strict';
// ============================================================
// Weapons: name -> { label, ammo, maxAmmo, cd, tapCd?, muzzle(aim), fire(p, mx, my, dx, dy),
//   drawGun(aim, ty, r), icon(x, y), bigFlash?, flash?(x, y, aim) }  (see docs/engine-api.md)
// ============================================================
const GUN = '#6f7a86', GUNL = '#b8c2cc', GUND = '#3c434d';
const WEAPONS = {};

// Weapon by name; unknown names fall back to the pistol
function weaponOf(name) {
  const w = WEAPONS[name];
  if (w) return w;
  if (name) warnOnce('weapon', name);
  return WEAPONS.pistol;
}

// Spent shell flying out of the gun
function casing(p, size) {
  G.parts.push({ type: 'debris', x: p.x + p.facing * 5, y: p.y - 21 + (p.crouch ? 8 : 0), vx: -p.facing * rand(0.6, 1.4), vy: -rand(1.6, 2.6), g: 0.2, life: 40, max: 40, size, c: '#e8b43a' });
}

WEAPONS.pistol = {
  label: 'PISTOL', ammo: Infinity, maxAmmo: Infinity, cd: 9, tapCd: 4,
  muzzle: aim => aim === 'up' ? [5, -37] : aim === 'down' ? [1, -2] : [16, -19],
  fire(p, mx, my, dx, dy) {
    G.pb.push({ x: mx, y: my, vx: dx * 6, vy: dy * 6, dmg: 1, life: 90 });
    casing(p, 1);
    Snd.shoot();
  },
  drawGun(aim, ty, r) {
    if (aim === 'up') { RO(4, ty - 14 + r, 3, 9, GUN); R(5, ty - 14 + r, 1, 9, GUNL); }
    else if (aim === 'down') { RO(0, ty + 10 - r, 3, 8, GUN); R(1, ty + 10 - r, 1, 8, GUNL); }
    else {
      RO(6 - r, ty + 1, 9, 3, GUN); R(6 - r, ty + 1, 9, 1, GUNL); R(13 - r, ty + 2, 2, 1, GUND);
      RO(7 - r, ty + 4, 3, 3, GUND);
    }
  },
  icon(x, y) { RO(x + 2, y, 9, 3, GUN); R(x + 2, y, 9, 1, GUNL); RO(x + 3, y + 3, 3, 3, GUND); }
};

function hmgShot(b) {
  const x = Math.round(b.x), y = Math.round(b.y);
  if (Math.abs(b.vy) > Math.abs(b.vx)) { R(x - 1, y - 5, 2, 10, '#ffb52e'); R(x - 1, y - 2, 2, 4, '#ffffff'); }
  else { R(x - 5, y - 1, 10, 2, '#ffb52e'); R(x - 2, y - 1, 4, 2, '#ffffff'); }
}

WEAPONS.hmg = {
  label: 'H.M.G.', ammo: 200, maxAmmo: 400, cd: 4, tapCd: 4, bigFlash: true,
  muzzle: aim => aim === 'up' ? [5, -45] : aim === 'down' ? [1, 1] : [24, -19],
  fire(p, mx, my, dx, dy) {
    const s = (Math.random() - 0.5) * 0.8;
    G.pb.push({ x: mx, y: my, vx: dx ? dx * 7 : s, vy: dy ? dy * 7 : s, dmg: 1, life: 90, draw: hmgShot });
    casing(p, 2);
    Snd.hmg();
  },
  drawGun(aim, ty, r) {
    if (aim === 'up') { RO(3, ty - 18 + r, 5, 13, GUND); R(4, ty - 18 + r, 1, 13, GUN); RO(4, ty - 22 + r, 3, 4, GUN); RO(8, ty - 13 + r, 4, 5, '#5a6270'); }
    else if (aim === 'down') { RO(-1, ty + 9 - r, 5, 12, GUND); R(0, ty + 9 - r, 1, 12, GUN); }
    else {
      RO(2 - r, ty, 13, 5, GUND); R(3 - r, ty, 11, 1, GUN); R(4 - r, ty + 2, 8, 1, '#262b33');
      RO(15 - r, ty + 1, 7, 2, GUN); RO(21 - r, ty, 2, 4, GUND);
      RO(5 - r, ty + 5, 5, 4, '#5a6270'); R(5 - r, ty + 5, 5, 1, '#7f8a99');
    }
  },
  icon(x, y) { RO(x, y, 14, 4, GUND); R(x + 1, y, 12, 1, GUN); RO(x + 14, y + 1, 4, 2, GUN); RO(x + 3, y + 4, 4, 3, '#5a6270'); }
};
