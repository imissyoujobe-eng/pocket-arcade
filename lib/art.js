/* Detail art kit: textured, ink-outlined tiles and painted layered backgrounds for every game.
   Tiles are painted once at 4x resolution into small offscreen canvases and cached, so drawing stays fast.
   A.tile(c, kind, x, y, edges, tx, ty, pal)  edges = {t,b,l,r} true where the tile is exposed
   A.sky(c, W, H, pal, t)                      gradient sky, sun or moon, soft clouds
   A.ridge(c, camX, o)                         a parallax mountain / mesa / hill layer with ink edge and texture bands
   A.trees(c, camX, o)                         a parallax forest silhouette layer
   A.glow(c, x, y, r, color, a)                additive light glow
   A.vignette(c, W, H, a)                      darkened corners for depth
   A.shadow(c, x, y, w)                        soft ground shadow under a character
   A.dust / A.stepFx / A.drawFx                little particle helpers
*/
(function () {
  'use strict';
  var A = {}, R = 4, T = 16, cache = {};
  function hash(x, y, s) { var h = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453; return h - Math.floor(h); }
  A.hash = hash;
  function rng(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; } return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
  A.shade = shade;
  var INK = 'rgba(20,12,8,.9)';

  // ---- palettes (games can pass their own) ----
  A.PAL = {
    rock: { base: '#6a6070', hi: '#8e8698', lo: '#463e4c', mortar: '#2a2430', grass: null },
    stone: { base: '#7a7a86', hi: '#a4a4b0', lo: '#50505c', mortar: '#2e2e38', grass: null },
    earth: { base: '#7a5236', hi: '#9a6a46', lo: '#55361f', mortar: '#3a2414', grass: '#4caa3a', grassHi: '#7ad65a', grassLo: '#2f7a26' },
    jungle: { base: '#5a4028', hi: '#7a5838', lo: '#3a2818', mortar: '#26180c', grass: '#3a9a3a', grassHi: '#6ad05a', grassLo: '#226a22' },
    desert: { base: '#c8884a', hi: '#e0a868', lo: '#9a6030', mortar: '#6a3a1a', grass: null, sand: true },
    snow: { base: '#8a9ab0', hi: '#b8c8da', lo: '#5a6a80', mortar: '#3a4658', grass: '#f4f8ff', grassHi: '#ffffff', grassLo: '#c8d8ec' },
    castle: { base: '#5a5a66', hi: '#7c7c8a', lo: '#3c3c46', mortar: '#1e1e26', grass: null, brick: true },
    cave: { base: '#4a3a3a', hi: '#6a5454', lo: '#2e2222', mortar: '#1a1010', grass: null },
    lavaRock: { base: '#4a2a22', hi: '#6a3a2a', lo: '#2a1612', mortar: '#140a08', grass: null, embers: true },
    metal: { base: '#5a6470', hi: '#8a96a4', lo: '#3a424c', mortar: '#1a2028', grass: null, metal: true },
    wood: { base: '#9a6a3a', hi: '#c08a52', lo: '#6a4422', mortar: '#3a2410', grass: null, wood: true },
  };

  // ---- painting one tile texture ----
  function paintTile(kind, edges, v, pal) {
    var cv = document.createElement('canvas'); cv.width = cv.height = T * R; var c = cv.getContext('2d'), S = T * R, r = rng(v * 131 + kind.length * 7 + 1);
    c.fillStyle = pal.mortar; c.fillRect(0, 0, S, S);
    if (pal.wood) { // planks
      for (var i = 0; i < 2; i++) { var y0 = i * S / 2; c.fillStyle = i ? pal.base : shade(pal.base, 0.05); c.fillRect(0, y0 + 2, S, S / 2 - 4); c.strokeStyle = shade(pal.base, -0.25); c.lineWidth = 2; for (var g = 0; g < 3; g++) { c.beginPath(); var gy = y0 + 8 + g * 8 + r() * 4; c.moveTo(0, gy); c.bezierCurveTo(S * 0.3, gy - 3, S * 0.6, gy + 3, S, gy); c.stroke(); } c.fillStyle = pal.hi; c.fillRect(0, y0 + 2, S, 3); c.fillStyle = '#2a1a0a'; c.beginPath(); c.arc(6 + r() * 4, y0 + S / 4, 2.5, 0, 7); c.arc(S - 8, y0 + S / 4, 2.5, 0, 7); c.fill(); }
    } else if (pal.metal) {
      c.fillStyle = pal.base; c.fillRect(2, 2, S - 4, S - 4); var gr = c.createLinearGradient(0, 0, S, S); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = gr; c.fillRect(2, 2, S - 4, S - 4);
      c.fillStyle = pal.lo; [[8, 8], [S - 8, 8], [8, S - 8], [S - 8, S - 8]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 3.5, 0, 7); c.fill(); c.fillStyle = pal.hi; c.beginPath(); c.arc(p[0] - 1, p[1] - 1, 1.5, 0, 7); c.fill(); c.fillStyle = pal.lo; });
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (var s2 = 0; s2 < 6; s2++) { c.beginPath(); c.moveTo(r() * S, 4); c.lineTo(r() * S, S - 4); c.stroke(); }
    } else if (pal.brick) {
      var bh = S / 4; for (var row = 0; row < 4; row++) { var off = row % 2 ? S / 4 : 0; for (var bx = -S / 2 + off; bx < S; bx += S / 2) { brick(c, bx + 2, row * bh + 2, S / 2 - 4, bh - 4, pal, r); } }
    } else if (pal.sand) {
      c.fillStyle = pal.base; c.fillRect(0, 0, S, S);
      for (var b = 0; b < 4; b++) { c.fillStyle = b % 2 ? pal.hi : pal.lo; c.globalAlpha = 0.35; c.fillRect(0, b * S / 4 + r() * 4, S, 5 + r() * 4); } c.globalAlpha = 1;
      for (var d = 0; d < 40; d++) { c.fillStyle = r() < 0.5 ? pal.lo : pal.hi; c.fillRect(r() * S, r() * S, 2, 2); }
    } else { // irregular stones / packed earth
      var cells = [[0, 0, 0.55, 0.5], [0.55, 0, 0.45, 0.5], [0, 0.5, 0.35, 0.5], [0.35, 0.5, 0.65, 0.5]];
      if (v % 2) cells = [[0, 0, 0.4, 0.45], [0.4, 0, 0.6, 0.45], [0, 0.45, 0.7, 0.55], [0.7, 0.45, 0.3, 0.55]];
      cells.forEach(function (q) { stone(c, q[0] * S + 2, q[1] * S + 2, q[2] * S - 4, q[3] * S - 4, pal, r); });
      if (pal.grass || kind === 'earth') { for (var p = 0; p < 4; p++) { var px = r() * S, py = r() * S; c.fillStyle = pal.lo; c.beginPath(); c.ellipse(px, py, 3 + r() * 3, 2 + r() * 2, 0, 0, 7); c.fill(); c.fillStyle = pal.hi; c.fillRect(px - 1, py - 2, 2, 1); } }
      if (pal.embers) { for (var e = 0; e < 3; e++) { c.fillStyle = 'rgba(255,' + (90 + r() * 80 | 0) + ',30,.8)'; c.fillRect(r() * S, r() * S, 2, 2); } }
    }
    // speckle texture over everything
    for (var k = 0; k < 26; k++) { c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.10)'; c.fillRect(r() * S, r() * S, 2, 2); }
    // exposed edges: ink line + light on top / shade below, and grass or snow caps
    c.fillStyle = INK;
    if (edges.l) { c.fillRect(0, 0, 4, S); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(4, 0, 3, S); c.fillStyle = INK; }
    if (edges.r) { c.fillRect(S - 4, 0, 4, S); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(S - 10, 0, 6, S); c.fillStyle = INK; }
    if (edges.b) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, S - 12, S, 8); c.fillStyle = INK; c.fillRect(0, S - 4, S, 4); }
    if (edges.t) {
      if (pal.grass) {
        c.fillStyle = pal.grassLo; c.fillRect(0, 0, S, 16); c.fillStyle = pal.grass; c.fillRect(0, 0, S, 11);
        for (var bl = 0; bl < 14; bl++) { var gx = bl * S / 13 + r() * 3, gl = 8 + r() * 12; c.fillStyle = r() < 0.5 ? pal.grass : pal.grassLo; c.beginPath(); c.moveTo(gx - 3, 12); c.lineTo(gx, 12 + gl); c.lineTo(gx + 3, 12); c.fill(); }
        c.fillStyle = pal.grassHi; c.fillRect(0, 2, S, 3); for (var bt = 0; bt < 8; bt++) { var tx = r() * S; c.beginPath(); c.moveTo(tx - 2, 3); c.lineTo(tx, -6); c.lineTo(tx + 2, 3); c.fill(); }
        c.fillStyle = INK; c.fillRect(0, 0, S, 3);
        if (r() < 0.35) { c.fillStyle = ['#ffe04a', '#ff6a8a', '#ffffff', '#8ac8ff'][(r() * 4) | 0]; var fx = 10 + r() * (S - 20); c.beginPath(); c.arc(fx, 4, 3, 0, 7); c.fill(); }
      } else { c.fillStyle = INK; c.fillRect(0, 0, S, 4); c.fillStyle = pal.hi; c.fillRect(0, 4, S, 4); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 4, S, 2); }
    }
    return cv;
  }
  function stone(c, x, y, w, h, pal, r) {
    var rad = Math.min(w, h) * 0.28; c.fillStyle = pal.base; rr(c, x, y, w, h, rad); c.fill();
    c.save(); rr(c, x, y, w, h, rad); c.clip();
    var g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = pal.hi; c.fillRect(x + 3, y + 2, w * 0.5, 3); if (r() < 0.6) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath(); var cx = x + w * (0.3 + r() * 0.4); c.moveTo(cx, y + h * 0.2); c.lineTo(cx + (r() - 0.5) * 10, y + h * 0.55); c.lineTo(cx + (r() - 0.5) * 8, y + h * 0.85); c.stroke(); }
    c.restore(); c.strokeStyle = 'rgba(15,8,5,.55)'; c.lineWidth = 2; rr(c, x, y, w, h, rad); c.stroke();
  }
  function brick(c, x, y, w, h, pal, r) { c.fillStyle = r() < 0.2 ? pal.lo : pal.base; c.fillRect(x, y, w, h); c.fillStyle = pal.hi; c.fillRect(x, y, w, 3); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, y + h - 3, w, 3); if (r() < 0.3) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + r() * w * 0.7, y + 4, 4, 3); } }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  A.tile = function (c, kind, x, y, edges, tx, ty, pal) {
    pal = pal || A.PAL[kind] || A.PAL.rock; var v = (hash(tx, ty, 3) * 4) | 0;
    var key = kind + (pal.base) + (edges.t ? 1 : 0) + (edges.b ? 2 : 0) + (edges.l ? 4 : 0) + (edges.r ? 8 : 0) + '_' + v;
    var cv = cache[key] || (cache[key] = paintTile(kind, edges, v, pal));
    c.drawImage(cv, x, y, T, T);
  };
  // edges helper for tile maps: solid(tx,ty) tells whether a neighbour is ground
  A.edges = function (solid, tx, ty) { return { t: !solid(tx, ty - 1), b: !solid(tx, ty + 1), l: !solid(tx - 1, ty), r: !solid(tx + 1, ty) }; };

  // ---- one-way ledge / bridge plank ----
  A.ledge = function (c, x, y, w, pal) {
    pal = pal || A.PAL.wood; c.fillStyle = pal.lo; c.fillRect(x, y, w, 6); c.fillStyle = pal.base; c.fillRect(x, y, w, 4); c.fillStyle = pal.hi; c.fillRect(x, y, w, 1.5);
    c.fillStyle = INK; c.fillRect(x, y - 0.5, w, 0.8); c.fillRect(x, y + 5.5, w, 0.8);
    for (var i = 0; i < w; i += 8) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + i, y, 0.8, 6); }
    c.fillStyle = pal.lo; c.fillRect(x + 3, y + 6, 1.5, 5); c.fillRect(x + w - 4.5, y + 6, 1.5, 5);
  };
  // ---- hazards ----
  A.lava = function (c, x, y, w, h, t) {
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffd23a'); g.addColorStop(0.25, '#ff7a1a'); g.addColorStop(1, '#a01a0a'); c.fillStyle = g; c.fillRect(x, y + 3, w, h - 3);
    c.fillStyle = '#ffec8a'; for (var i = 0; i < w; i += 4) { var wy = Math.sin(t / 300 + (x + i) / 9) * 1.5; c.fillRect(x + i, y + 2 + wy, 4, 2); }
    for (var b = 0; b < w / 12; b++) { var bx = x + ((b * 37 + t / 20) % w), by = y + 6 + ((b * 13) % (h - 8)), br = 1 + Math.abs(Math.sin(t / 400 + b)) * 2; c.fillStyle = 'rgba(255,240,140,.7)'; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill(); }
    A.glow(c, x + w / 2, y, w * 0.6, '255,120,30', 0.25);
  };
  A.spikes = function (c, x, y, w) { for (var i = 0; i < w; i += 4) { c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(x + i, y + 16); c.lineTo(x + i + 2, y + 5); c.lineTo(x + i + 4, y + 16); c.fill(); c.fillStyle = '#6a6e7a'; c.beginPath(); c.moveTo(x + i + 2, y + 5); c.lineTo(x + i + 4, y + 16); c.lineTo(x + i + 2.6, y + 16); c.fill(); c.fillStyle = '#fff'; c.fillRect(x + i + 1.6, y + 6, 0.8, 2); } c.fillStyle = INK; c.fillRect(x, y + 15, w, 1); };
  A.water = function (c, x, y, w, h, t) { var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(90,180,255,.85)'); g.addColorStop(1, 'rgba(20,60,140,.95)'); c.fillStyle = g; c.fillRect(x, y + 2, w, h - 2); c.fillStyle = 'rgba(255,255,255,.7)'; for (var i = 0; i < w; i += 6) c.fillRect(x + i, y + 2 + Math.sin(t / 250 + (x + i) / 7) * 1.2, 4, 1); c.fillStyle = 'rgba(255,255,255,.15)'; for (var j = 0; j < 4; j++) c.fillRect(x + ((j * 41 + t / 40) % w), y + 6 + j * 4, 10, 1); };

  // ---- backgrounds ----
  A.sky = function (c, W, H, pal, t) {
    pal = pal || {}; var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.top || '#3a6ac8'); g.addColorStop(0.6, pal.mid || '#8ac0f0'); g.addColorStop(1, pal.bottom || '#f8e0b0'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (pal.stars) for (var s = 0; s < 50; s++) { c.fillStyle = 'rgba(255,255,255,' + (0.3 + hash(s, 1) * 0.6) * (0.7 + 0.3 * Math.sin(t / 500 + s)) + ')'; c.fillRect(hash(s, 2) * W, hash(s, 3) * H * 0.6, 1, 1); }
    if (pal.sun) { var sx = pal.sunX || W * 0.75, sy = pal.sunY || H * 0.25; A.glow(c, sx, sy, 60, pal.sunGlow || '255,230,160', 0.35); c.fillStyle = pal.sun; c.beginPath(); c.arc(sx, sy, pal.sunR || 14, 0, 7); c.fill(); if (pal.moon) { c.save(); c.beginPath(); c.arc(sx, sy, (pal.sunR || 14) + 0.5, 0, 7); c.clip(); c.fillStyle = g; c.beginPath(); c.arc(sx + 5, sy - 3, (pal.sunR || 14) * 0.85, 0, 7); c.fill(); c.restore(); c.fillStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.arc(sx - 3, sy + 2, 2, 0, 7); c.arc(sx - 6, sy - 4, 1.4, 0, 7); c.fill(); } }
    if (pal.clouds !== false) for (var i = 0; i < 4; i++) { var cx = ((i * 97 + t / (60 + i * 20)) % (W + 120)) - 60, cy = 18 + i * 14 + hash(i, 9) * 20; cloud(c, cx, cy, 0.8 + hash(i, 4) * 0.6, pal.cloud || 'rgba(255,255,255,.85)'); }
  };
  function cloud(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 9 * s, 0, 7); c.arc(x + 10 * s, y - 5 * s, 11 * s, 0, 7); c.arc(x + 22 * s, y, 8 * s, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + 11 * s, y + 3 * s, 15 * s, 6 * s, 0, 0, 7); c.fill(); }
  // o: { factor, base, amp, col, edge, bands:[colors], seed, step, mesa }
  A.ridge = function (c, camX, o) {
    var W = o.W || (window.K ? K.W() : 320), H = o.H || (window.K ? K.H() : 240), f = o.factor || 0.3, step = o.step || 6, off = camX * f, pts = [];
    for (var x = -step; x <= W + step; x += step) { var wx = (x + off) / 40 + (o.seed || 0) * 10, h;
      if (o.mesa) { var m = Math.sin(wx * 0.55) + 0.5 * Math.sin(wx * 1.3 + 2); h = m > 0.3 ? 1 : m > 0 ? m / 0.3 : 0; h = h * 0.8 + 0.12 * Math.sin(wx * 3.1); }
      else h = 0.55 * Math.sin(wx * 0.9) + 0.3 * Math.sin(wx * 2.1 + 1) + 0.15 * Math.sin(wx * 5.3);
      pts.push([x - (off % step), o.base - h * o.amp]); }
    c.save(); c.beginPath(); c.moveTo(-10, H + 200); pts.forEach(function (p) { c.lineTo(p[0], p[1]); }); c.lineTo(W + 10, H + 200); c.closePath();
    c.fillStyle = o.col; c.fill(); c.clip();
    if (o.bands) o.bands.forEach(function (b, i) { c.fillStyle = b; for (var y = o.base - o.amp + i * 7; y < H; y += o.bands.length * 7 + 3) c.fillRect(-10, y + Math.sin(i) * 2, W + 20, 3); });
    var g = c.createLinearGradient(0, o.base - o.amp, 0, H); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, o.fog || 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-10, 0, W + 20, H);
    c.restore();
    c.strokeStyle = o.edge || 'rgba(0,0,0,.35)'; c.lineWidth = o.lw || 1; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
  };
  A.trees = function (c, camX, o) {
    var W = o.W || (window.K ? K.W() : 320), f = o.factor || 0.5, sp = o.spacing || 22, off = camX * f;
    for (var i = Math.floor(off / sp) - 1; i < Math.floor((off + W) / sp) + 2; i++) {
      var x = i * sp - off + hash(i, 5) * sp * 0.6, s = (o.size || 1) * (0.7 + hash(i, 6) * 0.6), y = o.base;
      if (o.kind === 'palm') { c.strokeStyle = o.col; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 4 * s, y - 14 * s, x + 2 * s, y - 26 * s); c.stroke(); c.fillStyle = o.col; for (var l = 0; l < 5; l++) { var a = -Math.PI / 2 + (l - 2) * 0.6; c.beginPath(); c.ellipse(x + 2 * s + Math.cos(a) * 8 * s, y - 26 * s + Math.sin(a) * 4 * s + 3, 9 * s, 2.5 * s, a, 0, 7); c.fill(); } }
      else if (o.kind === 'round') { c.fillStyle = o.trunk || o.col; c.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s); c.fillStyle = o.col; c.beginPath(); c.arc(x, y - 16 * s, 9 * s, 0, 7); c.arc(x - 6 * s, y - 11 * s, 6 * s, 0, 7); c.arc(x + 6 * s, y - 11 * s, 6 * s, 0, 7); c.fill(); if (o.hi) { c.fillStyle = o.hi; c.beginPath(); c.arc(x - 3 * s, y - 19 * s, 3.5 * s, 0, 7); c.fill(); } }
      else { c.fillStyle = o.col; c.beginPath(); c.moveTo(x, y - 30 * s); c.lineTo(x - 9 * s, y - 6 * s); c.lineTo(x + 9 * s, y - 6 * s); c.fill(); c.beginPath(); c.moveTo(x, y - 22 * s); c.lineTo(x - 11 * s, y + 2); c.lineTo(x + 11 * s, y + 2); c.fill(); if (o.hi) { c.fillStyle = o.hi; c.beginPath(); c.moveTo(x, y - 30 * s); c.lineTo(x - 4 * s, y - 18 * s); c.lineTo(x, y - 20 * s); c.fill(); } }
    }
    if (o.ground) { c.fillStyle = o.col; c.fillRect(0, o.base, W, 400); }
  };
  A.glow = function (c, x, y, r, rgb, a) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + (a == null ? 0.4 : a) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); };
  A.vignette = function (c, W, H, a) { var g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (a == null ? 0.45 : a) + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  A.shadow = function (c, x, y, w) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, w, w * 0.3, 0, 0, 7); c.fill(); };
  A.torch = function (c, x, y, t) { c.fillStyle = '#5a3a1a'; c.fillRect(x - 1, y, 2, 7); var f = Math.sin(t / 60) * 1.2 + Math.sin(t / 37); c.fillStyle = '#ff7a1a'; c.beginPath(); c.ellipse(x, y - 2, 2.6, 4 + f * 0.4, 0, 0, 7); c.fill(); c.fillStyle = '#ffe07a'; c.beginPath(); c.ellipse(x, y - 1, 1.3, 2.2, 0, 0, 7); c.fill(); A.glow(c, x, y - 2, 34 + f * 2, '255,150,60', 0.35); };
  // ambient floating motes / leaves / embers / snow
  A.ambient = function (c, W, H, t, kind, n) {
    n = n || 18; for (var i = 0; i < n; i++) { var sp = 8 + hash(i, 7) * 14, x = (hash(i, 8) * W + (kind === 'snow' ? Math.sin(t / 900 + i) * 12 : t / 1000 * sp * (kind === 'leaf' ? 1.5 : 0.4))) % W, y = (hash(i, 9) * H + t / 1000 * sp * (kind === 'ember' ? -1.2 : 1)) % H; if (y < 0) y += H;
      if (kind === 'ember') { c.fillStyle = 'rgba(255,' + (120 + i * 5 % 100) + ',40,' + (0.5 + 0.5 * Math.sin(t / 200 + i)) + ')'; c.fillRect(x, y, 1.5, 1.5); }
      else if (kind === 'leaf') { c.fillStyle = i % 2 ? 'rgba(120,200,80,.7)' : 'rgba(220,170,60,.7)'; c.save(); c.translate(x, y); c.rotate(t / 400 + i); c.fillRect(-1.5, -0.7, 3, 1.4); c.restore(); }
      else if (kind === 'snow') { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x, y, 1.5, 1.5); }
      else { c.fillStyle = 'rgba(255,255,220,' + (0.25 + 0.25 * Math.sin(t / 300 + i)) + ')'; c.fillRect(x, y, 1, 1); } }
  };
  // simple particle pool for dust puffs, sparks, splashes
  A.fx = [];
  A.dust = function (x, y, n, col) { for (var i = 0; i < (n || 6); i++) A.fx.push({ x: x, y: y, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 25, t: 0.4 + Math.random() * 0.3, r: 1.5 + Math.random() * 2, c: col || 'rgba(230,210,180,' }); };
  A.stepFx = function (dt) { A.fx.forEach(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.r += dt * 4; }); A.fx = A.fx.filter(function (p) { return p.t > 0; }); };
  A.drawFx = function (c, camX, camY) { A.fx.forEach(function (p) { c.fillStyle = p.c + Math.min(0.6, p.t) + ')'; c.beginPath(); c.arc(p.x - (camX || 0), p.y - (camY || 0), p.r, 0, 7); c.fill(); }); };
  // outlined, shaded body part helper for characters: fills a rect with a 1px ink outline and a light/dark split
  A.part = function (c, x, y, w, h, col) { c.fillStyle = INK; c.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2); c.fillStyle = col; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, y, w, Math.max(0.8, h * 0.25)); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, y + h * 0.7, w, h * 0.3); };
  A.ball = function (c, x, y, r, col) { c.fillStyle = INK; c.beginPath(); c.arc(x, y, r + 0.7, 0, 7); c.fill(); var g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.35)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
  // wrap a character-drawing function so whatever it draws gets a dark ink outline and a soft drop shadow
  A.ink = function (fn) { return function (c) { c.save(); try { c.filter = 'drop-shadow(0.6px 0 0 rgba(20,10,5,.95)) drop-shadow(-0.6px 0 0 rgba(20,10,5,.95)) drop-shadow(0 0.6px 0 rgba(20,10,5,.95)) drop-shadow(0 -0.6px 0 rgba(20,10,5,.95))'; } catch (e) { } var r = fn.apply(this, arguments); c.restore(); return r; }; };
  // a street / courtyard floor for belt brawlers: rows of textured tiles that scroll with the camera
  A.floor = function (c, camX, top, H, W, pal, sizes) {
    var rowH = 16, n = Math.ceil((H - top) / rowH);
    for (var r = 0; r < n; r++) { var y = top + r * rowH, sx = -(camX % 16);
      for (var x = sx - 16; x < W + 16; x += 16) { var tx = Math.floor((x + camX) / 16); A.tile(c, 'fl', x, y, { t: r === 0, b: false, l: false, r: false }, tx, r, pal); } }
    var g = c.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, top, W, H - top);
  };
  // building fronts: brick or stone walls with windows, doors, awnings and signs
  A.facades = function (c, camX, o) {
    var W = o.W || (window.K ? K.W() : 320), f = o.factor || 1, off = camX * f, bw = o.w || 80;
    for (var i = Math.floor(off / bw) - 1; i < Math.floor((off + W) / bw) + 2; i++) {
      var x = i * bw - off, h = o.h + Math.floor(hash(i, 1) * 3) * 12, top = o.base - h, col = o.cols[(Math.abs(i) * 7) % o.cols.length];
      c.fillStyle = INK; c.fillRect(x - 0.5, top - 0.5, bw + 1, h + 1);
      for (var yy = top; yy < o.base; yy += 8) for (var xx = 0; xx < bw; xx += 16) { var off2 = ((yy - top) / 8) % 2 ? 8 : 0; c.fillStyle = hash(i * 31 + xx, yy, 2) < 0.15 ? shade(col, -0.12) : col; c.fillRect(x + xx - off2 + 0.5, yy + 0.5, 15, 7); }
      c.fillStyle = 'rgba(0,0,0,.25)'; for (var yy2 = top; yy2 < o.base; yy2 += 8) c.fillRect(x, yy2, bw, 0.6);
      c.fillStyle = shade(col, -0.35); c.fillRect(x, top, bw, 4); c.fillStyle = shade(col, 0.2); c.fillRect(x, top + 4, bw, 1);
      for (var wy = top + 12; wy < o.base - 34; wy += 26) for (var wx = 10; wx < bw - 18; wx += 26) { var lit = hash(i, wx + wy, 4) < (o.lit || 0.4); c.fillStyle = INK; c.fillRect(x + wx - 1, wy - 1, 16, 18); c.fillStyle = lit ? '#ffd88a' : '#1a2030'; c.fillRect(x + wx, wy, 14, 16); if (lit) A.glow(c, x + wx + 7, wy + 8, 14, '255,200,110', 0.18); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + wx + 1, wy + 1, 4, 14); c.fillStyle = shade(col, -0.3); c.fillRect(x + wx - 2, wy + 16, 18, 2); }
      var dx = x + bw / 2 - 9; c.fillStyle = INK; c.fillRect(dx - 1, o.base - 29, 20, 29); c.fillStyle = o.door || '#3a2418'; c.fillRect(dx, o.base - 28, 18, 28); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(dx + 2, o.base - 26, 6, 10); c.fillRect(dx + 10, o.base - 26, 6, 10); c.fillStyle = '#e8c04a'; c.fillRect(dx + 14, o.base - 14, 2, 2);
      if (hash(i, 9) < 0.5) { var aw = o.awn[(Math.abs(i) * 3) % o.awn.length]; for (var s2 = 0; s2 < 5; s2++) { c.fillStyle = s2 % 2 ? '#f4f0e8' : aw; c.fillRect(dx - 12 + s2 * 8.4, o.base - 38, 8.4, 6); } c.fillStyle = INK; c.fillRect(dx - 12, o.base - 32, 42, 1); }
      if (o.signs && hash(i, 12) < 0.45) { var sc = o.signs[(Math.abs(i) * 5) % o.signs.length]; c.fillStyle = INK; c.fillRect(x + 8, top + 2, 22, 9); c.fillStyle = sc; c.fillRect(x + 9, top + 3, 20, 7); A.glow(c, x + 19, top + 6, 20, '255,120,180', 0.2); }
    }
  };
  A.skyline = function (c, camX, o) { var W = o.W || (window.K ? K.W() : 320), off = camX * (o.factor || 0.3); for (var i = Math.floor(off / 26) - 1; i < Math.floor((off + W) / 26) + 2; i++) { var x = i * 26 - off, h = 30 + hash(i, 1) * (o.amp || 70); c.fillStyle = o.col; c.fillRect(x, o.base - h, 24, h + 400); if (hash(i, 2) < 0.3) c.fillRect(x + 10, o.base - h - 10, 2, 10); c.fillStyle = o.win || 'rgba(255,220,140,.5)'; for (var k = 0; k < 10; k++) if (hash(i, k + 20) < 0.3) c.fillRect(x + 3 + (k % 3) * 7, o.base - h + 6 + Math.floor(k / 3) * 9, 3, 4); } };
  // ---------- top-down tiles (adventure / town games) ----------
  function td(key, v, painter) { var k = 'td' + key + '_' + v; if (!cache[k]) { var cv = document.createElement('canvas'); cv.width = cv.height = T * R; painter(cv.getContext('2d'), T * R, rng(v * 97 + key.length * 13 + 5)); cache[k] = cv; } return cache[k]; }
  A.grassTD = function (c, x, y, tx, ty, pal) {
    pal = pal || { base: '#6cbc4a', hi: '#8ad864', lo: '#4a9a34' }; var v = (hash(tx, ty, 7) * 6) | 0;
    c.drawImage(td('g' + pal.base, v, function (g, S, r) {
      g.fillStyle = pal.base; g.fillRect(0, 0, S, S);
      for (var i = 0; i < 5; i++) { g.fillStyle = r() < 0.5 ? pal.hi : pal.lo; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(r() * S, r() * S, 8 + r() * 10, 5 + r() * 6, r() * 3, 0, 7); g.fill(); } g.globalAlpha = 1;
      for (var b = 0; b < 16; b++) { var bx = r() * S, by = r() * S; g.strokeStyle = r() < 0.5 ? pal.lo : pal.hi; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by + 5); g.lineTo(bx + (r() - 0.5) * 4, by - 2); g.stroke(); }
      if (v === 1 || v === 4) { var cols = ['#ffffff', '#ffe04a', '#ff7aa8', '#8ac8ff']; for (var f = 0; f < 3; f++) { var fx = 8 + r() * (S - 16), fy = 8 + r() * (S - 16); g.fillStyle = cols[(r() * 4) | 0]; for (var pp = 0; pp < 4; pp++) { g.beginPath(); g.arc(fx + Math.cos(pp * 1.57) * 2.5, fy + Math.sin(pp * 1.57) * 2.5, 2, 0, 7); g.fill(); } g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(fx, fy, 1.6, 0, 7); g.fill(); } }
      if (v === 3) { g.fillStyle = '#8a8a7a'; g.beginPath(); g.ellipse(S * 0.7, S * 0.6, 4, 3, 0, 0, 7); g.fill(); g.fillStyle = '#b8b8a8'; g.fillRect(S * 0.7 - 2, S * 0.6 - 2, 2, 1); }
    }), x, y, T, T);
  };
  A.pathTD = function (c, x, y, tx, ty, pal) {
    pal = pal || { base: '#c8a06a', hi: '#e0bc88', lo: '#9a7444' }; var v = (hash(tx, ty, 8) * 4) | 0;
    c.drawImage(td('p' + pal.base, v, function (g, S, r) { g.fillStyle = pal.base; g.fillRect(0, 0, S, S); for (var i = 0; i < 18; i++) { g.fillStyle = r() < 0.5 ? pal.lo : pal.hi; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 3, 1.5 + r() * 2, 0, 0, 7); g.fill(); } for (var j = 0; j < 30; j++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(r() * S, r() * S, 2, 2); } }), x, y, T, T);
  };
  A.treeTD = function (c, x, y, tx, ty, pal) {
    pal = pal || { leaf: '#2f8a34', hi: '#5ab84a', lo: '#1e5a24', trunk: '#6a3a1a' }; var v = (hash(tx, ty, 9) * 3) | 0;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 9, y + 13, 7, 3.5, 0, 0, 7); c.fill();
    c.drawImage(td('t' + pal.leaf, v, function (g, S, r) { var cx = S / 2, cy = S * 0.44, rad = S * 0.42;
      g.fillStyle = pal.trunk; g.fillRect(cx - 5, S * 0.7, 10, S * 0.28); g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, rad + 2.5, 0, 7); g.fill();
      g.fillStyle = pal.lo; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill();
      for (var i = 0; i < 6; i++) { var a = r() * 6.28, d = r() * rad * 0.5; g.fillStyle = pal.leaf; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d - 3, rad * (0.45 + r() * 0.2), 0, 7); g.fill(); }
      for (var j = 0; j < 5; j++) { g.fillStyle = pal.hi; g.beginPath(); g.arc(cx - rad * 0.35 + r() * rad * 0.5, cy - rad * 0.45 + r() * rad * 0.4, 3 + r() * 4, 0, 7); g.fill(); }
      if (v === 2) { g.fillStyle = '#e83a3a'; for (var k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + (r() - 0.5) * rad, cy + (r() - 0.5) * rad, 2.5, 0, 7); g.fill(); } } }), x, y, T, T);
  };
  A.bushTD = function (c, x, y, tx, ty, pal) {
    pal = pal || { leaf: '#3aa84a', hi: '#6ad06a', lo: '#227a2e' };
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x + 8, y + 13, 7, 3, 0, 0, 7); c.fill();
    c.drawImage(td('b' + pal.leaf, 0, function (g, S, r) { g.fillStyle = INK; [[0.32, 0.6], [0.68, 0.6], [0.5, 0.36]].forEach(function (p) { g.beginPath(); g.arc(p[0] * S, p[1] * S, S * 0.27, 0, 7); g.fill(); }); [[0.32, 0.6], [0.68, 0.6], [0.5, 0.36]].forEach(function (p) { g.fillStyle = pal.lo; g.beginPath(); g.arc(p[0] * S, p[1] * S, S * 0.24, 0, 7); g.fill(); g.fillStyle = pal.leaf; g.beginPath(); g.arc(p[0] * S - 2, p[1] * S - 3, S * 0.18, 0, 7); g.fill(); g.fillStyle = pal.hi; g.beginPath(); g.arc(p[0] * S - 5, p[1] * S - 6, S * 0.07, 0, 7); g.fill(); }); }), x, y, T, T);
  };
  A.rockTD = function (c, x, y, tx, ty, pal) {
    pal = pal || { base: '#9a8e80', hi: '#c0b4a6', lo: '#6a5e52' }; var v = (hash(tx, ty, 10) * 3) | 0;
    c.drawImage(td('r' + pal.base, v, function (g, S, r) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(S / 2 + 3, S * 0.7, S * 0.45, S * 0.22, 0, 0, 7); g.fill();
      var pts = []; for (var i = 0; i < 8; i++) { var a = i / 8 * 6.28, d = S * (0.38 + r() * 0.1); pts.push([S / 2 + Math.cos(a) * d, S * 0.5 + Math.sin(a) * d * 0.85]); }
      g.fillStyle = INK; g.beginPath(); pts.forEach(function (p, i) { var q = [S / 2 + (p[0] - S / 2) * 1.08, S / 2 + (p[1] - S / 2) * 1.08]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.fill();
      var gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, pal.hi); gr.addColorStop(0.5, pal.base); gr.addColorStop(1, pal.lo); g.fillStyle = gr; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(S * 0.4, S * 0.3); g.lineTo(S * 0.5, S * 0.5); g.lineTo(S * 0.45, S * 0.7); g.stroke(); g.fillStyle = '#5a8a3a'; g.fillRect(S * 0.2, S * 0.62, 6, 3); }), x, y, T, T);
  };
  // water with animated ripples and a foam edge on any side that touches land (land(tx,ty) tells whether a neighbour is land)
  A.waterTD = function (c, x, y, tx, ty, t, land, pal) {
    pal = pal || { deep: '#1e5ab8', mid: '#2e7ad8', hi: '#8ad0ff' };
    var g = c.createLinearGradient(x, y, x + T, y + T); g.addColorStop(0, pal.mid); g.addColorStop(1, pal.deep); c.fillStyle = g; c.fillRect(x, y, T, T);
    c.fillStyle = 'rgba(255,255,255,.35)'; var ph = t / 500 + tx * 0.9 + ty * 0.6; c.fillRect(x + 2 + (Math.sin(ph) + 1) * 3, y + 4, 4, 0.8); c.fillRect(x + 7 + (Math.cos(ph * 0.8) + 1) * 2, y + 10, 5, 0.8);
    if (!land) return; var foam = 'rgba(240,250,255,' + (0.7 + 0.2 * Math.sin(t / 300 + tx)) + ')';
    c.fillStyle = foam; if (land(tx, ty - 1)) c.fillRect(x, y, T, 2); if (land(tx, ty + 1)) c.fillRect(x, y + T - 2, T, 2); if (land(tx - 1, ty)) c.fillRect(x, y, 2, T); if (land(tx + 1, ty)) c.fillRect(x + T - 2, y, 2, T);
    c.fillStyle = 'rgba(20,40,80,.35)'; if (land(tx, ty - 1)) c.fillRect(x, y + 2, T, 1.5);
  };
  A.wallTD = function (c, x, y, tx, ty, pal, topExposed) {
    pal = pal || A.PAL.stone; A.tile(c, 'wtd', x, y, { t: !!topExposed, b: false, l: false, r: false }, tx, ty, pal);
  };
  // ---------- textures for the 3D games (three.js) ----------
  A.tex3 = function (THREE, kind, base, rep) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d'), r = rng(kind.length * 31 + (base | 0) % 997);
    var hex = '#' + ('000000' + (base >>> 0).toString(16)).slice(-6); g.fillStyle = hex; g.fillRect(0, 0, 256, 256);
    if (kind === 'fields') { var cols = [shade(hex, 0.12), shade(hex, -0.12), '#c8b04a', shade(hex, 0.25), '#8aa040', shade(hex, -0.2)]; for (var y = 0; y < 256; y += 64) for (var x = 0; x < 256; x += 64) { var fc = cols[(r() * cols.length) | 0]; g.fillStyle = fc; g.fillRect(x + 2, y + 2, 60, 60); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; var vert = r() < 0.5; for (var k = 4; k < 60; k += 5) { g.beginPath(); if (vert) { g.moveTo(x + 2 + k, y + 2); g.lineTo(x + 2 + k, y + 62); } else { g.moveTo(x + 2, y + 2 + k); g.lineTo(x + 62, y + 2 + k); } g.stroke(); } g.fillStyle = '#2e5a24'; g.fillRect(x, y, 64, 2); g.fillRect(x, y, 2, 64); for (var t2 = 0; t2 < 3; t2++) { g.fillStyle = '#2a5a22'; g.beginPath(); g.arc(x + r() * 64, y + 1, 3 + r() * 2, 0, 7); g.fill(); } } }
    else if (kind === 'asphalt') { for (var i = 0; i < 3000; i++) { var v = r(); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.1)'; g.fillRect(r() * 256, r() * 256, 1 + (r() < 0.1), 1); } }
    else if (kind === 'sand') { for (var j = 0; j < 2500; j++) { g.fillStyle = r() < 0.5 ? 'rgba(120,80,30,.18)' : 'rgba(255,255,255,.15)'; g.fillRect(r() * 256, r() * 256, 1.5, 1.5); } for (var w2 = 0; w2 < 8; w2++) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.beginPath(); var yy = r() * 256; g.moveTo(0, yy); g.bezierCurveTo(80, yy - 10, 170, yy + 10, 256, yy); g.stroke(); } }
    else { // grass
      for (var p = 0; p < 30; p++) { g.fillStyle = r() < 0.5 ? shade(hex, 0.12) : shade(hex, -0.12); g.globalAlpha = 0.4; g.beginPath(); g.ellipse(r() * 256, r() * 256, 20 + r() * 30, 12 + r() * 20, r() * 3, 0, 7); g.fill(); } g.globalAlpha = 1;
      for (var b2 = 0; b2 < 1600; b2++) { var bx = r() * 256, by = r() * 256; g.strokeStyle = r() < 0.5 ? shade(hex, -0.25) : shade(hex, 0.25); g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by + 3); g.lineTo(bx + (r() - 0.5) * 2, by - 2); g.stroke(); }
      for (var f2 = 0; f2 < 40; f2++) { g.fillStyle = ['#ffffff', '#ffe04a', '#ff7aa8'][(r() * 3) | 0]; g.fillRect(r() * 256, r() * 256, 2, 2); } }
    var tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep || 20, rep || 20); if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  A.skyTex = function (THREE, top, bottom, sun) {
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 256; var g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(0.55, bottom); gr.addColorStop(1, shade(bottom, 0.3)); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    var tx = new THREE.CanvasTexture(cv); if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  A.INK = INK;
  window.A = A;
})();
