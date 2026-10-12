/* On-screen joystick (and optional action buttons) for the older games.
   It only appears on touch screens. It sends the same arrow-key / space presses the keyboard does,
   so each game works with it unchanged. Settings come from the script tag:
     data-axes="4" | "lr" | "ud"          which directions the stick can push
     data-hide="#left,#right"              the game's own arrow buttons to hide (the stick replaces them)
     data-buttons='[{"label":"FIRE","key":" "}]'   extra buttons for the right side
*/
(function () {
  'use strict';
  var me = document.currentScript, axes = me.dataset.axes || '4', hideSel = me.dataset.hide || '';
  var extra = []; try { extra = JSON.parse(me.dataset.buttons || '[]'); } catch (e) { }
  var KEYS = { left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39], up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40] };
  function send(type, key, code, kc) { var ev = new KeyboardEvent(type, { key: key, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true }); document.dispatchEvent(ev); }
  function keyInfo(k) { if (k === ' ') return [' ', 'Space', 32]; if (KEYS[k]) return KEYS[k]; var up = k.toUpperCase(); return [k, 'Key' + up, up.charCodeAt(0)]; }
  var aim = me.dataset.mode === 'aim', cross = null, cx = 0, cy = 0, aimV = { x: 0, y: 0 };
  function target() { return document.querySelector(me.dataset.target || 'canvas'); }
  function shoot() { var el = target(); if (!el) return; var o = { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
    ['pointerdown', 'mousedown'].forEach(function (t) { try { el.dispatchEvent(t[0] === 'p' ? new PointerEvent(t, o) : new MouseEvent(t, o)); } catch (e) { } });
    setTimeout(function () { o.buttons = 0; ['pointerup', 'mouseup', 'click'].forEach(function (t) { try { el.dispatchEvent(t[0] === 'p' ? new PointerEvent(t, o) : new MouseEvent(t, o)); } catch (e) { } }); }, 40); }
  var held = {};
  function set(dir, on) { if (aim) return; if (!!held[dir] === on) return; held[dir] = on; var k = KEYS[dir]; send(on ? 'keydown' : 'keyup', k[0], k[1], k[2]); }
  var built = false;
  function build() {
    if (built) return; built = true;
    if (hideSel) document.querySelectorAll(hideSel).forEach(function (el) { el.style.visibility = 'hidden'; el.style.pointerEvents = 'none'; });
    var st = document.createElement('style');
    st.textContent = '.jy-wrap{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 18px calc(18px + env(safe-area-inset-bottom,0px));pointer-events:none;z-index:60}' +
      '.jy-base{position:relative;width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);pointer-events:auto;touch-action:none;box-shadow:0 6px 0 rgba(0,0,0,.35)}' +
      '.jy-base.lr{height:96px;width:150px;border-radius:48px}.jy-base.ud{width:96px;height:150px;border-radius:48px}' +
      '.jy-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#c8c8d8 45%,#7a7a90);box-shadow:0 4px 8px rgba(0,0,0,.5)}' +
      '.jy-btns{display:flex;gap:12px;pointer-events:auto}' +
      '.jy-btn{width:80px;height:80px;border-radius:50%;border:0;font:700 14px Bungee,Impact,system-ui,sans-serif;color:#fff;background:rgba(255,80,80,.75);box-shadow:0 5px 0 rgba(0,0,0,.4);touch-action:none}' +
      '.jy-btn.b2{background:rgba(80,140,255,.75)}.jy-btn.on{transform:translateY(3px);filter:brightness(1.3)}';
    document.head.appendChild(st);
    var wrap = document.createElement('div'); wrap.className = 'jy-wrap';
    var base = document.createElement('div'); base.className = 'jy-base' + (axes === 'lr' ? ' lr' : axes === 'ud' ? ' ud' : '');
    var knob = document.createElement('div'); knob.className = 'jy-knob'; base.appendChild(knob); wrap.appendChild(base);
    var bw = document.createElement('div'); bw.className = 'jy-btns';
    extra.forEach(function (b, i) {
      var el = document.createElement('button'); el.className = 'jy-btn' + (i ? ' b2' : ''); el.textContent = b.label; var k = keyInfo(b.key);
      var on = function (e) { e.preventDefault(); el.classList.add('on'); if (b.key === 'aimfire') { shoot(); return; } send('keydown', k[0], k[1], k[2]); try { el.setPointerCapture(e.pointerId); } catch (_) { } };
      var off = function () { if (!el.classList.contains('on')) return; el.classList.remove('on'); if (b.key === 'aimfire') return; send('keyup', k[0], k[1], k[2]); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      bw.appendChild(el);
    });
    wrap.appendChild(bw); document.body.appendChild(wrap);
    // line the stick up with the game's own control bar if it has one
    var bar = document.querySelector('.controls, #pad, .pad');
    function place() { if (bar && bar.offsetHeight) { var r = bar.getBoundingClientRect(); wrap.style.bottom = Math.max(0, innerHeight - r.bottom) + 'px'; wrap.style.paddingBottom = Math.max(6, (r.height - base.offsetHeight) / 2) + 'px'; } }
    place(); addEventListener('resize', place);
    var pid = null;
    function move(e) {
      var r = base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy; if (axes === 'lr') dy = 0; if (axes === 'ud') dx = 0;
      var max = Math.max(r.width, r.height) / 2 - 20, m = Math.hypot(dx, dy); if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var nx = dx / max, ny = dy / max, T = 0.38; aimV.x = nx; aimV.y = ny;
      set('left', nx < -T); set('right', nx > T); set('up', ny < -T); set('down', ny > T);
    }
    function release() { pid = null; knob.style.transform = ''; aimV.x = 0; aimV.y = 0; ['left', 'right', 'up', 'down'].forEach(function (d) { set(d, false); }); }
    base.addEventListener('pointerdown', function (e) { e.preventDefault(); pid = e.pointerId; try { base.setPointerCapture(pid); } catch (_) { } move(e); });
    base.addEventListener('pointermove', function (e) { if (e.pointerId === pid) move(e); });
    base.addEventListener('pointerup', release); base.addEventListener('pointercancel', release); base.addEventListener('lostpointercapture', release);
    addEventListener('blur', release);
    if (aim) {
      cross = document.createElement('div'); cross.style.cssText = 'position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border:3px solid #ff3a3a;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.6),inset 0 0 0 2px rgba(0,0,0,.4);pointer-events:none;z-index:61';
      var dot = document.createElement('div'); dot.style.cssText = 'position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#ff3a3a;border-radius:50%'; cross.appendChild(dot); document.body.appendChild(cross);
      var el0 = target(), r0 = el0 ? el0.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight / 2 }; cx = r0.left + r0.width / 2; cy = r0.top + r0.height / 2;
      var last = performance.now();
      (function tick(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; var el = target(), r = el ? el.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; var sp = Math.max(r.width || 300, 300) * 0.9;
        cx = Math.min(r.right - 4, Math.max(r.left + 4, cx + aimV.x * sp * dt)); cy = Math.min(r.bottom - 4, Math.max(r.top + 4, cy + aimV.y * sp * dt)); cross.style.left = cx + 'px'; cross.style.top = cy + 'px';
        cross.style.display = el && r.width ? '' : 'none'; requestAnimationFrame(tick); })(last);
      document.addEventListener('pointermove', function (e) { if (e.pointerId !== 77 && e.target === target()) { cx = e.clientX; cy = e.clientY; } });
    }
  }
  function maybe() { if (document.body) build(); else document.addEventListener('DOMContentLoaded', build); }
  if (window.matchMedia && matchMedia('(pointer:coarse)').matches) maybe();
  addEventListener('touchstart', maybe, { passive: true, once: true });
  window.JOY = { show: maybe };
})();
