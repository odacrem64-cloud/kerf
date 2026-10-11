'use strict';
/* =========================================================
   Midwest Surfaces — shop manager (Mokena, IL)
   Core helpers, constants, defaults
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

/* ---------- money & numbers ---------- */
const fmtUSD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtUSD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => fmtUSD0.format(Math.round(Number(n) || 0));
const money2 = (n) => fmtUSD2.format(Number(n) || 0);
const moneyK = (n) => { n = Number(n) || 0; return Math.abs(n) >= 10000 ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : money(n); };
const sqft1 = (n) => (Number(n) || 0).toFixed(1);

/* ---------- inches with fractions (to 1/16") ---------- */
function parseIn(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/["”″'′]/g, '').replace(/\s+/g, ' ');
  if (!s) return 0;
  let m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) return +m[1];
  if ((m = s.match(/^(\d+)\s*[ -]\s*(\d+)\s*\/\s*(\d+)$/))) return +m[3] ? +m[1] + +m[2] / +m[3] : +m[1];
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return +m[2] ? +m[1] / +m[2] : 0;
  const f = parseFloat(s);
  return isNaN(f) ? 0 : f;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function fmtIn(n, mark = true) {
  n = Number(n) || 0;
  if (!n) return '';
  const e = Math.round(n * 16) / 16;
  const w = Math.floor(e);
  const fr = Math.round((e - w) * 16);
  const q = mark ? '"' : '';
  if (!fr) return w + q;
  const g = gcd(fr, 16);
  return (w ? w + ' ' : '') + fr / g + '/' + 16 / g + q;
}

/* ---------- dates (stored as local YYYY-MM-DD) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const today = () => dstr(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const weekStart = (s) => { const d = parseD(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return dstr(d); };
const isWeekend = (s) => { const g = parseD(s).getDay(); return g === 0 || g === 6; };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (s) => { if (!s) return ''; const d = parseD(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
const fmtDshort = (s) => { if (!s) return ''; const d = parseD(s); return MON[d.getMonth()] + ' ' + d.getDate(); };
function relDay(s) {
  if (!s) return '';
  const n = daysBetween(today(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return DOW[parseD(s).getDay()];
  return fmtDshort(s);
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'p' : 'a';
  const hh = ((h + 11) % 12) + 1;
  return hh + (m ? ':' + pad(m) : '') + ap;
}
function ago(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400);
  if (d < 30) return d + 'd ago';
  return fmtDshort(dstr(new Date(ms)));
}
/* n-th business day from today (n may be negative); 0 = today or next weekday */
function bizDay(n) {
  let d = today();
  while (isWeekend(d)) d = addDays(d, 1);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  while (left > 0) { d = addDays(d, step); if (!isWeekend(d)) left--; }
  return d;
}

/* ---------- domain constants ---------- */
const STAGES = [
  { id: 'lead', name: 'Lead' },
  { id: 'quoted', name: 'Quoted' },
  { id: 'sold', name: 'Sold' },
  { id: 'templated', name: 'Templated' },
  { id: 'fabrication', name: 'In fabrication', short: 'Fabrication' },
  { id: 'installed', name: 'Installed' },
  { id: 'closed', name: 'Closed' },
];
const STAGE_HINT = {
  lead: 'New inquiry', quoted: 'Quote sent', sold: 'Deposit / PO in', templated: 'Measured on site',
  fabrication: 'Cutting in shop', installed: 'Set, balance due', closed: 'Paid in full', lost: 'Didn’t buy',
};
const stageName = (id) => (id === 'lost' ? 'Lost' : (STAGES.find((s) => s.id === id) || {}).name || id);
const stageIdx = (id) => STAGES.findIndex((s) => s.id === id);
const stageColor = (id) => `var(--s-${id})`;
const stagePill = (id) => `<span class="pill" style="--c:${stageColor(id)}">${esc(stageName(id))}</span>`;

const SHOP = { name: 'Midwest Surfaces', city: 'Mokena, IL', app: 'Shop Manager' };
const BASE_ACT_TYPES = [
  { id: 'template', name: 'Template', color: 'var(--t-template)', base: true },
  { id: 'fabrication', name: 'Fabrication', color: 'var(--t-fab)', base: true },
  { id: 'install', name: 'Install', color: 'var(--t-install)', base: true },
  { id: 'service', name: 'Service', color: 'var(--t-service)', base: true },
  { id: 'other', name: 'Other', color: 'var(--t-other)', base: true },
];
/* Moraware-style: shops add their own activity types (Saw, CNC, Polish, Delivery…) in Settings */
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
function actTypes() {
  const extra = (typeof cfg === 'function' && Array.isArray(cfg().activityTypes) ? cfg().activityTypes : [])
    .filter((t) => t && t.id && String(t.name || '').trim()).map((t) => ({ id: String(t.id), name: String(t.name).trim(), color: isHex(t.color) ? t.color : '#68716D' }));
  return BASE_ACT_TYPES.slice(0, 4).concat(extra, BASE_ACT_TYPES.slice(4));
}
const actType = (id) => actTypes().find((t) => t.id === id) || { ...BASE_ACT_TYPES[4], id: id || 'other' };
/* activity status, as in Moraware: Estimate (tentative) → Confirmed (agreed with customer) → Complete */
const ACT_STATUS = [{ id: 'estimate', name: 'Estimate' }, { id: 'scheduled', name: 'Confirmed' }, { id: 'done', name: 'Complete' }];
const actStatusName = (s) => (ACT_STATUS.find((x) => x.id === s) || ACT_STATUS[1]).name;
const THICKNESS = ['3cm', '2cm', '1.2cm', '4cm', 'Other'];
const fmtBytes = (n) => { n = Number(n) || 0; return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; };
const DURATIONS = ['', '1 hr', '2 hrs', '3 hrs', 'Half day', 'Full day', '2 days'];
const ROLES = ['Owner', 'Office', 'Sales', 'Templater', 'Fabricator', 'Installer', 'Helper'];
const SOURCES = ['Walk-in', 'Builder', 'Designer', 'Cabinet shop', 'Referral', 'Website', 'Home show', 'Repeat customer'];
const CUST_TYPES = ['Homeowner', 'Builder', 'Designer', 'Cabinet shop', 'Commercial'];
const CHECKS = [
  { id: 'deposit', name: 'Deposit received' },
  { id: 'layout', name: 'Layout & seams approved by customer' },
  { id: 'sink', name: 'Sink & faucet on site' },
  { id: 'cabinets', name: 'Cabinets set & level' },
  { id: 'final', name: 'Final payment collected' },
];
const PAY_METHODS = ['Check', 'Card', 'Cash', 'ACH / transfer', 'Financing'];
const MEMBER_COLORS = ['#B33B0B', '#2D5C9C', '#0F7C80', '#7650AD', '#2D7A4C', '#A86C12', '#BE3328', '#5149B8', '#4F5A55', '#9C3D7A'];
const AREA_PRESETS = ['Kitchen', 'Island', 'Vanity', 'Bar top', 'Laundry', 'Fireplace', 'Outdoor kitchen', 'Shower curb & niche'];

const DEFAULT_SETTINGS = {
  shopName: 'Midwest Surfaces', shopPhone: '', shopEmail: '', shopAddress: 'Mokena, IL', logo: '', activityTypes: [],
  taxRate: 0, depositPct: 50, minCharge: 1200, tearOutPerSqft: 8, quoteValidDays: 30,
  slabL: 126, slabW: 63,
  capInstallSqft: 160, capTemplates: 4,
  materials: [
    { id: 'm1', group: 'Granite', name: 'Granite – Level 1', price: 42, color: '#8C8077' },
    { id: 'm2', group: 'Granite', name: 'Granite – Level 2', price: 52, color: '#5F5650' },
    { id: 'm3', group: 'Granite', name: 'Granite – Level 3', price: 64, color: '#38332F' },
    { id: 'm4', group: 'Quartz', name: 'Quartz – Group A', price: 55, color: '#E5E2DC' },
    { id: 'm5', group: 'Quartz', name: 'Quartz – Group B', price: 66, color: '#D8D4CC' },
    { id: 'm6', group: 'Quartz', name: 'Quartz – Group C (Calacatta looks)', price: 79, color: '#F1EEE8' },
    { id: 'm7', group: 'Quartzite', name: 'Quartzite', price: 95, color: '#CDC5B7' },
    { id: 'm8', group: 'Marble', name: 'Marble', price: 88, color: '#ECEAE5' },
    { id: 'm9', group: 'Porcelain', name: 'Porcelain slab', price: 72, color: '#C8C5BF' },
    { id: 'm10', group: 'Solid surface', name: 'Solid surface', price: 45, color: '#DAD6CE' },
  ],
  edges: [
    { id: 'e1', name: 'Eased (standard)', price: 0 },
    { id: 'e2', name: 'Pencil round', price: 0 },
    { id: 'e3', name: 'Half bullnose', price: 8 },
    { id: 'e4', name: 'Bevel', price: 10 },
    { id: 'e5', name: 'Full bullnose', price: 16 },
    { id: 'e6', name: 'Ogee', price: 24 },
    { id: 'e7', name: 'Mitered drop edge', price: 38 },
  ],
  addons: [
    { id: 'a1', name: 'Undermount sink cutout', price: 0 },
    { id: 'a2', name: 'Cooktop cutout', price: 150 },
    { id: 'a3', name: 'Faucet hole', price: 0 },
    { id: 'a4', name: 'Extra drill hole', price: 25 },
    { id: 'a5', name: 'Outlet cutout', price: 35 },
    { id: 'a6', name: 'Radius corner', price: 45 },
    { id: 'a7', name: 'SS sink – single bowl', price: 249 },
    { id: 'a8', name: 'SS sink – 50/50', price: 279 },
    { id: 'a9', name: 'Vanity bowl', price: 110 },
    { id: 'a10', name: 'Waterfall leg', price: 350 },
  ],
};

/* ---------- icons ---------- */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  work: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  team: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-1.8 1.9-2.8 3.5-2.8s2.9 1 3.5 2.8M15 10h3.5M15 13.5h3.5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  clip: '<path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7-7l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
  slab: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 14l18-5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.01"/>',
};
const icon = (n, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${ICONS[n] || ''}</svg>`;
const BRAND = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#151A18"/><g transform="translate(16 15)"><circle r="9" fill="#CCD3CF" stroke="#CCD3CF" stroke-width="1.6" stroke-dasharray="1.3 1.3"/><circle r="5.6" fill="#AAB3AE"/><circle r="1.5" fill="#151A18"/></g><rect x="2.5" y="19.5" width="27" height="9" rx="1" fill="#D9480F"/><rect x="2.5" y="25.5" width="27" height="3" fill="#B03A0C"/></svg>';

/* ---------- people helpers ---------- */
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
const safeImg = (u) => (typeof u === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');
function avatar(m, cls = '') {
  if (!m) return '';
  const p = safeImg(m.photo);
  return `<span class="avatar ${cls} ${p ? 'has-photo' : ''}" style="--c:${esc(m.color || '#68716D')}" title="${esc(m.name)}">${p ? `<img src="${p}" alt="">` : esc(initials(m.name))}</span>`;
}
/* shrink a picked image in the browser so it stores small: square crop for faces, fit for logos */
function readImage(file, { max = 256, square = false, keepPng = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Pick a photo or image file.')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Couldn’t read that file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image couldn’t be opened. Try a JPG or PNG.'));
      img.onload = () => {
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
        const scale = Math.min(1, max / Math.max(sw, sh));
        const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        const png = keepPng && file.type === 'image/png';
        let out = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
        if (out.length > 110000) out = c.toDataURL('image/jpeg', 0.7);
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const lastName = (n) => { const p = String(n || '').trim().split(/\s+/); return p[p.length - 1] || ''; };

/* luminance check for picking vein colors */
function isDark(hex) {
  const h = String(hex || '#888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '8');
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}
