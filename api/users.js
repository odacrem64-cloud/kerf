// POST /api/users — owner/office manage crew logins: create, reset password, change access, remove.
const { env, admin, send, fail, readBody, errMsg, isEmail, encode, caller, activeAdmins, createLogin, patchTeam, ACCESS } = require('./_lib');

async function memberRow(userId) {
  const r = await admin('/rest/v1/members?select=*&user_id=eq.' + encode(userId));
  return r.ok && Array.isArray(r.json) ? r.json[0] || null : null;
}
async function wouldLeaveNoAdmin(target, nextAccess, nextActive) {
  if (!target || target.access !== 'admin' || !target.active) return false;
  if (nextAccess === 'admin' && nextActive) return false;
  const a = await activeAdmins();
  return !a.error && a.list.filter((x) => x.user_id !== target.user_id).length === 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const e = env();
  if (!e.url || !e.secret) return fail(res, 500, 'Add SUPABASE_SECRET_KEY in Vercel to manage logins.');
  const who = await caller(req);
  if (!who) return fail(res, 401, 'Your session expired. Sign in again.');
  if (!who.member || !who.member.active || who.member.access !== 'admin') return fail(res, 403, 'Only the owner or office can manage logins.');
  const b = await readBody(req);

  if (b.action === 'create') {
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const access = ACCESS.includes(b.access) ? b.access : 'crew';
    const teamId = String(b.teamId || '');
    if (!isEmail(email)) return fail(res, 400, 'Enter a valid email address.');
    if (password.length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');
    const t = await admin('/rest/v1/team?select=id,data&id=eq.' + encode(teamId));
    if (!t.ok || !t.json || !t.json.length) return fail(res, 404, 'That team member no longer exists.');
    const name = (t.json[0].data && t.json[0].data.name) || email;
    const taken = await admin('/rest/v1/members?select=user_id&team_id=eq.' + encode(teamId));
    if (taken.ok && taken.json && taken.json.length) return fail(res, 409, `${name} already has a login.`);
    const c = await createLogin(email, password, name);
    if (c.error) return fail(res, 500, c.error);
    let user = c.user;
    if (c.existing) {
      if (await memberRow(c.existing.id)) return fail(res, 409, 'That email already has a login for this shop.');
      const u = await admin('/auth/v1/admin/users/' + c.existing.id, { method: 'PUT', body: { password, email_confirm: true } });
      if (!u.ok) return fail(res, 500, errMsg(u, 'Couldn’t update the existing login.'));
      user = c.existing;
    }
    const m = await admin('/rest/v1/members', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: user.id, email, team_id: teamId, access, active: true } });
    if (!m.ok) return fail(res, 500, errMsg(m, 'Couldn’t save the login.'));
    await patchTeam(teamId, { userId: user.id, email });
    return send(res, 200, { ok: true, userId: user.id });
  }

  const userId = String(b.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return fail(res, 400, 'Missing login.');
  const target = await memberRow(userId);
  if (!target) return fail(res, 404, 'That login no longer exists.');

  if (b.action === 'reset') {
    const password = String(b.password || '');
    if (password.length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');
    const u = await admin('/auth/v1/admin/users/' + userId, { method: 'PUT', body: { password } });
    if (!u.ok) return fail(res, 500, errMsg(u, 'Couldn’t change the password.'));
    return send(res, 200, { ok: true });
  }
  if (b.action === 'access') {
    const access = ACCESS.includes(b.access) ? b.access : target.access;
    const active = typeof b.active === 'boolean' ? b.active : target.active;
    if (await wouldLeaveNoAdmin(target, access, active)) return fail(res, 409, 'Keep at least one owner or office login with full access.');
    const r = await admin('/rest/v1/members?user_id=eq.' + encode(userId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { access, active } });
    if (!r.ok) return fail(res, 500, errMsg(r, 'Couldn’t change access.'));
    return send(res, 200, { ok: true });
  }
  if (b.action === 'remove') {
    if (userId === who.user.id) return fail(res, 400, 'You can’t remove your own login.');
    if (await wouldLeaveNoAdmin(target, 'crew', false)) return fail(res, 409, 'Keep at least one owner or office login with full access.');
    const d = await admin('/auth/v1/admin/users/' + userId, { method: 'DELETE' });
    if (!d.ok && d.status !== 404) return fail(res, 500, errMsg(d, 'Couldn’t remove the login.'));
    await admin('/rest/v1/members?user_id=eq.' + encode(userId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (target.team_id) await patchTeam(target.team_id, { userId: null });
    return send(res, 200, { ok: true });
  }
  return fail(res, 400, 'Unknown action.');
};
