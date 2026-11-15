/* Chess rules and computer player for Check These Pawns.
   - In a page: <script src="../lib/chess-engine.js"> gives window.Chess.
   - As a Web Worker (new Worker('../lib/chess-engine.js')): post {id, fen, moves, level} and get {id, move, score, depth}.
   - In Node (tests): module.exports.
   Board: 0x88 (index = rank * 16 + file, rank 0 = White's back rank). Pieces: type 1-6 (P N B R Q K), +8 for Black. */
(function (root) {
  'use strict';
  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6, BLACK = 8;
  var KN = [33, 31, 18, 14, -14, -18, -31, -33], DIAG = [17, 15, -15, -17], ORTH = [16, -16, 1, -1], ALL = [17, 16, 15, 1, -1, -15, -16, -17];
  var FILES = 'abcdefgh', LETTER = ' pnbrqk';
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // ---- zobrist keys (two 32-bit halves) ----
  var seed = 0x9e3779b9;
  function rnd32() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }
  var ZP1 = new Uint32Array(16 * 128), ZP2 = new Uint32Array(16 * 128), ZC1 = new Uint32Array(16), ZC2 = new Uint32Array(16), ZE1 = new Uint32Array(8), ZE2 = new Uint32Array(8);
  for (var i = 0; i < 16 * 128; i++) { ZP1[i] = rnd32(); ZP2[i] = rnd32(); }
  for (i = 0; i < 16; i++) { ZC1[i] = rnd32(); ZC2[i] = rnd32(); }
  for (i = 0; i < 8; i++) { ZE1[i] = rnd32(); ZE2[i] = rnd32(); }
  var ZS1 = rnd32(), ZS2 = rnd32();

  // moves: from | to << 7 | promo << 14 | flag << 17 (flag 1 double push, 2 en passant, 3 castle)
  function mv(f, t, p, fl) { return f | (t << 7) | ((p || 0) << 14) | ((fl || 0) << 17); }
  var FROM = function (m) { return m & 127; }, TO = function (m) { return (m >> 7) & 127; }, PROMO = function (m) { return (m >> 14) & 7; }, FLAG = function (m) { return (m >> 17) & 3; };
  function sqName(s) { return FILES[s & 7] + ((s >> 4) + 1); }
  function parseSq(n) { return (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97); }

  function Position(fen) {
    this.b = new Int8Array(128); this.side = 0; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1;
    this.king = [0, 0]; this.h1 = 0; this.h2 = 0; this.stack = []; this.hist = [];
    this.load(fen || START);
  }
  var P = Position.prototype;

  P.load = function (fen) {
    var parts = fen.trim().split(/\s+/), rows = parts[0].split('/');
    this.b.fill(0);
    for (var r = 0; r < 8; r++) {
      var f = 0, row = rows[r];
      for (var k = 0; k < row.length; k++) {
        var ch = row[k];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        var t = LETTER.indexOf(ch.toLowerCase()), s = (7 - r) * 16 + f;
        this.b[s] = t | (ch === ch.toLowerCase() ? BLACK : 0);
        if (t === KING) this.king[ch === ch.toLowerCase() ? 1 : 0] = s;
        f++;
      }
    }
    this.side = parts[1] === 'b' ? 1 : 0;
    var c = parts[2] || '-'; this.castle = (c.indexOf('K') >= 0 ? 1 : 0) | (c.indexOf('Q') >= 0 ? 2 : 0) | (c.indexOf('k') >= 0 ? 4 : 0) | (c.indexOf('q') >= 0 ? 8 : 0);
    this.ep = parts[3] && parts[3] !== '-' ? parseSq(parts[3]) : -1;
    this.half = +(parts[4] || 0); this.full = +(parts[5] || 1);
    this.stack = []; this.rehash(); this.hist = [this.key()];
  };
  P.rehash = function () {
    var a = 0, b = 0;
    for (var s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } var p = this.b[s]; if (p) { a ^= ZP1[p * 128 + s]; b ^= ZP2[p * 128 + s]; } }
    a ^= ZC1[this.castle]; b ^= ZC2[this.castle];
    if (this.ep >= 0) { a ^= ZE1[this.ep & 7]; b ^= ZE2[this.ep & 7]; }
    if (this.side) { a ^= ZS1; b ^= ZS2; }
    this.h1 = a >>> 0; this.h2 = b >>> 0;
  };
  P.key = function () { return this.h1 * 4096 + (this.h2 & 4095); };
  P.fen = function () {
    var out = '';
    for (var r = 7; r >= 0; r--) {
      var e = 0;
      for (var f = 0; f < 8; f++) {
        var p = this.b[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { out += e; e = 0; }
        var ch = LETTER[p & 7]; out += p & BLACK ? ch : ch.toUpperCase();
      }
      if (e) out += e;
      if (r) out += '/';
    }
    var c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return out + ' ' + (this.side ? 'b' : 'w') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };

  // is square s attacked by color c (0 white, 1 black)?
  P.attacked = function (s, c) {
    var b = this.b, col = c ? BLACK : 0, t, i, d, x, p;
    // pawns
    if (c === 0) { t = s - 15; if (!(t & 0x88) && b[t] === PAWN) return true; t = s - 17; if (!(t & 0x88) && b[t] === PAWN) return true; }
    else { t = s + 15; if (!(t & 0x88) && b[t] === (PAWN | BLACK)) return true; t = s + 17; if (!(t & 0x88) && b[t] === (PAWN | BLACK)) return true; }
    for (i = 0; i < 8; i++) { t = s + KN[i]; if (!(t & 0x88) && b[t] === (KNIGHT | col)) return true; }
    for (i = 0; i < 8; i++) { t = s + ALL[i]; if (!(t & 0x88) && b[t] === (KING | col)) return true; }
    for (i = 0; i < 4; i++) {
      d = DIAG[i]; x = s + d;
      while (!(x & 0x88)) { p = b[x]; if (p) { if (p === (BISHOP | col) || p === (QUEEN | col)) return true; break; } x += d; }
      d = ORTH[i]; x = s + d;
      while (!(x & 0x88)) { p = b[x]; if (p) { if (p === (ROOK | col) || p === (QUEEN | col)) return true; break; } x += d; }
    }
    return false;
  };
  P.inCheck = function (c) { if (c === undefined) c = this.side; return this.attacked(this.king[c], 1 - c); };

  // pseudo-legal moves (capturesOnly for quiescence)
  P.gen = function (out, capturesOnly) {
    var b = this.b, us = this.side, col = us ? BLACK : 0, them = us ? 0 : BLACK, n = 0;
    for (var s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      var p = b[s]; if (!p || (p & BLACK) !== col) continue;
      var t = p & 7, x, i, d, q;
      if (t === PAWN) {
        var fw = us ? -16 : 16, startRank = us ? 6 : 1, promoRank = us ? 0 : 7;
        x = s + fw;
        if (!(x & 0x88) && !b[x]) {
          if ((x >> 4) === promoRank) { for (q = QUEEN; q >= KNIGHT; q--) out[n++] = mv(s, x, q); }
          else if (!capturesOnly) { out[n++] = mv(s, x); if ((s >> 4) === startRank && !b[x + fw]) out[n++] = mv(s, x + fw, 0, 1); }
        }
        for (i = -1; i <= 1; i += 2) {
          x = s + fw + i; if (x & 0x88) continue;
          if (b[x] && (b[x] & BLACK) === them) { if ((x >> 4) === promoRank) { for (q = QUEEN; q >= KNIGHT; q--) out[n++] = mv(s, x, q); } else out[n++] = mv(s, x); }
          else if (x === this.ep) out[n++] = mv(s, x, 0, 2);
        }
      } else if (t === KNIGHT || t === KING) {
        var D = t === KNIGHT ? KN : ALL;
        for (i = 0; i < 8; i++) { x = s + D[i]; if (x & 0x88) continue; var o = b[x]; if (o ? (o & BLACK) === them : !capturesOnly) out[n++] = mv(s, x); }
        if (t === KING && !capturesOnly) {
          var home = us ? 0x74 : 0x04;
          if (s === home && !this.attacked(s, 1 - us)) {
            if ((this.castle & (us ? 4 : 1)) && !b[s + 1] && !b[s + 2] && b[s + 3] === (ROOK | col) && !this.attacked(s + 1, 1 - us) && !this.attacked(s + 2, 1 - us)) out[n++] = mv(s, s + 2, 0, 3);
            if ((this.castle & (us ? 8 : 2)) && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === (ROOK | col) && !this.attacked(s - 1, 1 - us) && !this.attacked(s - 2, 1 - us)) out[n++] = mv(s, s - 2, 0, 3);
          }
        }
      } else {
        var dirs = t === BISHOP ? DIAG : t === ROOK ? ORTH : ALL, nd = dirs.length;
        for (i = 0; i < nd; i++) {
          d = dirs[i]; x = s + d;
          while (!(x & 0x88)) {
            var o2 = b[x];
            if (o2) { if ((o2 & BLACK) === them) out[n++] = mv(s, x); break; }
            if (!capturesOnly) out[n++] = mv(s, x);
            x += d;
          }
        }
      }
    }
    return n;
  };

  // castling rights lost when a piece moves from/to these squares
  var CR = new Uint8Array(128).fill(15); CR[0x04] = 12; CR[0x00] = 13; CR[0x07] = 14; CR[0x74] = 3; CR[0x70] = 7; CR[0x77] = 11;

  P.make = function (m) {
    var b = this.b, f = FROM(m), t = TO(m), pr = PROMO(m), fl = FLAG(m), p = b[f], cap = b[t], us = this.side;
    var h1 = this.h1, h2 = this.h2;
    this.stack.push(m, cap, this.castle, this.ep, this.half, h1, h2);
    // hash out old castle/ep/side
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    h1 ^= ZP1[p * 128 + f]; h2 ^= ZP2[p * 128 + f];
    if (cap) { h1 ^= ZP1[cap * 128 + t]; h2 ^= ZP2[cap * 128 + t]; }
    b[f] = 0;
    var np = pr ? (pr | (p & BLACK)) : p;
    b[t] = np; h1 ^= ZP1[np * 128 + t]; h2 ^= ZP2[np * 128 + t];
    if (fl === 2) { var cs = t + (us ? 16 : -16), cp = b[cs]; b[cs] = 0; h1 ^= ZP1[cp * 128 + cs]; h2 ^= ZP2[cp * 128 + cs]; }
    else if (fl === 3) {
      var rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1, rk = b[rf];
      b[rf] = 0; b[rt] = rk; h1 ^= ZP1[rk * 128 + rf] ^ ZP1[rk * 128 + rt]; h2 ^= ZP2[rk * 128 + rf] ^ ZP2[rk * 128 + rt];
    }
    if ((p & 7) === KING) this.king[us] = t;
    this.castle &= CR[f] & CR[t];
    this.ep = fl === 1 ? (f + t) >> 1 : -1;
    this.half = ((p & 7) === PAWN || cap || fl === 2) ? 0 : this.half + 1;
    if (us) this.full++;
    this.side = 1 - us;
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    h1 ^= ZS1; h2 ^= ZS2;
    this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
    this.hist.push(this.key());
  };
  P.unmake = function () {
    var st = this.stack, h2 = st.pop(), h1 = st.pop(), half = st.pop(), ep = st.pop(), castle = st.pop(), cap = st.pop(), m = st.pop();
    var b = this.b, f = FROM(m), t = TO(m), pr = PROMO(m), fl = FLAG(m);
    this.side = 1 - this.side; var us = this.side;
    var p = b[t]; if (pr) p = PAWN | (p & BLACK);
    b[f] = p; b[t] = cap;
    if (fl === 2) b[t + (us ? 16 : -16)] = PAWN | (us ? 0 : BLACK);
    else if (fl === 3) { var rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1; b[rf] = b[rt]; b[rt] = 0; }
    if ((p & 7) === KING) this.king[us] = f;
    this.castle = castle; this.ep = ep; this.half = half; if (us) this.full--;
    this.h1 = h1; this.h2 = h2; this.hist.pop();
  };
  // null move for search pruning
  P.makeNull = function () {
    this.stack.push(0, 0, this.castle, this.ep, this.half, this.h1, this.h2);
    var h1 = this.h1, h2 = this.h2;
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    h1 ^= ZS1; h2 ^= ZS2; this.ep = -1; this.side = 1 - this.side; this.h1 = h1 >>> 0; this.h2 = h2 >>> 0; this.hist.push(this.key());
  };
  P.unmakeNull = function () {
    var st = this.stack, h2 = st.pop(), h1 = st.pop(), half = st.pop(), ep = st.pop(), castle = st.pop(); st.pop(); st.pop();
    this.side = 1 - this.side; this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2; this.hist.pop();
  };

  P.legal = function () {
    var buf = [], n = this.gen(buf, false), out = [], us = this.side;
    for (var i = 0; i < n; i++) { this.make(buf[i]); if (!this.attacked(this.king[us], 1 - us)) out.push(buf[i]); this.unmake(); }
    return out;
  };
  P.repetitions = function () { // how many times the current position has occurred (since the last irreversible move)
    var k = this.hist[this.hist.length - 1], c = 0, lim = Math.max(0, this.hist.length - 1 - this.half);
    for (var i = this.hist.length - 1; i >= lim; i -= 2) if (this.hist[i] === k) c++;
    return c;
  };
  P.insufficient = function () {
    var minors = [], b = this.b;
    for (var s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      var t = b[s] & 7; if (!t || t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push({ t: t, c: ((s >> 4) + (s & 7)) & 1 });
    }
    if (minors.length <= 1) return true;
    if (minors.every(function (m) { return m.t === BISHOP; }) && minors.every(function (m) { return m.c === minors[0].c; })) return true;
    return false;
  };
  // 'checkmate' | 'stalemate' | 'fifty' | 'repetition' | 'material' | null
  P.result = function () {
    var legal = this.legal();
    if (!legal.length) return this.inCheck() ? 'checkmate' : 'stalemate';
    if (this.half >= 100) return 'fifty';
    if (this.repetitions() >= 3) return 'repetition';
    if (this.insufficient()) return 'material';
    return null;
  };

  P.uci = function (m) { return sqName(FROM(m)) + sqName(TO(m)) + (PROMO(m) ? LETTER[PROMO(m)] : ''); };
  P.fromUci = function (u) { var L = this.legal(); for (var i = 0; i < L.length; i++) if (this.uci(L[i]) === u) return L[i]; return 0; };
  P.san = function (m, legalList) {
    var b = this.b, f = FROM(m), t = TO(m), p = b[f] & 7, fl = FLAG(m), s;
    if (fl === 3) s = t > f ? 'O-O' : 'O-O-O';
    else {
      var cap = b[t] || fl === 2;
      if (p === PAWN) s = (cap ? FILES[f & 7] + 'x' : '') + sqName(t) + (PROMO(m) ? '=' + LETTER[PROMO(m)].toUpperCase() : '');
      else {
        var L = legalList || this.legal(), amb = [], sameFile = false, sameRank = false;
        for (var i = 0; i < L.length; i++) { var o = L[i]; if (o !== m && TO(o) === t && (b[FROM(o)] & 7) === p) { amb.push(o); if ((FROM(o) & 7) === (f & 7)) sameFile = true; if ((FROM(o) >> 4) === (f >> 4)) sameRank = true; } }
        var dis = !amb.length ? '' : !sameFile ? FILES[f & 7] : !sameRank ? String((f >> 4) + 1) : sqName(f);
        s = LETTER[p].toUpperCase() + dis + (cap ? 'x' : '') + sqName(t);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length ? '+' : '#';
    this.unmake();
    return s;
  };

  // ---------------- evaluation ----------------
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  // piece-square tables from White's side, a8..h8 first row (index = (7 - rank) * 8 + file)
  var PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 22, 22, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]];
  var KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  function pstIndex(s, black) { var r = s >> 4, f = s & 7; return black ? r * 8 + f : (7 - r) * 8 + f; }

  P.evaluate = function () { // centipawns from the side to move
    var b = this.b, mg = 0, phase = 0, wb = 0, bb = 0, kingW = 0, kingB = 0;
    var pawnFiles = [new Int8Array(8), new Int8Array(8)];
    for (var s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      var p = b[s]; if (!p) continue;
      var t = p & 7, black = p & BLACK ? 1 : 0, sign = black ? -1 : 1;
      if (t === KING) { if (black) kingB = s; else kingW = s; continue; }
      if (t === PAWN) pawnFiles[black][s & 7]++;
      if (t === BISHOP) { if (black) bb++; else wb++; }
      if (t >= KNIGHT && t <= QUEEN) phase += t === QUEEN ? 4 : t === ROOK ? 2 : 1;
      mg += sign * (VAL[t] + PST[t][pstIndex(s, black)]);
    }
    // king safety in the middlegame, centralised king in the endgame
    var ph = Math.min(24, phase) / 24;
    mg += Math.round(ph * (PST[KING][pstIndex(kingW, 0)] - PST[KING][pstIndex(kingB, 1)]) + (1 - ph) * (KING_END[pstIndex(kingW, 0)] - KING_END[pstIndex(kingB, 1)]));
    if (wb >= 2) mg += 30; if (bb >= 2) mg -= 30;
    // doubled and isolated pawns, passed pawns
    for (var c = 0; c < 2; c++) {
      var sg = c ? -1 : 1, pf = pawnFiles[c], of = pawnFiles[1 - c];
      for (var f = 0; f < 8; f++) {
        if (!pf[f]) continue;
        if (pf[f] > 1) mg -= sg * 12 * (pf[f] - 1);
        if (!(f > 0 && pf[f - 1]) && !(f < 7 && pf[f + 1])) mg -= sg * 10;
      }
    }
    for (s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      if ((b[s] & 7) !== PAWN) continue;
      var bl = b[s] & BLACK ? 1 : 0, r = s >> 4, file = s & 7, passed = true, step = bl ? -16 : 16;
      for (var x = s + step; !(x & 0x88) && passed; x += step) for (var df = -1; df <= 1; df++) { var y = x + df; if (!(y & 0x88) && (y & 7) === file + df && b[y] === (PAWN | (bl ? 0 : BLACK))) passed = false; }
      if (passed) { var adv = bl ? 7 - r : r; mg += (bl ? -1 : 1) * Math.round([0, 5, 10, 20, 35, 60, 100, 0][adv] * (1.4 - ph * 0.6)); }
    }
    return this.side ? -mg : mg;
  };

  // ---------------- search ----------------
  var MATE = 30000;
  function Searcher(pos) { this.pos = pos; this.tt = new Map(); this.killers = []; this.hist = new Int32Array(16 * 128); this.nodes = 0; this.stop = false; }
  var S = Searcher.prototype;
  S.order = function (moves, n, ttMove, ply) {
    var b = this.pos.b, sc = new Array(n), k = this.killers[ply] || [];
    for (var i = 0; i < n; i++) {
      var m = moves[i], cap = b[TO(m)], v = 0;
      if (m === ttMove) v = 1e7;
      else if (cap || FLAG(m) === 2) v = 1e6 + VAL[cap & 7 || 1] * 10 - VAL[b[FROM(m)] & 7] / 10;
      else if (PROMO(m)) v = 9e5 + PROMO(m);
      else if (m === k[0] || m === k[1]) v = 8e5;
      else v = this.hist[(b[FROM(m)]) * 128 + TO(m)];
      sc[i] = v;
    }
    // insertion sort, highest first
    for (i = 1; i < n; i++) { var mm = moves[i], ss = sc[i], j = i - 1; while (j >= 0 && sc[j] < ss) { moves[j + 1] = moves[j]; sc[j + 1] = sc[j]; j--; } moves[j + 1] = mm; sc[j + 1] = ss; }
  };
  S.timeUp = function () { if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true; return this.stop; };
  S.quiesce = function (alpha, beta, ply) {
    if (this.timeUp()) return 0;
    var pos = this.pos, stand = pos.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    var moves = [], n = pos.gen(moves, true), us = pos.side;
    this.order(moves, n, 0, ply);
    for (var i = 0; i < n; i++) {
      var m = moves[i], cap = pos.b[TO(m)];
      if (!PROMO(m) && stand + VAL[cap & 7 || 1] + 200 < alpha) continue; // delta pruning
      pos.make(m);
      if (pos.attacked(pos.king[us], 1 - us)) { pos.unmake(); continue; }
      var sc = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };
  S.search = function (depth, alpha, beta, ply, allowNull) {
    var pos = this.pos;
    if (ply && (pos.half >= 100 || pos.repetitions() >= 2)) return 0;
    var inChk = pos.inCheck();
    if (inChk) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    if (this.timeUp()) return 0;
    var key = pos.key(), e = this.tt.get(key), ttMove = 0;
    if (e) {
      ttMove = e.m;
      if (ply && e.d >= depth) {
        var v = e.v; if (v > MATE - 500) v -= ply; else if (v < -MATE + 500) v += ply;
        if (e.f === 0 || (e.f === 1 && v >= beta) || (e.f === 2 && v <= alpha)) return v;
      }
    }
    // null move: skip a turn; if we're still winning, this line is good enough
    if (allowNull && !inChk && depth >= 3 && ply && this.hasPieces()) {
      pos.makeNull();
      var nv = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stop) return 0;
      if (nv >= beta) return beta;
    }
    var moves = [], n = pos.gen(moves, false), us = pos.side, best = -MATE * 2, bestM = 0, a0 = alpha, legal = 0;
    this.order(moves, n, ttMove, ply);
    for (var i = 0; i < n; i++) {
      var m = moves[i];
      pos.make(m);
      if (pos.attacked(pos.king[us], 1 - us)) { pos.unmake(); continue; }
      legal++;
      var quiet = !pos.stack[pos.stack.length - 6] && FLAG(m) !== 2 && !PROMO(m), sc;
      // late quiet moves get a shallower look first
      if (legal > 4 && depth >= 3 && quiet && !inChk && !pos.inCheck()) {
        sc = -this.search(depth - 2, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha) sc = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      } else sc = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      pos.unmake();
      if (this.stop) return 0;
      if (sc > best) { best = sc; bestM = m; }
      if (sc > alpha) {
        alpha = sc;
        if (sc >= beta) {
          if (quiet) { var k = this.killers[ply] || (this.killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } this.hist[pos.b[FROM(m)] * 128 + TO(m)] += depth * depth; }
          break;
        }
      }
    }
    if (!legal) return inChk ? -MATE + ply : 0;
    var store = best; if (store > MATE - 500) store += ply; else if (store < -MATE + 500) store -= ply;
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(key, { d: depth, v: store, f: best >= beta ? 1 : best <= a0 ? 2 : 0, m: bestM });
    return best;
  };
  S.hasPieces = function () {
    var b = this.pos.b, col = this.pos.side ? BLACK : 0;
    for (var s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } var p = b[s]; if (p && (p & BLACK) === col && (p & 7) > PAWN && (p & 7) < KING) return true; }
    return false;
  };

  var LEVELS = {
    easy: { depth: 1, ms: 300, noise: 90, blunder: 0.25 },
    medium: { depth: 3, ms: 900, noise: 18, blunder: 0 },
    hard: { depth: 7, ms: 2200, noise: 0, blunder: 0 },
    hint: { depth: 5, ms: 1200, noise: 0, blunder: 0 }
  };
  // pick a move for the side to move. level: 'easy' | 'medium' | 'hard' | 'hint'
  function think(pos, level) {
    var L = LEVELS[level] || LEVELS.medium, se = new Searcher(pos), legal = pos.legal();
    if (!legal.length) return { move: 0, score: 0, depth: 0 };
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 0 };
    se.deadline = Date.now() + L.ms;
    // root scores for every move at each depth
    var scores = legal.map(function () { return 0; }), done = 0, bestMove = legal[0], bestScore = 0, bestIdx = 0, prevBest = 0;
    for (var d = 1; d <= L.depth; d++) {
      var alpha = -MATE * 2, sc = [], iterBest = -1;
      // search the previous best first, then the rest by their last scores
      var order = legal.map(function (m, i) { return i; }).sort(function (a, b) { return a === prevBest ? -1 : b === prevBest ? 1 : scores[b] - scores[a]; });
      for (var oi = 0; oi < order.length; oi++) {
        var i = order[oi], m = legal[i];
        pos.make(m);
        // easier levels need an exact score for every move (to pick among good ones); hard only needs the best
        var v = L.noise ? -se.search(d - 1, -MATE * 2, MATE * 2, 1, true) : -se.search(d - 1, -MATE * 2, -alpha, 1, true);
        pos.unmake();
        if (se.stop) break;
        sc[i] = v; if (v > alpha) { alpha = v; iterBest = i; }
      }
      if (se.stop && d > 1) break;
      for (var j = 0; j < legal.length; j++) if (sc[j] !== undefined) scores[j] = sc[j];
      if (iterBest >= 0) { bestIdx = iterBest; prevBest = iterBest; }
      done = d;
      if (se.stop) break;
      if (Math.abs(alpha) > MATE - 500) break;
    }
    // choose: the best (only the move that set alpha is known to be best; other scores can be bounds),
    // or on easier levels a slightly random good-enough move
    var bi = bestIdx, k;
    if (L.noise) {
      var noisy = scores.map(function (s) { return s + (Math.random() * 2 - 1) * L.noise; });
      bi = 0; for (k = 1; k < legal.length; k++) if (noisy[k] > noisy[bi]) bi = k;
      if (L.blunder && Math.random() < L.blunder) { // now and then, take a random move from the top half
        var idx = legal.map(function (m, i) { return i; }).sort(function (a, b) { return scores[b] - scores[a]; });
        bi = idx[Math.floor(Math.random() * Math.max(2, Math.ceil(idx.length / 2)))];
      }
    }
    bestMove = legal[bi]; bestScore = scores[bi];
    return { move: bestMove, score: bestScore, depth: done, nodes: se.nodes };
  }

  // a few well-known openings, so the computer doesn't open the same way every game (moves from the start position)
  var BOOK = [
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6', 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6', 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7', 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8', 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8', 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 b1d2 e7e6', 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5', 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5',
    'g1f3 d7d5 g2g3 g8f6 f1g2 c7c6 e1g1 c8g4 d2d3 b8d7', 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6'
  ].map(function (l) { return l.split(' '); });
  function bookMove(moves) {
    var n = moves.length, next = [];
    BOOK.forEach(function (line) { if (line.length > n && moves.every(function (m, i) { return line[i] === m; })) next.push(line[n]); });
    return next.length ? next[Math.floor(Math.random() * next.length)] : '';
  }

  // perft for testing the move generator
  function perft(pos, depth) {
    if (!depth) return 1;
    var moves = [], n = pos.gen(moves, false), us = pos.side, c = 0;
    for (var i = 0; i < n; i++) { pos.make(moves[i]); if (!pos.attacked(pos.king[us], 1 - us)) c += depth === 1 ? 1 : perft(pos, depth - 1); pos.unmake(); }
    return c;
  }

  var Chess = { Position: Position, START: START, think: think, perft: perft, bookMove: bookMove, sqName: sqName, parseSq: parseSq, FROM: FROM, TO: TO, PROMO: PROMO, FLAG: FLAG, PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING, BLACK: BLACK, VAL: VAL };

  // worker mode
  if (typeof importScripts === 'function' && typeof window === 'undefined' && typeof module === 'undefined') {
    self.onmessage = function (e) {
      var d = e.data, pos = new Position(d.fen || START);
      (d.moves || []).forEach(function (u) { var m = pos.fromUci(u); if (m) pos.make(m); });
      if (!d.fen && d.level !== 'easy' && d.level !== 'hint') { var bk = bookMove(d.moves || []); if (bk && pos.fromUci(bk)) { self.postMessage({ id: d.id, move: bk, score: 0, depth: 0, book: true }); return; } }
      var r = think(pos, d.level);
      self.postMessage({ id: d.id, move: r.move ? pos.uci(r.move) : '', score: r.score, depth: r.depth, nodes: r.nodes });
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
  else root.Chess = Chess;
})(typeof self !== 'undefined' ? self : this);
