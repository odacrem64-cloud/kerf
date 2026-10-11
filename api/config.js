// GET /api/config — tells the website how to reach Supabase (public values only) and whether the database is set up.
const { env, admin, send } = require('./_lib');

module.exports = async (req, res) => {
  const e = env();
  const missing = [];
  if (!e.url) missing.push('SUPABASE_URL');
  if (!e.anon) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (!e.secret) missing.push('SUPABASE_SECRET_KEY');
  if (!e.url || !e.anon) return send(res, 200, { configured: false, missing });
  let schema = null, keyProblem = false, hasShop = false;
  if (e.secret) {
    try {
      const r = await admin('/rest/v1/shops?select=id&limit=1');
      if (r.ok) { schema = true; hasShop = (r.json || []).length > 0; }
      else {
        const code = r.json && r.json.code;
        if (r.status === 404 || code === 'PGRST205' || code === '42P01') schema = false;
        if (r.status === 401 || r.status === 403) keyProblem = true;
      }
    } catch (err) { schema = null; }
  }
  send(res, 200, { configured: true, url: e.url, anonKey: e.anon, hasSecret: !!e.secret, missing, schema, keyProblem, hasShop, ai: !!String(process.env.ANTHROPIC_API_KEY || '').trim() });
};
