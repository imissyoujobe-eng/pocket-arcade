/* Joystik Original Arcade game kit.
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
    // a card taller than the screen scrolls (from the top) instead of being cut off at both ends, and its start
    // button stays in view at the bottom
    '#ko{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;justify-content:safe center}#ko>*{flex-shrink:0}#ko>button:last-child,#ko>#rp-wrap:last-child{position:sticky;bottom:0;z-index:1}' +
    // cover art (K.card art:) in place of the title text: upright it takes the room the card has left (110-300px tall),
    // showing art.band of the picture; sideways the whole picture stands on the left like a poster, and the stick and
    // buttons (which do nothing on a card and would show through it) are hidden until the card closes
    '#ko>h1.k-art{flex:0 1 300px;min-height:110px;width:100%;display:flex;justify-content:center;font-size:0;text-shadow:none}' +
    '#ko h1.k-art img{display:block;flex:none;height:100%;width:auto;max-width:min(320px,86vw);aspect-ratio:var(--kc-band);object-fit:cover;object-position:var(--kc-pos);border-radius:14px;box-shadow:0 0 0 3px rgba(255,255,255,.2),0 10px 28px rgba(0,0,0,.55)}' +
    'body.land #ko.k-cover{padding-left:calc(84vh * var(--kc-ar) + 36px);padding-left:calc(84dvh * var(--kc-ar) + 36px)}' +
    'body.land #ko>h1.k-art{position:absolute;left:16px;top:8vh;top:8dvh;height:84vh;height:84dvh;width:auto;min-height:0}' +
    'body.land #ko h1.k-art img{aspect-ratio:var(--kc-ar);object-position:50% 50%;max-width:none}' +
    'body.land.k-cover #kp{visibility:hidden}' +
    // phone on its side: a shorter title and wider, smaller writing, so most cards fit without scrolling
    'body.land #ko{gap:8px;padding:10px 16px}body.land #ko h1{font-size:clamp(24px,11vh,56px)}' +
    'body.land #ko p{max-width:min(64ch,60vw);font-size:clamp(12.5px,3.8vh,16px);line-height:1.38}' +
    '#kp{flex:none;display:none;justify-content:space-between;align-items:center;gap:12px;padding:10px 18px 14px}' +
    'body.touch #kp{display:flex}body.touch #kp:empty{display:none}' +
    // phone on its side: the game fills the full height in the middle, the joystick sits in the left margin,
    // the buttons and the score sit in the right margin, so nothing covers the game
    'body.touch.land #ks{margin:0 158px;margin-left:max(158px,calc(env(safe-area-inset-left,0px) + 150px));margin-right:max(158px,calc(env(safe-area-inset-right,0px) + 150px))}' +
    'body.touch.land #kh{position:absolute;top:0;right:0;width:150px;box-sizing:border-box;flex-direction:column;align-items:flex-end;gap:4px;padding:max(10px,env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 0 0;z-index:2;pointer-events:none}' +
    'body.touch.land #kp{position:absolute;left:0;right:0;bottom:0;align-items:flex-end;padding:0 max(12px,env(safe-area-inset-right,0px)) max(14px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));pointer-events:none;z-index:2}' +
    // games that call K.fullLand() fill the whole sideways screen; the controls float see-through on top
    // (3D games and widened games do this automatically). The score runs in one row across the top.
    'body.touch.land.lfull #ks{margin:0}' +
    // over a bright game picture, see-through buttons wash out: give them a light frosted backing, a dark rim
    // and near-black labels so the writing reads on any background
    'body.touch.land.lfull #kp button{background:rgba(255,255,255,.6);border:2px solid rgba(20,20,30,.55);color:#111;text-shadow:0 0 4px rgba(255,255,255,.9),0 0 2px #fff}' +
    'body.touch.land.lfull #kp button.on{background:var(--accent);color:var(--accentInk);text-shadow:none}' +
    'body.touch.land.lfull .kj{background:rgba(255,255,255,.3);border:2px solid rgba(20,20,30,.55)}' +
    'body.touch.land.lfull .kj i{box-shadow:0 0 0 3px rgba(8,12,28,.6),0 4px 8px rgba(0,0,0,.5)}' +
    'body.touch.land.lfull #kh{left:0;right:0;width:auto;flex-direction:row;justify-content:center;gap:18px;padding:max(6px,env(safe-area-inset-top,0px)) 140px 0;font-size:13px;text-shadow:0 2px 3px rgba(0,0,0,.8)}' +
    // smaller controls when the phone is on its side
    // big, easy-to-hit controls when the phone is on its side
    'body.touch.land .kj{width:150px;height:150px}body.touch.land .kj i{width:64px;height:64px;margin:-32px 0 0 -32px}' +
    // action buttons grow up to twice as big (176px) when there's room: they share the screen height by how
    // many are stacked, and games with side margins cap them at the margin width so they never cover the game
    'body.touch.land{--bn:1;--br:calc(100vh - 56px);--br:calc(100dvh - 56px);--bmax:176px}' +
    'body.touch.land:not(.lfull){--bmax:150px}body.touch.land:has(#kp .kbw){--bmax:90px}' +
    'body.touch.land:has(#kp .kb .big:nth-child(2)){--bn:2}body.touch.land:has(#kp .kb .big:nth-child(3)){--bn:3}body.touch.land:has(#kp .kb .big:nth-child(4)){--bn:4}' +
    'body.touch.land:has(#kp .sm){--br:calc(100vh - 124px);--br:calc(100dvh - 124px)}' +
    'body.touch.land #kp .big{--bs:clamp(88px,min(var(--bmax),calc((var(--br) - (var(--bn) - 1) * 10px) / var(--bn))),var(--bmax));width:var(--bs);height:var(--bs);font-size:calc(var(--bs) * .18)}' +
    'body.touch.land #kp .sm{width:70px;height:58px;font-size:22px}' +
    'body.touch.land #kp>*{pointer-events:auto}body.touch.land .kb{flex-direction:column-reverse;gap:10px;width:190px;align-items:center}' +
    '.kd{display:grid;grid-template-columns:repeat(3,54px);grid-template-rows:repeat(3,54px);gap:4px}' +
    '.kd.lr{grid-template-rows:54px}.kd.ud{grid-template-columns:54px}' +
    '.kb{display:flex;gap:12px;align-items:center}' +
    '#kp button{border:0;border-radius:14px;background:rgba(255,255,255,.14);color:var(--ink);font-family:Bungee,Impact,sans-serif;font-size:20px;padding:0;touch-action:none;box-shadow:0 4px 0 rgba(0,0,0,.35)}' +
    '#kp button.on{background:var(--accent);color:var(--accentInk);transform:translateY(2px)}' +
    '#kp .big{flex:none;width:76px;height:76px;border-radius:50%;font-size:14px}body.touch:not(.land) .kb{gap:8px}' +
    '.kbw{display:flex;flex-direction:column;align-items:center;gap:10px}#kp .sm{width:60px;height:52px;border-radius:16px;font-size:20px}' +
    // phone upright: big buttons. One or two are big circles; three or more become tall rounded squares that fill
    // the row beside the stick (two rows when there are four or more)
    'body.touch:not(.land) #kp{padding:10px 10px 12px;gap:10px}' +
    'body.touch:not(.land) .kj{width:clamp(118px,34vw,150px);height:clamp(118px,34vw,150px)}' +
    'body.touch:not(.land) #kp:has(.kb .big:nth-child(3)) .kj{width:clamp(110px,30vw,140px);height:clamp(110px,30vw,140px)}' +
    'body.touch:not(.land) #kp .big{--pw:clamp(84px,27vw,116px);width:var(--pw);height:var(--pw);font-size:calc(var(--pw) * .19)}' +
    'body.touch:not(.land) #kp .kb:has(.big:nth-child(2)) .big{--pw:clamp(78px,25vw,104px)}' +
    'body.touch:not(.land) #kp .kb:has(.big:nth-child(3)){flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;max-width:360px}' +
    'body.touch:not(.land) #kp .kb:has(.big:nth-child(4)):not(:has(.big:nth-child(5))){grid-template-columns:repeat(2,minmax(0,1fr))}' +
    'body.touch:not(.land) #kp .kb:has(.big:nth-child(3)) .big{width:auto;height:clamp(64px,20vw,86px);border-radius:20px;font-size:clamp(14px,4.4vw,20px)}' +
    'body.touch:not(.land) #kp .kb:has(.big:nth-child(4)) .big{height:clamp(56px,16vw,74px)}' +
    'body.touch:not(.land) .kbw{flex:1;max-width:360px;align-items:stretch}body.touch:not(.land) .kbw .kb.top{justify-content:center}body.touch:not(.land) #kp .sm{width:64px;height:54px}' +
    'body.touch.land .kbw{width:190px;flex-direction:column-reverse;gap:8px}body.touch.land .kbw .kb{flex-direction:row;gap:10px}' +
    '.kj{position:relative;flex:none;width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);touch-action:none;box-shadow:0 5px 0 rgba(0,0,0,.35)}' +
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
    ambient();
    if (window.matchMedia && matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
    addEventListener('touchstart', function () { document.body.classList.add('touch'); fit(); }, { passive: true, once: true });
  }
  function el(tag, id) { var e = document.createElement(tag); e.id = id; return e; }
  // sideways with room to spare at the sides of the picture: the game's own left and right edges are stretched
  // out to the screen edges (soft and a little darker), so the game runs edge to edge instead of sitting in black bars
  function ambient() {
    var a = document.createElement('canvas'); a.setAttribute('aria-hidden', 'true');
    // (it sits behind everything; the page's own background is cleared while it shows, so the game and its card stack as before)
    a.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;filter:blur(6px) saturate(1.15);opacity:0;transition:opacity .25s';
    document.body.insertBefore(a, document.body.firstChild);
    var g = a.getContext('2d'), n = 0, B = document.body.classList, bs = document.body.style;
    (function tick() {
      requestAnimationFrame(tick);
      if (n++ % 3) return;
      var r = cv.getBoundingClientRect(), side = Math.min(r.left, innerWidth - r.right);
      if (!B.contains('land') || !B.contains('lfull') || cv.style.display === 'none' || r.width < 20 || side < 16) { if (a.style.opacity !== '0') { a.style.opacity = '0'; bs.background = ''; } return; }
      var q = 4, AW = Math.ceil(innerWidth / q), AH = Math.ceil(innerHeight / q);
      if (a.width !== AW || a.height !== AH) { a.width = AW; a.height = AH; }
      var sw = cv.width, sh = cv.height, s = Math.max(2, Math.round(sw * 0.025)), t = r.top / q, h = r.height / q, L = r.left / q, R = r.right / q;
      g.fillStyle = '#000'; g.fillRect(0, 0, AW, AH);
      try { g.drawImage(cv, 0, 0, s, sh, 0, t, L + 1, h); g.drawImage(cv, sw - s, 0, s, sh, R - 1, t, AW - R + 1, h); } catch (e) { return; }
      var lg = g.createLinearGradient(0, 0, AW, 0), l = Math.max(0.001, r.left / innerWidth), rr = Math.min(0.999, r.right / innerWidth);
      lg.addColorStop(0, 'rgba(0,0,0,.7)'); lg.addColorStop(l, 'rgba(0,0,0,.22)'); lg.addColorStop(rr, 'rgba(0,0,0,.22)'); lg.addColorStop(1, 'rgba(0,0,0,.7)');
      g.fillStyle = lg; g.fillRect(0, 0, AW, AH);
      if (a.style.opacity !== '1') { a.style.opacity = '1'; bs.background = 'transparent'; }
    })();
  }

  // ---------- screen: fixed logical size, scaled to fit ----------
  var LW = 320, LH = 240, SC = 1, pixel = true;
  K.screen = function (w, h, opts) {
    LW = w; LH = h; pixel = !(opts && opts.smooth);
    // sideways, every game goes full screen: the picture fills the height, the score runs across the top,
    // the controls float on top, and the room left at the sides is filled with the game's own edges (see ambient)
    if (!(opts && opts.margins)) document.body.classList.add('lfull');
    fit(); addEventListener('resize', fit);
    return ctx;
  };
  function fit() {
    if (!cv) return;
    document.body.classList.toggle('land', innerWidth > innerHeight * 1.15);
    if (cv.style.display === 'none') document.body.classList.add('lfull');
    var r = stage.getBoundingClientRect();
    var aw = Math.max(50, r.width - 8), ah = Math.max(50, r.height - 8);
    SC = Math.min(aw / LW, ah / LH); VISH = LH;
    // sharp picture: draw at the phone's real pixel density (up to 3x), within a pixel budget (PXB). Painting
    // millions of pixels every frame is what makes a phone slow, so the budget starts moderate and drops on its
    // own when the phone can't keep up (see the frame watch in K.run); the drawing is stretched to fill the same
    // space, so the game still fills the screen, just a little softer.
    var dpr = Math.min(window.devicePixelRatio || 1, 3), dh = LH * SC;
    if (zoomL && document.body.classList.contains('land')) { SC = Math.min(aw / LW, (ah / LH) * zoomL.z); dh = Math.min(ah, LH * SC); VISH = dh / SC; }
    if (LW * SC * dh * dpr * dpr > PXB) dpr = Math.max(1, Math.sqrt(PXB / (LW * SC * dh)));
    cv.style.width = Math.floor(LW * SC) + 'px'; cv.style.height = Math.floor(dh) + 'px';
    cv.width = Math.floor(LW * SC * dpr); cv.height = Math.floor(dh * dpr);
    // (a smooth game drawn below the screen's own sharpness is stretched smoothly; pixel-art games stay crisp)
    cv.style.imageRendering = pixel ? '' : 'auto';
    ctx.setTransform(SC * dpr, 0, 0, SC * dpr, 0, 0);
    ctx.imageSmoothingEnabled = !pixel;
  }
  // the pixel budget: remembered per game on this phone (a game that had to drop stays dropped next time), and a
  // game opened for the first time starts no higher than the last one that had to drop
  var PXKEY = 'pa-px-' + location.pathname.split('/').pop(), PXMAX = 1600000, PXMIN = 250000;
  var PXB = (function () { try { return Math.max(PXMIN, Math.min(PXMAX, +localStorage.getItem(PXKEY) || +localStorage.getItem('pa-px') || PXMAX)); } catch (e) { return PXMAX; } })();
  function lowerRes() {
    PXB = Math.max(PXMIN, Math.round(PXB * 0.62));
    try { localStorage.setItem(PXKEY, PXB); localStorage.setItem('pa-px', Math.min(PXMAX, Math.round(PXB * 1.3))); } catch (e) {}
    fit();
  }
  // K.zoomLand(z, focusY): on its side, a tall single-screen game is drawn z times bigger and the view
  // scrolls up and down to follow focusY() (in game units), so the action fills the screen
  var zoomL = null, VISH = 240, offY = 0;
  K.zoomLand = function (z, focus) { zoomL = { z: z, focus: focus }; document.body.classList.add('lfull'); fit(); };
  K.fullLand = function () { document.body.classList.add('lfull'); fit(); };
  // K.flex(baseW, H, set): on its side, the game's view gets wider to fill the whole screen (height stays H).
  // set(w) is called with the new width so the game can update its view width; standing up it goes back to baseW.
  K.flex = function (baseW, h, set, opts) {
    document.body.classList.add('lfull');
    var cur = 0;
    function go() {
      document.body.classList.toggle('land', innerWidth > innerHeight * 1.15);
      var land = document.body.classList.contains('land'), r = stage.getBoundingClientRect();
      var w = land ? Math.round(Math.min((opts && opts.maxW) || baseW * 3.2, Math.max(baseW, h * r.width / Math.max(1, r.height)))) : baseW;
      if (w !== cur) { cur = w; set(w); K.screen(w, h, opts); } else fit();
    }
    go(); addEventListener('resize', function () { go(); setTimeout(go, 120); });
  };
  K.stageSize = function () { var r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; };
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

  // the phone's side buttons. K.sideKeys({ up: 'g', down: 'b' }, when): in the Joystik app (Android) the volume
  // buttons press these game buttons. The app only hands them over while the game is being played (no card up, and
  // when(), if given, says yes); the rest of the time, and in every other game, they change the volume as usual.
  // The app sends them as AudioVolumeUp / AudioVolumeDown keys; in a web browser nothing changes.
  K.sideKeys = function (map, when) {
    var keys = { AudioVolumeUp: map.up, AudioVolumeDown: map.down }, app = window.JoystikApp, on = false;
    addEventListener('keydown', function (e) { var n = keys[e.key]; if (n && (on || !app)) { e.preventDefault(); press(n); } });
    addEventListener('keyup', function (e) { var n = keys[e.key]; if (n) release(n); });
    if (!app || !app.volumeKeys) return;
    // checked every picture (the call into the app only when it changes); the first check waits a picture, so the
    // game's own code has finished setting up before when() is asked
    requestAnimationFrame(function chk() {
      var want = !!(overlay && overlay.hidden && !document.hidden && (!when || when()));
      if (want !== on) {
        on = want; try { app.volumeKeys(want); } catch (e) {}
        if (!want) { if (map.up) release(map.up); if (map.down) release(map.down); }
      }
      requestAnimationFrame(chk);
    });
  };

  // pointer on the screen, in logical coordinates
  var ptr = { down: false, x: 0, y: 0, tapped: false };
  K.ptr = ptr;
  function toLogical(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * VISH + offY }; }
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
    // buttons with top: true sit in a smaller row above the main buttons (e.g. strafe ◀ ▶ over USE / FIRE)
    var right = document.createElement('div'), main = right; right.className = 'kb';
    if ((o.buttons || []).some(function (bd) { return bd.top; })) {
      right = document.createElement('div'); right.className = 'kbw';
      var top = document.createElement('div'); top.className = 'kb top'; main = document.createElement('div'); main.className = 'kb';
      right.appendChild(top); right.appendChild(main);
      o.buttons.forEach(function (bd) { if (bd.top) { var b = btn(bd.id, bd.label); b.className = 'sm'; top.appendChild(b); } });
    }
    (o.buttons || []).forEach(function (bd) { if (bd.top) return; var b = btn(bd.id, bd.label); b.className = 'big'; main.appendChild(b); });
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
    // long labels (GRENADE, ATTACK) print a little smaller so they fit inside the button
    if (String(label).length >= 6) { var sp = document.createElement('span'); sp.textContent = label; sp.style.fontSize = String(label).length >= 8 ? '.72em' : '.84em'; b.textContent = ''; b.appendChild(sp); }
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
    K.record(key, v, lowerIsBetter, better);
    if (better) { try { localStorage.setItem('pa-' + key, v); } catch (e) {} return v; }
    return b;
  };
  // play history for the My Scores page, kept on this phone only: how many times, last score, when
  K.stats = function () { try { return JSON.parse(localStorage.getItem('pa-stats') || '{}') || {}; } catch (e) { return {}; } };
  K.record = function (key, v, lowerIsBetter, better) {
    try {
      var s = K.stats(), r = s[key] || { n: 0 };
      r.n = (r.n || 0) + 1; r.at = Date.now();
      if (v != null) { r.last = v; if (better) r.bAt = r.at; }
      if (lowerIsBetter) r.low = 1;
      s[key] = r; localStorage.setItem('pa-stats', JSON.stringify(s));
    } catch (e) {}
  };

  // ---------- title / game over card ----------
  var startFn = null;
  // the game's cover art (art/<game>.jpg, also its tile on the menu) shown in place of the title text.
  // a = { src, w, h, band: [top, bottom] } (band: the part of the picture to show upright, as fractions; default all)
  function noCover() { overlay.classList.remove('k-cover'); document.body.classList.remove('k-cover'); }
  function cover(h, a, title) {
    var band = a.band || [0, 1], bh = band[1] - band[0], im = new Image();
    overlay.style.setProperty('--kc-ar', a.w / a.h);
    overlay.style.setProperty('--kc-band', a.w / (a.h * bh));
    overlay.style.setProperty('--kc-pos', '50% ' + (bh < 1 ? band[0] / (1 - bh) * 100 : 50) + '%');
    im.alt = title; im.width = a.w; im.height = a.h;
    im.onerror = function () { h.className = ''; h.textContent = title; noCover(); };
    im.src = a.src;
    h.textContent = ''; h.className = 'k-art'; h.appendChild(im);
    overlay.classList.add('k-cover'); document.body.classList.add('k-cover');
  }
  K.card = function (o) {
    overlay.innerHTML = ''; noCover();
    var h = document.createElement('h1'); h.textContent = o.title; overlay.appendChild(h);
    if (o.art) cover(h, o.art, o.title);
    if (o.text) { var p = document.createElement('p'); p.textContent = o.text; overlay.appendChild(p); }
    var b = document.createElement('div'); b.className = 'best'; b.textContent = o.best || ''; overlay.appendChild(b);
    var go = document.createElement('button'); go.textContent = o.button || 'Play'; overlay.appendChild(go);
    startFn = function () { overlay.hidden = true; startFn = null; noCover(); down = {}; hit = {}; unlock(); o.onStart(); };
    go.onclick = function () { startFn && startFn(); };
    overlay.hidden = false;
  };
  K.cardOpen = function () { return !overlay.hidden; };

  // ---------- loop ----------
  K.run = function (update, draw) {
    var last = performance.now();
    function frame(t) {
      // a 3D game hides the kit's canvas: switch on the full-screen sideways layout and let it resize
      if (cv.style.display === 'none' && !document.body.classList.contains('lfull')) { document.body.classList.add('lfull'); fit(); window.dispatchEvent(new Event('resize')); }
      var el = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      // a phone that can't keep up: run the game in a few smaller steps per picture, so it still plays at full
      // speed (just with fewer pictures) instead of going into slow motion. A button tap counts once.
      var n = Math.max(1, Math.ceil(el / 0.034 - 1e-6)), dt = el / n;
      for (var i = 0; i < n; i++) { update(dt); hit = {}; ptr.tapped = false; }
      watch(el);
      if (VISH < LH - 0.5 && zoomL) { var fy = +zoomL.focus() || LH / 2, ty = Math.max(0, Math.min(LH - VISH, fy - VISH / 2)); offY += (ty - offY) * Math.min(1, el * 6); }
      else offY = 0;
      ctx.save(); if (offY) ctx.translate(0, -offY); draw(ctx, t); ctx.restore();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  // frame watch: while a game is being played (no card up, page showing, the kit's own canvas in use), take the
  // middle time between pictures over 40 frames. Slower than ~40 pictures a second means the phone can't paint
  // this many pixels, so draw fewer (lowerRes), then look again.
  var fw = [], fwSkip = 40;
  function watch(el) {
    if (!overlay.hidden || document.hidden || cv.style.display === 'none' || el <= 0) { fw.length = 0; fwSkip = Math.max(fwSkip, 20); return; }
    if (fwSkip > 0) { fwSkip--; return; }
    fw.push(el); if (fw.length < 40) return;
    var med = fw.slice().sort(function (a, b) { return a - b; })[20]; fw.length = 0;
    if (med > 0.025 && PXB > PXMIN) { lowerRes(); fwSkip = 40; }
  }
  K.res = function () { return { budget: PXB, w: cv.width, h: cv.height }; };

  // ---------- small helpers ----------
  K.rnd = function (a, b) { return a + Math.random() * (b - a); };
  K.ri = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.hitRect = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
  K.text = function (c, s, x, y, size, color, align) {
    c.font = size + 'px Bungee, Impact, sans-serif'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillText(s, x + 1, y + 1); c.fillStyle = color || '#fff'; c.fillText(s, x, y);
  };

  // keep the sideways / standing layout in step with the phone, for every game (3D ones too)
  addEventListener('resize', function () { fit(); });
  // if a game ever hits an error, show a message with a reload button instead of a blank screen
  addEventListener('error', function (e) {
    if (!overlay || document.getElementById('kerr')) return;
    var d = document.createElement('div'); d.id = 'kerr';
    d.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(0,0,0,.85);color:#fff;font:16px Rubik,system-ui,sans-serif;text-align:center;padding:20px';
    d.innerHTML = '<div style="font:24px Bungee,Impact,sans-serif">OOPS!</div><div>The game hit a snag.</div><button style="font:18px Bungee,Impact,sans-serif;padding:12px 28px;border:0;border-radius:999px;background:#ffb02e;color:#1a1200">Reload</button>';
    d.querySelector('button').onclick = function () { location.reload(); };
    document.body.appendChild(d);
  });
  // the kit script sits at the top of <body>, so the body already exists
  if (document.body) { build(); bindPtr(); }
  else document.addEventListener('DOMContentLoaded', function () { build(); bindPtr(); });
  window.K = K;
})();
