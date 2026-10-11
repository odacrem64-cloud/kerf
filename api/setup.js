// POST /api/setup — creates the very first owner login. Refuses once the shop has an owner.
const { env, admin, send, fail, readBody, errMsg, isEmail, activeAdmins, createLogin } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const e = env();
  if (!e.url || !e.secret) return fail(res, 500, 'Add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel first.');
  const b = await readBody(req);
  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name) return fail(res, 400, 'Enter your name.');
  if (!isEmail(email)) return fail(res, 400, 'Enter a valid email address.');
  if (password.length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');

  const a = await activeAdmins();
  if (a.error) return fail(res, 500, a.error.status === 404 ? 'Run the database setup script in Supabase first.' : 'Couldn’t reach the database. Check the Supabase keys in Vercel.');
  if (a.list.length) return fail(res, 409, 'This shop already has an owner. Sign in instead.');

  const c = await createLogin(email, password, name);
  if (c.error) return fail(res, 500, c.error);
  let user = c.user;
  if (c.existing) {
    const u = await admin('/auth/v1/admin/users/' + c.existing.id, { method: 'PUT', body: { password, email_confirm: true } });
    if (!u.ok) return fail(res, 500, errMsg(u, 'Couldn’t update the existing login.'));
    user = c.existing;
  }
  const teamId = 'owner-' + String(user.id).slice(0, 8);
  const t = await admin('/rest/v1/team', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { id: teamId, data: { name, role: 'Owner', color: '#B33B0B', email, phone: '', active: true, userId: user.id } } });
  if (!t.ok) return fail(res, 500, errMsg(t, 'Couldn’t add you to the team list.'));
  const m = await admin('/rest/v1/members', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: user.id, email, team_id: teamId, access: 'admin', active: true } });
  if (!m.ok) return fail(res, 500, errMsg(m, 'Couldn’t save your login.'));
  send(res, 200, { ok: true });
};
