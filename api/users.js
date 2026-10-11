// POST /api/users — owner/office manage their shop's logins:
// create, reset password, change access, remove, approve or decline join requests, new shop code.
const { env, admin, send, fail, readBody, errMsg, isEmail, encode, caller, membership, membershipsOf, activeAdmins, randomCode, randomId, createLogin, upsert, patchTeam, MEMBER_COLORS, ACCESS } = require('./_lib');

async function wouldLeaveNoAdmin(shopId, target, nextAccess, nextActive) {
  if (!target || target.access !== 'admin' || !target.active || target.status !== 'active') return false;
  if (nextAccess === 'admin' && nextActive) return false;
  const a = await activeAdmins(shopId);
  return !a.error && a.list.filter((x) => x.user_id !== target.user_id).length === 0;
}
const onlyThisShop = async (userId, shopId) => (await membershipsOf(userId)).every((m) => m.shop_id === shopId);
const delMember = (userId, shopId) => admin('/rest/v1/members?user_id=eq.' + encode(userId) + '&shop_id=eq.' + encode(shopId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const e = env();
  if (!e.url || !e.secret) return fail(res, 500, 'Add SUPABASE_SECRET_KEY in Vercel to manage logins.');
  const b = await readBody(req);
  const shopId = String(b.shopId || '');
  if (!shopId) return fail(res, 400, 'Missing shop.');
  const who = await caller(req, shopId);
  if (!who) return fail(res, 401, 'Your session expired. Sign in again.');
  const me = who.member;
  if (!me || !me.active || me.status !== 'active' || me.access !== 'admin') return fail(res, 403, 'Only the owner or office can manage logins.');

  if (b.action === 'newcode') {
    for (let i = 0; i < 5; i++) {
      const code = randomCode();
      const r = await admin('/rest/v1/shops?id=eq.' + encode(shopId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { join_code: code } });
      if (r.ok) return send(res, 200, { ok: true, code });
      if (r.status !== 409) return fail(res, 500, errMsg(r, 'Couldn’t change the code.'));
    }
    return fail(res, 500, 'Couldn’t change the code. Try again.');
  }

  if (b.action === 'create') {
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const access = ACCESS.includes(b.access) ? b.access : 'crew';
    const teamId = String(b.teamId || '');
    if (!isEmail(email)) return fail(res, 400, 'Enter a valid email address.');
    if (password.length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');
    const t = await admin('/rest/v1/team?select=id,shop_id,data&id=eq.' + encode(teamId));
    const card = t.ok && t.json && t.json[0];
    if (!card || card.shop_id !== shopId) return fail(res, 404, 'That team member no longer exists.');
    const name = (card.data && card.data.name) || email;
    const taken = await admin('/rest/v1/members?select=user_id&shop_id=eq.' + encode(shopId) + '&team_id=eq.' + encode(teamId));
    if (taken.ok && taken.json && taken.json.length) return fail(res, 409, `${name} already has a login.`);
    const c = await createLogin(email, password, name);
    if (c.existing) return fail(res, 409, 'That email already has a Kerf login. Ask them to use “Join a shop” with your shop code instead.');
    if (c.error) return fail(res, 500, c.error);
    const m = await upsert('members', { user_id: c.user.id, shop_id: shopId, email, name, team_id: teamId, access, status: 'active', active: true });
    if (!m.ok) return fail(res, 500, errMsg(m, 'Couldn’t save the login.'));
    await patchTeam(teamId, { userId: c.user.id, email });
    return send(res, 200, { ok: true, userId: c.user.id });
  }

  const userId = String(b.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return fail(res, 400, 'Missing login.');
  const target = await membership(userId, shopId);
  if (!target) return fail(res, 404, 'That person isn’t in this shop anymore.');

  if (b.action === 'approve') {
    if (target.status === 'active') return send(res, 200, { ok: true });
    const access = ACCESS.includes(b.access) ? b.access : 'crew';
    let teamId = String(b.teamId || '');
    if (teamId && teamId !== 'new') {
      const t = await admin('/rest/v1/team?select=id,shop_id&id=eq.' + encode(teamId));
      if (!(t.ok && t.json && t.json[0] && t.json[0].shop_id === shopId)) return fail(res, 404, 'That team member no longer exists.');
      await patchTeam(teamId, { userId, email: target.email });
    } else {
      teamId = randomId('tm_');
      const cnt = await admin('/rest/v1/team?select=id&shop_id=eq.' + encode(shopId));
      const color = MEMBER_COLORS[((cnt.json || []).length) % MEMBER_COLORS.length];
      const t = await upsert('team', { id: teamId, shop_id: shopId, data: { name: target.name || target.email, role: String(b.role || 'Installer').slice(0, 30), color, email: target.email || '', phone: '', active: true, userId } });
      if (!t.ok) return fail(res, 500, errMsg(t, 'Couldn’t add them to the team.'));
    }
    const r = await admin('/rest/v1/members?user_id=eq.' + encode(userId) + '&shop_id=eq.' + encode(shopId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { status: 'active', active: true, access, team_id: teamId } });
    if (!r.ok) return fail(res, 500, errMsg(r, 'Couldn’t approve them.'));
    return send(res, 200, { ok: true, teamId });
  }
  if (b.action === 'decline') {
    if (target.status === 'active') return fail(res, 400, 'They’re already on the team. Use Remove login instead.');
    await delMember(userId, shopId);
    return send(res, 200, { ok: true });
  }
  if (b.action === 'reset') {
    const password = String(b.password || '');
    if (password.length < 8) return fail(res, 400, 'Use a password with at least 8 characters.');
    if (!(await onlyThisShop(userId, shopId))) return fail(res, 409, 'This person also uses Kerf with another shop, so they need to change their own password.');
    const u = await admin('/auth/v1/admin/users/' + userId, { method: 'PUT', body: { password } });
    if (!u.ok) return fail(res, 500, errMsg(u, 'Couldn’t change the password.'));
    return send(res, 200, { ok: true });
  }
  if (b.action === 'access') {
    const access = ACCESS.includes(b.access) ? b.access : target.access;
    const active = typeof b.active === 'boolean' ? b.active : target.active;
    if (await wouldLeaveNoAdmin(shopId, target, access, active)) return fail(res, 409, 'Keep at least one owner or office login with full access.');
    const r = await admin('/rest/v1/members?user_id=eq.' + encode(userId) + '&shop_id=eq.' + encode(shopId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { access, active } });
    if (!r.ok) return fail(res, 500, errMsg(r, 'Couldn’t change access.'));
    return send(res, 200, { ok: true });
  }
  if (b.action === 'remove') {
    if (userId === who.user.id) return fail(res, 400, 'You can’t remove your own login.');
    if (await wouldLeaveNoAdmin(shopId, target, 'crew', false)) return fail(res, 409, 'Keep at least one owner or office login with full access.');
    const solo = await onlyThisShop(userId, shopId);
    await delMember(userId, shopId);
    if (solo) await admin('/auth/v1/admin/users/' + userId, { method: 'DELETE' });
    if (target.team_id) await patchTeam(target.team_id, { userId: null });
    return send(res, 200, { ok: true });
  }
  return fail(res, 400, 'Unknown action.');
};
