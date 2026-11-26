'use strict';
// Moonlit wildlife has soft purple wings and red velvet. The clockwork family uses
// brass hinges and a mint light. All attack warnings are drawn in world coordinates.
{
  const ink = '#1a1326', berry = '#aa446f', lilac = '#e89ada', mint = '#87fff0';
  const brass = '#db9954', gold = '#ffe1a2', coral = '#ff8577';
  const palette = {
    k: ink, d: '#3c2548', p: '#643458', v: '#94516f', l: '#d980a5', f: '#f7b2ce',
    b: '#29374d', h: '#435b69', s: '#6c9197', t: '#a7cdca', g: brass, y: gold,
    r: '#ac415d', o: '#f17975', w: '#fff1d5', n: '#74efe0', m: '#307d81',
    u: '#cba2c2', c: '#ebccdf', a: '#2c202e'
  };
  const sprite = rows => makeSprite(rows, palette);
  const organicWing = [
    sprite([
      '............kk', '..........kkvk', '.......kkkvlpk', '.....kkvlvppdk',
      '...kkvlvvpppdk', '..kvlvvvpppdk.', '.klvvvpppppdk.', 'klvppvppppdk..',
      'kvpdvpddpdk...', 'kpdkpdkkpk....', 'kdk.kd..k.....', 'kk..k.........'
    ]),
    sprite([
      '.....kkkk.......', '..kkklvlvkk.....', 'kkllvvvvpppkk...', 'kppvvvppvppppkk.',
      '.kpvvppdvvppppvk', '.kpppkdkpvpppppk', '..kpkk..kpddvpdk', '..kk....kdk.kddk',
      '........kk...kk.'
    ]),
    sprite([
      '..kk......', '.klvk.....', '.klvvkk...', 'klvvppvkk.', 'kvvpppppvk',
      'kpppdpdppk', 'kpdkkpkpdk', 'kdk.kd.kk.', 'kk..k.....'
    ])
  ];
  const machineWing = [
    sprite([
      '................kk', '.............kkktyk', '.........kkkkgsshk', '.....kkkkygsshbbk',
      '..kkktssshhbbkk..', 'kkntshhhbbkk.....', 'kmmhbbyygk.......',
      '.kkk.kgssk.......', '.....kshk........', '.....kbbk........', '......kk.........'
    ]),
    sprite([
      'kk...............', 'kntkkkk..........', 'kmtsssykkkk......', '.kkhhssggyykkk...',
      '...kkbbhgsssygkk.', '.....kkkkhhbbhyk', '........kgk.kgbk', '.......kssk..kk.',
      '......kbbk......', '......kk........'
    ])
  ];
  const batHead = sprite([
    '.kk....kk.', '.klk..klk.', '.kllkkllk.', '..kvvvlk..', '.kvvllvvk.',
    'kvwovvowvk', 'kpvvddvvpk', '.kpwwwwpk.', '..kdwvdw..', '...kddk...'
  ]);
  const batEngine = sprite([
    '....kgk.....kgk...', '..kkgykkkkkkgykk..', '.kgsssssttttsssgk.',
    'kgshhhhhysyhshhsgk', 'kbhknnkkkkknnkhbbk', 'kbhkwnnkkknnwkhbbk',
    '.kbhkkkyggkkkhbbk.', '.kghhhhssshhhhygk.', '..kbbtwkkkwtbbbk..',
    '...kkkw...wkkkk...', '.....kk...kk......'
  ]);
  const vampireFace = sprite([
    '....kkkkkk.....', '..kkvvvpppkk...', '.kvvvppdddddk..', '.kvvppdddddddk.',
    'kkpppuudduuck..', 'kdpucuccucccck.', '.kpucwwucwwccck', '..kucowucowuuck',
    '.klucuucuucuck.', '..kduccccccck..', '...kucuddduck..', '....kuwwcwuk...',
    '.....kuucuk....', '......kkk......'
  ]);
  const clockMask = sprite([
    '.kk.........kk..', '.kgyk.....kygk..', '..kggkkkkkggk...', '..kbstttttsbk...',
    '.kbstsssstttbk..', 'kgshhhggghhhsgk.', 'kghkkkkkkkkkhgk.', 'kssknnmkmnnkssk.',
    '.khkwnnknnwkhk..', '..kshhhghhhsk...', '..kgssygysggk...', '...ktyssytbk....',
    '....kwkkkwk.....', '....kk...kk.....'
  ]);
  const velvetCoat = sprite([
    'kk............kk', 'klkk........kklk', 'klvvkk....kkvvlk', '.kvvvvkkkkvvpvk.',
    '..kvvpccccpvpk..', '...kvpcbbycpk...', '..kdvpcggcpvvk..', '..kdvpdwcdpvvk..',
    '..kdvpdbbdpvvk..', '..kddppbbppvvk..', '..kdddpbbpvvvk..', '.kdddpdggbpvvlk.',
    '.kddddpbbpvvvlk.', 'kddppppbbppvvvlk', 'kdpvvvvbbpppvvlk', 'kppvvvpk.kvpvvlk',
    'kpvvvpk...kpvvlk', 'klvvpk.....kpvlk', 'klvpk.......kvlk', 'kkk..........kkk'
  ]);
  const steelCoat = sprite([
    'kk................kk', 'kgyk............kygk', '.kgsyk........kysgk.', '.kggstkkkkkkktsggk..',
    '..kbbstgggggtsbbk...', '..kbgssstttsssbgk...', '.kbgsshbggbhsssgk...', '.kbhhbgyyyygbhhbk...',
    '.kbbhgyknnkyghbbk...', '.kbbhgyknnkyghbbk...', '.kbbhbgyyyygbhbbk...', '.kgbhhbbggbbhhbgk...',
    '.kgbhhhsssshhbbgk...', '.kgshhbbbbbbbhsgk...', '.kgshhgyggygbhsgk...', 'kgghhbgybbggbhhsgk..',
    'kgbhhbbbbbbbbbhsgk..', 'kgbhbkbb..bbkbhhgk..', 'kgbbk........kbhgk..', 'kgsk..........ksgk..',
    'kkk............kkk..'
  ]);
  function mirroredWings(wing, innerX, tipY) {
    spr(wing, -innerX - wing.w, tipY);
    ctx.save(); ctx.scale(-1, 1); spr(wing, -innerX - wing.w, tipY); ctx.restore();
  }
  function atFeet(e, paint) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
    FLASH = e.hitT > 0;
    try { paint(); } finally { FLASH = false; ctx.restore(); }
  }
  function stepTowards(n, target, amount) {
    return n + clamp(target - n, -amount, amount);
  }
  function faceHero(e) { if (Math.abs(G.p.x - e.x) > 3) e.facing = G.p.x < e.x ? -1 : 1; }
  function awake(e) {
    return !G.intro && !G.p.dead && !G.winT && e.x > G.cam.x + 12 && e.x < G.cam.x + W - 12;
  }
  function sunStunned(e, nextState) {
    if (!(e.sunStun > 0)) return false;
    e.sunStun--;
    e.state = nextState;
    e.timer = 48;
    return true;
  }
  function stunStars(e) {
    if (!(e.sunStun > 0)) return;
    const top = ENEMY_TYPES[e.type].box(e).y - 7;
    for (let i = 0; i < 3; i++) {
      const a = e.t / 11 + i * Math.PI * 2 / 3;
      const x = Math.round(e.x + Math.cos(a) * 12), y = Math.round(top + Math.sin(a) * 3);
      R(x - 2, y, 5, 1, gold); R(x, y - 2, 1, 5, gold); R(x, y, 1, 1, '#fffdf0');
    }
  }
  function aim(e) {
    faceHero(e); e.targetX = G.p.x; e.targetY = G.p.y - (G.p.crouch ? 8 : 16);
  }
  function dots(x, y, tx, ty, col) {
    const d = Math.hypot(tx - x, ty - y);
    for (let i = 7; i < d - 3; i += 10) R(Math.round(x + (tx - x) * i / d), Math.round(y + (ty - y) * i / d), 2, 1, col);
  }
  function sight(x, y, col) {
    x = Math.round(x); y = Math.round(y);
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      R(x + dx * 6 - (dx > 0 ? 2 : 0), y + dy * 5, 3, 1, col);
      R(x + dx * 6, y + dy * 5 - (dy > 0 ? 2 : 0), 1, 3, col);
    }
    R(x, y, 1, 1, col);
  }
  function signal(e, y, col) {
    if (Math.floor(e.timer / 6) % 2 === 0) { RO(-1, y, 2, 5, col); R(-1, y + 7, 2, 2, col); }
  }
  function bolt(x, y, tx, ty, offset, speed) {
    const a = Math.atan2(ty - y, tx - x) + offset;
    G.eb.push({ k: 'clockfangSpark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 230, r: 3 });
  }
  EB_TYPES.clockfangSpark = {
    r: 3, shootable: true,
    draw(b) {
      const x = Math.round(b.x), y = Math.round(b.y);
      R(x - Math.round(b.vx * 3) - 2, y - Math.round(b.vy * 3), 5, 2, '#38818b');
      RO(x - 2, y - 2, 5, 5, '#3cb8b0'); R(x - 3, y, 7, 1, mint); R(x, y - 3, 1, 7, mint); R(x - 1, y - 1, 3, 3, '#fff9d9');
    },
    onHit(b) { sparks(b.x, b.y, 4, mint); }
  };
  const vampireGearSpeed = 1.65, countGearSpeed = 1.9, gearLifetime = 240;

  function gearJumpCue(x, vx, releaseIn = 0, life = gearLifetime) {
    const p = G.p;
    if (!p || p.dead || !p.onGround || p.y < groundAt(p.x) - 16 || G.winT) return;
    if (releaseIn > 24) return;
    const direction = Math.sign(vx), speed = Math.abs(vx);
    const nextLock = G.locks.find(lock => !lock.done);
    const left = G.cam.x + 8, right = Math.min(LV.end - W, nextLock ? nextLock.at : Infinity) + W - 8;
    // Follow the hero's signed motion up to the actual camera boundary.
    // After release, a gap from +14 to -14 is the wheel crossing the hero.
    const gapAt = frames => {
      const heroX = clamp(p.x + p.vx * frames, left, right);
      return (heroX - x) * direction - speed * Math.max(0, frames - releaseIn);
    };
    const launchGap = gapAt(releaseIn);
    if (launchGap < -14 || (launchGap > 14 && gapAt(releaseIn + life) > 14)) return;
    let label = 'HOLD JUMP';
    if (gapAt(16) > 14 || gapAt(35) > -14) {
      // When a gear slowly overtakes a fleeing hero, staying alongside it
      // would outlast a full jump. If the wall will stop the hero first,
      // wait and use the ordinary jump cue at the wall.
      const retreat = direction * p.vx;
      if (retreat <= 0 || (retreat >= speed && launchGap > 14)) return;
      const timeToEdge = (direction > 0 ? right - p.x : p.x - left) / retreat;
      const passIfStopped = releaseIn + Math.max(0, (p.x - x) * direction) / speed;
      if ((launchGap > 14 && gapAt(Math.min(timeToEdge, releaseIn + life)) > 14) || passIfStopped > 20) return;
      label = 'STOP + HOLD JUMP';
    }
    const halfWidth = label.length * 3 + 3;
    const labelX = Math.round(clamp(p.x, G.cam.x + halfWidth + 2, G.cam.x + W - halfWidth - 2));
    const labelY = Math.round(p.y - 48);
    RO(labelX - halfWidth, labelY - 2, halfWidth * 2, 12, '#39283a');
    text(label, labelX, labelY, gold, 1, 'center', null);
  }

  function wheel(x, direction, speed) {
    G.eb.push({ k: 'clockfangGear', x, y: groundAt(x) - 9, vx: direction * speed, vy: 0, life: gearLifetime, r: 8 });
  }
  EB_TYPES.clockfangGear = {
    r: 8, shootable: true,
    update(b) { b.y = groundAt(b.x + b.vx) - 9; },
    draw(b) {
      const x = Math.round(b.x), y = Math.round(b.y), a = b.x / 8;
      for (let i = 0; i < 8; i++) {
        const t = a + i * Math.PI / 4;
        RO(x + Math.round(Math.cos(t) * 6) - 1, y + Math.round(Math.sin(t) * 6) - 1, 3, 3, gold);
      }
      blob([ [x - 5, y - 3, 11, 7], [x - 3, y - 5, 7, 11] ], brass);
      RO(x - 2, y - 2, 5, 5, '#566776'); R(x - 1, y - 1, 3, 3, mint);
      gearJumpCue(b.x, b.vx, 0, b.life);
    },
    onHit(b) { sparks(b.x, b.y, 5, gold); }
  };
  function defeated(e, x, y, box) {
    const metal = ENEMY_TYPES[e.type].armored;
    sparks(x, y, metal ? 9 : 8, metal ? mint : lilac);
    if (metal) { debris(x, y, 5, brass); Snd.clank(); }
    else { Snd.tone('sine', 580, 900, 0.16, 0.08); }
    addScore({caveBat:90, caveVampire:150, caveRobotBat:160, caveRobotVampire:220}[e.type], x, box.y);
  }
  function batSpawn(e, spec) {
    e.perchY = spec.y ?? (147 + hsh(e.x) * 27); e.y = e.perchY;
    e.side = spec.side || (e.x < G.cam.x + 30 ? -1 : 1);
    e.state = 'roam'; e.timer = 32 + Math.floor(hsh(e.x) * 32); e.seed = hsh(e.x + 17) * 6;
  }
  function batRoam(e) {
    // Bats keep their roost side, including those that enter a lock from the left.
    const perch = clamp(G.p.x + e.side * 84, G.cam.x + 32, G.cam.x + W - 32);
    e.x = stepTowards(e.x, perch + Math.sin(e.t / 26 + e.seed) * 12, 1);
    e.y = stepTowards(e.y, e.perchY + Math.sin(e.t / 13 + e.seed) * 7, 0.9);
    faceHero(e);
  }
  ENEMY_TYPES.caveBat = {
    hp: 3, flying: true, contact: e => !e.sunStun && e.state === 'dive' ? 'hurt' : 'none',
    make: batSpawn, box: e => ({x:e.x - 12, y:e.y - 15, w:24, h:16}),
    update(e) {
      if (sunStunned(e, 'roam')) return;
      if (e.state === 'roam') {
        batRoam(e);
        if (awake(e) && --e.timer <= 0) {
          aim(e); e.state = 'warn'; e.timer = 38; e.startX = e.x; e.startY = e.y;
          e.targetX = clamp(e.targetX, G.cam.x + 20, G.cam.x + W - 20);
          e.targetY = clamp(e.targetY + 8, 88, groundAt(e.targetX) - 5);
        }
      } else if (e.state === 'warn') {
        if (--e.timer <= 0) { e.state = 'dive'; e.timer = 32; Snd.tone('sine', 720, 320, 0.15, 0.05); }
      } else if (e.state === 'dive') {
        const q = 1 - --e.timer / 32;
        e.x = e.startX + (e.targetX - e.startX) * q;
        e.y = e.startY + (e.targetY - e.startY) * q;
        if (!e.timer) { e.state = 'rest'; e.timer = 44; }
      } else if (--e.timer <= 0) { e.state = 'roam'; e.timer = 75; }
    },
    draw(e) {
      stunStars(e);
      if (e.state === 'warn') { dots(e.x, e.y - 7, e.targetX, e.targetY - 7, lilac); sight(e.targetX, e.targetY - 7, lilac); }
      atFeet(e, () => {
        const frame = e.state === 'dive' ? 2 : [0, 1, 2, 1][Math.floor(e.t / 5) % 4];
        mirroredWings(organicWing[frame], 2, [-20, -12, -9][frame]);
        blob([[-4, -11, 8, 8], [-2, -13, 5, 12]], '#744563');
        R(-1, -5, 3, 3, '#d08a98'); spr(batHead, -4, -15);
        R(-3, -2, 2, 2, berry); R(2, -2, 2, 2, berry);
      });
    }, onKill: defeated
  };
  ENEMY_TYPES.caveRobotBat = {
    hp: 4, flying: true, armored: true, contact: 'none',
    make: batSpawn, box: e => ({x:e.x - 16, y:e.y - 19, w:32, h:19}),
    update(e) {
      if (sunStunned(e, 'roam')) return;
      if (e.state === 'roam') {
        batRoam(e);
        if (awake(e) && --e.timer <= 0) { aim(e); e.state = 'warn'; e.timer = 50; }
      } else if (--e.timer <= 0) {
        const x = e.x + e.facing * 6;
        bolt(x, e.y - 10, e.targetX, e.targetY, 0, 1.65);
        Snd.tone('triangle', 740, 260, 0.13, 0.08); e.state = 'roam'; e.timer = 105;
      }
    },
    draw(e) {
      stunStars(e);
      if (e.state === 'warn') { dots(e.x + e.facing * 6, e.y - 10, e.targetX, e.targetY, mint); sight(e.targetX, e.targetY, mint); }
      atFeet(e, () => {
        const folded = Math.floor(e.t / 10) % 2;
        mirroredWings(machineWing[folded], 4, folded ? -21 : -14);
        R(-11, -7, 2, 4 + (e.t >> 2 & 1) * 2, mint); R(9, -7, 2, 5, mint);
        spr(batEngine, -9, -16); RO(-3, -5, 6, 4, '#738d91'); R(-1, -4, 3, 2, mint);
      });
    }, onKill: defeated
  };
  function groundSpawn(e) { e.state = 'walk'; e.timer = 30 + Math.floor(hsh(e.x) * 26); e.stride = 0; }
  function perchX(pl, x) { return pl ? clamp(x, pl.x + 3, pl.x + pl.w - 3) : x; }
  function walk(e, distance, speed) {
    faceHero(e);
    const target = clamp(G.p.x - e.facing * distance, G.cam.x + 23, G.cam.x + W - 23);
    const next = stepTowards(e.x, perchX(e.perch, target), speed);
    e.stride += Math.abs(next - e.x); e.x = next; e.y = e.perch ? e.perch.y : groundAt(e.x);
  }
  function prepareVault(e) {
    const p = G.p, pl = p.onPlat;
    if (!awake(e) || !p.onGround || p.ride || Math.abs(p.x - e.x) > 180 || pl === (e.perch || null)) return false;
    if (pl && (pl.w < 15 || pl.y > groundAt(p.x) - 15)) return false;
    if (!e.perch && e.y - p.y < 22) return false;
    const side = Math.sign(e.x - p.x) || -p.facing;
    e.landing = pl;
    e.targetX = perchX(pl, clamp(p.x + side * 40, G.cam.x + 15, G.cam.x + W - 15));
    e.targetY = pl ? pl.y : groundAt(e.targetX);
    e.startX = e.x; e.startY = e.y;
    e.state = 'vaultTell'; e.timer = 27;
    Snd.tone('sine', 310, 490, .13, .035);
    return true;
  }
  function vaultHeight(e, t) {
    const endY = e.landing ? e.landing.y : e.targetY;
    return e.startY + (endY - e.startY) * t - Math.sin(t * Math.PI) * 24;
  }
  function vampire(e, mechanical) {
    const pose = Math.floor(e.stride / 5) % 4;
    const swing = e.state === 'walk' ? [0, 2, 0, -2][pose] : 0;
    atFeet(e, () => {
      RO(-6 + swing, -8, 4, 6, mechanical ? '#49626e' : '#553b55');
      RO(3 - swing, -9, 4, 7, mechanical ? '#7898a0' : '#715068');
      R(-7 + swing, -2, 7, 2, ink); R(3 - swing, -2, 7, 2, ink);
      if (mechanical) {
        spr(steelCoat, -10, -26); spr(clockMask, -7, -37);
        RO(6, -24, 6, 8, '#738892'); RO(8, -17, 7, 6, brass);
        R(8, -15, 5, 2, e.state === 'warn' ? mint : '#9b6950');
        if (e.state === 'warn') signal(e, -48, gold);
      } else {
        if (e.state === 'vaultTell' || e.state === 'vault') {
          const frame = e.state === 'vaultTell' ? 1 : Math.floor(e.t / 4) % 3;
          mirroredWings(organicWing[frame], 4, -27);
        }
        spr(velvetCoat, -9, -23); spr(vampireFace, -5, -34);
        if (e.state === 'lunge') {
          RO(4, -21, 12, 4, '#8b5173'); R(14, -21, 4, 3, '#e8c5ce'); R(16, -20, 4, 1, gold);
        } else { RO(5, -21, 4, 7, '#6c385e'); R(6, -15, 3, 3, '#edcada'); }
        if (e.state === 'warn') signal(e, -46, lilac);
      }
    });
  }
  ENEMY_TYPES.caveVampire = {
    hp: 5, melee: true, contact: e => !e.sunStun && e.state === 'lunge' ? 'hurt' : 'none',
    make: groundSpawn, box: e => ({x:e.x - 9, y:e.y - 33, w:19, h:33}),
    update(e) {
      if (e.state === 'vault' && e.sunStun > 0) {
        e.perch = e.y <= e.targetY && Math.abs(e.x - e.targetX) < 12 ? e.landing : null;
        e.y = e.perch ? e.perch.y : groundAt(e.x);
      }
      if (sunStunned(e, 'walk')) return;
      if (e.state === 'walk') {
        walk(e, 48, 0.92);
        if (prepareVault(e)) return;
        if (awake(e) && Math.abs(e.x - G.p.x) < 100 && --e.timer <= 0) {
          e.state = 'warn'; e.timer = 41; e.dest = perchX(e.perch, clamp(e.x + e.facing * 81, G.cam.x + 18, G.cam.x + W - 18));
        }
      } else if (e.state === 'vaultTell') {
        if (--e.timer <= 0) { e.state = 'vault'; e.timer = 37; sparks(e.x,e.y-12,4,lilac); }
      } else if (e.state === 'vault') {
        const t = 1 - --e.timer / 37;
        e.x = e.startX + (e.targetX - e.startX) * t; e.y = vaultHeight(e,t);
        if (e.timer === 0) { e.perch = e.landing; e.state = 'recover'; e.timer = 20; }
      } else if (e.state === 'warn') {
        if (--e.timer <= 0) { e.state = 'lunge'; e.timer = 27; Snd.noise(0.12, 0.06, 1300); }
      } else if (e.state === 'lunge') {
        e.x = stepTowards(e.x, e.dest, 3.1); e.y = e.perch ? e.perch.y : groundAt(e.x);
        if (--e.timer <= 0) { e.state = 'recover'; e.timer = 45; }
      } else if (--e.timer <= 0) { e.state = 'walk'; e.timer = 50; }
    },
    draw(e) {
      stunStars(e);
      if (e.state === 'vaultTell') {
        for (let i=1;i<8;i++) { const t=i/8; R(Math.round(e.startX+(e.targetX-e.startX)*t),Math.round(vaultHeight(e,t)-13),2,2,lilac); }
        const x=Math.round(e.targetX),y=Math.round(e.targetY);
        R(x-5,y-3,11,2,'#926887'); R(x-3,y-4,7,2,lilac);
      }
      if (e.state === 'warn') {
        dots(e.x, e.y - 4, e.dest, e.y - 4, lilac); R(Math.round(e.dest) - 2, e.y - 6, 4, 3, lilac);
      }
      vampire(e, false);
    }, onKill: defeated
  };
  ENEMY_TYPES.caveRobotVampire = {
    hp: 8, armored: true, melee: true, contact: 'none',
    make: groundSpawn, box: e => ({x:e.x - 11, y:e.y - 37, w:23, h:37}),
    update(e) {
      if (sunStunned(e, 'walk')) return;
      if (e.state === 'walk') {
        walk(e, 124, 0.62);
        if (awake(e) && --e.timer <= 0) { e.state = 'warn'; e.timer = 50; }
      } else if (e.state === 'warn') {
        if (--e.timer <= 0) {
          wheel(e.x + e.facing * 13, e.facing, vampireGearSpeed); Snd.tone('triangle', 235, 100, 0.24, 0.09);
          e.state = 'recover'; e.timer = 32;
        }
      } else if (--e.timer <= 0) { e.state = 'walk'; e.timer = 98; }
    },
    draw(e) {
      stunStars(e);
      if (e.state === 'warn') {
        dots(e.x, e.y - 6, e.x + e.facing * 90, e.y - 6, gold);
        gearJumpCue(e.x + e.facing * 13, e.facing * vampireGearSpeed, e.timer);
      }
      vampire(e, true);
    }, onKill: defeated
  };

  // The count's wings are assembled from two mirror-image bronze clock hands.
  // Empty spaces between the fingers keep their outline clear against the cave.
  const countWing = sprite([
    'kk.............................',
    'kgyk...........................',
    '.kgyyk........kk...............',
    '.kgyyykk......kgk..............',
    '..kgbsgyk....kgsyk.............',
    '..kgbhssykkkkgssyk.............',
    '...kgbbhsyyygshgk..............',
    '...kgbbrhhsyssgkk..............',
    '....kgbrrrbssgyyykk............',
    '....kgbroorrhgsstgykk..........',
    '.....kgbroorrhyssstgykk........',
    '.....kgbrroookbsyssstgykk......',
    '......kgbrrorrkgbyggsstgykk....',
    '......kgbrroorkgrrbyggsstgykk..',
    '.......kgbrrrkkgrrrrbyggsssgyk.',
    '.......kgbrkk..kgrroorrbyggsygk',
    '........kgk....kgrroooorrbbgygk',
    '........kk......kgbrooorrbggyk.',
    '................kgbrrorrbggyk..',
    '.................kgbrrbggyyk...',
    '.................kgbkkbgygk....',
    '..................kk..kgyk.....',
    '......................kgk......',
    '......................kk.......'
  ]);
  const crown = sprite([
    'kyk..........kwk..........kyk', 'kgyk.........kyk.........kygk',
    '.kgyk...kyk.kgygk.kyk...kygk.', '.kggyk..kgk.kgygk.kgk..kyggk.',
    '..kgsykkgykkgyyygkkygkkysgk..', '..kgssygssgygoyogygssgyssgk..',
    '...kgyyyygyykoooykyygyyygk...', '...kgggssgyygoyogyygssgggk...',
    '....kkygggggyyygygggggykk....'
  ]);
  function dial(x, y, radius, t, hot) {
    const light = hot ? '#ff956a' : mint;
    blob([[x-radius+2,y-radius+2,radius*2-3,radius*2-3],[x-radius,y-3,radius*2+1,7],[x-3,y-radius,7,radius*2+1]], brass);
    blob([[x-radius+3,y-radius+3,radius*2-5,radius*2-5],[x-radius+2,y-2,radius*2-3,5],[x-2,y-radius+2,5,radius*2-3]], '#344455');
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6;
      R(x+Math.round(Math.cos(a)*(radius-3)),y+Math.round(Math.sin(a)*(radius-3)),1,1,n%3 ? '#819298' : gold);
    }
    for (let i=1; i <= radius-3; i++) R(x+Math.round(Math.cos(t)*i),y+Math.round(Math.sin(t)*i),1,2,light);
    for (let i=1; i <= radius-5; i++) R(x+Math.round(Math.cos(t*0.24-2)*i),y+Math.round(Math.sin(t*0.24-2)*i),1,2,gold);
    R(x-1,y-1,3,3,'#fff4cf');
  }
  function countPicture(e) {
    atFeet(e, () => {
      const flight = e.state === 'flight' || e.state === 'intro', broken = e.state === 'dying';
      const fold = flight ? Math.floor(e.t / 6) % 3 : Math.floor(e.t / 18) % 2;
      const lift = flight ? 4 : 0;
      const sink = broken ? Math.min(12, Math.floor((120-e.timer)/6)) : 0;
      ctx.translate(0, sink);
      for (const side of [-1,1]) {
        ctx.save(); ctx.scale(side, 1);
        spr(countWing, -46 + fold*2, -64 + fold*2 + (broken ? 11 : 0));
        blob([[-19,-43,7,35],[-22,-32,6,28],[-25,-21,5,16]], '#4e2a48');
        R(-20,-40,2,29,berry); R(-22,-27,1,17,coral);
        RO(-14,-17+lift,9,13,'#596d74'); R(-14,-15+lift,7,2,'#a5c4be');
        RO(-16,-5+lift,13,4,brass); R(-16,-4+lift,5,1,gold);
        ctx.restore();
      }
      blob([[-13,-46,26,27],[-10,-21,20,7],[-14,-40,28,15]], '#505d71');
      R(-11,-39,3,15,'#9bb6b8'); R(8,-40,3,16,'#334052');
      RO(-10,-21,20,5,'#885b4f'); R(-10,-20,20,1,gold); R(-3,-22,6,6,brass);
      for (const side of [-1,1]) {
        ctx.save(); ctx.scale(side, 1);
        blob([[-21,-47,11,9],[-18,-50,8,4],[-20,-39,7,15]], '#9e6850');
        R(-18,-49,8,2,gold); R(-20,-46,9,2,brass);
        RO(-23,-31,10,9,'#6c8990'); R(-21,-30,7,2,'#afd4c8'); R(-21,-24,2,4,brass);
        ctx.restore();
      }
      const ticking = e.state === 'warn' ? e.t*0.19 : e.t*(e.enraged ? 0.07 : 0.035);
      dial(0,-34,10,ticking,e.enraged);
      ctx.save(); ctx.translate(-14,-65); ctx.scale(2,2); spr(clockMask,0,0); ctx.restore();
      spr(crown,-14,-73+(broken ? Math.min(16,Math.floor((120-e.timer)/5)) : 0));
    });
  }
  function landingMark(e) {
    const x = Math.round(e.targetX), y = Math.round(groundAt(x)) - 1;
    const col = Math.floor(e.timer/7)%2 ? gold : coral;
    R(x-28, y-1, 56, 1, col);
    for (const d of [-1,1]) {
      R(x+d*28, y-7, 2, 7, col);
      for (let i=0;i<4;i++) R(x+d*(24-i*2),y-5-i,2,1,col);
    }
    R(x-2,y-6,5,1,col); R(x,y-8,1,5,col);
  }
  function bossTells(e) {
    if (e.state === 'flight') { landingMark(e); return; }
    if (e.state !== 'warn' && e.state !== 'secondGear') return;
    const py = Math.round(Math.max(64,e.y-118)), px = Math.round(clamp(e.x,G.cam.x+38,G.cam.x+W-38));
    if (e.attack === 'gears' || e.state === 'secondGear') {
      dots(e.x,e.y-7,e.x+e.facing*120,e.y-7,gold); text('GEARS!',px,py,gold,1,'center');
      gearJumpCue(e.x + e.facing * 21, e.facing * countGearSpeed, e.timer);
    } else if (e.attack === 'landing') {
      landingMark(e); text('MOVE!',px,py,gold,1,'center');
    } else {
      const x=e.x+e.facing*19, y=e.y-32;
      const a=Math.atan2(e.targetY-y,e.targetX-x), d=Math.min(115,Math.hypot(e.targetY-y,e.targetX-x));
      for (const spread of [-0.24,0,0.24]) dots(x,y,x+Math.cos(a+spread)*d,y+Math.sin(a+spread)*d,mint);
      sight(e.targetX,e.targetY,mint); text('DODGE!',px,py,mint,1,'center');
    }
  }
  function countFan(e) {
    const x=e.x+e.facing*19, y=e.y-32;
    for (const spread of [-0.24,0,0.24]) bolt(x,y,e.targetX,e.targetY,spread,1.7);
    sparks(x,y,5,mint); Snd.tone('triangle',350,820,0.2,0.09);
  }
  ENEMY_TYPES.countClockfang = {
    tells: bossTells,
    hp: 86, boss: true, bossName: 'COUNT CLOCKFANG', armored: true,
    contact: e => e.state === 'impact' ? 'hurt' : 'none',
    make(e) {
      e.x = G.cam.x + W - 100; e.y = 70; e.state = 'intro'; e.timer = 76;
      e.inv = true; e.enraged = false; e.turn = 0;
    },
    box: e => ({x:e.x-21,y:e.y-69,w:42,h:69}),
    update(e) {
      if (e.state === 'dying') {
        if (e.timer%16 === 0 && e.timer>20) {
          const x=e.x+Math.sin(e.timer*1.3)*20, y=e.y-25-(e.timer%41);
          sparks(x,y,10,e.timer%32 ? mint : gold); debris(x,y,3,brass); Snd.clank();
        }
        if (--e.timer <= 0) { boom(e.x,e.y-30,1.1); bossDefeated(e); }
        return;
      }
      if (e.state === 'intro') {
        const q = 1 - --e.timer / 76;
        e.y = groundAt(e.x) - (groundAt(e.x)-70)*(1-q)*(1-q);
        if (!e.timer) { e.state='rest'; e.timer=55; e.inv=false; dust(e.x,e.y,10); }
        return;
      }
      if (e.state === 'rest') {
        faceHero(e);
        if (G.p.dead || G.winT) return;
        // Withdraw to give the next marked lane room. A cornered count turns
        // rather than pushing a hero into the screen edge.
        if (Math.abs(e.x-G.p.x)<90) {
          e.x = clamp(e.x-e.facing*0.65,G.cam.x+43,G.cam.x+W-43); e.y=groundAt(e.x);
        }
        if (!e.enraged && e.hp <= e.max/2) {
          e.enraged=true; e.timer=Math.max(e.timer,72);
          G.texts.push({x:e.x,y:e.y-77,s:'MIDNIGHT!',t:66,c:gold});
          sparks(e.x,e.y-34,16,gold); Snd.tone('sine',320,320,0.4,0.12);
          Snd.tone('sine',480,480,0.35,0.08,0.21);
        }
        if (--e.timer<=0) {
          aim(e); e.attack=['gears','landing','fan'][e.turn++%3]; e.state='warn'; e.timer=58;
          if (e.attack==='landing') {
            e.targetX=clamp(e.targetX,G.cam.x+42,G.cam.x+W-42); e.startX=e.x;
          }
          Snd.tone('sine',410,565,0.19,0.075);
        }
      } else if (e.state === 'warn') {
        if (--e.timer>0) return;
        if (e.attack==='landing') {
          e.state='flight'; e.timer=63; Snd.noise(0.22,0.07,1100);
        } else if (e.attack==='gears') {
          wheel(e.x+e.facing*21,e.facing,countGearSpeed);
          Snd.tone('triangle',235,120,0.24,0.09);
          e.state=e.enraged ? 'secondGear' : 'rest'; e.timer=e.enraged ? 60 : 78;
        } else {
          countFan(e); e.state='rest'; e.timer=e.enraged ? 62 : 78;
        }
      } else if (e.state==='secondGear') {
        if (--e.timer<=0) {
          wheel(e.x+e.facing*21,e.facing,countGearSpeed); Snd.tone('triangle',260,140,0.22,0.09);
          e.state='rest'; e.timer=68;
        }
      } else if (e.state==='flight') {
        const q=1 - --e.timer/63;
        e.x=e.startX+(e.targetX-e.startX)*q;
        e.y=groundAt(e.x)-Math.sin(q*Math.PI)*80;
        if (!e.timer) {
          e.state='impact'; e.timer=11; dust(e.x,e.y,16); sparks(e.x,e.y-3,12,gold);
          G.shake=Math.max(G.shake,4); Snd.tone('triangle',130,65,0.24,0.13);
        }
      } else if (e.state==='impact' && --e.timer<=0) { e.state='rest'; e.timer=86; }
    },
    draw(e) {
      bossTells(e);
      countPicture(e);
    },
    onKill(e,cx,cy,box) {
      e.state='dying'; e.timer=120; e.inv=true; e.y=groundAt(e.x);
      if (G.p.dead && G.lives<=1) G.lives=2;
      G.winT=330; G.eb=G.eb.filter(b => b.k!=='clockfangGear' && b.k!=='clockfangSpark');
      addScore(4000,cx,box.y); sparks(cx,cy,24,gold); Snd.tone('triangle',750,110,0.65,0.14);
      return 'dying';
    }
  };
}
