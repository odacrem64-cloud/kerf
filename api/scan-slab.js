// POST /api/scan-slab — reads a slab photo (and optional sticker photo) with Claude and returns its best guess.
// Nothing is saved here: the app shows the guess and the person confirms or fixes it first.
// Needs ANTHROPIC_API_KEY in Vercel.
const { send, fail, readBody, sessionUser, membership, admin, encode } = require('./_lib');

const MODEL = process.env.KERF_SCAN_MODEL || 'claude-sonnet-5-5';
const CATEGORIES = ['Granite', 'Quartz', 'Quartzite', 'Marble', 'Dolomite', 'Porcelain', 'Soapstone', 'Solid surface', 'Other'];
const THICK = ['2cm', '3cm', '1.2cm', '4cm', 'unknown'];

function parseDataUrl(u) {
  const m = String(u || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  if (m[2].length > 6_000_000) return null;
  return { media_type: m[1], data: m[2] };
}

const TOOL = {
  name: 'record_slab',
  description: 'Record what this countertop slab appears to be, for the shop to confirm before adding it to inventory.',
  input_schema: {
    type: 'object',
    properties: {
      is_slab: { type: 'boolean', description: 'True if the photo shows a stone/quartz/porcelain countertop slab or remnant.' },
      name: { type: 'string', description: 'Color / product name, e.g. "Calacatta Laza", "Taj Mahal", "Steel Grey". Read it from the sticker if visible; otherwise your best identification. Prefer the exact spelling from the known colors list when it matches.' },
      category: { type: 'string', enum: CATEGORIES },
      brand: { type: 'string', description: 'Manufacturer/brand if known (MSI, Caesarstone, Silestone, Cambria, Cosentino…), else empty.' },
      supplier: { type: 'string', description: 'Distributor/supplier from the sticker if visible, else empty.' },
      lot: { type: 'string', description: 'Lot or bundle number from the sticker, else empty.' },
      serial: { type: 'string', description: 'Slab serial/block number from the sticker, else empty.' },
      thickness: { type: 'string', enum: THICK },
      length_in: { type: 'number', description: 'Length in inches if printed on the sticker or clearly measurable; 0 if unknown.' },
      width_in: { type: 'number', description: 'Width in inches if printed on the sticker or clearly measurable; 0 if unknown.' },
      finish: { type: 'string', description: 'Polished, honed, leathered… or empty.' },
      color_hex: { type: 'string', description: 'Dominant background color of the stone as #RRGGBB.' },
      price_group_id: { type: 'string', description: 'The id of the best-matching price group from the list provided, or empty if none fit.' },
      confidence: { type: 'number', description: '0 to 1: how sure you are about the color/product name.' },
      label_text: { type: 'string', description: 'Text you could read on any sticker or label, verbatim, short.' },
      notes: { type: 'string', description: 'One short sentence: visible chips, fissures, cracks, or why you are unsure. Empty if nothing.' },
    },
    required: ['is_slab', 'name', 'category', 'thickness', 'confidence', 'color_hex'],
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Use POST');
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return send(res, 200, { ok: false, needsKey: true, error: 'AI scanning isn’t turned on yet. Add ANTHROPIC_API_KEY in Vercel.' });
  const user = await sessionUser(req);
  if (!user) return fail(res, 401, 'Sign in to scan slabs.');
  const b = await readBody(req);
  const shopId = String(b.shopId || '');
  const m = await membership(user.id, shopId);
  if (!m || m.status !== 'active' || !m.active) return fail(res, 403, 'Join the team to scan slabs.');
  const photo = parseDataUrl(b.photo);
  if (!photo) return fail(res, 400, 'Take a photo of the slab first.');
  const label = b.label ? parseDataUrl(b.label) : null;

  // Context so the AI uses the shop's own names
  let groups = [], known = [];
  try {
    const st = await admin('/rest/v1/settings?select=data&id=eq.' + encode(shopId));
    const mats = st.ok && st.json && st.json[0] && Array.isArray(st.json[0].data.materials) ? st.json[0].data.materials : null;
    groups = (mats || (Array.isArray(b.groups) ? b.groups : [])).slice(0, 40).map((x) => ({ id: String(x.id), name: String(x.name), group: String(x.group || '') }));
    const sl = await admin('/rest/v1/slabs?select=data&shop_id=eq.' + encode(shopId) + '&limit=1000');
    known = Array.from(new Set((sl.ok ? sl.json : []).map((r) => r.data && r.data.name).filter(Boolean))).slice(0, 120);
  } catch (e) { /* context is optional */ }

  const content = [{ type: 'text', text: 'Photo of the slab:' }, { type: 'image', source: { type: 'base64', ...photo } }];
  if (label) content.push({ type: 'text', text: 'Close-up of the slab’s sticker / label:' }, { type: 'image', source: { type: 'base64', ...label } });
  content.push({ type: 'text', text: `Identify this slab for Midwest Surfaces' inventory and call record_slab.
Price groups (choose price_group_id from these ids by material category and tier): ${JSON.stringify(groups)}
Colors already in inventory (match spelling if it's one of these): ${JSON.stringify(known)}
Rules: read sticker text exactly when visible. Never invent a lot, serial or size you can't see — leave them empty or 0. If unsure of the color name, give your best guess with a low confidence.` });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 900,
        system: 'You identify natural stone, quartz and porcelain countertop slabs from photos for a fabrication shop. You are careful: you read labels exactly and say when you are unsure.',
        tools: [TOOL], tool_choice: { type: 'tool', name: 'record_slab' },
        messages: [{ role: 'user', content }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 200, { ok: false, error: (j.error && j.error.message) || 'The AI scanner is unavailable right now.' });
    const tu = (j.content || []).find((c) => c.type === 'tool_use');
    if (!tu || !tu.input) return send(res, 200, { ok: false, error: 'The scanner couldn’t read that photo. Try again closer, with good light.' });
    const g = tu.input;
    const clean = {
      isSlab: g.is_slab !== false,
      name: String(g.name || '').slice(0, 80),
      category: CATEGORIES.includes(g.category) ? g.category : 'Other',
      brand: String(g.brand || '').slice(0, 60),
      supplier: String(g.supplier || '').slice(0, 60),
      lot: String(g.lot || '').slice(0, 40),
      serial: String(g.serial || '').slice(0, 40),
      thickness: THICK.includes(g.thickness) && g.thickness !== 'unknown' ? g.thickness : '',
      L: Math.max(0, Math.min(200, Number(g.length_in) || 0)),
      W: Math.max(0, Math.min(120, Number(g.width_in) || 0)),
      finish: String(g.finish || '').slice(0, 30),
      color: /^#[0-9a-f]{6}$/i.test(g.color_hex || '') ? g.color_hex : '',
      matId: groups.some((x) => x.id === g.price_group_id) ? g.price_group_id : '',
      confidence: Math.max(0, Math.min(1, Number(g.confidence) || 0)),
      labelText: String(g.label_text || '').slice(0, 300),
      notes: String(g.notes || '').slice(0, 200),
    };
    return send(res, 200, { ok: true, guess: clean });
  } catch (e) {
    return send(res, 200, { ok: false, error: 'Couldn’t reach the AI scanner. Check your connection and try again.' });
  }
};
