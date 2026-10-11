/* =========================================================
   Quote model, pricing math, slab nesting, drawings
   ========================================================= */
const matSnap = (m) => (m ? { id: m.id, name: m.name, group: m.group, price: Number(m.price) || 0, color: m.color || '#ccc' } : null);
const edgeSnap = (e) => (e ? { id: e.id, name: e.name, price: Number(e.price) || 0 } : null);

function newPiece(label = '', L = 0, D = 25.5, kind = 'top', edges) {
  return { id: uid(), label, L, D, kind, edges: edges || (kind === 'splash' ? { f: false, b: false, l: false, r: false } : { f: true, b: false, l: false, r: false }) };
}
function newArea(name = 'Kitchen', c = cfg()) {
  const mat = c.materials.find((m) => /quartz/i.test(m.group)) || c.materials[0];
  const base = { id: uid(), name, mat: matSnap(mat), edge: edgeSnap(c.edges[0]), thick: /porcelain/i.test((mat && mat.group) || '') ? '1.2cm' : '3cm', tearOut: false, tearPrice: Number(c.tearOutPerSqft) || 0, addons: [], pieces: [] };
  if (/island/i.test(name)) base.pieces.push(newPiece('Island', 0, 42, 'top', { f: true, b: true, l: true, r: true }));
  else if (/vanity/i.test(name)) base.pieces.push(newPiece('Vanity top', 0, 22.5, 'top', { f: true, b: false, l: false, r: false }));
  else if (/bar/i.test(name)) base.pieces.push(newPiece('Bar top', 0, 14, 'top', { f: true, b: true, l: false, r: false }));
  else if (/fireplace/i.test(name)) base.pieces.push(newPiece('Hearth', 0, 18, 'top', { f: true, b: false, l: true, r: true }));
  else if (/shower/i.test(name)) { base.pieces.push(newPiece('Curb', 0, 6, 'top', { f: true, b: true, l: false, r: false })); base.pieces.push(newPiece('Niche shelf', 12, 4, 'top', { f: true, b: false, l: false, r: false })); }
  else base.pieces.push(newPiece('Main run', 0, 25.5));
  return base;
}
function newQuote(c = cfg()) {
  return {
    areas: [newArea('Kitchen', c)], lines: [], discount: { type: 'pct', value: 0 },
    taxRate: Number(c.taxRate) || 0, depositPct: Number(c.depositPct) || 0, payInFullUnder: Number(c.payInFullUnder) || 0, minCharge: Number(c.minCharge) || 0,
    validDays: Number(c.quoteValidDays) || 30, notes: '', createdAt: Date.now(),
  };
}

/* edge length in linear feet for one piece */
const pieceEdgeLf = (p) => { const e = p.edges || {}; return ((e.f ? p.L : 0) + (e.b ? p.L : 0) + (e.l ? p.D : 0) + (e.r ? p.D : 0)) / 12; };
const pieceSqft = (p) => ((Number(p.L) || 0) * (Number(p.D) || 0)) / 144;

function calcQuote(q, c = cfg()) {
  const areas = (q.areas || []).map((a) => {
    const sqft = sum(a.pieces || [], pieceSqft);
    const edgeLf = sum((a.pieces || []).filter((p) => p.kind !== 'splash'), pieceEdgeLf);
    const matCost = round2(sqft * ((a.mat && a.mat.price) || 0));
    const edgeCost = round2(edgeLf * ((a.edge && a.edge.price) || 0));
    const addonCost = round2(sum(a.addons || [], (x) => (x.price || 0) * (x.count || 0)));
    const tearCost = a.tearOut ? round2(sqft * (a.tearPrice || 0)) : 0;
    return { id: a.id, name: a.name, sqft, edgeLf, matCost, edgeCost, addonCost, tearCost, total: round2(matCost + edgeCost + addonCost + tearCost) };
  });
  const areasTotal = round2(sum(areas, (a) => a.total));
  const extras = round2(sum(q.lines || [], (l) => l.amount));
  let subtotal = round2(areasTotal + extras);
  const minAdj = subtotal > 0 && q.minCharge && subtotal < q.minCharge ? round2(q.minCharge - subtotal) : 0;
  subtotal = round2(subtotal + minAdj);
  const dv = Number((q.discount || {}).value) || 0;
  const discount = round2((q.discount || {}).type === 'amt' ? Math.min(dv, subtotal) : (subtotal * clamp(dv, 0, 100)) / 100);
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * (Number(q.taxRate) || 0)) / 100);
  const total = round2(taxable + tax);
  const pif = q.payInFullUnder != null ? Number(q.payInFullUnder) || 0 : Number(c.payInFullUnder) || 0;
  const payFull = total > 0 && pif > 0 && total < pif;
  const deposit = payFull ? total : round2((total * (Number(q.depositPct) || 0)) / 100);
  const sqft = sum(areas, (a) => a.sqft);
  const edgeLf = sum(areas, (a) => a.edgeLf);
  const nest = nestQuote(q, c);
  return { areas, areasTotal, extras, minAdj, subtotal, discount, taxable, tax, total, deposit, payFull, pif, sqft, edgeLf, nest };
}

/* ---------- slab nesting (shelf packing with seams) ---------- */
function nestQuote(q, c = cfg()) {
  const W = Number(c.slabL) || 126, H = Number(c.slabW) || 63, KERF = 0.75;
  const groups = new Map();
  let seams = 0;
  for (const a of q.areas || []) {
    const key = (a.mat && (a.mat.id + '|' + a.mat.name)) || 'none';
    if (!groups.has(key)) groups.set(key, { mat: a.mat, items: [], sqft: 0 });
    const g = groups.get(key);
    for (const p of a.pieces || []) {
      let L = Number(p.L) || 0, D = Number(p.D) || 0;
      if (!L || !D) continue;
      g.sqft += pieceSqft(p);
      let long = Math.max(L, D), short = Math.min(L, D);
      if (short > H) { g.items.push({ w: long, h: short, label: p.label || a.name, over: true }); continue; }
      const parts = long > W ? Math.ceil(long / (W - 2)) : 1;
      seams += parts - 1;
      for (let i = 0; i < parts; i++) g.items.push({ w: long / parts, h: short, label: (p.label || a.name) + (parts > 1 ? ` ${i + 1}/${parts}` : ''), area: a.name });
    }
  }
  const out = [];
  for (const g of groups.values()) {
    if (!g.items.length) continue;
    const slabs = packShelves(g.items, W, H, KERF);
    const slabSqft = (W * H) / 144;
    out.push({ mat: g.mat, slabs, sqft: g.sqft, yieldPct: slabs.length ? Math.round((g.sqft / (slabs.length * slabSqft)) * 100) : 0 });
  }
  return { materials: out, slabs: sum(out, (m) => m.slabs.length), seams, W, H };
}
function packShelves(items, W, H, gap) {
  const sorted = items.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  const slabs = [];
  const place = (s, it) => {
    for (const [w, h] of [[it.w, it.h], [it.h, it.w]]) {
      if (w > W + 0.01 || h > H + 0.01) continue;
      for (const sh of s.shelves) {
        if (h <= sh.h + 0.01 && sh.x + w <= W + 0.01) { s.parts.push({ ...it, x: sh.x, y: sh.y, w, h }); sh.x += w + gap; return true; }
      }
      if (s.used + h <= H + 0.01) {
        const sh = { y: s.used, h, x: w + gap };
        s.shelves.push(sh); s.used += h + gap;
        s.parts.push({ ...it, x: 0, y: sh.y, w, h });
        return true;
      }
    }
    return false;
  };
  for (const it of sorted) {
    if (it.over) { slabs.push({ shelves: [], used: H, parts: [{ ...it, x: 0, y: 0, w: Math.min(it.w, W), h: Math.min(it.h, H) }] }); continue; }
    let ok = false;
    for (const s of slabs) if (place(s, it)) { ok = true; break; }
    if (!ok) { const s = { shelves: [], used: 0, parts: [] }; slabs.push(s); place(s, it); }
  }
  return slabs;
}

/* ---------- SVG: stone fill pattern ---------- */
function stonePattern(pid, color) {
  const dark = isDark(color);
  const v = dark ? 'rgba(255,255,255,.16)' : 'rgba(40,40,40,.13)';
  const v2 = dark ? 'rgba(255,255,255,.08)' : 'rgba(40,40,40,.07)';
  return `<pattern id="${pid}" width="160" height="120" patternUnits="userSpaceOnUse"><rect width="160" height="120" fill="${esc(color)}"/>`
    + `<path d="M-10 92 C 30 70, 52 104, 92 60 S 150 30, 172 44" stroke="${v}" stroke-width="1.4" fill="none"/>`
    + `<path d="M-10 30 C 20 40, 60 10, 110 28 S 150 70, 172 64" stroke="${v2}" stroke-width="1" fill="none"/>`
    + `<path d="M40 130 C 60 100, 80 110, 100 84" stroke="${v2}" stroke-width=".8" fill="none"/></pattern>`;
}

/* palette: ui → css vars; doc → literal colors (for the downloadable quote) */
const PAL_UI = { ink: 'var(--ink)', ink2: 'var(--ink-2)', ink3: 'var(--ink-3)', edge: 'var(--accent)', line: 'var(--line-2)', slab: 'var(--surface)', bg: 'var(--surface-2)' };
const PAL_DOC = { ink: '#1a1a1a', ink2: '#555', ink3: '#888', edge: '#D9480F', line: '#c9c9c9', slab: '#fff', bg: '#f6f6f4' };

/* to-scale drawing of an area's pieces, finished edges highlighted */
function areaSVG(area, pal = PAL_UI, maxW = 640, idp = 'st-') {
  const pieces = (area.pieces || []).filter((p) => p.L > 0 && p.D > 0);
  if (!pieces.length) {
    return `<svg viewBox="0 0 ${maxW} 90" role="img" aria-label="No pieces measured yet"><text x="${maxW / 2}" y="50" text-anchor="middle" font-size="13" fill="${pal.ink3}" font-family="system-ui, sans-serif">Enter a length to see the piece drawn to scale</text></svg>`;
  }
  const pad = 26, gapX = 34, gapY = 40;
  const maxL = Math.max(...pieces.map((p) => p.L));
  const s = Math.min(3.2, (maxW - pad * 2) / Math.max(maxL, 60));
  let x = pad, y = pad, rowH = 0, rects = [];
  for (const p of pieces) {
    const w = p.L * s, h = p.D * s;
    if (x > pad && x + w > maxW - pad) { x = pad; y += rowH + gapY; rowH = 0; }
    rects.push({ p, x, y, w, h });
    x += w + gapX; rowH = Math.max(rowH, h);
  }
  const H = y + rowH + pad + 6;
  const pid = idp + area.id;
  const color = (area.mat && area.mat.color) || '#ddd';
  let out = `<svg viewBox="0 0 ${maxW} ${Math.round(H)}" role="img" aria-label="${esc(area.name)} pieces drawn to scale"><defs>${stonePattern(pid, color)}</defs>`;
  const font = `font-family="ui-monospace, Menlo, monospace"`;
  for (const r of rects) {
    const { p, x: rx, y: ry, w, h } = r;
    out += `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="url(#${pid})" stroke="${pal.ink2}" stroke-width="1"/>`;
    const e = p.edges || {};
    const E = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pal.edge}" stroke-width="4" stroke-linecap="round"/>`;
    if (e.f) out += E(rx, ry + h, rx + w, ry + h);
    if (e.b) out += E(rx, ry, rx + w, ry);
    if (e.l) out += E(rx, ry, rx, ry + h);
    if (e.r) out += E(rx + w, ry, rx + w, ry + h);
    out += `<text x="${rx + w / 2}" y="${ry - 7}" text-anchor="middle" font-size="11" fill="${pal.ink2}" ${font}>${esc(fmtIn(p.L))}</text>`;
    if (h > 18) out += `<text x="${rx + w + 6}" y="${ry + h / 2 + 4}" font-size="10.5" fill="${pal.ink3}" ${font}>${esc(fmtIn(p.D))}</text>`;
    else out += `<text x="${rx + w + 6}" y="${ry + h / 2 + 4}" font-size="10" fill="${pal.ink3}" ${font}>${esc(fmtIn(p.D))}</text>`;
    if (h >= 20 && w > 60) {
      const dk = isDark(color);
      out += `<text x="${rx + 8}" y="${ry + 16}" font-size="11" font-weight="600" fill="${dk ? '#fff' : '#222'}" font-family="system-ui, sans-serif">${esc((p.label || '').slice(0, Math.max(4, Math.floor(w / 7))))}</text>`;
    }
  }
  out += '</svg>';
  return out;
}

/* slab layout drawing for one material */
function slabsSVG(m, nest, pal = PAL_UI, maxW = 360) {
  const W = nest.W, H = nest.H;
  const n = m.slabs.length;
  const cols = n > 1 ? 2 : 1;
  const gap = 14;
  const sw = (maxW - gap * (cols - 1)) / cols;
  const s = sw / W;
  const sh = H * s;
  const rows = Math.ceil(n / cols);
  const totalH = rows * (sh + 22) + 4;
  const pid = 'sl-' + (m.mat ? m.mat.id : 'x') + '-' + Math.round(W);
  const color = (m.mat && m.mat.color) || '#ddd';
  let out = `<svg viewBox="0 0 ${maxW} ${Math.round(totalH)}" role="img" aria-label="Slab layout for ${esc(m.mat ? m.mat.name : 'material')}"><defs>${stonePattern(pid, color)}</defs>`;
  m.slabs.forEach((slab, i) => {
    const ox = (i % cols) * (sw + gap), oy = Math.floor(i / cols) * (sh + 22) + 16;
    out += `<text x="${ox}" y="${oy - 5}" font-size="10.5" font-weight="600" fill="${pal.ink3}" font-family="system-ui, sans-serif">SLAB ${i + 1} · ${fmtIn(W)} × ${fmtIn(H)}</text>`;
    out += `<rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" rx="2" fill="${pal.bg}" stroke="${pal.line}" stroke-dasharray="3 3"/>`;
    for (const p of slab.parts) {
      out += `<rect x="${ox + p.x * s}" y="${oy + p.y * s}" width="${Math.max(1, p.w * s)}" height="${Math.max(1, p.h * s)}" fill="url(#${pid})" stroke="${p.over ? '#BE3328' : pal.ink2}" stroke-width="${p.over ? 2 : 0.8}"/>`;
    }
  });
  out += '</svg>';
  return out;
}

/* summary of cutouts/sinks on a job (for crew cards) */
function quoteAddonSummary(q) {
  if (!q) return '';
  const m = new Map();
  for (const a of q.areas || []) for (const x of a.addons || []) if (x.count) m.set(x.name, (m.get(x.name) || 0) + x.count);
  return Array.from(m.entries()).map(([k, v]) => (v > 1 ? v + '× ' : '') + k).join(', ');
}
function quoteMaterials(q) {
  if (!q) return '';
  return Array.from(new Set((q.areas || []).map((a) => a.mat && a.mat.name).filter(Boolean))).join(' + ');
}
function quoteEdges(q) {
  if (!q) return '';
  return Array.from(new Set((q.areas || []).map((a) => a.edge && a.edge.name).filter(Boolean))).join(', ');
}

/* fields stored on the job for fast boards & dashboards */
function jobRollup(q, calc) {
  const first = (q.areas || []).find((a) => a.mat) || {};
  return {
    total: calc.total, sqft: round2(calc.sqft), slabs: calc.nest.slabs,
    material: quoteMaterials(q), materialColor: (first.mat && first.mat.color) || '', edge: quoteEdges(q),
  };
}

/* ---------- customer-facing quote document ---------- */
function quoteDocHTML(job, cust, q, calc, c = cfg(), standalone = true) {
  const created = q.sentAt || q.createdAt || Date.now();
  const d = new Date(created);
  const valid = new Date(created + (q.validDays || 30) * 86400000);
  const fd = (x) => MON[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear();
  const row = (desc, qty, unit, amt, sub = '') => `<tr><td style="padding:7px 8px;border-bottom:1px solid #eee">${desc}${sub ? `<div style="color:#777;font-size:11.5px">${sub}</div>` : ''}</td><td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${qty}</td><td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${unit}</td><td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${amt}</td></tr>`;
  let areasHTML = '';
  (q.areas || []).forEach((a, i) => {
    const ac = calc.areas[i];
    let rows = '';
    const pieceList = (a.pieces || []).filter((p) => p.L && p.D).map((p) => `${esc(p.label || 'Piece')} ${fmtIn(p.L)} × ${fmtIn(p.D)}`).join(' · ');
    rows += row(`<b>${esc(a.mat ? a.mat.name : 'Material')}</b>${a.thick ? ' ' + esc(a.thick) : ''} — fabricated & installed`, sqft1(ac.sqft) + ' sq ft', money2(a.mat ? a.mat.price : 0), money2(ac.matCost), pieceList);
    if (ac.edgeLf > 0) rows += row(`Edge profile: ${esc(a.edge ? a.edge.name : '')}`, ac.edgeLf.toFixed(1) + ' LF', a.edge && a.edge.price ? money2(a.edge.price) : 'Included', ac.edgeCost ? money2(ac.edgeCost) : '—');
    for (const x of a.addons || []) if (x.count) rows += row(esc(x.name), String(x.count), x.price ? money2(x.price) : 'Included', x.price ? money2(x.price * x.count) : '—');
    if (a.tearOut) rows += row('Remove & dispose of existing tops', sqft1(ac.sqft) + ' sq ft', money2(a.tearPrice), money2(ac.tearCost));
    areasHTML += `<h3 style="font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em">${esc(a.name)}<span style="float:right;font-weight:600;letter-spacing:0;text-transform:none">${money2(ac.total)}</span></h3>`;
    areasHTML += `<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.05em"><th style="text-align:left;padding:4px 8px;font-weight:600">Item</th><th style="text-align:right;padding:4px 8px;font-weight:600">Qty</th><th style="text-align:right;padding:4px 8px;font-weight:600">Rate</th><th style="text-align:right;padding:4px 8px;font-weight:600">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
    areasHTML += `<div style="margin:10px 0 0;border:1px solid #eee;border-radius:6px;background:#fafaf8">${areaSVG(a, PAL_DOC, 640, 'dst-')}</div>`;
  });
  let extras = '';
  for (const l of q.lines || []) extras += row(esc(l.desc || 'Additional item'), '', '', money2(l.amount));
  const tot = (k, v, b = false) => `<tr><td style="padding:4px 0;${b ? 'font-weight:700;font-size:16px;border-top:2px solid #1a1a1a;padding-top:10px' : 'color:#555'}">${k}</td><td style="padding:4px 0;text-align:right;${b ? 'font-weight:700;font-size:16px;border-top:2px solid #1a1a1a;padding-top:10px' : ''}">${v}</td></tr>`;
  const shop = esc(c.shopName || (typeof shopName === 'function' ? shopName() : '') || 'Your shop name');
  const body = `
<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:760px;margin:0 auto;line-height:1.45">
  <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:3px solid #1a1a1a;padding-bottom:14px">
    <div style="display:flex;gap:14px;align-items:center">${safeImg(c.logo) ? `<img src="${safeImg(c.logo)}" alt="" style="max-height:64px;max-width:160px;object-fit:contain">` : ''}<div><div style="font-size:22px;font-weight:800;letter-spacing:-.01em">${shop}</div>
      <div style="color:#555;font-size:12.5px">${esc(c.shopAddress || '')}${c.shopAddress && (c.shopPhone || c.shopEmail) ? '<br>' : ''}${esc(c.shopPhone || '')}${c.shopPhone && c.shopEmail ? ' · ' : ''}${esc(c.shopEmail || '')}${c.shopWeb ? ' · ' + esc(c.shopWeb) : ''}${c.shopHours ? '<br>Showroom: ' + esc(c.shopHours) : ''}</div></div></div>
    <div style="text-align:right"><div style="font-size:12px;letter-spacing:.14em;color:#888;font-weight:700">COUNTERTOP QUOTE</div>
      <div style="font-size:20px;font-weight:800;font-family:ui-monospace,Menlo,monospace">${esc(job.number || '')}</div>
      <div style="color:#555;font-size:12.5px">${fd(d)} · valid until ${fd(valid)}</div></div>
  </div>
  <div style="display:flex;gap:40px;flex-wrap:wrap;margin:16px 0 4px;font-size:13px">
    <div><div style="font-size:11px;letter-spacing:.08em;color:#888;font-weight:700">PREPARED FOR</div><b>${esc(cust ? cust.name : '')}</b><br>${esc(cust ? cust.phone || '' : '')}${cust && cust.email ? '<br>' + esc(cust.email) : ''}</div>
    <div><div style="font-size:11px;letter-spacing:.08em;color:#888;font-weight:700">JOB SITE</div><b>${esc(job.name || '')}</b><br>${esc(job.address || (cust && cust.address) || '')}</div>
  </div>
  ${areasHTML}
  ${extras ? `<h3 style="font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em">Additional items</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px"><tbody>${extras}</tbody></table>` : ''}
  <table style="width:300px;margin:22px 0 0 auto;border-collapse:collapse;font-size:13px">
    ${calc.minAdj ? tot('Minimum job charge adjustment', money2(calc.minAdj)) : ''}
    ${tot('Subtotal', money2(calc.subtotal))}
    ${calc.discount ? tot('Discount', '−' + money2(calc.discount)) : ''}
    ${calc.tax ? tot(`Tax (${q.taxRate}%)`, money2(calc.tax)) : ''}
    ${tot('Total', money2(calc.total), true)}
    ${calc.payFull ? tot(`Paid in full before field measure (jobs under ${money(calc.pif)})`, money2(calc.total)) : calc.deposit ? tot(`${q.depositPct}% deposit before work begins · balance at installation`, money2(calc.deposit)) : ''}
  </table>
  ${q.notes ? `<div style="margin-top:22px;padding:12px 14px;background:#f6f6f4;border-radius:6px;font-size:12.5px;white-space:pre-wrap">${esc(q.notes)}</div>` : ''}
  <div style="margin-top:22px;font-size:11px;color:#555;line-height:1.5"><div style="font-weight:700;letter-spacing:.08em;font-size:10.5px;color:#888;margin-bottom:4px">TERMS</div>Measurements are estimates until the field measure is complete; final square footage is confirmed at measure.${String(c.quoteTerms || '').split(/\n+/).filter((x) => x.trim()).map((x) => `<p style="margin:5px 0">${esc(x.trim())}</p>`).join('')}</div>
  <div style="display:flex;gap:30px;margin-top:40px;font-size:12px;color:#555;flex-wrap:wrap">
    <div style="flex:1;min-width:200px;border-top:1px solid #999;padding-top:6px">Customer acceptance</div>
    <div style="width:160px;border-top:1px solid #999;padding-top:6px">Date</div>
  </div>
</div>`;
  if (!standalone) return body;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quote ${esc(job.number || '')} — ${esc(cust ? cust.name : '')}</title><style>@media print{body{margin:0}}</style></head><body style="margin:0;padding:28px;background:#fff">${body}</body></html>`;
}
function quoteText(job, cust, q, calc, c = cfg()) {
  const lines = [];
  lines.push(`${c.shopName || 'Countertop quote'} — Quote ${job.number}`);
  lines.push(`${cust ? cust.name : ''} · ${job.name}`);
  lines.push('');
  (q.areas || []).forEach((a, i) => {
    const ac = calc.areas[i];
    lines.push(`${a.name}: ${a.mat ? a.mat.name : ''}, ${sqft1(ac.sqft)} sq ft${ac.edgeLf ? ', ' + (a.edge ? a.edge.name : '') + ' edge' : ''} — ${money(ac.total)}`);
  });
  for (const l of q.lines || []) lines.push(`${l.desc}: ${money(l.amount)}`);
  if (calc.discount) lines.push(`Discount: −${money(calc.discount)}`);
  if (calc.tax) lines.push(`Tax: ${money(calc.tax)}`);
  lines.push(`Total: ${money2(calc.total)}`);
  if (calc.payFull) lines.push(`Paid in full before field measure (under ${money(calc.pif)})`); else if (calc.deposit) lines.push(`${q.depositPct}% deposit: ${money2(calc.deposit)} · balance due at installation`);
  return lines.join('\n');
}
