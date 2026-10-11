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

const SHOP = { name: 'Midwest Surfaces', city: 'Frankfort, IL', app: 'Shop Manager' };
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
const DURATIONS = ['', 'AM window 9–1', 'PM window 1–5', '1 hr', '2 hrs', '3 hrs', '3–5 hrs', 'Half day', 'Full day', '2 days'];
const ROLES = ['Owner', 'Office', 'Sales', 'Templater', 'Fabricator', 'Installer', 'Helper'];
const SOURCES = ['Showroom walk-in', 'Website', 'Facebook', 'Instagram', 'Builder', 'Designer', 'Cabinet shop', 'Referral', 'Repeat customer', 'Home show'];
const CUST_TYPES = ['Homeowner', 'Builder', 'Designer', 'Cabinet shop', 'Commercial'];
/* Midwest Surfaces' own requirements before measure and install */
const CHECKS = [
  { id: 'deposit', name: 'Deposit in (75%, or paid in full under $2,000)' },
  { id: 'cabinets', name: 'Cabinets in final spot & screwed to the wall' },
  { id: 'sink', name: 'Sink & appliances on site (farm sink installed)' },
  { id: 'cleared', name: 'Countertops cleared for measure' },
  { id: 'layout', name: 'Field measure ticket signed (no changes after)' },
  { id: 'supports', name: 'Overhang supports in place (over 8")' },
  { id: 'final', name: 'Balance collected at install' },
];
const PAY_METHODS = ['Check', 'Card', 'Cash', 'ACH / transfer', 'Financing'];
const MEMBER_COLORS = ['#B33B0B', '#2D5C9C', '#0F7C80', '#7650AD', '#2D7A4C', '#A86C12', '#BE3328', '#5149B8', '#4F5A55', '#9C3D7A'];
const AREA_PRESETS = ['Kitchen', 'Island', 'Vanity', 'Bar top', 'Laundry', 'Fireplace', 'Outdoor kitchen', 'Shower curb & niche'];

/* Midwest Surfaces — details from mwsurfaces.com (Oct 2026). Prices are starter numbers: set the real ones in Settings. */
/* Wording from Midwest Surfaces' own proposal form (Proposal + Terms and Conditions + What to Expect). */
const MWS_INTRO = `We hereby propose to furnish Material and Labor. This Estimate is based upon clients plans and is subject to adjustment after Midwest Surfaces has field measured the job site. Unless otherwise noted, this estimate does not include reconnect or removal of existing tops, plumbing or gas connections.
This proposal is limited to items and or materials that are in stock and available on the date of this proposal only. Midwest Surfaces cannot guarantee the availability of any items and or materials beyond this date.`;
const MWS_ACCEPT = `The prices, specifications and conditions provided on this proposal (the “Proposal”), and the terms and conditions appearing on the following pages, are satisfactory and are hereby accepted by Customer. Contractor is authorized to perform the scope of work described herein as specified, subject to the instructions appearing on the face of this Proposal and the terms and conditions appearing on the reverse side hereof. Payment by Customer to Contractor shall be made as outlined above, subject to the instructions appearing on the face of this Proposal and the terms and conditions appearing on the following pages.
Once this proposal has been accepted, no cancellations will be permitted unless written notice is sent by Customer to Contractor within three (3) days of date of acceptance.`;
const MWS_TERMS = `1. Entire Agreement
These Terms and Conditions govern the Proposal and are incorporated into any subsequent contract between the parties as if fully set forth therein. Together with the Proposal and any subsequent contract, purchase order, or other writing, they form the “Contract Documents,” which constitute the entire integrated agreement between Midwest Surfaces and Customer (collectively, “the parties”) relating to the subject matter. The Contract Documents supersede all prior understandings, proposals, negotiations, representations, communications, or agreements, whether oral, written, or implied.
By signing or accepting the Contract Documents, Customer represents and warrants that it has carefully reviewed and independently investigated all terms and is not relying on any representations, inducements, or understandings outside of the Contract Documents. The Contract Documents may be amended only by a written agreement signed by the President of Midwest Surfaces and an authorized representative of Customer.
2. Performance of Work
All work performed by Midwest Surfaces under the Contract Documents (“Work”) will be completed in a workmanlike manner according to standard industry practices. To the extent required by law, all Work shall be performed by individuals duly licensed and authorized to perform such services.
3. Price and Changes
Customer shall pay Midwest Surfaces the amounts stated in the Contract Documents (“Price”) for the satisfactory performance of the Work. The Price includes the fixed estimate in the Proposal as well as any time-and-material, unit, or alternate prices, and is subject to additions and deductions as provided in the Contract Documents.
Any alteration or deviation from the specifications in the Proposal that involves extra costs — including Midwest Surfaces’ reasonable costs for demobilization, delay, and remobilization — will be performed only upon a written change order and will be charged as an addition to the Price.
4. Collection and Lien Costs
The Price shall include reimbursement to Midwest Surfaces for all costs, expenses, attorneys’ fees, consultants’ fees, and litigation costs incurred or anticipated in connection with the Price or any mechanic’s lien arising from Customer’s failure to make timely payment as required by the Proposal. This includes costs related to work stoppage under Paragraph 12 and any legal action to collect the Price or enforce a lien.
5. Materials, Equipment, and Warranty
Midwest Surfaces will supply all materials and equipment reasonably necessary to perform the Work. All Work is guaranteed to be free from defects in materials and workmanship for one (1) year from the date of completion, ordinary wear and tear excepted.
Any oral or written statements by Midwest Surfaces’ agents, officers, or employees regarding quality, durability, suitability, or any other matter that conflict with this limited warranty are expressly disclaimed and shall not be relied upon by Customer.
6. Lien Waivers
Customer may not require lien or claim waivers as a condition of payment. Midwest Surfaces will provide appropriate lien releases or waivers upon receipt of requested progress or final payment.
7. Payment Terms and Acceptance
Payment of all or any portion of the Price constitutes Customer’s acceptance of the corresponding Work. Unless otherwise agreed in writing:
• Jobs over $2,000 require a 75% deposit before work begins, with the balance due at installation.
• Jobs under $2,000 must be paid in full prior to field measurement and/or fabrication.
8. No Setoff
Customer has no right to setoff or withhold any portion of the Price for any claims or liabilities arising outside the Contract Documents.
9. Delays
The Price will not be reduced for delays caused by circumstances beyond Midwest Surfaces’ reasonable control, including strikes, material shortages, casualty, or Acts of God.
10. Limitation of Damages
Under no circumstances shall Midwest Surfaces be liable for consequential, incidental, special, punitive, or exemplary damages (including loss of profits, revenues, use, cost of substitute goods or services, or downtime), whether arising from breach, tort, or otherwise, even if Midwest Surfaces knew or should have known such damages might occur.
11. Interest and Late Charges
Customer shall pay:
(a) interest on all past-due amounts at 1.5% per month or the maximum rate permitted by law, whichever is greater; and
(b) a late charge of 5% of the unpaid amount if payment is more than thirty (30) days past due.
This late charge is liquidated damages and does not prevent Midwest Surfaces from recovering attorneys’ fees and costs as provided in Paragraph 4.
12. Work Stoppage and Credit Card Authorization
If Customer fails to make any required payment, Midwest Surfaces may immediately cease work without breach until payment is received. Midwest Surfaces may also charge the outstanding balance to any credit card provided by Customer, and Customer hereby gives irrevocable consent to such charges.
13. Setoff Rights
Upon Customer’s failure to pay when due, Midwest Surfaces may set off any amounts owed against any accounts, credits, money, or property of Customer held by Midwest Surfaces, without prior notice or consent.
14. Confession of Judgment
Customer authorizes any attorney or clerk of court, upon Customer’s failure to pay when due, to enter judgment by confession against Customer in any court of competent jurisdiction in Illinois for the full Price plus interest, late charges, attorneys’ fees, and court costs. Customer waives stay of execution, right of appeal, and the benefit of all exemption laws. This power may be exercised repeatedly until full payment is received.
15. Cumulative Rights
No renewal, extension of payment time, or delay in enforcement affects Customer’s obligations. All rights of Midwest Surfaces are cumulative and may be exercised simultaneously or sequentially.
16. Governing Law
The Contract Documents shall be governed by the internal laws of the State of Illinois, without regard to conflict of laws rules.
17. Installation Requirements
Midwest Surfaces will not install any countertop without proper supports in place at the time of installation. Customer must provide all plumbing and appliance templates at or before Field Measurement.
18. Natural Stone Variations
Natural stone varies in structure, pitting, color, veining, and other characteristics. No returns or rejections are allowed for natural variations. No return or rejection of material or layout is permitted after fabrication begins. If Customer does not inspect the raw material and layout, Customer accepts the material and layout as selected by Midwest Surfaces.
19. Field Measurement Standards
During Field Measurement, Midwest Surfaces will provide an overhang of approximately 1” to 1¼” at all support structures unless otherwise noted. Countertop edges will overhang cabinet door/drawer fronts by approximately ¾” (or the cabinet itself if no doors/drawers exist) unless otherwise noted. At appliance openings, countertops will be flush to the cabinet sides unless otherwise noted. All measurements are subject to a ± 1/8” tolerance. Stone-to-stone seams will be approximately 1/16” wide and will be determined at fabrication in Midwest Surfaces’ sole discretion.
20. Appliances and Fixtures at Measurement
All appliances (cooktops, vents, etc.), plumbing fixtures (sinks, faucets, etc.), and any items requiring cutouts must be at the jobsite during Field Measurement. Customer is responsible for selecting appliances that allow for a structurally sound countertop after cutouts. If required items are missing, a $150 rescheduling fee will apply. If a cutout would compromise structural integrity, Midwest Surfaces will discuss alternatives during measurement.
21. Undermount Sinks
Undermount sinks will be cut using the supplied template unless otherwise noted during Field Measurement. Any accessories intended for the undermount sink must be presented and discussed at the time of measurement.
22. Installation Surfaces and On-Site Work
Unless otherwise noted, installation occurs on Customer-supplied flat, prepared, and level surfaces and/or securely installed cabinets. On-site cutouts are an extra charge unless included in the Proposal.
23. Severability
If any provision of the Contract Documents is held invalid, illegal, or unenforceable by a court, it shall be enforced to the maximum extent possible, and the remaining provisions shall remain in full force and effect.
24. Conflict Resolution
In case of conflict between Contract Documents, the later-dated document prevails. In case of conflict within these Terms, the provision imposing the higher standard, shorter notice, or greater requirement on Customer shall prevail.
25. Claims and Venue
Any claim or cause of action must be filed in a court located in Will County, State of Illinois, within two (2) years of discovery but no later than four (4) years from the date of the incident. Customer waives any right to a jury trial. This provision survives termination of the Proposal.
26. Customer Authority
If Customer is a corporation, LLC, limited partnership, or similar entity, Customer represents and warrants that it is duly organized under the laws of its state of formation and has full power and authority to enter into and perform the Contract Documents.
27. Insurance and Permits
Customer shall obtain and maintain all necessary insurance (including fire and tornado) and secure all required permits at its own expense. Midwest Surfaces maintains adequate public liability insurance and workers’ compensation coverage.`;
const MWS_EXPECT = `Scheduling & Arrival Windows
Scheduled time is not a guaranteed start time. It is a window of arrival between 9:00 AM – 1:00 PM or 1:00 PM – 5:00 PM.
On rare occasions, due to circumstances beyond our control, we may arrive outside of the scheduled window.
A typical kitchen countertop installation takes 3–5 hours on average.
Appointments
There will be only one scheduled measure and installation appointment per project. We do not call to confirm appointments.
If you are not available when we arrive and we are unable to measure or install, an additional $150 trip charge will apply.
Preparation Requirements Before Measurement
• All cabinets, including end panels and legs, must be securely screwed to the wall and in their final location before we measure.
• If any cabinets are missing or not securely installed, we cannot perform the measurement.
• If you did not purchase your sink(s) from us, the sink(s) must be at your home at the time of measurement.
• All sinks and appliances are required for accurate measurement. If they are not present, you will incur a $150 trip charge for a return measurement appointment.
• Farm sinks must be fully installed prior to measurement.
• Any new appliances must be in their final position for both measurement and installation.
• All countertops must be completely cleared before we arrive to measure.
You will be required to review and sign off on the field measure shop ticket. No changes of any kind will be accepted after sign-off.
Installation Day Guidelines
• We do not reconnect plumbing or install your faucet.
• We do not reconnect any appliances.
• If you have animals or children that are sensitive to chemicals, they must not be on site during installation.
• Measure and installation crews are required to wear shoes at all times.
• Installers are not allowed to walk on tarps, as this creates a dangerous trip hazard. Tarps may be used only after all countertops are set in place.
• Most cooktop and drop-in cut-outs are finished on site and will create dust. Faucet holes are drilled in your home, which will also create dust.
Natural Stone Characteristics
Natural stone is a product of nature and commonly contains pits, fissures, veining, and color variations. Each piece has its own unique appearance, texture, and polish. These natural variations should be expected and are not considered defects.
Backsplash Installation Notes
Backsplashes sit directly on the countertop and flush against the wall. Stone does not flex.
• If your walls are bowed, you may see small gaps behind the backsplash. In most cases, these can be filled with paintable caulk.
• If the gap is too large, you may need to repair the drywall to correct it.
• If you have existing tile and ordered a 4” backsplash, minor gaps may occur between the new backsplash and the tile. These can usually be grouted after installation.
Plumbing & Silicone Curing
Midwest Surfaces does not reconnect any plumbing after installation of the countertop.
• Do not reconnect the plumbing or have a plumber do so until the next day.
• Do not use the sink or dishwasher until the plumbing is reconnected and the silicone has fully cured.
Overhang Supports
All overhangs greater than 8 inches require proper supports in place prior to installation. Midwest Surfaces does not install supports.
We cannot install granite without proper supports. It is your responsibility to have these in place before installation.
Any knee wall that is 4” wide with an overhang must have supports installed to bear the weight of the granite.
Tear-Out & Haul Away
Tear-out and haul-away of existing countertops is an optional service and is not included unless specifically stated in your contract. Please inform us prior to signing the contract if you require this service.
If we perform the tear-out:
• Dust will be generated. We recommend emptying all cabinets and drawers, especially the cooktop and sink cabinets.
• Although our installers are careful, minor drywall dings, nicks, or damage may occur. You may need to make minor repairs afterward.
Countertop Care & Maintenance
• Never sit, stand, or walk on your quartz or stone countertops.
Cleaning & Sealing (Granite Only)
Cleaning and sealing the granite is the final step of your installation. We apply Miracle Sealants 511 Impregnator, which forms an invisible barrier that is resistant to moisture and stains while still allowing vapor to escape.
Daily Cleaning
Use a mild soap and water or 409 Natural Stone Cleaner (available at Menards, Jewel, or Ace Hardware). Wipe up all spills immediately to avoid staining.
Re-Sealing
We recommend re-sealing your granite every 6 months with 511 Impregnator (available in the flooring department at Menards or Home Depot). Follow the directions on the package.
A temporary haze or streaking may appear for up to three weeks after sealing. This is normal and will disappear with regular cleaning.
Quartz countertops do not require sealing.`;
/* Earlier starter terms (summarised from mwsurfaces.com). Shops that saved these get the real wording above instead. */
const MWS_TERMS_V1 = `Before we measure: cabinets must be in their final position and securely screwed to the wall. Sinks and appliances must be on site (farm sinks fully installed). Countertops must be completely cleared. The field measure ticket must be signed; no changes of any kind are accepted after sign-off. Missing items or a return visit carry a $150 trip charge.
Installation: arrival is a window (9 AM–1 PM or 1 PM–5 PM), not a set time, with one appointment per project. Overhangs over 8" need supports installed before installation (not provided by Midwest Surfaces). Pets or children sensitive to chemicals should not be on site. Cutouts and faucet holes create dust.
Plumbing: we do not reconnect plumbing, faucets or appliances. Wait until the next day to reconnect plumbing, and don't use the sink or dishwasher until the silicone has cured.
Tear-out is optional and not included unless listed on this quote.
Payment: jobs over $2,000 require a 75% deposit before work begins, balance due at installation. Jobs under $2,000 are paid in full before field measure. Past-due balances accrue interest; a late charge applies after 30 days.
Natural stone varies in color, pattern and veining. Seam placement is reviewed with you before fabrication.`;
const DEFAULT_SETTINGS = {
  shopName: 'Midwest Surfaces', shopPhone: '(815) 671-8990', shopEmail: '', shopAddress: '21950 LaGrange Road, Unit B, Frankfort, IL',
  shopHours: 'Mon–Fri 10–4 · Sat 9–2 · Sun closed', shopWeb: 'mwsurfaces.com', logo: '',
  activityTypes: [
    { id: 'at_saw_baca', name: 'Saw – Baca SawJet', color: '#5149B8' },
    { id: 'at_saw_dona', name: 'Saw – Donatoni Jet', color: '#9C3D7A' },
    { id: 'at_delivery', name: 'Delivery', color: '#0F7C80' },
  ],
  taxRate: 0, depositPct: 75, payInFullUnder: 2000, tripCharge: 150, minCharge: 1200, tearOutPerSqft: 8, quoteValidDays: 30,
  proposalIntro: MWS_INTRO, acceptText: MWS_ACCEPT, quoteTerms: MWS_TERMS, expectText: MWS_EXPECT,
  slabL: 126, slabW: 63,
  capInstallSqft: 160, capTemplates: 4,
  materials: [
    { id: 'm1', group: 'Granite', name: 'Granite – Level 1', price: 42, color: '#8C8077' },
    { id: 'm2', group: 'Granite', name: 'Granite – Level 2', price: 52, color: '#5F5650' },
    { id: 'm3', group: 'Granite', name: 'Granite – Level 3 (exotic)', price: 64, color: '#38332F' },
    { id: 'm4', group: 'Quartz', name: 'Quartz – Group A', price: 55, color: '#E5E2DC' },
    { id: 'm5', group: 'Quartz', name: 'Quartz – Group B', price: 66, color: '#D8D4CC' },
    { id: 'm6', group: 'Quartz', name: 'Quartz – Group C (Calacatta looks)', price: 79, color: '#F1EEE8' },
    { id: 'm7', group: 'Quartzite', name: 'Quartzite', price: 95, color: '#CDC5B7' },
    { id: 'm8', group: 'Marble', name: 'Marble', price: 88, color: '#ECEAE5' },
    { id: 'm11', group: 'Dolomite', name: 'Dolomite', price: 85, color: '#E8E6E1' },
    { id: 'm9', group: 'Porcelain', name: 'Porcelain', price: 72, color: '#C8C5BF' },
  ],
  edges: [
    { id: 'e1', name: 'Square Eased', price: 0 },
    { id: 'e8', name: '1/4" Radius', price: 0 },
    { id: 'e4', name: 'Beveled', price: 10 },
    { id: 'e3', name: 'Half Bullnose', price: 8 },
    { id: 'e5', name: 'Bullnose', price: 16 },
    { id: 'e6', name: 'Ogee', price: 24 },
    { id: 'e9', name: 'Dupont', price: 26 },
    { id: 'e10', name: 'Cove Dupont', price: 30 },
    { id: 'e7', name: 'Miter', price: 38 },
    { id: 'e11', name: 'Lamination', price: 32 },
    { id: 'e12', name: 'Waterfall', price: 40 },
  ],
  addons: [
    { id: 'a1', name: 'Cut out – large undermount', price: 0 },
    { id: 'a22', name: 'Cut out – small undermount', price: 0 },
    { id: 'a3', name: 'Faucet hole', price: 0 },
    { id: 'a2', name: 'Cooktop cutout', price: 150 },
    { id: 'a4', name: 'Extra drill hole', price: 25 },
    { id: 'a5', name: 'Cut out – electrical', price: 35 },
    { id: 'a6', name: 'Radius corner', price: 45 },
    { id: 'a11', name: 'Farm sink notch', price: 125 },
    { id: 'a10', name: 'Waterfall leg', price: 350 },
    { id: 'a7', name: 'Sink – SS single bowl 3219 (16 ga)', price: 249 },
    { id: 'a8', name: 'Sink – MSI 50/50 3219 double bowl handcrafted (16 ga)', price: 279 },
    { id: 'a12', name: 'Sink – MSI 2318 single bowl handcrafted (16 ga)', price: 229 },
    { id: 'a13', name: 'Sink – SS double 50/50 3118 (18 ga)', price: 199 },
    { id: 'a14', name: 'Sink – SS single bowl 3018 (18 ga, bar/laundry)', price: 179 },
    { id: 'a15', name: 'Sink – SS double 60/40 3120S (18 ga)', price: 209 },
    { id: 'a16', name: 'Sink – SS workstation 3319 (16 ga)', price: 449 },
    { id: 'a17', name: 'Sink – Quartz composite QU-670', price: 329 },
    { id: 'a18', name: 'Sink – Quartz composite QU-810', price: 359 },
    { id: 'a19', name: 'Sink – Quartz composite QU-811', price: 359 },
    { id: 'a9', name: 'Vanity sink – MSI 2015 white rectangle', price: 110 },
    { id: 'a20', name: 'Vanity sink – white oval porcelain 1714', price: 95 },
    { id: 'a21', name: 'Trip charge (return visit)', price: 150 },
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
  robot: '<path d="M12 6.5V4"/><circle cx="12" cy="3" r="1.3"/><rect x="4.5" y="6.5" width="15" height="12" rx="4"/><circle cx="9.3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.7" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M9.8 15.6h4.4M2.5 11v3.5M21.5 11v3.5M8.5 21h7"/>',
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
