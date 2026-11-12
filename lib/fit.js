/* Fit: sharp, full-screen play for the older one-screen games (the ones with a #stage and a fixed-size canvas).
   - The picture is drawn at the phone's real pixel density, so lines and text are crisp instead of blurry.
   - With the phone on its side the score floats on top of the game and the game fills the screen height.
   - data-wide="1": with the phone on its side the playfield itself gets wider (the game sees a bigger W),
     so the game runs edge to edge. Only for games whose play still works with a wider field.
   Load it right after the game's <canvas> and before the game's own script, so the game reads the new size:
     <script src="../lib/fit.js" data-canvas="#c" data-wide="1" data-max="2.2"></script>
   If the phone is turned while no game is being played, the page reloads into the new shape. */
(function () {
  'use strict';
  var me = document.currentScript, ds = me.dataset;
  var cv = document.querySelector(ds.canvas || '#c'); if (!cv) return;
  var BW = cv.width, BH = cv.height, root = document.documentElement;
  function isLand() { return innerWidth > innerHeight * 1.15; }
  var land = isLand(), wide = ds.wide === '1' && land;
  var LW = BW, LH = BH;
  if (wide) {
    var a = Math.min(+(ds.max || 2.3), Math.max(BW / BH, innerWidth / Math.max(1, innerHeight)));
    LW = Math.round(BH * a / 2) * 2;
  }
  cv.width = LW; cv.height = LH;              // the game reads these as its playfield size
  root.classList.toggle('fit-land', land); root.classList.toggle('fit-wide', wide);
  root.style.setProperty('--fit-a', String(LW / LH));
  window.FIT = { w: LW, h: LH, wide: wide, land: land };

  var st = document.createElement('style');
  st.textContent =
    // sideways: the game fills the screen height (and the whole width when widened); no frame or rounded corners
    'html.fit-land,html.fit-land body{overflow:hidden}' +
    'html.fit-land #app{padding:0!important;gap:0!important;justify-content:center;align-items:center;height:100%}' +
    'html.fit-land #stage{width:min(100vw,calc(100vh * var(--fit-a)));width:min(100vw,calc(100dvh * var(--fit-a)));aspect-ratio:var(--fit-a);max-width:none;max-height:100dvh;height:auto;margin:0 auto}' +
    'html.fit-land #stage canvas{border-radius:0;box-shadow:none}html.fit-land #overlay{border-radius:0;overflow-y:auto;justify-content:safe center}' +
    // the score floats across the top, clear of the back button in the top-left corner
    'html.fit-land #hud{position:fixed;z-index:5;top:max(4px,env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);' +
    'width:min(640px,calc(100vw - 280px));margin:0;pointer-events:none;font-size:17px;text-shadow:0 2px 3px rgba(0,0,0,.9),0 0 10px rgba(0,0,0,.6)}' +
    'html.fit-land #hud .lbl{color:rgba(255,255,255,.8)}html.fit-land #hud button{pointer-events:auto;background:rgba(10,14,28,.55)}' +
    // a game's own button row (#pad) floats in the bottom-right corner, with big round buttons; the joystick
    // replaces its arrow pad. #wrap (games without #app) also fills the screen
    'html.fit-land #wrap{padding:0!important;height:100%}' +
    'html.fit-land #pad{position:fixed;z-index:6;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));margin:0;gap:12px}' +
    '@media (pointer:coarse){html.fit-land #pad{display:flex!important}}html.fit-land #pad .dpad{display:none}html.fit-land #pad>button{width:118px;height:118px;border-radius:50%;font-size:19px}' +
    // short sideways screens: a smaller start card so it never runs off the screen
    '@media (max-height:520px){html.fit-land #overlay{gap:8px;padding-block:10px}html.fit-land #overlay h1{font-size:clamp(28px,10vh,48px)}' +
    'html.fit-land #overlay p{font-size:14px;line-height:1.35;max-width:46ch}html.fit-land #overlay .how{font-size:12px;max-width:56ch}' +
    'html.fit-land #overlay button{padding:9px 28px;font-size:18px}}';
  (document.head || root).appendChild(st);

  // sharp picture: after the game has read its size, the canvas gets a backing store at the real pixel density,
  // and a base scale so the game keeps drawing in its own units
  var ctx = cv.getContext('2d'), ready = false;
  function hd() {
    if (!ready) return;
    var r = cv.getBoundingClientRect(); if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var w = r.width * dpr, h = r.height * dpr, cap = 2600000;           // keep it fast: at most ~2.6 million pixels
    if (w * h > cap) { var k = Math.sqrt(cap / (w * h)); w *= k; h *= k; }
    w = Math.max(LW, Math.round(w)); h = Math.max(LH, Math.round(h));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    ctx.setTransform(w / LW, 0, 0, h / LH, 0, 0);
  }
  function go() { ready = true; hd(); requestAnimationFrame(hd); ambient(); }

  // sideways with room to spare at the sides: the game's own left and right edges are stretched out to the
  // screen edges (soft and a little darker), so the picture runs edge to edge instead of sitting in black bars
  function ambient() {
    var a = document.createElement('canvas'); a.setAttribute('aria-hidden', 'true');
    a.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;filter:blur(6px) saturate(1.15);opacity:0;transition:opacity .25s';
    document.body.insertBefore(a, document.body.firstChild);
    var app = document.getElementById('app'); if (app) { app.style.position = 'relative'; app.style.zIndex = '1'; }
    var g = a.getContext('2d'), n = 0;
    (function tick() {
      requestAnimationFrame(tick);
      if (n++ % 3) return;
      var r = cv.getBoundingClientRect(), side = Math.min(r.left, innerWidth - r.right);
      if (!root.classList.contains('fit-land') || r.width < 20 || side < 16) { if (a.style.opacity !== '0') a.style.opacity = '0'; return; }
      var q = 4, AW = Math.ceil(innerWidth / q), AH = Math.ceil(innerHeight / q);
      if (a.width !== AW || a.height !== AH) { a.width = AW; a.height = AH; }
      var sw = cv.width, sh = cv.height, s = Math.max(2, Math.round(sw * 0.025)), t = r.top / q, h = r.height / q, L = r.left / q, R = r.right / q;
      g.fillStyle = '#000'; g.fillRect(0, 0, AW, AH);
      try { g.drawImage(cv, 0, 0, s, sh, 0, t, L + 1, h); g.drawImage(cv, sw - s, 0, s, sh, R - 1, t, AW - R + 1, h); } catch (e) { return; }
      var lg = g.createLinearGradient(0, 0, AW, 0), l = Math.max(0.001, r.left / innerWidth), rr = Math.min(0.999, r.right / innerWidth);
      lg.addColorStop(0, 'rgba(0,0,0,.7)'); lg.addColorStop(l, 'rgba(0,0,0,.22)'); lg.addColorStop(rr, 'rgba(0,0,0,.22)'); lg.addColorStop(1, 'rgba(0,0,0,.7)');
      g.fillStyle = lg; g.fillRect(0, 0, AW, AH);
      if (a.style.opacity !== '1') a.style.opacity = '1';
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0);

  var lastLand = land;
  addEventListener('resize', function () {
    var l = isLand();
    root.classList.toggle('fit-land', l);
    if (l !== lastLand) {
      lastLand = l;
      // turned while not playing: reload into the new shape (wider or back to tall)
      var s = ''; try { s = typeof state !== 'undefined' ? state : ''; } catch (e) {}
      if (ds.wide === '1' && s !== 'play' && s !== 'paused') { location.reload(); return; }
    }
    hd(); setTimeout(hd, 150);
  });
})();
