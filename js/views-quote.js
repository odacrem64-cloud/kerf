/* =========================================================
   Quote builder
   ========================================================= */
const EDGE_NAMES = { f: 'Front edge', b: 'Back edge', l: 'Left end', r: 'Right end' };

function initQuoteDraft(id) {
  const j = jobOf(id);
  if (!j) { S.qdraft = null; return; }
  if (S.qdraft && S.qdraft.jobId === id) return;
  S.qdraft = { jobId: id, q: j.quote ? deepClone(j.quote) : newQuote(), dirty: false, isNew: !j.quote };
}
const qd = () => S.qdraft;
const qArea = (id) => (qd() ? qd().q.areas.find((a) => a.id === id) : null);
const qPiece = (a, id) => (a ? a.pieces.find((p) => p.id === id) : null);

function materialOptions(a) {
  const c = cfg();
  const groups = new Map();
  for (const m of c.materials) { if (!groups.has(m.group || 'Other')) groups.set(m.group || 'Other', []); groups.get(m.group || 'Other').push(m); }
  const inList = a.mat && c.materials.some((m) => m.id === a.mat.id);
  let out = '';
  if (a.mat && !inList) out += `<option value="__keep" selected>${esc(a.mat.name)} · $${a.mat.price}/ft² (quoted price)</option>`;
  for (const [g, list] of groups) out += `<optgroup label="${esc(g)}">${list.map((m) => `<option value="${esc(m.id)}" ${a.mat && a.mat.id === m.id ? 'selected' : ''}>${esc(m.name)} · $${m.price}/ft²</option>`).join('')}</optgroup>`;
  return out;
}
function edgeOptions(a) {
  const c = cfg();
  const inList = a.edge && c.edges.some((e) => e.id === a.edge.id);
  let out = a.edge && !inList ? `<option value="__keep" selected>${esc(a.edge.name)} (quoted price)</option>` : '';
  out += c.edges.map((e) => `<option value="${esc(e.id)}" ${a.edge && a.edge.id === e.id ? 'selected' : ''}>${esc(e.name)}${e.price ? ` · $${e.price}/LF` : ' · included'}</option>`).join('');
  return out;
}
function pieceRowHTML(a, p) {
  const A = `data-area="${esc(a.id)}" data-piece="${esc(p.id)}"`;
  const splash = p.kind === 'splash';
  return `<div class="piece" data-piece-row="${esc(p.id)}">
    <input class="input lbl" id="pl-${esc(p.id)}" value="${esc(p.label)}" placeholder="${splash ? 'Backsplash' : 'Piece name'}" data-q="p-label" ${A} aria-label="Piece name">
    <input class="input mono right" id="pL-${esc(p.id)}" inputmode="decimal" autocomplete="off" value="${esc(fmtIn(p.L, false))}" placeholder="Length" data-q="p-L" ${A} aria-label="Length in inches">
    <span class="x">×</span>
    <input class="input mono right" id="pD-${esc(p.id)}" inputmode="decimal" autocomplete="off" value="${esc(fmtIn(p.D, false))}" placeholder="Depth" data-q="p-D" ${A} aria-label="Depth in inches">
    ${splash ? '<span class="tag edges-slot" style="justify-self:start">Splash</span>' : `<span class="edges edges-slot" role="group" aria-label="Finished edges">${['f', 'b', 'l', 'r'].map((k) => `<button type="button" data-act="q-edge" ${A} data-k="${k}" aria-pressed="${!!(p.edges || {})[k]}" title="${EDGE_NAMES[k]}">${k.toUpperCase()}</button>`).join('')}</span>`}
    <span class="sq" id="ps-${esc(p.id)}">${sqft1(pieceSqft(p))}</span>
    <button class="btn icon ghost del" data-act="q-del-piece" ${A} aria-label="Remove piece">${icon('close')}</button>
  </div>`;
}
function addonChipsHTML(a) {
  const c = cfg();
  const list = c.addons.map((x) => ({ ...x }));
  for (const x of a.addons || []) if (!list.some((y) => y.id === x.id)) list.push({ ...x });
  return list.map((x) => {
    const cur = (a.addons || []).find((y) => y.id === x.id);
    const n = cur ? cur.count : 0;
    const price = cur ? cur.price : x.price;
    return `<span class="addon ${n ? 'on' : ''}" title="${price ? '$' + price + ' each' : 'Included'}"><button type="button" data-act="q-addon" data-area="${esc(a.id)}" data-addon="${esc(x.id)}" data-d="-1" aria-label="Remove one ${esc(x.name)}">−</button><span>${esc(x.name)}</span><b id="ac-${esc(a.id)}-${esc(x.id)}">${n}</b><button type="button" data-act="q-addon" data-area="${esc(a.id)}" data-addon="${esc(x.id)}" data-d="1" aria-label="Add one ${esc(x.name)}">+</button></span>`;
  }).join('');
}
function areaHTML(a, ac) {
  const A = `data-area="${esc(a.id)}"`;
  return `<section class="area" data-area-card="${esc(a.id)}">
    <div class="area-h">
      <span class="swatch" style="background:${esc(a.mat ? a.mat.color : '#ccc')};width:18px;height:18px" id="asw-${esc(a.id)}"></span>
      <input class="input name" id="an-${esc(a.id)}" value="${esc(a.name)}" data-q="area-name" ${A} aria-label="Area name">
      <span class="num" style="font-weight:700" id="at-${esc(a.id)}">${money(ac.total)}</span>
      <button class="btn icon ghost" data-act="q-dup-area" ${A} title="Duplicate area" aria-label="Duplicate area">${icon('dup')}</button>
      <button class="btn icon ghost" data-act="q-del-area" ${A} title="Remove area" aria-label="Remove area">${icon('trash')}</button>
    </div>
    <div class="area-b">
      <div class="area-opts">
        <label class="field"><span>Material</span><select class="input" id="am-${esc(a.id)}" data-q="area-mat" ${A}>${materialOptions(a)}</select></label>
        <label class="field"><span>Edge profile</span><select class="input" id="ae-${esc(a.id)}" data-q="area-edge" ${A}>${edgeOptions(a)}</select></label>
        <label class="check" style="padding-bottom:8px;white-space:nowrap" title="$${a.tearPrice || cfg().tearOutPerSqft}/sq ft"><input type="checkbox" id="atr-${esc(a.id)}" data-q="area-tear" ${A} ${a.tearOut ? 'checked' : ''}> Tear-out</label>
      </div>
      <div>
        <div class="piece-head"><span>Piece</span><span style="text-align:right">Length</span><span></span><span style="text-align:right">Depth</span><span>Finished edges</span><span style="text-align:right">Sq ft</span><span></span></div>
        <div class="pieces">${a.pieces.map((p) => pieceRowHTML(a, p)).join('')}</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn sm" data-act="q-add-piece" ${A} data-kind="top">${icon('plus')}Piece</button>
          <button class="btn sm" data-act="q-add-piece" ${A} data-kind="splash">${icon('plus')}4" splash</button>
          <button class="btn sm" data-act="q-add-piece" ${A} data-kind="full">${icon('plus')}Full-height splash</button>
          <span class="faint" style="font-size:12px;margin-left:auto">Inches · fractions OK (112 1/4)</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">Cutouts, sinks & extras</div><div class="addons">${addonChipsHTML(a)}</div></div>
      <div class="drawing" id="ad-${esc(a.id)}">${areaSVG(a)}</div>
      <div class="faint" style="font-size:12px;margin-top:-6px" id="ameta-${esc(a.id)}">${areaMeta(a, ac)}</div>
    </div>
  </section>`;
}
function areaMeta(a, ac) {
  return `${sqft1(ac.sqft)} sq ft × $${a.mat ? a.mat.price : 0} = ${money(ac.matCost)} · ${ac.edgeLf.toFixed(1)} LF finished edge${ac.edgeCost ? ' = ' + money(ac.edgeCost) : ''}${ac.addonCost ? ' · extras ' + money(ac.addonCost) : ''}${ac.tearCost ? ' · tear-out ' + money(ac.tearCost) : ''}`;
}
function quoteTermsHTML(q) {
  const lines = (q.lines || []).map((l) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 120px 34px;gap:8px;align-items:center">
    <input class="input" id="ld-${esc(l.id)}" value="${esc(l.desc)}" placeholder="Description (delivery, plumbing, credit…)" data-q="line-desc" data-line="${esc(l.id)}" aria-label="Line description">
    <input class="input mono right" id="la-${esc(l.id)}" inputmode="decimal" value="${l.amount ? esc(l.amount) : ''}" placeholder="0.00" data-q="line-amt" data-line="${esc(l.id)}" aria-label="Amount (negative for a credit)">
    <button class="btn icon ghost" data-act="q-del-line" data-line="${esc(l.id)}" aria-label="Remove line">${icon('close')}</button></div>`).join('');
  return `<div class="card"><div class="card-h"><h2>Extras, discount & terms</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;flex-direction:column;gap:6px">${lines}<div><button class="btn sm" data-act="q-add-line">${icon('plus')}Add line item</button> <span class="faint" style="font-size:12px">Use a negative amount for a credit.</span></div></div>
    <div class="grid3">
      <label class="field"><span>Discount</span><div style="display:flex;gap:6px"><div class="seg">${[['pct', '%'], ['amt', '$']].map(([k, l]) => `<button type="button" data-act="q-disc-type" data-v="${k}" aria-pressed="${q.discount.type === k}">${l}</button>`).join('')}</div><input class="input mono right" id="q-disc" inputmode="decimal" value="${q.discount.value || ''}" placeholder="0" data-q="disc"></div></label>
      <label class="field"><span>Sales tax %</span><input class="input mono right" id="q-tax" inputmode="decimal" value="${q.taxRate || ''}" placeholder="0" data-q="tax"></label>
      <label class="field"><span>Deposit %</span><input class="input mono right" id="q-dep" inputmode="decimal" value="${q.depositPct || ''}" placeholder="0" data-q="dep"></label>
      <label class="field"><span>Minimum job charge</span><input class="input mono right" id="q-min" inputmode="decimal" value="${q.minCharge || ''}" placeholder="0" data-q="min"></label>
      <label class="field"><span>Quote good for (days)</span><input class="input mono right" id="q-valid" inputmode="numeric" value="${q.validDays || ''}" data-q="valid"></label>
    </div>
    <label class="field"><span>Notes on the customer copy</span><textarea class="input" id="q-notes" data-q="notes" placeholder="Includes one undermount sink cutout and faucet hole. Plumbing disconnect and reconnect by others.">${esc(q.notes || '')}</textarea></label>
  </div></div>`;
}
function quoteEditorHTML() {
  const d = qd();
  const q = d.q;
  const calc = calcQuote(q);
  return q.areas.map((a, i) => areaHTML(a, calc.areas[i])).join('')
    + `<div class="card"><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="eyebrow" style="margin-right:4px">Add area</span>${AREA_PRESETS.map((n) => `<button class="btn sm" data-act="q-add-area" data-name="${esc(n)}">${esc(n)}</button>`).join('')}<button class="btn sm ghost" data-act="q-add-area" data-name="">Custom…</button></div></div>`
    + quoteTermsHTML(q);
}
function totalsHTML(q, calc) {
  const L = (k, v, cls = '') => `<div class="line ${cls}"><span class="muted">${k}</span><span>${v}</span></div>`;
  let h = calc.areas.map((a) => L(esc(a.name) + ` · ${sqft1(a.sqft)} ft²`, money2(a.total))).join('');
  if (calc.extras) h += L('Line items', money2(calc.extras));
  if (calc.minAdj) h += L('Minimum charge adjustment', money2(calc.minAdj));
  if (calc.discount) h += L('Discount', '−' + money2(calc.discount));
  if (calc.tax) h += L(`Tax ${q.taxRate}%`, money2(calc.tax));
  h += `<div class="grand"><span class="eyebrow">Total</span><b class="num">${money2(calc.total)}</b></div>`;
  if (calc.deposit) h += L(`Deposit due (${q.depositPct}%)`, money2(calc.deposit));
  return h;
}
function slabsHTML(calc) {
  const n = calc.nest;
  if (!n.materials.length) return '<div class="faint" style="font-size:12.5px">Slabs appear here as you enter measurements.</div>';
  return n.materials.map((m) => `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><span class="swatch" style="background:${esc(m.mat ? m.mat.color : '#ccc')}"></span><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.mat ? m.mat.name : 'Material')}</b><span class="mono">${m.slabs.length} slab${m.slabs.length === 1 ? '' : 's'}</span><span class="tag ${m.yieldPct < 45 ? 'warn' : ''}">${m.yieldPct}% yield</span></div>${slabsSVG(m, n)}</div>`).join('<div style="height:10px"></div>')
    + `<div class="faint" style="font-size:11.5px;margin-top:8px">Estimate only — final layout is done from the template. ${n.seams ? `${n.seams} seam${n.seams === 1 ? '' : 's'} needed for runs longer than the slab.` : 'No seams needed.'}</div>`;
}
function quoteSideHTML() {
  const d = qd();
  const calc = calcQuote(d.q);
  const j = jobOf(d.jobId);
  const stale = d.q.areas.some((a) => { const m = cfg().materials.find((x) => a.mat && x.id === a.mat.id); return m && Number(m.price) !== a.mat.price; });
  return `<div class="card"><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
      <div class="qstats"><div><b id="qs-sqft">${sqft1(calc.sqft)}</b><span>SQ FT</span></div><div><b id="qs-slabs">${calc.nest.slabs}</b><span>SLABS EST.</span></div><div><b id="qs-lf">${calc.edgeLf.toFixed(1)}</b><span>EDGE LF</span></div></div>
      <div class="totals" id="q-totals">${totalsHTML(d.q, calc)}</div>
      ${stale ? `<div class="banner" style="font-size:12.5px">Your price list changed since this quote was priced.<button class="btn sm" data-act="q-reprice">Use current prices</button></div>` : ''}
      <div class="btn-row">${S.canWrite ? `<button class="btn primary" style="flex:1" data-act="q-save">${icon('check')}Save quote</button>` : ''}<button class="btn" data-act="q-doc">${icon('doc')}Customer copy</button></div>
      ${S.canWrite && j && stageIdx(j.stage) < stageIdx('quoted') && j.stage !== 'lost' ? `<button class="btn" data-act="q-save" data-mark="1">Save & mark as quoted</button>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h2>Slab layout</h2><span class="faint mono" style="font-size:11.5px">${fmtIn(cfg().slabL)} × ${fmtIn(cfg().slabW)}</span></div><div class="card-b slabs" id="q-slabs">${slabsHTML(calc)}</div></div>`;
}
VIEWS.quote = ({ id }) => {
  const j = jobOf(id);
  if (!j || !qd()) return { title: 'Job not found', back: { view: 'jobs' }, body: `<div class="card"><div class="empty"><b>This job isn’t available.</b><button class="btn" data-act="go" data-view="jobs">Back to jobs</button></div></div>` };
  const c = customer(j.customerId) || {};
  return {
    back: { view: 'job', id: j.id }, noNew: true,
    crumb: `<span class="mono">${esc(j.number)}</span> · ${esc(c.name || '')}`,
    title: `Quote · ${esc(j.name)}`,
    actions: `<span id="q-dirty" class="faint" style="font-size:12.5px;white-space:nowrap">${qd().dirty ? '<span class="dirty-dot"></span> Unsaved' : ''}</span>`,
    body: `<div class="qwrap"><div class="stack" id="q-editor">${quoteEditorHTML()}</div><aside class="qside" id="q-side">${quoteSideHTML()}</aside></div>`,
  };
};

/* partial updates while typing (keeps focus, no full re-render) */
function quoteRefreshHeader() {
  const el = $('#q-dirty');
  if (el && qd()) el.innerHTML = qd().dirty ? '<span class="dirty-dot"></span> Unsaved' : '<span class="faint">Saved</span>';
}
function quoteRecalc(areaId) {
  const d = qd();
  if (!d) return;
  d.dirty = true;
  const calc = calcQuote(d.q);
  d.q.areas.forEach((a, i) => {
    const ac = calc.areas[i];
    const t = $('#at-' + CSS.escape(a.id)); if (t) t.textContent = money(ac.total);
    const m = $('#ameta-' + CSS.escape(a.id)); if (m) m.innerHTML = areaMeta(a, ac);
    for (const p of a.pieces) { const s = $('#ps-' + CSS.escape(p.id)); if (s) s.textContent = sqft1(pieceSqft(p)); }
    if (!areaId || areaId === a.id) { const dr = $('#ad-' + CSS.escape(a.id)); if (dr) dr.innerHTML = areaSVG(a); const sw = $('#asw-' + CSS.escape(a.id)); if (sw) sw.style.background = a.mat ? a.mat.color : '#ccc'; }
  });
  const set = (sel, v) => { const e = $(sel); if (e) e.innerHTML = v; };
  set('#qs-sqft', sqft1(calc.sqft)); set('#qs-slabs', String(calc.nest.slabs)); set('#qs-lf', calc.edgeLf.toFixed(1));
  set('#q-totals', totalsHTML(d.q, calc));
  set('#q-slabs', slabsHTML(calc));
  quoteRefreshHeader();
}
function quoteRerender() {
  const d = qd();
  if (!d) return;
  d.dirty = true;
  const ed = $('#q-editor'), side = $('#q-side');
  const ae = document.activeElement; const fid = ae && ae.id;
  if (ed) ed.innerHTML = quoteEditorHTML();
  if (side) side.innerHTML = quoteSideHTML();
  quoteRefreshHeader();
  if (fid) { const el = document.getElementById(fid); if (el) el.focus({ preventScroll: true }); }
}
function quoteInput(el, final) {
  const d = qd();
  if (!d) return;
  const q = d.q;
  const a = qArea(el.dataset.area);
  const p = qPiece(a, el.dataset.piece);
  const k = el.dataset.q;
  const num = (v) => { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n; };
  switch (k) {
    case 'area-name': if (a) { a.name = el.value; d.dirty = true; quoteRecalc('-'); } return;
    case 'area-mat': if (a && el.value !== '__keep') { a.mat = matSnap(cfg().materials.find((m) => m.id === el.value)); quoteRecalc(a.id); } return;
    case 'area-edge': if (a && el.value !== '__keep') { a.edge = edgeSnap(cfg().edges.find((e) => e.id === el.value)); quoteRecalc(a.id); } return;
    case 'area-tear': if (a) { a.tearOut = el.checked; if (el.checked) a.tearPrice = Number(cfg().tearOutPerSqft) || 0; quoteRecalc(a.id); } return;
    case 'p-label': if (p) { p.label = el.value; quoteRecalc(a.id); } return;
    case 'p-L': case 'p-D': if (p) {
      const v = parseIn(el.value);
      p[k === 'p-L' ? 'L' : 'D'] = v;
      if (final) el.value = fmtIn(v, false);
      quoteRecalc(a.id);
    } return;
    case 'line-desc': { const l = q.lines.find((x) => x.id === el.dataset.line); if (l) { l.desc = el.value; quoteRecalc('-'); } return; }
    case 'line-amt': { const l = q.lines.find((x) => x.id === el.dataset.line); if (l) { l.amount = round2(num(el.value)); quoteRecalc('-'); } return; }
    case 'disc': q.discount.value = num(el.value); quoteRecalc('-'); return;
    case 'tax': q.taxRate = num(el.value); quoteRecalc('-'); return;
    case 'dep': q.depositPct = clamp(num(el.value), 0, 100); quoteRecalc('-'); return;
    case 'min': q.minCharge = num(el.value); quoteRecalc('-'); return;
    case 'valid': q.validDays = Math.round(num(el.value)) || 30; d.dirty = true; quoteRefreshHeader(); return;
    case 'notes': q.notes = el.value; d.dirty = true; quoteRefreshHeader(); return;
    default:
  }
}
async function quoteSave(mark) {
  const d = qd();
  if (!d || !guardWrite()) return;
  const j = jobOf(d.jobId);
  if (!j) return;
  const q = deepClone(d.q);
  q.updatedAt = Date.now();
  const calc = calcQuote(q);
  const had = !!j.quote;
  try {
    await patch('jobs', j.id, { quote: q, ...jobRollup(q, calc), updatedAt: Date.now() });
    d.dirty = false;
    await addNote(j.id, `Quote ${had ? 'updated' : 'created'} · ${money(calc.total)} · ${sqft1(calc.sqft)} sq ft · ${calc.nest.slabs} slab${calc.nest.slabs === 1 ? '' : 's'}`, 'event');
    if (mark && stageIdx(j.stage) < stageIdx('quoted') && j.stage !== 'lost') await setStage(j, 'quoted', { quiet: true });
    toast(mark ? 'Quote saved and marked as quoted' : 'Quote saved');
    quoteRefreshHeader();
    const side = $('#q-side'); if (side) side.innerHTML = quoteSideHTML();
  } catch (e) { /* toast shown in writeErr */ }
}

/* customer copy */
async function openQuoteDoc(jobId, fromDraft) {
  const j = jobOf(jobId);
  if (!j) return;
  const q = fromDraft && qd() ? qd().q : j.quote;
  if (!q) { toast('Build the quote first'); return; }
  const cust = customer(j.customerId);
  const calc = calcQuote(q);
  const c = cfg();
  openModal({
    title: `Customer copy · ${j.number}`, wide: true,
    body: `${!c.shopName ? `<div class="banner" style="font-size:12.5px"><span>Add your shop name, phone and address in Settings so they print on the quote.</span><button class="btn sm" data-act="go" data-view="settings">Open settings</button></div>` : ''}${fromDraft && qd() && qd().dirty ? '<div class="banner" style="font-size:12.5px">Showing your unsaved changes. Save the quote to keep them.</div>' : ''}<div class="quote-doc">${quoteDocHTML(j, cust, q, calc, c, false)}</div>`,
    foot: `<button class="btn left" data-act="copy" data-text="${esc(quoteText(j, cust, q, calc, c))}">${icon('copy')}Copy as text</button>
      <button class="btn" data-act="print-quote" data-id="${esc(j.id)}" data-draft="${fromDraft ? 1 : ''}">${icon('doc')}Print / Save PDF</button>
      <button class="btn" data-act="download-quote" data-id="${esc(j.id)}" data-draft="${fromDraft ? 1 : ''}">${icon('download')}Download</button>
      ${S.canWrite && stageIdx(j.stage) < stageIdx('quoted') && j.stage !== 'lost' && !(fromDraft && qd() && qd().dirty) ? `<button class="btn primary" data-act="mark-sent" data-id="${esc(j.id)}">Mark as sent</button>` : '<button class="btn primary" data-act="close-modal">Done</button>'}`,
  });
}
function quoteFileParts(jobId, fromDraft) {
  const j = jobOf(jobId);
  if (!j) return null;
  const q = fromDraft && qd() ? qd().q : j.quote;
  if (!q) return null;
  const cust = customer(j.customerId);
  const html = quoteDocHTML(j, cust, q, calcQuote(q), cfg(), true);
  const name = `Quote ${j.number} - ${(cust && cust.name) || j.name}`.replace(/[\\/:*?"<>|&]+/g, '');
  return { html, name };
}
function downloadQuote(jobId, fromDraft) {
  const f = quoteFileParts(jobId, fromDraft);
  if (!f) return;
  saveFile(f.name + '.html', f.html, 'text/html');
  toast('Quote downloaded');
}
function printQuote(jobId, fromDraft) {
  const f = quoteFileParts(jobId, fromDraft);
  if (f) printHTML(f.html);
}
