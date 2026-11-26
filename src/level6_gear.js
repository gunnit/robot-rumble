'use strict';
// Moonbow, Sunflare and Echo Gun use the regular fire/aim controls.
const CaveGear6 = (() => {
  const silver = '#cceaff', pearl = '#f4fdff', moon = '#8ea6ff';
  const gold = '#ffd568', amber = '#f28b44', mint = '#84f5dc', teal = '#36bcb4';

  const sunBody = makeSprite([
    '.......kkk..............',
    '..kk..kgggk.......kkk...',
    '.kaakkkgpggkkkk..kaagk..',
    'kagggmgpppgmgggkkgpppgk.',
    'kaggamgpgggmggmmmgpppgk.',
    '.kaammgaggamammaagggggk.',
    '..kkkmmgggmmammmakaaak..',
    '....kdddkkkkkkkk..kkk...',
    '....kddk................',
    '.....kk.................'
  ], { k: OUT, a: '#d28648', g: gold, p: '#fff2ba', m: '#76788b', d: '#684e59' });

  const echoBody = makeSprite([
    '.................kkk....',
    '...kk..........kkttk....',
    '..kppkkkkkkk.kkmtppk....',
    '.ktttkspspskkmmttppk....',
    'kttppkspspskmmdttptk....',
    '.ktttktststkkmmttptk....',
    '..kkmmkmkmkk.kkmtttk....',
    '....kmdk.......kkttk....',
    '....kddk.........kkk....',
    '.....kk.................'
  ], { k: OUT, m: '#606c89', d: '#39445e', t: teal, p: mint, s: '#bcb4ff' });

  // A stepped pixel line keeps the string and resonating wavefronts sharp at native size.
  function line(x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      R(x0, y0, 1, 1, color);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  }

  // Local +x follows the player's aim. The outer hero transform already mirrors left-facing art.
  function inHand(aim, torsoY, recoil, paint) {
    const up = aim === 'up', down = aim === 'down';
    ctx.save();
    ctx.translate(up ? 5 : down ? 1 : 7 - recoil, torsoY + (up ? -4 + recoil : down ? 9 - recoil : 2));
    if (up || down) ctx.rotate(up ? -Math.PI / 2 : Math.PI / 2);
    paint(recoil);
    ctx.restore();
  }

  function onProjectile(b, paint) {
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.rotate(Math.atan2(b.vy, b.vx));
    paint(b);
    ctx.restore();
  }

  function arrow(x, y, length) {
    R(x - length, y, length, 1, silver);
    R(x - length + 1, y - 1, 3, 1, moon);
    R(x - length, y - 2, 2, 1, pearl);
    R(x - length + 1, y + 1, 3, 1, moon);
    R(x - 3, y - 2, 1, 5, '#829abf');
    R(x - 2, y - 1, 3, 3, silver);
    R(x + 1, y, 1, 1, pearl);
    R(x - 2, y - 1, 2, 1, pearl);
  }

  function bow(released) {
    // The two curled tips meet the string. It snaps forward when the arrow leaves.
    const nock = released ? 0 : -5;
    line(-2, -10, nock, 0, '#abc3dc');
    line(nock, 0, -2, 11, '#91a2c1');
    for (const side of [-1, 1]) {
      for (let j = 1; j <= 10; j++) {
        const bx = j < 4 ? 5 : j < 6 ? 4 : j < 8 ? 2 : j < 10 ? 0 : -2;
        R(bx - 1, side * j, 4, 1, OUT);
        R(bx, side * j, 2, 1, j < 6 ? '#cf884f' : '#9a6c58');
        R(bx + 1, side * j, 1, 1, j > 8 ? pearl : gold);
      }
      R(-3, side * 11, 3, 1, silver);
    }
    if (!released) arrow(11, 0, 17);
    RO(4, -2, 3, 5, '#82625f');
    R(5, -2, 2, 1, moon); R(5, 1, 2, 1, moon);
    R(0, 1, 5, 2, SKIN); R(2, 3, 3, 1, SKIND);
  }

  function sunGun(recoil) {
    spr(sunBody, -4, -4);
    if (recoil) R(4, -1, 3, 2, '#fffdf1');
    R(-1, 1, 3, 2, SKIN);
  }

  function echoGun(recoil) {
    spr(echoBody, -4, -4);
    R(13, -1, 2, 3, recoil ? pearl : mint);
    R(-1, 1, 3, 2, SKIN);
  }

  function moonIcon(x, y) {
    line(x + 5, y, x + 1, y + 4, moon);
    line(x + 1, y + 4, x + 5, y + 8, silver);
    line(x + 5, y, x + 10, y + 3, gold);
    line(x + 10, y + 5, x + 5, y + 8, amber);
    R(x + 10, y + 3, 2, 3, gold);
    R(x, y + 4, 15, 1, silver); R(x + 12, y + 3, 2, 3, pearl);
  }

  function sunIcon(x, y) {
    RO(x, y + 1, 9, 4, '#bd8350'); R(x + 1, y + 1, 7, 1, gold);
    RO(x + 1, y + 5, 2, 3, '#625268'); R(x + 3, y + 2, 4, 2, pearl);
    R(x + 9, y + 2, 5, 2, '#9ca8bc'); RO(x + 13, y + 1, 3, 4, gold);
  }

  function echoIcon(x, y) {
    RO(x, y + 1, 7, 4, '#777d9d'); RO(x + 2, y + 5, 2, 3, '#505975');
    R(x + 2, y + 2, 5, 1, mint); R(x + 7, y + 2, 4, 3, teal);
    R(x + 10, y + 1, 3, 5, teal); RO(x + 13, y, 3, 7, mint);
  }

  function muzzle(aim, reach) {
    if (aim === 'up') return [5, -25 - reach];
    if (aim === 'down') return [1, -12 + reach];
    return [7 + reach, -19];
  }

  function arrowHit(b, e) {
    damageEnemy(e, b.dmg);
    sparks(b.x, b.y, 3, pearl);
    // After the second target the arrow stops. The engine remembers each pierced target.
    if (b.hits && b.hits.length) b.pierce = false;
  }

  WEAPONS.moonbow = {
    label: 'MOONBOW', ammo: Infinity, maxAmmo: Infinity, cd: 17, tapCd: 3,
    muzzle: aim => muzzle(aim, 12),
    drawGun: (aim, ty, r) => inHand(aim, ty, r, bow), icon: moonIcon,
    flash() {}, // The string release is the bow's firing animation.
    fire(p, x, y, dx, dy) {
      G.pb.push({
        x, y, vx: dx * 7.3, vy: dy ? dy * 7.3 : -0.38, dmg: 3, life: 80, pierce: true,
        update: dx ? b => { b.vy += 0.025; } : undefined,
        draw: b => onProjectile(b, () => arrow(0, 0, 16)), onHit: arrowHit,
        onGround(b) { sparks(b.x, groundAt(b.x) - 1, 3, silver); }
      });
      Snd.tone('triangle', 530, 142, 0.13, 0.09);
      Snd.tone('sine', 1060, 284, 0.06, 0.035);
    }
  };

  function flareBurst(b, direct) {
    const radius = 21;
    for (const e of G.enemies) {
      if (e !== direct && e.active && !e.dead && !offStage(e) && distToBox(b.x, b.y, ebox(e)) < radius) damageEnemy(e, 1);
    }
    G.rings.push({ x: b.x, y: b.y, t: 0, max: 9, r: radius });
    sparks(b.x, b.y, 5, gold);
  }

  function drawFlare(b) {
    onProjectile(b, () => {
      R(-9, 0, 6, 1, amber); R(-6, -1, 7, 3, amber);
      R(-2, -2, 4, 5, gold); R(-1, -1, 3, 3, '#fff8d6'); R(2, 0, 2, 1, gold);
    });
  }

  WEAPONS.sunflare = {
    label: 'SUNFLARE', ammo: 60, maxAmmo: 120, cd: 9, tapCd: 2,
    muzzle: aim => muzzle(aim, 18),
    drawGun: (aim, ty, r) => inHand(aim, ty, r, sunGun), icon: sunIcon,
    flash(x, y) { R(x - 3, y, 7, 1, gold); R(x, y - 3, 1, 7, gold); R(x - 1, y - 1, 3, 3, pearl); },
    fire(p, x, y, dx, dy) {
      G.pb.push({
        x, y, vx: dx * 6.4, vy: dy * 6.4, dmg: 2, life: 82, draw: drawFlare,
        onHit(b, e) { damageEnemy(e, b.dmg); flareBurst(b, e); },
        onGround(b) { flareBurst(b, null); },
        onProp(b, o) { hitProp(o, b.dmg, 'bullet'); flareBurst(b, null); }
      });
      Snd.tone('triangle', 920, 260, 0.09, 0.10);
      Snd.tone('square', 445, 105, 0.05, 0.033);
    }
  };

  function wavefront(x, y, h, color) {
    line(x - 3, y - h, x, y - 2, color);
    R(x, y - 1, 1, 3, color);
    line(x, y + 2, x - 3, y + h, color);
  }

  function drawNote(b) {
    onProjectile(b, () => {
      wavefront(-5, 0, 3, '#5387a4'); wavefront(-2, 0, 5, teal);
      wavefront(0, 0, 5, mint); R(-1, -1, 2, 3, pearl);
    });
  }

  WEAPONS.echogun = {
    label: 'ECHO GUN', ammo: 32, maxAmmo: 64, cd: 16, tapCd: 3,
    muzzle: aim => muzzle(aim, 16),
    drawGun: (aim, ty, r) => inHand(aim, ty, r, echoGun), icon: echoIcon,
    flash(x, y, aim) {
      ctx.save(); ctx.translate(x, y);
      if (aim !== 'fwd') ctx.rotate(aim === 'up' ? -Math.PI / 2 : Math.PI / 2);
      wavefront(1, 0, 6, mint); ctx.restore();
    },
    fire(p, x, y, dx, dy) {
      for (const spread of [-0.25, 0, 0.25]) {
        const c = Math.cos(spread), s = Math.sin(spread);
        G.pb.push({
          x, y, vx: (dx * c - dy * s) * 5.4, vy: (dy * c + dx * s) * 5.4,
          dmg: 2, life: 54, draw: drawNote,
          onHit(b, e) { damageEnemy(e, b.dmg); sparks(b.x, b.y, 3, mint); }
        });
      }
      Snd.tone('sine', 340, 150, 0.14, 0.13);
      Snd.tone('triangle', 680, 300, 0.09, 0.06);
      Snd.tone('sine', 510, 225, 0.12, 0.055, 0.055);
    }
  };


  const slots = ['moonbow', 'sunflare', 'echogun'];
  let run = null, carrier = null, selected = 'moonbow';
  let fallbackBow = false;
  let rounds = { moonbow: Infinity };

  function equip(p, name) {
    selected = name;
    p.weapon = name;
    p.ammo = rounds[name];
    p.muzzle = 0;
  }

  function saveRounds(p) {
    if (p.weapon === selected) rounds[selected] = p.ammo;
    else if (p.weapon === 'pistol' && selected !== 'moonbow') {
      // shoot() switches to the ordinary pistol on the last round. Use our bow as the cave sidearm.
      rounds[selected] = 0;
      equip(p, 'moonbow');
      fallbackBow = true;
    }
  }

  function restorePlayer(p) {
    if (p === carrier) return;
    if (carrier) saveRounds(carrier);
    carrier = p;
    equip(p, selected);
  }

  function load(cp) {
    // beginMission creates a new freed set. Continues reuse it, including at the entrance (cp = 0).
    if (G.freed !== run) {
      run = G.freed;
      carrier = null;
      selected = 'moonbow';
      fallbackBow = false;
      rounds = { moonbow: Infinity };
    }
    restorePlayer(G.p);
    if (!G.continues || cp !== LV.locks[LV.locks.length - 1].at) return false;
    let restored = false;
    for (const [name, minimum] of [['sunflare', 20], ['echogun', 8]]) {
      if (name in rounds && rounds[name] < minimum) {
        rounds[name] = minimum;
        if (selected === name) G.p.ammo = minimum;
        restored = true;
      }
    }
    return restored;
  }

  function beforePlayerUpdate() {
    const p = G.p;
    restorePlayer(p);
    if (p.dead || G.intro || G.winT > 0) return;
    for (let i = 0; i < slots.length; i++) {
      if (!pressed['Digit' + (i + 1)] && !pressed['Numpad' + (i + 1)]) continue;
      const name = slots[i];
      if (rounds[name] > 0) {
        // Pressing 1 while already holding the fallback bow makes it a deliberate choice.
        fallbackBow = false;
        if (name !== p.weapon) { equip(p, name); Snd.select(); }
      } else {
        const label = WEAPONS[name].label;
        G.texts.push({ x: p.x, y: p.y - 34, s: name in rounds ? label + ' EMPTY' : 'FIND ' + label, t: 40, c: silver });
      }
    }
  }

  function update() {
    restorePlayer(G.p);
    saveRounds(G.p);
  }

  function collectWeapon(p, name) {
    if (LV !== LEVELS[5] || G.freed !== run) { giveWeapon(p, name); return 'found'; }
    restorePlayer(p);
    saveRounds(p);
    const w = WEAPONS[name];
    const discovered = name in rounds, previous = rounds[name] || 0;
    rounds[name] = Math.min(w.maxAmmo, previous + w.ammo);
    if (!discovered || (fallbackBow && name !== 'moonbow')) {
      equip(p, name);
      fallbackBow = false;
    }
    else if (p.weapon === name) p.ammo = rounds[name];
    if (!discovered) return 'found';
    return rounds[name] === previous ? 'full' : 'refill';
  }

  function weaponPickup(name, color, voice) {
    const w = WEAPONS[name];
    return {
      draw(it) {
        const x = Math.round(it.x), y = Math.round(it.y) - (Math.floor(it.t / 14) % 2);
        RO(x - 10, y - 14, 20, 13, '#253046');
        R(x - 9, y - 13, 18, 1, color); R(x - 9, y - 2, 18, 1, '#596782');
        w.icon(x - 8, y - 11);
        if (it.t % 54 < 7) { R(x + 10, y - 17, 1, 5, pearl); R(x + 8, y - 15, 5, 1, pearl); }
      },
      collect(it, p) {
        const result = collectWeapon(p, name);
        const label = result === 'found' ? w.label : w.label + (result === 'full' ? ' FULL' : ' AMMO');
        G.texts.push({ x: it.x, y: it.y - 27, s: label, t: 68, c: color });
        if (result === 'found') say(voice, 1, 1);
      }
    };
  }

  ITEMS.A = weaponPickup('moonbow', silver, 'Moonbow!');
  ITEMS.U = weaponPickup('sunflare', gold, 'Sunflare!');
  ITEMS.E = weaponPickup('echogun', mint, 'Echo gun!');
  return { load, beforePlayerUpdate, update, ammo: name => rounds[name] };
})();
