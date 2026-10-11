// Shared helpers for Kerf's server functions. Files starting with "_" are not public routes.
// No packages needed: talks to Supabase over its REST and Auth APIs with fetch.

function env() {
  const e = process.env;
  return {
    url: String(e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    anon: String(e.SUPABASE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    secret: String(e.SUPABASE_SECRET_KEY || e.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  };
}

// New Supabase keys (sb_publishable_…, sb_secret_…) go in the apikey header only.
// Legacy JWT keys (eyJ…) also go in Authorization.
function keyHeaders(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key && key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
  return h;
}

async function sb(path, { method = 'GET', key, body, headers = {} } = {}) {
  const { url } = env();
  const res = await fetch(url + path, {
    method,
    headers: { ...keyHeaders(key), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = { message: text }; }
  return { ok: res.ok, status: res.status, json };
}
const admin = (path, opts = {}) => sb(path, { ...opts, key: env().secret });

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
const fail = (res, status, error) => send(res, status, { ok: false, error });

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const errMsg = (r, fallback) => (r && r.json && (r.json.msg || r.json.message || r.json.error_description || r.json.error)) || fallback;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
const encode = encodeURIComponent;
const ACCESS = ['admin', 'staff', 'crew'];

// Who is calling? Verifies the user's session token with Supabase.
async function sessionUser(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { url, anon } = env();
  const res = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}
async function membership(userId, shopId) {
  const m = await admin('/rest/v1/members?select=*&user_id=eq.' + encode(userId) + '&shop_id=eq.' + encode(shopId));
  return m.ok && Array.isArray(m.json) ? m.json[0] || null : null;
}
async function membershipsOf(userId) {
  const m = await admin('/rest/v1/members?select=shop_id,status,active,access&user_id=eq.' + encode(userId));
  return m.ok && Array.isArray(m.json) ? m.json : [];
}
async function caller(req, shopId) {
  const user = await sessionUser(req);
  if (!user) return null;
  return { user, member: shopId ? await membership(user.id, shopId) : null };
}
async function activeAdmins(shopId) {
  const r = await admin('/rest/v1/members?select=user_id&access=eq.admin&active=eq.true&status=eq.active&shop_id=eq.' + encode(shopId));
  if (!r.ok) return { error: r };
  return { list: r.json || [] };
}
// Checks an existing login's password without signing anyone in on this server.
async function passwordOk(email, password) {
  const { url, anon } = env();
  const res = await fetch(url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return res.ok;
}
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode(n = 6) {
  const bytes = require('crypto').randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}
const randomId = (prefix) => prefix + require('crypto').randomBytes(8).toString('hex');
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const MEMBER_COLORS = ['#B33B0B', '#2D5C9C', '#0F7C80', '#7650AD', '#2D7A4C', '#A86C12', '#BE3328', '#5149B8', '#4F5A55', '#9C3D7A'];

async function findUserByEmail(email) {
  const want = String(email).toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const r = await admin(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!r.ok) return null;
    const users = (r.json && r.json.users) || [];
    const hit = users.find((u) => String(u.email || '').toLowerCase() === want);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

// Create a login, or reuse one left over from an earlier attempt that never finished.
async function createLogin(email, password, name) {
  const r = await admin('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true, user_metadata: { name } } });
  if (r.ok && r.json && r.json.id) return { user: r.json };
  const code = (r.json && (r.json.error_code || r.json.code)) || '';
  if (r.status === 422 || /exists|registered/i.test(String(code) + errMsg(r, ''))) {
    const existing = await findUserByEmail(email);
    if (existing) return { existing };
  }
  return { error: errMsg(r, 'Supabase could not create the login') };
}

async function upsert(table, row) {
  return admin('/rest/v1/' + table, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: row });
}
async function patchTeam(teamId, patch) {
  return admin('/rest/v1/rpc/kerf_patch', { method: 'POST', body: { tbl: 'team', doc_id: teamId, patch } });
}

module.exports = { env, sb, admin, send, fail, readBody, errMsg, isEmail, encode, sessionUser, membership, membershipsOf, caller, activeAdmins, passwordOk, randomCode, randomId, cleanCode, MEMBER_COLORS, findUserByEmail, createLogin, upsert, patchTeam, ACCESS };
