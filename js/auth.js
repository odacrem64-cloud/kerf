/* =========================================================
   Start screen, sign-in, create / join a shop, team logins
   ========================================================= */
function showAuth(screen, err = '') {
  S.auth.screen = screen; S.auth.err = err; S.auth.busy = false;
  closeModal();
  stopPendingPoll();
  if (screen === 'pending') startPendingPoll();
  render(true);
}
const signedIn = () => !!S.auth.user;

function authHTML() {
  const a = S.auth;
  const head = `<div class="auth-brand">${BRAND}<span>${esc(SHOP.name)}<small>${esc(SHOP.city)}</small></span></div>`;
  const setUp = !!(S.auth.cfg && S.auth.cfg.hasShop);
  const err = a.err ? `<div class="auth-err" role="alert">${esc(a.err)}</div>` : '';
  const btn = (label) => `<button class="btn primary auth-go" type="submit" data-label="${esc(label)}" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Working…' : esc(label)}</button>`;
  const pw = (id, label, auto) => `<label class="field"><span>${label}</span><div class="pw"><input class="input" id="${id}" type="password" autocomplete="${auto}" minlength="${auto === 'new-password' ? 8 : 1}"><button type="button" class="btn sm ghost" data-act="pw-toggle" data-for="${id}">Show</button></div></label>`;
  const back = (to = 'start') => `<button type="button" class="btn ghost sm auth-back" data-act="auth-screen" data-v="${signedIn() && to === 'start' ? 'noshop' : to}">${icon('back')}Back</button>`;
  const who = signedIn() ? '' : `
        <label class="field"><span>Your name</span><input class="input" id="au-name" autocomplete="name"></label>
        <label class="field"><span>Email</span><input class="input" id="au-email" type="email" autocomplete="username" inputmode="email"></label>
        ${pw('au-pass', 'Password (8+ characters)', 'new-password')}
        `;
  let body = '';
  switch (a.screen) {
    case 'start':
      body = setUp
        ? `<h1>Welcome</h1><p class="muted">Quotes, jobs, the schedule and slab inventory for the Midwest Surfaces team.</p>
          <div class="choice">
            <button class="choice-btn" data-act="auth-screen" data-v="login">${icon('next')}<span><b>Sign in</b><small>Use the email and password you set up.</small></span></button>
            <button class="choice-btn" data-act="auth-screen" data-v="join">${icon('users')}<span><b>New to the team?</b><small>Join with the shop code from the office.</small></span></button>
          </div>`
        : `<h1>Set up the shop</h1><p class="muted">First time here. Create the owner login for Midwest Surfaces, then invite the team.</p>
          <div class="choice"><button class="choice-btn" data-act="auth-screen" data-v="create">${icon('plus')}<span><b>Create the owner login</b><small>Only needed once.</small></span></button></div>`;
      break;
    case 'login':
      body = `${back()}<h1>Sign in</h1>${err}
        <form class="auth-form" data-form="login" novalidate>
          <label class="field"><span>Email</span><input class="input" id="li-email" type="email" autocomplete="username" inputmode="email" autofocus></label>
          ${pw('li-pass', 'Password', 'current-password')}
          ${btn('Sign in')}
        </form>
        <p class="faint auth-foot">Forgot your password? Ask your shop’s owner or office to reset it from the Team page.</p>`;
      break;
    case 'create':
      body = `${back()}<h1>Owner login</h1><p class="muted">This sets up Midwest Surfaces. You’ll add prices and the crew after this.</p>${err}
        <form class="auth-form" data-form="create" novalidate>
          <input type="hidden" id="au-shop" value="${esc(SHOP.name)}">
          ${who}
          ${btn('Create owner login')}
        </form>`;
      break;
    case 'join':
      body = `${back()}<h1>Join the team</h1><p class="muted">Ask the office for the shop code. They’ll approve you before you can see jobs.</p>${err}
        <form class="auth-form" data-form="join" novalidate>
          <label class="field"><span>Shop code</span><input class="input mono code-input" id="au-code" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" autofocus></label>
          ${who}
          ${btn('Ask to join')}
        </form>`;
      break;
    case 'noshop':
      body = `<h1>You’re not on the team yet</h1><p class="muted">Signed in as ${esc((S.auth.user && S.auth.user.email) || '')}.</p>
        <div class="choice">
          ${setUp ? '' : `<button class="choice-btn" data-act="auth-screen" data-v="create">${icon('plus')}<span><b>Set up Midwest Surfaces</b><small>Become the owner login.</small></span></button>`}
          <button class="choice-btn" data-act="auth-screen" data-v="join">${icon('users')}<span><b>Join the team</b><small>Enter the shop code from the office.</small></span></button>
        </div>
        <p class="auth-foot"><button class="linkbtn" data-act="sign-out">Sign out</button></p>`;
      break;
    case 'pickshop':
      body = `<h1>Choose a shop</h1>
        <div class="choice">${S.myShops.map((m) => `<button class="choice-btn" data-act="pick-shop" data-id="${esc(m.shop_id)}">${icon('home')}<span><b>${esc(m.name || 'Shop')}</b><small>${m.status === 'pending' ? 'Waiting for approval' : !m.active ? 'Login turned off' : esc(ACCESS_LABEL[m.access] || '')}</small></span></button>`).join('')}</div>
        <p class="auth-foot"><button class="linkbtn" data-act="sign-out">Sign out</button></p>`;
      break;
    case 'pending': {
      const m = S.myShops.find((x) => x.shop_id === S.pendingShop) || {};
      body = `<h1>Waiting for approval</h1><p class="muted">You asked to join <b>${esc(m.name || 'the shop')}</b>. Once the owner or office approves you on their Team page, you’ll get in automatically.</p>
        <div class="btn-row"><button class="btn primary" data-act="check-again">Check again</button>${S.myShops.length > 1 ? '<button class="btn" data-act="auth-screen" data-v="pickshop">Other shops</button>' : ''}</div>
        <p class="auth-foot"><button class="linkbtn" data-act="sign-out">Sign out</button></p>`;
      break;
    }
    case 'schema':
      body = `<h1>One more step</h1><p class="muted">The site is connected to Supabase, but the database tables aren’t set up yet.</p>${err}
        <ol class="auth-steps"><li>Click <b>Copy setup script</b> below.</li><li>In Supabase, open your project, then <b>SQL Editor</b> → <b>New query</b>.</li><li>Paste, then click <b>Run</b>. You should see “Success.”</li><li>Come back here and click <b>Check again</b>.</li></ol>
        <div class="btn-row"><button class="btn dark" data-act="copy-schema">${icon('copy')}Copy setup script</button><button class="btn primary" data-act="reload">Check again</button></div>`;
      break;
    case 'key': {
      const has = S.auth.cfg && S.auth.cfg.hasSecret;
      body = `<h1>${has ? 'Check the secret key' : 'Add the secret key'}</h1><p class="muted">${has ? 'Supabase isn’t accepting the secret key saved in Vercel.' : 'The site needs your Supabase secret key saved in Vercel.'}</p>
        <ol class="auth-steps"><li>In Supabase: <b>Project Settings</b> → <b>API Keys</b>. Copy the <b>secret</b> key.</li><li>In Vercel: your project → <b>Settings</b> → <b>Environment Variables</b>. Set <b>SUPABASE_SECRET_KEY</b> to that value.</li><li>Open <b>Deployments</b>, click ⋯ on the latest one, choose <b>Redeploy</b>, then reload this page.</li></ol>
        <button class="btn primary" data-act="reload">Check again</button>`;
      break;
    }
    case 'inactive':
      body = `<h1>Your login is turned off</h1><p class="muted">Ask the owner or office to turn your access back on from the Team page.</p>
        <div class="btn-row"><button class="btn primary" data-act="sign-out">Sign out</button>${S.myShops.length > 1 ? '<button class="btn" data-act="auth-screen" data-v="pickshop">Other shops</button>' : ''}</div>`;
      break;
    case 'loading':
      body = `<h1>Opening your shop…</h1><div class="skeleton" style="padding:10px 0"><i style="height:14px"></i><i style="height:14px;width:70%"></i></div>`;
      break;
    default:
      body = `<h1>Something went wrong</h1><p class="muted">${esc(a.err || 'The app couldn’t load.')}</p><button class="btn primary" data-act="reload">Try again</button>`;
  }
  return `<div class="auth-wrap"><div class="auth-card">${head}${body}</div></div>`;
}

/* ---------- boot ---------- */
async function kerfBoot() {
  S.auth.screen = 'loading'; render(true);
  let conf = null;
  try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) conf = await r.json(); } catch (e) { conf = null; }
  S.auth.cfg = conf;
  if (!conf || !conf.configured) { S.auth.screen = null; S.demoReason = conf ? 'keys' : 'server'; startLocal(); render(true); return; }
  if (!window.supabase || !window.supabase.createClient) { showAuth('error', 'The Supabase library didn’t load. Check your connection and reload.'); return; }
  SB = window.supabase.createClient(conf.url, conf.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'kerf-auth' } });
  if (conf.schema === false) { showAuth('schema'); return; }
  if (conf.keyProblem || !conf.hasSecret) { showAuth('key'); return; }
  SB.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') setTimeout(() => { stopRemote(); S.auth.user = null; S.shopId = ''; S.myShops = []; S.mode = 'loading'; showAuth('start'); }, 0);
  });
  const { data } = await SB.auth.getSession();
  if (data && data.session) { S.auth.user = data.session.user; await routeAfterSignIn(); return; }
  showAuth('start');
}
/* where a signed-in person goes: their shop, a shop picker, the waiting screen, or create/join */
async function routeAfterSignIn(preferShop) {
  S.auth.screen = 'loading'; render(true);
  const uidMe = S.auth.user.id;
  const [mem, shops] = await Promise.all([
    SB.from('members').select('shop_id,status,active,access').eq('user_id', uidMe),
    SB.from('shops').select('id,name'),
  ]);
  if (mem.error || shops.error) {
    const e = mem.error || shops.error;
    if (e && (e.code === 'PGRST301' || /JWT/i.test(e.message || ''))) { await SB.auth.signOut(); return; }
    showAuth('error', 'Couldn’t load your shops: ' + ((e && e.message) || '')); return;
  }
  const names = new Map((shops.data || []).map((x) => [x.id, x.name]));
  S.myShops = (mem.data || []).map((m) => ({ ...m, name: names.get(m.shop_id) || 'Shop' })).sort((a, b) => a.name.localeCompare(b.name));
  if (!S.myShops.length) { showAuth('noshop'); return; }
  const last = preferShop || store.get('kerf-shop', '');
  let pick = S.myShops.find((m) => m.shop_id === last);
  if (!pick) {
    const usable = S.myShops.filter((m) => m.status === 'active' && m.active);
    if (S.myShops.length === 1) pick = S.myShops[0];
    else if (usable.length === 1) pick = usable[0];
    else { showAuth('pickshop'); return; }
  }
  await openShop(pick);
}
async function openShop(m) {
  store.set('kerf-shop', m.shop_id);
  if (m.status === 'pending') { S.pendingShop = m.shop_id; showAuth('pending'); return; }
  if (!m.active) { showAuth('inactive'); return; }
  if (S.mode === 'db' && S.shopId && S.shopId !== m.shop_id) stopRemote();
  S.shopId = m.shop_id; S.mode = 'db'; S.auth.screen = 'loading'; render(true);
  try { await loadRemote(); } catch (e) { showAuth('error', 'Couldn’t load your shop: ' + ((e && e.message) || 'unknown error')); return; }
  if (!S.my || !S.my.active || S.my.status !== 'active') { showAuth('inactive'); return; }
  S.auth.screen = null; stopPendingPoll();
  startRealtime();
  S.view = isCrew() ? 'mywork' : 'dashboard'; S.params = {};
  render(true);
  setTimeout(() => autoImportLogo(), 800);
}
let pendingTimer = null;
function startPendingPoll() { stopPendingPoll(); pendingTimer = setInterval(() => { if (S.auth.screen === 'pending' && !document.hidden) routeAfterSignIn(S.pendingShop); }, 20000); }
function stopPendingPoll() { if (pendingTimer) clearInterval(pendingTimer); pendingTimer = null; }

async function postJSON(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (SB && signedIn()) { const { data } = await SB.auth.getSession(); if (data && data.session) headers.Authorization = 'Bearer ' + data.session.access_token; }
  const r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'That didn’t work. Try again.');
  return j;
}
async function submitAuth(form) {
  const kind = form.dataset.form;
  const v = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  const raw = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  if (S.auth.busy) return;
  if (kind === 'login') {
    const email = v('li-email'), password = raw('li-pass');
    if (!email || !password) { showAuthErr('Enter your email and password.'); return; }
    setBusy(true);
    const { data, error } = await SB.auth.signInWithPassword({ email, password });
    if (error) { setBusy(false); showAuthErr(/invalid/i.test(error.message) ? 'That email and password don’t match.' : error.message); return; }
    S.auth.user = data.user;
    await routeAfterSignIn();
    return;
  }
  if (kind === 'create' || kind === 'join') {
    const body = { action: kind };
    if (kind === 'create') body.shopName = SHOP.name;
    else { body.code = v('au-code'); if (body.code.replace(/[^a-z0-9]/gi, '').length < 4) { showAuthErr('Enter the shop code from the office.'); return; } }
    if (!signedIn()) {
      body.name = v('au-name'); body.email = v('au-email').toLowerCase(); body.password = raw('au-pass');
      if (!body.name || !body.email || body.password.length < 8) { showAuthErr('Fill in your name, email, and a password with at least 8 characters.'); return; }
    }
    setBusy(true);
    let j;
    try { j = await postJSON('/api/shops', body); } catch (e) { setBusy(false); showAuthErr(e.message); return; }
    if (!signedIn()) {
      const { data, error } = await SB.auth.signInWithPassword({ email: body.email, password: body.password });
      if (error) { showAuth('login', 'You’re all set. Sign in to continue.'); return; }
      S.auth.user = data.user;
    }
    if (S.auth.cfg) S.auth.cfg.hasShop = true;
    await routeAfterSignIn(j.shopId);
    if (kind === 'create' && S.auth.screen === null) toast('Midwest Surfaces is set up. Start with your prices, then invite the crew from Team.', { ms: 6000 });
  }
}
function setBusy(b) { S.auth.busy = b; const g = $('.auth-go'); if (g) { g.disabled = b; g.textContent = b ? 'Working…' : g.dataset.label || g.textContent; } }
function showAuthErr(msg) {
  S.auth.err = msg;
  let el = $('.auth-err');
  if (!el) { el = document.createElement('div'); el.className = 'auth-err'; el.setAttribute('role', 'alert'); const f = $('.auth-form'); if (f) f.parentNode.insertBefore(el, f); }
  el.textContent = msg;
}
async function signOut() {
  if (S.view === 'quote' && S.qdraft && S.qdraft.dirty && !(await confirmBox('Sign out without saving this quote?', 'Your changes to the quote will be lost.', 'Sign out', true))) return;
  S.qdraft = null;
  if (SB) await SB.auth.signOut();
}

/* ---------- team logins & join requests (owner/office) ---------- */
const teamApi = (body) => postJSON('/api/users', { shopId: S.shopId, ...body });
const WORDS = ['slab', 'quartz', 'granite', 'edge', 'seam', 'sink', 'level', 'polish', 'marble', 'kerf', 'blade', 'island', 'vanity', 'bevel', 'ogee', 'stone'];
function makePassword() {
  const r = new Uint32Array(3);
  (window.crypto || window.msCrypto).getRandomValues(r);
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${String(1000 + (r[2] % 9000))}`;
}
const defaultAccess = (role) => (['Owner', 'Office'].includes(role) ? 'admin' : role === 'Sales' ? 'staff' : 'crew');
const accessOptions = (sel) => [['crew', 'Crew — their schedule, notes, marking work done'], ['staff', 'Sales — quotes, jobs, customers, calendar'], ['admin', 'Full access — everything, including prices and logins']].map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');

function loginModal(teamId) {
  const m = member(teamId);
  if (!m) return;
  MS = { kind: 'login', teamId };
  openModal({
    title: `Create a login for ${m.name}`,
    body: `<p class="muted" style="margin:0">Easiest option: send them your shop code so they sign up themselves. Or set up their login here and text them the password.</p>
      <div class="grid2">
        <label class="field span2"><span>Email</span><input class="input" id="lg-email" type="email" inputmode="email" value="${esc(m.email || '')}" autocomplete="off"></label>
        <label class="field span2"><span>Password</span><div class="pw"><input class="input mono" id="lg-pass" value="${esc(makePassword())}" autocomplete="off"><button type="button" class="btn sm ghost" data-act="pw-new" data-for="lg-pass">New</button></div></label>
        <label class="field span2"><span>What they can do</span><select class="input" id="lg-access">${accessOptions(defaultAccess(m.role))}</select></label>
      </div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="lg-create">Create login</button>`,
  });
}
function credentialsModal(name, email, password, title = 'Login ready') {
  const site = location.origin;
  const text = `Midwest Surfaces login for ${name}\nWebsite: ${site}\nEmail: ${email}\nPassword: ${password}`;
  openModal({
    title,
    body: `<p class="muted" style="margin:0">Send this to ${esc(name)}. This is the only time the password is shown.</p>
      <div class="card"><div class="card-b" style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px"><span class="faint">Website</span><span class="mono" style="user-select:all;overflow-wrap:anywhere">${esc(site)}</span><span class="faint">Email</span><span class="mono" style="user-select:all;overflow-wrap:anywhere">${esc(email)}</span><span class="faint">Password</span><span class="mono" style="user-select:all">${esc(password)}</span></div></div>
      <p class="faint" style="margin:0;font-size:12.5px">On a phone, they can open the website and choose “Add to Home Screen” to use it like an app.</p>`,
    foot: `<button class="btn" data-act="copy" data-text="${esc(text)}">${icon('copy')}Copy</button><button class="btn primary" data-act="close-modal">Done</button>`,
  });
}
function manageLoginModal(userId) {
  const mem = S.members.get(userId);
  if (!mem) return;
  const m = member(mem.team_id) || { name: mem.name || mem.email };
  MS = { kind: 'manage', userId };
  const self = S.auth.user && S.auth.user.id === userId;
  openModal({
    title: `${m.name}’s login`,
    body: `<div class="muted" style="font-size:13px">Signs in as <b class="mono" style="user-select:all">${esc(mem.email || '')}</b></div>
      <label class="field"><span>What they can do</span><select class="input" id="ml-access">${accessOptions(mem.access)}</select></label>
      <label class="check"><input type="checkbox" id="ml-active" ${mem.active ? 'checked' : ''} ${self ? 'disabled' : ''}> Login is turned on</label>
      ${self ? '' : `<div class="card"><div class="card-b" style="display:flex;flex-direction:column;gap:8px"><b>Reset password</b><div class="pw"><input class="input mono" id="ml-pass" value="${esc(makePassword())}" autocomplete="off"><button type="button" class="btn sm ghost" data-act="pw-new" data-for="ml-pass">New</button></div><div><button class="btn sm" data-act="ml-reset">Set this password</button></div></div></div>`}`,
    foot: `${self ? '' : `<button class="btn danger left" data-act="ml-remove">${icon('trash')}Remove from shop</button>`}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="ml-save">Save</button>`,
  });
}
function approveModal(userId) {
  const mem = S.members.get(userId);
  if (!mem) return;
  MS = { kind: 'approve', userId };
  const free = activeTeam().filter((t) => !memberForTeam(t.id) && !t.demo);
  openModal({
    title: `Approve ${mem.name || mem.email}`,
    body: `<p class="muted" style="margin:0">${esc(mem.email || '')} asked to join ${esc(shopName() || 'your shop')}.</p>
      <label class="field"><span>Who are they on your team?</span><select class="input" id="ap-team"><option value="new">Add as a new team member</option>${free.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}${t.role ? ' · ' + esc(t.role) : ''}</option>`).join('')}</select></label>
      <label class="field" id="ap-role-wrap"><span>Role</span><select class="input" id="ap-role">${opts(ROLES.filter((r) => r !== 'Owner'), 'Installer')}</select></label>
      <label class="field"><span>What they can do</span><select class="input" id="ap-access">${accessOptions('crew')}</select></label>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="ap-save">Approve</button>`,
  });
}

const AUTH_ACTIONS = {
  'auth-screen': (el) => showAuth(el.dataset.v),
  'pick-shop': (el) => { const m = S.myShops.find((x) => x.shop_id === el.dataset.id); if (m) openShop(m); },
  'switch-shop': () => { if (S.qdraft && S.qdraft.dirty) { toast('Save or discard your quote first', { bad: true }); return; } stopRemote(); S.mode = 'loading'; showAuth('pickshop'); },
  'check-again': () => routeAfterSignIn(S.pendingShop),
  'sign-out': () => signOut(),
  reload: () => location.reload(),
  'copy-schema': async () => {
    try { const r = await fetch('/supabase/schema.sql', { cache: 'no-store' }); const t = await r.text(); await copyText(t); }
    catch (e) { toast('Couldn’t load the script. Open supabase/schema.sql in your GitHub repo and copy it from there.', { bad: true, ms: 7000 }); }
  },
  'pw-toggle': (el) => { const i = document.getElementById(el.dataset.for); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; },
  'pw-new': (el) => { const i = document.getElementById(el.dataset.for); if (i) i.value = makePassword(); },
  'copy-code': () => { if (S.shop) copyText(`Join the ${S.shop.name} team app:\n1. Go to ${location.origin}\n2. Tap “New to the team?”\n3. Enter shop code ${S.shop.join_code}`); },
  'new-code': async () => {
    if (!(await confirmBox('Make a new shop code?', 'The old code stops working. People already on the team aren’t affected.', 'New code'))) return;
    try { const j = await teamApi({ action: 'newcode' }); S.shop = { ...S.shop, join_code: j.code }; render(true); toast('New shop code ready'); } catch (e) { toast(e.message, { bad: true }); }
  },
  'create-login': (el) => loginModal(el.dataset.id),
  'manage-login': (el) => manageLoginModal(el.dataset.id),
  'approve-member': (el) => approveModal(el.dataset.id),
  'decline-member': async (el) => {
    const mem = S.members.get(el.dataset.id); if (!mem) return;
    if (!(await confirmBox(`Decline ${mem.name || mem.email}?`, 'Their request is removed. They can ask again with the shop code.', 'Decline', true))) return;
    try { await teamApi({ action: 'decline', userId: mem.user_id }); toast('Request declined'); } catch (e) { toast(e.message, { bad: true }); }
  },
  'ap-save': async (el) => {
    const userId = MS.userId; const mem = S.members.get(userId);
    el.disabled = true;
    try { await teamApi({ action: 'approve', userId, teamId: val('#ap-team'), role: val('#ap-role'), access: val('#ap-access') }); closeModal(); toast(`${(mem && (mem.name || mem.email)) || 'They'} can sign in now`); }
    catch (e) { el.disabled = false; toast(e.message, { bad: true, ms: 6000 }); }
  },
  'lg-create': async (el) => {
    const email = val('#lg-email').toLowerCase(), password = val('#lg-pass'), acc = val('#lg-access');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr('#lg-email', 'Enter a valid email address'); return; }
    if (password.length < 8) { fieldErr('#lg-pass', 'Use at least 8 characters'); return; }
    const m = member(MS.teamId);
    el.disabled = true; el.textContent = 'Creating…';
    try { await teamApi({ action: 'create', teamId: MS.teamId, email, password, access: acc }); credentialsModal(m ? m.name : email, email, password); }
    catch (e) { el.disabled = false; el.textContent = 'Create login'; toast(e.message, { bad: true, ms: 7000 }); }
  },
  'ml-save': async (el) => {
    const userId = MS.userId; const accessV = val('#ml-access'); const act = $('#ml-active');
    el.disabled = true;
    try { await teamApi({ action: 'access', userId, access: accessV, active: act ? act.checked : true }); closeModal(); toast('Access updated'); }
    catch (e) { el.disabled = false; toast(e.message, { bad: true, ms: 6000 }); }
  },
  'ml-reset': async (el) => {
    const userId = MS.userId; const password = val('#ml-pass');
    if (password.length < 8) { fieldErr('#ml-pass', 'Use at least 8 characters'); return; }
    const mem = S.members.get(userId); const m = mem ? member(mem.team_id) : null;
    el.disabled = true;
    try { await teamApi({ action: 'reset', userId, password }); credentialsModal(m ? m.name : 'them', mem ? mem.email : '', password, 'Password changed'); }
    catch (e) { el.disabled = false; toast(e.message, { bad: true, ms: 7000 }); }
  },
  'ml-remove': async () => {
    const userId = MS.userId; const mem = S.members.get(userId); const m = mem ? member(mem.team_id) : null;
    if (!(await confirmBox(`Remove ${m ? m.name : 'this person'} from the shop?`, 'They won’t be able to sign in to this shop. Their name stays on the team list and on past jobs.', 'Remove', true))) return;
    try { await teamApi({ action: 'remove', userId }); toast('Removed from the shop'); } catch (e) { toast(e.message, { bad: true, ms: 6000 }); }
  },
};
document.addEventListener('submit', (e) => {
  const f = e.target.closest && e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  submitAuth(f);
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'ap-team') { const w = $('#ap-role-wrap'); if (w) w.hidden = e.target.value !== 'new'; }
});
