/* Roster: pick-your-player heroes for the side-scrollers.
   Two hand-made pixel heroes, built by a small rig: hand-drawn heads and torsos, drawn arms and legs,
   curly hair, automatic shading, contact shadows and outlines. Each pose is painted once into a tiny
   canvas and cached, then scaled up crisply (whole device pixels, no blur).

   Roster.offer({ classic: 'Bo', thumb: fn })  add the pick screen to this game's start card
                                               (thumb(ctx, w, h) may draw the game's own hero;
                                               thumbs: { her: fn, him: fn } draws Desire'e and J.T.
                                               in the game's own style; hd: 3 draws thumbnails sharp)
   Roster.on()                                 true when one of the two heroes is picked
   Roster.id()                                 'classic', 'her' or 'him'
   Roster.draw(c, pose, x, y, face, h, opt)    draw the picked hero with its feet at (x, y), facing
                                               1 / -1, standing h game units tall.
                                               pose: 'idle', 'run', 'jump', 'fall', 'crouch', 'crawl', 'hurt',
                                                     'throw', 'slash', 'hammer', 'ride', 'tuck', 'win' ...
                                               opt: { t, phase, aim, v (variant), alpha, at: 'feet' | 'seat' }
   Roster.frame(id, key, variant)              the cached frame canvas (36 x 52) for a pose key
*/
(function () {
  'use strict';
  var R = {};
  var FW = 36, FH = 52, OX = 2, OY = 2, LX = 0.55, LY = -0.83, BODY_H = 49, FOOT_X = 18, FOOT_Y = 51, SEAT_Y = 34;
  var STORE = 'pl-hero';

  // ------------------------------------------------------------------ palettes  char: [colour, group]
  var HER_PAL = {
    k: ['#30303c', 'beanie'], l: ['#4c4c5c', 'beanie'], K: ['#1c1c26', 'beanie'], w: ['#c8c8cc', 'label'],
    a: ['#fff4c4', 'hair'], b: ['#f2d488', 'hair'], c: ['#d8aa58', 'hair'], d: ['#ad7a38', 'hair'], e: ['#7a5022', 'hair'],
    1: ['#ffe2cc', 'skin'], 2: ['#f4c0a0', 'skin'], 3: ['#d9977c', 'skin'], 4: ['#b06c56', 'skin'], 5: ['#f2a496', 'skin'],
    W: ['#ffffff', 'eye'], g: ['#5f8c3e', 'eye'], E: ['#2c1a12', 'eye'],
    r: ['#c85c5c', 'mouth'], t: ['#ffffff', 'mouth'], R: ['#6c2626', 'mouth'],
    m: ['#f6ca62', 'hoodie'], n: ['#dda33e', 'hoodie'], p: ['#b67e28', 'hoodie'], q: ['#86581c', 'hoodie'],
    v: ['#f7f1e3', 'cream'], u: ['#d4c8ac', 'cream'],
    x: ['#4e4e62', 'black'], y: ['#30303e', 'black'], z: ['#1c1c26', 'black'],
    o: ['#ececf0', 'print']
  };
  var HIM_PAL = {
    h: ['#a38c78', 'hair'], H: ['#7c6856', 'hair'], j: ['#b9a38e', 'hair'],
    1: ['#f8cdb0', 'skin'], 2: ['#e3a684', 'skin'], 3: ['#c08064', 'skin'], 4: ['#925646', 'skin'], 5: ['#e8957e', 'skin'],
    s: ['#c79c84', 'stub'], S: ['#a17e6a', 'stub'],
    G: ['#15151b', 'glass'], L: ['#b9d0e2', 'lens'], l: ['#e8f4ff', 'lens'],
    g: ['#4a2e1c', 'eye'], W: ['#ffffff', 'eye'],
    r: ['#b0625a', 'mouth'], R: ['#6c3028', 'mouth'],
    m: ['#e6e8ec', 'tank'], n: ['#bfc3cb', 'tank'], p: ['#959aa4', 'tank'], q: ['#6c707a', 'tank'],
    T: ['#3c4a5e', 'tattoo'], U: ['#56667e', 'tattoo'],
    x: ['#56688c', 'jeans'], y: ['#3c4a68', 'jeans'], z: ['#273046', 'jeans'],
    B: ['#4a3424', 'belt'], b: ['#d8b860', 'belt'],
    k: ['#4a3a30', 'boot'], K: ['#2e241e', 'boot'], c: ['#6a5444', 'boot'],
    A: ['#b8b8c0', 'glider'], C: ['#e8e8ee', 'glider'], D: ['#4a4a54', 'glider'], F: ['#ffb8c0', 'glider'], E: ['#0e0e12', 'glider']
  };
  // shared extras: props (gun, blade, hammer, claws) and the fox tail power
  var EXTRA = {
    6: ['#ffb45a', 'tail'], 7: ['#f08a2a', 'tail'], 8: ['#c8641a', 'tail'], 9: ['#8a4210', 'tail'], 0: ['#fffaf0', 'tail'],
    '!': ['#5c6470', 'gun'], '"': ['#2c3038', 'gun'], '#': ['#14161c', 'gun'],
    '$': ['#f4f8ff', 'blade'], '%': ['#b8c4d4', 'blade'], '&': ['#7a8698', 'blade'],
    '(': ['#a0703c', 'wood'], ')': ['#6a4422', 'wood'],
    '*': ['#c8ccd4', 'steel'], '+': ['#8a909c', 'steel'], ',': ['#5a606c', 'steel'],
    '-': ['#ffd23f', 'gold'], '/': ['#c89a10', 'gold']
  };
  var OUTLINE = {
    beanie: '#0c0c12', label: '#0c0c12', hair: '#5a3614', skin: '#7a3e2e', eye: '#2a1810', mouth: '#5a2020',
    hoodie: '#5a380c', cream: '#6a604c', black: '#0a0a10', print: '#0a0a10', stub: '#5a4030', glass: '#08080c',
    lens: '#08080c', tank: '#3c404a', tattoo: '#1c2430', jeans: '#141a28', belt: '#20160e', boot: '#140e0a',
    glider: '#2a2a32', tail: '#5a2a08', gun: '#08080a', blade: '#2a303a', wood: '#2a1808', steel: '#22262e', gold: '#5a4008'
  };
  var NO_SHADOW = { eye: 1, mouth: 1, print: 1, label: 1, lens: 1, glass: 1 };

  // ------------------------------------------------------------------ the two heroes
  var HER = {
    pal: HER_PAL, deep: { hair: 'e', skin: '4', hoodie: 'q', black: 'z', beanie: 'K', cream: 'u' },
    head: [
      '......kkkkkk......', '....kkkkkllllk....', '...kkkkkllllllk...', '..kkkkkkklllllkk..',
      '.kkkkkkkkklllkkkk.', '.kkkkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkkkk', 'KkKkKkKkKkKkKwKkKk',
      '........22ddd22dd.', '........22EEE22EE.', '........22Wgg22gE.', '........322222221.',
      '........3552222222', '........322222232.', '.........32rttttr.', '..........32rrrr..', '...........3222...'],
    ouch: { 9: '........22222222..', 10: '........2EEE22EE2.', 14: '.........32rRRr2..', 15: '..........32rr2...' },
    headAt: [7, 1],
    torso: [
      '......pnnnm....', '....qpnvnvmm...', '..qpnnnvnvmmm..', '.qppnnnvnvmmmn.', '.qpnnnnvnvnmmn.',
      '.qpnnnnvnvnnmn.', '.qpnnnnunvnnmn.', '.qppnnnnnvnnnn.', '..qppnnnnvnnnn.', '..qqpppppuppq..',
      '...yoyoyoyyyy..', '...yyoyyoyyyy..', '...xyyyyyyyyx..'],
    torsoAt: [9, 17],
    hairBack: [[9, 9, 2.0], [12, 9.5, 2.0], [14.5, 10, 1.6], [8, 12.5, 2.1], [11, 13, 2.2], [13.8, 13.5, 1.7],
      [7.8, 16, 2.1], [10.6, 16.6, 2.2], [13.4, 17, 1.8], [8, 19.5, 2.0], [10.8, 20.2, 2.0],
      [8.6, 23, 1.8], [11, 23.6, 1.6], [9.6, 26, 1.3]],
    hairFront: [[15.8, 18.8, 1.45], [16.3, 21.4, 1.3], [16.0, 23.8, 1.05]],
    hairSh: ['a', 'b', 'c', 'd', 'e'],
    boots: {
      flat: [['..zz..', '.zyyz.', 'zyyyxz', 'zzzzzz'], 2, 0],
      toe: [['.zz.', '.yyz', 'zyyx', '.yyx', '..zz'], 1, 0],
      tuck: [['.zz..', 'zyyz.', 'zyyyz', '.zzzz'], 2, 0]
    },
    shN: [19.5, 20], shF: [12.5, 20], hipN: [17, 31], hipF: [14, 31],
    upper: 5.1, fore: 4.1, thigh: 7, calf: 6.1,
    armN: [2.2, 2.0, 1.8], armF: [2.1, 1.9, 1.7], hand: [1.4, 1.3], legR: [2.3, 1.9, 1.5],
    sleeve: ['m', 'n', 'p'], skin: ['1', '2', '3'], leg: ['x', 'y', 'z'], stripes: [[0.05, 0.22, 'v', 'u']],
    over: {},
    variants: {
      fire: { m: '#ffb08a', n: '#ee5a42', p: '#b8302c', q: '#7c1c1c' },
      armor: { m: '#eef2f8', n: '#b8c4d2', p: '#8494a8', q: '#56606e', k: '#a8b4c4', l: '#e4ecf6', K: '#6a7686',
        x: '#a4b0c0', y: '#7a8698', z: '#4e5868', o: '#7a8698' }
    }
  };
  var HIM = {
    pal: HIM_PAL, deep: { hair: 'H', skin: '4', tank: 'q', jeans: 'z', boot: 'K', stub: 'S', tattoo: 'T' },
    head: [
      '.......HhhhH.....', '.....HhhjhhhhH...', '....HhhhhhjhhhH..', '...HhhjhhhhhhH1..', '...HhhhhhjhH1222.',
      '..HhhjhhhhH12222.', '..HhhhhjhH122222.', '..HhjhhH2HH222H2.', '..Hhh32GGGG2GGG..', '..Hh3242GWgGGGgG.',
      '..Hh3232GLlG2GLG2', '...H3222GGGG2GGG2', '...H3222222222232', '....3s2s2s2sss2..', '....3sSs2rrrrR2..',
      '.....sSsSsSs2s2..', '.......SsSsSsS...', '.........SsSs....'],
    ouch: { 9: '..Hh3242GGGGGGGG.', 13: '....3s2s2rRRr22..', 14: '....3sSs2sRRs2...' },
    headAt: [8, 1],
    torso: [
      '.....4322223.....', '...43322222233...', '..3222nm22mn222..', '.322nmmm22mmmn23.', '.32nmnmnmnmnmmn2.',
      '..3nmnmnmnmnmmn..', '..3nnmnmnmnmmmn..', '...pnmnmnmnmmn...', '...pnnmnmnmnmn...', '...pnnmnmnmnmn...',
      '...ppnnnnnnnnp...', '...BBBBBBbBBBB...', '...yyyyyyyyyyy...'],
    torsoAt: [8, 17],
    glider: ['.D..D.', 'DADAAD', 'AEACAA', 'FAACCA', '.AAAA.'], gliderAt: [7, 15],
    boots: {
      flat: [['.kkk...', 'kkkcc..', 'kkkkkkc', 'KKKKKKK'], 2, 0],
      toe: [['.kk.', '.kkc', 'kkkc', 'kkkc', '.KKK'], 1, 0],
      tuck: [['.kk...', 'kkkcc.', 'kkkkkc', 'KKKKKK'], 2, 0]
    },
    shN: [20.5, 20.5], shF: [11.5, 20.5], hipN: [18, 31], hipF: [14, 31],
    upper: 5.2, fore: 4.6, thigh: 7, calf: 6.1,
    armN: [2.7, 2.3, 1.9], armF: [2.5, 2.2, 1.8], hand: [1.7, 1.6], legR: [2.5, 2.1, 1.8],
    sleeve: ['1', '2', '3'], skin: ['1', '2', '3'], leg: ['x', 'y', 'z'], stripes: null, tattoo: true,
    // his big arms would hide his face when thrown up, so a few poses reach forward instead
    over: { jump: { armN: [68, 131] }, fall: { armN: [95, 142] } },
    variants: {
      fire: { m: '#ffb89a', n: '#ee5a42', p: '#b8302c', q: '#7c1c1c' },
      armor: { m: '#eef2f8', n: '#b8c4d2', p: '#8494a8', q: '#56606e', h: '#c4ccd8', H: '#7e8a9a', j: '#e8eef6',
        x: '#a4b0c0', y: '#7a8698', z: '#4e5868', k: '#8494a8', K: '#56606e', c: '#b8c4d2', B: '#6a7686' }
    }
  };
  var HEROES = { her: HER, him: HIM };

  // ------------------------------------------------------------------ poses
  // angles in degrees from straight down; 90 = forward, 180 = straight up, -90 = straight back.
  // arm: [upper arm, forearm]   leg: [thigh, shin]   bob: head and body drop   hip: hip drop
  var POSES = {
    idle0: { armN: [11, 0], armF: [-11, 0], legN: [4, 0], legF: [0, -5] },
    idle1: { bob: 1, armN: [11, 0], armF: [-11, 0], legN: [4, 0], legF: [0, -5] },
    run0: { armN: [-34, -36], armF: [45, 67], legN: [31, 23], legF: [-29, -41], bootF: 'toe', sway: -1 },
    run1: { bob: 1, hip: 1, armN: [-6, -7], armF: [0, 7], legN: [0, -20], legF: [48, -37], bootF: 'tuck', sway: -1 },
    run2: { armN: [32, 67], armF: [-29, -30], legN: [-36, -41], legF: [37, 27], bootN: 'toe', sway: -1 },
    run3: { bob: 1, hip: 1, armN: [0, 7], armF: [-6, -7], legN: [48, -34], legF: [0, -15], bootN: 'tuck', sway: -1 },
    jump: { armN: [102, 145], armF: [-50, -40], legN: [42, -27], legF: [-5, -34], bootN: 'tuck', bootF: 'toe', sway: 1 },
    fall: { armN: [117, 151], armF: [-122, -153], legN: [16, 10], legF: [-13, -20], bootF: 'toe', sway: 2 },
    crouch: { bob: 11, hip: 9, headY: 1, armN: [40, 80], armF: [25, 70], legN: [84, -58], legF: [76, -62], sway: 0 },
    crawl0: { bob: 11, hip: 9, headY: 1, armN: [55, 85], armF: [10, 50], legN: [88, -62], legF: [64, -50] },
    crawl1: { bob: 11, hip: 9, headY: 1, armN: [30, 70], armF: [35, 75], legN: [66, -52], legF: [88, -64] },
    hurt: { bob: 1, armN: [-128, -158], armF: [128, 156], legN: [25, -12], legF: [-22, -46], bootF: 'toe', sway: 2, face: 'ouch' },
    throw0: { armN: [-125, -160], armF: [45, 72], legN: [22, 6], legF: [-16, -8], sway: 1 },
    throw1: { armN: [84, 88], armF: [-32, -46], legN: [26, 10], legF: [-22, -14], sway: -1 },
    slash0: { armN: [-150, 170], armF: [30, 60], legN: [18, 4], legF: [-14, -8], prop: 'blade', propAng: 196, sway: 1 },
    slash1: { armN: [96, 92], armF: [-34, -40], legN: [34, 12], legF: [-30, -22], prop: 'blade', propAng: 90, sway: -1 },
    slash2: { armN: [50, 30], armF: [-46, -60], legN: [30, 14], legF: [-28, -20], prop: 'blade', propAng: 38, sway: -1 },
    hammer0: { armN: [168, 178], armF: [-20, -10], legN: [10, 2], legF: [-8, -6], prop: 'hammer', propAng: 178 },
    hammer1: { armN: [70, 40], armF: [-20, -10], legN: [16, 4], legF: [-10, -8], prop: 'hammer', propAng: 52 },
    ride0: { armN: [52, 84], armF: [40, 80], legN: [82, 4], legF: [70, -4], at: 'seat' },
    ride1: { bob: 1, armN: [56, 88], armF: [44, 84], legN: [84, 6], legF: [72, -2], at: 'seat' },
    tuck: { bob: 12, hip: 9, headY: 3, headX: 1, armN: [70, 150], armF: [60, 140], legN: [118, -20], legF: [108, -30], bootN: 'tuck', bootF: 'tuck' },
    fly0: { armN: [120, 110], armF: [-120, -110], legN: [-8, -20], legF: [-22, -34], bootN: 'toe', bootF: 'toe', sway: 2 },
    fly1: { armN: [100, 92], armF: [-100, -92], legN: [-14, -26], legF: [-28, -40], bootN: 'toe', bootF: 'toe', sway: 2 },
    win: { armN: [168, 176], armF: [-20, -6], legN: [6, 0], legF: [-4, -6] },
    climb0: { armN: [160, 175], armF: [120, 160], legN: [30, -20], legF: [-4, -6], bootN: 'tuck' },
    climb1: { armN: [120, 160], armF: [160, 175], legN: [-4, -6], legF: [30, -20], bootF: 'tuck' }
  };
  // arm overrides for games that draw their own weapon in the hand: 'run2#hold', 'jump#swing'
  var ARMS = {
    hold: { armN: [50, 150], armF: [-16, -6] },        // weapon raised, ready
    swing: { armN: [96, 92], armF: [-34, -40] },       // arm straight out front
    stab: { armN: [16, 4], armF: [-30, -24] },         // arm down (stab below)
    up: { armN: [164, 176], armF: [-24, -12] },        // arm straight up
    back: { armN: [-125, -160], armF: [45, 72] },      // wound up behind the head
    cast: { armN: [84, 88], armF: [72, 82] },          // both arms out front
    guard: { armN: [70, 150], armF: [55, 140] },       // both fists up
    // steel claws out: wind-up, slash forward, slash down, uppercut
    clawBack: { armN: [-125, -150], armF: [40, 70], prop: 'claws', propAng: -150 },
    claw: { armN: [92, 90], armF: [-40, -50], prop: 'claws', propAng: 90 },
    clawDown: { armN: [40, 20], armF: [-30, -30], prop: 'claws', propAng: 25 },
    clawUp: { armN: [150, 172], armF: [-30, -34], prop: 'claws', propAng: 172 }
  };
  // aim angles for gun poses: forward, up-forward, up, down-forward, down
  var AIM = { f: 90, u: 180, uf: 135, df: 45, d: 0 };

  function lim(base, ang, len) { var a = ang * Math.PI / 180; return [base[0] + Math.sin(a) * len, base[1] + Math.cos(a) * len]; }

  // ------------------------------------------------------------------ painting one frame
  function Cv(hero, variant) {
    this.h = hero; this.c = new Array(FW * FH); this.layer = 0;
    var pal = {}, k;
    for (k in hero.pal) pal[k] = hero.pal[k];
    for (k in EXTRA) pal[k] = EXTRA[k];
    var vv = variant && hero.variants[variant];
    if (vv) for (k in vv) if (pal[k]) pal[k] = [vv[k], pal[k][1]];
    this.pal = pal;
  }
  Cv.prototype.put = function (x, y, ch) {
    x += OX; y += OY;
    if (ch && ch !== '.' && x >= 0 && x < FW && y >= 0 && y < FH) this.c[y * FW + x] = [ch, this.layer];
  };
  Cv.prototype.stamp = function (g, ox, oy) {
    this.layer++;
    for (var j = 0; j < g.length; j++) for (var i = 0; i < g[j].length; i++) { var ch = g[j][i]; if (ch !== '.') this.put(ox + i, oy + j, ch); }
  };
  Cv.prototype.capsule = function (a, b, r0, r1, sh, stripes, tattoo) {
    this.layer++;
    var ax = a[0], ay = a[1], bx = b[0], by = b[1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    var x0 = Math.floor(Math.min(ax, bx) - 4), x1 = Math.floor(Math.max(ax, bx) + 5), y0 = Math.floor(Math.min(ay, by) - 4), y1 = Math.floor(Math.max(ay, by) + 5);
    for (var py = y0; py < y1; py++) for (var px = x0; px < x1; px++) {
      var cx = px + 0.5, cy = py + 0.5, t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2));
      var ox = cx - (ax + dx * t), oy = cy - (ay + dy * t), r = r0 + (r1 - r0) * t, d = Math.hypot(ox, oy);
      if (d > r) continue;
      var lit = (ox * LX + oy * LY) / Math.max(r, 0.01), ch = lit > 0.38 ? sh[0] : lit < -0.3 ? sh[2] : sh[1];
      if (stripes) for (var s = 0; s < stripes.length; s++) { var S = stripes[s]; if (t >= S[0] && t <= S[1]) ch = lit > -0.3 ? S[2] : S[3]; }
      if (tattoo && t > 0.18 && t < 0.62 && lit > -0.55) { var kk = (px * 3 + py * 5) % 4; if (kk < 0) kk += 4; if (kk < 2) ch = 'T'; else if (kk === 2) ch = 'U'; }
      this.put(px, py, ch);
    }
  };
  Cv.prototype.blob = function (cx, cy, r, sh) {
    this.layer++;
    for (var py = Math.floor(cy - r - 1); py < Math.floor(cy + r + 2); py++) for (var px = Math.floor(cx - r - 1); px < Math.floor(cx + r + 2); px++) {
      var ox = px + 0.5 - cx, oy = py + 0.5 - cy, d = Math.hypot(ox, oy);
      if (d > r) continue;
      var lit = (ox * LX + oy * LY) / Math.max(r, 0.01);
      this.put(px, py, lit > 0.35 ? sh[0] : lit < -0.35 ? sh[2] : sh[1]);
    }
  };
  // curly hair (and the fox tail): overlapping little shaded balls, dark rims where they overlap ones behind
  Cv.prototype.curls = function (list, sh, depthOn) {
    this.layer++;
    var own = {};
    for (var i = 0; i < list.length; i++) {
      var cx = list[i][0], cy = list[i][1], r = list[i][2];
      for (var py = Math.floor(cy - r - 1); py < Math.floor(cy + r + 2); py++) for (var px = Math.floor(cx - r - 1); px < Math.floor(cx + r + 2); px++) {
        var ox = px + 0.5 - cx, oy = py + 0.5 - cy, d = Math.hypot(ox, oy);
        if (d > r) continue;
        var lit = (ox * LX + oy * LY) / Math.max(r, 0.01);
        if (depthOn) lit += ((cx - 3) / 14 - (cy - 8) / 30) * 0.35;
        var key = px + ',' + py, ch;
        if (d > r - 0.9 && own[key] != null && own[key] !== i && lit < 0.3) ch = sh[4];
        else if (lit > 0.62) ch = sh[0]; else if (lit > 0.2) ch = sh[1]; else if (lit > -0.32) ch = sh[2]; else ch = sh[3];
        own[key] = i;
        this.put(px, py, ch);
      }
    }
  };
  // a straight prop: a thick shaded bar from a point along an angle
  Cv.prototype.bar = function (a, ang, len, r, sh, from) {
    var b = lim(a, ang, len), s = from ? lim(a, ang, from) : a;
    this.capsule(s, b, r, r, sh);
    return b;
  };
  Cv.prototype.finish = function () {
    var pal = this.pal, deep = this.h.deep, c = this.c, out = new Uint8ClampedArray(FW * FH * 4), x, y, i, n, k;
    var N = [[1, 0], [-1, 0], [0, 1], [0, -1]], rgb = {};
    function col(h) { return rgb[h] || (rgb[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]); }
    function grp(ch) { return pal[ch][1]; }
    for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) {
      i = y * FW + x; var cell = c[i]; if (!cell) continue;
      var ch = cell[0], g = grp(ch), res = ch;
      if (deep[g]) for (k = 0; k < 4; k++) {
        var nx = x + N[k][0], ny = y + N[k][1];
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
        n = c[ny * FW + nx];
        if (n && n[1] > cell[1] && !NO_SHADOW[grp(n[0])] && !(g === 'skin' && grp(n[0]) === 'skin')) res = deep[g];
      }
      var v = col(pal[res][0]); out[i * 4] = v[0]; out[i * 4 + 1] = v[1]; out[i * 4 + 2] = v[2]; out[i * 4 + 3] = 255;
    }
    for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) {
      i = y * FW + x; if (c[i]) continue;
      var best = null, bs = 1e9;
      for (k = 0; k < 4; k++) {
        var mx = x + N[k][0], my = y + N[k][1];
        if (mx < 0 || my < 0 || mx >= FW || my >= FH) continue;
        n = c[my * FW + mx]; if (!n) continue;
        var oc = col(OUTLINE[grp(n[0])]), sum = oc[0] + oc[1] + oc[2];
        if (sum < bs) { bs = sum; best = oc; }
      }
      if (best) { out[i * 4] = best[0]; out[i * 4 + 1] = best[1]; out[i * 4 + 2] = best[2]; out[i * 4 + 3] = 255; }
    }
    var cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
    cv.getContext('2d').putImageData(new ImageData(out, FW, FH), 0, 0);
    var x0 = FW, y0 = FH, x1 = 0, y1 = 0;
    for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) if (out[(y * FW + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    cv.bb = [x0, y0, x1 + 1, y1 + 1];
    return cv;
  };

  function paint(hero, P, variant) {
    var cv = new Cv(hero, variant), bob = P.bob || 0, hip = P.hip || 0, sway = P.sway || 0, hx = P.headX || 0, hy = P.headY || 0, k;
    var sN = [hero.shN[0], hero.shN[1] + bob], sF = [hero.shF[0], hero.shF[1] + bob];
    function arm(s, a, rad, hand) {
      var e = lim(s, a[0], hero.upper), w = lim(e, a[1], hero.fore);
      cv.capsule(s, e, rad[0], rad[1], hero.sleeve, null, hero.tattoo && rad === hero.armN);
      cv.capsule(e, w, rad[1], rad[2], hero.sleeve, hero.stripes);
      cv.blob(w[0] + Math.sin(a[1] * Math.PI / 180) * 0.6, w[1] + Math.cos(a[1] * Math.PI / 180) * 0.6, hand, hero.skin);
      return w;
    }
    // far arm (behind everything)
    if (P.armF) arm(sF, P.armF, hero.armF, hero.hand[1]);
    // fox tail power: a bushy brush behind the hips, white tip
    if (P.tail) {
      var ta = (P.tailAng != null ? P.tailAng : -60) * Math.PI / 180, bx = hero.hipF[0] - 1, by = hero.hipF[1] - 2 + hip, list = [];
      for (k = 0; k < 6; k++) { var dd = 1.5 + k * 1.9; list.push([bx + Math.sin(ta) * dd - Math.cos(ta) * Math.sin(k) * 0.4, by + Math.cos(ta) * dd, 1.5 + Math.sin(k / 5 * Math.PI) * 1.4]); }
      cv.curls(list, ['6', '6', '7', '8', '9']);
      var tip = list[list.length - 1]; cv.blob(tip[0] + Math.sin(ta) * 0.8, tip[1] + Math.cos(ta) * 0.8, 1.6, ['0', '0', '0']);
    }
    // her curls hang down her back
    if (hero.hairBack && !P.noHair) {
      var hb = [];
      for (k = 0; k < hero.hairBack.length; k++) { var q = hero.hairBack[k]; if (P.shortHair && q[1] > 18) continue; hb.push([q[0] + sway * (q[1] - 8) / 18 + hx, q[1] + bob + hy, q[2]]); }
      cv.curls(hb, hero.hairSh, true);
    }
    // legs, far then near, each with its boot
    var sides = [['legF', hero.hipF, 'bootF'], ['legN', hero.hipN, 'bootN']];
    for (k = 0; k < 2; k++) {
      var L = P[sides[k][0]]; if (!L) continue;
      var h0 = [sides[k][1][0], sides[k][1][1] + hip], kn = lim(h0, L[0], hero.thigh), an = lim(kn, L[1], hero.calf);
      cv.capsule(h0, kn, hero.legR[0], hero.legR[1], hero.leg);
      cv.capsule(kn, an, hero.legR[1], hero.legR[2], hero.leg);
      var bt = hero.boots[P[sides[k][2]] || 'flat'];
      cv.stamp(bt[0], Math.round(an[0]) - bt[1], Math.round(an[1]) - bt[2]);
    }
    cv.stamp(hero.torso, hero.torsoAt[0], hero.torsoAt[1] + bob);
    if (hero.glider && !P.noGlider) cv.stamp(hero.glider, hero.gliderAt[0] + hx * 0.5, hero.gliderAt[1] + bob);
    var head = hero.head;
    if (P.face === 'ouch' && hero.ouch) { head = head.slice(); for (k in hero.ouch) head[k] = hero.ouch[k]; }
    cv.stamp(head, hero.headAt[0] + hx, hero.headAt[1] + bob + hy);
    if (hero.hairFront && !P.noHair) {
      var hf = [];
      for (k = 0; k < hero.hairFront.length; k++) { var f = hero.hairFront[k]; hf.push([f[0] + sway * 0.4 + hx, f[1] + bob + hy, f[2]]); }
      cv.curls(hf, hero.hairSh, true);
    }
    // near arm, and whatever it holds
    if (P.armN) {
      var hand = arm(sN, P.armN, hero.armN, hero.hand[0]);
      if (P.prop) {
        var pa = P.propAng != null ? P.propAng : P.armN[1];
        if (P.prop === 'gun') { cv.bar(hand, pa, 9, 0.9, ['!', '"', '#'], -1.5); cv.bar(lim(hand, pa, 1), pa - 90, 2.6, 0.7, ['"', '#', '#']); }
        else if (P.prop === 'blade') { cv.bar(hand, pa, 12, 1.0, ['$', '%', '&'], 2); cv.bar(lim(hand, pa, 1.4), pa + 90, 2.2, 0.8, ['-', '-', '/'], -2.2); }
        else if (P.prop === 'claws') { for (var cl = -1; cl <= 1; cl++) cv.bar(lim(hand, pa + 90, cl * 1.3), pa, 6, 0.55, ['$', '%', '&'], 1); }
        else if (P.prop === 'hammer') { var hh = cv.bar(hand, pa, 8, 0.75, ['(', '(', ')'], -1.5); cv.bar(lim(hh, pa + 90, -2.6), pa + 90, 5.2, 1.6, ['*', '+', ',']); }
        else if (P.prop === 'lance') { cv.bar(hand, pa, 13, 0.85, ['*', '+', ','], -6); }
        cv.blob(hand[0], hand[1], hero.hand[0] * 0.85, hero.skin);
      }
    }
    return cv.finish();
  }

  // pose keys: 'run2', 'idle0', 'slash1', or a body pose plus an aim, like 'run2@uf' (gun aimed up-forward)
  function poseFor(hero, key) {
    var arms = null, hs = key.indexOf('#');
    if (hs >= 0) { arms = key.slice(hs + 1); key = key.slice(0, hs); }
    var at = key.indexOf('@'), base = at < 0 ? key : key.slice(0, at), aim = at < 0 ? null : key.slice(at + 1);
    var tail = false;
    if (base.slice(-5) === '+tail') { tail = true; base = base.slice(0, -5); }
    var src = POSES[base] || POSES.idle0, P = {}, k;
    for (k in src) P[k] = src[k];
    var o = hero.over[base.replace(/\d+$/, '')] || hero.over[base];
    if (o) for (k in o) P[k] = o[k];
    if (aim != null) {
      var a = AIM[aim] != null ? AIM[aim] : +aim;
      P.armN = [a - 18, a]; P.armF = [a - 30, a - 4]; P.prop = 'gun'; P.propAng = a;
    }
    if (tail) { P.tail = true; P.tailAng = base === 'fly0' || base === 'fly1' ? -100 : base.indexOf('run') === 0 ? -78 : -55; }
    if (arms && ARMS[arms]) { delete P.prop; for (k in ARMS[arms]) P[k] = ARMS[arms][k]; }
    if (arms === 'np') delete P.prop;
    return P;
  }
  var cache = {};
  R.frame = function (id, key, variant) {
    var ck = id + '|' + key + '|' + (variant || '');
    if (!cache[ck]) cache[ck] = paint(HEROES[id], poseFor(HEROES[id], key), variant);
    return cache[ck];
  };

  // ------------------------------------------------------------------ choosing a hero
  var chosen = 'classic';
  try { chosen = localStorage.getItem(STORE) || 'classic'; } catch (e) { }
  if (!HEROES[chosen]) chosen = 'classic';
  R.id = function () { return chosen; };
  R.on = function () { return chosen !== 'classic'; };
  R.set = function (id) { chosen = HEROES[id] ? id : 'classic'; try { localStorage.setItem(STORE, chosen); } catch (e) { } };
  R.NAMES = { her: "Desire'e", him: 'J.T.' };

  // named poses -> frame keys, animated by time or by a running phase (distance travelled)
  R.key = function (pose, opt) {
    opt = opt || {};
    var t = opt.t || 0, ph = opt.phase, aim = opt.aim ? '@' + opt.aim : '', k;
    switch (pose) {
      case 'idle': k = 'idle' + (Math.floor(t / 520) % 2); break;
      case 'run': k = 'run' + (((Math.floor(ph != null ? ph : t / 110) % 4) + 4) % 4); break;
      case 'crawl': k = 'crawl' + (((Math.floor(ph != null ? ph : t / 160) % 2) + 2) % 2); break;
      case 'ride': k = 'ride' + (Math.floor(t / 240) % 2); break;
      case 'fly': k = 'fly' + (Math.floor(t / 90) % 2); break;
      case 'climb': k = 'climb' + (((Math.floor(ph != null ? ph : t / 200) % 2) + 2) % 2); break;
      case 'throw': k = (opt.f || 0) > 0.5 ? 'throw0' : 'throw1'; break;
      case 'slash': k = 'slash' + Math.min(2, Math.floor((opt.f || 0) * 3)); break;
      case 'hammer': k = 'hammer' + (Math.floor(t / 130) % 2); break;
      default: k = POSES[pose] ? pose : 'idle0';
    }
    if (opt.tail) k += '+tail';
    return k + aim + (opt.arms ? '#' + opt.arms : '');
  };

  // draw the picked hero. (x, y) is where the feet touch (or the seat, for riding poses)
  R.draw = function (c, pose, x, y, face, h, opt) {
    if (!R.on()) return false;
    opt = opt || {};
    var key = POSES[pose.split(/[@#+]/)[0]] ? pose : R.key(pose, opt);
    var fr = R.frame(chosen, key, opt.v), P = poseFor(HEROES[chosen], key.replace('+tail', ''));
    var m = c.getTransform(), sx = Math.hypot(m.a, m.b) || 1;
    var px = (h / BODY_H) * sx * (opt.scale || 1);
    var dx = Math.round(m.a * x + m.c * y + m.e), dy = Math.round(m.b * x + m.d * y + m.f);
    var at = opt.at || P.at, ax = FOOT_X, ay = at === 'seat' ? SEAT_Y + (P.bob || 0) : FOOT_Y, fx = (face < 0 ? -1 : 1) * (m.a < 0 ? -1 : 1);
    if (at === 'center') { ax = (fr.bb[0] + fr.bb[2]) / 2; ay = (fr.bb[1] + fr.bb[3]) / 2; }
    var rows = opt.top ? Math.min(FH, opt.top) : FH;
    if (opt.top) ay = rows;
    c.save();
    c.setTransform(fx, 0, 0, 1, dx, dy);
    c.imageSmoothingEnabled = false;
    if (opt.alpha != null) c.globalAlpha *= opt.alpha;
    if (opt.rot) c.rotate(opt.rot);
    c.drawImage(fr, 0, 0, FW, rows, -ax * px, -ay * px, FW * px, rows * px);
    c.restore();
    return true;
  };
  // where a hand ends up (game units, relative to the feet) — for games that spawn shots from the hand
  R.hand = function (pose, h, face) {
    var hero = HEROES[chosen === 'classic' ? 'her' : chosen], P = poseFor(hero, pose), s = [hero.shN[0], hero.shN[1] + (P.bob || 0)];
    if (!P.armN) return [0, -h * 0.6];
    var w = lim(lim(s, P.armN[0], hero.upper), P.armN[1], hero.fore), k = h / BODY_H;
    return [(w[0] + OX - FOOT_X) * k * (face < 0 ? -1 : 1), (w[1] + OY - FOOT_Y) * k];
  };

  // ------------------------------------------------------------------ the pick screen on the game's card
  var offered = null, anim = null;
  function css() {
    if (document.getElementById('rp-css')) return;
    var s = document.createElement('style'); s.id = 'rp-css';
    s.textContent =
      '#ko #rp{display:flex;flex-direction:column;align-items:center;gap:8px;margin:2px 0 6px}' +
      '#ko #rp .rp-t{font:12px Bungee,Impact,system-ui,sans-serif;letter-spacing:.08em;opacity:.8}' +
      '#ko #rp .rp-row{display:flex;gap:10px;justify-content:center}' +
      '#ko #rp button.rp{all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:4px;width:86px;padding:8px 4px 6px;' +
      'border-radius:14px;background:rgba(255,255,255,.08);border:3px solid rgba(255,255,255,.18);cursor:pointer;color:#fff;font:12px Bungee,Impact,system-ui,sans-serif;text-align:center;min-height:0;box-shadow:none;white-space:nowrap}' +
      '#ko #rp button.rp[aria-pressed="true"]{border-color:var(--accent);background:rgba(255,255,255,.18)}' +
      '#ko #rp button.rp:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
      '#ko #rp button.rp:active{transform:scale(.96)}' +
      '#ko #rp canvas{width:54px;height:78px;image-rendering:pixelated;display:block}' +
      '#ko #rp .rp-c{width:54px;height:78px;display:flex;align-items:center;justify-content:center;font:26px Bungee,Impact,sans-serif;color:var(--accent)}' +
      // the card can scroll if it ever gets taller than the screen, and never cuts off its top
      '#ko{overflow-y:auto;justify-content:safe center}' +
      '#ko #rp-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}' +
      // phone on its side: smaller title and text, players and the start button side by side
      '@media (max-height:560px){#ko{gap:8px}#ko h1{font-size:clamp(26px,9vh,46px)}#ko p{font-size:14px;line-height:1.35}' +
      '#ko #rp-wrap{flex-direction:row;gap:18px}#ko #rp{margin:0}#ko #rp .rp-t{display:none}' +
      '#ko #rp button.rp{width:66px;padding:4px 2px;font-size:10px;border-width:2px;border-radius:12px}' +
      '#ko #rp canvas,#ko #rp .rp-c{width:36px;height:52px}}';
    document.head.appendChild(s);
  }
  function picker(host, before) {
    css();
    var box = document.createElement('div'); box.id = 'rp';
    var tt = document.createElement('div'); tt.className = 'rp-t'; tt.textContent = 'PICK YOUR PLAYER'; box.appendChild(tt);
    var row = document.createElement('div'); row.className = 'rp-row'; box.appendChild(row);
    var cans = [];
    ['classic', 'her', 'him'].forEach(function (id) {
      var b = document.createElement('button'); b.className = 'rp'; b.type = 'button';
      b.setAttribute('aria-pressed', String(chosen === id));
      var name = id === 'classic' ? offered.classic : R.NAMES[id];
      b.setAttribute('aria-label', 'Play as ' + name);
      var art;
      if (id !== 'classic' || offered.thumb) {
        var hd = offered.hd || 1; art = document.createElement('canvas'); art.width = FW * hd; art.height = FH * hd; cans.push([art, id]);
        if (hd > 1) art.style.imageRendering = 'auto';
      }
      else { art = document.createElement('div'); art.className = 'rp-c'; art.textContent = (offered.classic || '?').charAt(0); }
      b.appendChild(art);
      var lab = document.createElement('span'); lab.textContent = name; b.appendChild(lab);
      b.onclick = function () { R.set(id); row.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); };
      row.appendChild(b);
    });
    var wrap = document.createElement('div'); wrap.id = 'rp-wrap';
    host.insertBefore(wrap, before); wrap.appendChild(box); wrap.appendChild(before);
    var tick = 0;
    function frameAll() {
      tick++;
      cans.forEach(function (cc) {
        var g = cc[0].getContext('2d'), hd = offered.hd || 1, own = offered.thumbs && offered.thumbs[cc[1]];
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cc[0].width, cc[0].height); g.setTransform(hd, 0, 0, hd, 0, 0); g.imageSmoothingEnabled = hd > 1;
        if (own) { try { own(g, FW, FH, tick * 260); } catch (e) { } }
        else if (cc[1] === 'classic') {
          try { offered.thumb(g, FW, FH, tick * 260); }
          catch (e) { var d = document.createElement('div'); d.className = 'rp-c'; d.textContent = (offered.classic || '?').charAt(0); if (cc[0].parentNode) cc[0].parentNode.replaceChild(d, cc[0]); cans = cans.filter(function (x) { return x !== cc; }); }
        }
        else g.drawImage(R.frame(cc[1], 'idle' + (tick % 2)), 0, 0);
      });
    }
    frameAll();
    clearInterval(anim); anim = setInterval(function () { if (!document.body.contains(box) || host.hidden) { clearInterval(anim); return; } frameAll(); }, 520);
  }
  R.offer = function (o) {
    offered = Object.assign({ classic: 'Classic' }, o || {});
    if (!window.K || K._rosterHooked) return;
    K._rosterHooked = true;
    var card = K.card;
    K.card = function (co) {
      card(co);
      if (co && co.pick === false) return;
      var ov = document.getElementById('ko'); if (!ov) return;
      var btn = ov.querySelector('button'); if (!btn) return;
      picker(ov, btn);
    };
  };

  window.Roster = R;
})();
