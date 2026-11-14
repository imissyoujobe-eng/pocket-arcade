/* 3D racing engine (three.js) shared by Kart Clash and Hyper Rail.
   R.start(cfg) builds a track from control points, spawns racers and runs the race.
   cfg: { style:'kart'|'hover', tracks:[{n, pts:[[x,z],...], width, theme:{sky,ground,road,edge,fog,scenery}}],
          laps, cpus, maxSpeed, items:boolean, boostPads:boolean, energy:boolean, colors:[...], onFinish(place, time, trackIndex) } */
(function () {
  'use strict';
  var R = {}, THREE = window.THREE;
  var renderer, scene, camera, hudC, hud, stageEl, cfg, tr, racers, me, pts, N, boxes, slicks, bolts, pads, state, countdown, raceT, msg, msgT, trackIdx, ownLoop, lastT, camPos, finishOrder, shakeT = 0;

  function setup() {
    stageEl = document.getElementById('ks');
    var kitCanvas = stageEl.querySelector('canvas'); if (kitCanvas) kitCanvas.style.display = 'none';
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    stageEl.style.position = 'relative'; stageEl.insertBefore(renderer.domElement, stageEl.firstChild);
    hudC = document.createElement('canvas'); hudC.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
    stageEl.insertBefore(hudC, renderer.domElement.nextSibling); hud = hudC.getContext('2d');
    var el = renderer.domElement, tp = function (e) { var r = el.getBoundingClientRect(); R.touchX = (e.clientX - r.left) / r.width - 0.5; };
    el.addEventListener('pointerdown', function (e) { tp(e); try { el.setPointerCapture(e.pointerId); } catch (_) {} }); el.addEventListener('pointermove', function (e) { if (R.touchX != null) tp(e); });
    ['pointerup', 'pointercancel'].forEach(function (n) { el.addEventListener(n, function () { R.touchX = null; }); });
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(65, 1, 0.06, 900);
    window.addEventListener('resize', fit); fit();
  }
  function fit() {
    var r = stageEl.getBoundingClientRect(); var w = Math.max(100, r.width), h = Math.max(100, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    var d = Math.min(window.devicePixelRatio || 1, 2); hudC.width = w * d; hudC.height = h * d; hud.setTransform(d, 0, 0, d, 0, 0); hudC._w = w; hudC._h = h;
  }
  function texture(draw, w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t; }

  function buildTrack(t) {
    while (scene.children.length) scene.remove(scene.children[0]);
    var th = t.theme;
    scene.background = window.A ? A.skyTex(THREE, '#' + new THREE.Color(th.sky).offsetHSL(0, 0, -0.18).getHexString(), '#' + new THREE.Color(th.fog || th.sky).getHexString()) : new THREE.Color(th.sky); scene.fog = new THREE.Fog(th.fog || th.sky, 120, 520);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    var sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(80, 160, 40); scene.add(sun);
    var curve = new THREE.CatmullRomCurve3(t.pts.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); }), true, 'centripetal');
    N = 600; pts = curve.getSpacedPoints(N); pts.pop();
    var W2 = t.width / 2;
    // hills: a track with hills: <height> rolls up and down (flat at the start line)
    HILLS = t.hills || 0;
    pts.forEach(function (p, i) { var u = i / N * Math.PI * 2; p.y = HILLS ? HILLS * (0.5 * (1 - Math.cos(u * 3)) * 0.75 + 0.5 * (1 - Math.cos(u * 7)) * 0.35) : 0; });
    // per-point frame (direction kept level; slope stored separately)
    pts.forEach(function (p, i) { var n = pts[(i + 1) % N], v = new THREE.Vector3(n.x - p.x, 0, n.z - p.z), run = v.length(); v.normalize(); p.dir = v; p.side = new THREE.Vector3(-v.z, 0, v.x); p.slope = (n.y - p.y) / (run || 1); });
    sample = pts.filter(function (p, i) { return i % 3 === 0; });
    // road ribbon
    var road = ribbon(function (p) { return [p.clone().addScaledVector(p.side, -W2), p.clone().addScaledVector(p.side, W2)]; }, 0.02);
    var roadTex = texture(function (c, w, h) { c.fillStyle = th.road; c.fillRect(0, 0, w, h); for (var i = 0; i < 400; i++) { c.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.05 + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.fillStyle = th.line || 'rgba(255,255,255,.7)'; c.fillRect(w / 2 - 1, 0, 2, h / 2); }, 64, 64);
    roadTex.repeat.set(1, N / 6);
    scene.add(new THREE.Mesh(road, new THREE.MeshLambertMaterial({ map: roadTex })));
    // edges / curbs
    var edgeTex = texture(function (c, w, h) { c.fillStyle = th.edge[0]; c.fillRect(0, 0, w, h / 2); c.fillStyle = th.edge[1]; c.fillRect(0, h / 2, w, h / 2); }, 8, 16);
    edgeTex.repeat.set(1, N / 2);
    [-1, 1].forEach(function (s) { var g = ribbon(function (p) { return [p.clone().addScaledVector(p.side, s * W2), p.clone().addScaledVector(p.side, s * (W2 + 1.6))]; }, 0.05); scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: edgeTex, side: THREE.DoubleSide }))); });
    if (cfg.style === 'hover') {
      [-1, 1].forEach(function (s) { var g = wall(function (p) { return p.clone().addScaledVector(p.side, s * (W2 + 1.6)); }, 1.6); scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: th.wall || 0x46d0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))); });
    }
    // ground
    var gmat = new THREE.MeshLambertMaterial(window.A ? { color: 0xffffff, map: A.tex3(THREE, 'grass', th.ground, 160) } : { color: th.ground });
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), gmat); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.05; scene.add(gnd);
    if (HILLS) {
      // rolling ground that rises with the road and blends back down to flat further out
      var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; pts.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
      var GW = maxX - minX + 160, GD = maxZ - minZ + 160, seg = 4, tg = new THREE.PlaneGeometry(GW, GD, Math.ceil(GW / seg), Math.ceil(GD / seg)); tg.rotateX(-Math.PI / 2); tg.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      var gp = tg.attributes.position; for (var gi = 0; gi < gp.count; gi++) gp.setY(gi, groundH(gp.getX(gi), gp.getZ(gi), true));
      tg.computeVertexNormals();
      var gm2 = gmat.clone(); if (gm2.map) { gm2.map = gm2.map.clone(); gm2.map.needsUpdate = true; gm2.map.repeat.set(GW / 2000 * 160, GD / 2000 * 160); }
      scene.add(new THREE.Mesh(tg, gm2));
    }
    // start line
    var chk = texture(function (c, w, h) { for (var y = 0; y < 2; y++) for (var x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 8, y * 8, 8, 8); } }, 64, 16);
    var sl = new THREE.Mesh(new THREE.PlaneGeometry(t.width, 3), new THREE.MeshBasicMaterial({ map: chk })); sl.rotation.x = -Math.PI / 2; var slg = new THREE.Group(); slg.add(sl); slg.rotation.y = Math.atan2(pts[0].dir.x, pts[0].dir.z); slg.position.copy(pts[0]); slg.position.y = pts[0].y + 0.04; scene.add(slg);
    // scenery
    var sc = th.scenery || 'trees';
    for (var k = 0; k < 220; k++) {
      var p = pts[Math.floor(Math.random() * N)], off = (W2 + 6 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1), pos = p.clone().addScaledVector(p.side, off);
      if (nearestDist(pos) < W2 + 4) continue;
      var pr = prop(sc, pos); pr.position.y = groundH(pos.x, pos.z); scene.add(pr);
    }
    // item boxes / boost pads
    boxes = []; pads = []; slicks = []; bolts = [];
    if (cfg.items) for (var b = 1; b <= 4; b++) { var bi = Math.floor(N * b / 5); for (var l = -1; l <= 1; l++) { var m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x553300, transparent: true, opacity: 0.9 })); m.position.copy(pts[bi]).addScaledVector(pts[bi].side, l * W2 * 0.55); m.position.y = pts[bi].y + 1.1; scene.add(m); boxes.push({ m: m, t: 0 }); } }
    if (cfg.boostPads) for (var q = 1; q <= 6; q++) { var pi = Math.floor(N * q / 7 + 10), lane = (q % 3 - 1) * W2 * 0.45; var pad = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ map: texture(function (c, w, h) { c.fillStyle = '#ff8a1f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23f'; for (var y = 0; y < 3; y++) { c.beginPath(); c.moveTo(4, 30 - y * 10); c.lineTo(w / 2, 22 - y * 10); c.lineTo(w - 4, 30 - y * 10); c.lineTo(w - 4, 26 - y * 10); c.lineTo(w / 2, 18 - y * 10); c.lineTo(4, 26 - y * 10); c.fill(); } }, 32, 32) })); pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI; var pg = new THREE.Group(); pg.add(pad); pg.rotation.y = Math.atan2(pts[pi].dir.x, pts[pi].dir.z); pg.position.copy(pts[pi]).addScaledVector(pts[pi].side, lane); pg.position.y = pts[pi].y + 0.06; scene.add(pg); pads.push({ i: pi, lane: lane }); }
  }
  function ribbon(edgeFn, y) {
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) { var p = pts[i % N], e = edgeFn(p); pos.push(e[0].x, e[0].y + y, e[0].z, e[1].x, e[1].y + y, e[1].z); uv.push(0, i / 6, 1, i / 6); if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // make sure normals point up
    var n = g.attributes.normal; for (var k = 0; k < n.count; k++) { if (n.getY(k) < 0) n.setY(k, -n.getY(k)); } return g;
  }
  function wall(fn, h) { var pos = [], idx = []; for (var i = 0; i <= N; i++) { var p = fn(pts[i % N]); pos.push(p.x, p.y, p.z, p.x, p.y + h, p.z); if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; }
  function prop(kind, pos) {
    var grp = new THREE.Group(); grp.position.copy(pos); var s = 0.7 + Math.random() * 0.9;
    if (kind === 'trees') { var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 5), new THREE.MeshLambertMaterial({ color: 0x6a3a1a })); tr.position.y = 1; var cn = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 6), new THREE.MeshLambertMaterial({ color: 0x2f8a3a })); cn.position.y = 3.6; grp.add(tr, cn); }
    else if (kind === 'cactus') { var c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 4, 6), new THREE.MeshLambertMaterial({ color: 0x3f8a3a })); c1.position.y = 2; var c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x3f8a3a })); c2.position.set(0.8, 2.4, 0); grp.add(c1, c2); }
    else if (kind === 'snow') { var p1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 6), new THREE.MeshLambertMaterial({ color: 0x2a6a4a })); p1.position.y = 2.3; var cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xffffff })); cap.position.y = 4.2; grp.add(p1, cap); }
    else if (kind === 'city') { var h = 4 + Math.random() * 18; var b = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), new THREE.MeshLambertMaterial({ color: [0x2a2a5a, 0x3a1a4a, 0x1a3a5a][Math.floor(Math.random() * 3)], emissive: 0x0a0a20 })); b.position.y = h / 2; var stripe = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.3, 4.1), new THREE.MeshBasicMaterial({ color: [0xff3bd0, 0x46d0ff, 0xffd23f][Math.floor(Math.random() * 3)] })); stripe.position.y = h * 0.8; grp.add(b, stripe); s = 1; }
    else if (kind === 'rocks') { var r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: 0x5a3a3a })); r.position.y = 1; grp.add(r); }
    else if (kind === 'space') { var o = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshBasicMaterial({ color: [0xff3bd0, 0x46d0ff, 0xffd23f][Math.floor(Math.random() * 3)] })); o.position.y = 3 + Math.random() * 8; grp.add(o); }
    grp.scale.setScalar(s); grp.rotation.y = Math.random() * 6; return grp;
  }
  function nearest(pos, hint) {
    var best = 0, bd = 1e9, from = hint == null ? 0 : hint - 40, to = hint == null ? N : hint + 40;
    for (var i = from; i < to; i++) { var k = ((i % N) + N) % N, p = pts[k], d = (p.x - pos.x) * (p.x - pos.x) + (p.z - pos.z) * (p.z - pos.z); if (d < bd) { bd = d; best = k; } }
    return { i: best, d: Math.sqrt(bd) };
  }
  function nearestDist(pos) { return nearest(pos).d; }
  // ground height at (x, z): the road height near the track, easing to flat ground 40 units out
  var HILLS = 0, sample = [];
  function groundH(x, z, mesh) {
    if (!HILLS) return 0;
    var bd = 1e9, by = 0; for (var i = 0; i < sample.length; i++) { var p = sample[i], d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); if (d < bd) { bd = d; by = p.y; } }
    var d2 = Math.sqrt(bd) - tr.width / 2 - 2, f = d2 <= 0 ? 1 : Math.max(0, 1 - d2 / 40); f = f * f * (3 - 2 * f);
    return by * f - (mesh ? (d2 <= 2 ? 0.35 : 0.08) : 0);
  }
  function heightAt(r) { var p = pts[r.idx], latOff = (r.x - p.x) * p.side.x + (r.z - p.z) * p.side.z, d2 = Math.abs(latOff) - tr.width / 2 - 2, f = d2 <= 0 ? 1 : Math.max(0, 1 - d2 / 40); f = f * f * (3 - 2 * f); return p.y * f; }

  // ---------- detailed go-kart with a driver (kart style) ----------
  // static parts are merged into one vertex-colored mesh per kart; the steering wheel, hands, arms, head and wheels move
  var PRIM = null, KMAT = null, _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _c4 = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
  function prims() {
    if (PRIM) return PRIM;
    PRIM = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), sph: new THREE.SphereGeometry(1, 12, 9), tor: new THREE.TorusGeometry(1, 0.14, 6, 18) };
    for (var k in PRIM) if (PRIM[k].index) PRIM[k] = PRIM[k].toNonIndexed();
    KMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
    return PRIM;
  }
  // list entries: [prim, color, x, y, z, sx, sy, sz, rx, ry, rz] or {q: quaternion} via seg()
  function mergeParts(list) {
    var P = prims(), n = 0; list.forEach(function (it) { n += P[it[0]].attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), nm = new THREE.Matrix3(), o = 0;
    list.forEach(function (it) {
      var g = P[it[0]], A = g.attributes.position, Nn = g.attributes.normal;
      if (it[11]) _q4.copy(it[11]); else { _e4.set(it[8] || 0, it[9] || 0, it[10] || 0, 'XYZ'); _q4.setFromEuler(_e4); }
      _v4.set(it[2], it[3], it[4]); _s4.set(it[5], it[6], it[7]); _m4.compose(_v4, _q4, _s4); nm.getNormalMatrix(_m4); _c4.set(it[1]);
      for (var i = 0; i < A.count; i++, o++) {
        _v5.fromBufferAttribute(A, i).applyMatrix4(_m4); pos[o * 3] = _v5.x; pos[o * 3 + 1] = _v5.y; pos[o * 3 + 2] = _v5.z;
        _v5.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nor[o * 3] = _v5.x; nor[o * 3 + 1] = _v5.y; nor[o * 3 + 2] = _v5.z;
        col[o * 3] = _c4.r; col[o * 3 + 1] = _c4.g; col[o * 3 + 2] = _c4.b;
      }
    });
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
    return new THREE.Mesh(geo, KMAT);
  }
  // a cylinder (limb, tube) from point a to point b
  function seg(col, a, b, r) { var d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); var q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()); return ['cyl', col, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, r, L, r, 0, 0, 0, q]; }
  function placeSeg(m, a, b) { _v4.subVectors(b, a); var L = _v4.length(); m.position.copy(a).addScaledVector(_v4, 0.5); m.quaternion.setFromUnitVectors(_up, _v4.normalize()); m.scale.set(1, L, 1); }
  var WHEEL_TILT = -0.75, WHEEL_POS = new THREE.Vector3(0, 0.6, -0.1), GRIP = 0.17;
  function kartDetailed(color, suit) {
    var g = new THREE.Group(), CH = 0xd8dce4, DK = 0x1c1c22, SEAT = 0x26262c, ENG = 0x9096a0, ENGD = 0x50545c, L = [];
    // chassis, bodywork and the engine on the back
    L.push(['box', DK, 0, 0.12, 0, 0.95, 0.04, 2.3]);
    L.push(seg(CH, [-0.5, 0.2, -1.12], [-0.5, 0.2, 1.12], 0.035), seg(CH, [0.5, 0.2, -1.12], [0.5, 0.2, 1.12], 0.035), seg(CH, [-0.5, 0.2, -1.08], [0.5, 0.2, -1.08], 0.03), seg(CH, [-0.5, 0.2, 0.92], [0.5, 0.2, 0.92], 0.03));
    L.push(['box', color, 0, 0.3, -1.34, 1.18, 0.22, 0.46, -0.22, 0, 0], ['box', color, 0, 0.42, -1.18, 0.62, 0.3, 0.06, -0.35, 0, 0], ['box', 0xffffff, 0, 0.44, -1.215, 0.34, 0.2, 0.02, -0.35, 0, 0], ['box', 0x111111, 0, 0.44, -1.228, 0.12, 0.13, 0.01, -0.35, 0, 0]);
    L.push(['box', color, -0.77, 0.27, 0.06, 0.2, 0.2, 0.95], ['box', color, 0.77, 0.27, 0.06, 0.2, 0.2, 0.95], ['box', 0xffffff, -0.875, 0.3, 0.06, 0.02, 0.05, 0.9], ['box', 0xffffff, 0.875, 0.3, 0.06, 0.02, 0.05, 0.9]);
    L.push(seg(CH, [-0.74, 0.3, 1.4], [0.74, 0.3, 1.4], 0.035), seg(CH, [-0.74, 0.3, 1.4], [-0.6, 0.24, 1.12], 0.03), seg(CH, [0.74, 0.3, 1.4], [0.6, 0.24, 1.12], 0.03), seg(0x5a5a62, [-0.84, 0.29, 0.98], [0.84, 0.29, 0.98], 0.04));
    L.push(['box', SEAT, 0, 0.27, 0.42, 0.46, 0.12, 0.5], ['box', SEAT, 0, 0.6, 0.7, 0.46, 0.62, 0.1, 0.32, 0, 0], ['box', SEAT, -0.25, 0.45, 0.47, 0.06, 0.32, 0.52], ['box', SEAT, 0.25, 0.45, 0.47, 0.06, 0.32, 0.52]);
    L.push(['box', ENG, 0.32, 0.43, 1.0, 0.3, 0.3, 0.28], ['box', ENGD, 0.32, 0.3, 1.0, 0.34, 0.06, 0.32]);
    for (var k = 0; k < 5; k++) L.push(['box', ENGD, 0.32, 0.61 + k * 0.035, 1.0, 0.36, 0.014, 0.32]);
    L.push(['box', 0x2a2a2e, 0.32, 0.8, 1.0, 0.08, 0.06, 0.08], seg(0xd8282a, [0.48, 0.47, 0.96], [0.72, 0.47, 0.96], 0.09), ['sph', 0xd8282a, 0.72, 0.47, 0.96, 0.09, 0.09, 0.09]);
    L.push(seg(CH, [0.2, 0.42, 1.12], [0.05, 0.42, 1.3], 0.03), seg(0xb0b4bc, [-0.32, 0.43, 1.3], [0.12, 0.43, 1.3], 0.075), ['cyl', 0x2a2a2e, 0.43, 0.29, 0.98, 0.11, 0.02, 0.11, 0, 0, Math.PI / 2]);
    L.push(['cyl', 0xf2f2f2, 0, 0.24, -0.45, 0.07, 0.14, 0.07], ['cyl', 0x2a2a2e, 0, 0.32, -0.45, 0.03, 0.04, 0.03], seg(0x3a3a40, [0, 0.3, -0.62], [WHEEL_POS.x, WHEEL_POS.y, WHEEL_POS.z], 0.025));
    L.push(['box', 0x8a8a92, -0.12, 0.22, -0.94, 0.07, 0.12, 0.03], ['box', 0x8a8a92, 0.12, 0.22, -0.94, 0.07, 0.12, 0.03]);
    // the driver's legs out front to the pedals, feet in racing shoes
    [-1, 1].forEach(function (s) { L.push(seg(suit, [s * 0.11, 0.34, 0.32], [s * 0.16, 0.42, -0.25], 0.085), seg(suit, [s * 0.16, 0.42, -0.25], [s * 0.13, 0.28, -0.86], 0.07), ['box', suit, s * 0.13, 0.26, -0.92, 0.12, 0.11, 0.24, -0.4, 0, 0], ['box', 0xf2f2f2, s * 0.13, 0.21, -0.94, 0.125, 0.03, 0.25, -0.4, 0, 0], ['box', 0xf2f2f2, s * 0.13, 0.32, -0.87, 0.06, 0.02, 0.1, -0.4, 0, 0]); });
    var body = mergeParts(L); g.add(body);
    // torso (suit with a white stripe) and helmet: kept separate so the first-person view can hide them
    var torso = mergeParts([['box', suit, 0, 0.66, 0.46, 0.42, 0.46, 0.25, 0.28, 0, 0], ['box', 0xffffff, 0, 0.68, 0.33, 0.06, 0.4, 0.02, 0.28, 0, 0], ['sph', suit, -0.21, 0.83, 0.4, 0.09, 0.09, 0.09], ['sph', suit, 0.21, 0.83, 0.4, 0.09, 0.09, 0.09]]); g.add(torso);
    var head = new THREE.Group(); head.position.set(0, 1.0, 0.38); head.add(mergeParts([['sph', 0xf4f4f4, 0, 0, 0, 0.2, 0.21, 0.22], ['box', color, 0, 0.17, 0.02, 0.06, 0.08, 0.36], ['sph', 0x1a2a4a, 0, 0.01, -0.13, 0.15, 0.08, 0.11], ['box', color, 0, -0.17, 0.03, 0.3, 0.05, 0.3]])); g.add(head);
    // steering wheel (tilted toward the driver) with the gloved hands on it
    var wp = new THREE.Group(); wp.position.copy(WHEEL_POS); wp.rotation.x = WHEEL_TILT; g.add(wp);
    var ws = new THREE.Group(); wp.add(ws);
    ws.add(mergeParts([['tor', 0x1a1a1e, 0, 0, 0, GRIP, GRIP, GRIP * 1.5], ['box', 0x3a3a40, 0, 0, 0, GRIP * 1.9, 0.03, 0.02], ['box', 0x3a3a40, 0, -GRIP * 0.5, 0, 0.03, GRIP, 0.02], ['cyl', 0xd8282a, 0, 0, 0.01, 0.045, 0.03, 0.045, Math.PI / 2, 0, 0]]));
    var gloveL = mergeParts([['sph', 0x222228, 0, 0, 0, 0.06, 0.065, 0.055], ['box', color, 0, 0.0, 0.035, 0.065, 0.035, 0.02], ['sph', 0x222228, 0.035, -0.02, -0.03, 0.025, 0.04, 0.025]]), gloveR = gloveL.clone();
    g.add(gloveL); g.add(gloveR);
    var armMat = new THREE.MeshLambertMaterial({ color: suit }), armGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
    var arms = [0, 1, 2, 3].map(function (i) { var m = new THREE.Mesh(armGeo, armMat); m.scale.set(i % 2 ? 0.04 : 0.05, 1, i % 2 ? 0.04 : 0.05); g.add(m); return m; });
    arms.forEach(function (m) { m.userData.r = m.scale.x; });
    // wheels: fat slicks with silver rims; they spin, the front ones steer
    var tireF = mergeParts([['cyl', 0x141416, 0, 0, 0, 0.25, 0.2, 0.25, 0, 0, Math.PI / 2], ['cyl', 0xc8ccd4, 0, 0, 0, 0.15, 0.21, 0.15, 0, 0, Math.PI / 2], ['cyl', 0x6a6e76, 0, 0, 0, 0.05, 0.23, 0.05, 0, 0, Math.PI / 2]]);
    var tireR = mergeParts([['cyl', 0x141416, 0, 0, 0, 0.28, 0.3, 0.28, 0, 0, Math.PI / 2], ['cyl', 0xc8ccd4, 0, 0, 0, 0.17, 0.31, 0.17, 0, 0, Math.PI / 2], ['cyl', 0x6a6e76, 0, 0, 0, 0.05, 0.33, 0.05, 0, 0, Math.PI / 2]]);
    var wheels = [[-0.76, 0.25, -0.92, tireF, true], [0.76, 0.25, -0.92, tireF, true], [-0.84, 0.28, 0.98, tireR, false], [0.84, 0.28, 0.98, tireR, false]].map(function (w, i) { var piv = new THREE.Group(); piv.position.set(w[0], w[1], w[2]); var m = i ? w[3].clone() : w[3]; piv.add(m); g.add(piv); return { piv: piv, m: m, front: w[4] }; });
    g.userData = { kart: true, head: head, torso: torso, wp: wp, ws: ws, gloves: [gloveL, gloveR], arms: arms, wheels: wheels, roll: 0 };
    return g;
  }
  var _sh = new THREE.Vector3(), _el = new THREE.Vector3(), _hd = new THREE.Vector3();
  // hands on the wheel (or one swinging out in a punch), arms following, wheels rolling, head bobbing from hits
  function animateKart(r, dt) {
    var u = r.mesh.userData; if (!u.kart) return;
    r.steerVis = (r.steerVis || 0) + ((r.steerIn || 0) - (r.steerVis || 0)) * Math.min(1, dt * 10);
    var sp = r.steerVis * 1.25; u.ws.rotation.z = sp;
    u.wheels.forEach(function (w) { w.m.rotation.x -= (r.spd / (w.front ? 0.25 : 0.28)) * dt; if (w.front) w.piv.rotation.y = r.steerVis * 0.45; });
    var hitK = r.hitT > 0 ? r.hitT / 0.35 : 0; u.head.rotation.z = (r.hitSide || 0) * 0.5 * hitK; u.head.position.x = (r.hitSide || 0) * 0.06 * hitK;
    for (var i = 0; i < 2; i++) {
      var s = i ? 1 : -1, ct = Math.cos(WHEEL_TILT), st = Math.sin(WHEEL_TILT);
      // grip point on the rim, turned with the wheel, then tilted and moved to the column top
      var gx = s * GRIP * Math.cos(sp), gy = s * GRIP * Math.sin(sp);
      _hd.set(WHEEL_POS.x + gx, WHEEL_POS.y + gy * ct, WHEEL_POS.z + gy * st);
      var pu = r.punchT > 0 && r.punchSide === s ? Math.sin(Math.min(1, (0.35 - r.punchT) / 0.35) * Math.PI) : 0;
      if (pu > 0) _hd.lerp(_v5.set(s * 0.95, 0.86, -0.42), pu);
      _sh.set(s * 0.21, 0.83, 0.4);
      _el.set((_sh.x + _hd.x) / 2 + s * 0.09 * (1 - pu), (_sh.y + _hd.y) / 2 - 0.12 * (1 - pu), (_sh.z + _hd.z) / 2 + 0.04);
      placeSeg(u.arms[i * 2], _sh, _el); u.arms[i * 2].scale.x = u.arms[i * 2].scale.z = u.arms[i * 2].userData.r;
      placeSeg(u.arms[i * 2 + 1], _el, _hd); u.arms[i * 2 + 1].scale.x = u.arms[i * 2 + 1].scale.z = u.arms[i * 2 + 1].userData.r;
      u.gloves[i].position.copy(_hd); u.gloves[i].scale.setScalar(1 + pu * 0.6);
    }
  }
  function kartMesh(color, hover) {
    var g = new THREE.Group();
    if (!hover && cfg && cfg.style === 'kart') return kartDetailed(color, color);
    if (hover) {
      var body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4, 4), new THREE.MeshLambertMaterial({ color: color, emissive: 0x111122 })); body.rotation.x = -Math.PI / 2; body.rotation.y = Math.PI / 4; body.position.y = 0.9; body.scale.set(1.3, 1, 0.5);
      var wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.2), new THREE.MeshLambertMaterial({ color: 0xdddddd })); wing.position.set(0, 0.8, 0.9);
      var glow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.2), new THREE.MeshBasicMaterial({ color: 0x46d0ff })); glow.position.set(0, 0.9, 1.9);
      var cock = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0x9ad8ff })); cock.position.set(0, 1.3, -0.2);
      g.add(body, wing, glow, cock);
    } else {
      var base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3), new THREE.MeshLambertMaterial({ color: color })); base.position.y = 0.6;
      var nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.8), new THREE.MeshLambertMaterial({ color: color })); nose.position.set(0, 0.6, -1.8);
      var seat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: 0x222222 })); seat.position.set(0, 1.0, 0.5);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff })); head.position.set(0, 1.6, 0.4);
      var visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.1), new THREE.MeshLambertMaterial({ color: 0x222244 })); visor.position.set(0, 1.62, -0.02);
      g.add(base, nose, seat, head, visor);
      [[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].forEach(function (w) { var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0x111111 })); wh.rotation.z = Math.PI / 2; wh.position.set(w[0], 0.42, w[1]); g.add(wh); });
    }
    return g;
  }
  function spawnRacers() {
    racers = [];
    var total = cfg.cpus + 1, W2 = tr.width / 2;
    for (var k = 0; k < total; k++) {
      var row = Math.floor(k / 2), lane = (k % 2 ? 1 : -1) * W2 * 0.4, i0 = (N - 6 - row * 7 + N) % N, p = pts[i0];
      var r = { cpu: k < total - 1, color: cfg.colors[k % cfg.colors.length], x: p.x + p.side.x * lane, z: p.z + p.side.z * lane, ang: Math.atan2(p.dir.x, p.dir.z), spd: 0, idx: i0, prog: i0 - N, lap: 0, spin: 0, boost: 0, item: null, lane: lane, skill: 0.88 + Math.random() * 0.1 + k * 0.012, energy: 100, done: false, pushX: 0, pushZ: 0, punchT: 0, punchCd: 1 + Math.random() * 2, hitT: 0 };
      r.mesh = kartMesh(r.color, cfg.style === 'hover'); scene.add(r.mesh); racers.push(r);
    }
    me = racers[racers.length - 1]; me.cpu = false; me.skill = 1;
    me.mesh.userData.mine = true;
  }
  R.start = function (c, trackIndex) {
    cfg = c; trackIdx = trackIndex; tr = cfg.tracks[trackIndex];
    if (!renderer) setup();
    buildTrack(tr); spawnRacers();
    state = 'count'; countdown = 3.5; raceT = 0; msg = ''; msgT = 0; finishOrder = []; camPos = null; shakeT = 0;
    if (R.fp == null) R.fp = cfg.style === 'kart';
  };
  R.stop = function () { state = 'idle'; };
  // call from K.run's update so input flags line up with the kit
  R.tick = function (dt) { if (renderer && state && state !== 'idle') { step(dt); render(performance.now()); } };

  function step(dt) {
    if (state === 'count') { var b = Math.ceil(countdown); countdown -= dt; if (Math.ceil(countdown) !== b && countdown > 0 && countdown < 3) K.beep(440, 0.15, { vol: 0.06 }); if (countdown <= 0) { state = 'race'; K.beep(880, 0.4, { vol: 0.07 }); } racers.forEach(place3d); return; }
    if (state === 'done') { racers.forEach(function (r) { drive(r, dt, true); }); return; }
    raceT += dt; if (msgT > 0) msgT -= dt;
    racers.forEach(function (r) { drive(r, dt, false); });
    if (cfg.style === 'kart') punches(dt);
    // bump
    for (var i = 0; i < racers.length; i++) for (var j = i + 1; j < racers.length; j++) { var a = racers[i], b2 = racers[j], dx = b2.x - a.x, dz = b2.z - a.z, d = Math.hypot(dx, dz); if (d < 2.2 && d > 0) { var push = (2.2 - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b2.x += dx / d * push; b2.z += dz / d * push; } }
    // items
    if (cfg.items) {
      boxes.forEach(function (bx) { if (bx.t > 0) { bx.t -= dt; bx.m.visible = bx.t <= 0; } bx.m.rotation.y += dt * 2; bx.m.rotation.x += dt; if (bx.m.visible) racers.forEach(function (r) { if (!r.item && Math.hypot(r.x - bx.m.position.x, r.z - bx.m.position.z) < 1.8) { bx.t = 3; bx.m.visible = false; r.item = ['turbo', 'oil', 'bolt', 'turbo'][Math.floor(Math.random() * 4)]; r.itemT = 1 + Math.random() * 3; if (!r.cpu) K.tune([660, 880], 0.05); } }); });
      racers.forEach(function (r) { if (r.item && r.cpu) { r.itemT -= dt; if (r.itemT <= 0) useItem(r); } });
      if (K.hit('a') && me.item) useItem(me);
      slicks.forEach(function (s) { s.t -= dt; racers.forEach(function (r) { if (s.t < 4.5 && r.spin <= 0 && Math.hypot(r.x - s.m.position.x, r.z - s.m.position.z) < 1.6) { r.spin = 1.2; s.t = 0; if (!r.cpu) { K.beep(200, 0.4, { to: 80, vol: 0.06 }); say('OIL SLICK!'); } } }); if (s.t <= 0) scene.remove(s.m); }); slicks = slicks.filter(function (s) { return s.t > 0; });
      bolts.forEach(function (bo) { bo.t -= dt; var tg = bo.target; if (tg) { var dx = tg.x - bo.m.position.x, dz = tg.z - bo.m.position.z, d = Math.hypot(dx, dz); bo.m.position.x += dx / d * 70 * dt; bo.m.position.z += dz / d * 70 * dt; if (d < 1.8) { tg.spin = 1.4; bo.t = 0; if (!tg.cpu) { K.beep(150, 0.4, { to: 60, vol: 0.07 }); say('ZAPPED!'); } } } if (bo.t <= 0) scene.remove(bo.m); }); bolts = bolts.filter(function (b3) { return b3.t > 0; });
    }
    // finish
    racers.forEach(function (r) {
      if (!r.done && r.lap >= cfg.laps) { r.done = true; r.time = raceT; finishOrder.push(r); if (r === me) { state = 'done'; var place = finishOrder.length; K.tune(place === 1 ? [523, 659, 784, 1047, 1319] : [523, 659, 784], 0.12); setTimeout(function () { cfg.onFinish(place, raceT, trackIdx); }, 2200); } }
    });
  }
  // who's alongside r: within reach to the left or right and roughly level
  function beside(r) {
    var best = null, fx = Math.sin(r.ang), fz = Math.cos(r.ang), rx = -fz, rz = fx;
    racers.forEach(function (o) { if (o === r || o.done) return; var dx = o.x - r.x, dz = o.z - r.z, lat = dx * rx + dz * rz, along = dx * fx + dz * fz; if (Math.abs(lat) > 0.8 && Math.abs(lat) < 3.3 && Math.abs(along) < 2.2) { var d = Math.abs(lat) + Math.abs(along) * 0.5; if (!best || d < best.d) best = { o: o, d: d, side: lat < 0 ? -1 : 1 }; } });
    return best;
  }
  // a punch shoves the kart beside you sideways (maybe spinning it out, maybe right off the track)
  function punch(r) {
    var nb = beside(r); r.punchCd = r.cpu ? 2.2 + Math.random() * 2 : 0.7; r.punchT = 0.35; r.punchSide = nb ? nb.side : (r.steerIn > 0 ? -1 : 1);
    if (r === me) K.beep(220, 0.08, { type: 'square', to: 120, vol: 0.05 });
    if (!nb) return;
    var o = nb.o, fx = Math.sin(r.ang), fz = Math.cos(r.ang), rx = -fz * nb.side, rz = fx * nb.side;
    o.pushX += rx * 11; o.pushZ += rz * 11; o.spd *= 0.72; o.hitT = 0.35; o.hitSide = nb.side;
    var spin = Math.random() < (r === me ? 0.45 : 0.25); if (spin) o.spin = 0.85;
    if (o === me) { shakeT = 0.4; K.noise(0.2, 0.3); say(spin ? 'PUNCHED! SPUN OUT!' : 'PUNCHED!'); }
    if (r === me) { K.noise(0.15, 0.3); K.beep(110, 0.15, { type: 'square', vol: 0.06 }); say(spin ? 'SPUN HIM OUT!' : 'POW!'); }
    o.knockCheck = 1.2; o.knockBy = r;
  }
  function punches(dt) {
    if (K.hit('c') && me.punchCd <= 0 && state === 'race') punch(me);
    racers.forEach(function (r) {
      if (r.cpu && r.punchCd <= 0 && r.spin <= 0 && state === 'race' && Math.random() < dt * 1.4) { var nb = beside(r); if (nb) punch(r); }
      // knocked off the course?
      if (r.knockCheck > 0) { r.knockCheck -= dt; var p = pts[r.idx], lo = Math.abs((r.x - p.x) * p.side.x + (r.z - p.z) * p.side.z); if (lo > tr.width / 2 + 1) { r.knockCheck = 0; if (r.knockBy === me) say('KNOCKED HIM OFF THE TRACK!'); else if (r === me) say('KNOCKED OFF!'); } }
    });
  }
  R.view = function () { R.fp = !R.fp; };
  R.debug = function () { return { racers: racers, me: me, beside: beside, punch: punch, state: state }; };   // for automated tests
  function useItem(r) {
    var it = r.item; r.item = null;
    if (it === 'turbo') { r.boost = 1.6; if (!r.cpu) K.beep(300, 0.4, { to: 1200, vol: 0.06 }); }
    if (it === 'oil') { var m = new THREE.Mesh(new THREE.CircleGeometry(1.4, 12), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set(r.x - Math.sin(r.ang) * 3, (r.y || 0) + 0.07, r.z - Math.cos(r.ang) * 3); scene.add(m); slicks.push({ m: m, t: 5 }); }
    if (it === 'bolt') { var ahead = racers.filter(function (o) { return o !== r && o.prog > r.prog; }).sort(function (a, b) { return a.prog - b.prog; })[0] || racers.filter(function (o) { return o !== r; })[0]; var bm = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0x46d0ff })); bm.position.set(r.x, (r.y || 0) + 1.2, r.z); scene.add(bm); bolts.push({ m: bm, t: 4, target: ahead }); if (!r.cpu) K.beep(900, 0.3, { to: 300, vol: 0.05 }); }
  }
  function say(t) { msg = t; msgT = 1.2; }
  function drive(r, dt, coast) {
    var W2 = tr.width / 2, maxS = cfg.maxSpeed * (r.cpu ? r.skill : 1), steer = 0, gas = 1, brake = 0;
    var nr = nearest({ x: r.x, z: r.z }, r.idx); var di = nr.i - r.idx; if (di < -N / 2) di += N; if (di > N / 2) di -= N; r.idx = nr.i; r.prog += di;
    if (r.prog >= (r.lap + 1) * N) { r.lap++; if (r === me && r.lap < cfg.laps && state === 'race') { say(r.lap === cfg.laps - 1 ? 'FINAL LAP!' : 'LAP ' + (r.lap + 1)); K.tune([659, 880], 0.08); } }
    var p = pts[r.idx], latOff = (r.x - p.x) * p.side.x + (r.z - p.z) * p.side.z;
    if (r.cpu || coast || R.autopilot) { // R.autopilot: lets the computer drive your kart (for testing)
      var look = pts[(r.idx + 14) % N], tx = look.x + look.side.x * r.lane, tz = look.z + look.side.z * r.lane;
      var want = Math.atan2(tx - r.x, tz - r.z), da = want - r.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; steer = Math.max(-1, Math.min(1, da * 2.5));
      if (Math.random() < dt * 0.3) r.lane = (Math.random() - 0.5) * W2 * 0.8;
      // rubber band so races stay close
      if (r.cpu) { var gap = (me.prog - r.prog) / N; maxS *= 1 + Math.max(-0.12, Math.min(0.12, gap * 0.6)); }
      if (coast) gas = 0.5;
    } else {
      steer = (K.down('right') ? 1 : 0) - (K.down('left') ? 1 : 0);
      if (R.touchX != null) steer = Math.max(-1, Math.min(1, R.touchX * 2));
      brake = K.down('down') || K.down('b') ? 1 : 0; if (brake) gas = 0;
      steer = -steer;
    }
    r.steerIn = steer;
    if (r.pushX || r.pushZ) { r.x += r.pushX * dt; r.z += r.pushZ * dt; var dmp = Math.exp(-3.2 * dt); r.pushX *= dmp; r.pushZ *= dmp; if (Math.abs(r.pushX) + Math.abs(r.pushZ) < 0.2) r.pushX = r.pushZ = 0; }
    if (r.hitT > 0) r.hitT -= dt; if (r.punchT > 0) r.punchT -= dt; if (r.punchCd > 0) r.punchCd -= dt;
    if (r.spin > 0) { r.spin -= dt; r.ang += dt * 12; r.spd *= Math.pow(0.2, dt); place3d(r); return; }
    var off = Math.abs(latOff) > W2;
    if (cfg.style === 'hover' && Math.abs(latOff) > W2 + 0.4) { var back = Math.sign(latOff) * (Math.abs(latOff) - W2 - 0.4); r.x -= p.side.x * back; r.z -= p.side.z * back; r.spd *= 0.92; if (r.energy != null && cfg.energy) { r.energy -= 30 * dt; if (r === me && Math.random() < 0.3) K.beep(120, 0.05, { vol: 0.05 }); } off = false; }
    if (r.boost > 0) { r.boost -= dt; maxS *= 1.45; }
    if (cfg.boostPads) pads.forEach(function (pd) { var pp = pts[pd.i]; var lo = (r.x - pp.x) * pp.side.x + (r.z - pp.z) * pp.side.z, along = (r.x - pp.x) * pp.dir.x + (r.z - pp.z) * pp.dir.z; if (Math.abs(lo - pd.lane) < 2.2 && Math.abs(along) < 3 && r.boost <= 0) { r.boost = 1; if (r === me) { K.beep(400, 0.3, { to: 1400, vol: 0.06 }); } if (cfg.energy) r.energy = Math.min(100, r.energy + 15); } });
    if (off) maxS *= 0.5;
    var accel = r.spd < maxS ? (gas * maxS * 0.55) : -(r.spd - maxS) * 2;
    r.spd += accel * dt - brake * 40 * dt;
    if (HILLS) { var along = Math.sin(r.ang) * p.dir.x + Math.cos(r.ang) * p.dir.z; r.pitch = Math.atan(p.slope * along); r.spd -= p.slope * along * 30 * dt; }
    r.spd = Math.max(0, r.spd);
    var turnRate = (cfg.style === 'hover' ? 1.9 : 2.2) * Math.min(1, r.spd / 12 + 0.2);
    r.ang += steer * turnRate * dt;
    r.x += Math.sin(r.ang) * r.spd * dt; r.z += Math.cos(r.ang) * r.spd * dt;
    if (cfg.energy && r === me && r.energy <= 0 && state === 'race') { state = 'done'; K.tune([392, 262, 196], 0.2, { type: 'sawtooth' }); say('OUT OF ENERGY!'); setTimeout(function () { cfg.onFinish(cfg.cpus + 1, raceT, trackIdx, true); }, 1800); }
    r.lean = (r.lean || 0) * 0.85 + steer * 0.15;
    place3d(r);
  }
  function place3d(r) { if (r.mesh.userData.kart) animateKart(r, 1 / 60); r.y = HILLS ? heightAt(r) : 0; r.mesh.position.set(r.x, r.y + (cfg.style === 'hover' ? 0.5 + Math.sin(performance.now() / 300 + r.x) * 0.15 : 0), r.z); r.mesh.rotation.order = 'YXZ'; r.mesh.rotation.set(HILLS ? (r.pitch || 0) : 0, r.ang + Math.PI, 0); if (cfg.style === 'hover') r.mesh.rotation.z = (r.lean || 0) * 0.5; }
  function position() { var sorted = racers.slice().sort(function (a, b) { if (a.done && b.done) return a.time - b.time; if (a.done) return -1; if (b.done) return 1; return b.prog - a.prog; }); return sorted.indexOf(me) + 1; }
  var _eye = new THREE.Vector3(), _look = new THREE.Vector3();
  function render(t) {
    var fp = R.fp && cfg.style === 'kart', mu = me.mesh.userData;
    // from the seat you see your forearms and gloves on the wheel; the upper arms, helmet and chest are behind the camera
    if (mu.kart) { mu.head.visible = !fp; mu.torso.visible = !fp; mu.arms[0].visible = mu.arms[2].visible = !fp; }
    if (fp) {
      // the driver's eyes: hands on the wheel, your feet and the front tires below, the track ahead
      me.mesh.updateMatrixWorld(true);
      _eye.set(0, 1.14, 0.27); me.mesh.localToWorld(_eye);
      _look.set(0, -0.9, -8); me.mesh.localToWorld(_look);
      var sh = shakeT > 0 ? shakeT * 0.12 : 0, vib = Math.min(1, me.spd / 26) * 0.006;
      camera.position.set(_eye.x + (Math.random() - 0.5) * (sh + vib), _eye.y + (Math.random() - 0.5) * (sh + vib), _eye.z + (Math.random() - 0.5) * (sh + vib));
      camera.lookAt(_look); camera.rotateZ(-(me.steerVis || 0) * 0.04);
      if (shakeT > 0) shakeT -= 1 / 60;
      camera.fov = (camera.aspect < 1 ? 86 : 68) + (me.boost > 0 ? 8 : 0) + me.spd * 0.05; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return hudDraw();
    }
    var back = cfg.style === 'kart' ? 7.2 : 10.5, my = me.y || 0, up = (cfg.style === 'kart' ? 3.6 : 5.6) + Math.max(my, HILLS ? pts[(me.idx - 7 + N) % N].y : 0), fx = me.x - Math.sin(me.ang) * back, fz = me.z - Math.cos(me.ang) * back;
    if (!camPos) camPos = new THREE.Vector3(fx, up, fz);
    camPos.lerp(new THREE.Vector3(fx, up, fz), 0.15);
    var ahead = HILLS ? pts[(me.idx + 5) % N].y : 0;
    camera.position.copy(camPos); camera.lookAt(me.x + Math.sin(me.ang) * 7, 1.6 + (HILLS ? (my + ahead) / 2 : 0), me.z + Math.cos(me.ang) * 6);
    camera.fov = 65 + (me.boost > 0 ? 10 : 0) + me.spd * 0.08; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    hudDraw();
  }
  function hudDraw() {
    // HUD overlay
    var w = hudC._w, h = hudC._h, c = hud; c.clearRect(0, 0, w, h);
    var pos = position(), sfx = ['th', 'st', 'nd', 'rd'][pos <= 3 ? pos : 0];
    txt(c, pos + sfx, 14, 34, 30, '#ffd23f', 'left');
    txt(c, 'LAP ' + Math.min(cfg.laps, me.lap + 1) + '/' + cfg.laps, w - 14, 30, 16, '#fff', 'right');
    txt(c, Math.round(me.spd * (cfg.style === 'hover' ? 9 : 4.2)) + (cfg.style === 'hover' ? ' KPH' : ' MPH'), w - 14, h - 16, 14, '#fff', 'right');
    if (cfg.items) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(14, 46, 46, 46); c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.strokeRect(14, 46, 46, 46); if (me.item) txt(c, { turbo: '⇧', oil: '●', bolt: '⚡' }[me.item], 37, 70, 26, { turbo: '#ff8a1f', oil: '#aaa', bolt: '#46d0ff' }[me.item], 'center'); txt(c, me.item ? 'TAP ITEM' : 'ITEM', 37, 104, 9, '#fff', 'center'); }
    if (cfg.energy) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(14, 50, 100, 10); c.fillStyle = me.energy < 30 ? '#ff3b5c' : '#46d0ff'; c.fillRect(15, 51, 98 * Math.max(0, me.energy) / 100, 8); txt(c, 'ENERGY', 14, 74, 10, '#fff', 'left'); }
    // minimap
    var mx = w - 84, my = 44, ms = 70, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    pts.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    var sc = ms / Math.max(maxX - minX, maxZ - minZ);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(mx - 4, my - 4, ms + 8, ms + 8); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath();
    pts.forEach(function (p, i) { if (i % 6) return; var X = mx + (p.x - minX) * sc, Y = my + (p.z - minZ) * sc; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke();
    racers.forEach(function (r) { c.fillStyle = r === me ? '#ffd23f' : '#' + r.color.toString(16).padStart(6, '0'); c.beginPath(); c.arc(mx + (r.x - minX) * sc, my + (r.z - minZ) * sc, r === me ? 4 : 2.5, 0, 7); c.fill(); });
    if (state === 'count') txt(c, countdown > 3 ? 'READY' : countdown > 0 ? String(Math.ceil(countdown)) : 'GO!', w / 2, h * 0.38, 48, '#fff', 'center');
    if (state === 'race' && raceT < 1) txt(c, 'GO!', w / 2, h * 0.38, 48, '#7cff6b', 'center');
    if (msgT > 0) txt(c, msg, w / 2, h * 0.3, 24, '#ffd23f', 'center');
    if (cfg.style === 'kart' && state === 'race') { var nb = beside(me); if (nb && me.punchCd <= 0) txt(c, nb.side < 0 ? '◀ PUNCH!' : 'PUNCH! ▶', w / 2, h * 0.47, 18, '#ff5a36', 'center'); }
    if (state === 'done') txt(c, 'FINISH! ' + (finishOrder.indexOf(me) + 1 || '') + (finishOrder.indexOf(me) >= 0 ? ['ST', 'ND', 'RD'][finishOrder.indexOf(me)] || 'TH' : ''), w / 2, h * 0.38, 30, '#fff', 'center');
  }
  function txt(c, s, x, y, size, col, align) { c.font = size + 'px Bungee, Impact, sans-serif'; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(s, x + 2, y + 2); c.fillStyle = col; c.fillText(s, x, y); }
  window.R = R;
})();
