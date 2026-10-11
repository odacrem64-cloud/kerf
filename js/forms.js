/* =========================================================
   Printable forms (like Moraware Forms & Activity Packets)
   - Job sheet: everything the shop floor and install crew need, no prices
   - Day packet: each crew member's work for a day, one page per person
   ========================================================= */
const FORM_CSS = `
*{box-sizing:border-box}body{margin:0;padding:24px;font:12.5px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff}
h1{font-size:22px;margin:0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 6px;padding-bottom:4px;border-bottom:2px solid #1a1a1a}
h3{font-size:13px;margin:12px 0 4px}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#777;padding:4px 6px;border-bottom:1px solid #ccc}
td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}.mono{font-variant-numeric:tabular-nums}.muted{color:#666}.r{text-align:right}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #1a1a1a;padding-bottom:10px}
.brand{display:flex;gap:12px;align-items:center}.brand img{max-height:64px;max-width:160px;object-fit:contain}
.big{font-size:24px;font-weight:800;letter-spacing:.01em}.kicker{font-size:10.5px;letter-spacing:.16em;color:#888;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 18px;margin-top:10px}.k{font-size:10.5px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.box{border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin:6px 0;break-inside:avoid}.drawing{border:1px solid #eee;border-radius:6px;margin:6px 0;break-inside:avoid}
.drawing svg{width:100%;height:auto;display:block}.sig{display:flex;gap:24px;margin-top:28px}.sig div{flex:1;border-top:1px solid #999;padding-top:4px;font-size:11px;color:#666}
.issue{background:#fbe9e7;border-left:3px solid #BE3328;padding:4px 8px;margin:3px 0}.check{display:inline-block;width:11px;height:11px;border:1px solid #555;margin-right:6px;vertical-align:-1px}
.check.on{background:#1a1a1a}.person{break-before:page}.person:first-of-type{break-before:auto}.act{border:1px solid #ccc;border-left:5px solid var(--c,#555);border-radius:6px;padding:10px 12px;margin:10px 0;break-inside:avoid}
.act .top{display:flex;justify-content:space-between;gap:10px;font-weight:700}.est{color:#A86C12;font-weight:700}
@page{margin:12mm}@media print{body{padding:0}}`;
const docShell = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${FORM_CSS}</style></head><body>${body}</body></html>`;
const printColor = (c) => (isHex(c) ? c : ({ 'var(--t-template)': '#2D5C9C', 'var(--t-fab)': '#7650AD', 'var(--t-install)': '#2D7A4C', 'var(--t-service)': '#A86C12', 'var(--t-other)': '#68716D' })[c] || '#555');
function formHead(kicker, big, sub) {
  const c = cfg();
  const logo = safeImg(c.logo);
  return `<div class="head"><div class="brand">${logo ? `<img src="${logo}" alt="">` : ''}<div>${logo ? '' : `<div style="font-size:18px;font-weight:800">${esc(shopName() || 'Countertop shop')}</div>`}<div class="muted">${esc(c.shopPhone || '')}${c.shopPhone && c.shopAddress ? ' · ' : ''}${esc(c.shopAddress || '')}</div></div></div>
    <div style="text-align:right"><div class="kicker">${esc(kicker)}</div><div class="big">${esc(big)}</div><div class="muted">${esc(sub)}</div></div></div>`;
}
const edgeList = (p) => { const e = p.edges || {}; return ['f', 'b', 'l', 'r'].filter((k) => e[k]).map((k) => ({ f: 'Front', b: 'Back', l: 'Left', r: 'Right' })[k]).join(', ') || '—'; };

function jobSheetHTML(jobId) {
  const j = jobOf(jobId);
  if (!j) return '';
  const c = customer(j.customerId) || {};
  const q = j.quote;
  const site = j.address || c.address || '';
  const sales = member(j.salesId);
  const acts = actsForJob(j.id);
  const slabs = slabsForJob(j.id);
  const files = filesForJob(j.id);
  const notes = notesForJob(j.id).filter((n) => n.kind !== 'event');
  const ck = j.checklist || {};
  const now = new Date();
  let html = formHead('JOB SHEET', j.number, `Printed ${MON[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`);
  html += `<div style="margin-top:12px"><h1>${esc(j.name)}</h1></div>
  <div class="grid">
    <div><div class="k">Account</div>${esc(c.name || '')}${c.phone ? `<br><span class="mono">${esc(c.phone)}</span>` : ''}</div>
    <div><div class="k">Job site</div>${esc(site || '—')}</div>
    <div><div class="k">On-site contact</div>${esc(j.siteContact || '—')}${j.sitePhone ? `<br><span class="mono">${esc(j.sitePhone)}</span>` : ''}</div>
    <div><div class="k">Salesperson</div>${esc(sales ? sales.name : '—')}</div>
    <div><div class="k">Stage</div>${esc(stageName(j.stage))}</div>
    <div><div class="k">PO / lot</div>${esc(j.po || '—')}</div>
  </div>`;
  html += `<h2>Schedule</h2>${acts.length ? `<table><thead><tr><th>Activity</th><th>Status</th><th>Date</th><th>Time</th><th>Crew</th><th>Notes</th></tr></thead><tbody>${acts.map((a) => `<tr><td><b>${esc(actType(a.type).name)}</b></td><td>${esc(actStatusName(a.status))}</td><td>${esc(fmtD(a.date))}</td><td>${esc(a.time ? fmtTime(a.time) : a.duration || '')}</td><td>${esc((a.crew || []).map(member).filter(Boolean).map((m) => m.name).join(', '))}</td><td>${esc(a.notes || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing scheduled.</p>'}`;
  if (q) {
    for (const a of q.areas || []) {
      const ac = calcQuote({ ...q, areas: [a], lines: [] }).areas[0];
      const addons = (a.addons || []).filter((x) => x.count).map((x) => (x.count > 1 ? x.count + '× ' : '') + x.name).join(', ');
      html += `<h2>${esc(a.name)}</h2>
      <div class="grid" style="margin-top:4px"><div><div class="k">Material</div>${esc(a.mat ? a.mat.name : '')}</div><div><div class="k">Thickness · Edge</div>${esc([a.thick, a.edge && a.edge.name].filter(Boolean).join(' · ') || '—')}</div><div><div class="k">Cutouts & extras</div>${esc(addons || '—')}${a.tearOut ? '<br>Tear-out existing tops' : ''}</div></div>
      <div class="drawing">${areaSVG(a, PAL_DOC, 680, 'js-')}</div>
      <table><thead><tr><th>Piece</th><th class="r">Length</th><th class="r">Depth</th><th>Finished edges</th><th class="r">Sq ft</th></tr></thead><tbody>${(a.pieces || []).filter((p) => p.L && p.D).map((p) => `<tr><td>${esc(p.label || 'Piece')}${p.kind === 'splash' ? ' (splash)' : ''}</td><td class="r mono">${esc(fmtIn(p.L))}</td><td class="r mono">${esc(fmtIn(p.D))}</td><td>${p.kind === 'splash' ? '—' : esc(edgeList(p))}</td><td class="r">${sqft1(pieceSqft(p))}</td></tr>`).join('')}
      <tr><td colspan="4" class="r"><b>Total</b> · ${ac.edgeLf.toFixed(1)} LF finished edge</td><td class="r"><b>${sqft1(ac.sqft)}</b></td></tr></tbody></table>`;
    }
  } else html += '<h2>Pieces</h2><p class="muted">No quote yet.</p>';
  html += `<h2>Slabs</h2>${slabs.length ? `<table><thead><tr><th>Serial</th><th>Color</th><th class="r">Size</th><th>Thick</th><th>Location</th><th>Status</th></tr></thead><tbody>${slabs.map((s) => `<tr><td class="mono">${esc(s.serial)}</td><td>${esc(slabName(s))}${s.kind === 'remnant' ? ' (remnant)' : ''}</td><td class="r mono">${esc(slabSize(s))}</td><td>${esc(s.thick || '')}</td><td>${esc(s.location || '')}</td><td>${esc((SLAB_STATUS.find((x) => x.id === s.status) || {}).name || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No slabs allocated.</p>'}`;
  if (files.length) html += `<h2>Files on this job</h2><p>${files.map((f) => esc(f.name)).join(' · ')}</p>`;
  html += `<h2>Checklist</h2><p>${CHECKS.map((x) => `<span style="margin-right:16px;white-space:nowrap"><span class="check ${ck[x.id] ? 'on' : ''}"></span>${esc(x.name)}</span>`).join('')}</p>`;
  if (notes.length) html += `<h2>Notes</h2>${notes.slice(0, 12).map((n) => `<div class="${n.kind === 'issue' ? 'issue' : ''}" style="margin:3px 0"><b>${esc((member(n.by) || {}).name || '')}</b> <span class="muted">${esc(fmtDshort(dstr(new Date(n.at || Date.now()))))}</span> — ${esc(n.text)}</div>`).join('')}`;
  html += `<div class="sig"><div>Templated by / date</div><div>Fabricated by / date</div><div>Installed by / date</div><div>Customer signature</div></div>`;
  return docShell(`Job sheet ${j.number}`, html);
}

function dayPacketHTML(date, onlyMember) {
  const acts = actsOnDate(date).filter((a) => !S.ui.calHide.includes(a.type));
  const people = [];
  const byPerson = new Map();
  for (const a of acts) {
    const crew = (a.crew || []).length ? a.crew : [''];
    for (const id of crew) {
      if (onlyMember && id !== onlyMember) continue;
      if (!byPerson.has(id)) { byPerson.set(id, []); people.push(id); }
      byPerson.get(id).push(a);
    }
  }
  people.sort((x, y) => (x === '' ? 1 : y === '' ? -1 : String((member(x) || {}).name).localeCompare(String((member(y) || {}).name))));
  const d = parseD(date);
  const nice = `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (!people.length) return docShell(`Day packet ${date}`, formHead('DAY PACKET', nice, '') + '<p style="margin-top:20px" class="muted">Nothing scheduled for this day.</p>');
  const body = people.map((pid) => {
    const m = member(pid);
    const list = byPerson.get(pid);
    return `<section class="person">${formHead('DAY PACKET', nice, m ? `${m.name} · ${list.length} stop${list.length === 1 ? '' : 's'}` : 'Unassigned')}
      ${list.map((a) => {
        const j = jobOf(a.jobId) || {};
        const c = customer(j.customerId) || {};
        const site = j.address || c.address || '';
        const sl = slabsForJob(j.id).filter((s) => s.status === 'allocated');
        const addons = quoteAddonSummary(j.quote);
        const thick = Array.from(new Set(((j.quote && j.quote.areas) || []).map((x) => x.thick).filter(Boolean))).join(', ');
        return `<div class="act" style="--c:${printColor(actType(a.type).color)}"><div class="top"><span>${esc(actType(a.type).name)}${a.time ? ' · ' + esc(fmtTime(a.time)) : ''}${a.duration ? ' · ' + esc(a.duration) : ''} ${a.status === 'estimate' ? '<span class="est">ESTIMATE</span>' : ''}</span><span class="mono">${esc(j.number || '')}</span></div>
          <div style="font-size:15px;font-weight:700;margin:2px 0">${esc(j.name || '')} — ${esc(c.name || '')}</div>
          <table><tbody>
            ${site ? `<tr><td class="k" style="width:110px">Site</td><td>${esc(site)}</td></tr>` : ''}
            ${j.siteContact || j.sitePhone || c.phone ? `<tr><td class="k">Contact</td><td>${esc(j.siteContact || c.name || '')} <span class="mono">${esc(j.sitePhone || c.phone || '')}</span></td></tr>` : ''}
            ${j.material ? `<tr><td class="k">Stone</td><td>${esc(j.material)}${thick ? ' · ' + esc(thick) : ''}${j.sqft ? ` · ${sqft1(j.sqft)} sq ft` : ''}</td></tr>` : ''}
            ${j.edge ? `<tr><td class="k">Edge</td><td>${esc(j.edge)}</td></tr>` : ''}
            ${addons ? `<tr><td class="k">Cutouts</td><td>${esc(addons)}</td></tr>` : ''}
            ${sl.length ? `<tr><td class="k">Slabs</td><td>${sl.map((s) => `<span class="mono">${esc(s.serial)}</span> ${esc(slabName(s))}${s.location ? ' @ ' + esc(s.location) : ''}`).join('; ')}</td></tr>` : ''}
            ${(a.crew || []).length > 1 ? `<tr><td class="k">With</td><td>${esc(a.crew.filter((x) => x !== pid).map(member).filter(Boolean).map((x) => x.name).join(', '))}</td></tr>` : ''}
            ${a.notes ? `<tr><td class="k">Notes</td><td><b>${esc(a.notes)}</b></td></tr>` : ''}
          </tbody></table>
          <div class="sig" style="margin-top:14px"><div>Done — initials / time</div><div>Problems?</div></div></div>`;
      }).join('')}</section>`;
  }).join('');
  return docShell(`Day packet ${date}`, body);
}

const FORM_ACTIONS = {
  'print-jobsheet': (el) => { const h = jobSheetHTML(el.dataset.id); if (h) printHTML(h); },
  'print-day': (el) => {
    const d = el.dataset.date || today();
    const only = isCrew() ? S.me : S.ui.calCrew || '';
    printHTML(dayPacketHTML(d, only));
  },
};
