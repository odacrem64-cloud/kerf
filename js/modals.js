/* =========================================================
   Modals: new quote, job, activity, payment, customer, team, search
   ========================================================= */
let MS = null; // modal state
let modalResolve = null;
function openModal({ title, body, foot = '', wide = false, cls = '', focus = true }) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="scrim" data-scrim><div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    ${title ? `<div class="modal-h"><h2>${esc(title)}</h2><button class="btn icon ghost" data-act="close-modal" aria-label="Close">${icon('close')}</button></div>` : ''}
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div></div>`;
  if (focus) {
    const f = $('.modal [autofocus]', ov) || $('.modal input:not([type=checkbox]):not([type=color]), .modal textarea, .modal select', ov);
    if (f) setTimeout(() => f.focus(), 30);
  }
}
function closeModal() {
  const ov = $('#overlay');
  if (ov && ov.innerHTML) ov.innerHTML = '';
  MS = null;
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(false); }
}
const modalOpen = () => !!($('#overlay') && $('#overlay').innerHTML);
function confirmBox(title, text, ok = 'OK', danger = false) {
  return new Promise((resolve) => {
    openModal({ title, body: `<p class="muted" style="margin:0">${esc(text)}</p>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-act="confirm-ok">${esc(ok)}</button>` });
    modalResolve = resolve;
  });
}
const val = (sel) => { const e = $(sel); return e ? e.value.trim() : ''; };
const fieldErr = (sel, msg) => { const e = $(sel); if (e) { e.focus(); e.style.borderColor = 'var(--bad)'; } toast(msg, { bad: true }); };
const teamOptions = (sel, blank = 'Unassigned') => `<option value="">${blank}</option>` + activeTeam().map((m) => `<option value="${esc(m.id)}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)}${m.role ? ' · ' + esc(m.role) : ''}</option>`).join('');
const opts = (list, sel) => list.map((x) => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

/* ---------- New quote (customer + job) ---------- */
function newJobModal(custId = '') {
  if (!guardWrite()) return;
  MS = { kind: 'newjob', custId, mode: custId ? 'existing' : (S.customers.size ? 'existing' : 'new'), q: '' };
  const me = member(S.me);
  openModal({
    title: 'New quote',
    body: `<div id="nj-cust">${njCustHTML()}</div>
      <div class="grid2">
        <label class="field span2"><span>Job name</span><input class="input" id="nj-name" placeholder="Kitchen remodel" autocomplete="off"></label>
        <label class="field span2"><span>Job site address</span><input class="input" id="nj-addr" placeholder="Leave blank to use the customer’s address" autocomplete="off"></label>
        <label class="field"><span>Salesperson</span><select class="input" id="nj-sales">${teamOptions(me ? me.id : '')}</select></label>
        <label class="field"><span>Lead source</span><select class="input" id="nj-src">${opts(SOURCES, 'Referral')}</select></label>
        <label class="field"><span>On-site contact <span class="faint">(optional)</span></span><input class="input" id="nj-sc" placeholder="Name — super, homeowner"></label>
        <label class="field"><span>Their phone</span><input class="input" id="nj-sp" inputmode="tel"></label>
        <label class="field span2"><span>PO / lot number <span class="faint">(optional)</span></span><input class="input" id="nj-po" placeholder="Lot 17 · PO 44812"></label>
      </div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="nj-create">Create & build quote</button>`,
  });
}
function njCustHTML() {
  const c = MS.custId ? customer(MS.custId) : null;
  if (c) return `<div class="field"><span>Account</span><div style="display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line-2);border-radius:var(--r-sm)"><b style="flex:1">${esc(c.name)}</b><span class="mono faint">${esc(c.phone || '')}</span><button class="btn sm ghost" data-act="nj-change">Change</button></div></div>`;
  const seg = S.customers.size ? `<div class="seg">${[['existing', 'Existing account'], ['new', 'New account']].map(([k, l]) => `<button type="button" data-act="nj-mode" data-v="${k}" aria-pressed="${MS.mode === k}">${l}</button>`).join('')}</div>` : '';
  if (MS.mode === 'existing') {
    return `<div class="field">${seg}<div class="picker" style="margin-top:8px"><input class="input" id="nj-q" placeholder="Search by name or phone" autocomplete="off" data-input-modal="njq" value="${esc(MS.q)}"><div class="menu" id="nj-menu">${njMenuHTML()}</div></div></div>`;
  }
  return `<div class="field">${seg}</div><div class="grid2">
    <label class="field span2"><span>Account name</span><input class="input" id="nj-c-name" placeholder="Homeowner name, builder or dealer" autocomplete="off"></label>
    <label class="field"><span>Phone</span><input class="input" id="nj-c-phone" inputmode="tel" autocomplete="off"></label>
    <label class="field"><span>Email</span><input class="input" id="nj-c-email" inputmode="email" autocomplete="off"></label>
    <label class="field"><span>Type</span><select class="input" id="nj-c-type">${opts(CUST_TYPES, 'Homeowner')}</select></label>
    <label class="field"><span>Address</span><input class="input" id="nj-c-addr" autocomplete="off"></label></div>`;
}
function njMenuHTML() {
  const q = MS.q.toLowerCase();
  const list = Array.from(S.customers.values()).filter((c) => !q || [c.name, c.phone, c.email].join(' ').toLowerCase().includes(q)).slice(0, 8);
  return list.map((c) => `<button type="button" data-act="nj-pick" data-id="${esc(c.id)}"><b style="flex:1">${esc(c.name)}</b><span class="faint mono">${esc(c.phone || '')}</span></button>`).join('')
    + `<button type="button" data-act="nj-mode" data-v="new" style="color:var(--accent-text);font-weight:600">${icon('plus', 'style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')} New account${MS.q ? ` “${esc(MS.q)}”` : ''}</button>`;
}
async function njCreate() {
  let custId = MS.custId;
  let cust = custId ? customer(custId) : null;
  if (!custId) {
    if (MS.mode === 'existing') { fieldErr('#nj-q', 'Pick an account or add a new one'); return; }
    const name = val('#nj-c-name');
    if (!name) { fieldErr('#nj-c-name', 'Enter the account name'); return; }
    custId = uid();
    cust = { name, phone: val('#nj-c-phone'), email: val('#nj-c-email'), type: val('#nj-c-type'), address: val('#nj-c-addr'), notes: '', createdAt: Date.now() };
    await put('customers', custId, cust);
  }
  const jid = uid();
  const job = {
    number: nextJobNumber(), name: val('#nj-name') || 'Kitchen', customerId: custId, address: val('#nj-addr') || (cust && cust.address) || '',
    stage: 'lead', salesId: val('#nj-sales'), source: val('#nj-src'), po: val('#nj-po'), siteContact: val('#nj-sc'), sitePhone: val('#nj-sp'), createdAt: Date.now(), updatedAt: Date.now(),
    quote: null, total: 0, sqft: 0, checklist: {}, payments: [],
  };
  await put('jobs', jid, job);
  await addNote(jid, `Job created for ${cust ? cust.name : 'customer'}`, 'event');
  closeModal();
  go('quote', { id: jid });
}

/* ---------- Edit job ---------- */
function editJobModal(id) {
  const j = jobOf(id);
  if (!j || !guardWrite()) return;
  MS = { kind: 'editjob', id };
  const custs = Array.from(S.customers.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  openModal({
    title: `Edit ${j.number}`,
    body: `<div class="grid2">
      <label class="field span2"><span>Job name</span><input class="input" id="ej-name" value="${esc(j.name)}"></label>
      <label class="field span2"><span>Account</span><select class="input" id="ej-cust">${custs.map((c) => `<option value="${esc(c.id)}" ${c.id === j.customerId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field span2"><span>Job site address</span><input class="input" id="ej-addr" value="${esc(j.address || '')}"></label>
      <label class="field"><span>Salesperson</span><select class="input" id="ej-sales">${teamOptions(j.salesId)}</select></label>
      <label class="field"><span>Lead source</span><select class="input" id="ej-src">${opts(SOURCES, j.source)}</select></label>
      <label class="field"><span>On-site contact</span><input class="input" id="ej-sc" value="${esc(j.siteContact || '')}"></label>
      <label class="field"><span>Their phone</span><input class="input" id="ej-sp" inputmode="tel" value="${esc(j.sitePhone || '')}"></label>
      <label class="field span2"><span>PO / lot number</span><input class="input" id="ej-po" value="${esc(j.po || '')}"></label></div>`,
    foot: `<button class="btn danger left" data-act="ej-delete">${icon('trash')}Delete job</button><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="ej-save">Save</button>`,
  });
}

/* ---------- Activity (schedule) ---------- */
function activityModal({ id, jobId, type, date }) {
  const a = id ? S.activities.get(id) : null;
  if (!a && !guardWrite()) return;
  const W = S.canWrite && !isCrew();
  MS = { kind: 'act', id: a ? a.id : null, jobId: a ? a.jobId : jobId || '', type: a ? a.type : type || 'template', crew: a ? (a.crew || []).slice() : [], status: a ? a.status || 'scheduled' : 'estimate', jq: '' };
  if (!a && !MS.crew.length) {
    const role = { template: 'Templater', fabrication: 'Fabricator', install: 'Installer' }[MS.type];
    if (role) MS.crew = activeTeam().filter((m) => m.role === role).map((m) => m.id).slice(0, MS.type === 'install' ? 2 : 1);
  }
  const j = jobOf(MS.jobId);
  openModal({
    title: a ? `${actType(a.type).name} · ${j ? j.number : ''}` : 'Schedule',
    body: `<div id="act-job">${actJobHTML()}</div>
      <div class="field"><span>Type</span><div class="seg" id="act-types" style="flex-wrap:wrap">${actTypes().map((t) => `<button type="button" data-act="act-type" data-v="${esc(t.id)}" aria-pressed="${MS.type === t.id}" ${W ? '' : 'disabled'}>${esc(t.name)}</button>`).join('')}</div></div>
      <div class="field"><span>Status</span><div class="seg" id="act-status">${ACT_STATUS.map((st) => `<button type="button" data-act="act-status" data-v="${st.id}" aria-pressed="${MS.status === st.id}" ${W ? '' : 'disabled'}>${st.name}</button>`).join('')}</div><small>Estimate = penciled in. Confirmed = date agreed with the customer.</small></div>
      <div class="grid3">
        <label class="field"><span>Date</span><input class="input" type="date" id="act-date" value="${esc(a ? a.date : date || bizDay(1))}" ${W ? '' : 'disabled'}></label>
        <label class="field"><span>Time <span class="faint">(optional)</span></span><input class="input" type="time" id="act-time" value="${esc(a ? a.time || '' : '')}" ${W ? '' : 'disabled'}></label>
        <label class="field"><span>How long</span><select class="input" id="act-dur" ${W ? '' : 'disabled'}>${DURATIONS.map((d) => `<option value="${esc(d)}" ${(a ? a.duration : MS.type === 'install' || MS.type === 'fabrication' ? 'Full day' : '') === d ? 'selected' : ''}>${d || '—'}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span>Crew</span><div class="crewpick" id="act-crew">${actCrewHTML()}</div></div>
      <label class="field"><span>Notes for the crew</span><textarea class="input" id="act-notes" placeholder="Gate code, parking, bring the 10' straightedge…" ${W ? '' : 'disabled'}>${esc(a ? a.notes || '' : '')}</textarea></label>
      `,
    foot: `${a && W ? `<button class="btn danger left" data-act="act-delete">${icon('trash')}Delete</button>` : ''}${j ? `<button class="btn ${a && W ? '' : 'left'}" data-act="go" data-view="job" data-id="${esc(j.id)}">Open job</button>` : ''}<button class="btn" data-act="close-modal">${W ? 'Cancel' : 'Close'}</button>${W ? `<button class="btn primary" data-act="act-save">${a ? 'Save' : 'Schedule'}</button>` : ''}${!W && a && S.canWrite ? (a.status === 'done' ? `<button class="btn" data-act="act-done" data-id="${esc(a.id)}" data-v="0">${icon('undo')}Undo done</button>` : `<button class="btn primary" data-act="act-done" data-id="${esc(a.id)}" data-v="1">${icon('check')}Mark done</button>`) : ''}`,
  });
}
function actJobHTML() {
  const j = jobOf(MS.jobId);
  if (j) return `<div class="field"><span>Job</span><div style="display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line-2);border-radius:var(--r-sm)"><span class="mono faint">${esc(j.number)}</span><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.name)}</b><span class="faint">${esc((customer(j.customerId) || {}).name || '')}</span>${MS.id || !S.canWrite ? '' : '<button class="btn sm ghost" data-act="act-job-change">Change</button>'}</div></div>`;
  const q = MS.jq.toLowerCase();
  const list = allJobs().filter((x) => !['closed', 'lost'].includes(x.stage) && jobMatches(x, q)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8);
  return `<div class="field"><span>Job</span><div class="picker"><input class="input" id="act-jq" placeholder="Search job #, name or customer" autocomplete="off" data-input-modal="actjq" value="${esc(MS.jq)}"><div class="menu" id="act-menu">${list.map((x) => `<button type="button" data-act="act-pick" data-id="${esc(x.id)}"><span class="mono faint">${esc(x.number)}</span><b style="flex:1">${esc(x.name)}</b><span class="faint">${esc((customer(x.customerId) || {}).name || '')}</span></button>`).join('') || '<div class="faint" style="padding:10px">No open jobs match.</div>'}</div></div></div>`;
}
function actCrewHTML() {
  const team = activeTeam();
  if (!team.length) return '<span class="faint" style="font-size:12.5px">Add your team to assign crews.</span>';
  return team.map((m) => `<button type="button" data-act="act-crew" data-id="${esc(m.id)}" aria-pressed="${MS.crew.includes(m.id)}" ${S.canWrite ? '' : 'disabled'}>${avatar(m)}${esc(m.name.split(' ')[0])}<span class="faint" style="font-weight:500">${esc(m.role || '')}</span></button>`).join('');
}
async function actSave() {
  if (!MS.jobId) { fieldErr('#act-jq', 'Pick the job to schedule'); return; }
  const date = val('#act-date');
  if (!date) { fieldErr('#act-date', 'Pick a date'); return; }
  const j = jobOf(MS.jobId);
  const data = { jobId: MS.jobId, type: MS.type, date, time: val('#act-time'), duration: val('#act-dur'), crew: MS.crew, notes: val('#act-notes') };
  const prevStatus = MS.id ? (S.activities.get(MS.id) || {}).status || 'scheduled' : null;
  const wasDone = prevStatus === 'done';
  const nowDone = MS.status === 'done';
  if (!nowDone) data.status = MS.status;
  const crewNames = MS.crew.map(member).filter(Boolean).map((m) => m.name.split(' ')[0]).join(', ');
  if (MS.id) {
    const prev = S.activities.get(MS.id) || {};
    await patch('activities', MS.id, data);
    if (prev.date !== date && j) await addNote(j.id, `${actType(MS.type).name} moved from ${fmtD(prev.date)} to ${fmtD(date)}`, 'event');
    const id = MS.id;
    closeModal();
    if (nowDone !== wasDone) await completeAct({ ...prev, ...data, id }, nowDone); else toast('Saved');
  } else {
    const id = uid();
    const st = MS.status;
    await put('activities', id, { ...data, status: st === 'done' ? 'scheduled' : st, createdAt: Date.now() });
    if (j) {
      await patch('jobs', j.id, { updatedAt: Date.now() });
      await addNote(j.id, `${actType(MS.type).name} scheduled for ${fmtD(date)}${data.time ? ' at ' + fmtTime(data.time) : ''}${crewNames ? ' · ' + crewNames : ''}`, 'event');
    }
    closeModal();
    if (st === 'done') await completeAct({ ...data, id }, true);
    toast(`${actType(data.type).name} ${data.status === 'estimate' ? 'penciled in' : 'scheduled'} for ${fmtD(date)}`);
  }
}

/* ---------- Payment ---------- */
function paymentModal(id) {
  const j = jobOf(id);
  if (!j || !guardWrite()) return;
  MS = { kind: 'pay', id };
  const bal = balanceOf(j);
  const dep = j.quote ? calcQuote(j.quote).deposit : 0;
  const suggest = paidOf(j) <= 0 && dep ? dep : bal;
  openModal({
    title: `Record payment · ${j.number}`,
    body: `<div class="grid2">
      <label class="field"><span>Amount</span><input class="input mono right" id="pay-amt" inputmode="decimal" value="${suggest > 0 ? suggest.toFixed(2) : ''}" autofocus></label>
      <label class="field"><span>Date</span><input class="input" type="date" id="pay-date" value="${today()}"></label>
      <label class="field"><span>Method</span><select class="input" id="pay-method">${opts(PAY_METHODS, 'Check')}</select></label>
      <label class="field"><span>Reference <span class="faint">(optional)</span></span><input class="input" id="pay-note" placeholder="Check #, last 4…"></label></div>
      <div class="btn-row">${dep ? `<button class="btn sm" data-act="pay-fill" data-v="${dep.toFixed(2)}">Deposit ${money2(dep)}</button>` : ''}${bal > 0 ? `<button class="btn sm" data-act="pay-fill" data-v="${bal.toFixed(2)}">Balance ${money2(bal)}</button>` : ''}</div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="pay-save">Record payment</button>`,
  });
}

/* ---------- Customer ---------- */
function customerModal(id) {
  if (!guardWrite()) return;
  const c = id ? customer(id) : null;
  MS = { kind: 'cust', id: c ? c.id : null, contacts: deepClone((c && c.contacts) || []) };
  openModal({
    title: c ? 'Edit account' : 'New account',
    body: `<div class="grid2">
      <label class="field span2"><span>Name</span><input class="input" id="cu-name" value="${esc(c ? c.name : '')}" placeholder="Full name or company"></label>
      <label class="field"><span>Phone</span><input class="input" id="cu-phone" inputmode="tel" value="${esc(c ? c.phone || '' : '')}"></label>
      <label class="field"><span>Email</span><input class="input" id="cu-email" inputmode="email" value="${esc(c ? c.email || '' : '')}"></label>
      <label class="field"><span>Type</span><select class="input" id="cu-type">${opts(CUST_TYPES, c ? c.type : 'Homeowner')}</select></label>
      <label class="field"><span>Address</span><input class="input" id="cu-addr" value="${esc(c ? c.address || '' : '')}"></label>
      <label class="field span2"><span>Notes</span><textarea class="input" id="cu-notes" placeholder="Gate code, preferred contact time, builder super…">${esc(c ? c.notes || '' : '')}</textarea></label></div>
      <div class="field"><span>Contacts <span class="faint">(supers, designers, project managers)</span></span><div id="cu-contacts" class="contacts-edit">${contactsEditHTML()}</div><div><button type="button" class="btn sm" data-act="contact-add">${icon('plus')}Add contact</button></div></div>`,
    foot: `${c && !allJobs().some((j) => j.customerId === c.id) ? `<button class="btn danger left" data-act="cu-delete">${icon('trash')}Delete</button>` : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="cu-save">Save</button>`,
  });
}

function contactsEditHTML() {
  return MS.contacts.map((ct, i) => `<div class="contact-row">
    <input class="input" id="ct-n-${i}" value="${esc(ct.name || '')}" placeholder="Name" data-ct="${i}" data-f="name" aria-label="Contact name">
    <input class="input" id="ct-r-${i}" value="${esc(ct.role || '')}" placeholder="Role (Super, Designer…)" data-ct="${i}" data-f="role" aria-label="Role">
    <input class="input" id="ct-p-${i}" value="${esc(ct.phone || '')}" placeholder="Phone" inputmode="tel" data-ct="${i}" data-f="phone" aria-label="Phone">
    <input class="input" id="ct-e-${i}" value="${esc(ct.email || '')}" placeholder="Email" inputmode="email" data-ct="${i}" data-f="email" aria-label="Email">
    <button type="button" class="btn icon ghost" data-act="contact-del" data-i="${i}" aria-label="Remove contact">${icon('close')}</button></div>`).join('') || '<span class="faint" style="font-size:12.5px">No contacts yet.</span>';
}
const contactLine = (ct) => `<div class="contact"><div><b>${esc(ct.name || '')}</b>${ct.role ? ` <span class="tag">${esc(ct.role)}</span>` : ''}</div>${ct.phone ? `<div><span class="mono" style="user-select:all">${esc(ct.phone)}</span> <button class="btn sm ghost" data-act="copy" data-text="${esc(ct.phone)}">${icon('copy')}Copy</button></div>` : ''}${ct.email ? `<div class="muted" style="user-select:all;overflow-wrap:anywhere;font-size:12.5px">${esc(ct.email)}</div>` : ''}</div>`;

/* ---------- Team member ---------- */
function profileModal() {
  const m = member(S.me);
  if (!m) { toast(S.mode === 'db' ? 'Your login isn’t linked to a team member yet. Ask the owner.' : 'Pick your name under Working as first', { bad: true }); return; }
  MS = { kind: 'profile' };
  const p = safeImg(m.photo);
  openModal({
    title: 'Your profile',
    body: `<div style="display:flex;align-items:center;gap:16px">${avatar(m, 'xl')}<div style="min-width:0"><b style="font-size:16px">${esc(m.name)}</b><div class="muted">${esc(m.role || '')}${S.mode === 'db' ? ' · ' + esc(ACCESS_LABEL[access()] || '') : ''}</div>${S.auth.user ? `<div class="faint mono" style="font-size:12px;overflow-wrap:anywhere">${esc(S.auth.user.email || '')}</div>` : ''}</div></div>
      <div class="btn-row"><label class="btn primary">${icon('plus')}${p ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" capture="user" class="sr" data-upload="myphoto"></label>${p ? '<button class="btn ghost" data-act="photo-remove">Remove photo</button>' : ''}</div>
      <p class="faint" style="margin:0;font-size:12.5px">Your photo shows next to your name on the calendar, jobs and notes.</p>`,
    foot: `${S.mode === 'db' ? '<button class="btn left" data-act="sign-out">Sign out</button>' : ''}<button class="btn" data-act="close-modal">Done</button>`,
  });
}
function memberModal(id) {
  if (!guardWrite()) return;
  const m = id ? member(id) : null;
  const used = new Set(Array.from(S.team.values()).map((x) => x.color));
  MS = { kind: 'member', id: m ? m.id : null, color: m ? m.color : (MEMBER_COLORS.find((c) => !used.has(c)) || MEMBER_COLORS[S.team.size % MEMBER_COLORS.length]) };
  openModal({
    title: m ? 'Edit team member' : 'Add team member',
    body: `<div class="grid2">
      <label class="field span2"><span>Name</span><input class="input" id="tm-name" value="${esc(m ? m.name : '')}" placeholder="First and last name"></label>
      <label class="field"><span>Role</span><select class="input" id="tm-role">${opts(ROLES, m ? m.role : 'Installer')}</select></label>
      <label class="field"><span>Phone</span><input class="input" id="tm-phone" inputmode="tel" value="${esc(m ? m.phone || '' : '')}"></label>
      <label class="field span2"><span>Email <span class="faint">(used for their login)</span></span><input class="input" id="tm-email" inputmode="email" value="${esc(m ? m.email || '' : '')}"></label></div>
      <div class="field"><span>Color on the calendar</span><div class="btn-row" id="tm-colors">${tmColorsHTML()}</div></div>
      ${m ? `<div class="field"><span>Photo</span><div class="logo-row" id="tm-photo">${avatar(m, 'lg')}<label class="btn sm">Upload<input type="file" accept="image/*" class="sr" data-upload="memberphoto" data-id="${esc(m.id)}"></label>${safeImg(m.photo) ? `<button class="btn sm ghost" data-act="member-photo-remove" data-id="${esc(m.id)}">Remove</button>` : ''}</div></div>` : ''}
      ${m ? `<label class="check"><input type="checkbox" id="tm-active" ${m.active !== false ? 'checked' : ''}> Active (shows in crew lists)</label>` : ''}`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="tm-save">Save</button>`,
  });
}
const tmColorsHTML = () => MEMBER_COLORS.map((c) => `<button type="button" class="btn icon" data-act="tm-color" data-v="${c}" aria-label="Color ${c}" aria-pressed="${MS.color === c}" style="width:30px;height:30px;padding:0;background:${c};border:3px solid ${MS.color === c ? 'var(--ink)' : 'transparent'}"></button>`).join('');

/* ---------- Quick note (crew) ---------- */
function quickNoteModal(jobId) {
  const j = jobOf(jobId);
  if (!j || !guardWrite()) return;
  MS = { kind: 'qnote', id: jobId };
  openModal({
    title: `Note on ${j.number}`,
    body: `<p class="muted" style="margin:0">${esc(j.name)} · ${esc((customer(j.customerId) || {}).name || '')}</p>
      <textarea class="input" id="qn-text" placeholder="Cabinets not level at sink base, customer changed faucet, needs 2nd trip…" style="min-height:110px" autofocus></textarea>
      <label class="check"><input type="checkbox" id="qn-issue"> This is a problem the office needs to handle</label>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="qn-save">Add note</button>`,
  });
}

/* ---------- Mark lost ---------- */
function lostModal(id) {
  const j = jobOf(id);
  if (!j || !guardWrite()) return;
  MS = { kind: 'lost', id };
  openModal({
    title: `Mark ${j.number} as lost`,
    body: `<label class="field"><span>Why didn’t they buy?</span><select class="input" id="lost-why">${opts(['Price', 'Went with another fabricator', 'Big-box store', 'Project cancelled', 'Timing', 'No response', 'Other'], 'Price')}</select></label>
      <label class="field"><span>Notes <span class="faint">(optional)</span></span><input class="input" id="lost-note"></label>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn danger solid" data-act="lost-save">Mark lost</button>`,
  });
}

/* ---------- Search palette ---------- */
function paletteOpen() {
  MS = { kind: 'palette', q: '', sel: 0 };
  openModal({ title: '', cls: 'palette', body: `<input class="input" id="pal-q" placeholder="Search jobs, customers, phone numbers…" autocomplete="off" data-input-modal="palq" autofocus><div class="rows" id="pal-res">${paletteResults()}</div>` });
  const mb = $('.palette .modal-b'); if (mb) { mb.style.padding = '0'; mb.style.gap = '0'; }
}
function paletteItems() {
  const q = MS.q.trim().toLowerCase();
  const jobs = allJobs().filter((j) => jobMatches(j, q)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, q ? 8 : 6)
    .map((j) => ({ view: 'job', id: j.id, html: `<span class="stripe" style="--c:${stageColor(j.stage)}"></span><span class="grow"><span class="t1">${esc(j.name)}</span><span class="t2"><span class="mono">${esc(j.number)}</span> · ${esc((customer(j.customerId) || {}).name || '')}</span></span>${stagePill(j.stage)}` }));
  const custs = q && !isCrew() ? Array.from(S.customers.values()).filter((c) => [c.name, c.phone, c.email, c.address].join(' ').toLowerCase().includes(q)).slice(0, 5)
    .map((c) => ({ view: 'customer', id: c.id, html: `<span class="avatar" style="--c:var(--ink-3)">${esc(initials(c.name))}</span><span class="grow"><span class="t1">${esc(c.name)}</span><span class="t2">${esc(c.type || '')} · <span class="mono">${esc(c.phone || '')}</span></span></span>` })) : [];
  return jobs.concat(custs);
}
function paletteResults() {
  const items = paletteItems();
  MS.items = items;
  if (MS.sel >= items.length) MS.sel = 0;
  return items.length ? items.map((it, i) => `<button class="row ${i === MS.sel ? 'sel' : ''}" data-act="go" data-view="${it.view}" data-id="${esc(it.id)}">${it.html}</button>`).join('') : '<div class="empty">Nothing matches.</div>';
}

/* ---------- More (phone) ---------- */
function moreSheet() {
  openModal({
    title: 'More',
    body: `<div class="rows" style="margin:-6px -18px">${(isCrew() ? [] : [['customers', 'Accounts', 'users'], ['inventory', 'Inventory', 'slab'], ['team', 'Team', 'team'], ['settings', 'Prices & Settings', 'tag']]).map(([v, n, ic]) => `<button class="row" data-act="go" data-view="${v}" style="font-weight:600;gap:12px">${icon(ic, 'style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8"')}${n}</button>`).join('')}</div>
      ${S.mode === 'db' ? `<div style="display:flex;align-items:center;gap:10px">${member(S.me) ? avatar(member(S.me), 'lg') : ''}<div style="flex:1;min-width:0"><b>${esc(member(S.me) ? member(S.me).name : (S.auth.user && S.auth.user.email) || '')}</b><div class="faint" style="font-size:12.5px">${esc(ACCESS_LABEL[access()] || '')} · ${S.live ? 'Live' : 'Reconnecting…'}</div></div><button class="btn" data-act="sign-out">Sign out</button></div>`
        : `<label class="field"><span>Working as</span><select class="input" id="more-me" data-change="me">${teamOptions(S.me, 'Choose your name')}</select></label><div class="faint" style="font-size:12px">Demo · this device only</div>`}`,
  });
}

/* ---------- CSV export ---------- */
function exportCSV() {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Job', 'Name', 'Customer', 'Phone', 'Stage', 'Material', 'Sq ft', 'Slabs', 'Total', 'Paid', 'Balance', 'Salesperson', 'Source', 'Site address', 'Created']];
  for (const j of allJobs().sort((a, b) => String(a.number).localeCompare(String(b.number)))) {
    const c = customer(j.customerId) || {};
    rows.push([j.number, j.name, c.name, c.phone, stageName(j.stage), j.material, j.sqft ? sqft1(j.sqft) : '', j.slabs || '', (j.total || 0).toFixed(2), paidOf(j).toFixed(2), balanceOf(j).toFixed(2), (member(j.salesId) || {}).name, j.source, j.address, j.createdAt ? dstr(new Date(j.createdAt)) : '']);
  }
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n');
  saveFile(`kerf-jobs-${today()}.csv`, '\ufeff' + csv, 'text/csv');
  toast('Jobs exported');
}
