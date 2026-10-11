/* =========================================================
   State + storage
   - "db" mode: Supabase (shared, live, signed-in team)
   - "local" mode: demo shop in this browser (before Supabase is connected)
   ========================================================= */
const COLLS = ['jobs', 'activities', 'customers', 'team', 'files', 'slabs'];
const LOCAL_KEY = 'kerf-demo-v1';
const S = {
  mode: 'loading', // loading | db | local
  live: false,
  canWrite: true,
  jobs: new Map(), activities: new Map(), customers: new Map(), team: new Map(), files: new Map(), slabs: new Map(),
  members: new Map(), my: null,
  shopId: '', shop: null, myShops: [],
  notesAll: new Map(), // local mode only
  feed: [], jobNotes: [], jobNotesFor: null,
  settingsDoc: null,
  loaded: {},
  view: 'dashboard', params: {},
  me: store.get('kerf-me', ''),
  auth: { screen: null, cfg: null, user: null, err: '', busy: false },
  ui: {
    jobQ: '', jobSales: '', jobShow: 'active', jobMode: store.get('kerf-jobmode', 'board'), jobSort: { k: 'updatedAt', d: -1 },
    custQ: '', calMode: 'week', calDate: today(), calHide: [], calCrew: '', invQ: '', invKind: 'all', invStatus: 'available',
    mwAll: false, noteDraft: '', noteIssue: false,
  },
  qdraft: null, sdraft: null,
};
let SB = null, CHANNEL = null;

/* ---------- who can do what ---------- */
const access = () => (S.mode === 'db' ? (S.my && S.my.active && S.my.status === 'active' ? S.my.access : 'crew') : 'admin');
const isAdmin = () => access() === 'admin';
const isStaff = () => access() !== 'crew';
const isCrew = () => access() === 'crew';
const ACCESS_LABEL = { admin: 'Full access', staff: 'Sales', crew: 'Crew' };
const memberForTeam = (teamId) => Array.from(S.members.values()).find((m) => m.team_id === teamId && m.status === 'active') || null;
const pendingMembers = () => Array.from(S.members.values()).filter((m) => m.status === 'pending').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
const shopName = () => (S.mode === 'db' && S.shop ? S.shop.name : '') || cfg().shopName || '';

/* ---------- settings ---------- */
function cfg() {
  const d = S.settingsDoc || {};
  const out = { ...DEFAULT_SETTINGS, ...d };
  for (const k of ['materials', 'edges', 'addons']) if (!Array.isArray(d[k])) out[k] = DEFAULT_SETTINGS[k];
  return out;
}

/* ---------- render scheduling ---------- */
let renderQueued = false;
function schedule() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

/* ---------- toasts ---------- */
function toast(msg, opts = {}) {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast' + (opts.bad ? ' bad' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action.label;
    b.onclick = () => { opts.action.run(); t.remove(); };
    t.appendChild(b);
  }
  box.appendChild(t);
  setTimeout(() => t.remove(), opts.ms || (opts.action ? 6000 : 3200));
}

/* ---------- files (downloads & printing) ---------- */
function saveFile(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function printHTML(html) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Printing isn’t available here. Use Download instead.', { bad: true }); } setTimeout(() => f.remove(), 60000); }, 250);
}

/* ---------- write plumbing ---------- */
const queues = new Map();
function enqueue(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const p = prev.catch(() => {}).then(fn);
  queues.set(key, p);
  p.finally(() => { if (queues.get(key) === p) queues.delete(key); }).catch(() => {});
  return p;
}
const transient = (e) => e && (!e.code || /fetch|network|timeout|Load failed/i.test(e.message || ''));
async function sbRun(fn) {
  let { error } = await fn();
  if (error && transient(error)) { await sleep(500 + Math.random() * 800); ({ error } = await fn()); }
  if (error) throw error;
}
function writeErr(e) { reportErr(e); throw e; }
function reportErr(e) {
  const code = e && e.code;
  if (code === '42501') toast('You don’t have permission to change that. Ask the owner if you need access.', { bad: true, ms: 6000 });
  else if (code === 'PGRST301' || code === '401' || /JWT|expired/i.test((e && e.message) || '')) toast('Your sign-in expired. Reload the page and sign in again.', { bad: true, ms: 7000 });
  else if (transient(e)) toast('You’re offline or the connection dropped. That change didn’t save — try again.', { bad: true, ms: 6000 });
  else toast('Couldn’t save that change. ' + ((e && e.message) || ''), { bad: true, ms: 6000 });
  console.warn('write failed', e);
}
const cleanDoc = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.id; return c; };
function guardWrite() {
  if (!S.canWrite) { toast('View only — you can’t change this shop’s data.', { bad: true }); return false; }
  return true;
}
function persistLocal() {
  if (S.mode !== 'local') return;
  const dump = {};
  for (const c of COLLS) dump[c] = Array.from(S[c].values());
  dump.notes = Array.from(S.notesAll.values());
  dump.settings = S.settingsDoc;
  store.set(LOCAL_KEY, dump);
}
function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}
function refreshMap(coll) { if (coll === 'notes') S.notesAll = new Map(S.notesAll); else S[coll] = new Map(S[coll]); }
/* apply a change on screen right away; the server confirms it through live updates */
function applyLocal(coll, id, op, body) {
  if (coll === 'notes' && S.mode === 'db') {
    if (op === 'put') {
      const n = { id, ...body };
      if (S.jobNotesFor && n.jobId === S.jobNotesFor) S.jobNotes = [n].concat(S.jobNotes.filter((x) => x.id !== id));
      S.feed = [n].concat(S.feed.filter((x) => x.id !== id)).slice(0, 40);
    } else if (op === 'remove') {
      S.jobNotes = S.jobNotes.filter((x) => x.id !== id); S.feed = S.feed.filter((x) => x.id !== id);
    }
    schedule(); return;
  }
  const map = new Map(coll === 'notes' ? S.notesAll : S[coll]);
  if (op === 'put') map.set(id, { id, ...body });
  else if (op === 'patch') { const cur = map.get(id); if (cur) map.set(id, deepMerge(cur, body)); }
  else if (op === 'remove') map.delete(id);
  if (coll === 'notes') S.notesAll = map; else S[coll] = map;
  persistLocal(); schedule();
}
async function put(coll, id, data) {
  if (!guardWrite()) return;
  const body = cleanDoc(data);
  applyLocal(coll, id, 'put', body);
  if (S.mode === 'db') return enqueue(coll + '/' + id, () => sbRun(() => SB.from(coll).upsert({ id, shop_id: S.shopId, data: body }))).catch(writeErr);
}
async function patch(coll, id, data) {
  if (!guardWrite()) return;
  const body = JSON.parse(JSON.stringify(data));
  applyLocal(coll, id, 'patch', body);
  if (S.mode === 'db') return enqueue(coll + '/' + id, () => sbRun(() => SB.rpc('kerf_patch', { tbl: coll, doc_id: id, patch: body }))).catch(writeErr);
}
async function remove(coll, id) {
  if (!guardWrite()) return;
  applyLocal(coll, id, 'remove');
  if (S.mode === 'db') return enqueue(coll + '/' + id, () => sbRun(() => SB.from(coll).delete().eq('id', id))).catch(writeErr);
}
async function bulkPut(coll, docs) {
  if (!docs.length) return;
  for (const d of docs) applyLocal(coll, d.id, 'put', cleanDoc(d));
  if (S.mode !== 'db') return;
  for (let i = 0; i < docs.length; i += 100) {
    const rows = docs.slice(i, i + 100).map((d) => ({ id: d.id, shop_id: S.shopId, data: cleanDoc(d) }));
    await sbRun(() => SB.from(coll).upsert(rows)).catch(writeErr);
  }
}
async function saveSettings(data) {
  if (!guardWrite()) return;
  const body = cleanDoc(data);
  S.settingsDoc = body; persistLocal(); schedule();
  if (S.mode !== 'db') return;
  await enqueue('settings/shop', () => sbRun(() => SB.from('settings').upsert({ id: S.shopId, shop_id: S.shopId, data: body }))).catch(writeErr);
  const nm = String(body.shopName || '').trim();
  if (nm && S.shop && nm !== S.shop.name) {
    S.shop = { ...S.shop, name: nm };
    await sbRun(() => SB.from('shops').update({ name: nm }).eq('id', S.shopId)).catch(reportErr);
  }
}

/* ---------- loading from Supabase ---------- */
async function fetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await SB.from(table).select('id,data').eq('shop_id', S.shopId).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const rowsToMap = (rows) => new Map(rows.map((r) => [r.id, { id: r.id, ...(r.data || {}) }]));
async function loadRemote() {
  const [jobs, acts, custs, team, files, slabs, settings, members, feed, shop] = await Promise.all([
    fetchAll('jobs'), fetchAll('activities'), fetchAll('customers'), fetchAll('team'), fetchAll('files'), fetchAll('slabs'),
    SB.from('settings').select('id,data').eq('id', S.shopId).maybeSingle(),
    SB.from('members').select('*').eq('shop_id', S.shopId),
    SB.from('notes').select('id,data').eq('shop_id', S.shopId).order('at', { ascending: false }).limit(40),
    SB.from('shops').select('id,name,join_code').eq('id', S.shopId).maybeSingle(),
  ]);
  for (const r of [settings, members, feed, shop]) if (r.error) throw r.error;
  S.shop = shop.data || null;
  S.jobs = rowsToMap(jobs); S.activities = rowsToMap(acts); S.customers = rowsToMap(custs); S.team = rowsToMap(team); S.files = rowsToMap(files); S.slabs = rowsToMap(slabs);
  S.settingsDoc = settings.data ? settings.data.data : null;
  S.members = new Map((members.data || []).map((m) => [m.user_id, m]));
  S.feed = (feed.data || []).map((r) => ({ id: r.id, ...r.data }));
  S.my = S.auth.user ? S.members.get(S.auth.user.id) || null : null;
  if (S.my) S.me = S.my.team_id || '';
  for (const c of COLLS) S.loaded[c] = true;
  S.loaded.settings = S.loaded.feed = true;
  if (S.jobNotesFor) await loadJobNotes(S.jobNotesFor);
  S.lastSync = Date.now();
}
async function loadJobNotes(jobId) {
  if (S.mode !== 'db' || !SB) return;
  const { data, error } = await SB.from('notes').select('id,data').eq('shop_id', S.shopId).eq('job_id', jobId).order('at', { ascending: false }).limit(500);
  if (error) { console.warn(error); return; }
  if (S.jobNotesFor === jobId) { S.jobNotes = data.map((r) => ({ id: r.id, ...r.data })); schedule(); }
}
function onChange(t, p) {
  const ev = p.eventType;
  const row = p.new && Object.keys(p.new).length ? p.new : null;
  const old = p.old || {};
  if (t === 'shops') { if (row && row.id === S.shopId) S.shop = { ...(S.shop || {}), ...row }; schedule(); return; }
  if (t === 'members') {
    if ((row && row.shop_id && row.shop_id !== S.shopId) || (ev === 'DELETE' && old.shop_id && old.shop_id !== S.shopId)) return;
    const m = new Map(S.members);
    if (ev === 'DELETE') m.delete(old.user_id); else if (row) m.set(row.user_id, row);
    S.members = m;
    const uidMe = S.auth.user && S.auth.user.id;
    if (uidMe && ((ev === 'DELETE' && old.user_id === uidMe) || (row && row.user_id === uidMe))) {
      S.my = ev === 'DELETE' ? null : row;
      if (!S.my || !S.my.active || S.my.status !== 'active') { routeAfterSignIn(); return; }
      S.me = S.my.team_id || '';
    }
    schedule(); return;
  }
  if (t === 'settings') { if (row && row.id === 'shop') S.settingsDoc = row.data; schedule(); return; }
  if (t === 'notes') {
    if (ev === 'DELETE') { S.feed = S.feed.filter((x) => x.id !== old.id); S.jobNotes = S.jobNotes.filter((x) => x.id !== old.id); }
    else if (row) {
      const n = { id: row.id, ...row.data };
      S.feed = [n].concat(S.feed.filter((x) => x.id !== n.id)).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40);
      if (n.jobId && n.jobId === S.jobNotesFor) S.jobNotes = [n].concat(S.jobNotes.filter((x) => x.id !== n.id));
    }
    schedule(); return;
  }
  if (!COLLS.includes(t)) return;
  const map = new Map(S[t]);
  if (ev === 'DELETE') map.delete(old.id); else if (row) map.set(row.id, { id: row.id, ...(row.data || {}) });
  S[t] = map; schedule();
}
function startRealtime() {
  if (CHANNEL) { try { SB.removeChannel(CHANNEL); } catch (e) { /* noop */ } }
  CHANNEL = SB.channel('kerf-live-' + S.shopId);
  for (const t of ['jobs', 'activities', 'customers', 'team', 'files', 'slabs', 'notes', 'settings', 'members']) {
    CHANNEL.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'shop_id=eq.' + S.shopId }, (p) => onChange(t, p));
  }
  CHANNEL.on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: 'id=eq.' + S.shopId }, (p) => onChange('shops', p));
  /* Supabase can't filter delete events, so listen for those separately (they only carry the row's id) */
  for (const t of ['jobs', 'activities', 'customers', 'team', 'files', 'slabs', 'notes', 'members']) {
    CHANNEL.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, (p) => onChange(t, p));
  }
  CHANNEL.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (S.live === false && S.lastSync && Date.now() - S.lastSync > 5000) resync();
      S.live = true; schedule();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      S.live = false; schedule();
    }
  });
}
let resyncing = false;
async function resync() {
  if (resyncing || S.mode !== 'db' || !S.auth.user) return;
  resyncing = true;
  try { await loadRemote(); schedule(); } catch (e) { console.warn('resync', e); } finally { resyncing = false; }
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (S.mode === 'db' && hiddenAt && Date.now() - hiddenAt > 60000) resync();
});
function stopRemote() {
  if (CHANNEL && SB) { try { SB.removeChannel(CHANNEL); } catch (e) { /* noop */ } }
  CHANNEL = null; S.live = false;
  for (const c of COLLS) S[c] = new Map();
  S.members = new Map(); S.my = null; S.shop = null; S.feed = []; S.jobNotes = []; S.settingsDoc = null; S.loaded = {};
}

/* ---------- demo mode ---------- */
function startLocal() {
  S.mode = 'local';
  const dump = store.get(LOCAL_KEY, null);
  if (dump && dump.jobs) {
    for (const c of COLLS) S[c] = new Map((dump[c] || []).map((x) => [x.id, x]));
    S.notesAll = new Map((dump.notes || []).map((x) => [x.id, x]));
    S.settingsDoc = dump.settings || null;
  } else {
    const demo = buildDemo();
    for (const c of COLLS) S[c] = new Map(demo[c].map((x) => [x.id, x]));
    S.notesAll = new Map(demo.notes.map((x) => [x.id, x]));
    persistLocal();
  }
  for (const c of COLLS) S.loaded[c] = true;
  S.loaded.settings = S.loaded.feed = true;
  if (!S.me || !S.team.has(S.me)) S.me = (Array.from(S.team.values())[0] || {}).id || '';
  schedule();
}
function subscribeJobNotes(jobId) {
  if (S.jobNotesFor === jobId) return;
  S.jobNotesFor = jobId; S.jobNotes = [];
  if (S.mode === 'db') loadJobNotes(jobId);
}
function unsubscribeJobNotes() { S.jobNotesFor = null; S.jobNotes = []; }
function notesForJob(jobId) {
  const list = S.mode === 'db' ? (S.jobNotesFor === jobId ? S.jobNotes : []) : Array.from(S.notesAll.values()).filter((n) => n.jobId === jobId);
  return list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}
function feedList() {
  if (S.mode === 'db') return S.feed;
  return Array.from(S.notesAll.values()).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40);
}
const isLoaded = () => S.mode === 'local' || (S.mode === 'db' && COLLS.every((c) => S.loaded[c]) && S.loaded.settings);

/* ---------- lookups ---------- */
const member = (id) => S.team.get(id);
const activeTeam = () => Array.from(S.team.values()).filter((m) => m.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const customer = (id) => S.customers.get(id);
const jobOf = (id) => S.jobs.get(id);
const allJobs = () => Array.from(S.jobs.values());
let _idxSrc = null, _idx = new Map();
function actIndex() {
  if (_idxSrc !== S.activities) {
    _idx = new Map();
    for (const a of S.activities.values()) { if (!_idx.has(a.jobId)) _idx.set(a.jobId, []); _idx.get(a.jobId).push(a); }
    for (const l of _idx.values()) l.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    _idxSrc = S.activities;
  }
  return _idx;
}
const actsForJob = (jobId) => actIndex().get(jobId) || [];
const filesForJob = (jobId) => Array.from(S.files.values()).filter((f) => f.jobId === jobId).sort((a, b) => (b.at || 0) - (a.at || 0));
const slabsForJob = (jobId) => Array.from(S.slabs.values()).filter((s) => s.jobId === jobId).sort((a, b) => String(a.serial).localeCompare(String(b.serial), undefined, { numeric: true }));
const slabSqft = (s) => ((Number(s.L) || 0) * (Number(s.W) || 0)) / 144;
const actsOnDate = (date) => Array.from(S.activities.values()).filter((a) => a.date === date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
const paidOf = (job) => round2(sum(job.payments || [], (p) => p.amount));
const balanceOf = (job) => round2((job.total || 0) - paidOf(job));
function nextAct(jobId) {
  const t = today();
  return actsForJob(jobId).find((a) => a.status !== 'done' && a.date >= t) || null;
}
function nextJobNumber() {
  let max = 1000;
  for (const j of S.jobs.values()) { const n = parseInt(String(j.number || '').replace(/\D/g, ''), 10); if (n > max) max = n; }
  return 'J-' + (max + 1);
}

/* things that need a human */
function attention(job) {
  const out = [];
  if (!job || job.stage === 'lost' || job.stage === 'closed') return out;
  const t = today();
  const acts = actsForJob(job.id);
  const has = (type) => acts.some((a) => a.type === type);
  const days = job.quotedAt ? Math.floor((Date.now() - job.quotedAt) / 86400000) : 0;
  if (job.stage === 'lead' && Date.now() - (job.createdAt || Date.now()) > 3 * 86400000) out.push({ level: 'warn', text: 'Lead waiting on a quote' });
  if (job.stage === 'quoted' && days >= 7) out.push({ level: 'warn', text: `Quote sent ${days} days ago — follow up` });
  if (stageIdx(job.stage) >= stageIdx('sold') && !(job.checklist || {}).deposit && paidOf(job) <= 0 && job.stage !== 'installed') out.push({ level: 'warn', text: 'No deposit recorded' });
  const pifUnder = Number(cfg().payInFullUnder) || 0;
  if (['sold', 'templated'].includes(job.stage) && job.total > 0 && pifUnder && job.total < pifUnder && paidOf(job) < job.total - 0.5) out.push({ level: 'warn', text: `Under ${money(pifUnder)} — collect full payment before measure` });
  if (job.stage === 'sold' && !has('template')) out.push({ level: 'bad', text: 'Sold — template not scheduled' });
  if ((job.stage === 'templated' || job.stage === 'fabrication') && !has('install')) out.push({ level: 'bad', text: 'Install not scheduled' });
  for (const a of acts) if (a.status !== 'done' && a.date < t) out.push({ level: 'bad', text: `${actType(a.type).name} on ${fmtDshort(a.date)} not marked done` });
  if (job.stage === 'installed' && balanceOf(job) > 0.5) out.push({ level: 'warn', text: `Collect final payment · ${money(balanceOf(job))}` });
  if (job.stage === 'installed' && balanceOf(job) <= 0.5) out.push({ level: 'warn', text: 'Paid in full — close the job' });
  return out;
}

/* ---------- domain actions ---------- */
async function addNote(jobId, text, kind = 'note', extra = {}) {
  return put('notes', uid(), { jobId, text, kind, by: S.me || '', at: Date.now(), ...extra });
}
async function setStage(job, stage, opts = {}) {
  if (!job || job.stage === stage) return;
  const from = job.stage;
  const upd = { stage, updatedAt: Date.now() };
  if (stage === 'quoted' && !job.quotedAt) upd.quotedAt = Date.now();
  if (stageIdx(stage) >= stageIdx('sold') && !job.soldAt) upd.soldAt = Date.now();
  if (stage === 'closed') upd.closedAt = Date.now();
  if (stage === 'lost') upd.lostAt = Date.now();
  await patch('jobs', job.id, upd);
  await addNote(job.id, `Moved from ${stageName(from)} to ${stageName(stage)}${opts.reason ? ' — ' + opts.reason : ''}`, 'event');
  if (!opts.quiet) toast(`${job.number} moved to ${stageName(stage)}`);
}
async function completeAct(act, done = true) {
  const job = jobOf(act.jobId);
  await patch('activities', act.id, { status: done ? 'done' : 'scheduled', doneAt: done ? Date.now() : null, doneBy: done ? S.me || '' : '' });
  if (!job) return;
  const tname = actType(act.type).name;
  await addNote(job.id, `${tname} ${done ? 'marked complete' : 'reopened'} (${fmtD(act.date)})`, 'event');
  if (!done) return;
  /* like Moraware: completing fabrication uses up the slabs allocated to the job */
  if (act.type === 'fabrication') {
    const used = slabsForJob(job.id).filter((s) => s.status === 'allocated');
    for (const s of used) await patch('slabs', s.id, { status: 'used', usedAt: Date.now() });
    if (used.length) await addNote(job.id, `${used.length} slab${used.length === 1 ? '' : 's'} marked used: ${used.map((s) => s.serial).join(', ')}`, 'event');
  }
  const target = { template: 'templated', fabrication: 'fabrication', install: 'installed' }[act.type];
  if (target && stageIdx(job.stage) > -1 && stageIdx(job.stage) < stageIdx(target)) {
    await setStage(job, target, { quiet: true });
    toast(`${tname} done · ${job.number} moved to ${stageName(target)}`);
  } else {
    toast(`${tname} marked done`);
  }
}
async function recordPayment(job, pay) {
  const payments = (job.payments || []).concat([{ id: uid(), ...pay }]);
  const upd = { payments, updatedAt: Date.now() };
  const paid = round2(sum(payments, (p) => p.amount));
  if (paid > 0) upd.checklist = { deposit: true };
  if (paid >= (job.total || 0) - 0.5 && job.total > 0 && stageIdx(job.stage) >= stageIdx('installed')) upd.checklist = { deposit: true, final: true };
  await patch('jobs', job.id, upd);
  await addNote(job.id, `Payment recorded · ${money2(pay.amount)} by ${pay.method}${pay.note ? ' — ' + pay.note : ''}`, 'event');
  toast(`Payment of ${money2(pay.amount)} recorded`);
}
async function deleteJob(job) {
  for (const a of actsForJob(job.id).slice()) await remove('activities', a.id);
  for (const f of filesForJob(job.id)) await deleteFile(f, true);
  for (const s of slabsForJob(job.id)) if (s.status === 'allocated') await patch('slabs', s.id, { status: 'available', jobId: null });
  if (S.mode === 'db') {
    try { await sbRun(() => SB.from('notes').delete().eq('job_id', job.id)); } catch (e) { /* history stays if not allowed */ }
  } else {
    for (const n of Array.from(S.notesAll.values())) if (n.jobId === job.id) S.notesAll.delete(n.id);
    refreshMap('notes');
  }
  await remove('jobs', job.id);
  toast(`${job.number} deleted`);
}

/* ---------- sample data ---------- */
async function loadSample() {
  if (!guardWrite()) return;
  if (S.mode === 'db' && !isAdmin()) { toast('Only the owner or office can load sample data', { bad: true }); return; }
  const demo = buildDemo();
  if (S.mode === 'db') toast('Loading sample shop…', { ms: 2500 });
  try {
    for (const c of COLLS) await bulkPut(c, demo[c]);
    await bulkPut('notes', demo.notes);
    toast(S.mode === 'db' ? 'Sample shop loaded — everything tagged SAMPLE can be removed in Settings' : 'Sample shop loaded');
  } catch (e) { /* toast shown */ }
}
async function removeSample() {
  if (!guardWrite()) return;
  try {
    if (S.mode === 'db') {
      for (const c of COLLS) {
        const ids = Array.from(S[c].values()).filter((x) => x.demo).map((x) => x.id);
        for (const id of ids) applyLocal(c, id, 'remove');
        for (let i = 0; i < ids.length; i += 100) await sbRun(() => SB.from(c).delete().in('id', ids.slice(i, i + 100)));
      }
      await sbRun(() => SB.from('notes').delete().eq('shop_id', S.shopId).eq('data->>demo', 'true'));
      S.feed = S.feed.filter((n) => !n.demo);
    } else {
      for (const c of COLLS) for (const x of Array.from(S[c].values())) if (x.demo) S[c].delete(x.id);
      for (const n of Array.from(S.notesAll.values())) if (n.demo) S.notesAll.delete(n.id);
      for (const c of COLLS) refreshMap(c);
      refreshMap('notes'); persistLocal();
    }
    schedule();
    toast('Sample data removed');
  } catch (e) { reportErr(e); }
}
const hasSample = () => COLLS.some((c) => Array.from(S[c].values()).some((x) => x.demo));
async function setMyPhoto(photo) {
  if (!S.me) { toast('Your login isn’t linked to a team member yet', { bad: true }); return; }
  if (S.mode !== 'db') { await patch('team', S.me, { photo }); return; }
  applyLocal('team', S.me, 'patch', { photo });
  try { await sbRun(() => SB.rpc('kerf_set_my_photo', { sid: S.shopId, photo })); } catch (e) { reportErr(e); }
}
/* First time the owner or office opens the app: bring in the logo from mwsurfaces.com */
let logoTried = false;
async function autoImportLogo(force = false) {
  if ((!force && logoTried) || !isAdmin() || !S.canWrite) return false;
  if (!force && (safeImg(cfg().logo) || (S.settingsDoc && S.settingsDoc.logoImportTried))) return false;
  logoTried = true;
  try {
    const r = await fetch('/api/brand-logo');
    if (!r.ok) throw new Error('not available');
    const blob = await r.blob();
    const url = await readImage(blob, { max: 360, keepPng: true });
    await setLogo(url);
    if (!force) toast('Midwest Surfaces logo added from mwsurfaces.com. Change it in Settings if needed.', { ms: 6000 });
    return true;
  } catch (e) {
    if (force) toast('Couldn’t get the logo from mwsurfaces.com. Save it from the website and use Upload instead.', { bad: true, ms: 7000 });
    else if (S.mode === 'db' && S.settingsDoc) { try { await patch('settings', S.shopId, { logoImportTried: true }); } catch (err) { /* ignore */ } }
    return false;
  }
}
async function setLogo(logo) {
  const cur = cfg();
  const body = { ...cleanDoc(S.settingsDoc || {}), logo };
  if (!S.settingsDoc) for (const k of Object.keys(DEFAULT_SETTINGS)) if (body[k] === undefined && k !== 'materials' && k !== 'edges' && k !== 'addons') body[k] = cur[k];
  await saveSettings(body);
  if (S.sdraft) S.sdraft.logo = logo;
}
function setMe(id) { S.me = id; store.set('kerf-me', id); schedule(); }
