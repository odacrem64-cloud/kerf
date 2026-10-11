/* =========================================================
   Calendar, My Work, Accounts, Team, Settings
   ========================================================= */
function calFilter(a) {
  if (S.ui.calHide.includes(a.type)) return false;
  if (S.ui.calCrew && !(a.crew || []).includes(S.ui.calCrew)) return false;
  return true;
}
function actBlockHTML(a) {
  const j = jobOf(a.jobId) || {};
  const t = actType(a.type);
  const crew = (a.crew || []).map(member).filter(Boolean);
  const c = customer(j.customerId) || {};
  return `<button class="act ${a.status === 'done' ? 'done' : ''} ${a.status === 'estimate' ? 'est' : ''}" style="--c:${t.color}" draggable="${S.canWrite && !isCrew()}" data-drag-act="${esc(a.id)}" data-act="edit-act" data-id="${esc(a.id)}">
    <span class="at">${a.status === 'done' ? '✓ ' : ''}${esc(t.name)}${a.status === 'estimate' ? '<i class="est-tag">EST</i>' : ''}<span class="tm">${a.time ? fmtTime(a.time) : esc(a.duration || '')}</span></span>
    <span class="an">${esc(j.name || 'Job removed')}</span>
    <span class="am"><span class="mono">${esc(j.number || '')}</span><span>${esc(lastName(c.name))}</span>${j.sqft && a.type === 'install' ? `<span>${sqft1(j.sqft)}ft²</span>` : ''}<span class="avatars" style="margin-left:auto">${crew.map((m) => avatar(m)).join('')}</span></span>
  </button>`;
}
function capacityHTML(d, list) {
  const c = cfg();
  if (isWeekend(d) && !list.length) return '';
  const inst = sum(list.filter((a) => a.type === 'install'), (a) => (jobOf(a.jobId) || {}).sqft);
  const tpl = list.filter((a) => a.type === 'template').length;
  const cap = Number(c.capInstallSqft) || 0;
  const pct = cap ? (inst / cap) * 100 : 0;
  const cls = pct > 100 ? 'over' : pct > 85 ? 'near' : '';
  return `<div class="cap" title="Install capacity ${cap} sq ft/day · ${c.capTemplates} templates/day">
    ${cap ? `<div class="meter"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div>` : ''}
    <small>${Math.round(inst)}/${cap} ft² · ${tpl}/${c.capTemplates} tpl</small></div>`;
}
VIEWS.calendar = () => {
  const u = S.ui;
  const team = activeTeam();
  const t = today();
  let title, body;
  const all = Array.from(S.activities.values()).filter(calFilter);
  const byDate = new Map();
  for (const a of all) { if (!byDate.has(a.date)) byDate.set(a.date, []); byDate.get(a.date).push(a); }
  for (const l of byDate.values()) l.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  if (u.calMode === 'month') {
    const first = u.calDate.slice(0, 8) + '01';
    const fd = parseD(first);
    title = fd.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const start = weekStart(first);
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    body = `<div class="tablewrap"><div class="month" style="min-width:560px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.map((d) => {
      const list = byDate.get(d) || [];
      const out = d.slice(0, 7) !== first.slice(0, 7);
      return `<div class="mday ${out ? 'out' : ''} ${d === t ? 'today' : ''}" data-act="cal-day" data-date="${d}" data-drop-date="${d}"><span class="n">${parseD(d).getDate()}</span>${list.slice(0, 4).map((a) => { const j = jobOf(a.jobId) || {}; return `<button class="mchip ${a.status === 'estimate' ? 'est' : ''}" style="--c:${actType(a.type).color}" data-act="edit-act" data-id="${esc(a.id)}" draggable="${S.canWrite && !isCrew()}" data-drag-act="${esc(a.id)}">${a.status === 'done' ? '✓ ' : ''}${esc(actType(a.type).name[0])} · ${esc(j.name || '')}</button>`; }).join('')}${list.length > 4 ? `<span class="mmore">+${list.length - 4} more</span>` : ''}</div>`;
    }).join('')}</div></div>`;
  } else if (u.calMode === 'crew') {
    const ws = weekStart(u.calDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const a = parseD(days[0]), b = parseD(days[6]);
    title = a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}` : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
    const weekActs = all.filter((x) => x.date >= days[0] && x.date <= days[6]);
    const people = team.filter((m) => !['Owner', 'Office', 'Sales'].includes(m.role) || weekActs.some((x) => (x.crew || []).includes(m.id)));
    const rows = people.map((m) => ({ m, id: m.id, acts: weekActs.filter((x) => (x.crew || []).includes(m.id)) }));
    const un = weekActs.filter((x) => !(x.crew || []).length);
    if (un.length) rows.push({ m: null, id: '', acts: un });
    body = `<div class="tablewrap" data-keep-scroll="crew"><div class="crewcal" style="--days:7">
      <div class="cc-corner">Crew</div>${days.map((d) => `<div class="cc-dow ${d === t ? 'today' : ''}"><b>${parseD(d).getDate()}</b> ${DOW[parseD(d).getDay()]}</div>`).join('')}
      ${rows.map((r) => `<div class="cc-who">${r.m ? `${avatar(r.m)}<span><b>${esc(r.m.name)}</b><small>${esc(r.m.role || '')} · ${r.acts.length}</small></span>` : '<span><b>Unassigned</b><small>Needs a crew</small></span>'}</div>${days.map((d) => `<div class="cc-cell ${d === t ? 'today' : ''} ${isWeekend(d) ? 'weekend' : ''}" data-drop-date="${d}" data-drop-member="${esc(r.id)}">${r.acts.filter((x) => x.date === d).sort((x, y) => (x.time || '99').localeCompare(y.time || '99')).map(actBlockHTML).join('')}</div>`).join('')}`).join('')}
    </div></div>
    ${rows.length ? '' : '<div class="card"><div class="empty">Add your installers, templaters and fabricators on the Team page to see their week here.</div></div>'}`;
  } else {
    const ws = weekStart(u.calDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const a = parseD(days[0]), b = parseD(days[6]);
    title = a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}` : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
    body = `<div class="weekwrap" data-keep-scroll="week"><div class="week">${days.map((d) => {
      const list = byDate.get(d) || [];
      const allDay = Array.from(S.activities.values()).filter((x) => x.date === d);
      return `<section class="day ${d === t ? 'today' : ''} ${isWeekend(d) ? 'weekend' : ''}" data-drop-date="${d}" aria-label="${fmtD(d)}">
        <div class="day-h"><div class="d"><b>${parseD(d).getDate()}</b><span>${DOW[parseD(d).getDay()]}</span><button class="btn icon sm ghost add" data-act="print-day" data-date="${d}" aria-label="Print day packet for ${fmtD(d)}" title="Print day packet">${icon('print')}</button>${S.canWrite && !isCrew() ? `<button class="btn icon sm ghost add" style="margin-left:0" data-act="new-act" data-date="${d}" aria-label="Schedule on ${fmtD(d)}">${icon('plus')}</button>` : ''}</div>${capacityHTML(d, allDay)}</div>
        <div class="day-b">${list.map(actBlockHTML).join('')}</div></section>`;
    }).join('')}</div></div>`;
  }
  const head = `<div class="cal-head">
    <div class="btn-row"><button class="btn icon" data-act="cal-move" data-d="-1" aria-label="Previous">${icon('back')}</button><button class="btn" data-act="cal-today">Today</button><button class="btn icon" data-act="cal-move" data-d="1" aria-label="Next">${icon('next')}</button></div>
    <h2>${esc(title)}</h2>
    <div class="seg" role="group" aria-label="Calendar view">${[['week', 'Week'], ['crew', 'By crew'], ['month', 'Month']].map(([k, l]) => `<button data-act="ui" data-k="calMode" data-v="${k}" aria-pressed="${u.calMode === k}">${l}</button>`).join('')}</div>
    <select class="input" id="cal-crew" data-change="calCrew" style="width:auto" aria-label="Crew member"><option value="">All crew</option>${team.map((m) => `<option value="${esc(m.id)}" ${u.calCrew === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    <button class="btn" data-act="print-day" data-date="${u.calMode === 'month' ? today() : (u.calDate >= weekStart(u.calDate) && today() >= weekStart(u.calDate) && today() <= addDays(weekStart(u.calDate), 6) ? today() : weekStart(u.calDate))}">${icon('print')}<span class="lbl">Day packet</span></button>
    <div class="btn-row" style="margin-left:auto">${actTypes().map((tp) => `<button class="chip" data-act="cal-type" data-v="${esc(tp.id)}" aria-pressed="${!u.calHide.includes(tp.id)}"><i style="background:${tp.color}"></i>${esc(tp.name)}</button>`).join('')}</div>
  </div>
  <div class="legend faint"><span><i class="lg-solid"></i>Confirmed</span><span><i class="lg-dash"></i>Estimate (penciled in)</span><span>✓ Complete</span></div>`;
  return { title: 'Calendar', body: head + body + `<div class="faint" style="font-size:12px">${u.calMode === 'crew' ? 'Drag a job to another day, or onto another person’s row to reassign it.' : 'Drag a job to another day to reschedule. Capacity bars use your daily install square footage from Settings.'}</div>` };
};

/* ---------- My Work ---------- */
function taskCardHTML(a) {
  const j = jobOf(a.jobId) || {};
  const c = customer(j.customerId) || {};
  const t = actType(a.type);
  const site = j.address || c.address || '';
  const done = a.status === 'done';
  const crew = (a.crew || []).map(member).filter(Boolean);
  const addons = quoteAddonSummary(j.quote);
  const issues = S.mode === 'local' ? notesForJob(j.id).filter((n) => n.kind === 'issue').length : 0;
  return `<article class="task">
    <div class="task-h ${a.status === 'estimate' ? 'est' : ''}" style="--c:${t.color}"><span class="type">${esc(t.name)}</span>${a.status === 'estimate' ? '<span class="tag warn">Estimate</span>' : ''}<span class="mono faint">${a.time ? fmtTime(a.time) : ''}${a.duration ? ' · ' + esc(a.duration) : ''}</span><span style="margin-left:auto" class="avatars">${crew.map((m) => avatar(m)).join('')}</span>${done ? '<span class="tag ok">Done</span>' : ''}</div>
    <div class="task-b">
      <div><div class="title">${esc(j.name || 'Job removed')}</div><div class="muted"><span class="mono">${esc(j.number || '')}</span> · ${esc(c.name || '')} ${demoTag(j)}</div></div>
      <dl class="kv">
        ${site ? `<dt>Site</dt><dd><span style="user-select:all">${esc(site)}</span> <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site)}" target="_blank" rel="noopener">Directions</a></dd>` : ''}
        ${j.siteContact || j.sitePhone ? `<dt>On site</dt><dd>${esc(j.siteContact || '')} ${j.sitePhone ? `<span class="mono" style="user-select:all">${esc(j.sitePhone)}</span>` : ''}</dd>` : ''}
        ${c.phone ? `<dt>Phone</dt><dd><span class="mono" style="user-select:all">${esc(c.phone)}</span></dd>` : ''}
        ${j.material ? `<dt>Stone</dt><dd><span style="display:inline-flex;gap:6px;align-items:center"><span class="swatch" style="background:${esc(j.materialColor || '#ccc')}"></span>${esc(j.material)}</span>${j.sqft ? ` · ${sqft1(j.sqft)} ft²` : ''}${j.slabs ? ` · ${j.slabs} slab${j.slabs === 1 ? '' : 's'}` : ''}</dd>` : ''}
        ${j.edge ? `<dt>Edge</dt><dd>${esc(j.edge)}</dd>` : ''}
        ${addons ? `<dt>Cutouts</dt><dd>${esc(addons)}</dd>` : ''}
        ${(() => { const sl = slabsForJob(j.id).filter((s) => s.status === 'allocated'); return sl.length ? `<dt>Slabs</dt><dd>${sl.map((s) => `<span class="mono">${esc(s.serial)}</span>${s.location ? ' (' + esc(s.location) + ')' : ''}`).join(', ')}</dd>` : ''; })()}
        ${(() => { const fl = filesForJob(j.id); return fl.length ? `<dt>Files</dt><dd><button class="linkbtn" data-act="go" data-view="job" data-id="${esc(j.id)}">${fl.length} file${fl.length === 1 ? '' : 's'}${fl.some(isImageFile) ? ` · ${fl.filter(isImageFile).length} photo${fl.filter(isImageFile).length === 1 ? '' : 's'}` : ''}</button></dd>` : ''; })()}
        ${a.notes ? `<dt>Notes</dt><dd>${esc(a.notes)}</dd>` : ''}
        ${issues ? `<dt>Issues</dt><dd><span class="tag bad">${issues} open</span></dd>` : ''}
      </dl>
    </div>
    <div class="task-f">
      ${S.canWrite ? (done ? `<button class="btn" data-act="act-done" data-id="${esc(a.id)}" data-v="0">${icon('undo')}Undo done</button>` : `<button class="btn primary" data-act="act-done" data-id="${esc(a.id)}" data-v="1">${icon('check')}Mark done</button>`) : ''}
      ${S.canWrite ? `<button class="btn" data-act="quick-note" data-id="${esc(j.id || '')}">${icon('flag')}Note / issue</button>` : ''}
      <button class="btn" data-act="go" data-view="job" data-id="${esc(j.id || '')}">Open job</button>
    </div>
  </article>`;
}
VIEWS.mywork = () => {
  const team = activeTeam();
  const t = today();
  const me = member(S.me);
  if (!team.length) return { title: 'My Work', body: `<div class="card"><div class="empty"><b>Add your team first.</b><span>Each crew member picks their name here and sees only their jobs for the day.</span><button class="btn primary" data-act="go" data-view="team">Add team</button></div></div>` };
  const all = S.ui.mwAll;
  const mine = Array.from(S.activities.values()).filter((a) => all || (S.me && (a.crew || []).includes(S.me)));
  const sortT = (a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
  const todays = mine.filter((a) => a.date === t).sort(sortT);
  const overdue = mine.filter((a) => a.date < t && a.status !== 'done').sort(sortT);
  const upcoming = mine.filter((a) => a.date > t && a.date <= addDays(t, 14)).sort(sortT);
  const recent = mine.filter((a) => a.status === 'done' && a.date < t && a.date >= addDays(t, -7)).sort(sortT).reverse();
  const picker = S.mode === 'db' ? '' : `<label class="field" style="max-width:280px;flex:1"><span>Who’s working?</span><select class="input" id="mw-me" data-change="me">${`<option value="">Choose your name</option>` + team.map((m) => `<option value="${esc(m.id)}" ${S.me === m.id ? 'selected' : ''}>${esc(m.name)} · ${esc(m.role || '')}</option>`).join('')}</select></label>`;
  const allBox = isCrew() ? '' : `<label class="check" style="align-self:flex-end;padding-bottom:8px"><input type="checkbox" id="mw-all" data-change="mwAll" ${all ? 'checked' : ''}> Show the whole shop</label>`;
  const who = picker || allBox ? `<div class="mw-who">${picker}${allBox}</div>` : '';
  if (!me && !all) return { title: 'My Work', body: who + `<div class="card"><div class="empty">${S.mode === 'db' ? '<b>Your login isn’t linked to a team member.</b><span>Ask the owner to create your login from your card on the Team page.</span>' : '<b>Pick your name to see your jobs.</b><span>Kerf remembers it on this device.</span>'}</div></div>` };
  const section = (label, list, empty) => `<div style="display:flex;flex-direction:column;gap:10px"><h2>${label} <span class="faint num">${list.length || ''}</span></h2>${list.length ? `<div class="tasks">${list.map(taskCardHTML).join('')}</div>` : `<div class="card"><div class="empty">${empty}</div></div>`}</div>`;
  return {
    actions: `<button class="btn" data-act="print-day" data-date="${t}">${icon('print')}<span class="lbl">Print my day</span></button>`,
    title: all ? 'Shop work' : `${esc(me.name.split(' ')[0])}’s work`,
    crumb: esc(fmtD(t)),
    body: who
      + (overdue.length ? section('Not marked done yet', overdue, '') : '')
      + section(`Today`, todays, isWeekend(t) ? 'Nothing today. Enjoy the weekend.' : 'Nothing on your schedule today.')
      + `<div class="card"><div class="card-h"><h2>Next two weeks</h2><span class="faint">${upcoming.length}</span></div><div class="rows">${upcoming.length ? upcoming.map((a) => actRowHTML(a, { date: true })).join('') : '<div class="empty">Nothing scheduled.</div>'}</div></div>`
      + (recent.length ? `<div class="card"><div class="card-h"><h2>Done this week</h2></div><div class="rows">${recent.map((a) => actRowHTML(a, { date: true })).join('')}</div></div>` : ''),
  };
};

/* ---------- Customers ---------- */
VIEWS.customers = () => {
  const q = S.ui.custQ.toLowerCase();
  const jobs = allJobs();
  const list = Array.from(S.customers.values()).filter((c) => !q || [c.name, c.phone, c.email, c.address, c.type, ...(c.contacts || []).map((x) => [x.name, x.phone, x.email].join(' '))].join(' ').toLowerCase().includes(q)).map((c) => {
    const cj = jobs.filter((j) => j.customerId === c.id);
    return { c, n: cj.length, rev: sum(cj.filter((j) => stageIdx(j.stage) >= stageIdx('sold')), (j) => j.total), last: Math.max(0, ...cj.map((j) => j.updatedAt || 0)) };
  }).sort((a, b) => b.last - a.last || String(a.c.name).localeCompare(String(b.c.name)));
  return {
    title: 'Accounts',
    actions: S.canWrite ? `<button class="btn" data-act="edit-cust">${icon('plus')}<span class="lbl">New account</span></button>` : '',
    body: `<div class="toolbar"><input class="input search" id="cust-q" type="search" placeholder="Search accounts, contacts, phone, email" value="${esc(S.ui.custQ)}" data-input="custQ" aria-label="Search accounts"><span class="faint">${list.length} account${list.length === 1 ? '' : 's'}</span></div>
    <div class="card"><div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Email</th><th class="r">Jobs</th><th class="r">Sold</th><th>Last activity</th></tr></thead><tbody>
      ${list.map(({ c, n, rev, last }) => `<tr class="click" data-act="go" data-view="customer" data-id="${esc(c.id)}"><td><b>${esc(c.name)}</b> ${demoTag(c)}</td><td>${esc(c.type || '')}</td><td class="mono">${esc(c.phone || '')}</td><td class="faint">${esc(c.email || '')}</td><td class="r">${n}</td><td class="r">${rev ? money(rev) : '—'}</td><td class="faint">${last ? ago(last) : '—'}</td></tr>`).join('') || `<tr><td colspan="7"><div class="empty">${q ? 'No accounts match.' : 'Accounts are builders, dealers or homeowners. They’re added when you write a quote.'}</div></td></tr>`}
    </tbody></table></div></div>`,
  };
};
VIEWS.customer = ({ id }) => {
  const c = customer(id);
  if (!c) return { title: 'Account not found', back: { view: 'customers' }, body: `<div class="card"><div class="empty"><b>This account was removed.</b></div></div>` };
  const jobs = allJobs().filter((j) => j.customerId === c.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const sold = sum(jobs.filter((j) => stageIdx(j.stage) >= stageIdx('sold')), (j) => j.total);
  const owed = sum(jobs.filter((j) => stageIdx(j.stage) >= stageIdx('sold')), balanceOf);
  return {
    back: { view: 'customers' }, crumb: esc((c.type || 'Account') + ' account'), title: esc(c.name),
    actions: S.canWrite ? `<button class="btn" data-act="edit-cust" data-id="${esc(c.id)}">${icon('edit')}<span class="lbl">Edit</span></button><button class="btn dark" data-act="new-job" data-cust="${esc(c.id)}">${icon('plus')}<span class="lbl">Quote for ${esc(c.name.split(' ')[0])}</span></button>` : '',
    body: `<div class="cols"><div class="card"><div class="card-h"><h2>Jobs</h2><span class="faint">${jobs.length}</span></div><div class="rows">${jobs.map((j) => `<button class="row" data-act="go" data-view="job" data-id="${esc(j.id)}"><span class="stripe" style="--c:${stageColor(j.stage)}"></span><span class="grow"><span class="t1">${esc(j.name)}</span><span class="t2"><span class="mono">${esc(j.number)}</span>${j.material ? ' · ' + esc(j.material) : ''}</span></span>${stagePill(j.stage)}<span class="right num" style="min-width:80px"><b>${j.total ? money(j.total) : '—'}</b></span></button>`).join('') || '<div class="empty">No jobs yet.</div>'}</div></div>
    <div class="stack"><div class="card"><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
      ${c.phone ? `<div><div class="eyebrow">Phone</div><span class="mono" style="user-select:all">${esc(c.phone)}</span> <button class="btn sm ghost" data-act="copy" data-text="${esc(c.phone)}">${icon('copy')}Copy</button></div>` : ''}
      ${c.email ? `<div><div class="eyebrow">Email</div><span style="user-select:all;overflow-wrap:anywhere">${esc(c.email)}</span></div>` : ''}
      ${c.address ? `<div><div class="eyebrow">Address</div>${esc(c.address)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}" target="_blank" rel="noopener">Map</a></div>` : ''}
      ${c.notes ? `<div><div class="eyebrow">Notes</div><div style="white-space:pre-wrap">${esc(c.notes)}</div></div>` : ''}
    </div></div>
    ${(c.contacts || []).length ? `<div class="card"><div class="card-h"><h2>Contacts</h2><span class="faint">${c.contacts.length}</span></div><div class="card-b contacts">${c.contacts.map(contactLine).join('')}</div></div>` : ''}
    <div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><span class="label">Sold</span><span class="value">${money(sold)}</span></div><div class="kpi"><span class="label">Balance owed</span><span class="value">${money(owed)}</span></div></div></div></div>`,
  };
};

/* ---------- Team ---------- */
function loginRowHTML(m) {
  if (S.mode !== 'db') return '';
  const mem = memberForTeam(m.id);
  const admin = S.canWrite && isAdmin();
  if (mem) {
    return `<div class="task-f" style="font-size:12.5px;align-items:center"><span class="tag ${mem.active ? 'ok' : ''}">${mem.active ? 'Can sign in' : 'Login off'}</span><span class="faint" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(mem.email || '')} · ${esc(ACCESS_LABEL[mem.access] || '')}</span>${admin ? `<button class="btn sm" style="flex:0 0 auto;min-width:0;padding-block:4px" data-act="manage-login" data-id="${esc(mem.user_id)}">Manage</button>` : ''}</div>`;
  }
  if (m.demo) return '';
  return `<div class="task-f" style="font-size:12.5px;align-items:center"><span class="faint" style="flex:1">No login yet</span>${admin ? `<button class="btn sm" style="flex:0 0 auto;min-width:0;padding-block:4px" data-act="create-login" data-id="${esc(m.id)}">Create login</button>` : ''}</div>`;
}
function teamAccessHTML() {
  if (S.mode !== 'db' || !isAdmin() || !S.shop) return '';
  const pend = pendingMembers();
  return `<div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><div class="card-h"><h2>Shop code</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
      <div class="shopcode mono" style="user-select:all">${esc(S.shop.join_code || '')}</div>
      <p class="muted" style="margin:0;font-size:13px">Workers open <span class="mono" style="user-select:all">${esc(location.host)}</span>, tap <b>New to the team?</b>, and enter this code. You approve them here.</p>
      <div class="btn-row"><button class="btn sm dark" data-act="copy-code">${icon('copy')}Copy invite</button><button class="btn sm ghost" data-act="new-code">${icon('refresh')}New code</button></div>
    </div></div>
    <div class="card"><div class="card-h"><h2>Join requests</h2><span class="faint">${pend.length}</span></div>
      <div class="rows">${pend.length ? pend.map((m) => `<div class="row"><span class="avatar" style="--c:var(--accent)">${esc(initials(m.name || m.email))}</span><span class="grow"><span class="t1">${esc(m.name || m.email)}</span><span class="t2">${esc(m.email || '')} · asked ${ago(Date.parse(m.created_at))}</span></span><button class="btn sm primary" data-act="approve-member" data-id="${esc(m.user_id)}">Approve</button><button class="btn sm ghost" data-act="decline-member" data-id="${esc(m.user_id)}">Decline</button></div>`).join('') : '<div class="empty">No one is waiting. New requests show up here right away.</div>'}</div></div>
  </div>`;
}
VIEWS.team = () => {
  const all = Array.from(S.team.values()).sort((a, b) => (a.active === false) - (b.active === false) || String(a.name).localeCompare(String(b.name)));
  const ws = weekStart(today()), we = addDays(ws, 6);
  const load = (id) => Array.from(S.activities.values()).filter((a) => a.date >= ws && a.date <= we && (a.crew || []).includes(id));
  return {
    title: 'Team',
    actions: S.canWrite && isAdmin() ? `<button class="btn" data-act="edit-member">${icon('plus')}<span class="lbl">Team member</span></button>` : '',
    body: `<p class="muted" style="margin:0;max-width:70ch">${S.mode === 'db' ? 'Everyone who sells, templates, cuts or installs. Send your shop code so people can ask to join, or click <b>Create login</b> on someone’s card to set them up yourself. Crew see their own schedule and can mark work done; they don’t see prices or money.' : 'Everyone who sells, templates, cuts or installs. In demo mode, pick a name under <b>Working as</b> to see that person’s My Work view.'}</p>
    ${teamAccessHTML()}
    ${all.length ? `<div class="tasks">${all.map((m) => { const l = load(m.id); return `<article class="task" style="${m.active === false ? 'opacity:.6' : ''}"><div class="task-b" style="flex-direction:row;align-items:center;gap:12px">${avatar(m, 'lg')}<div style="flex:1;min-width:0"><div class="title" style="font-size:15px">${esc(m.name)} ${demoTag(m)}</div><div class="muted">${esc(m.role || '')}${m.phone ? ' · <span class="mono">' + esc(m.phone) + '</span>' : ''}${m.active === false ? ' · inactive' : ''}</div></div>${S.canWrite && isAdmin() ? `<button class="btn sm" data-act="edit-member" data-id="${esc(m.id)}">${icon('edit')}Edit</button>` : ''}</div>${loginRowHTML(m)}
      <div class="task-f" style="font-size:12.5px;color:var(--ink-2)">This week: ${l.length ? actTypes().map((tp) => { const n = l.filter((a) => a.type === tp.id).length; return n ? `<span><b>${n}</b> ${tp.name.toLowerCase()}${n > 1 && tp.id !== 'fabrication' ? 's' : ''}</span>` : ''; }).filter(Boolean).join(' · ') : 'nothing scheduled'}</div></article>`; }).join('')}</div>`
      : `<div class="card"><div class="empty"><b>No team yet.</b><span>Add the people who quote, template, fabricate and install.</span>${S.canWrite && isAdmin() ? '<button class="btn primary" data-act="edit-member">Add first team member</button>' : ''}</div></div>`}`,
  };
};

/* ---------- Settings ---------- */
function ensureSDraft() { if (!S.sdraft) S.sdraft = { ...deepClone(cfg()), _dirty: false }; return S.sdraft; }
VIEWS.settings = () => {
  if (S.sdraft && !S.sdraft._dirty) S.sdraft = null;
  const s = ensureSDraft();
  const W = S.canWrite && isAdmin();
  const dis = W ? '' : 'disabled';
  const f = (k, label, type = 'text', hint = '', cls = '') => `<label class="field"><span>${label}</span><input class="input ${cls}" id="s-${k}" type="${type === 'num' ? 'text' : type}" ${type === 'num' ? 'inputmode="decimal"' : ''} value="${esc(s[k] ?? '')}" data-s="${k}" data-t="${type}" ${dis}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const mats = `<div class="ptable"><div class="prow head"><span></span><span>Material</span><span class="grp">Group</span><span style="text-align:right">$ / sq ft</span><span></span></div>
    ${s.materials.map((m, i) => `<div class="prow"><input type="color" class="input" id="sm-c-${i}" value="${esc(m.color || '#cccccc')}" data-sl="materials" data-i="${i}" data-f="color" aria-label="Color" ${dis}><input class="input" id="sm-n-${i}" value="${esc(m.name)}" data-sl="materials" data-i="${i}" data-f="name" aria-label="Material name" ${dis}><input class="input grp" id="sm-g-${i}" value="${esc(m.group || '')}" data-sl="materials" data-i="${i}" data-f="group" aria-label="Group" list="groups" ${dis}><input class="input mono right" id="sm-p-${i}" inputmode="decimal" value="${esc(m.price)}" data-sl="materials" data-i="${i}" data-f="price" data-t="num" aria-label="Price per square foot" ${dis}><button class="btn icon ghost" data-act="s-del" data-l="materials" data-i="${i}" aria-label="Remove" ${dis}>${icon('trash')}</button></div>`).join('')}
    <datalist id="groups">${['Granite', 'Quartz', 'Quartzite', 'Marble', 'Porcelain', 'Solid surface', 'Soapstone', 'Remnant'].map((g) => `<option value="${g}">`).join('')}</datalist>
    ${W ? `<div><button class="btn sm" data-act="s-add" data-l="materials">${icon('plus')}Add material</button></div>` : ''}</div>`;
  const simple = (key, unit, label) => `<div class="ptable"><div class="prow e head"><span>${label}</span><span style="text-align:right">${unit}</span><span></span></div>
    ${s[key].map((x, i) => `<div class="prow e"><input class="input" id="s${key}-n-${i}" value="${esc(x.name)}" data-sl="${key}" data-i="${i}" data-f="name" aria-label="Name" ${dis}><input class="input mono right" id="s${key}-p-${i}" inputmode="decimal" value="${esc(x.price)}" data-sl="${key}" data-i="${i}" data-f="price" data-t="num" aria-label="Price" ${dis}><button class="btn icon ghost" data-act="s-del" data-l="${key}" data-i="${i}" aria-label="Remove" ${dis}>${icon('trash')}</button></div>`).join('')}
    ${W ? `<div><button class="btn sm" data-act="s-add" data-l="${key}">${icon('plus')}Add</button></div>` : ''}</div>`;
  const saveBar = W ? `<span id="s-dirty" class="faint" style="font-size:12.5px;white-space:nowrap">${s._dirty ? '<span class="dirty-dot"></span> Unsaved' : ''}</span><button class="btn primary" data-act="s-save">${icon('check')}Save</button>` : '';
  return {
    title: 'Prices & Settings', noNew: true, actions: saveBar,
    body: `<div class="cols">
      <div class="stack">
        <div class="card"><div class="card-h"><h2>Materials</h2><span class="faint">Fabricated & installed price</span></div><div class="card-b">${mats}</div></div>
        <div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">
          <div class="card"><div class="card-h"><h2>Edge profiles</h2></div><div class="card-b">${simple('edges', '$ / LF', 'Profile')}</div></div>
          <div class="card"><div class="card-h"><h2>Cutouts & sinks</h2></div><div class="card-b">${simple('addons', '$ each', 'Item')}</div></div>
        </div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h2>Your shop</h2><span class="faint">Prints on quotes</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px"><div class="field"><span>Logo</span><div class="logo-row">${safeImg(s.logo) ? `<img class="gs-logo" src="${safeImg(s.logo)}" alt="Shop logo">` : '<span class="logo-empty">No logo</span>'}${W ? `<label class="btn sm">Upload<input type="file" accept="image/*" class="sr" data-upload="logo"></label><button class="btn sm ghost" data-act="logo-import">Use Midwest Surfaces logo</button>${safeImg(s.logo) ? '<button class="btn sm ghost" data-act="logo-remove">Remove</button>' : ''}` : ''}</div><small>PNG with a clear background looks best. It shows in the menu and on quotes.</small></div>${f('shopName', 'Shop name')}${f('shopPhone', 'Phone')}${f('shopEmail', 'Email', 'text', 'Not listed on mwsurfaces.com — add the office email')}${f('shopAddress', 'Address')}${f('shopHours', 'Showroom hours')}${f('shopWeb', 'Website')}</div></div>
        <div class="card"><div class="card-h"><h2>Quote defaults</h2></div><div class="card-b grid2">${f('taxRate', 'Sales tax %', 'num', '', 'mono right')}${f('depositPct', 'Deposit %', 'num', 'Before work begins', 'mono right')}${f('payInFullUnder', 'Pay in full if under $', 'num', 'Before field measure', 'mono right')}${f('minCharge', 'Minimum job $', 'num', 'Small jobs are rounded up to this', 'mono right')}${f('tearOutPerSqft', 'Tear-out $ / sq ft', 'num', '', 'mono right')}${f('quoteValidDays', 'Quotes good for (days)', 'num', '', 'mono right')}</div></div>
        <div class="card"><div class="card-h"><h2>Proposal wording</h2><span class="faint">From your proposal form</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
          <label class="field"><span>Opening paragraph (under the customer name)</span><textarea class="input" id="s-proposalIntro" data-s="proposalIntro" style="min-height:110px;font-size:12.5px" ${dis}>${esc(s.proposalIntro || '')}</textarea><small>Prints above the countertop areas.</small></label>
          <label class="field"><span>Acceptance of proposal (above the signature)</span><textarea class="input" id="s-acceptText" data-s="acceptText" style="min-height:130px;font-size:12.5px" ${dis}>${esc(s.acceptText || '')}</textarea><small>Includes the 3-day cancellation notice.</small></label>
          <label class="field"><span>Terms and conditions</span><textarea class="input" id="s-quoteTerms" data-s="quoteTerms" style="min-height:220px;font-size:12.5px" ${dis}>${esc(s.quoteTerms || '')}</textarea><small>Prints on its own page in two columns. Short lines without a period print as headings; start a line with • for a bullet.</small></label>
          <label class="field"><span>What to expect at your measure and installation</span><textarea class="input" id="s-expectText" data-s="expectText" style="min-height:220px;font-size:12.5px" ${dis}>${esc(s.expectText || '')}</textarea><small>Prints as the last page of every proposal. Leave empty to skip that page.</small></label>
        </div></div>
        <div class="card"><div class="card-h"><h2>Activity types</h2><span class="faint">Shown on the calendar</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
          <div class="btn-row">${BASE_ACT_TYPES.map((t) => `<span class="chip"><i style="background:${t.color}"></i>${t.name}</span>`).join('')}</div>
          <div class="ptable">${(s.activityTypes || []).map((t, i) => `<div class="prow e" style="grid-template-columns:30px minmax(120px,1fr) 34px"><input type="color" class="input" id="sat-c-${i}" value="${esc(isHex(t.color) ? t.color : '#68716D')}" data-sl="activityTypes" data-i="${i}" data-f="color" aria-label="Color" ${dis}><input class="input" id="sat-n-${i}" value="${esc(t.name || '')}" placeholder="Saw, CNC, Polish, Delivery, Invoice…" data-sl="activityTypes" data-i="${i}" data-f="name" aria-label="Activity type name" ${dis}><button class="btn icon ghost" data-act="s-del" data-l="activityTypes" data-i="${i}" aria-label="Remove" ${dis}>${icon('trash')}</button></div>`).join('')}
          ${W ? `<div><button class="btn sm" data-act="s-add" data-l="activityTypes">${icon('plus')}Add activity type</button></div>` : ''}</div>
          <small class="faint">Add your own steps, like Saw, CNC, Polish or Delivery. The five standard types can’t be removed.</small></div></div>
        <div class="card"><div class="card-h"><h2>Slabs & capacity</h2></div><div class="card-b grid2">${f('slabL', 'Slab length (in)', 'num', 'Standard 126, jumbo 130', 'mono right')}${f('slabW', 'Slab width (in)', 'num', 'Standard 63, jumbo 65–79', 'mono right')}${f('capInstallSqft', 'Install sq ft per day', 'num', 'Fills the calendar capacity bar', 'mono right')}${f('capTemplates', 'Templates per day', 'num', '', 'mono right')}</div></div>
        <div class="card"><div class="card-h"><h2>Data</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
          <div class="muted" style="font-size:13px">${S.mode === 'db' ? 'Your shop data is saved in your Supabase database and shared live with everyone who has a login.' : 'Demo mode: data lives in this browser only.'}</div>
          ${!W && S.mode === 'db' ? '<div class="faint" style="font-size:12.5px">Only the owner or office can change prices and settings.</div>' : ''}
          ${W ? `<div class="banner" style="font-size:12.5px"><span>Starter prices are placeholders. Edges and sinks match mwsurfaces.com, but the website doesn’t list prices, so set the real ones above.</span><button class="btn sm" data-act="s-restore">Restore Midwest Surfaces catalog</button></div>` : ''}
          <div class="btn-row">${W ? (hasSample() ? '<button class="btn danger" data-act="remove-sample">Remove sample data</button>' : '<button class="btn" data-act="load-sample">Load sample shop</button>') : ''}<button class="btn" data-act="export-csv">${icon('download')}Export jobs (.csv)</button>${S.mode === 'local' ? '<button class="btn ghost" data-act="reset-local">Reset demo</button>' : ''}</div>
        </div></div>
      </div></div>`,
  };
};
