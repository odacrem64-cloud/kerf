// GET /api/brand-logo — fetches the Midwest Surfaces logo from mwsurfaces.com so the app can save it as the shop logo.
// Only this one image can be fetched; nothing else passes through.
const LOGO_URL = 'https://img1.wsimg.com/isteam/ip/b9fc042d-5ecd-43de-bb01-b8bb1033817e/Asset%203.png';

module.exports = async (req, res) => {
  try {
    const r = await fetch(LOGO_URL, { headers: { 'User-Agent': 'MidwestSurfacesShopManager/1.0' } });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\/(png|jpeg|webp|gif)/.test(type)) { res.statusCode = 502; res.setHeader('Cache-Control', 'no-store'); return res.end('Logo not available'); }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) { res.statusCode = 502; return res.end('Logo too large'); }
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.end(buf);
  } catch (e) {
    res.statusCode = 502; res.setHeader('Cache-Control', 'no-store'); res.end('Logo not available');
  }
};
