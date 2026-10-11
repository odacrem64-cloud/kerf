/* =========================================================
   Sign-in, first-time setup, and team logins
   ========================================================= */
function showAuth(screen, err = '') {
  S.auth.screen = screen; S.auth.err = err; S.auth.busy = false;
  closeModal();
  render(true);
}
function authHTML() {
  const a = S.auth;
  const head = `<div class="auth-brand">${BRAND}<span>KERF</span></div>`;
  const err = a.err ? `<div class="auth-err" role="alert">${esc(a.err)}</div>` : '';
  const btn = (label) => `<button class="btn primary auth-go" type="submit" data-label="${esc(label)}" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Working…' : label}</button>`;
  const pw = (id, label, auto) => `<label class="field"><span>${label}</span><div class="pw"><input class="input" id="${id}" type="password" autocomplete="${auto}" required minlength="${auto === 'new-password' ? 8 : 1}"><button type="button" class="btn sm ghost" data-act="pw-toggle" data-for="${id}">Show</button></div></label>`;
  let body = '';
  if (a.screen === 'login') {
    body = `<h1>Sign in</h1><p class="muted">Quotes, jobs and the schedule for your shop.</p>${err}
      <form class="auth-form" data-form="login" novalidate>
        <label class="field"><span>Email</span><input class="input" id="li-email" type="email" autocomplete="username" inputmode="email" required autofocus></label>
        ${pw('li-pass', 'Password', 'current-password')}
        ${btn('Sign in')}
      </form>
      <p class="faint auth-foot">Forgot your password? Ask the owner or office to reset it from the Team page.</p>`;
  } else if (a.screen === 'setup') {
    body = `<h1>Set up your shop</h1><p class="muted">Create the owner login. You’ll add your office staff and crew after this.</p>${err}
      <form class="auth-form" data-form="setup" novalidate>
        <label class="field"><span>Your name</span><input class="input" id="su-name" autocomplete="name" required autofocus></label>
        <label class="field"><span>Email</span><input class="input" id="su-email" type="email" autocomplete="username" inputmode="email" required></label>
        ${pw('su-pass', 'Password (8+ characters)', 'new-password')}
        ${btn('Create owner login')}
      </form>`;
  } else if (a.screen === 'schema') {
    body = `<h1>One more step</h1><p class="muted">Kerf is connected to Supabase, but the database tables aren’t set up yet.</p>${err}
      <ol class="auth-steps"><li>Click <b>Copy setup script</b> below.</li><li>In Supabase, open your project, then <b>SQL Editor</b> → <b>New query</b>.</li><li>Paste, then click <b>Run</b>. You should see “Success.”</li><li>Come back here and click <b>Check again</b>.</li></ol>
      <div class="btn-row"><button class="btn dark" data-act="copy-schema">${icon('copy')}Copy setup script</button><button class="btn primary" data-act="reload">Check again</button></div>`;
  } else if (a.screen === 'key') {
    const has = S.auth.cfg && S.auth.cfg.hasSecret;
    body = `<h1>${has ? 'Check the secret key' : 'Add the secret key'}</h1><p class="muted">${has ? 'Supabase isn’t accepting the secret key saved in Vercel.' : 'Kerf needs your Supabase secret key saved in Vercel to create logins.'}</p>
      <ol class="auth-steps"><li>In Supabase: <b>Project Settings</b> → <b>API Keys</b>. Copy the <b>secret</b> key.</li><li>In Vercel: your project → <b>Settings</b> → <b>Environment Variables</b>. Set <b>SUPABASE_SECRET_KEY</b> to that value.</li><li>Open <b>Deployments</b>, click the three dots on the latest one, choose <b>Redeploy</b>, then reload this page.</li></ol>
      <button class="btn primary" data-act="reload">Check again</button>`;
  } else if (a.screen === 'inactive') {
    body = `<h1>Your login is turned off</h1><p class="muted">Ask the owner or office to turn your access back on from the Team page.</p>
      <button class="btn primary" data-act="sign-out">Sign out</button>`;
  } else if (a.screen === 'loading') {
    body = `<h1>Opening your shop…</h1><div class="skeleton" style="padding:10px 0"><i style="height:14px"></i><i style="height:14px;width:70%"></i></div>`;
  } else {
    body = `<h1>Something went wrong</h1><p class="muted">${esc(a.err || 'Kerf couldn’t load.')}</p><button class="btn primary" data-act="reload">Try again</button>`;
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
  if (conf.keyProblem) { showAuth('key'); return; }
  SB.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') setTimeout(() => { stopRemote(); S.auth.user = null; S.mode = 'loading'; showAuth(S.auth.cfg && S.auth.cfg.needsSetup ? 'setup' : 'login'); }, 0);
  });
  const { data } = await SB.auth.getSession();
  if (data && data.session) { await enterRemote(data.session.user); return; }
  if (!conf.hasSecret) { showAuth('key'); return; }
  showAuth(conf.needsSetup ? 'setup' : 'login');
}
async function enterRemote(user) {
  S.auth.user = user; S.mode = 'db'; S.auth.screen = 'loading'; render(true);
  try { await loadRemote(); } catch (e) {
    if (e && (e.code === 'PGRST301' || /JWT/i.test(e.message || ''))) { await SB.auth.signOut(); return; }
    showAuth('error', 'Couldn’t load your shop: ' + ((e && e.message) || 'unknown error')); return;
  }
  if (!S.my || !S.my.active) { showAuth('inactive'); return; }
  S.auth.screen = null;
  startRealtime();
  if (isCrew()) { S.view = 'mywork'; S.params = {}; }
  render(true);
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
    await enterRemote(data.user);
  } else if (kind === 'setup') {
    const name = v('su-name'), email = v('su-email'), password = raw('su-pass');
    if (!name || !email || password.length < 8) { showAuthErr('Fill in your name, email, and a password with at least 8 characters.'); return; }
    setBusy(true);
    let j = {};
    try { const r = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) }); j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Setup failed.'); }
    catch (e) { setBusy(false); showAuthErr(e.message); return; }
    if (S.auth.cfg) S.auth.cfg.needsSetup = false;
    const { data, error } = await SB.auth.signInWithPassword({ email, password });
    if (error) { showAuth('login', 'Owner login created. Sign in to continue.'); return; }
    await enterRemote(data.user);
    toast('Welcome to Kerf. Start with your prices, then add your team.', { ms: 5000 });
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

/* ---------- team logins (owner/office) ---------- */
async function teamApi(body) {
  const { data } = await SB.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) throw new Error('Your sign-in expired. Reload and sign in again.');
  const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'That didn’t work. Try again.');
  return j;
}
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
    body: `<p class="muted" style="margin:0">They’ll sign in with this email and password. Give them the password in person or by text; they can keep it.</p>
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
  const text = `Kerf login for ${name}\nWebsite: ${site}\nEmail: ${email}\nPassword: ${password}`;
  openModal({
    title,
    body: `<p class="muted" style="margin:0">Send this to ${esc(name)}. This is the only time Kerf shows the password.</p>
      <div class="card"><div class="card-b" style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px"><span class="faint">Website</span><span class="mono" style="user-select:all;overflow-wrap:anywhere">${esc(site)}</span><span class="faint">Email</span><span class="mono" style="user-select:all;overflow-wrap:anywhere">${esc(email)}</span><span class="faint">Password</span><span class="mono" style="user-select:all">${esc(password)}</span></div></div>
      <p class="faint" style="margin:0;font-size:12.5px">On a phone, they can open the website and choose “Add to Home Screen” to use Kerf like an app.</p>`,
    foot: `<button class="btn" data-act="copy" data-text="${esc(text)}">${icon('copy')}Copy</button><button class="btn primary" data-act="close-modal">Done</button>`,
  });
}
function manageLoginModal(userId) {
  const mem = S.members.get(userId);
  if (!mem) return;
  const m = member(mem.team_id) || { name: mem.email };
  MS = { kind: 'manage', userId };
  const self = S.auth.user && S.auth.user.id === userId;
  openModal({
    title: `${m.name}’s login`,
    body: `<div class="muted" style="font-size:13px">Signs in as <b class="mono" style="user-select:all">${esc(mem.email || '')}</b></div>
      <label class="field"><span>What they can do</span><select class="input" id="ml-access">${accessOptions(mem.access)}</select></label>
      <label class="check"><input type="checkbox" id="ml-active" ${mem.active ? 'checked' : ''} ${self ? 'disabled' : ''}> Login is turned on</label>
      <div class="card"><div class="card-b" style="display:flex;flex-direction:column;gap:8px"><b>Reset password</b><div class="pw"><input class="input mono" id="ml-pass" value="${esc(makePassword())}" autocomplete="off"><button type="button" class="btn sm ghost" data-act="pw-new" data-for="ml-pass">New</button></div><div><button class="btn sm" data-act="ml-reset">Set this password</button></div></div></div>`,
    foot: `${self ? '' : `<button class="btn danger left" data-act="ml-remove">${icon('trash')}Remove login</button>`}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="ml-save">Save</button>`,
  });
}
const AUTH_ACTIONS = {
  'sign-out': () => signOut(),
  reload: () => location.reload(),
  'copy-schema': async () => {
    try { const r = await fetch('/supabase/schema.sql', { cache: 'no-store' }); const t = await r.text(); await copyText(t); }
    catch (e) { toast('Couldn’t load the script. Open supabase/schema.sql in your GitHub repo and copy it from there.', { bad: true, ms: 7000 }); }
  },
  'pw-toggle': (el) => { const i = document.getElementById(el.dataset.for); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; },
  'pw-new': (el) => { const i = document.getElementById(el.dataset.for); if (i) i.value = makePassword(); },
  'create-login': (el) => loginModal(el.dataset.id),
  'manage-login': (el) => manageLoginModal(el.dataset.id),
  'lg-create': async (el) => {
    const email = val('#lg-email').toLowerCase(), password = val('#lg-pass'), acc = val('#lg-access');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr('#lg-email', 'Enter a valid email address'); return; }
    if (password.length < 8) { fieldErr('#lg-pass', 'Use at least 8 characters'); return; }
    const m = member(MS.teamId);
    el.disabled = true; el.textContent = 'Creating…';
    try {
      await teamApi({ action: 'create', teamId: MS.teamId, email, password, access: acc });
      credentialsModal(m ? m.name : email, email, password);
    } catch (e) { el.disabled = false; el.textContent = 'Create login'; toast(e.message, { bad: true, ms: 6000 }); }
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
    catch (e) { el.disabled = false; toast(e.message, { bad: true, ms: 6000 }); }
  },
  'ml-remove': async () => {
    const userId = MS.userId; const mem = S.members.get(userId); const m = mem ? member(mem.team_id) : null;
    if (!(await confirmBox(`Remove ${m ? m.name : 'this person'}’s login?`, 'They won’t be able to sign in. Their name stays on the team and on past jobs.', 'Remove login', true))) return;
    try { await teamApi({ action: 'remove', userId }); toast('Login removed'); } catch (e) { toast(e.message, { bad: true, ms: 6000 }); }
  },
};
document.addEventListener('submit', (e) => {
  const f = e.target.closest && e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  submitAuth(f);
});
