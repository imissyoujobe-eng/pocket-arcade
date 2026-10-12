/* Top-down adventure engine shared by the adventure games.
   Flip-screen tile worlds, 4-way movement with sliding collisions, screen-scroll transitions,
   dialog boxes, hearts and simple sword hit boxes. Uses the K kit for input and sound. */
(function () {
  'use strict';
  var D = { T: 16, SW: 16, SH: 12 };
  D.SOLID = '#TWRBLX';   // tree, wall, water, rock, bush(cuttable), locked door, etc. (games can change this)

  // world from rows of chars; screens are SW x SH tiles
  D.world = function (rows) {
    var w = { rows: rows.length, cols: rows[0].length, g: rows.map(function (r) { return r.split(''); }) };
    w.scx = Math.floor(w.cols / D.SW); w.scy = Math.floor(w.rows / D.SH);
    return w;
  };
  D.tile = function (w, x, y) { var tx = Math.floor(x / D.T), ty = Math.floor(y / D.T); if (tx < 0 || ty < 0 || tx >= w.cols || ty >= w.rows) return '#'; return w.g[ty][tx]; };
  D.set = function (w, tx, ty, ch) { if (tx >= 0 && ty >= 0 && tx < w.cols && ty < w.rows) w.g[ty][tx] = ch; };
  D.isSolid = function (ch) { return D.SOLID.indexOf(ch) >= 0; };
  function blocked(w, x, y, bw, bh, solidFn) {
    var f = solidFn || D.isSolid;
    var x0 = Math.floor(x / D.T), x1 = Math.floor((x + bw - 0.01) / D.T), y0 = Math.floor(y / D.T), y1 = Math.floor((y + bh - 0.01) / D.T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) { if (tx < 0 || ty < 0 || tx >= w.cols || ty >= w.rows) return true; if (f(w.g[ty][tx], tx, ty)) return true; }
    return false;
  }
  D.blocked = blocked;
  // move a body {x,y,w,h} by dx,dy with sliding and gentle corner nudging
  D.move = function (w, b, dx, dy, solidFn) {
    var hit = false;
    if (dx) { if (!blocked(w, b.x + dx, b.y, b.w, b.h, solidFn)) b.x += dx; else { hit = true; for (var n = 1; n <= 5; n++) { if (!blocked(w, b.x + dx, b.y - n, b.w, b.h, solidFn) && !blocked(w, b.x, b.y - n, b.w, b.h, solidFn)) { b.y -= Math.min(n, 1); break; } if (!blocked(w, b.x + dx, b.y + n, b.w, b.h, solidFn) && !blocked(w, b.x, b.y + n, b.w, b.h, solidFn)) { b.y += Math.min(n, 1); break; } } } }
    if (dy) { if (!blocked(w, b.x, b.y + dy, b.w, b.h, solidFn)) b.y += dy; else { hit = true; for (var m = 1; m <= 5; m++) { if (!blocked(w, b.x - m, b.y + dy, b.w, b.h, solidFn) && !blocked(w, b.x - m, b.y, b.w, b.h, solidFn)) { b.x -= Math.min(m, 1); break; } if (!blocked(w, b.x + m, b.y + dy, b.w, b.h, solidFn) && !blocked(w, b.x + m, b.y, b.w, b.h, solidFn)) { b.x += Math.min(m, 1); break; } } } }
    return hit;
  };
  // 4-way input; returns [dx,dy] unit and remembers facing on the body. Touch: drag on the screen to walk.
  D.input = function (b) {
    var dx = (K.down('right') ? 1 : 0) - (K.down('left') ? 1 : 0), dy = (K.down('down') ? 1 : 0) - (K.down('up') ? 1 : 0);
    if (dx && dy) { if (b.lastAxis === 'x') dx = 0; else dy = 0; } else if (dx) b.lastAxis = 'y'; else if (dy) b.lastAxis = 'x';
    if (dx) b.face = dx > 0 ? 'r' : 'l'; else if (dy) b.face = dy > 0 ? 'd' : 'u';
    return [dx, dy];
  };
  D.faceVec = function (f) { return f === 'r' ? [1, 0] : f === 'l' ? [-1, 0] : f === 'u' ? [0, -1] : [0, 1]; };
  // sword sweep box in front of a body
  D.swordBox = function (b, reach) { reach = reach || 14; var v = D.faceVec(b.face); return { x: b.x + b.w / 2 + v[0] * (reach - 2) - (v[0] ? reach / 2 : 7), y: b.y + b.h / 2 + v[1] * (reach - 2) - (v[1] ? reach / 2 : 7), w: v[0] ? reach : 14, h: v[1] ? reach : 14 }; };
  D.overlap = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };

  // which screen a point is on, and screen-change detection with a sliding transition
  D.screenOf = function (x, y) { return { sx: Math.floor(x / (D.SW * D.T)), sy: Math.floor(y / (D.SH * D.T)) }; };
  D.camFor = function (s) { return { x: s.sx * D.SW * D.T, y: s.sy * D.SH * D.T }; };

  // draw helpers
  D.heart = function (c, x, y, fill) { c.fillStyle = fill >= 1 ? '#ff3b5c' : fill > 0 ? '#ff9aa8' : '#3a2a30'; c.beginPath(); c.moveTo(x + 4, y + 7); c.lineTo(x, y + 3); c.arc(x + 2, y + 2, 2, Math.PI, 0); c.arc(x + 6, y + 2, 2, Math.PI, 0); c.lineTo(x + 4, y + 7); c.fill(); };
  D.hearts = function (c, x, y, hp, max) { for (var i = 0; i < max; i++) D.heart(c, x + (i % 10) * 9, y + Math.floor(i / 10) * 9, Math.max(0, Math.min(1, hp - i))); };
  D.dialog = function (c, text, VW, VH, who) {
    var h = 58; c.fillStyle = 'rgba(10,8,20,.92)'; c.fillRect(6, VH - h - 6, VW - 12, h); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(6.5, VH - h - 5.5, VW - 13, h - 1);
    c.font = '9px Rubik, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = '#ffd23f';
    var y = VH - h + 8; if (who) { c.fillText(who, 14, y); y += 12; }
    c.fillStyle = '#fff'; var line = '', words = text.split(' ');
    for (var i = 0; i < words.length; i++) { var t = line ? line + ' ' + words[i] : words[i]; if (c.measureText(t).width > VW - 32) { c.fillText(line, 14, y); y += 11; line = words[i]; } else line = t; }
    c.fillText(line, 14, y);
    if (Math.floor(performance.now() / 400) % 2) { c.fillStyle = '#ffd23f'; c.fillText('▼', VW - 20, VH - 12); }
  };
  window.D = D;
})();
