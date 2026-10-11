/* =========================================================
   Slab scanner: photo → AI guess → "Is this the right slab?" → inventory
   Nothing is added until a person confirms it.
   ========================================================= */
const SCAN = { photo: '', label: '', thumb: '', guess: null, busy: false, err: '' };
const scanAiOn = () => S.mode === 'db' && S.auth.cfg && S.auth.cfg.ai;

function scanStart() {
  if (!guardWrite()) return;
  Object.assign(SCAN, { photo: '', label: '', thumb: '', guess: null, busy: false, err: '' });
  MS = { kind: 'scan' };
  scanRender();
}
function scanRender() {
  if (!MS || MS.kind !== 'scan') return;
  const ai = scanAiOn();
  if (SCAN.guess) { scanConfirm(); return; }
  const shot = (key, label, sub, cap) => `<label class="shot ${SCAN[key] ? 'has' : ''}">
      ${SCAN[key] ? `<img src="${SCAN[key]}" alt="">` : `${icon('camera')}<b>${label}</b><small>${sub}</small>`}
      <input type="file" accept="image/*" ${cap ? 'capture="environment"' : ''} class="sr" data-upload="scan-${key}">
      ${SCAN[key] ? `<span class="shot-redo">Retake</span>` : ''}</label>`;
  openModal({
    title: 'Scan a slab', cls: 'scan-modal', focus: false,
    body: `${ai ? '' : `<div class="banner" style="font-size:12.5px"><span>${S.mode === 'db' ? 'AI scanning isn’t turned on yet (it needs the Anthropic key in Vercel).' : 'AI scanning works on the live site.'} You can still take the photo and fill in the details.</span></div>`}
      <div class="shots">${shot('photo', 'Photo of the slab', 'Whole face, good light', true)}${shot('label', 'Sticker / label', 'Optional: lot, serial, size', true)}</div>
      ${SCAN.busy ? `<div class="scan-busy"><i></i><div><b>Reading the slab…</b><span class="faint">Checking color, material and the sticker</span></div></div>` : ''}
      ${SCAN.err ? `<div class="auth-err">${esc(SCAN.err)}</div>` : ''}
      <p class="faint" style="margin:0;font-size:12.5px">You’ll check everything before it’s added to inventory.</p>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button>${ai ? `<button class="btn primary" data-act="scan-run" ${SCAN.photo && !SCAN.busy ? '' : 'disabled'}>${icon('search')}Scan with AI</button>` : `<button class="btn primary" data-act="scan-manual" ${SCAN.photo ? '' : 'disabled'}>Next: enter details</button>`}`,
  });
}
async function scanPicked(kind, file) {
  try {
    if (kind === 'photo') { SCAN.photo = await readImageMax(file, 1568); SCAN.thumb = await readImage(file, { max: 640 }); }
    else SCAN.label = await readImageMax(file, 1568);
    SCAN.err = ''; SCAN.guess = null;
  } catch (e) { SCAN.err = e.message || 'Couldn’t use that photo.'; }
  scanRender();
}
/* larger image for the AI to read stickers (kept out of the database) */
function readImageMax(file, max) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Pick a photo.')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Couldn’t read that photo.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That photo couldn’t be opened. Try JPG or PNG, or take it again.'));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function scanRun() {
  if (!SCAN.photo || SCAN.busy) return;
  SCAN.busy = true; SCAN.err = ''; scanRender();
  try {
    const j = await postJSON('/api/scan-slab', { shopId: S.shopId, photo: SCAN.photo, label: SCAN.label || undefined, groups: cfg().materials.map((m) => ({ id: m.id, name: m.name, group: m.group })) });
    SCAN.guess = j.guess;
  } catch (e) {
    SCAN.err = e.message || 'The scan didn’t work. Try again.';
  }
  SCAN.busy = false;
  scanRender();
}
function scanConfirm() {
  const g = SCAN.guess || {};
  const c = cfg();
  const mat = c.materials.find((m) => m.id === g.matId) || c.materials.find((m) => (m.group || '').toLowerCase() === String(g.category || '').toLowerCase());
  const draft = { name: g.name || '', matId: mat ? mat.id : '', thick: g.thickness || '3cm', L: g.L || c.slabL, W: g.W || c.slabW, lot: g.lot || '', supplier: g.supplier || g.brand || '', location: '', notes: [g.finish && g.finish !== 'Polished' ? g.finish : '', g.notes].filter(Boolean).join(' · ') };
  const ai = !!SCAN.guess && SCAN.guess.name !== undefined && scanAiOn();
  const pct = Math.round((g.confidence || 0) * 100);
  const same = g.name ? allSlabs().filter((s) => s.status !== 'used' && String(s.name).toLowerCase() === String(g.name).toLowerCase()) : [];
  const sizeGuessed = !g.L || !g.W;
  MS = { kind: 'scanconfirm' };
  openModal({
    title: ai ? 'Is this the right slab?' : 'Slab details', wide: true, cls: 'scan-modal', focus: false,
    body: `<div class="scan-result">
        <img class="scan-photo" src="${SCAN.thumb || SCAN.photo}" alt="Scanned slab">
        <div class="scan-guess">
          ${ai ? (g.isSlab === false ? `<div class="auth-err">This doesn’t look like a slab. Retake the photo, or fill in the details yourself.</div>` : `
          <div class="eyebrow">AI thinks this is</div>
          <div class="guess-name">${esc(g.name || 'Unknown color')}</div>
          <div class="muted">${esc([g.category, g.brand, g.thickness].filter(Boolean).join(' · '))}</div>
          <div class="conf"><div class="meter"><i class="${pct < 50 ? 'over' : pct < 75 ? 'near' : ''}" style="width:${pct}%"></i></div><span>${pct}% sure</span></div>
          ${g.labelText ? `<div class="faint" style="font-size:12px">Sticker: <span class="mono">${esc(g.labelText)}</span></div>` : ''}
          ${g.notes ? `<div class="tag warn" style="white-space:normal">${esc(g.notes)}</div>` : ''}`) : '<div class="muted">Fill in what’s on the slab and its sticker.</div>'}
          ${same.length ? `<div class="tag info" style="white-space:normal">You already have ${same.length} ${esc(g.name)} on hand${same[0].lot ? ` (lot ${esc(same[0].lot)})` : ''}. This adds another.</div>` : ''}
        </div></div>
      <div class="confirm-q">${ai ? '<b>Check each field.</b> Fix anything the scanner got wrong — it’s added only when you confirm.' : 'Check the details, then add it.'}${sizeGuessed ? ' <span class="tag warn">Size not on the sticker — measure it</span>' : ''}</div>
      ${slabFieldsHTML(draft)}
      <div class="grid2"><label class="field"><span>How many identical slabs</span><input class="input mono right" id="sl-qty" inputmode="numeric" value="1"><small>Same color & lot from one bundle</small></label>
      <label class="field"><span>Serial</span><input class="input mono" id="sl-first" value="${esc(g.serial && !allSlabs().some((s) => s.serial === g.serial) ? g.serial : 'S-' + nextSerial())}"><small>${g.serial ? 'From the sticker' : 'Next number in your inventory'}</small></label></div>`,
    foot: `<button class="btn left" data-act="scan-retake">${icon('camera')}${ai ? 'No — retake' : 'Retake photo'}</button><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="scan-save">${icon('check')}${ai ? 'Yes, add to inventory' : 'Add to inventory'}</button>`,
  });
  if (!draft.matId) { const sel = $('#sl-group'); if (sel) sel.value = ''; }
}
const SCAN_ACTIONS = {
  'slab-scan': () => scanStart(),
  'scan-run': () => scanRun(),
  'scan-manual': () => { SCAN.guess = {}; scanConfirm(); },
  'scan-retake': () => { SCAN.guess = null; SCAN.photo = ''; SCAN.label = ''; SCAN.thumb = ''; MS = { kind: 'scan' }; scanRender(); },
  'scan-save': async (el) => {
    const f = readSlabFields();
    if (!f.name) { fieldErr('#sl-name', 'Enter the color or product name'); return; }
    if (!f.L || !f.W) { fieldErr('#sl-L', 'Enter the slab size'); return; }
    if (SCAN.guess && isHex(SCAN.guess.color)) f.color = SCAN.guess.color; // swatch matches the real stone
    const qty = clamp(parseInt(val('#sl-qty'), 10) || 1, 1, 60);
    const first = val('#sl-first') || `S-${nextSerial()}`;
    const m = first.match(/^(.*?)(\d+)$/);
    const used = new Set(allSlabs().map((s) => s.serial));
    const docs = [];
    for (let i = 0; i < qty; i++) {
      const serial = qty === 1 ? first : m ? m[1] + String(+m[2] + i).padStart(m[2].length, '0') : `${first}-${i + 1}`;
      if (used.has(serial)) { fieldErr('#sl-first', `Serial ${serial} is already in inventory`); return; }
      docs.push({ id: uid(), serial, kind: 'slab', status: 'available', ...f, photo: SCAN.thumb || '', scanned: !!(SCAN.guess && SCAN.guess.name), receivedAt: Date.now(), by: S.me || '' });
    }
    el.disabled = true;
    try {
      await bulkPut('slabs', docs);
      closeModal();
      toast(`${qty === 1 ? docs[0].serial : qty + ' slabs'} · ${f.name} added to inventory`, { action: { label: 'Scan another', run: () => scanStart() } });
      if (S.view !== 'inventory') go('inventory'); else { S.ui.invStatus = 'available'; render(true); }
    } catch (e) { el.disabled = false; }
  },
};
