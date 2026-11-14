// Joystik App Signer page: reads the two files locally, signs with sign-core.js, offers the result as a download.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const files = { aab: null, ks: null };
  let keys = null, keyFor = '', saveUrl = null;

  const read = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(new Uint8Array(r.result));
    r.onerror = () => rej(r.error || new Error('Could not read the file.'));
    r.readAsArrayBuffer(f);
  });
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const say = (kind, text) => { const m = $('msg'); if (!text) { m.hidden = true; return; } m.className = 'msg ' + kind; m.textContent = text; m.hidden = false; };
  const reset = () => { $('done').hidden = true; if (saveUrl) { URL.revokeObjectURL(saveUrl); saveUrl = null; } };

  function pick(id, which) {
    $(id).addEventListener('change', async e => {
      reset(); say('', '');
      const f = e.target.files && e.target.files[0];
      files[which] = null; $(id + '-name').textContent = '';
      if (which === 'ks') { keys = null; $('alias-wrap').hidden = true; }
      if (!f) return;
      try {
        files[which] = { name: f.name, bytes: await read(f) };
        $(id + '-name').textContent = '✓ ' + f.name + ' (' + size(f.size) + ')';
      } catch (err) { say('bad', 'Couldn\'t open ' + f.name + '. Try picking it again.'); }
    });
  }
  pick('aab', 'aab');
  pick('ks', 'ks');
  ['storepass', 'keypass'].forEach(id => $(id).addEventListener('input', () => { keys = null; reset(); say('', ''); }));

  $('go').addEventListener('click', async () => {
    reset(); say('', '');
    const sp = $('storepass').value, kp = $('keypass').value || $('storepass').value;
    if (!files.aab) return say('bad', 'Pick your app file in step 1 first.');
    if (!/\.aab$/i.test(files.aab.name)) return say('bad', 'Step 1 needs the .aab app file, not ' + files.aab.name + '.');
    if (!files.ks) return say('bad', 'Pick your signing key file in step 2.');
    if (!sp) return say('bad', 'Type the key store password in step 3.');
    const btn = $('go'); btn.disabled = true;
    try {
      const sig = sp + '\u0000' + kp + '\u0000' + files.ks.name + files.ks.bytes.length;
      if (!keys || keyFor !== sig) {
        say('work', 'Unlocking your key…');
        await new Promise(r => setTimeout(r, 30)); // let the message paint; unlocking takes a moment
        keys = JoystikSign.openKeystore(files.ks.bytes, sp, kp); keyFor = sig;
        const sel = $('alias'); sel.innerHTML = '';
        keys.forEach((k, i) => { const o = document.createElement('option'); o.value = i; o.textContent = k.alias; sel.appendChild(o); });
        $('alias-wrap').hidden = keys.length < 2;
      }
      const k = keys[+$('alias').value || 0];
      say('work', 'Signing your app…');
      await new Promise(r => setTimeout(r, 30));
      const r = await JoystikSign.signBundle(files.aab.bytes, k);
      const outName = files.aab.name.replace(/(-unsigned)?\.aab$/i, '') + '-signed.aab';
      saveUrl = URL.createObjectURL(new Blob([r.bytes], { type: 'application/octet-stream' }));
      const a = $('save'); a.href = saveUrl; a.download = outName; a.textContent = 'Save ' + outName;
      $('out-name').textContent = outName + ' (' + size(r.bytes.length) + ')';
      $('out-alias').textContent = k.alias;
      $('out-sha1').textContent = k.sha1;
      say('', '');
      $('done').hidden = false;
      $('storepass').value = ''; $('keypass').value = ''; // don't leave passwords sitting in the page
      a.focus();
    } catch (e) {
      keys = null;
      say('bad', (e && e.message) ? e.message : 'Something went wrong while signing. Check the files and passwords and try again.');
    } finally { btn.disabled = false; }
  });
})();
