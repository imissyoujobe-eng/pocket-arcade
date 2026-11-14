/*
 * Joystik app signer: signs an Android App Bundle (.aab) with your upload key, entirely in this browser.
 * Same result as `jarsigner -digestalg SHA-256 -sigalg SHA256withRSA`: META-INF/MANIFEST.MF, <NAME>.SF and <NAME>.RSA.
 * Reads PKCS12 keystores (what PWABuilder and Bubblewrap make) and older JKS keystores. RSA keys only.
 * Needs node-forge and JSZip (globals in the browser, require() in Node for tests). Nothing is sent anywhere.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('node-forge'), require('jszip'));
  else root.JoystikSign = factory(root.forge, root.JSZip);
})(typeof self !== 'undefined' ? self : this, function (forge, JSZip) {
  'use strict';
  const asn1 = forge.asn1;

  // ---------- bytes ----------
  const bin = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
  const u8 = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
  const utf8 = s => u8(unescape(encodeURIComponent(s)));
  const cat = (...parts) => { let n = 0; parts.forEach(p => n += p.length); const o = new Uint8Array(n); let k = 0; parts.forEach(p => { o.set(p, k); k += p.length; }); return o; };
  const sha1 = b => u8(forge.md.sha1.create().update(bin(b)).digest().getBytes());
  const sha256b64 = b => forge.util.encode64(forge.md.sha256.create().update(bin(b)).digest().getBytes());
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join(':').toUpperCase();

  // minimal DER writer, so certificates go into the signature byte-for-byte as they are in the keystore
  function tlv(tag, content) {
    const n = content.length; let len;
    if (n < 128) len = [n];
    else { const b = []; let v = n; while (v > 0) { b.unshift(v & 255); v = Math.floor(v / 256); } len = [0x80 | b.length, ...b]; }
    return cat(new Uint8Array([tag, ...len]), content);
  }
  const SEQ = (...c) => tlv(0x30, cat(...c));
  const SET = (...c) => tlv(0x31, cat(...c));
  const INT = n => tlv(0x02, new Uint8Array([n]));
  const NULL = new Uint8Array([0x05, 0x00]);
  const OID = s => u8(asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(s).getBytes())).getBytes());
  const OCTETS = b => tlv(0x04, b);
  const OIDS = { data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2', sha256: '2.16.840.1.101.3.4.2.1', rsa: '1.2.840.113549.1.1.1' };

  // ---------- keystores ----------
  class KeyError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

  function certInfo(der) {
    const c = asn1.fromDer(bin(der));
    const tbs = c.value[0].value;
    const i = (tbs[0].tagClass === asn1.Class.CONTEXT_SPECIFIC) ? 1 : 0;
    const serial = u8(asn1.toDer(tbs[i]).getBytes());
    const issuer = u8(asn1.toDer(tbs[i + 2]).getBytes());
    let subject = '';
    try { const fc = forge.pki.certificateFromAsn1(c); subject = fc.subject.attributes.map(a => (a.shortName || a.name) + '=' + a.value).join(', '); } catch (e) { /* non-RSA certs still sign-checkable below */ }
    return { der, serial, issuer, subject, sha1: hex(sha1(der)), sha256: hex(u8(forge.md.sha256.create().update(bin(der)).digest().getBytes())) };
  }

  function readJKS(bytes, storePass, keyPass) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let p = 0;
    const int = () => { const v = dv.getInt32(p); p += 4; return v; };
    const utf = () => { const n = dv.getUint16(p); p += 2; const s = new TextDecoder().decode(bytes.subarray(p, p + n)); p += n; return s; };
    const take = n => { const b = bytes.subarray(p, p + n); p += n; return b; };
    const magic = int() >>> 0;
    if (magic === 0xCECECECE) throw new KeyError('format', 'This is a JCEKS keystore. Convert it to PKCS12 first.');
    const version = int(); const count = int();
    const entries = [];
    for (let e = 0; e < count; e++) {
      const tag = int(); const alias = utf(); p += 8; // date
      if (tag === 1) {
        const key = take(int()); const chain = [];
        const n = int();
        for (let k = 0; k < n; k++) { if (version === 2) utf(); chain.push(take(int())); }
        entries.push({ alias, key, chain });
      } else if (tag === 2) { if (version === 2) utf(); take(int()); }
      else throw new KeyError('format', 'This keystore has an entry type the signer can\'t read.');
    }
    // integrity check: SHA-1(password as UTF-16BE + "Mighty Aphrodite" + everything before the hash)
    const pw16 = s => { const o = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { o[2 * i] = s.charCodeAt(i) >> 8; o[2 * i + 1] = s.charCodeAt(i) & 255; } return o; };
    const body = bytes.subarray(0, p), stored = bytes.subarray(p, p + 20);
    const calc = sha1(cat(pw16(storePass), utf8('Mighty Aphrodite'), body));
    if (hex(calc) !== hex(stored)) throw new KeyError('storepass', 'The keystore password doesn\'t match this keystore.');
    const out = [];
    for (const en of entries) {
      // EncryptedPrivateKeyInfo with Sun's own key protection: SHA-1 keystream XOR, then a SHA-1 check
      const epki = asn1.fromDer(bin(en.key));
      const enc = u8(epki.value[1].value);
      const salt = enc.subarray(0, 20), body2 = enc.subarray(20, enc.length - 20), check = enc.subarray(enc.length - 20);
      const tryPass = pass => {
        const pw = pw16(pass); const ks = new Uint8Array(body2.length); let d = salt;
        for (let i = 0; i < body2.length; i += 20) { d = sha1(cat(pw, d)); ks.set(d.subarray(0, Math.min(20, body2.length - i)), i); }
        const plain = body2.map((b, i) => b ^ ks[i]);
        return hex(sha1(cat(pw, plain))) === hex(check) ? plain : null;
      };
      let plain = tryPass(keyPass || storePass);
      if (!plain && keyPass && keyPass !== storePass) plain = tryPass(storePass);
      if (!plain) throw new KeyError('keypass', 'The key password for "' + en.alias + '" doesn\'t match.');
      out.push({ alias: en.alias, keyDer: plain, chain: en.chain });
    }
    return out;
  }

  function readP12(bytes, storePass, keyPass) {
    let p12;
    const der = asn1.fromDer(bin(bytes));
    // keep each certificate's original DER (forge would otherwise rebuild part of it)
    const orig = forge.pki.certificateFromAsn1;
    forge.pki.certificateFromAsn1 = function (obj, computeHash) { const c = orig.call(this, obj, computeHash); c.__der = u8(asn1.toDer(obj).getBytes()); return c; };
    try { p12 = forge.pkcs12.pkcs12FromAsn1(der, false, storePass); }
    catch (e) {
      const m = String(e.message);
      if (/ShroudedKeyBag/i.test(m)) throw new KeyError('keypass', 'The keystore opened, but the key inside wouldn\'t unlock. Try the keystore password in both boxes.');
      if (/mac|password|Invalid|PKCS#12/i.test(m)) throw new KeyError('storepass', 'The keystore password doesn\'t match this keystore.');
      throw new KeyError('format', 'Couldn\'t read this keystore (' + m + ').');
    } finally { forge.pki.certificateFromAsn1 = orig; }
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const idOf = bag => { const v = bag.attributes && bag.attributes.localKeyId; return v && v[0] ? forge.util.bytesToHex(v[0]) : ''; };
    const nameOf = bag => { const v = bag.attributes && bag.attributes.friendlyName; return v && v[0] ? v[0] : ''; };
    const certDer = bag => bag.cert ? (bag.cert.__der || u8(asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes())) : (bag.asn1 ? u8(asn1.toDer(bag.asn1).getBytes()) : null);
    const out = [];
    for (const kb of keyBags) {
      let key = kb.key;
      if (!key && kb.asn1 && keyPass && keyPass !== storePass) { try { key = forge.pki.decryptPrivateKeyInfo(kb.asn1, keyPass); } catch (e) { /* fall through */ } }
      const id = idOf(kb);
      const chain = certBags.filter(cb => id && idOf(cb) === id).map(certDer).filter(Boolean);
      if (!chain.length && certBags.length === 1) chain.push(certDer(certBags[0]));
      out.push({ alias: nameOf(kb) || nameOf(certBags[0] || {}) || 'key', key, chain, rsa: key && key.n ? true : false, raw: kb });
    }
    if (!out.length) throw new KeyError('format', 'No private key was found in this keystore.');
    return out;
  }

  /** Lists the keys in a keystore: [{ alias, subject, sha1, sha256 }]. Throws KeyError on a wrong password. */
  function openKeystore(bytes, storePass, keyPass) {
    const magic = bytes.length >= 4 ? ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0 : 0;
    let entries;
    if (magic === 0xFEEDFEED || magic === 0xCECECECE) {
      entries = readJKS(bytes, storePass, keyPass).map(e => {
        const key = forge.pki.privateKeyFromAsn1(asn1.fromDer(bin(e.keyDer)));
        return { alias: e.alias, key, chain: e.chain };
      });
    } else if (bytes[0] === 0x30) {
      entries = readP12(bytes, storePass, keyPass);
      for (const e of entries) if (!e.key) throw new KeyError('keypass', 'The key password for "' + e.alias + '" doesn\'t match.');
    } else throw new KeyError('format', 'This file doesn\'t look like a keystore. Pick the .keystore (or .jks) file from your PWABuilder zip.');
    return entries.map(e => {
      if (!e.key || !e.key.n) throw new KeyError('alg', 'This key isn\'t an RSA key, so this signer can\'t use it.');
      if (!e.chain.length) throw new KeyError('format', 'The key "' + e.alias + '" has no certificate.');
      const info = certInfo(e.chain[0]);
      return { alias: e.alias, key: e.key, chain: e.chain, subject: info.subject, sha1: info.sha1, sha256: info.sha256, leaf: info };
    });
  }

  // ---------- jar signing ----------
  function wrap72(line) { // java.util.jar.Manifest line length rule
    const b = utf8(line); if (b.length <= 72) return line + '\r\n';
    let out = '', i = 0; const s = new TextDecoder().decode(b);
    // names here are ASCII, so bytes == chars
    out += s.slice(0, 72) + '\r\n'; i = 72;
    while (i < s.length) { out += ' ' + s.slice(i, i + 71) + '\r\n'; i += 71; }
    return out;
  }

  async function signBundle(aabBytes, entry, opts) {
    opts = opts || {};
    const name = (opts.signerName || 'JOYSTIK').toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
    const zin = await JSZip.loadAsync(aabBytes);
    const files = [];
    zin.forEach((path, f) => {
      if (f.dir) return;
      const up = path.toUpperCase();
      if (up === 'META-INF/MANIFEST.MF' || /^META-INF\/[^/]+\.(SF|RSA|DSA|EC)$/.test(up)) return; // re-signing replaces old signatures
      files.push({ path, f });
    });
    if (!files.some(x => x.path === 'BundleConfig.pb')) throw new KeyError('bundle', 'This doesn\'t look like an Android App Bundle (.aab).');
    const created = 'Created-By: 1.0 (Joystik Signer)\r\n';
    const mainMF = 'Manifest-Version: 1.0\r\n' + created + '\r\n';
    let mf = mainMF, sfEntries = '';
    for (const x of files) {
      x.data = await x.f.async('uint8array');
      const section = wrap72('Name: ' + x.path) + 'SHA-256-Digest: ' + sha256b64(x.data) + '\r\n\r\n';
      mf += section;
      sfEntries += wrap72('Name: ' + x.path) + 'SHA-256-Digest: ' + sha256b64(utf8(section)) + '\r\n\r\n';
    }
    const mfBytes = utf8(mf);
    const sf = 'Signature-Version: 1.0\r\n' + created +
      'SHA-256-Digest-Manifest: ' + sha256b64(mfBytes) + '\r\n' +
      'SHA-256-Digest-Manifest-Main-Attributes: ' + sha256b64(utf8(mainMF)) + '\r\n\r\n' + sfEntries;
    const sfBytes = utf8(sf);
    // PKCS#7 SignedData, detached, SHA-256 with RSA (PKCS#1 v1.5), no signed attributes (as jarsigner does)
    const md = forge.md.sha256.create(); md.update(bin(sfBytes));
    const sig = u8(entry.key.sign(md));
    const leaf = entry.leaf;
    const signerInfo = SEQ(INT(1), SEQ(leaf.issuer, leaf.serial), SEQ(OID(OIDS.sha256), NULL), SEQ(OID(OIDS.rsa), NULL), OCTETS(sig));
    const signedData = SEQ(INT(1), SET(SEQ(OID(OIDS.sha256), NULL)), SEQ(OID(OIDS.data)),
      tlv(0xA0, cat(...entry.chain)), SET(signerInfo));
    const p7 = SEQ(OID(OIDS.signedData), tlv(0xA0, signedData));
    // check our own signature before handing it back
    const ok = forge.pki.certificateFromAsn1(asn1.fromDer(bin(entry.chain[0]))).publicKey.verify(md.digest().getBytes(), bin(sig));
    if (!ok) throw new KeyError('sign', 'The signature didn\'t check out against the key\'s certificate.');
    const zout = new JSZip();
    const opt = { binary: true, createFolders: false, date: new Date(Date.UTC(1981, 0, 1, 1, 1, 2)) };
    zout.file('META-INF/MANIFEST.MF', mfBytes, opt);
    zout.file('META-INF/' + name + '.SF', sfBytes, opt);
    zout.file('META-INF/' + name + '.RSA', p7, opt);
    for (const x of files) zout.file(x.path, x.data, opt);
    const out = await zout.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { bytes: out, entries: files.length, signer: name };
  }

  return { openKeystore, signBundle, KeyError };
});
