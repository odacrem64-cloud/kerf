// POST /api/shops — first-time setup of Midwest Surfaces (owner login), or ask to join the team with the shop code.
// Logins are created here directly, so no confirmation emails are needed.
const { env, admin, send, fail, readBody, errMsg, isEmail, encode, sessionUser, membership, passwordOk, randomCode, randomId, cleanCode, createLogin, upsert } = require('./_lib');

// The person doing this: an already signed-in user, or a new/existing login checked by password.
async function resolveUser(req, b) {
  const signedIn = await sessionUser(req);
  if (signedIn) return { user: signedIn };
  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name) return { error: [400, 'Enter your name.'] };
  if (!isEmail(email)) return { error: [400, 'Enter a valid email address.'] };
  if (password.length < 8) return { error: [400, 'Use a password with at least 8 characters.'] };
  const c = await createLogin(email, password, name);
  if (c.user) return { user: c.user, created: true };
  if (c.existing) {
    if (await passwordOk(email, password)) return { user: c.existing };
    return { error: [409, 'That email already has a login. Use the same password you sign in with.'] };
  }
  return { error: [500, c.error || 'Couldn’t create your login.'] };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const e = env();
  if (!e.url || !e.secret) return fail(res, 500, 'Add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel first.');
  const b = await readBody(req);
  const name = String(b.name || '').trim().slice(0, 80);

  if (b.action === 'create') {
    const shopName = String(b.shopName || 'Midwest Surfaces').trim().slice(0, 80) || 'Midwest Surfaces';
    // This site runs one shop: Midwest Surfaces. Once it's set up, nobody can create another.
    const existingShop = await admin('/rest/v1/shops?select=id&limit=1');
    if (existingShop.ok && (existingShop.json || []).length) return fail(res, 409, 'Midwest Surfaces is already set up. Sign in, or join the team with the shop code.');
    const who = await resolveUser(req, b);
    if (who.error) return fail(res, who.error[0], who.error[1]);
    const user = who.user;
    const email = String(user.email || b.email || '').toLowerCase();
    const display = name || (user.user_metadata && user.user_metadata.name) || email;
    const shopId = randomId('s_');
    let made = null;
    for (let i = 0; i < 5 && !made; i++) {
      const r = await admin('/rest/v1/shops', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { id: shopId, name: shopName, join_code: randomCode(), created_by: user.id } });
      if (r.ok) made = true;
      else if (r.status !== 409) return fail(res, 500, r.status === 404 ? 'Run the database setup script in Supabase first.' : errMsg(r, 'Couldn’t create the shop.'));
    }
    if (!made) return fail(res, 500, 'Couldn’t create the shop. Try again.');
    const teamId = randomId('tm_');
    const t = await upsert('team', { id: teamId, shop_id: shopId, data: { name: display, role: 'Owner', color: '#B33B0B', email, phone: '', active: true, userId: user.id } });
    const m = await upsert('members', { user_id: user.id, shop_id: shopId, email, name: display, team_id: teamId, access: 'admin', status: 'active', active: true });
    const st = await upsert('settings', { id: shopId, shop_id: shopId, data: { shopName } });
    if (!t.ok || !m.ok || !st.ok) return fail(res, 500, errMsg(!m.ok ? m : !t.ok ? t : st, 'Couldn’t finish setting up the shop.'));
    return send(res, 200, { ok: true, shopId, shopName });
  }

  if (b.action === 'join') {
    const code = cleanCode(b.code);
    if (code.length < 4) return fail(res, 400, 'Enter the shop code from the office.');
    const s = await admin('/rest/v1/shops?select=id,name&join_code=eq.' + encode(code));
    if (!s.ok) return fail(res, 500, s.status === 404 ? 'Run the database setup script in Supabase first.' : 'Couldn’t look up that shop.');
    const shop = (s.json || [])[0];
    if (!shop) return fail(res, 404, 'That code isn’t right. Check it with the office.');
    const who = await resolveUser(req, b);
    if (who.error) return fail(res, who.error[0], who.error[1]);
    const user = who.user;
    const existing = await membership(user.id, shop.id);
    if (existing) return send(res, 200, { ok: true, shopId: shop.id, shopName: shop.name, pending: existing.status !== 'active', already: true });
    const email = String(user.email || b.email || '').toLowerCase();
    const display = name || (user.user_metadata && user.user_metadata.name) || email;
    const m = await upsert('members', { user_id: user.id, shop_id: shop.id, email, name: display, access: 'crew', status: 'pending', active: false });
    if (!m.ok) return fail(res, 500, errMsg(m, 'Couldn’t send your request.'));
    return send(res, 200, { ok: true, shopId: shop.id, shopName: shop.name, pending: true });
  }
  return fail(res, 400, 'Unknown action.');
};
