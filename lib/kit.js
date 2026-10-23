/* Pocket Arcade game kit.
   Gives every new game the same parts: a sharp scaled screen, keyboard + on-screen pad,
   simple sound, title / game-over card, HUD strip and saved best scores. */
(function () {
  'use strict';
  var K = {};
  var css =
    'html,body{height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--ink);font-family:Rubik,system-ui,sans-serif;' +
    'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
    'body{display:flex;flex-direction:column;padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0);box-sizing:border-box}' +
    '#kh{flex:none;display:flex;justify-content:space-between;gap:10px;padding:8px 16px 6px 16px;padding-top:max(8px,calc(env(safe-area-inset-top,0px) + 34px));font-family:Bungee,Impact,system-ui,sans-serif;font-size:clamp(13px,3.8vw,18px);font-variant-numeric:tabular-nums;min-height:22px}' +
    '#kh:empty{display:none}#kh span{white-space:nowrap}' +
    '#ks{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}' +
    '#ks canvas{display:block;image-rendering:pixelated;border-radius:6px}' +
    '#ko{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:16px;background:rgba(0,0,0,.72);color:#fff;z-index:3}' +
    '#ko[hidden]{display:none}' +
    '#ko h1{margin:0;font-family:Bungee,Impact,system-ui,sans-serif;font-weight:400;font-size:clamp(34px,11vw,72px);line-height:1;color:var(--accent);text-shadow:0 4px 0 rgba(0,0,0,.45)}' +
    '#ko p{margin:0;max-width:34ch;line-height:1.5}#ko .best{font-family:Bungee,Impact,sans-serif;color:var(--accent);min-height:1em}' +
    '#ko button{font-family:Bungee,Impact,system-ui,sans-serif;font-size:20px;padding:12px 32px;min-height:48px;border:0;border-radius:999px;background:var(--accent);color:var(--accentInk);box-shadow:0 5px 0 rgba(0,0,0,.35);cursor:pointer}' +
    '#ko button:active{transform:translateY(3px)}#ko button:focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '#kp{flex:none;display:none;justify-content:space-between;align-items:center;gap:12px;padding:10px 18px 14px}' +
    'body.touch #kp{display:flex}body.touch #kp:empty{display:none}' +
    // phone on its side: the game fills the full height in the middle, the joystick sits in the left margin,
    // the buttons and the score sit in the right margin, so nothing covers the game
    'body.touch.land #ks{margin:0 158px;margin-left:max(158px,calc(env(safe-area-inset-left,0px) + 150px));margin-right:max(158px,calc(env(safe-area-inset-right,0px) + 150px))}' +
    'body.touch.land #kh{position:absolute;top:0;right:0;width:150px;box-sizing:border-box;flex-direction:column;align-items:flex-end;gap:4px;padding:max(10px,env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 0 0;z-index:2;pointer-events:none}' +
    'body.touch.land #kp{position:absolute;left:0;right:0;bottom:0;align-items:flex-end;padding:0 max(12px,env(safe-area-inset-right,0px)) max(14px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));pointer-events:none;z-index:2}' +
    'body.touch.land #kp>*{pointer-events:auto}body.touch.land .kb{flex-direction:column-reverse;gap:10px;width:150px;align-items:center}' +
    '.kd{display:grid;grid-template-columns:repeat(3,54px);grid-template-rows:repeat(3,54px);gap:4px}' +
    '.kd.lr{grid-template-rows:54px}.kd.ud{grid-template-columns:54px}' +
    '.kb{display:flex;gap:12px;align-items:center}' +
    '#kp button{border:0;border-radius:14px;background:rgba(255,255,255,.14);color:var(--ink);font-family:Bungee,Impact,sans-serif;font-size:20px;padding:0;touch-action:none;box-shadow:0 4px 0 rgba(0,0,0,.35)}' +
    '#kp button.on{background:var(--accent);color:var(--accentInk);transform:translateY(2px)}' +
    '#kp .big{width:76px;height:76px;border-radius:50%;font-size:14px}' +
    '.kj{position:relative;width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);touch-action:none;box-shadow:0 5px 0 rgba(0,0,0,.35)}' +
    '.kj i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#c8c8d8 45%,#7a7a90);box-shadow:0 4px 8px rgba(0,0,0,.5);pointer-events:none}';

  var theme = { bg: '#101018', ink: '#f4f2ff', accent: '#ffb02e', accentInk: '#1a1200' };
  K.theme = function (t) { for (var k in t) theme[k] = t[k]; apply(); };
  function apply() {
    var r = document.documentElement.style;
    r.setProperty('--bg', theme.bg); r.setProperty('--ink', theme.ink);
    r.setProperty('--accent', theme.accent); r.setProperty('--accentInk', theme.accentInk);
  }

  // ---------- page parts ----------
  var hud, stage, overlay, pad, cv, ctx;
  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    if (!document.querySelector('link[href*="Bungee"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Bungee&family=Rubik:wght@400;600&display=swap';
      document.head.appendChild(l);
    }
    hud = el('div', 'kh'); stage = el('div', 'ks'); pad = el('div', 'kp');
    cv = document.createElement('canvas'); stage.appendChild(cv);
    overlay = el('div', 'ko'); overlay.hidden = true; stage.appendChild(overlay);
    document.body.appendChild(hud); document.body.appendChild(stage); document.body.appendChild(pad);
    ctx = cv.getContext('2d');
    apply();
    if (window.matchMedia && matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
    addEventListener('touchstart', function () { document.body.classList.add('touch'); fit(); }, { passive: true, once: true });
  }
  function el(tag, id) { var e = document.createElement(tag); e.id = id; return e; }

  // ---------- screen: fixed logical size, scaled to fit ----------
  var LW = 320, LH = 240, SC = 1, pixel = true;
  K.screen = function (w, h, opts) {
    LW = w; LH = h; pixel = !(opts && opts.smooth);
    fit(); addEventListener('resize', fit);
    return ctx;
  };
  function fit() {
    if (!cv) return;
    document.body.classList.toggle('land', innerWidth > innerHeight * 1.15);
    var r = stage.getBoundingClientRect();
    var aw = Math.max(50, r.width - 8), ah = Math.max(50, r.height - 8);
    SC = Math.min(aw / LW, ah / LH);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = Math.floor(LW * SC) + 'px'; cv.style.height = Math.floor(LH * SC) + 'px';
    cv.width = Math.floor(LW * SC * dpr); cv.height = Math.floor(LH * SC * dpr);
    ctx.setTransform(SC * dpr, 0, 0, SC * dpr, 0, 0);
    ctx.imageSmoothingEnabled = !pixel;
  }
  K.W = function () { return LW; }; K.H = function () { return LH; };

  // ---------- input ----------
  var down = {}, hit = {}, MAP = {
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 's_down', S: 's_down',
    ' ': 'a', z: 'a', Z: 'a', j: 'a', J: 'a', x: 'b', X: 'b', k: 'b', K: 'b', Shift: 'b', Enter: 'start'
  };
  function press(n) { if (!down[n]) hit[n] = true; down[n] = true; unlock(); }
  function release(n) { down[n] = false; }
  addEventListener('keydown', function (e) {
    var n = MAP[e.key]; if (n === 's_down') n = 'down'; if (!n) return;
    if (n !== 'start') e.preventDefault();
    if (n === 'start' || n === 'a') { if (!overlay.hidden && startFn) { startFn(); return; } }
    press(n);
  });
  addEventListener('keyup', function (e) { var n = MAP[e.key]; if (n === 's_down') n = 'down'; if (n) release(n); });
  addEventListener('blur', function () { down = {}; });
  K.down = function (n) { return !!down[n]; };
  K.hit = function (n) { return !!hit[n]; };
  K.press = press; K.release = release;

  // pointer on the screen, in logical coordinates
  var ptr = { down: false, x: 0, y: 0, tapped: false };
  K.ptr = ptr;
  function toLogical(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * LH }; }
  function bindPtr() {
    cv.addEventListener('pointerdown', function (e) { var p = toLogical(e); ptr.down = true; ptr.x = p.x; ptr.y = p.y; ptr.tapped = true; ptr.sx = p.x; ptr.sy = p.y; unlock(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    cv.addEventListener('pointermove', function (e) { var p = toLogical(e); ptr.x = p.x; ptr.y = p.y; });
    ['pointerup', 'pointercancel'].forEach(function (t) { cv.addEventListener(t, function () { ptr.down = false; }); });
  }

  // on-screen pad. dpad: '4' | 'lr' | 'ud' | 'none'; buttons: [{id:'a',label:'FIRE'}]
  K.pad = function (o) {
    pad.innerHTML = '';
    var left = document.createElement('div');
    var dp = o.dpad || '4';
    if (dp === '4' || dp === 'lr' || dp === 'ud') { left = joystick(dp); }
    else if (dp !== 'none') {
      left.className = 'kd' + (dp === 'lr' ? ' lr' : dp === 'ud' ? ' ud' : '');
      var cells = dp === 'lr' ? [['left', '◀', 1, 1], ['right', '▶', 3, 1]]
        : dp === 'ud' ? [['up', '▲', 1, 1], ['down', '▼', 1, 3]]
        : [['up', '▲', 2, 1], ['left', '◀', 1, 2], ['right', '▶', 3, 2], ['down', '▼', 2, 3]];
      if (dp === 'lr') left.style.gridTemplateColumns = '64px 8px 64px';
      cells.forEach(function (c) { var b = btn(c[0], c[1]); b.style.gridColumn = c[2]; b.style.gridRow = c[3]; if (dp === 'lr') { b.style.width = '64px'; b.style.height = '64px'; } left.appendChild(b); });
    }
    var right = document.createElement('div'); right.className = 'kb';
    (o.buttons || []).forEach(function (bd) { var b = btn(bd.id, bd.label); b.className = 'big'; right.appendChild(b); });
    pad.appendChild(left); pad.appendChild(right);
    fit();
  };
  // analog-feel joystick: pushes the same left/right/up/down the arrow keys do, diagonals included
  K.stick = { x: 0, y: 0 };
  function joystick(ax) {
    var base = document.createElement('div'); base.className = 'kj'; base.setAttribute('aria-label', 'joystick');
    var knob = document.createElement('i'); base.appendChild(knob);
    var pid = null, held = {};
    function set(d, on) { if (!!held[d] === on) return; held[d] = on; if (on) press(d); else release(d); }
    function move(e) {
      var r = base.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); if (ax === 'lr') dy = 0; if (ax === 'ud') dx = 0;
      var max = r.width / 2 - 20, m = Math.hypot(dx, dy); if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var nx = dx / max, ny = dy / max, T = 0.38; K.stick.x = nx; K.stick.y = ny;
      set('left', nx < -T); set('right', nx > T); set('up', ny < -T); set('down', ny > T);
    }
    function end() { pid = null; knob.style.transform = ''; K.stick.x = 0; K.stick.y = 0; ['left', 'right', 'up', 'down'].forEach(function (d) { set(d, false); }); }
    base.addEventListener('pointerdown', function (e) { e.preventDefault(); pid = e.pointerId; unlock(); try { base.setPointerCapture(pid); } catch (_) {} move(e); });
    base.addEventListener('pointermove', function (e) { if (e.pointerId === pid) move(e); });
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
    base.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return base;
  }
  function btn(name, label) {
    var b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-label', name);
    var on = function (e) { e.preventDefault(); b.classList.add('on'); press(name); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
    var off = function () { b.classList.remove('on'); release(name); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return b;
  }

  // ---------- sound ----------
  var AC = null;
  function unlock() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
  K.beep = function (f, d, o) {
    if (!AC) return; o = o || {};
    var t = AC.currentTime + (o.at || 0), osc = AC.createOscillator(), g = AC.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
    g.gain.setValueAtTime(o.vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g).connect(AC.destination); osc.start(t); osc.stop(t + d + 0.02);
  };
  K.noise = function (d, vol) {
    if (!AC) return; var n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0);
    for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = vol || 0.3; s.buffer = b; s.connect(g).connect(AC.destination); s.start();
  };
  K.tune = function (notes, step, o) { notes.forEach(function (f, i) { if (f) K.beep(f, step * 0.9, Object.assign({ at: i * step }, o || {})); }); };

  // ---------- HUD ----------
  K.hud = function (ids) { hud.innerHTML = ''; ids.forEach(function (id) { var s = document.createElement('span'); s.id = 'h_' + id; hud.appendChild(s); }); fit(); };
  K.set = function (id, txt) { var e = document.getElementById('h_' + id); if (e && e.textContent !== String(txt)) e.textContent = txt; };

  // ---------- best scores ----------
  K.best = function (key) { try { return +localStorage.getItem('pa-' + key) || 0; } catch (e) { return 0; } };
  K.saveBest = function (key, v, lowerIsBetter) {
    var b = K.best(key), better = !b || (lowerIsBetter ? v < b : v > b);
    if (better) { try { localStorage.setItem('pa-' + key, v); } catch (e) {} return v; }
    return b;
  };

  // ---------- title / game over card ----------
  var startFn = null;
  K.card = function (o) {
    overlay.innerHTML = '';
    var h = document.createElement('h1'); h.textContent = o.title; overlay.appendChild(h);
    if (o.text) { var p = document.createElement('p'); p.textContent = o.text; overlay.appendChild(p); }
    var b = document.createElement('div'); b.className = 'best'; b.textContent = o.best || ''; overlay.appendChild(b);
    var go = document.createElement('button'); go.textContent = o.button || 'Play'; overlay.appendChild(go);
    startFn = function () { overlay.hidden = true; startFn = null; down = {}; hit = {}; unlock(); o.onStart(); };
    go.onclick = function () { startFn && startFn(); };
    overlay.hidden = false;
  };
  K.cardOpen = function () { return !overlay.hidden; };

  // ---------- loop ----------
  K.run = function (update, draw) {
    var last = performance.now();
    function frame(t) {
      var dt = Math.min(0.034, (t - last) / 1000); last = t;
      update(dt);
      hit = {}; ptr.tapped = false;
      ctx.save(); draw(ctx, t); ctx.restore();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // ---------- small helpers ----------
  K.rnd = function (a, b) { return a + Math.random() * (b - a); };
  K.ri = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.hitRect = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
  K.text = function (c, s, x, y, size, color, align) {
    c.font = size + 'px Bungee, Impact, sans-serif'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillText(s, x + 1, y + 1); c.fillStyle = color || '#fff'; c.fillText(s, x, y);
  };

  // the kit script sits at the top of <body>, so the body already exists
  if (document.body) { build(); bindPtr(); }
  else document.addEventListener('DOMContentLoaded', function () { build(); bindPtr(); });
  window.K = K;
})();
