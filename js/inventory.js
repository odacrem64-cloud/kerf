/* =========================================================
   Slab inventory (Moraware-style): serial-numbered slabs & remnants,
   allocated to jobs, used up when fabrication is completed.
   ========================================================= */
const SLAB_STATUS = [
  { id: 'available', name: 'Available', c: 'var(--ok)' },
  { id: 'allocated', name: 'Allocated', c: 'var(--info)' },
  { id: 'used', name: 'Used', c: 'var(--ink-3)' },
];
const slabStatusPill = (s) => { const st = SLAB_STATUS.find((x) => x.id === s) || SLAB_STATUS[0]; return `<span class="pill" style="--c:${st.c}">${st.name}</span>`; };
const slabName = (s) => s.name || (s.group || 'Slab');
const slabSize = (s) => `${fmtIn(s.L) || '?'} × ${fmtIn(s.W) || '?'}`;
const slabThumb = (s, cls = '') => (safeImg(s.photo) ? `<img class="sthumb ${cls}" src="${safeImg(s.photo)}" alt="">` : `<span class="sthumb ${cls}" style="background:${esc(isHex(s.color) ? s.color : '#ccc')}"></span>`);
function nextSerial() {
  let max = 1000;
  for (const s of S.slabs.values()) { const m = String(s.serial || '').match(/^S-(\d+)$/); if (m && +m[1] > max) max = +m[1]; }
  return max + 1;
}
const allSlabs = () => Array.from(S.slabs.values());

/* ---------- Inventory page ---------- */
VIEWS.inventory = () => {
  const u = S.ui;
  const q = u.invQ.trim().toLowerCase();
  const all = allSlabs();
  const showCost = !isCrew();
  const list = all.filter((s) => {
    if (u.invKind !== 'all' && (s.kind || 'slab') !== u.invKind) return false;
    if (u.invStatus !== 'all' && (s.status || 'available') !== u.invStatus) return false;
    if (q) { const j = s.jobId ? jobOf(s.jobId) : null; const hay = [s.serial, s.name, s.group, s.lot, s.location, s.supplier, s.thick, j && j.number, j && j.name].join(' ').toLowerCase(); if (!q.split(/\s+/).every((w) => hay.includes(w))) return false; }
    return true;
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.serial).localeCompare(String(b.serial), undefined, { numeric: true }));
  const avail = all.filter((s) => s.status === 'available');
  const fulls = avail.filter((s) => (s.kind || 'slab') === 'slab'), rems = avail.filter((s) => s.kind === 'remnant');
  const alloc = all.filter((s) => s.status === 'allocated');
  const value = sum(all.filter((s) => s.status !== 'used'), (s) => s.cost);
  const kpis = `<div class="kpis">
    <div class="kpi"><span class="label">Full slabs available</span><span class="value">${fulls.length}</span><span class="sub">${sqft1(sum(fulls, slabSqft))} sq ft</span></div>
    <div class="kpi"><span class="label">Remnants available</span><span class="value">${rems.length}</span><span class="sub">${sqft1(sum(rems, slabSqft))} sq ft</span></div>
    <div class="kpi"><span class="label">Allocated to jobs</span><span class="value">${alloc.length}</span><span class="sub">${new Set(alloc.map((s) => s.jobId)).size} job${new Set(alloc.map((s) => s.jobId)).size === 1 ? '' : 's'}</span></div>
    <div class="kpi"><span class="label">${showCost ? 'Value on hand' : 'Colors in stock'}</span><span class="value">${showCost ? money(value) : new Set(avail.map((s) => s.name)).size}</span><span class="sub">${showCost ? 'Available + allocated, at cost' : 'Different colors available'}</span></div>
  </div>`;
  const toolbar = `<div class="toolbar">
    <input class="input search" id="inv-q" type="search" placeholder="Search serial, color, lot, location, job" value="${esc(u.invQ)}" data-input="invQ" aria-label="Search inventory">
    <div class="seg" role="group" aria-label="Kind">${[['all', 'All'], ['slab', 'Full slabs'], ['remnant', 'Remnants']].map(([k, l]) => `<button data-act="ui" data-k="invKind" data-v="${k}" aria-pressed="${u.invKind === k}">${l}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Status">${[['available', 'Available'], ['allocated', 'Allocated'], ['used', 'Used'], ['all', 'All']].map(([k, l]) => `<button data-act="ui" data-k="invStatus" data-v="${k}" aria-pressed="${u.invStatus === k}">${l}</button>`).join('')}</div>
  </div>`;
  const table = list.length ? `<div class="card"><div class="tablewrap"><table class="t"><thead><tr><th></th><th>Serial</th><th>Color</th><th>Price group</th><th class="r">Size</th><th class="r">Sq ft</th><th>Thick</th><th>Location</th><th>Status</th><th>Job</th>${showCost ? '<th class="r">Cost</th>' : ''}</tr></thead><tbody>
    ${list.map((s) => { const j = s.jobId ? jobOf(s.jobId) : null; return `<tr class="click" data-act="slab-edit" data-id="${esc(s.id)}"><td style="width:44px">${slabThumb(s)}</td><td class="mono">${esc(s.serial)}${s.kind === 'remnant' ? ' <span class="tag">Remnant</span>' : ''} ${demoTag(s)}</td><td class="wrap"><b>${esc(slabName(s))}</b>${s.lot ? `<div class="faint" style="font-size:12px">Lot ${esc(s.lot)}</div>` : ''}</td><td>${esc(s.group || '')}</td><td class="r mono">${slabSize(s)}</td><td class="r">${sqft1(slabSqft(s))}</td><td>${esc(s.thick || '')}</td><td>${esc(s.location || '—')}</td><td>${slabStatusPill(s.status)}</td><td>${j ? `<span class="mono">${esc(j.number)}</span> ${esc(lastName((customer(j.customerId) || {}).name))}` : '<span class="faint">—</span>'}</td>${showCost ? `<td class="r">${s.cost ? money(s.cost) : '—'}</td>` : ''}</tr>`; }).join('')}
  </tbody></table></div></div>`
    : `<div class="card"><div class="empty">${all.length ? '<b>Nothing matches.</b><span>Try All, or clear the search.</span>' : `<b>No slabs in inventory yet.</b><span>When a delivery comes in, tap Receive slabs. Give each slab a serial, size and rack location, then allocate them to jobs.</span>${S.canWrite ? `<button class="btn primary" data-act="slab-receive">${icon('plus')}Receive slabs</button>` : ''}`}</div></div>`;
  return {
    title: 'Inventory',
    actions: S.canWrite ? `<button class="btn" data-act="slab-receive">${icon('plus')}<span class="lbl">Receive slabs</span></button>` : '',
    body: kpis + toolbar + table,
  };
};

/* ---------- receive / edit ---------- */
function groupOptions(sel) {
  const mats = cfg().materials;
  return `<option value="">—</option>` + mats.map((m) => `<option value="${esc(m.id)}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
}
function slabFieldsHTML(s) {
  return `<div class="grid2">
    <label class="field span2"><span>Color / product name</span><input class="input" id="sl-name" value="${esc(s.name || '')}" placeholder="Calacatta Laza, Taj Mahal, Steel Grey…" list="sl-names"></label>
    <datalist id="sl-names">${Array.from(new Set(allSlabs().map((x) => x.name).filter(Boolean))).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label class="field"><span>Price group</span><select class="input" id="sl-group">${groupOptions(s.matId)}</select><small>Matches slabs to quotes</small></label>
    <label class="field"><span>Thickness</span><select class="input" id="sl-thick">${THICKNESS.map((t) => `<option ${(s.thick || '3cm') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="field"><span>Length (in)</span><input class="input mono right" id="sl-L" inputmode="decimal" value="${esc(fmtIn(s.L, false))}"></label>
    <label class="field"><span>Width (in)</span><input class="input mono right" id="sl-W" inputmode="decimal" value="${esc(fmtIn(s.W, false))}"></label>
    <label class="field"><span>Rack / location</span><input class="input" id="sl-loc" value="${esc(s.location || '')}" placeholder="Rack A3, Yard, Remnant rack"></label>
    <label class="field"><span>Lot / bundle</span><input class="input" id="sl-lot" value="${esc(s.lot || '')}"></label>
    <label class="field"><span>Supplier</span><input class="input" id="sl-sup" value="${esc(s.supplier || '')}" list="sl-sups"></label>
    <datalist id="sl-sups">${Array.from(new Set(allSlabs().map((x) => x.supplier).filter(Boolean))).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    ${isCrew() ? '' : `<label class="field"><span>Cost per slab</span><input class="input mono right" id="sl-cost" inputmode="decimal" value="${s.cost ? esc(s.cost) : ''}" placeholder="0"></label>`}
    <label class="field span2"><span>Notes</span><input class="input" id="sl-notes" value="${esc(s.notes || '')}" placeholder="Fissure on one end, bookmatched with S-1012…"></label>
  </div>`;
}
function readSlabFields() {
  const matId = val('#sl-group');
  const m = cfg().materials.find((x) => x.id === matId);
  const out = { name: val('#sl-name'), matId: matId || '', group: m ? m.name : '', color: m && isHex(m.color) ? m.color : '#C8C5BF', thick: val('#sl-thick'), L: round2(parseIn(val('#sl-L'))), W: round2(parseIn(val('#sl-W'))), location: val('#sl-loc'), lot: val('#sl-lot'), supplier: val('#sl-sup'), notes: val('#sl-notes') };
  if ($('#sl-cost')) out.cost = round2(parseFloat(val('#sl-cost').replace(/[$,]/g, '')) || 0);
  return out;
}
function receiveModal() {
  if (!guardWrite()) return;
  MS = { kind: 'receive' };
  const c = cfg();
  openModal({
    title: 'Receive slabs',
    body: `<p class="muted" style="margin:0">Each slab gets its own serial number so you can find it on the rack and allocate it to a job.</p>
      ${slabFieldsHTML({ L: c.slabL, W: c.slabW, thick: '3cm' })}
      <div class="grid2"><label class="field"><span>How many slabs</span><input class="input mono right" id="sl-qty" inputmode="numeric" value="1"></label>
      <label class="field"><span>First serial</span><input class="input mono" id="sl-first" value="S-${nextSerial()}"><small>The rest count up from here</small></label></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="slab-receive-save">Add to inventory</button>`,
  });
}
function slabModal(id) {
  const s = S.slabs.get(id);
  if (!s) return;
  MS = { kind: 'slab', id };
  const j = s.jobId ? jobOf(s.jobId) : null;
  const parent = s.parentId ? S.slabs.get(s.parentId) : null;
  const kids = allSlabs().filter((x) => x.parentId === s.id);
  openModal({
    title: `${s.serial} · ${slabName(s)}`,
    body: `<div class="slab-head">${safeImg(s.photo) ? `<img class="slab-photo" src="${safeImg(s.photo)}" alt="Slab photo">` : `<div class="slab-photo empty" style="background:${esc(isHex(s.color) ? s.color : '#ccc')}"></div>`}
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">${slabStatusPill(s.status)}<div class="mono" style="font-size:13px">${slabSize(s)} · ${sqft1(slabSqft(s))} sq ft</div>
        ${j ? `<div style="font-size:13px">For <button class="linkbtn" data-act="go" data-view="job" data-id="${esc(j.id)}">${esc(j.number)} · ${esc(j.name)}</button></div>` : ''}
        ${parent ? `<div class="faint" style="font-size:12.5px">Remnant of <button class="linkbtn" data-act="slab-edit" data-id="${esc(parent.id)}">${esc(parent.serial)}</button></div>` : ''}
        ${kids.length ? `<div class="faint" style="font-size:12.5px">Remnants: ${kids.map((k) => `<button class="linkbtn" data-act="slab-edit" data-id="${esc(k.id)}">${esc(k.serial)}</button>`).join(', ')}</div>` : ''}
        ${S.canWrite ? `<label class="btn sm" style="align-self:flex-start">${icon('camera')}${safeImg(s.photo) ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" capture="environment" class="sr" data-upload="slabphoto" data-id="${esc(s.id)}"></label>` : ''}</div></div>
      ${slabFieldsHTML(s)}
      <div class="field"><span>Status</span><div class="seg" id="sl-status">${SLAB_STATUS.map((st) => `<button type="button" data-act="slab-status" data-v="${st.id}" aria-pressed="${(s.status || 'available') === st.id}">${st.name}</button>`).join('')}</div>${s.jobId ? '<small>Setting Available releases it from the job.</small>' : ''}</div>`,
    foot: `${S.canWrite && isStaff() ? `<button class="btn danger left" data-act="slab-delete" data-id="${esc(s.id)}">${icon('trash')}Delete</button>` : ''}${S.canWrite ? `<button class="btn" data-act="slab-remnant" data-id="${esc(s.id)}">${icon('slab')}Add remnant</button>` : ''}<button class="btn" data-act="close-modal">Cancel</button>${S.canWrite ? '<button class="btn primary" data-act="slab-save">Save</button>' : ''}`,
  });
  MS.status = s.status || 'available';
}
function remnantModal(parentId) {
  const p = S.slabs.get(parentId);
  if (!p || !guardWrite()) return;
  MS = { kind: 'remnant', parentId };
  const n = allSlabs().filter((x) => x.parentId === p.id).length + 1;
  openModal({
    title: `Remnant from ${p.serial}`,
    body: `<p class="muted" style="margin:0">${esc(slabName(p))}${p.thick ? ' · ' + esc(p.thick) : ''}. Measure the largest usable rectangle.</p>
      <div class="grid2">
        <label class="field"><span>Length (in)</span><input class="input mono right" id="rm-L" inputmode="decimal" autofocus></label>
        <label class="field"><span>Width (in)</span><input class="input mono right" id="rm-W" inputmode="decimal"></label>
        <label class="field"><span>Serial</span><input class="input mono" id="rm-serial" value="${esc(p.serial)}-R${n}"></label>
        <label class="field"><span>Rack / location</span><input class="input" id="rm-loc" value="Remnant rack"></label>
      </div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="remnant-save">Add remnant</button>`,
  });
}
function allocateModal(jobId) {
  const j = jobOf(jobId);
  if (!j || !guardWrite()) return;
  const want = new Set(((j.quote && j.quote.areas) || []).map((a) => a.mat && a.mat.id).filter(Boolean));
  const avail = allSlabs().filter((s) => s.status === 'available')
    .sort((a, b) => (want.has(b.matId) - want.has(a.matId)) || ((a.kind === 'remnant') - (b.kind === 'remnant')) || String(a.name).localeCompare(String(b.name)) || String(a.serial).localeCompare(String(b.serial), undefined, { numeric: true }));
  MS = { kind: 'allocate', jobId, pick: new Set() };
  const need = j.quote ? calcQuote(j.quote).nest.slabs : 0;
  openModal({
    title: `Allocate slabs to ${j.number}`,
    body: `<p class="muted" style="margin:0">${need ? `The quote estimates <b>${need} slab${need === 1 ? '' : 's'}</b>${j.material ? ' of ' + esc(j.material) : ''}. ` : ''}Pick the slabs and remnants this job will be cut from. Matching price groups are listed first.</p>
      ${avail.length ? `<div class="rows pick-list">${avail.map((s) => `<label class="row pick"><input type="checkbox" data-change="slab-pick" value="${esc(s.id)}">${slabThumb(s)}<span class="grow"><span class="t1">${esc(s.serial)} · ${esc(slabName(s))} ${s.kind === 'remnant' ? '<span class="tag">Remnant</span>' : ''} ${want.has(s.matId) ? '<span class="tag ok">Matches quote</span>' : ''}</span><span class="t2"><span class="mono">${slabSize(s)}</span> · ${sqft1(slabSqft(s))} ft² · ${esc(s.thick || '')}${s.location ? ' · ' + esc(s.location) : ''}</span></span></label>`).join('')}</div>`
      : `<div class="empty"><b>No available slabs.</b><span>Receive slabs on the Inventory page first.</span><button class="btn" data-act="go" data-view="inventory">Open inventory</button></div>`}`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button>${avail.length ? '<button class="btn primary" data-act="allocate-save">Allocate</button>' : ''}`,
  });
}

/* ---------- Material card on a job ---------- */
function materialCardHTML(j) {
  const list = slabsForJob(j.id);
  const need = j.quote ? calcQuote(j.quote).nest.slabs : 0;
  const allocated = list.filter((s) => s.status !== 'available');
  const W = S.canWrite;
  if (!list.length && !j.quote) return '';
  const status = need ? `<span class="tag ${allocated.length >= need ? 'ok' : allocated.length ? 'warn' : ''}">${allocated.length} of ${need} slab${need === 1 ? '' : 's'}</span>` : '';
  return `<div class="card"><div class="card-h"><h2>Slabs</h2>${status}${W ? `<button class="btn sm" data-act="allocate" data-id="${esc(j.id)}">${icon('slab')}Allocate</button>` : ''}</div>
    ${list.length ? `<div class="rows">${list.map((s) => `<div class="row">${slabThumb(s)}<button class="grow linkish" data-act="slab-edit" data-id="${esc(s.id)}"><span class="t1"><span class="mono">${esc(s.serial)}</span> · ${esc(slabName(s))}</span><span class="t2"><span class="mono">${slabSize(s)}</span>${s.thick ? ' · ' + esc(s.thick) : ''}${s.location ? ' · ' + esc(s.location) : ''}</span></button>${slabStatusPill(s.status)}
      ${W && s.status === 'allocated' ? `<button class="btn icon ghost sm" data-act="slab-release" data-id="${esc(s.id)}" aria-label="Release ${esc(s.serial)}" title="Put back in inventory">${icon('undo')}</button>` : ''}
      ${W && s.status === 'used' ? `<button class="btn sm ghost" data-act="slab-remnant" data-id="${esc(s.id)}" title="Record the leftover piece">+ Remnant</button>` : ''}</div>`).join('')}</div>`
    : `<div class="card-b faint" style="font-size:13px">No slabs allocated yet. Slabs are marked used when fabrication is completed.</div>`}
  </div>`;
}

const INV_ACTIONS = {
  'slab-receive': () => receiveModal(),
  'slab-edit': (el, ev) => { if (ev) ev.stopPropagation(); slabModal(el.dataset.id); },
  'slab-status': (el) => { MS.status = el.dataset.v; $$('#sl-status button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === MS.status))); },
  'slab-remnant': (el) => remnantModal(el.dataset.id),
  allocate: (el) => allocateModal(el.dataset.id),
  'slab-receive-save': async (el) => {
    const f = readSlabFields();
    if (!f.name) { fieldErr('#sl-name', 'Enter the color or product name'); return; }
    if (!f.L || !f.W) { fieldErr('#sl-L', 'Enter the slab size'); return; }
    const qty = clamp(parseInt(val('#sl-qty'), 10) || 1, 1, 60);
    const first = val('#sl-first') || `S-${nextSerial()}`;
    const m = first.match(/^(.*?)(\d+)$/);
    const used = new Set(allSlabs().map((s) => s.serial));
    const docs = [];
    for (let i = 0; i < qty; i++) {
      let serial = m ? m[1] + String(+m[2] + i).padStart(m[2].length, '0') : (i ? `${first}-${i + 1}` : first);
      if (used.has(serial)) { fieldErr('#sl-first', `Serial ${serial} is already in inventory`); return; }
      docs.push({ id: uid(), serial, kind: 'slab', status: 'available', ...f, receivedAt: Date.now(), by: S.me || '' });
    }
    el.disabled = true;
    try { await bulkPut('slabs', docs); closeModal(); toast(`${qty} slab${qty === 1 ? '' : 's'} added to inventory`); S.ui.invStatus = 'available'; if (S.view === 'inventory') render(true); }
    catch (e) { el.disabled = false; }
  },
  'slab-save': async () => {
    const s = S.slabs.get(MS.id); if (!s) return;
    const f = readSlabFields();
    if (!f.name) { fieldErr('#sl-name', 'Enter the color or product name'); return; }
    const st = MS.status;
    const upd = { ...f, status: st };
    if (st === 'available' && s.jobId) { upd.jobId = null; await addNote(s.jobId, `Slab ${s.serial} released back to inventory`, 'event'); }
    if (st === 'allocated' && !s.jobId) { toast('Allocate it from the job’s Slabs card to pick the job', { bad: true }); return; }
    if (st === 'used' && s.status !== 'used') upd.usedAt = Date.now();
    await patch('slabs', s.id, upd);
    closeModal(); toast('Slab saved');
  },
  'slab-delete': async (el) => {
    const s = S.slabs.get(el.dataset.id); if (!s) return;
    if (!(await confirmBox(`Delete ${s.serial}?`, 'Use this for slabs entered by mistake. To record a slab that was cut, mark it Used instead.', 'Delete', true))) return;
    await remove('slabs', s.id); toast('Slab deleted');
  },
  'slab-release': async (el) => {
    const s = S.slabs.get(el.dataset.id); if (!s) return;
    const jobId = s.jobId;
    await patch('slabs', s.id, { status: 'available', jobId: null });
    if (jobId) await addNote(jobId, `Slab ${s.serial} released back to inventory`, 'event');
    toast(`${s.serial} is back in inventory`);
  },
  'remnant-save': async () => {
    const p = S.slabs.get(MS.parentId); if (!p) return;
    const L = round2(parseIn(val('#rm-L'))), W = round2(parseIn(val('#rm-W')));
    if (!L || !W) { fieldErr('#rm-L', 'Enter the remnant size'); return; }
    const serial = val('#rm-serial') || `${p.serial}-R`;
    if (allSlabs().some((s) => s.serial === serial)) { fieldErr('#rm-serial', 'That serial is already used'); return; }
    await put('slabs', uid(), { serial, kind: 'remnant', status: 'available', parentId: p.id, name: p.name, matId: p.matId || '', group: p.group || '', color: p.color, thick: p.thick, supplier: p.supplier || '', lot: p.lot || '', L, W, location: val('#rm-loc'), cost: 0, notes: '', receivedAt: Date.now(), by: S.me || '' });
    if (p.jobId) await addNote(p.jobId, `Remnant ${serial} (${fmtIn(L)} × ${fmtIn(W)}) saved from slab ${p.serial}`, 'event');
    closeModal(); toast(`Remnant ${serial} added`);
  },
  'allocate-save': async (el) => {
    const j = jobOf(MS.jobId); if (!j) return;
    const ids = Array.from(MS.pick);
    if (!ids.length) { toast('Tick the slabs to allocate', { bad: true }); return; }
    el.disabled = true;
    const picked = ids.map((id) => S.slabs.get(id)).filter(Boolean);
    for (const s of picked) await patch('slabs', s.id, { status: 'allocated', jobId: j.id, allocatedAt: Date.now() });
    await addNote(j.id, `Allocated slab${picked.length === 1 ? '' : 's'} ${picked.map((s) => s.serial).join(', ')}`, 'event');
    closeModal(); toast(`${picked.length} slab${picked.length === 1 ? '' : 's'} allocated to ${j.number}`);
  },
};
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el && el.dataset && el.dataset.change === 'slab-pick' && MS && MS.kind === 'allocate') { if (el.checked) MS.pick.add(el.value); else MS.pick.delete(el.value); }
});
