'use strict';

{
  const gold = '#ffd467', warm = '#fff2b1', bronze = '#bd8350', shadow = '#603e43';
  const stone = '#424963', edge = '#777e92', ink = '#1a1d31';
  const visible = (x, margin) => x > G.cam.x - margin && x < G.cam.x + W + margin;

  function shine(x, y, color) {
    R(x - 2, y, 5, 1, color); R(x, y - 2, 1, 5, color);
  }

  const uniforms = [
    { coat: '#5098a5', light: '#91dcca', hair: '#694952', skin: '#edb27f', boots: '#514553' },
    { coat: '#9b668e', light: '#e899be', hair: '#493740', skin: '#c98557', boots: '#423e54' },
    { coat: '#71815a', light: '#bbcb7d', hair: '#975d45', skin: '#f0ba8f', boots: '#50454c' }
  ];

  function explorer(o, x, feet) {
    const uniform = uniforms[o.id % uniforms.length];
    const run = o.state === 'run', wave = o.state === 'salute';
    const stride = run && (o.t >> 2) % 2;
    const hop = o.state === 'free' ? Math.round(Math.sin(Math.PI * o.t / 24) * 4) : 0;
    ctx.save(); ctx.translate(x, feet - hop - (stride ? 1 : 0)); if (run) ctx.scale(-1, 1);
    // Boots, satchel, canvas jacket, scarf and a working helmet lamp.
    RO(-4 - (stride ? 2 : 0), -5, 3, 5, uniform.boots);
    RO(1 + (stride ? 2 : 0), -4, 4, 4, uniform.boots);
    R(-4, -1, 3, 1, edge); R(2 + (stride ? 2 : 0), -1, 3, 1, edge);
    RO(-7, -14, 3, 8, bronze); R(-7, -14, 2, 2, gold);
    RO(-4, -14, 8, 9, uniform.coat); R(-3, -13, 3, 4, uniform.light);
    R(-4, -7, 8, 2, uniform.boots); R(0, -7, 2, 2, bronze);
    R(-3, -15, 7, 2, gold); R(-4, -14, 2, 4, bronze);
    if (wave || o.state === 'free') {
      RO(4, -16, 3, 4, uniform.coat); R(6, -18, 2, 3, uniform.skin);
    } else {
      RO(3, -12, 3, 5, uniform.coat); R(4, -8, 3, 2, uniform.skin);
    }
    RO(-4, -22, 8, 7, uniform.skin); R(-4, -22, 2, 5, uniform.hair); R(-4, -16, 2, 3, uniform.hair);
    R(0, -20, 1, 2, ink); R(3, -20, 1, 2, ink);
    R(1, -16, wave || o.state === 'free' ? 3 : 2, 1, shadow);
    RO(-4, -26, 8, 4, uniform.coat); R(-3, -26, 5, 1, uniform.light);
    RO(-6, -23, 13, 2, uniform.light); R(-5, -21, 11, 1, uniform.coat);
    RO(1, -26, 4, 4, bronze); R(2, -25, 2, 2, warm);
    ctx.restore();
  }

  function lanternCage(x, y, back) {
    if (back) {
      RO(x - 11, y - 30, 22, 26, '#313044'); R(x - 9, y - 29, 18, 20, '#5a4643');
      R(x - 6, y - 28, 11, 16, '#796046'); R(x - 5, y - 27, 8, 13, '#917553');
      return;
    }
    RO(x - 3, y - 35, 7, 3, shadow); R(x - 2, y - 35, 4, 1, gold);
    RO(x - 7, y - 32, 14, 2, bronze);
    RO(x - 11, y - 30, 22, 2, shadow); R(x - 10, y - 30, 20, 1, gold);
    for (const side of [-1, 1]) {
      const rail = x + side * 11;
      RO(rail - 1, y - 28, 2, 23, bronze); R(rail, y - 28, 1, 22, gold);
      R(x + side * 8, y - 26, 1, 19, '#d7ae71');
      R(rail - 2, y - 23, 4, 2, shadow); R(rail - 2, y - 9, 4, 2, shadow);
    }
    RO(x - 11, y - 5, 22, 4, shadow); R(x - 10, y - 5, 20, 1, gold);
    RO(x - 2, y - 7, 4, 5, bronze); R(x - 1, y - 6, 2, 1, warm); R(x, y - 4, 1, 1, ink);
  }

  POW_KINDS.lanternKeeper = {
    thanks: 'LIGHT THE WAY!',
    box: o => ({ x: o.x - 12, y: o.y - 33, w: 24, h: 32 }),
    onFree(o) {
      // The rescue commits both the star credit and its reward before a life or checkpoint can interrupt it.
      if (o.item) {
        o.rescueGift = o.item;
        o.item = null;
        ITEMS[o.rescueGift].collect({ x: o.x, y: o.y - 33 }, G.p);
      }
      sparks(o.x, o.y - 19, 8, gold);
      say('Light the way!', 1.2, 1.04);
    },
    draw(o) {
      if (!visible(o.x, 22)) return;
      const x = Math.round(o.x), y = Math.round(o.y);
      if (o.state === 'tied') {
        lanternCage(x, y, true); explorer(o, x, y - 4); lanternCage(x, y, false);
        if ((o.t + o.id * 13) % 80 < 6) shine(x - 9, y - 29, warm);
      } else {
        if (o.state === 'free' && o.t < 18) {
          ctx.save(); ctx.globalAlpha = 1 - o.t / 18;
          lanternCage(x, y - Math.round(o.t * 0.9), false); ctx.restore();
        }
        explorer(o, x, y);
        if (o.rescueGift && o.t < 44) {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, (44 - o.t) / 12);
          ITEMS[o.rescueGift].draw({ x: x - 22, y: Math.round(y - 25 - o.t * 0.4), t: o.t });
          ctx.restore();
        }
      }
    }
  };

  const arsenal = {
    U: { name: 'sunflare', slot: '2', color: gold, dim: bronze },
    E: { name: 'echogun', slot: '3', color: '#84f5dc', dim: '#488983' }
  };
  // The engine creates a new freed set for each fresh run and keeps it on continue.
  let giftRun = null, claimed = new Set();
  PROP_TYPES.caveArsenal = {
    make(o) {
      if (G.freed !== giftRun) { giftRun = G.freed; claimed = new Set(); }
      o.gift = o.x + ':' + o.item;
      o.taken = claimed.has(o.gift);
    },
    box: () => null, hit() {},
    update(o) {
      if (o.taken || G.intro || G.winT || G.p.dead || Math.abs(G.p.x - o.x) > 20) return;
      ITEMS[o.item].collect({ x: o.x, y: o.y - 4 }, G.p);
      Snd.pickup();
      sparks(o.x, o.y - 25, 6, arsenal[o.item].color);
      o.taken = true;
      claimed.add(o.gift);
    },
    draw(o) {
      if (!visible(o.x, 36)) return;
      const { name, slot, color, dim } = arsenal[o.item], w = WEAPONS[name];
      const x = Math.round(o.x), y = Math.round(o.y), light = o.taken ? edge : color;
      // A sloping stone reliquary, its glowing slot key and a suspended weapon.
      RO(x - 16, y - 4, 32, 4, stone); R(x - 15, y - 4, 30, 1, edge);
      RO(x - 11, y - 16, 22, 12, stone); R(x - 10, y - 15, 3, 10, '#555e77');
      RO(x - 14, y - 17, 28, 3, edge); R(x - 13, y - 17, 26, 1, light);
      RO(x - 4, y - 14, 9, 9, o.taken ? ink : dim); text(slot, x, y - 13, o.taken ? edge : warm, 1, 'center', null);
      if (o.taken) return;
      const bob = Math.round(Math.sin((G.t + o.x) / 13) * 2);
      const top = y - 32 + bob;
      R(x - 9, top - 1, 18, 1, '#42465f');
      w.icon(x - 8, top);
      R(x - 6, y - 19, 12, 1, dim);
      if ((G.t + o.x) % 40 < 7) shine(x + 11, top - 2, light);
      text(w.label, x, y - 44, light, 1, 'center');
    }
  };

  const bellRadius = 225, bellCooldown = 300, pulseDuration = 27;
  const regularFoes = new Set(['caveBat', 'caveVampire', 'caveRobotBat', 'caveRobotVampire']);
  PROP_TYPES.sunbell = {
    make(o) {
      o.cooldown = 0; o.pulse = 0;
      o.arena = LV.locks.some(lock => lock.boss && o.x >= lock.at && o.x <= lock.at + W);
      const ledge = LV.plats.find(p => p.x <= o.x && o.x <= p.x + p.w && p.y > o.y);
      o.ledgeY = ledge && ledge.y;
    },
    // The visible alignment marks cover the bow and both guns, including the hand offset when facing left.
    box: o => o.cooldown ? null : ({ x: o.x - 17, y: o.y - 20, w: 35, h: 22 }),
    hit(o, dmg, src) {
      if (o.cooldown || (src !== 'bullet' && src !== 'player')) return;
      const cy = o.y - 8;
      o.cooldown = bellCooldown; o.pulse = pulseDuration;
      G.eb = G.eb.filter(b => Math.hypot(b.x - o.x, b.y - cy) > bellRadius);
      for (const e of G.enemies) {
        if (e.active && !e.dead && !offStage(e) && regularFoes.has(e.type) && distToBox(o.x, cy, ebox(e)) <= bellRadius) e.sunStun = 90;
      }
      sparks(o.x, cy, 9, gold);
      Snd.tone('sine', 784, 770, 0.55, 0.16);
      Snd.tone('triangle', 1175, 1140, 0.40, 0.07);
      Snd.tone('sine', 1568, 1510, 0.30, 0.04);
    },
    update(o) {
      if (o.cooldown > 0) o.cooldown--;
      if (o.pulse > 0) o.pulse--;
    },
    draw(o) {
      if (!visible(o.x, o.pulse ? bellRadius + 5 : 41)) return;
      const x = Math.round(o.x), y = Math.round(o.y), floor = Math.round(groundAt(x));
      if (o.pulse > 0) {
        const f = 1 - o.pulse / pulseDuration, r = 9 + (bellRadius - 9) * f;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,219,121,' + (0.7 * (1 - f)) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 8, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,247,204,' + (0.4 * (1 - f)) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y - 8, Math.max(2, r - 6), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // An offset bracket keeps the bell's body unobstructed and provides a sight line from the floor.
      RO(x - 20, y - 28, 3, Math.max(3, floor - y + 28), stone);
      R(x - 20, y - 26, 1, Math.max(2, floor - y + 24), edge);
      RO(x - 20, y - 28, 23, 3, stone); R(x - 19, y - 28, 22, 1, edge);
      R(x - 17, y - 23, 6, 1, edge); R(x - 16, y - 22, 3, 2, stone);
      R(x, y - 25, 2, 6, bronze);
      const ready = !o.cooldown, face = ready ? gold : '#786861', rim = ready ? warm : '#9b8b76';
      const sway = o.pulse > 0 ? Math.round(Math.sin(o.pulse * 0.7) * o.pulse / 9) : 0;
      const cx = x + sway;
      RO(cx - 3, y - 21, 6, 3, bronze); R(cx - 2, y - 21, 4, 1, rim);
      RO(cx - 5, y - 18, 10, 3, face); RO(cx - 7, y - 15, 14, 8, face);
      RO(cx - 9, y - 8, 18, 4, face); RO(cx - 11, y - 4, 22, 3, rim);
      R(cx - 5, y - 16, 2, 8, rim); R(cx + 4, y - 14, 2, 9, ready ? bronze : shadow);
      R(cx - 7, y - 5, 14, 1, ready ? bronze : shadow);
      RO(cx - 2, y - 1, 4, 2, ready ? gold : edge); R(cx - 2, y - 10, 4, 3, ready ? warm : stone);
      if (!ready) {
        R(cx - 8, y + 5, 16, 2, ink);
        R(cx - 8, y + 5, Math.round(16 * (1 - o.cooldown / bellCooldown)), 1, bronze);
      } else {
        if ((G.t + x) % 47 < 7) shine(cx + 6, y - 15, warm);
        if (G.p && !G.p.dead && !G.winT && Math.abs(G.p.x - x) < 130) {
          const aligned = Math.abs(G.p.x - x) <= 12;
          const aimColor = aligned ? warm : gold;
          for (const surface of o.ledgeY ? [floor, o.ledgeY] : [floor]) {
            R(x - 12,surface - 3,4,1,aimColor); R(x + 8,surface - 3,4,1,aimColor);
            R(x - 12,surface - 4,1,2,aimColor); R(x + 11,surface - 4,1,2,aimColor);
            R(x - 1,surface - 5,3,1,aimColor); R(x,surface - 6,1,3,aimColor);
          }
          if (o.arena && !G.eb.some(b => b.life > 0 && Math.hypot(b.x - x, b.y - (y - 8)) <= bellRadius)) {
            if (aligned) text('WAIT FOR SHOTS', x, y - 37, '#d8b789', 1, 'center');
            return;
          }
          text(o.arena ? 'CLEAR SHOTS' : 'STUN FOES', x, y - 47, '#d8b789', 1, 'center');
          text(aligned ? 'UP + X' : 'STAND BELOW', x, y - 37, aimColor, 1, 'center');
        }
      }
    }
  };
}
