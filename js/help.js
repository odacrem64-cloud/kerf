/* =========================================================
   Helper panel: "How do I…?"
   Uses Claude through /api/help when the site has an Anthropic key, built-in answers otherwise.
   ========================================================= */
const H = { open: false, msgs: [], busy: false };
const aiOn = () => S.mode === 'db' && S.auth.cfg && S.auth.cfg.ai;
const SUGGEST = {
  crew: ['How do I mark a job done?', 'How do I flag a problem?', 'How do I add my profile picture?', 'How do I put Kerf on my phone?'],
  other: ['How do I write a quote?', 'What do the F B L R buttons mean?', 'How do I invite my crew?', 'How do I send the quote to the customer?'],
};
function mdLite(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}
function kbSearch(q) {
  const words = String(q).toLowerCase().replace(/[^a-z0-9\s/]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['how', 'the', 'and', 'for', 'can', 'what', 'does', 'with', 'where', 'are', 'you', 'this', 'that', 'there', 'mean'].includes(w));
  const scored = HELP_KB.map((x) => {
    const hay = (x.q + ' ' + x.k).toLowerCase();
    let s = 0;
    for (const w of words) { if (hay.includes(w)) s += x.k.includes(w) ? 2 : 1; else if (w.length > 4 && hay.includes(w.slice(0, -1))) s += 1; }
    return { x, s };
  }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
  return scored;
}
function renderHelp() {
  const box = $('#help');
  if (!box) return;
  if (S.auth.screen) { box.innerHTML = ''; return; }
  const sug = isCrew() ? SUGGEST.crew : SUGGEST.other;
  if (!H.open) { box.innerHTML = `<button class="help-fab" data-act="help-open" aria-label="Open the helper">${icon('help')}<span>Help</span></button>`; return; }
  const msgs = H.msgs.length ? H.msgs.map((m) => `<div class="hmsg ${m.role}">${m.role === 'assistant' ? mdLite(m.content) : esc(m.content)}${m.related && m.related.length ? `<div class="hrel">${m.related.map((r) => `<button class="chip" data-act="help-ask" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}</div>`).join('')
    : `<div class="hmsg assistant">Hi${member(S.me) ? ' ' + esc(member(S.me).name.split(' ')[0]) : ''}! Ask me how to do anything in Kerf.${aiOn() ? '' : ' <span class="faint">(Quick answers mode)</span>'}</div>`;
  box.innerHTML = `<aside class="help-panel" role="dialog" aria-label="Kerf helper">
    <div class="help-h">${icon('help')}<b>Kerf helper</b><button class="btn icon ghost" data-act="help-close" aria-label="Close helper">${icon('close')}</button></div>
    <div class="help-b" id="help-b">${msgs}${H.busy ? '<div class="hmsg assistant typing"><i></i><i></i><i></i></div>' : ''}
      ${H.msgs.length ? '' : `<div class="hrel">${sug.map((q) => `<button class="chip" data-act="help-ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}</div>
    <form class="help-f" data-help-form><input class="input" id="help-q" placeholder="How do I…" autocomplete="off" maxlength="500"><button class="btn primary" type="submit" ${H.busy ? 'disabled' : ''}>Ask</button></form>
  </aside>`;
  const b = $('#help-b'); if (b) b.scrollTop = b.scrollHeight;
}
async function helpAsk(q) {
  q = String(q || '').trim();
  if (!q || H.busy) return;
  H.msgs.push({ role: 'user', content: q });
  if (aiOn()) {
    H.busy = true; renderHelp();
    try {
      const j = await postJSON('/api/help', { shopId: S.shopId, view: S.view, messages: H.msgs.map((m) => ({ role: m.role, content: m.content })) });
      H.msgs.push({ role: 'assistant', content: j.text });
    } catch (e) {
      H.msgs.push(localAnswer(q));
    }
    H.busy = false;
  } else {
    H.msgs.push(localAnswer(q));
  }
  renderHelp();
  const i = $('#help-q'); if (i) i.focus();
}
function localAnswer(q) {
  const hits = kbSearch(q);
  if (!hits.length) return { role: 'assistant', content: 'I’m not sure about that one. Try one of these:', related: (isCrew() ? SUGGEST.crew : SUGGEST.other) };
  return { role: 'assistant', content: hits[0].x.a, related: hits.slice(1, 3).map((h) => h.x.q) };
}
document.addEventListener('submit', (e) => {
  if (!e.target.matches || !e.target.matches('[data-help-form]')) return;
  e.preventDefault();
  const i = $('#help-q'); const v = i ? i.value : '';
  if (i) i.value = '';
  helpAsk(v);
});
const HELP_ACTIONS = {
  'help-open': () => { H.open = true; renderHelp(); setTimeout(() => { const i = $('#help-q'); if (i) i.focus(); }, 30); },
  'help-close': () => { H.open = false; renderHelp(); },
  'help-ask': (el) => helpAsk(el.dataset.q),
};
