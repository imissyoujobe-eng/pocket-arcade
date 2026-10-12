/* Belt-scrolling brawler engine shared by Street Brawl, Axe & Sorcery and Fist City.
   Walk the street in depth, punch combos, jump kicks, specials, weapons, breakables, waves and bosses.
   A game passes a config to B.start(cfg); the engine runs the loop through the K kit. */
(function () {
  'use strict';
  var B = {};
  var W = 320, H = 240, ZMIN = 150, ZMAX = 226;
  B.W = W; B.H = H; B.ZMIN = ZMIN; B.ZMAX = ZMAX;

  // ---- drawing a fighter: a chunky pixel person built from a look {skin,hair,top,legs,belt,size,hat,beard,cape,horns} ----
  B.person = function (c, x, y, L, pose, face, t, flash) {
    var s = (L.size || 1) * 1.25, f = face || 1;
    function R(dx, dy, w, h, col) { if (!col) return; c.fillStyle = flash ? '#fff' : col; var X = f > 0 ? x + dx * s : x - (dx + w) * s; c.fillRect(Math.round(X), Math.round(y + dy * s), Math.ceil(w * s), Math.ceil(h * s)); }
    if (pose === 'down') {
      R(-14, -6, 10, 6, L.legs); R(-4, -7, 12, 7, L.top); R(8, -7, 6, 6, L.skin); R(8, -8, 6, 2, L.hair); return;
    }
    var step = pose === 'walk' ? Math.sin(t * 12) * 3 : 0, lean = pose === 'hurt' ? -3 : 0, crouch = pose === 'land' ? 3 : 0;
    // legs
    if (pose === 'kick' || pose === 'jkick') { R(-4, -12 + crouch, 4, 12, L.legs); R(0, -12, 13, 4, L.legs); R(12, -12, 3, 4, L.boots || L.legs); }
    else { R(-4 + step * 0.5, -12 + crouch, 4, 12 - crouch, L.legs); R(1 - step * 0.5, -12 + crouch, 4, 12 - crouch, L.legs); R(-4 + step * 0.5, -2, 4, 2, L.boots || '#222'); R(1 - step * 0.5, -2, 4, 2, L.boots || '#222'); }
    if (L.cape) R(-7 + lean, -25 + crouch, 3, 14, L.cape);
    // body
    R(-5 + lean, -25 + crouch, 11, 13, L.top); R(-5 + lean, -14 + crouch, 11, 2, L.belt || '#222');
    // head
    R(-3 + lean, -33 + crouch, 8, 8, L.skin); R(-3 + lean, -34 + crouch, 8, 3, L.hair); R(-4 + lean, -33 + crouch, 2, 5, L.hair);
    if (L.hat) R(-4 + lean, -36 + crouch, 10, 3, L.hat);
    if (L.horns) { R(-5 + lean, -38 + crouch, 2, 4, L.horns); R(5 + lean, -38 + crouch, 2, 4, L.horns); }
    if (L.beard) R(1 + lean, -28 + crouch, 5, 4, L.beard);
    R(3 + lean, -31 + crouch, 2, 2, '#111');
    // arms
    var armCol = L.arms || L.skin;
    if (pose === 'punch' || pose === 'swing') { R(4 + lean, -23 + crouch, 12, 4, armCol); R(15 + lean, -24 + crouch, 4, 5, L.gloves || armCol); }
    else if (pose === 'windup') { R(-8 + lean, -26 + crouch, 5, 4, armCol); R(-10, -30 + crouch, 4, 6, L.gloves || armCol); }
    else if (pose === 'spin') { R(-16, -23, 32, 4, armCol); }
    else { R(-6 + lean, -24 + crouch, 3, 10, armCol); R(5 + lean, -24 + crouch, 3, 10, armCol); }
  };
  B.weapon = function (c, x, y, kind, face, swing) {
    var f = face || 1; c.save(); c.translate(x, y); c.scale(f, 1); c.rotate(swing ? -0.2 : -1.1);
    if (kind === 'bat') { c.fillStyle = '#a07040'; c.fillRect(0, -2, 20, 4); }
    else if (kind === 'knife') { c.fillStyle = '#ddd'; c.fillRect(0, -1, 9, 2); c.fillStyle = '#542'; c.fillRect(-3, -1.5, 4, 3); }
    else if (kind === 'pipe') { c.fillStyle = '#9aa'; c.fillRect(0, -1.5, 22, 3); }
    else if (kind === 'axe') { c.fillStyle = '#6a4a2a'; c.fillRect(0, -1.5, 20, 3); c.fillStyle = '#ccd'; c.fillRect(14, -6, 7, 9); }
    else if (kind === 'sword') { c.fillStyle = '#dde'; c.fillRect(2, -1.5, 20, 3); c.fillStyle = '#c90'; c.fillRect(0, -4, 3, 8); }
    else if (kind === 'hammer') { c.fillStyle = '#6a4a2a'; c.fillRect(0, -1.5, 18, 3); c.fillStyle = '#889'; c.fillRect(14, -6, 8, 12); }
    c.restore();
  };

  var g = null;
  B.start = function (cfg) {
    K.screen(W, H); K.theme(cfg.theme);
    K.hud(['score', 'stage', 'lives']);
    var btns = [{ id: 'c', label: cfg.specialLabel || 'SPECIAL' }, { id: 'b', label: 'JUMP' }, { id: 'a', label: 'HIT' }];
    K.pad({ dpad: '4', buttons: btns });
    addEventListener('keydown', function (e) { if (e.key === 'c' || e.key === 'C' || e.key === 'l' || e.key === 'L') K.press('c'); });
    addEventListener('keyup', function (e) { if (e.key === 'c' || e.key === 'C' || e.key === 'l' || e.key === 'L') K.release('c'); });
    if (window.A && !B._inked) { B.person = A.ink(B.person); B.weapon = A.ink(B.weapon); B._inked = true; }
    g = { cfg: cfg, state: 'title', best: K.best(cfg.key) };
    B.g = g;
    newGame(); g.state = 'title';
    showTitle();
    K.run(update, draw);
  };
  function showTitle() {
    var cfg = g.cfg;
    K.card({ title: cfg.title, text: cfg.text, best: g.best ? 'BEST ' + g.best : '', button: cfg.button || 'Fight', onStart: begin });
  }
  function begin() { if (g.cfg.heroes) { g.state = 'pick'; g.pickI = g.pickI || 0; } else { newGame(); g.state = 'play'; } }
  function newGame() { g.score = 0; g.lives = 3; g.si = 0; loadStage(); }
  function heroCfg() { return Object.assign({}, g.cfg.hero, g.heroPick || {}); }
  function loadStage() {
    var S = g.cfg.stages[g.si], hc = heroCfg();
    g.stage = S; g.camX = 0; g.lock = 0; g.foes = []; g.items = []; g.props = []; g.shots = []; g.fx = []; g.waveI = 0; g.go = 0; g.msg = 'STAGE ' + (g.si + 1) + ': ' + S.name; g.msgT = 2; g.clearT = 0; g.shake = 0;
    var hpKeep = g.p && g.p.hp > 0 ? Math.max(g.p.hp, hc.hp * 0.5) : hc.hp;
    g.p = { x: 40, z: 190, h: 0, vh: 0, face: 1, hp: g.si === 0 ? hc.hp : Math.min(hc.hp, hpKeep + hc.hp * 0.3), max: hc.hp, look: hc.look, combo: 0, comboT: 0, atk: null, atkT: 0, hurtT: 0, inv: 1, downT: 0, weapon: null, potions: g.p && g.si ? g.p.potions : (hc.potions || 0), spd: hc.spd || 70, dmg: hc.dmg || 1, reach: hc.reach || 20, wpn: hc.weapon || null };
    (S.props || []).forEach(function (pr) { g.props.push({ x: pr.x, z: pr.z, kind: pr.kind || 'barrel', drop: pr.drop, hp: 2 }); });
  }
  function foe(type, x, z, boss) {
    var T = Object.assign({ hp: 4, spd: 40, dmg: 6, reach: 18, cool: 1.2, wind: 0.35, score: 100 }, g.cfg.foes[type]);
    var f = { type: type, T: T, x: x, z: z, h: 0, vh: 0, vx: 0, face: x < g.p.x ? 1 : -1, hp: T.hp, max: T.hp, look: T.look, state: 'walk', t: 0, cd: K.rnd(0.4, 1.4), inv: 0, boss: !!boss, name: T.name || type.toUpperCase(), drop: T.drop, think: K.rnd(0, 1), offZ: K.rnd(-6, 6) };
    g.foes.push(f); return f;
  }
  function spawnWave(wave) {
    wave.foes.forEach(function (type, i) { var side = wave.side || (i % 2 ? 1 : -1); if (g.camX < 10) side = 1; foe(type, side > 0 ? g.camX + W + 20 + i * 18 : g.camX - 20 - i * 18, K.rnd(ZMIN + 6, ZMAX - 6)); });
    if (wave.boss) { var b = foe(wave.boss, g.camX + W + 30, (ZMIN + ZMAX) / 2, true); g.bossRef = b; g.msg = b.name; g.msgT = 1.6; }
  }
  function addFx(x, y, col, n, txt) { for (var i = 0; i < (n || 6); i++) g.fx.push({ x: x, y: y, vx: K.rnd(-60, 60), vy: K.rnd(-80, 0), t: K.rnd(0.2, 0.5), c: col }); if (txt) g.fx.push({ x: x, y: y - 6, vx: 0, vy: -30, t: 0.7, txt: txt }); }
  B.addFx = addFx;

  // deal damage to a foe
  function hitFoe(f, dmg, knock, dir) {
    if (f.state === 'down' || f.state === 'dead' || f.inv > 0) return false;
    f.hp -= dmg; g.score += Math.round(10 * dmg); addFx(f.x, f.z - 22, '#fff', 4); K.beep(220 - Math.min(150, dmg * 15), 0.06, { type: 'square', vol: 0.05 }); K.noise(0.05, 0.15);
    f.face = -dir;
    if (f.hp <= 0 || knock) { f.state = 'down'; f.t = f.hp <= 0 ? 1.4 : 1.1; f.vh = 120; f.h = 0.1; f.vx = dir * 90; if (f.hp <= 0) { f.dying = true; g.score += f.T.score; } }
    else { f.state = 'hurt'; f.t = 0.32; f.vx = dir * 30; }
    g.shake = Math.max(g.shake, knock ? 0.15 : 0.05);
    return true;
  }
  B.hitFoe = hitFoe;
  function hurtPlayer(dmg, dir, knock) {
    var p = g.p; if (p.inv > 0 || p.downT > 0 || g.state !== 'play') return;
    p.hp -= dmg; p.combo = 0; p.atk = null; K.beep(140, 0.15, { type: 'sawtooth', vol: 0.06 });
    if (knock || p.hp <= 0 || dmg >= 10) { p.downT = 1.1; p.vh = 110; p.h = 0.1; p.vx = dir * 80; p.weapon = null; }
    else { p.hurtT = 0.3; p.x += dir * 6; }
    if (p.hp <= 0) {
      g.lives--;
      if (g.lives <= 0) { g.state = 'over'; g.best = K.saveBest(g.cfg.key, g.score); K.card({ title: g.cfg.overTitle || 'K.O.', text: 'You reached stage ' + (g.si + 1) + ' with ' + g.score + ' points.', best: 'BEST ' + g.best, button: 'Again', onStart: begin }); return; }
      p.hp = p.max; p.inv = 2.5; g.foes.forEach(function (f) { if (Math.abs(f.x - p.x) < 80) hitFoe(f, 0, true, f.x > p.x ? 1 : -1); });
      g.msg = 'GET UP!'; g.msgT = 1;
    }
  }
  B.hurtPlayer = hurtPlayer;

  function playerAttack(kind) {
    var p = g.p, w = p.weapon || p.wpn, base = p.dmg;
    var reach = p.reach + (w ? 8 : 0), dmg = base + (w === 'bat' || w === 'pipe' ? 1 : 0) + (w === 'axe' || w === 'hammer' ? 1.5 : 0) + (w === 'sword' ? 1 : 0);
    var knock = false, spin = false;
    if (kind === 'jkick') { dmg = base * 1.6; knock = true; reach += 4; }
    else if (kind === 'finisher') { dmg = base * 1.8; knock = true; }
    else if (kind === 'spin') { spin = true; dmg = base * 2; knock = true; reach = 32; }
    var any = false;
    g.foes.forEach(function (f) {
      var dx = f.x - p.x; if (Math.abs(f.z - p.z) > 11 || Math.abs(f.h - p.h) > 30) return;
      if (spin ? Math.abs(dx) < reach : (dx * p.face > -4 && dx * p.face < reach + (f.boss ? 6 : 0))) { if (hitFoe(f, dmg, knock, dx > 0 ? 1 : -1)) any = true; }
    });
    g.props.forEach(function (pr) { var dx = pr.x - p.x; if (!pr.dead && Math.abs(pr.z - p.z) < 12 && (spin ? Math.abs(dx) < reach : dx * p.face > -4 && dx * p.face < reach + 6)) { pr.hp--; K.noise(0.08, 0.2); addFx(pr.x, pr.z - 10, '#a87', 5); if (pr.hp <= 0) { pr.dead = true; g.score += 50; if (pr.drop) g.items.push({ x: pr.x, z: pr.z, kind: pr.drop }); } any = true; } });
    if (!any) K.beep(500, 0.03, { vol: 0.02 });
    if (w && p.weapon && any) { p.wUses = (p.wUses || 8) - 1; if (p.wUses <= 0) { p.weapon = null; g.msg = 'WEAPON BROKE'; g.msgT = 0.8; } }
  }
  B.playerAttack = playerAttack;

  function update(dt) {
    if (g.state === 'pick') {
      var n = g.cfg.heroes.length;
      if (K.hit('left')) { g.pickI = (g.pickI + n - 1) % n; K.beep(500, 0.05); } if (K.hit('right')) { g.pickI = (g.pickI + 1) % n; K.beep(500, 0.05); }
      var ok = K.hit('a') || K.hit('start');
      if (K.ptr.tapped) { var i = K.clamp(Math.floor(K.ptr.x / (W / n)), 0, n - 1); if (i === g.pickI) ok = true; else g.pickI = i; }
      if (ok) { g.heroPick = g.cfg.heroes[g.pickI]; g.p = null; newGame(); g.state = 'play'; K.tune([392, 523, 659], 0.08); }
      return;
    }
    if (g.state !== 'play') return;
    var cfg = g.cfg, p = g.p, S = g.stage;
    if (g.msgT > 0) g.msgT -= dt; if (g.shake > 0) g.shake -= dt;
    // ---- player ----
    if (p.inv > 0) p.inv -= dt;
    if (p.downT > 0) {
      p.downT -= dt; if (p.h > 0) { p.vh -= 400 * dt; p.h = Math.max(0, p.h + p.vh * dt); p.x += p.vx * dt; }
      if (p.downT <= 0) p.inv = Math.max(p.inv, 1);
    } else if (p.hurtT > 0) { p.hurtT -= dt; }
    else {
      var mx = (K.down('right') ? 1 : 0) - (K.down('left') ? 1 : 0), mz = (K.down('down') ? 1 : 0) - (K.down('up') ? 1 : 0);
      if (K.ptr.down && K.ptr.y > 60) { var sx = p.x - g.camX, dxp = K.ptr.x - sx, dzp = K.ptr.y - p.z; if (Math.abs(dxp) > 10) mx = Math.sign(dxp); if (Math.abs(dzp) > 6) mz = Math.sign(dzp); }
      if (p.atkT > 0) { p.atkT -= dt; if (p.atkT <= 0) p.atk = null; mx *= p.h > 0 ? 1 : 0; mz *= p.h > 0 ? 1 : 0; }
      if (p.comboT > 0) p.comboT -= dt; else p.combo = 0;
      p.x += mx * p.spd * dt; p.z += mz * p.spd * 0.6 * dt; if (mx && !p.atk) p.face = mx;
      if (p.h > 0 || p.vh) { p.vh -= 520 * dt; p.h += p.vh * dt; if (p.h <= 0) { p.h = 0; p.vh = 0; if (p.atk === 'jkick') { p.atk = null; p.atkT = 0; } } }
      if (K.hit('b') && p.h === 0 && !p.atk) { p.vh = 210; p.h = 0.1; K.beep(300, 0.08, { to: 500, vol: 0.03 }); }
      var tapHit = K.ptr.tapped && K.ptr.y <= 60;
      if ((K.hit('a') || tapHit) && !p.atk) {
        // pick up an item instead if standing on one
        var it = g.items.find(function (i) { return !i.dead && Math.abs(i.x - p.x) < 12 && Math.abs(i.z - p.z) < 10; });
        if (it && p.h === 0) { pickUp(it); }
        else if (p.h > 0) { p.atk = 'jkick'; p.atkT = 0.4; playerAttack('jkick'); }
        else { p.combo = p.comboT > 0 ? p.combo + 1 : 1; p.comboT = 0.55; var fin = p.combo >= 3; p.atk = fin ? 'finisher' : 'punch'; p.atkT = fin ? 0.32 : 0.18; playerAttack(fin ? 'finisher' : 'punch'); if (fin) p.combo = 0; }
      }
      if (K.hit('c') && !p.atk && p.h === 0) { if (cfg.special) cfg.special(g, B); else { p.atk = 'spin'; p.atkT = 0.45; p.hp -= 3; playerAttack('spin'); K.beep(600, 0.3, { to: 200 }); } }
    }
    p.z = K.clamp(p.z, ZMIN, ZMAX);
    var minX = g.camX + 10, maxX = g.lock ? g.camX + W - 10 : Math.min(S.len - 10, g.camX + W - 10);
    p.x = K.clamp(p.x, minX, maxX);
    // ---- camera & waves ----
    if (!g.lock) {
      var target = K.clamp(p.x - W * 0.45, 0, S.len - W); if (target > g.camX) g.camX += Math.min(target - g.camX, 140 * dt);
      var wv = S.waves[g.waveI];
      if (wv && g.camX + W * 0.5 >= wv.at) { g.lock = 1; g.camX = Math.min(g.camX, S.len - W); spawnWave(wv); g.waveI++; g.go = 0; }
    } else if (!g.foes.some(function (f) { return !f.dead; })) {
      g.lock = 0; g.go = 2.5;
      if (g.waveI >= S.waves.length) { g.clearT = 2; g.msg = 'STAGE CLEAR!'; g.msgT = 2; K.tune([523, 659, 784, 1046], 0.12); g.score += 1000; }
    }
    if (g.go > 0) g.go -= dt;
    if (g.clearT > 0) { g.clearT -= dt; if (g.clearT <= 0) { g.si++; if (g.si >= cfg.stages.length) { g.state = 'over'; g.score += g.lives * 2000; g.best = K.saveBest(cfg.key, g.score); K.card({ title: cfg.winTitle || 'YOU WIN!', text: cfg.winText || ('The city is safe. Final score ' + g.score + '.'), best: 'BEST ' + g.best, button: 'Again', onStart: begin }); return; } loadStage(); } }
    // ---- foes ----
    var attackers = 0;
    g.foes.forEach(function (f) {
      if (f.dead) return; f.t -= dt; if (f.inv > 0) f.inv -= dt; var T = f.T;
      if (f.state === 'down') { if (f.h > 0) { f.vh -= 400 * dt; f.h = Math.max(0, f.h + f.vh * dt); f.x += f.vx * dt; } if (f.t <= 0) { if (f.dying) { f.dead = true; if (f.drop && Math.random() < (f.dropChance || 0.5)) g.items.push({ x: f.x, z: f.z, kind: f.drop }); if (cfg.onKill) cfg.onKill(g, f); } else { f.state = 'walk'; f.inv = 0.6; f.cd = 0.6; } } return; }
      if (f.state === 'hurt') { f.x += f.vx * dt; f.vx *= 0.85; if (f.t <= 0) f.state = 'walk'; return; }
      if (f.state === 'wind') { if (f.t <= 0) { f.state = 'strike'; f.t = 0.2; var dx = p.x - f.x; if (Math.abs(p.z - f.z) < 12 && dx * f.face > -4 && dx * f.face < T.reach + 6 && p.h < 24) hurtPlayer(T.dmg, f.face, T.knock); K.beep(180, 0.05, { vol: 0.03 }); } return; }
      if (f.state === 'strike') { if (f.t <= 0) { f.state = 'walk'; f.cd = T.cool * K.rnd(0.8, 1.3); } return; }
      if (f.state === 'charge') { f.x += f.vx * dt; if (Math.abs(p.z - f.z) < 12 && Math.abs(p.x - f.x) < 14) { hurtPlayer(T.dmg, Math.sign(f.vx), true); f.state = 'walk'; f.cd = 1.5; } if (f.t <= 0 || f.x < g.camX - 30 || f.x > g.camX + W + 30) { f.state = 'walk'; f.cd = 1.2; } return; }
      // walking AI: line up in depth, keep the right distance, then attack
      f.cd -= dt;
      var want = T.ranged ? 90 : T.reach - 4, dxp = p.x - f.x, dist = Math.abs(dxp);
      f.face = dxp > 0 ? 1 : -1;
      var tx = p.x - f.face * want, tz = p.z + (dist > want + 30 ? f.offZ * 3 : 0);
      var spd = T.spd * (f.boss ? 1 : 1);
      if (Math.abs(tx - f.x) > 4) f.x += Math.sign(tx - f.x) * spd * dt;
      if (Math.abs(tz - f.z) > 3) f.z += Math.sign(tz - f.z) * spd * 0.6 * dt;
      f.state = 'walk';
      var inLine = Math.abs(p.z - f.z) < 10;
      if (f.cd <= 0 && inLine && p.downT <= 0) {
        if (T.ranged && dist > 40) { f.state = 'strike'; f.t = 0.3; g.shots.push({ x: f.x + f.face * 10, z: f.z, h: 20, vx: f.face * (T.shotSpd || 130), kind: T.ranged, dmg: T.dmg }); f.cd = T.cool * K.rnd(1, 1.6); K.beep(700, 0.05, { to: 300 }); }
        else if (T.charge && dist > 50 && dist < 160) { f.state = 'charge'; f.t = 1.2; f.vx = f.face * T.charge; }
        else if (dist < T.reach + 8) { f.state = 'wind'; f.t = T.wind; }
      }
      if (f.state === 'wind' || f.state === 'charge') attackers++;
    });
    g.foes = g.foes.filter(function (f) { return !f.dead; });
    // ---- shots ----
    g.shots.forEach(function (s) { s.x += s.vx * dt; if (Math.abs(s.z - p.z) < 9 && Math.abs(s.x - p.x) < 8 && p.h < 20) { s.dead = true; hurtPlayer(s.dmg, Math.sign(s.vx)); } if (s.x < g.camX - 20 || s.x > g.camX + W + 20) s.dead = true; });
    g.shots = g.shots.filter(function (s) { return !s.dead; });
    // ---- items: auto-collect food & treasure when walked over ----
    g.items.forEach(function (it) { if (!it.dead && (it.kind === 'food' || it.kind === 'gem' || it.kind === 'potion') && Math.abs(it.x - p.x) < 12 && Math.abs(it.z - p.z) < 10 && p.h < 10) pickUp(it); });
    g.items = g.items.filter(function (i) { return !i.dead; });
    g.props = g.props.filter(function (pr) { return !pr.dead; });
    g.fx.forEach(function (e) { e.t -= dt; e.x += e.vx * dt; e.y += e.vy * dt; if (!e.txt) e.vy += 200 * dt; }); g.fx = g.fx.filter(function (e) { return e.t > 0; });
    if (cfg.update) cfg.update(g, dt, B);
    K.set('score', g.score); K.set('stage', 'STAGE ' + (g.si + 1)); K.set('lives', '♥'.repeat(Math.max(0, g.lives)) + (cfg.showPotions ? ' ⚗' + p.potions : ''));
  }
  function pickUp(it) {
    var p = g.p; it.dead = true;
    if (it.kind === 'food') { p.hp = Math.min(p.max, p.hp + p.max * 0.5); addFx(it.x, it.z - 10, '#7f7', 6, '+HP'); K.tune([660, 880], 0.06); }
    else if (it.kind === 'gem') { g.score += 1000; addFx(it.x, it.z - 10, '#ff7', 6, '+1000'); K.tune([880, 1320], 0.05); }
    else if (it.kind === 'potion') { p.potions = Math.min(9, p.potions + 1); addFx(it.x, it.z - 10, '#7af', 6, '+MAGIC'); K.beep(1000, 0.1); }
    else { p.weapon = it.kind; p.wUses = 10; g.msg = it.kind.toUpperCase(); g.msgT = 0.8; K.beep(600, 0.08); }
  }
  B.pickUp = pickUp;

  function draw(c, t) {
    var S = g.stage, cx = Math.round(g.camX); t = t / 1000;
    if (g.state === 'pick') {
      S.bg(c, 0, t); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H);
      K.text(c, 'CHOOSE YOUR HERO', W / 2, 24, 14, '#fff');
      var hs = g.cfg.heroes, cw = W / hs.length;
      hs.forEach(function (h, i) { var x = cw * i + cw / 2, sel = i === g.pickI;
        if (sel) { c.strokeStyle = '#ffd23a'; c.lineWidth = 2; c.strokeRect(cw * i + 6, 40, cw - 12, 170); c.lineWidth = 1; }
        B.person(c, x, 130, Object.assign({}, h.look, { size: 1.6 }), sel ? 'walk' : 'idle', 1, t, false);
        if (h.weapon) B.weapon(c, x + 10, 98, h.weapon, 1, false);
        K.text(c, h.name, x, 150, 9, sel ? '#ffd23a' : '#fff');
        (h.blurb || []).forEach(function (l, j) { K.text(c, l, x, 168 + j * 12, 7, '#ddd'); }); });
      K.text(c, '◀ ▶ then HIT (or tap twice)', W / 2, 224, 8, '#ffd23a');
      return;
    }
    if (g.shake > 0) c.translate(K.rnd(-2, 2), K.rnd(-2, 2));
    S.bg(c, cx, t);
    // floor band edge
    // sort everything by depth
    var list = [];
    g.props.forEach(function (pr) { list.push({ z: pr.z, d: function () { var x = pr.x - cx; if (pr.kind === 'barrel') { c.fillStyle = '#8a5a2a'; c.fillRect(x - 8, pr.z - 20, 16, 20); c.fillStyle = '#5a3a1a'; c.fillRect(x - 8, pr.z - 15, 16, 2); c.fillRect(x - 8, pr.z - 7, 16, 2); } else { c.fillStyle = '#a07a40'; c.fillRect(x - 9, pr.z - 16, 18, 16); c.strokeStyle = '#6a4a20'; c.strokeRect(x - 9, pr.z - 16, 18, 16); c.beginPath(); c.moveTo(x - 9, pr.z - 16); c.lineTo(x + 9, pr.z); c.stroke(); } } }); });
    g.items.forEach(function (it) { list.push({ z: it.z - 1, d: function () { var x = it.x - cx, y = it.z;
      if (it.kind === 'food') { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 3, 8, 3, 0, 0, 7); c.fill(); c.fillStyle = '#c84'; c.beginPath(); c.ellipse(x, y - 6, 5, 4, 0, 0, 7); c.fill(); }
      else if (it.kind === 'gem') { c.fillStyle = Math.floor(t * 6) % 2 ? '#ff7' : '#fc3'; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 5, y - 6); c.lineTo(x, y); c.lineTo(x - 5, y - 6); c.fill(); }
      else if (it.kind === 'potion') { c.fillStyle = '#4a8aff'; c.beginPath(); c.arc(x, y - 5, 4, 0, 7); c.fill(); c.fillRect(x - 1.5, y - 12, 3, 4); }
      else B.weapon(c, x - 8, y - 3, it.kind, 1, true);
      if (Math.floor(t * 3) % 2) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - 1, y - 18, 2, 2); } } }); });
    g.foes.forEach(function (f) { list.push({ z: f.z, d: function () {
      var x = f.x - cx, y = f.z - f.h; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, f.z, 10 * (f.look.size || 1), 3, 0, 0, 7); c.fill();
      if (f.dead) return;
      var pose = f.state === 'down' ? (f.h > 0 ? 'hurt' : 'down') : f.state === 'hurt' ? 'hurt' : f.state === 'wind' ? 'windup' : f.state === 'strike' ? (f.T.kick ? 'kick' : 'punch') : 'walk';
      if (f.dying && f.state === 'down' && f.t < 0.6 && Math.floor(t * 12) % 2) return;
      B.person(c, x, y, f.look, pose, f.face, t + f.think, f.state === 'hurt' && f.t > 0.25);
      if (f.T.weapon && pose !== 'down') B.weapon(c, x + f.face * (pose === 'punch' ? 18 : 8), y - 25 * (f.look.size || 1), f.T.weapon, f.face, pose === 'punch' || pose === 'kick');
    } }); });
    var p = g.p;
    list.push({ z: p.z + 0.5, d: function () {
      var x = p.x - cx, y = p.z - p.h; c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, p.z, 10, 3, 0, 0, 7); c.fill();
      if (g.state === 'title') return;
      if (p.inv > 0 && p.downT <= 0 && Math.floor(t * 14) % 2) return;
      var pose = p.downT > 0 ? (p.h > 0 ? 'hurt' : 'down') : p.hurtT > 0 ? 'hurt' : p.atk === 'jkick' ? 'jkick' : p.atk === 'spin' ? 'spin' : p.atk === 'finisher' ? (g.cfg.finisher || 'kick') : p.atk ? 'punch' : (K.down('left') || K.down('right') || K.down('up') || K.down('down')) ? 'walk' : 'idle';
      B.person(c, x, y, p.look, pose, p.face, t, false);
      var w = p.weapon || p.wpn; if (w && pose !== 'down') B.weapon(c, x + p.face * (p.atk ? 18 : 8), y - 25, w, p.face, !!p.atk);
    } });
    g.shots.forEach(function (s) { list.push({ z: s.z, d: function () { var x = s.x - cx; c.fillStyle = s.kind === 'fire' ? '#ff8a2a' : s.kind === 'magic' ? '#c07aff' : '#ddd'; c.fillRect(x - 4, s.z - s.h - 1, 8, 3); } }); });
    list.sort(function (a, b) { return a.z - b.z; }).forEach(function (e) { e.d(); });
    g.fx.forEach(function (e) { if (e.txt) K.text(c, e.txt, e.x - cx, e.y - 20, 8, '#fff'); else { c.fillStyle = e.c; c.fillRect(e.x - cx, e.y, 2, 2); } });
    if (window.A) { A.ambient(c, W, H, t * 1000, g.cfg.ambient || 'dust', 12); A.vignette(c, W, H, 0.35); }
    if (g.cfg.drawOver) g.cfg.drawOver(c, g, t, B);
    // bars
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(6, 6, 104, 8); c.fillStyle = p.hp > p.max * 0.3 ? '#ffd23a' : '#ff4a4a'; c.fillRect(8, 8, 100 * Math.max(0, p.hp) / p.max, 4);
    var tgt = g.bossRef && !g.bossRef.dead ? g.bossRef : null;
    if (tgt) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(W - 110, 6, 104, 8); c.fillStyle = '#ff5a5a'; c.fillRect(W - 108, 8, 100 * Math.max(0, tgt.hp) / tgt.max, 4); K.text(c, tgt.name, W - 58, 20, 7, '#fff'); }
    if (g.go > 0 && Math.floor(t * 4) % 2) K.text(c, 'GO ▶', W - 40, 60, 14, '#ffd23a');
    if (g.msgT > 0) K.text(c, g.msg, W / 2, 50, 14, '#fff');
  }
  window.B = B;
})();
