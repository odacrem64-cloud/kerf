/* =========================================================
   Events, actions, drag & drop, boot
   ========================================================= */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) {
    openModal({ title: 'Copy this text', body: `<textarea class="input" id="copy-box" style="min-height:180px" readonly>${esc(t)}</textarea><span class="faint" style="font-size:12px">Text is selected. Press Ctrl+C (⌘C on Mac).</span>`, foot: '<button class="btn primary" data-act="close-modal">Done</button>', focus: false });
    setTimeout(() => { const b = $('#copy-box'); if (b) { b.focus(); b.select(); } }, 40);
  }
}
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,\s%]/g, '')); return isNaN(n) ? 0 : n; };
const currentJob = () => jobOf(S.params.id);

const ACTIONS = {
  go: (el) => go(el.dataset.view, el.dataset.id ? { id: el.dataset.id } : {}),
  more: () => moreSheet(),
  palette: () => paletteOpen(),
  'new-job': (el) => newJobModal(el.dataset.cust || ''),
  'load-sample': () => loadSample(),
  'remove-sample': async () => { if (await confirmBox('Remove all sample data?', 'Every job, customer, team member and schedule item tagged SAMPLE will be deleted. Your own entries stay.', 'Remove sample data', true)) removeSample(); },
  'reset-local': async () => { if (await confirmBox('Reset the demo?', 'This clears demo data in this browser and reloads the sample shop.', 'Reset', true)) { store.del(LOCAL_KEY); startLocal(); render(true); } },
  'export-csv': () => exportCSV(),
  ui: (el) => {
    S.ui[el.dataset.k] = el.dataset.v;
    if (el.dataset.k === 'jobMode') store.set('kerf-jobmode', el.dataset.v);
    render(true);
  },
  sort: (el) => { const s = S.ui.jobSort; S.ui.jobSort = s.k === el.dataset.k ? { k: s.k, d: -s.d } : { k: el.dataset.k, d: el.dataset.k === 'updatedAt' || el.dataset.k === 'total' ? -1 : 1 }; render(true); },
  copy: (el) => copyText(el.dataset.text || ''),
  'close-modal': () => closeModal(),
  'confirm-ok': () => { const r = modalResolve; modalResolve = null; closeModal(); if (r) r(true); },

  /* job */
  stage: (el) => { const j = currentJob(); if (!j || !guardWrite()) return; const st = el.dataset.stage; if (j.stage === st) return; setStage(j, st); },
  'mark-lost': (el) => lostModal(el.dataset.id),
  'lost-save': async () => { const j = jobOf(MS.id); if (!j) return; const why = val('#lost-why'), note = val('#lost-note'); closeModal(); await setStage(j, 'lost', { reason: why + (note ? ' · ' + note : '') }); },
  'edit-job': (el) => editJobModal(el.dataset.id),
  'ej-save': async () => {
    const name = val('#ej-name'); if (!name) { fieldErr('#ej-name', 'Give the job a name'); return; }
    const id = MS.id;
    await patch('jobs', id, { name, customerId: val('#ej-cust'), address: val('#ej-addr'), salesId: val('#ej-sales'), source: val('#ej-src'), po: val('#ej-po'), updatedAt: Date.now() });
    closeModal(); toast('Job saved');
  },
  'ej-delete': async () => {
    const j = jobOf(MS.id); if (!j) return;
    if (await confirmBox(`Delete ${j.number}?`, 'This removes the job, its quote, schedule and notes for everyone. This can’t be undone.', 'Delete job', true)) { await deleteJob(j); go('jobs'); }
  },
  'add-note': async (el) => {
    const t = S.ui.noteDraft.trim(); if (!t) { const n = $('#note-text'); if (n) n.focus(); return; }
    const kind = S.ui.noteIssue ? 'issue' : 'note';
    S.ui.noteDraft = ''; S.ui.noteIssue = false;
    await addNote(el.dataset.id, t, kind);
    await patch('jobs', el.dataset.id, { updatedAt: Date.now() });
    render(true);
  },
  'quick-note': (el) => quickNoteModal(el.dataset.id),
  'qn-save': async () => { const t = val('#qn-text'); if (!t) { fieldErr('#qn-text', 'Write the note first'); return; } const issue = $('#qn-issue').checked; const id = MS.id; closeModal(); await addNote(id, t, issue ? 'issue' : 'note'); await patch('jobs', id, { updatedAt: Date.now() }); toast(issue ? 'Issue flagged for the office' : 'Note added'); },
  pay: (el) => paymentModal(el.dataset.id),
  'pay-fill': (el) => { const i = $('#pay-amt'); if (i) i.value = el.dataset.v; },
  'pay-save': async () => {
    const amt = round2(num(val('#pay-amt')));
    if (!amt) { fieldErr('#pay-amt', 'Enter the amount'); return; }
    const j = jobOf(MS.id); if (!j) return;
    const pay = { amount: amt, date: val('#pay-date') || today(), method: val('#pay-method'), note: val('#pay-note') };
    closeModal(); await recordPayment(j, pay);
  },
  'quote-doc': (el) => openQuoteDoc(el.dataset.id, false),
  'q-doc': () => { if (qd()) openQuoteDoc(qd().jobId, true); },
  'download-quote': (el) => downloadQuote(el.dataset.id, !!el.dataset.draft),
  'print-quote': (el) => printQuote(el.dataset.id, !!el.dataset.draft),
  'mark-sent': async (el) => { const j = jobOf(el.dataset.id); if (!j) return; closeModal(); await patch('jobs', j.id, { quote: { sentAt: Date.now() } }); await setStage(j, 'quoted', { quiet: true }); toast(`${j.number} marked as quoted`); },

  /* new job modal */
  'nj-mode': (el) => { MS.mode = el.dataset.v; const c = $('#nj-cust'); if (c) c.innerHTML = njCustHTML(); const f = $(MS.mode === 'new' ? '#nj-c-name' : '#nj-q'); if (f) { if (MS.mode === 'new' && MS.q) f.value = MS.q; f.focus(); } },
  'nj-pick': (el) => { MS.custId = el.dataset.id; const c = $('#nj-cust'); if (c) c.innerHTML = njCustHTML(); const f = $('#nj-name'); if (f) f.focus(); },
  'nj-change': () => { MS.custId = ''; MS.mode = 'existing'; const c = $('#nj-cust'); if (c) c.innerHTML = njCustHTML(); const f = $('#nj-q'); if (f) f.focus(); },
  'nj-create': () => njCreate(),

  /* schedule */
  'new-act': (el) => activityModal({ jobId: el.dataset.job || (S.view === 'job' ? S.params.id : ''), type: el.dataset.type || 'template', date: el.dataset.date }),
  'edit-act': (el, ev) => { ev.stopPropagation(); activityModal({ id: el.dataset.id }); },
  'act-type': (el) => { MS.type = el.dataset.v; $$('#act-types button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === MS.type))); },
  'act-crew': (el) => { const id = el.dataset.id; MS.crew = MS.crew.includes(id) ? MS.crew.filter((x) => x !== id) : MS.crew.concat(id); el.setAttribute('aria-pressed', String(MS.crew.includes(id))); },
  'act-pick': (el) => { MS.jobId = el.dataset.id; const b = $('#act-job'); if (b) b.innerHTML = actJobHTML(); },
  'act-job-change': () => { MS.jobId = ''; const b = $('#act-job'); if (b) b.innerHTML = actJobHTML(); const f = $('#act-jq'); if (f) f.focus(); },
  'act-save': () => actSave(),
  'act-delete': async () => {
    const a = S.activities.get(MS.id); if (!a) return;
    if (await confirmBox(`Delete this ${actType(a.type).name.toLowerCase()}?`, `${fmtD(a.date)} · ${(jobOf(a.jobId) || {}).name || ''}`, 'Delete', true)) {
      await remove('activities', a.id);
      if (jobOf(a.jobId)) await addNote(a.jobId, `${actType(a.type).name} on ${fmtD(a.date)} removed from the schedule`, 'event');
      toast('Removed from the schedule');
    }
  },
  'act-done': (el) => { const a = S.activities.get(el.dataset.id); if (!a) return; if (modalOpen()) closeModal(); completeAct(a, el.dataset.v === '1'); },

  /* customers / team */
  'edit-cust': (el) => customerModal(el.dataset.id),
  'cu-save': async () => {
    const name = val('#cu-name'); if (!name) { fieldErr('#cu-name', 'Enter a name'); return; }
    const id = MS.id || uid();
    const prev = MS.id ? customer(MS.id) : {};
    await put('customers', id, { ...prev, name, phone: val('#cu-phone'), email: val('#cu-email'), type: val('#cu-type'), address: val('#cu-addr'), notes: val('#cu-notes'), createdAt: prev.createdAt || Date.now() });
    closeModal(); toast('Customer saved');
  },
  'cu-delete': async () => { const c = customer(MS.id); if (!c) return; if (await confirmBox(`Delete ${c.name}?`, 'This customer has no jobs. They’ll be removed for everyone.', 'Delete', true)) { await remove('customers', c.id); go('customers'); } },
  'edit-member': (el) => memberModal(el.dataset.id),
  'tm-color': (el) => { MS.color = el.dataset.v; const b = $('#tm-colors'); if (b) b.innerHTML = tmColorsHTML(); },
  'tm-save': async () => {
    const name = val('#tm-name'); if (!name) { fieldErr('#tm-name', 'Enter a name'); return; }
    const id = MS.id || uid();
    const prev = MS.id ? member(MS.id) : {};
    const act = $('#tm-active');
    await put('team', id, { ...prev, name, role: val('#tm-role'), phone: val('#tm-phone'), email: val('#tm-email').toLowerCase(), color: MS.color, active: act ? act.checked : true });
    const isEdit = !!MS.id;
    const first = !S.me && !isEdit;
    closeModal(); toast(isEdit ? 'Saved' : `${name} added to the team`);
    if (first) setMe(id);
  },

  /* calendar */
  'cal-move': (el) => { const d = +el.dataset.d; if (S.ui.calMode === 'month') { const x = parseD(S.ui.calDate.slice(0, 8) + '01'); x.setMonth(x.getMonth() + d); S.ui.calDate = dstr(x); } else S.ui.calDate = addDays(S.ui.calDate, 7 * d); render(true); },
  'cal-today': () => { S.ui.calDate = today(); render(true); },
  'cal-type': (el) => { const v = el.dataset.v; const t = S.ui.calTypes; S.ui.calTypes = t.includes(v) ? t.filter((x) => x !== v) : t.concat(v); render(true); },
  'cal-day': (el) => { S.ui.calDate = el.dataset.date; S.ui.calMode = 'week'; render(true); },

  /* quote builder */
  'q-edge': (el) => { const a = qArea(el.dataset.area), p = qPiece(a, el.dataset.piece); if (!p) return; p.edges = p.edges || {}; p.edges[el.dataset.k] = !p.edges[el.dataset.k]; el.setAttribute('aria-pressed', String(p.edges[el.dataset.k])); quoteRecalc(a.id); },
  'q-del-piece': (el) => { const a = qArea(el.dataset.area); if (!a) return; a.pieces = a.pieces.filter((p) => p.id !== el.dataset.piece); quoteRerender(); },
  'q-add-piece': (el) => {
    const a = qArea(el.dataset.area); if (!a) return;
    const k = el.dataset.kind;
    const runL = sum(a.pieces.filter((p) => p.kind !== 'splash'), (p) => p.L) || 0;
    let p;
    if (k === 'splash') p = newPiece('Backsplash', runL, 4, 'splash');
    else if (k === 'full') p = newPiece('Full-height splash', 30, 18, 'splash');
    else p = newPiece(a.pieces.length ? 'Piece ' + (a.pieces.length + 1) : 'Main run', 0, (a.pieces.find((x) => x.kind !== 'splash') || {}).D || 25.5);
    a.pieces.push(p);
    quoteRerender();
    const f = document.getElementById((k === 'top' ? 'pL-' : 'pl-') + p.id); if (f) f.focus();
  },
  'q-addon': (el) => {
    const a = qArea(el.dataset.area); if (!a) return;
    const id = el.dataset.addon;
    let x = (a.addons || []).find((y) => y.id === id);
    if (!x) { const src = cfg().addons.find((y) => y.id === id); if (!src) return; x = { id, name: src.name, price: Number(src.price) || 0, count: 0 }; a.addons = (a.addons || []).concat(x); }
    x.count = Math.max(0, (x.count || 0) + +el.dataset.d);
    const b = $('#ac-' + CSS.escape(a.id) + '-' + CSS.escape(id)); if (b) { b.textContent = x.count; b.closest('.addon').classList.toggle('on', x.count > 0); }
    quoteRecalc('-');
  },
  'q-add-area': (el) => { const d = qd(); if (!d) return; const a = newArea(el.dataset.name || 'New area'); d.q.areas.push(a); quoteRerender(); const f = document.getElementById(el.dataset.name ? 'pL-' + a.pieces[0].id : 'an-' + a.id); if (f) { f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  'q-del-area': async (el) => { const d = qd(); if (!d) return; const a = qArea(el.dataset.area); if (!a) return; if (a.pieces.some((p) => p.L) && !(await confirmBox(`Remove ${a.name || 'this area'}?`, 'Its pieces and cutouts come off the quote.', 'Remove', true))) return; d.q.areas = d.q.areas.filter((x) => x.id !== a.id); quoteRerender(); },
  'q-dup-area': (el) => { const d = qd(); const a = qArea(el.dataset.area); if (!a) return; const c = deepClone(a); c.id = uid(); c.name = a.name + ' (copy)'; c.pieces.forEach((p) => { p.id = uid(); }); const i = d.q.areas.indexOf(a); d.q.areas.splice(i + 1, 0, c); quoteRerender(); },
  'q-add-line': () => { const d = qd(); if (!d) return; const l = { id: uid(), desc: '', amount: 0 }; d.q.lines.push(l); quoteRerender(); const f = document.getElementById('ld-' + l.id); if (f) f.focus(); },
  'q-del-line': (el) => { const d = qd(); if (!d) return; d.q.lines = d.q.lines.filter((l) => l.id !== el.dataset.line); quoteRerender(); },
  'q-disc-type': (el) => { const d = qd(); if (!d) return; d.q.discount.type = el.dataset.v; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.dataset.v))); quoteRecalc('-'); },
  'q-save': (el) => quoteSave(!!el.dataset.mark),
  'q-reprice': () => {
    const d = qd(); if (!d) return; const c = cfg();
    for (const a of d.q.areas) {
      const m = a.mat && c.materials.find((x) => x.id === a.mat.id); if (m) a.mat = matSnap(m);
      const e = a.edge && c.edges.find((x) => x.id === a.edge.id); if (e) a.edge = edgeSnap(e);
      for (const x of a.addons || []) { const s = c.addons.find((y) => y.id === x.id); if (s) x.price = Number(s.price) || 0; }
      if (a.tearOut) a.tearPrice = Number(c.tearOutPerSqft) || 0;
    }
    quoteRerender(); toast('Repriced from your current price list');
  },

  /* pictures & guide */
  'my-profile': () => profileModal(),
  'gs-hide': () => { store.set(gsKey(), true); render(true); toast('Guide hidden. The helper (?) can bring you back to any step.'); },
  'logo-remove': async () => { await setLogo(''); render(true); toast('Logo removed'); },
  'photo-remove': async () => { await setMyPhoto(null); profileModal(); toast('Photo removed'); },
  'member-photo-remove': async (el) => { await patch('team', el.dataset.id, { photo: null }); closeModal(); toast('Photo removed'); },

  /* settings */
  's-add': (el) => { const s = ensureSDraft(); const l = el.dataset.l; const item = l === 'materials' ? { id: uid(), name: '', group: '', price: 0, color: '#CCCCCC' } : { id: uid(), name: '', price: 0 }; s[l].push(item); s._dirty = true; render(true); const ids = { materials: 'sm-n-', edges: 'sedges-n-', addons: 'saddons-n-' }; const f = document.getElementById(ids[l] + (s[l].length - 1)); if (f) f.focus(); },
  's-del': (el) => { const s = ensureSDraft(); s[el.dataset.l].splice(+el.dataset.i, 1); s._dirty = true; render(true); },
  's-save': async () => {
    const s = ensureSDraft();
    for (const k of ['materials', 'edges', 'addons']) s[k] = s[k].filter((x) => String(x.name || '').trim()).map((x) => ({ ...x, name: x.name.trim(), price: Number(x.price) || 0 }));
    if (!s.materials.length) { toast('Keep at least one material in the price list', { bad: true }); return; }
    const body = { ...s }; delete body._dirty;
    await saveSettings(body);
    S.sdraft = { ...deepClone(cfg()), _dirty: false };
    render(true); toast('Prices & settings saved');
  },
};

/* ---------- delegated events ---------- */
let downOnScrim = false;
document.addEventListener('mousedown', (e) => { downOnScrim = !!(e.target && e.target.hasAttribute && e.target.hasAttribute('data-scrim')); });
document.addEventListener('click', (e) => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-scrim')) { if (downOnScrim) closeModal(); return; }
  const el = e.target.closest && e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el || !el.dataset) return;
  if (el.dataset.input) {
    S.ui[el.dataset.input] = el.value;
    if (el.dataset.input === 'jobQ' || el.dataset.input === 'custQ') schedule();
    return;
  }
  if (el.dataset.inputModal && MS) {
    const k = el.dataset.inputModal;
    if (k === 'njq') { MS.q = el.value; const m = $('#nj-menu'); if (m) m.innerHTML = njMenuHTML(); }
    else if (k === 'actjq') { MS.jq = el.value; const q = el.value; const box = $('#act-job'); if (box) { box.innerHTML = actJobHTML(); const f = $('#act-jq'); if (f) { f.focus(); f.setSelectionRange(q.length, q.length); } } }
    else if (k === 'palq') { MS.q = el.value; MS.sel = 0; const r = $('#pal-res'); if (r) r.innerHTML = paletteResults(); }
    return;
  }
  if (el.dataset.q) { quoteInput(el, false); return; }
  if (el.dataset.s || el.dataset.sl) {
    const s = ensureSDraft();
    const v = el.dataset.t === 'num' ? num(el.value) : el.value;
    if (el.dataset.s) s[el.dataset.s] = v;
    else { const it = s[el.dataset.sl][+el.dataset.i]; if (it) it[el.dataset.f] = v; }
    s._dirty = true;
    const d = $('#s-dirty'); if (d) d.innerHTML = '<span class="dirty-dot"></span> Unsaved';
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (!el || !el.dataset) return;
  if (el.dataset.upload && el.files && el.files[0]) {
    const kind = el.dataset.upload, file = el.files[0];
    el.value = '';
    try {
      if (kind === 'logo') {
        if (!isAdmin()) { toast('Only the owner or office can change the logo', { bad: true }); return; }
        const url = await readImage(file, { max: 320, keepPng: true });
        await setLogo(url); render(true); toast('Logo saved');
      } else if (kind === 'myphoto') {
        const url = await readImage(file, { max: 192, square: true });
        await setMyPhoto(url); profileModal(); toast('Photo saved');
      } else if (kind === 'memberphoto') {
        const url = await readImage(file, { max: 192, square: true });
        await patch('team', el.dataset.id, { photo: url });
        const box = $('#tm-photo'); if (box) { const m = member(el.dataset.id); const a = box.querySelector('.avatar'); if (a && m) a.outerHTML = avatar(m, 'lg'); }
        toast('Photo saved');
      }
    } catch (err) { toast(err.message || 'Couldn’t use that picture', { bad: true }); }
    return;
  }
  if (el.dataset.q) { if (el.type === 'checkbox' || el.tagName === 'SELECT' || el.dataset.q === 'p-L' || el.dataset.q === 'p-D') quoteInput(el, true); return; }
  const k = el.dataset.change;
  if (!k) return;
  if (k === 'me') { setMe(el.value); if (modalOpen()) closeModal(); return; }
  if (k === 'jobSales' || k === 'calCrew') { S.ui[k] = el.value; render(true); return; }
  if (k === 'noteIssue') { S.ui.noteIssue = el.checked; return; }
  if (k === 'mwAll') { S.ui.mwAll = el.checked; render(true); return; }
  if (k === 'check') {
    const j = jobOf(el.dataset.job); if (!j) return;
    const name = (CHECKS.find((c) => c.id === el.dataset.k) || {}).name || el.dataset.k;
    await patch('jobs', j.id, { checklist: { [el.dataset.k]: el.checked }, updatedAt: Date.now() });
    await addNote(j.id, `${el.checked ? 'Checked' : 'Unchecked'}: ${name}`, 'event');
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (modalOpen() && MS && MS.kind === 'palette') closeModal(); else paletteOpen(); return; }
  if (e.key === 'Escape' && modalOpen()) { closeModal(); return; }
  if (MS && MS.kind === 'palette' && modalOpen()) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const n = (MS.items || []).length; if (!n) return;
      MS.sel = (MS.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      $$('#pal-res .row').forEach((r, i) => r.classList.toggle('sel', i === MS.sel));
      const s = $$('#pal-res .row')[MS.sel]; if (s) s.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { const it = (MS.items || [])[MS.sel]; if (it) { e.preventDefault(); go(it.view, { id: it.id }); } }
    return;
  }
  if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('.jcard')) { e.preventDefault(); go('job', { id: e.target.dataset.id }); return; }
  if (e.key === 'Enter' && e.target && e.target.id === 'note-text' && (e.ctrlKey || e.metaKey)) { const b = $('[data-act="add-note"]'); if (b) b.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.view === 'quote') { e.preventDefault(); quoteSave(false); }
});

/* ---------- drag & drop (desktop) ---------- */
let DRAG = null;
const clearDrop = () => $$('.drop').forEach((x) => x.classList.remove('drop'));
document.addEventListener('dragstart', (e) => {
  const t = e.target;
  if (!t || !t.closest || !S.canWrite) return;
  const j = t.closest('[data-drag-job]'), a = t.closest('[data-drag-act]');
  if (j) { DRAG = { kind: 'job', id: j.dataset.dragJob }; j.classList.add('dragging'); }
  else if (a) { DRAG = { kind: 'act', id: a.dataset.dragAct }; a.classList.add('dragging'); }
  else return;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', DRAG.id); } catch (err) { /* noop */ }
});
document.addEventListener('dragend', () => { DRAG = null; clearDrop(); $$('.dragging').forEach((x) => x.classList.remove('dragging')); });
document.addEventListener('dragover', (e) => {
  if (!DRAG) return;
  const z = e.target.closest && e.target.closest(DRAG.kind === 'job' ? '[data-drop-stage]' : '[data-drop-date]');
  if (!z) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (!z.classList.contains('drop')) { clearDrop(); z.classList.add('drop'); }
});
document.addEventListener('drop', async (e) => {
  if (!DRAG) return;
  const z = e.target.closest && e.target.closest(DRAG.kind === 'job' ? '[data-drop-stage]' : '[data-drop-date]');
  const d = DRAG; DRAG = null; clearDrop();
  if (!z) return;
  e.preventDefault();
  if (d.kind === 'job') {
    const j = jobOf(d.id); const st = z.dataset.dropStage;
    if (j && j.stage !== st) await setStage(j, st);
  } else {
    const a = S.activities.get(d.id); const date = z.dataset.dropDate;
    if (a && a.date !== date) {
      await patch('activities', a.id, { date });
      if (jobOf(a.jobId)) await addNote(a.jobId, `${actType(a.type).name} moved from ${fmtD(a.date)} to ${fmtD(date)}`, 'event');
      toast(`${actType(a.type).name} moved to ${fmtD(date)}`, { action: { label: 'Undo', run: () => patch('activities', a.id, { date: a.date }) } });
    }
  }
});

/* ---------- boot ---------- */
Object.assign(ACTIONS, AUTH_ACTIONS, HELP_ACTIONS);
window.addEventListener('beforeunload', (e) => { if (S.qdraft && S.qdraft.dirty) { e.preventDefault(); e.returnValue = ''; } });
kerfBoot();
