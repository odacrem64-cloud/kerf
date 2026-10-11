// POST /api/help — the in-app helper. Answers "how do I…" questions about Kerf using Claude.
// Needs ANTHROPIC_API_KEY in Vercel; without it the app uses its built-in answers instead.
const { send, fail, readBody, sessionUser, membership } = require('./_lib');
const KB = require('../js/help-kb.js');

const MODEL = process.env.KERF_HELP_MODEL || 'claude-haiku-5-5';
const guide = KB.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
const ROLE = { admin: 'owner or office (full access)', staff: 'sales', crew: 'crew (templater, fabricator or installer; cannot see money or change prices)' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return send(res, 200, { ok: false, fallback: true });
  const b = await readBody(req);
  const user = await sessionUser(req);
  if (!user) return fail(res, 401, 'Sign in to use the helper.');
  const m = await membership(user.id, String(b.shopId || ''));
  if (!m || m.status !== 'active' || !m.active) return fail(res, 403, 'Join the team to use the helper.');
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
    .filter((x) => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string' && x.content.trim())
    .map((x) => ({ role: x.role, content: x.content.slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return fail(res, 400, 'Ask a question.');
  const system = `You are the helper inside the shop software for Midwest Surfaces, a countertop fabricator in Mokena, Illinois (quoting, job board, calendar, crew work lists, slab inventory). Answer questions about how to use the app in plain, friendly words for busy shop owners and installers. Keep answers short: 1–4 sentences or a few numbered steps. Name buttons and pages in **bold** exactly as they appear. Only describe features listed in the guide below; if something isn't in the app, say so and suggest the closest thing. For general countertop trade questions (square footage, edge profiles, seams) you can give brief practical answers. Never invent prices, customer data or account details.

The person asking is: ${ROLE[m.access] || 'a team member'}. They are on the "${String(b.view || 'dashboard').slice(0, 30)}" page.

APP GUIDE
${guide}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages: msgs }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 200, { ok: false, fallback: true, error: (j.error && j.error.message) || 'The helper is unavailable right now.' });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return send(res, 200, { ok: true, text: text || 'Sorry, I don’t have an answer for that.' });
  } catch (e) {
    return send(res, 200, { ok: false, fallback: true });
  }
};
