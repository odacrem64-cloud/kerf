/* =========================================================
   Shell: navigation, rendering, banners
   ========================================================= */
const NAV = [
  { id: 'dashboard', name: 'Dashboard', icon: 'home' },
  { id: 'calendar', name: 'Calendar', icon: 'cal' },
  { id: 'jobs', name: 'Jobs', icon: 'board' },
  { id: 'mywork', name: 'My Work', icon: 'work' },
  null,
  { id: 'customers', name: 'Accounts', icon: 'users' },
  { id: 'inventory', name: 'Inventory', icon: 'slab' },
  { id: 'team', name: 'Team', icon: 'team' },
  { id: 'settings', name: 'Prices & Settings', icon: 'tag' },
];
const VIEWS = {};
const IS_MAC = /Mac|iPhone|iPad/.test((navigator && (navigator.userAgentData && navigator.userAgentData.platform || navigator.platform)) || '');
const navActive = () => ({ job: 'jobs', quote: 'jobs', customer: 'customers' }[S.view] || S.view);

const CREW_VIEWS = ['mywork', 'calendar', 'job', 'inventory'];
const navFor = () => (isCrew() ? NAV.filter((n) => n && ['mywork', 'calendar', 'inventory'].includes(n.id)) : NAV);
function renderRail() {
  const rail = $('#rail');
  if (!rail) return;
  const act = navActive();
  const counts = {
    jobs: allJobs().filter((j) => !['closed', 'lost'].includes(j.stage)).length,
    team: S.mode === 'db' && isAdmin() ? pendingMembers().length : 0,
    mywork: S.me ? Array.from(S.activities.values()).filter((a) => a.date === today() && a.status !== 'done' && (a.crew || []).includes(S.me)).length : 0,
  };
  const team = activeTeam();
  const sync = S.mode === 'db' ? (S.live ? `<div class="sync live"><i></i>Live · synced with your team</div>` : `<div class="sync local"><i></i>Reconnecting…</div>`) : S.mode === 'local' ? `<div class="sync local"><i></i>Demo · this device only</div>` : `<div class="sync"><i></i>Connecting…</div>`;
  const meM = member(S.me);
  const who = S.mode === 'db'
    ? `<div style="display:flex;align-items:center;gap:9px;min-width:0"><button class="me-btn" data-act="my-profile" title="Your profile and photo">${meM ? avatar(meM) : ''}</button><div style="min-width:0;flex:1"><div style="color:var(--rail-ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meM ? meM.name : (S.auth.user && S.auth.user.email) || '')}</div><div>${esc(ACCESS_LABEL[access()] || '')}</div></div><button class="btn sm ghost" style="color:var(--rail-ink-2)" data-act="sign-out">Sign out</button></div>${S.myShops.length > 1 ? '<button class="btn sm ghost" style="color:var(--rail-ink-2);justify-content:flex-start;padding-left:0" data-act="switch-shop">Switch shop</button>' : ''}`
    : null;
  rail.innerHTML = `
    ${(() => { const logo = safeImg(cfg().logo); const nm = shopName(); return logo
      ? `<div class="brand has-logo"><img class="brand-logo" src="${logo}" alt="${esc(nm || SHOP.name)}"><div class="brand-sub">${esc(SHOP.app)}</div></div>`
      : `<div class="brand">${BRAND}<div style="min-width:0"><div class="brand-name">${esc(nm || SHOP.name)}</div><div class="brand-sub">${esc(SHOP.city)}</div></div></div>`; })()}
    ${navFor().map((n) => (n ? `<button class="nav-item" data-act="go" data-view="${n.id}" ${act === n.id ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.name}</span>${counts[n.id] ? `<span class="count">${counts[n.id]}</span>` : ''}</button>` : '<div class="nav-sep"></div>')).join('')}
    <div class="rail-foot">
      ${who || `<label class="field"><span style="color:var(--rail-ink-2);font-weight:600">Working as</span>
        <select id="me-select" data-change="me">${team.length ? `<option value="" ${!S.me ? 'selected' : ''}>Choose your name</option>` + team.map((m) => `<option value="${esc(m.id)}" ${S.me === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('') : '<option value="">Add your team first</option>'}</select></label>${S.me ? '<button class="btn sm ghost" style="color:var(--rail-ink-2);justify-content:flex-start;padding-left:0" data-act="my-profile">My photo</button>' : ''}`}
      ${sync}
    </div>`;
}
function renderTabbar() {
  const tb = $('#tabbar');
  if (!tb) return;
  const act = navActive();
  const items = isCrew() ? [['mywork', 'My Work', 'work'], ['calendar', 'Calendar', 'cal'], ['inventory', 'Slabs', 'slab']] : [['dashboard', 'Home', 'home'], ['calendar', 'Calendar', 'cal'], ['jobs', 'Jobs', 'board'], ['mywork', 'My Work', 'work']];
  const moreOn = ['customers', 'inventory', 'team', 'settings'].includes(act);
  tb.innerHTML = items.map(([id, name, ic]) => `<button data-act="go" data-view="${id}" ${act === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${name}</span></button>`).join('')
    + `<button data-act="more" ${moreOn ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span></button>`;
}
function bannerHTML() {
  if (S.mode === 'local') {
    const why = S.demoReason === 'keys' ? 'This site isn’t connected to Supabase yet. Add the Supabase keys in Vercel (see the setup guide) and redeploy.' : 'Sample shop in this browser only.';
    return `<div class="banner"><b>Demo mode.</b><span>${why}</span>${S.view === 'settings' ? '' : '<button class="btn sm" data-act="go" data-view="settings">Data options</button>'}</div>`;
  }
  if (S.mode === 'db' && !S.canWrite) return `<div class="banner"><b>View only.</b><span>Ask the office to give you edit access.</span></div>`;
  if (S.mode === 'db' && hasSample() && isAdmin() && ['dashboard', 'jobs', 'calendar'].includes(S.view)) {
    return `<div class="banner"><b>Sample data is loaded.</b><span>Items tagged SAMPLE are examples. Remove them when you’re ready to go live.</span><button class="btn sm" data-act="remove-sample">Remove sample data</button></div>`;
  }
  return '';
}
function topbarHTML(r) {
  const crumb = r.crumb ? `<span class="crumb">${r.crumb}</span>` : '';
  const back = r.back ? `<button class="btn icon ghost" data-act="go" data-view="${r.back.view}" ${r.back.id ? `data-id="${esc(r.back.id)}"` : ''} aria-label="Back">${icon('back')}</button>` : '';
  const newBtn = r.noNew || !S.canWrite || isCrew() ? '' : `<button class="btn primary" data-act="new-job">${icon('plus')}<span class="lbl">New quote</span></button>`;
  return `<header class="topbar">${back}<h1>${crumb}${r.title}</h1>${r.actions || ''}<button class="search-btn" data-act="palette" aria-label="Search jobs and customers">${icon('search')}<span class="lbl">Search jobs, customers</span><kbd>${IS_MAC ? '⌘K' : 'Ctrl K'}</kbd></button><button class="btn icon help-top" data-act="help-open" aria-label="AI Shop Assistant" title="AI Shop Assistant">${icon('robot')}</button>${newBtn}</header>`;
}
function skeletonHTML() {
  return `<header class="topbar"><h1>Loading your shop…</h1></header><div class="skeleton" aria-busy="true"><i></i><i style="height:120px"></i><i style="height:220px"></i></div>`;
}

let mountedKey = '';
function render(force = false) {
  const main = $('#main');
  if (!main) return;
  if (S.auth.screen) {
    document.body.classList.add('authmode');
    if (typeof renderHelp === 'function') renderHelp();
    const key = 'auth:' + S.auth.screen;
    if (force || mountedKey !== key) { main.innerHTML = authHTML(); mountedKey = key; const f = $('[autofocus]', main); if (f) setTimeout(() => f.focus(), 30); }
    return;
  }
  document.body.classList.remove('authmode');
  if (typeof renderHelp === 'function' && !$('#help').innerHTML) renderHelp();
  renderRail();
  renderTabbar();
  if (!isLoaded()) { main.innerHTML = skeletonHTML(); mountedKey = ''; return; }
  const key = S.view + ':' + (S.params.id || '');
  /* the quote builder holds an unsaved draft: never rebuild it from a background update */
  if (!force && S.view === 'quote' && mountedKey === key) { if (typeof quoteRefreshHeader === 'function') quoteRefreshHeader(); return; }
  const ae = document.activeElement;
  let focusId = null, selS = null, selE = null;
  if (ae && ae.id && main.contains(ae)) { focusId = ae.id; try { selS = ae.selectionStart; selE = ae.selectionEnd; } catch (e) { /* not text */ } }
  const scrolls = {};
  $$('[data-keep-scroll]', main).forEach((el) => { scrolls[el.dataset.keepScroll] = [el.scrollLeft, el.scrollTop]; });
  const v = VIEWS[S.view] || VIEWS.dashboard;
  let r;
  try { r = v(S.params); } catch (e) { console.error(e); r = { title: 'Something went wrong', body: `<div class="card"><div class="empty"><b>This page hit an error.</b><span>${esc(e.message)}</span><button class="btn" data-act="go" data-view="dashboard">Back to dashboard</button></div></div>` }; }
  main.innerHTML = topbarHTML(r) + `<div class="page">${bannerHTML()}${r.body}</div>`;
  mountedKey = key;
  $$('[data-keep-scroll]', main).forEach((el) => { const s = scrolls[el.dataset.keepScroll]; if (s) { el.scrollLeft = s[0]; el.scrollTop = s[1]; } });
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); try { if (selS != null) el.setSelectionRange(selS, selE); } catch (e) { /* noop */ } }
  }
  if (r.mount) r.mount();
}

async function go(view, params = {}) {
  if (S.view === 'quote' && S.qdraft && S.qdraft.dirty && !(view === 'quote' && params.id === S.params.id)) {
    const ok = await confirmBox('Leave without saving this quote?', 'Your changes to the quote will be lost.', 'Discard changes', true);
    if (!ok) return;
  }
  if (S.view === 'settings' && S.sdraft && S.sdraft._dirty && view !== 'settings') {
    const ok = await confirmBox('Leave without saving settings?', 'Your price list and settings changes will be lost.', 'Discard changes', true);
    if (!ok) return;
  }
  if (isCrew() && !CREW_VIEWS.includes(view)) { view = 'mywork'; params = {}; }
  if (view !== 'quote') S.qdraft = null;
  if (view !== 'settings') S.sdraft = null;
  if (view === 'job') subscribeJobNotes(params.id); else if (S.jobNotesFor) unsubscribeJobNotes();
  if (view === 'quote') initQuoteDraft(params.id);
  S.view = view; S.params = params;
  closeModal();
  const main = $('#main');
  if (main) main.scrollTop = 0;
  render(true);
}
