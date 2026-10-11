/* =========================================================
   Dashboard, Jobs board/list, Job page
   ========================================================= */
const demoTag = (x) => (x && x.demo ? '<span class="tag demo">SAMPLE</span>' : '');

const gsKey = () => 'kerf-gs-hidden-' + (S.shopId || 'demo');
function gettingStartedHTML(full) {
  if (!isAdmin()) return '';
  if (!full && store.get(gsKey(), false)) return '';
  const c = cfg();
  const hasLogo = !!safeImg(c.logo);
  const pricesSet = !!(S.settingsDoc && Array.isArray(S.settingsDoc.materials));
  const crewIn = S.mode === 'db' ? Array.from(S.members.values()).filter((m) => m.status === 'active').length > 1 : S.team.size > 1;
  const triedSample = hasSample() || allJobs().length > 0;
  const steps = [hasLogo, pricesSet, crewIn, triedSample];
  if (!full && steps.every(Boolean)) return '';
  const done = steps.filter(Boolean).length;
  const step = (ok, n, title, text, actions, extra = '') => `<li class="gs-step ${ok ? 'ok' : ''} ${extra}"><span class="gs-n">${ok ? icon('check') : n}</span><div class="gs-body"><b>${title}</b><span class="muted">${text}</span>${actions ? `<div class="btn-row" style="margin-top:8px">${actions}</div>` : ''}</div></li>`;
  const code = S.mode === 'db' && S.shop ? S.shop.join_code : '';
  return `<section class="card gs ${full ? 'gs-full' : ''}"><div class="card-h"><h2>Get your shop set up</h2><span class="faint">${done} of 4 done</span>${full ? '' : `<button class="btn sm ghost" data-act="gs-hide" aria-label="Hide this guide">${icon('close')}</button>`}</div>
    <ol class="gs-list">
      ${step(triedSample, 1, 'Explore with the sample shop', 'Loads a dozen realistic jobs, a crew and a full week on the calendar so you can click around before entering real work. Remove it any time in Settings.', S.canWrite && !hasSample() ? `<button class="btn primary glow" data-act="load-sample">${icon('board')}Load sample shop</button><span class="tag demo">Recommended</span>` : (hasSample() ? '<span class="tag ok">Sample shop loaded</span>' : ''), triedSample ? '' : 'gs-hot')}
      ${step(hasLogo, 2, 'Add your logo', 'It shows in the menu and on every customer quote.', hasLogo ? `<img class="gs-logo" src="${safeImg(c.logo)}" alt="Your logo">` : `<label class="btn">${icon('download', 'style="transform:rotate(180deg)"')}Upload logo<input type="file" accept="image/*" class="sr" data-upload="logo"></label>`)}
      ${step(pricesSet, 3, 'Check your prices', 'Materials per square foot, edges, cutouts and sinks. Starter prices are filled in.', `<button class="btn" data-act="go" data-view="settings">${icon('tag')}Open prices</button>`)}
      ${step(crewIn, 4, 'Invite your crew', code ? `Text them your shop code. They tap <b>New to the team?</b> on the website and you approve them. The code always lives at the top of the <b>Team</b> page.` : 'Add your team on the Team page.', code ? `<span class="shopcode sm mono" style="user-select:all">${esc(code)}</span><button class="btn" data-act="copy-code">${icon('copy')}Copy invite</button><button class="btn ghost" data-act="go" data-view="team">Go to Team</button>` : `<button class="btn" data-act="go" data-view="team">Go to Team</button>`)}
    </ol></section>`;
}
function welcomeHTML() {
  return `<div class="welcome">
    <div class="card"><div class="card-h"><h2>Set up your shop</h2></div><div class="card-b">
      <p class="muted" style="margin:0">This runs quoting, scheduling and the job board for the whole Midwest Surfaces crew. Three steps and you’re live:</p>
      <ol><li><b>Check your prices.</b> Materials per sq ft, edge profiles, cutouts and sinks.</li><li><b>Add your team.</b> Sales, templaters, fabricators and install crews.</li><li><b>Write your first quote.</b> Measure in inches, Kerf does the square feet, slabs and total.</li></ol>
      <div class="btn-row">${S.canWrite ? `<button class="btn primary" data-act="new-job">${icon('plus')}Write first quote</button>` : ''}<button class="btn" data-act="go" data-view="settings">Check prices</button><button class="btn" data-act="go" data-view="team">Add team</button></div>
    </div></div>
    <div class="card"><div class="card-h"><h2>Want to look around first?</h2></div><div class="card-b">
      <p class="muted" style="margin:0">Load a sample shop with a dozen jobs at every stage, a crew, and a full week on the calendar. Every sample item is tagged and can be removed in one click.</p>
      <div class="btn-row">${S.canWrite && isAdmin() ? '<button class="btn dark" data-act="load-sample">Load sample shop</button>' : '<span class="faint">Ask the owner to load it.</span>'}</div>
    </div></div>
  </div>`;
}

function sparkBars(vals) {
  const max = Math.max(1, ...vals);
  const w = 100 / vals.length;
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${vals.map((v, i) => {
    const h = Math.max(1.5, (v / max) * 28);
    const last = i === vals.length - 1;
    return `<rect x="${i * w + 1}" y="${30 - h}" width="${w - 2}" height="${h}" rx="1" fill="${last ? 'var(--accent)' : 'var(--line-2)'}"/>`;
  }).join('')}</svg>`;
}

function actRowHTML(a, opts = {}) {
  const j = jobOf(a.jobId);
  const t = actType(a.type);
  const crew = (a.crew || []).map(member).filter(Boolean);
  return `<button class="row" data-act="edit-act" data-id="${esc(a.id)}">
    <span class="stripe" style="--c:${t.color}"></span>
    ${opts.date ? `<span class="datebox"><b>${parseD(a.date).getDate()}</b><span>${DOW[parseD(a.date).getDay()]}</span></span>` : ''}
    <span class="grow"><span class="t1">${esc(t.name)}${a.time ? ` · <span class="mono">${fmtTime(a.time)}</span>` : ''} — ${esc(j ? j.name : 'Job removed')}</span>
      <span class="t2"><span class="mono">${esc(j ? j.number : '')}</span> · ${esc(j ? (customer(j.customerId) || {}).name || '' : '')}${j && j.sqft ? ` · ${sqft1(j.sqft)} sq ft` : ''}</span></span>
    <span class="avatars">${crew.map((m) => avatar(m)).join('')}</span>
    ${a.status === 'done' ? '<span class="tag ok">Done</span>' : ''}
  </button>`;
}

/* Home: the week's schedule and the live job board come first, numbers after */
function boardHTML(jobs, { stages = STAGES, max = Infinity, keep = 'board' } = {}) {
  const cols = stages.map((s) => ({ s, list: sortForColumn(jobs.filter((j) => j.stage === s.id)) }));
  return `<div class="board" data-keep-scroll="${keep}">${cols.map(({ s, list }) => `
    <section class="col" data-drop-stage="${s.id}" aria-label="${esc(s.name)}">
      <div class="col-h" style="--c:${stageColor(s.id)}"><h3>${esc(s.short || s.name)} <span class="faint num">${list.length}</span></h3><span class="sum">${isCrew() ? '' : moneyK(sum(list, (j) => j.total))}</span></div>
      ${list.slice(0, max).map(jobCardHTML).join('') || `<div class="faint" style="font-size:12px;padding:8px 6px">${esc(STAGE_HINT[s.id])}</div>`}
      ${list.length > max ? `<button class="btn sm ghost more-btn" data-act="go" data-view="jobs">+${list.length - max} more</button>` : ''}
    </section>`).join('')}</div>`;
}
function dashWeekHTML() {
  const t = today();
  const days = [];
  for (let i = 0; days.length < 7 && i < 10; i++) {
    const d = addDays(t, i);
    if (parseD(d).getDay() === 0 && !actsOnDate(d).length) continue; // skip empty Sundays
    days.push(d);
  }
  return `<div class="weekwrap" data-keep-scroll="dashweek"><div class="week compact">${days.map((d) => {
    const list = actsOnDate(d);
    return `<section class="day ${d === t ? 'today' : ''} ${isWeekend(d) ? 'weekend' : ''}" data-drop-date="${d}" aria-label="${fmtD(d)}">
      <div class="day-h"><div class="d"><b>${parseD(d).getDate()}</b><span>${d === t ? 'Today' : d === addDays(t, 1) ? 'Tomorrow' : DOW[parseD(d).getDay()]}</span>${S.canWrite && !isCrew() ? `<button class="btn icon sm ghost add" data-act="new-act" data-date="${d}" aria-label="Schedule on ${fmtD(d)}">${icon('plus')}</button>` : ''}</div>${capacityHTML(d, list)}</div>
      <div class="day-b">${list.length ? list.map(actBlockHTML).join('') : '<span class="faint" style="font-size:12px;padding:4px 2px">Open</span>'}</div></section>`;
  }).join('')}</div></div>`;
}
VIEWS.dashboard = () => {
  const jobs = allJobs();
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const mStart = parseD(t.slice(0, 8) + '01').getTime();
  const live = jobs.filter((j) => j.stage !== 'lost');
  const soldM = live.filter((j) => j.soldAt && j.soldAt >= mStart);
  const open = jobs.filter((j) => j.stage === 'quoted');
  const prod = jobs.filter((j) => ['sold', 'templated', 'fabrication'].includes(j.stage));
  const acts = Array.from(S.activities.values());
  const instWeek = acts.filter((a) => a.type === 'install' && a.date >= ws && a.date <= we);
  const instSqft = sum(instWeek, (a) => (jobOf(a.jobId) || {}).sqft);
  const weeks = [];
  for (let i = 9; i >= 0; i--) {
    const s0 = parseD(addDays(ws, -7 * i)).getTime(), e = s0 + 7 * 86400000;
    weeks.push(sum(live.filter((j) => j.soldAt >= s0 && j.soldAt < e), (j) => j.total));
  }
  const d90 = Date.now() - 90 * 86400000;
  const decided = jobs.filter((j) => (j.soldAt && j.soldAt >= d90) || (j.stage === 'lost' && (j.lostAt || j.updatedAt) >= d90));
  const won = decided.filter((j) => j.stage !== 'lost').length;
  const closeRate = decided.length ? Math.round((won / decided.length) * 100) : null;
  const owed = sum(jobs.filter((j) => j.stage === 'installed'), balanceOf);

  const W = S.canWrite && !isCrew();
  const schedule = `<section class="dash-sec"><div class="sec-h"><h2>Schedule</h2><span class="faint">Next 7 days · drag to reschedule</span>
      <div class="btn-row" style="margin-left:auto">${W ? `<button class="btn sm" data-act="new-act">${icon('plus')}Schedule</button>` : ''}<button class="btn sm" data-act="go" data-view="calendar">${icon('cal')}Full calendar</button></div></div>
    ${dashWeekHTML()}</section>`;

  const activeStages = STAGES.filter((s) => s.id !== 'closed');
  const activeJobs = jobs.filter((j) => j.stage !== 'lost' && j.stage !== 'closed');
  const board = `<section class="dash-sec"><div class="sec-h"><h2>Jobs</h2><span class="faint">${activeJobs.length} active · ${money(sum(activeJobs, (j) => j.total))} · drag to change stage</span>
      <div class="btn-row" style="margin-left:auto">${W ? `<button class="btn sm primary" data-act="new-job">${icon('plus')}New quote</button>` : ''}<button class="btn sm" data-act="go" data-view="jobs">${icon('board')}All jobs</button></div></div>
    ${jobs.length ? boardHTML(activeJobs, { stages: activeStages, max: 6, keep: 'dashboard' }) : `<div class="card"><div class="empty"><b>No jobs yet.</b><span>Tap New quote to start the first one.</span>${S.canWrite && isAdmin() ? '<button class="btn" data-act="load-sample">Or load the sample shop to look around</button>' : ''}</div></div>`}</section>`;

  const att = jobs.map((j) => ({ j, a: attention(j) })).filter((x) => x.a.length).sort((x, y) => (y.a.some((z) => z.level === 'bad') - x.a.some((z) => z.level === 'bad')) || (y.j.total || 0) - (x.j.total || 0));
  const attn = `<div class="card"><div class="card-h"><h2>Needs attention</h2><span class="faint">${att.length}</span></div><div class="rows">${att.length ? att.slice(0, 8).map(({ j, a }) => `
    <button class="row" data-act="go" data-view="job" data-id="${esc(j.id)}"><span class="stripe" style="--c:${a.some((z) => z.level === 'bad') ? 'var(--bad)' : 'var(--warn)'}"></span>
    <span class="grow"><span class="t1">${esc(a[0].text)}${a.length > 1 ? ` <span class="faint">+${a.length - 1} more</span>` : ''}</span><span class="t2"><span class="mono">${esc(j.number)}</span> · ${esc(j.name)} · ${esc((customer(j.customerId) || {}).name || '')}</span></span>
    ${stagePill(j.stage)}</button>`).join('') : '<div class="empty"><b>All clear.</b><span>Nothing is stuck right now.</span></div>'}</div></div>`;

  const feed = feedList().slice(0, 10);
  const feedHTML = `<div class="card"><div class="card-h"><h2>Recent activity</h2></div><div class="rows">${feed.length ? feed.map((n) => {
    const j = jobOf(n.jobId); const m = member(n.by);
    return `<button class="row" ${j ? `data-act="go" data-view="job" data-id="${esc(j.id)}"` : ''}>${m ? avatar(m) : '<span class="avatar" style="--c:var(--ink-3)">·</span>'}
      <span class="grow"><span class="t2" style="white-space:normal;color:var(--ink)">${n.kind === 'issue' ? '<span class="tag bad">Issue</span> ' : ''}${esc(n.text)}</span><span class="t2">${j ? `<span class="mono">${esc(j.number)}</span> · ${esc(j.name)} · ` : ''}${ago(n.at)}</span></span></button>`;
  }).join('') : '<div class="empty">Updates from the crew show up here.</div>'}</div></div>`;

  const kpis = isCrew() ? '' : `<section class="dash-sec"><div class="sec-h"><h2>Numbers</h2></div><div class="kpis">
    <button class="kpi" data-act="go" data-view="jobs"><span class="label">Sold this month</span><span class="value">${money(sum(soldM, (j) => j.total))}</span><span class="sub">${soldM.length} job${soldM.length === 1 ? '' : 's'} · last 10 weeks</span>${sparkBars(weeks)}</button>
    <button class="kpi" data-act="go" data-view="jobs"><span class="label">Open quotes</span><span class="value">${money(sum(open, (j) => j.total))}</span><span class="sub">${open.length} out for decision${closeRate != null ? ` · ${closeRate}% close rate (90 days)` : ''}</span></button>
    <button class="kpi" data-act="go" data-view="calendar"><span class="label">Installs this week</span><span class="value">${instWeek.length}</span><span class="sub">${sqft1(instSqft)} sq ft · ${instWeek.filter((a) => a.status === 'done').length} done</span></button>
    <button class="kpi" data-act="go" data-view="jobs"><span class="label">In production</span><span class="value">${prod.length}</span><span class="sub">${sqft1(sum(prod, (j) => j.sqft))} sq ft · ${money(owed)} owed on installed jobs</span></button>
  </div></section>`;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const me = member(S.me);
  return {
    title: `${greet}${me ? ', ' + esc(me.name.split(' ')[0]) : ''}`,
    crumb: esc(shopName() + ' · ' + fmtD(t)),
    body: `${schedule}${board}<div class="cols"><div class="stack">${attn}</div><div class="stack">${feedHTML}</div></div>${kpis}`,
  };
};

/* ---------- Jobs ---------- */
function jobMatches(j, q) {
  if (!q) return true;
  const c = customer(j.customerId) || {};
  const hay = [j.number, j.name, j.address, c.name, c.phone, j.material].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}
function filteredJobs() {
  const { jobQ, jobSales, jobShow } = S.ui;
  const recent = Date.now() - 30 * 86400000;
  return allJobs().filter((j) => {
    if (!jobMatches(j, jobQ)) return false;
    if (jobSales && j.salesId !== jobSales) return false;
    if (jobShow === 'active' && (j.stage === 'lost' || (j.stage === 'closed' && (j.closedAt || j.updatedAt || 0) < recent))) return false;
    if (jobShow === 'lost' && j.stage !== 'lost') return false;
    return true;
  });
}
function jobCardHTML(j) {
  const c = customer(j.customerId) || {};
  const na = nextAct(j.id);
  const sales = member(j.salesId);
  const att = attention(j);
  return `<div class="jcard" draggable="${S.canWrite}" data-drag-job="${esc(j.id)}" data-act="go" data-view="job" data-id="${esc(j.id)}" tabindex="0" role="button" aria-label="${esc(j.number + ' ' + j.name)}">
    ${att.length ? `<span class="flag" title="${esc(att.map((a) => a.text).join(' · '))}"></span>` : ''}
    <div class="top"><span class="jn">${esc(j.number)}</span>${demoTag(j)}<span class="amt">${j.total ? money(j.total) : '<span class="faint">No quote</span>'}</span></div>
    <div class="name">${esc(j.name)}</div>
    <div class="meta">${esc(c.name || '')}</div>
    ${j.material ? `<div class="meta"><span class="swatch" style="background:${esc(j.materialColor || '#ccc')}"></span><span>${esc(j.material)}</span>${j.sqft ? `<span class="faint">· ${sqft1(j.sqft)} ft²</span>` : ''}</div>` : ''}
    <div class="foot">${(() => { const nf = filesForJob(j.id).length; return nf ? `<span class="tag" title="${nf} file${nf === 1 ? '' : 's'}">${icon('clip', 'class="tagicon"')}${nf}</span>` : ''; })()}${na ? `<span class="tag" style="background:color-mix(in srgb,${actType(na.type).color} 14%,transparent);color:${actType(na.type).color}">${esc(actType(na.type).name)} ${relDay(na.date)}</span>` : att.length ? `<span class="tag ${att[0].level}">${esc(att[0].text.split(' — ')[0])}</span>` : ''}<span style="margin-left:auto">${sales ? avatar(sales) : ''}</span></div>
  </div>`;
}
function sortForColumn(list) {
  return list.sort((a, b) => {
    const na = nextAct(a.id), nb = nextAct(b.id);
    if (na && nb) return na.date.localeCompare(nb.date);
    if (na) return -1; if (nb) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
VIEWS.jobs = () => {
  const jobs = filteredJobs();
  const team = activeTeam();
  const u = S.ui;
  const toolbar = `<div class="toolbar">
    <input class="input search" id="job-q" type="search" placeholder="Search job #, name, customer, phone" value="${esc(u.jobQ)}" data-input="jobQ" aria-label="Search jobs">
    <select class="input" id="job-sales" data-change="jobSales" aria-label="Salesperson"><option value="">Everyone</option>${team.map((m) => `<option value="${esc(m.id)}" ${u.jobSales === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    <div class="seg" role="group" aria-label="Show">${[['active', 'Active'], ['all', 'All'], ['lost', 'Lost']].map(([k, l]) => `<button data-act="ui" data-k="jobShow" data-v="${k}" aria-pressed="${u.jobShow === k}">${l}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Layout" style="margin-left:auto">${[['board', 'Board'], ['list', 'List']].map(([k, l]) => `<button data-act="ui" data-k="jobMode" data-v="${k}" aria-pressed="${u.jobMode === k}">${l}</button>`).join('')}</div>
  </div>`;
  let body;
  if (u.jobMode === 'list' || u.jobShow === 'lost') {
    const { k, d } = u.jobSort;
    const val = (j) => ({ number: j.number, name: j.name, customer: (customer(j.customerId) || {}).name || '', stage: stageIdx(j.stage), total: j.total || 0, balance: balanceOf(j), sqft: j.sqft || 0, next: (nextAct(j.id) || {}).date || '9999', updatedAt: j.updatedAt || 0 })[k];
    const sorted = jobs.slice().sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * d; });
    const th = (key, label, r = false) => `<th class="${r ? 'r' : ''}"><button data-act="sort" data-k="${key}">${label}${k === key ? (d > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
    body = `<div class="card"><div class="tablewrap"><table class="t"><thead><tr>${th('number', 'Job')}${th('name', 'Name')}${th('customer', 'Customer')}${th('stage', 'Stage')}<th>Material</th>${th('sqft', 'Sq ft', true)}${th('total', 'Total', true)}${th('balance', 'Balance', true)}${th('next', 'Next')}<th>Sales</th>${th('updatedAt', 'Updated')}</tr></thead><tbody>
      ${sorted.map((j) => { const na = nextAct(j.id); return `<tr class="click" data-act="go" data-view="job" data-id="${esc(j.id)}"><td class="mono">${esc(j.number)} ${demoTag(j)}</td><td class="wrap"><b>${esc(j.name)}</b></td><td>${esc((customer(j.customerId) || {}).name || '')}</td><td>${stagePill(j.stage)}</td><td>${j.material ? `<span style="display:inline-flex;gap:6px;align-items:center"><span class="swatch" style="background:${esc(j.materialColor || '#ccc')}"></span>${esc(j.material)}</span>` : '<span class="faint">—</span>'}</td><td class="r">${j.sqft ? sqft1(j.sqft) : '—'}</td><td class="r">${j.total ? money(j.total) : '—'}</td><td class="r">${j.total ? money(balanceOf(j)) : '—'}</td><td>${na ? `${esc(actType(na.type).name)} ${relDay(na.date)}` : '<span class="faint">—</span>'}</td><td>${avatar(member(j.salesId))}</td><td class="faint">${ago(j.updatedAt)}</td></tr>`; }).join('') || `<tr><td colspan="11"><div class="empty">No jobs match.</div></td></tr>`}
    </tbody></table></div></div>`;
  } else {
    body = boardHTML(jobs);
  }
  return { title: 'Jobs', body: toolbar + body };
};

/* ---------- Job page ---------- */
VIEWS.job = ({ id }) => {
  const j = jobOf(id);
  if (!j) return { title: 'Job not found', back: { view: 'jobs' }, body: `<div class="card"><div class="empty"><b>This job was deleted or hasn’t loaded.</b><button class="btn" data-act="go" data-view="jobs">Back to jobs</button></div></div>` };
  const c = customer(j.customerId) || {};
  const acts = actsForJob(j.id);
  const att = attention(j);
  const q = j.quote;
  const calc = q ? calcQuote(q) : null;
  const sales = member(j.salesId);
  const curIdx = stageIdx(j.stage);
  const C = isCrew();
  const W = S.canWrite && !C;
  const WN = S.canWrite;

  const stepper = `<div class="stepper" role="group" aria-label="Job stage">${STAGES.map((s, i) => {
    const cls = j.stage === s.id ? 'current' : curIdx > i ? 'done' : '';
    return `<button class="step ${cls}" style="--c:${stageColor(s.id)}" ${W ? `data-act="stage" data-stage="${s.id}"` : 'disabled'}><small>${i + 1}</small>${esc(s.short || s.name)}</button>`;
  }).join('')}</div>`;

  const attHTML = att.length ? `<div class="banner" style="background:${att.some((a) => a.level === 'bad') ? 'var(--bad-soft)' : 'var(--warn-soft)'}">${att.map((a) => `<span>• ${esc(a.text)}</span>`).join('')}</div>` : '';

  const quoteCard = `<div class="card"><div class="card-h"><h2>${C ? 'Stone & pieces' : 'Quote'}</h2>${q && !C ? `<button class="btn sm" data-act="quote-doc" data-id="${esc(j.id)}">${icon('doc')}Customer copy</button>` : ''}${W ? `<button class="btn sm ${q ? '' : 'primary'}" data-act="go" data-view="quote" data-id="${esc(j.id)}">${icon('ruler')}${q ? 'Edit quote' : 'Build quote'}</button>` : ''}</div>
    ${q ? `<div class="rows">${q.areas.map((a, i) => `<div class="row"><span class="swatch" style="background:${esc(a.mat ? a.mat.color : '#ccc')}"></span><span class="grow"><span class="t1">${esc(a.name)}</span><span class="t2">${esc(a.mat ? a.mat.name : '')}${a.thick ? ' · ' + esc(a.thick) : ''} · ${esc(a.edge ? a.edge.name : '')} edge${(a.addons || []).filter((x) => x.count).length ? ' · ' + esc((a.addons || []).filter((x) => x.count).map((x) => (x.count > 1 ? x.count + '× ' : '') + x.name).join(', ')) : ''}</span></span><span class="right num">${C ? '' : `<b>${money(calc.areas[i].total)}</b><br>`}<span class="faint">${sqft1(calc.areas[i].sqft)} ft²</span></span></div>`).join('')}</div>
      <div class="card-b" style="border-top:1px solid var(--line)"><div class="qstats"><div><b>${sqft1(calc.sqft)}</b><span>SQ FT</span></div><div><b>${calc.nest.slabs}</b><span>SLAB${calc.nest.slabs === 1 ? '' : 'S'} EST.</span></div><div><b>${calc.nest.seams}</b><span>SEAM${calc.nest.seams === 1 ? '' : 'S'}</span></div></div></div>`
      : `<div class="empty"><b>No quote yet.</b><span>${C ? 'The office hasn’t priced this job yet.' : 'Measure in inches, pick the stone, and it prices itself as you type.'}</span></div>`}
  </div>`;

  const schedCard = `<div class="card"><div class="card-h"><h2>Schedule</h2></div>
    <div class="rows">${acts.length ? acts.map((a) => actRowHTML(a, { date: true })).join('') : '<div class="empty">Nothing scheduled yet.</div>'}</div>
    ${W ? `<div class="card-b btn-row" style="border-top:1px solid var(--line)">${actTypes().filter((t) => t.id !== 'other').slice(0, 8).map((t) => `<button class="btn sm" data-act="new-act" data-job="${esc(j.id)}" data-type="${t.id}">${icon('plus')}${t.name}</button>`).join('')}</div>` : ''}
  </div>`;

  const notes = notesForJob(j.id);
  const notesCard = `<div class="card"><div class="card-h"><h2>Notes & history</h2><span class="faint">${notes.length}</span></div>
    ${WN ? `<div class="composer" style="border-top:0;border-bottom:1px solid var(--line)"><div style="flex:1;display:flex;flex-direction:column;gap:6px"><textarea class="input" id="note-text" data-input="noteDraft" placeholder="Add a note for the crew or office…">${esc(S.ui.noteDraft)}</textarea><label class="check" style="font-size:12.5px"><input type="checkbox" id="note-issue" data-change="noteIssue" ${S.ui.noteIssue ? 'checked' : ''}> Flag as an issue</label></div><button class="btn dark" data-act="add-note" data-id="${esc(j.id)}">Add</button></div>` : ''}
    <div class="notes">${notes.length ? notes.map((n) => { const m = member(n.by); return `<div class="note ${n.kind}">${m ? avatar(m) : '<span class="avatar" style="--c:var(--ink-3)">·</span>'}<div class="body"><div class="who">${esc(m ? m.name : 'Someone')} · ${ago(n.at)}${n.kind === 'issue' ? ' · <span class="tag bad">Issue</span>' : ''}</div><div class="txt">${esc(n.text)}</div></div></div>`; }).join('') : `<div class="empty">${S.mode === 'db' && S.jobNotesFor !== j.id ? 'Loading…' : 'No notes yet.'}</div>`}</div>
  </div>`;

  const paid = paidOf(j), bal = balanceOf(j);
  const pct = j.total ? clamp((paid / j.total) * 100, 0, 100) : 0;
  const moneyCard = `<div class="card"><div class="card-h"><h2>Money</h2>${W && j.total ? `<button class="btn sm" data-act="pay" data-id="${esc(j.id)}">${icon('cash')}Record payment</button>` : ''}</div><div class="card-b money">
    <div class="line"><span class="muted">Contract total</span><b>${money2(j.total || 0)}</b></div>
    <div class="line"><span class="muted">Paid</span><span>${money2(paid)}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="line big"><span>Balance</span><span>${money2(bal)}</span></div>
    ${(j.payments || []).length ? `<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${j.payments.map((p) => `<div class="line" style="font-size:12.5px"><span class="faint">${esc(fmtDshort(p.date))} · ${esc(p.method)}${p.note ? ' · ' + esc(p.note) : ''}</span><span>${money2(p.amount)}</span></div>`).join('')}</div>` : ''}
  </div></div>`;

  const custCard = `<div class="card"><div class="card-h"><h2>Account</h2>${C ? '' : `<button class="btn sm" data-act="go" data-view="customer" data-id="${esc(c.id || '')}">Open</button>`}</div><div class="card-b" style="display:flex;flex-direction:column;gap:8px">
    <div><b style="font-size:15px">${esc(c.name || 'No customer')}</b> ${c.type ? `<span class="tag">${esc(c.type)}</span>` : ''}</div>
    ${c.phone ? `<div style="display:flex;gap:8px;align-items:center"><span class="mono" style="user-select:all">${esc(c.phone)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(c.phone)}">${icon('copy')}Copy</button></div>` : ''}
    ${c.email ? `<div class="muted" style="user-select:all;overflow-wrap:anywhere">${esc(c.email)}</div>` : ''}
    ${j.siteContact || j.sitePhone ? `<div class="contact" style="border-top:1px solid var(--line);padding-top:8px"><div class="eyebrow">On-site contact</div><div><b>${esc(j.siteContact || '')}</b></div>${j.sitePhone ? `<div><span class="mono" style="user-select:all">${esc(j.sitePhone)}</span> <button class="btn sm ghost" data-act="copy" data-text="${esc(j.sitePhone)}">${icon('copy')}Copy</button></div>` : ''}</div>` : ''}
    ${(c.contacts || []).length ? `<div class="contacts" style="border-top:1px solid var(--line);padding-top:8px"><div class="eyebrow">Account contacts</div>${c.contacts.map(contactLine).join('')}</div>` : ''}
  </div></div>`;
  const site = j.address || c.address || '';
  const detailsCard = `<div class="card"><div class="card-h"><h2>Job details</h2>${W ? `<button class="btn sm" data-act="edit-job" data-id="${esc(j.id)}">${icon('edit')}Edit</button>` : ''}</div><div class="card-b"><div class="facts">
    <div class="fact" style="grid-column:1/-1"><div class="k">Job site</div><div class="v" style="font-weight:550">${esc(site || '—')}${site ? ` <a class="btn sm ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site)}" target="_blank" rel="noopener">${icon('pin')}Map</a>` : ''}</div></div>
    <div class="fact"><div class="k">Salesperson</div><div class="v">${sales ? esc(sales.name) : '—'}</div></div>
    <div class="fact"><div class="k">Source</div><div class="v">${esc(j.source || '—')}</div></div>
    <div class="fact"><div class="k">Created</div><div class="v">${j.createdAt ? esc(fmtDshort(dstr(new Date(j.createdAt)))) : '—'}</div></div>
    ${j.po ? `<div class="fact"><div class="k">PO / Lot</div><div class="v">${esc(j.po)}</div></div>` : ''}
  </div></div></div>`;
  const ck = j.checklist || {};
  const checkCard = `<div class="card"><div class="card-h"><h2>Checklist</h2><span class="faint">${CHECKS.filter((x) => ck[x.id]).length}/${CHECKS.length}</span></div><div class="checklist">${CHECKS.map((x) => `<label class="${ck[x.id] ? 'on' : ''}"><input type="checkbox" data-change="check" data-job="${esc(j.id)}" data-k="${x.id}" ${ck[x.id] ? 'checked' : ''} ${WN ? '' : 'disabled'}><span>${esc(x.name)}</span></label>`).join('')}</div></div>`;

  const lostBtn = W ? (j.stage === 'lost' ? `<button class="btn sm" data-act="stage" data-stage="quoted">${icon('undo')}Reopen</button>` : `<button class="btn sm ghost" data-act="mark-lost" data-id="${esc(j.id)}">Mark lost</button>`) : '';
  return {
    back: { view: C ? 'mywork' : 'jobs' },
    crumb: `<span class="mono">${esc(j.number)}</span> · ${esc(c.name || '')} ${demoTag(j)}`,
    title: esc(j.name),
    actions: `${j.stage === 'lost' ? stagePill('lost') : ''}<button class="btn sm" data-act="print-jobsheet" data-id="${esc(j.id)}">${icon('print')}<span class="lbl">Job sheet</span></button>${lostBtn}`,
    body: `${stepper}${C ? '' : attHTML}<div class="cols"><div class="stack">${quoteCard}${schedCard}${filesCardHTML(j)}${notesCard}</div><div class="stack">${C ? '' : moneyCard}${materialCardHTML(j)}${checkCard}${custCard}${detailsCard}</div></div>`,
  };
};
