/* Side-scrolling platformer engine shared by the adventure games.
   Tile maps from strings, solid/one-way collisions, a tunable player controller,
   common enemies, pickups, camera and drawing helpers. Uses the K kit for input + sound. */
(function () {
  'use strict';
  var P = { T: 16 };
  P.SOLID = '#BHPX?MU';     // blocks you cannot pass through
  P.ONEWAY = '=';           // stand on top, jump up through
  P.HURT = '^L';            // spikes, lava

  // ---- level building ----
  // rows: array of strings (all same length). Returns a world with a mutable tile grid.
  P.world = function (rows) {
    var w = { rows: rows.length, cols: rows[0].length, g: rows.map(function (r) { return r.split(''); }), ents: [], start: { x: 32, y: 32 }, bumps: [] };
    w.px = w.cols * P.T; w.py = w.rows * P.T;
    return w;
  };
  // join chunks side by side into one level (each chunk is an array of equal-height strings)
  P.join = function (chunks) {
    var h = chunks[0].length, out = [];
    for (var y = 0; y < h; y++) out.push(chunks.map(function (c) { return c[y]; }).join(''));
    return out;
  };
  P.tile = function (w, x, y) {
    var tx = Math.floor(x / P.T), ty = Math.floor(y / P.T);
    if (tx < 0 || tx >= w.cols) return '#';
    if (ty < 0) return '.';
    if (ty >= w.rows) return '.';
    return w.g[ty][tx];
  };
  P.set = function (w, tx, ty, ch) { if (ty >= 0 && ty < w.rows && tx >= 0 && tx < w.cols) w.g[ty][tx] = ch; };
  P.isSolid = function (ch) { return P.SOLID.indexOf(ch) >= 0; };

  // ---- movement with tile collisions ----
  // body: {x,y,w,h,vx,vy}. Moves x then y. Sets body.ground, body.hitWall, body.hitHead (tile coords of the block hit).
  P.move = function (w, b, dt, opts) {
    opts = opts || {};
    b.hitWall = 0; b.hitHead = null; var wasGround = b.ground; b.ground = false;
    // x
    var nx = b.x + b.vx * dt;
    if (hitsSolid(w, nx, b.y, b.w, b.h)) {
      // step back to the edge
      if (b.vx > 0) nx = Math.floor((nx + b.w) / P.T) * P.T - b.w - 0.01; else if (b.vx < 0) nx = Math.floor(nx / P.T + 1) * P.T + 0.01;
      if (hitsSolid(w, nx, b.y, b.w, b.h)) nx = b.x;
      b.hitWall = Math.sign(b.vx) || 1; b.vx = 0;
    }
    b.x = nx;
    // y
    var ny = b.y + b.vy * dt;
    if (b.vy < 0) {
      if (hitsSolid(w, b.x, ny, b.w, b.h)) {
        var ty = Math.floor(ny / P.T);
        // which block did the head hit? the one under the body's centre, else either corner
        var cx = Math.floor((b.x + b.w / 2) / P.T), cand = [cx, Math.floor((b.x + 1) / P.T), Math.floor((b.x + b.w - 1) / P.T)];
        for (var i = 0; i < cand.length; i++) if (P.isSolid(P.tile(w, cand[i] * P.T + 1, ty * P.T + 1))) { b.hitHead = { tx: cand[i], ty: ty }; break; }
        ny = (ty + 1) * P.T + 0.01; b.vy = 0;
      }
    } else {
      var footOld = b.y + b.h, footNew = ny + b.h, row = Math.floor(footNew / P.T), top = row * P.T;
      var landSolid = hitsSolid(w, b.x, ny, b.w, b.h);
      var landOne = !opts.dropThrough && footOld <= top + 0.5 && (oneAt(w, b.x + 1, footNew) || oneAt(w, b.x + b.w - 1, footNew));
      if (landSolid || landOne) {
        ny = (landSolid ? Math.floor(footNew / P.T) * P.T : top) - b.h - 0.01;
        if (landSolid && hitsSolid(w, b.x, ny, b.w, b.h)) ny = b.y;
        b.vy = 0; b.ground = true;
      }
    }
    b.y = ny;
    // stay on ground check for slopes-free maps: probe 1px under
    if (!b.ground && b.vy >= 0 && (hitsSolid(w, b.x, b.y + 1, b.w, b.h) || (oneAt(w, b.x + 1, b.y + b.h + 1) || oneAt(w, b.x + b.w - 1, b.y + b.h + 1)) && Math.abs((b.y + b.h) % P.T) < 1)) b.ground = true;
    b.justLanded = b.ground && !wasGround;
    return b;
  };
  function oneAt(w, x, y) { return P.ONEWAY.indexOf(P.tile(w, x, y)) >= 0; }
  function hitsSolid(w, x, y, bw, bh) {
    var x0 = Math.floor(x / P.T), x1 = Math.floor((x + bw - 0.02) / P.T), y0 = Math.floor(y / P.T), y1 = Math.floor((y + bh - 0.02) / P.T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= w.cols) return true;
      if (ty < 0 || ty >= w.rows) continue;
      if (P.isSolid(w.g[ty][tx])) return true;
    }
    return false;
  }
  P.hitsSolid = hitsSolid;
  P.touches = function (w, b, set) {
    var x0 = Math.floor((b.x + 2) / P.T), x1 = Math.floor((b.x + b.w - 2) / P.T), y0 = Math.floor((b.y + 2) / P.T), y1 = Math.floor((b.y + b.h - 1) / P.T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) { var ch = P.tile(w, tx * P.T + 1, ty * P.T + 1); if (set.indexOf(ch) >= 0) return { ch: ch, tx: tx, ty: ty }; }
    return null;
  };
  P.overlap = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };

  // ---- player controller ----
  // returns a player body that reads K input. cfg: run, accel, jump, gravity, fall, coyote, w, h
  P.player = function (x, y, cfg) {
    cfg = Object.assign({ run: 96, sprint: 140, accel: 520, decel: 600, air: 0.75, jump: 285, gravity: 820, cut: 0.45, maxFall: 330, coyote: 0.1, buffer: 0.12, w: 11, h: 14 }, cfg || {});
    return { x: x, y: y, w: cfg.w, h: cfg.h, vx: 0, vy: 0, face: 1, ground: false, cfg: cfg, coyote: 0, buf: 0, inv: 0, jumping: false, anim: 0, crouch: false };
  };
  // input: optional overrides {left,right,jump,jumpHeld,run,down}
  P.control = function (w, p, dt, input) {
    var c = p.cfg, inp = input || {};
    var L = inp.left != null ? inp.left : K.down('left'), R = inp.right != null ? inp.right : K.down('right');
    var jumpHit = inp.jump != null ? inp.jump : K.hit('a'), jumpHeld = inp.jumpHeld != null ? inp.jumpHeld : K.down('a');
    var running = inp.run != null ? inp.run : K.down('b');
    var dir = (R ? 1 : 0) - (L ? 1 : 0);
    // holding a direction for a moment breaks into a run, so touch players don't need a second button
    p.holdT = dir && dir === p.lastDir ? (p.holdT || 0) + dt : 0; p.lastDir = dir;
    if (c.autoRun !== false && p.holdT > 0.55) running = true;
    p.running = running && !!dir;
    var top = running ? c.sprint : c.run;
    p.crouch = !!(inp.down != null ? inp.down : K.down('down')) && p.ground;
    if (p.crouch) dir = 0;
    if (dir) { p.face = dir; var a = c.accel * (p.ground ? 1 : c.air); if (Math.sign(p.vx) !== dir) a *= 1.8; p.vx += dir * a * dt; if (Math.abs(p.vx) > top) p.vx = Math.sign(p.vx) * Math.max(top, Math.abs(p.vx) - c.decel * dt); }
    else { var d = c.decel * (p.ground ? 1 : 0.3) * dt; p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d; }
    p.coyote = p.ground ? c.coyote : p.coyote - dt;
    p.buf = jumpHit ? c.buffer : p.buf - dt;
    if (p.buf > 0 && p.coyote > 0) { p.vy = -(c.jump + Math.abs(p.vx) * 0.25); p.buf = 0; p.coyote = 0; p.jumping = true; if (P.onJump) P.onJump(p); }
    if (p.jumping && !jumpHeld && p.vy < 0) { p.vy *= c.cut; p.jumping = false; }
    p.vy = Math.min(c.maxFall, p.vy + c.gravity * dt * (p.vy > 0 ? 1.15 : 1));
    P.move(w, p, dt, { dropThrough: p.crouch && K.hit('a') });
    if (p.ground) p.jumping = false;
    if (p.inv > 0) p.inv -= dt;
    p.anim += Math.abs(p.vx) * dt;
    if (p.y > w.py + 40) p.fell = true;
    return p;
  };

  // ---- camera ----
  P.cam = function (w, target, cam, vw, vh) {
    cam = cam || { x: 0, y: 0 };
    var tx = target.x + target.w / 2 - vw * 0.42 + (target.face || 0) * 18;
    cam.x += (tx - cam.x) * 0.12; cam.x = Math.max(0, Math.min(w.px - vw, cam.x));
    var ty = target.y - vh * 0.55; cam.y += (ty - cam.y) * 0.1; cam.y = Math.max(0, Math.min(w.py - vh, cam.y));
    if (w.py <= vh) cam.y = w.py - vh;
    return cam;
  };

  // ---- generic enemies ----
  // walker: walks, turns at walls (and ledges if smart), dies when stomped
  P.walker = function (x, y, o) { return Object.assign({ kind: 'walker', x: x, y: y, w: 12, h: 12, vx: -28, vy: 0, alive: true, smart: false, stompable: true, ground: false }, o || {}); };
  P.stepWalker = function (w, e, dt) {
    e.vy = Math.min(300, e.vy + 800 * dt);
    var vx0 = e.vx;
    P.move(w, e, dt);
    if (e.hitWall) e.vx = -vx0;
    if (e.smart && e.ground) { var ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2; var below = P.tile(w, ahead, e.y + e.h + 4); if (!P.isSolid(below) && P.ONEWAY.indexOf(below) < 0) e.vx = -e.vx; }
    if (e.y > w.py + 30) e.alive = false;
  };
  // returns 'stomp' if the player landed on top, 'hurt' if touched from the side, else null
  P.contact = function (p, e) {
    if (!P.overlap(p, e)) return null;
    if (e.stompable !== false && p.vy > 0 && p.y + p.h - e.y < Math.max(9, p.vy * 0.05 + 6)) return 'stomp';
    return 'hurt';
  };

  // ---- drawing helpers ----
  P.eachVisible = function (w, cam, vw, vh, fn) {
    var x0 = Math.max(0, Math.floor(cam.x / P.T)), x1 = Math.min(w.cols - 1, Math.floor((cam.x + vw) / P.T)), y0 = Math.max(0, Math.floor(cam.y / P.T)), y1 = Math.min(w.rows - 1, Math.floor((cam.y + vh) / P.T));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) { var ch = w.g[ty][tx]; if (ch !== '.' && ch !== ' ') fn(ch, tx * P.T - Math.round(cam.x), ty * P.T - Math.round(cam.y), tx, ty); }
  };
  // a bumped block jiggles up for a moment
  P.bump = function (w, tx, ty) { w.bumps.push({ tx: tx, ty: ty, t: 0.2 }); };
  P.bumpOffset = function (w, tx, ty) { for (var i = 0; i < w.bumps.length; i++) { var b = w.bumps[i]; if (b.tx === tx && b.ty === ty) return -Math.sin((0.2 - b.t) / 0.2 * Math.PI) * 4; } return 0; };
  P.stepBumps = function (w, dt) { w.bumps.forEach(function (b) { b.t -= dt; }); w.bumps = w.bumps.filter(function (b) { return b.t > 0; }); };

  // pixel sprite from a string grid: rows of chars mapped to colours
  P.sprite = function (c, rows, pal, x, y, flip, scale) {
    scale = scale || 1; var h = rows.length, wd = rows[0].length;
    for (var j = 0; j < h; j++) for (var i = 0; i < wd; i++) { var ch = rows[j][i]; if (ch === '.' || !pal[ch]) continue; c.fillStyle = pal[ch]; c.fillRect(Math.round(x + (flip ? wd - 1 - i : i) * scale), Math.round(y + j * scale), scale, scale); }
  };

  window.P = P;
})();
