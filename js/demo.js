/* =========================================================
   Sample shop (clearly marked, removable in Settings)
   ========================================================= */
function buildDemo() {
  const c = { ...DEFAULT_SETTINGS };
  const M = Object.fromEntries(c.materials.map((m) => [m.id, m]));
  const E = Object.fromEntries(c.edges.map((e) => [e.id, e]));
  const A = Object.fromEntries(c.addons.map((a) => [a.id, a]));
  const now = Date.now();
  const DAY = 86400000;
  const demo = true;

  const team = [
    ['Mike Alvarez', 'Owner', '#B33B0B', '(555) 201-4410'],
    ['Dana Cole', 'Office', '#2D5C9C', '(555) 201-4411'],
    ['Luis Ortega', 'Templater', '#0F7C80', '(555) 201-4417'],
    ['Sam Patel', 'Fabricator', '#7650AD', '(555) 201-4415'],
    ['Ray Jensen', 'Installer', '#2D7A4C', '(555) 201-4418'],
    ['Tony Brooks', 'Installer', '#A86C12', '(555) 201-4419'],
  ].map(([name, role, color, phone], i) => ({ id: 'demo-t' + (i + 1), name, role, color, phone, active: true, demo }));
  const T = (n) => team.find((m) => m.name.startsWith(n)).id;

  const customers = [
    ['Ann Hendricks', 'Homeowner', '(555) 310-2281', 'ann.hendricks@example.com', '1418 Ridge Ave, Oak Grove'],
    ['Priya Shah', 'Homeowner', '(555) 310-7720', 'priya.shah@example.com', '77 Linden Ct, Oak Grove'],
    ['Marcus & Elena Vogel', 'Homeowner', '(555) 310-9034', 'vogelfamily@example.com', '2210 Prairie Path, Westfield'],
    ['Lakeview Builders', 'Builder', '(555) 400-1200', 'tom@lakeviewbuilders.example.com', '900 Commerce Dr, Westfield'],
    ['Jordan Kim', 'Homeowner', '(555) 310-4412', 'jkim@example.com', '15 Birch Hollow, Oak Grove'],
    ['Barbara Nowak', 'Homeowner', '(555) 310-6619', 'bnowak@example.com', '402 W Elm St, Riverside'],
    ['Tasha Greene Interiors', 'Designer', '(555) 422-8800', 'studio@tashagreene.example.com', '33 Main St Suite 2, Riverside'],
    ['Green Street Cabinets', 'Cabinet shop', '(555) 433-1015', 'orders@greenstcab.example.com', '118 Green St, Westfield'],
    ['Dale Ortiz', 'Homeowner', '(555) 310-1187', 'dale.ortiz@example.com', '8 Cedar Bluff Rd, Oak Grove'],
    ['Rosa Fernandez', 'Homeowner', '(555) 310-5543', 'rosa.f@example.com', '61 Meadow Ln, Riverside'],
    ['Neil Patel', 'Homeowner', '(555) 310-8890', 'neilp@example.com', '19 Orchard Way, Westfield'],
  ].map(([name, type, phone, email, address], i) => ({ id: 'demo-c' + (i + 1), name, type, phone, email, address, notes: '', createdAt: now - (60 - i * 3) * DAY, demo }));
  const C = (n) => customers.find((x) => x.name.startsWith(n)).id;

  const P = (label, L, D, edges = 'f', kind = 'top') => ({ id: uid(), label, L, D, kind, edges: { f: edges.includes('f'), b: edges.includes('b'), l: edges.includes('l'), r: edges.includes('r') } });
  const area = (name, mat, edge, pieces, addons = [], tearOut = false) => ({
    id: uid(), name, mat: matSnap(M[mat]), edge: edgeSnap(E[edge]), thick: '3cm', tearOut, tearPrice: c.tearOutPerSqft,
    addons: addons.map(([id, n]) => ({ id, name: A[id].name, price: A[id].price, count: n })), pieces,
  });
  const quote = (areas, extra = {}) => ({ areas, lines: [], discount: { type: 'pct', value: 0 }, taxRate: 0, depositPct: 50, minCharge: c.minCharge, validDays: 30, notes: '', createdAt: now - 10 * DAY, ...extra });
  const kitchen = (mat, edge, island = true, tear = false) => {
    const a = [area('Kitchen', mat, edge, [P('Sink run', 112.25, 25.5, 'f'), P('Range run', 64, 25.5, 'fl'), P('Backsplash', 176.25, 4, '', 'splash')], [['a1', 1], ['a3', 1], ['a2', 0]], tear)];
    if (island) a.push(area('Island', mat, edge, [P('Island', 96, 42, 'fblr')], [['a5', 2]]));
    return a;
  };

  const jobs = [];
  const acts = [];
  const notes = [];
  let n = 1030;
  const addJob = (o) => {
    n++;
    const q = o.quote;
    const calc = q ? calcQuote(q, c) : null;
    const j = {
      id: 'demo-j' + n, number: 'J-' + n, name: o.name, customerId: o.cust, address: o.address || customers.find((x) => x.id === o.cust).address,
      stage: o.stage, salesId: o.sales || T('Mike'), source: o.source || 'Referral', createdAt: now - (o.age || 10) * DAY, updatedAt: now - (o.touched || 1) * DAY,
      quote: q, ...(q ? jobRollup(q, calc) : { total: 0, sqft: 0 }), checklist: o.checklist || {}, payments: o.payments ? o.payments.map((p) => ({ id: uid(), ...p })) : [],
      quotedAt: o.quotedAt ? now - o.quotedAt * DAY : (q ? now - (o.age || 10) * DAY + DAY : null), soldAt: o.soldAt ? now - o.soldAt * DAY : null, demo,
    };
    if (o.paidPct) j.payments = [{ id: uid(), amount: round2(j.total * o.paidPct), method: 'Check', date: today(), note: o.paidPct >= 1 ? 'Paid in full' : 'Deposit' }];
    jobs.push(j);
    for (const a of o.acts || []) acts.push({ id: uid(), jobId: j.id, type: a[0], date: a[1], time: a[2] || '', duration: a[3] || '', crew: a[4] || [], status: a[5] ? 'done' : 'scheduled', notes: a[6] || '', createdAt: now, demo });
    notes.push({ id: uid(), jobId: j.id, kind: 'event', text: 'Job created', by: o.sales || T('Mike'), at: j.createdAt, demo });
    for (const t of o.notes || []) notes.push({ id: uid(), jobId: j.id, kind: t[0], text: t[1], by: t[2] || T('Dana'), at: now - (t[3] || 1) * DAY, demo });
    return j;
  };

  addJob({ name: 'Kitchen remodel', cust: C('Ann'), stage: 'closed', age: 40, soldAt: 34, paidPct: 1, checklist: { deposit: true, layout: true, sink: true, cabinets: true, final: true },
    quote: quote(kitchen('m6', 'e2', true, true)), acts: [['template', bizDay(-18), '09:00', '2 hrs', [T('Luis')], true], ['install', bizDay(-9), '08:00', 'Full day', [T('Ray'), T('Tony')], true], ['service', bizDay(2), '13:00', '1 hr', [T('Ray')], false, 'Polish small chip at sink corner — warranty']],
    notes: [['note', 'Customer loves it. Asked for a review card.', T('Mike'), 8]] });
  addJob({ name: 'Two hall & primary vanities', cust: C('Priya'), stage: 'installed', age: 24, soldAt: 19, paidPct: 0.5, checklist: { deposit: true, layout: true, sink: true, cabinets: true },
    quote: quote([area('Primary bath', 'm4', 'e1', [P('Double vanity', 72.5, 22.5, 'fl')], [['a9', 2], ['a3', 2]]), area('Hall bath', 'm4', 'e1', [P('Vanity', 48, 22.5, 'f'), P('Side splash', 22.5, 4, '', 'splash')], [['a9', 1], ['a3', 1]])]),
    acts: [['template', bizDay(-8), '10:00', '1 hr', [T('Luis')], true], ['install', bizDay(-2), '09:00', 'Half day', [T('Tony')], true]] });
  addJob({ name: 'Kitchen + waterfall island', cust: C('Marcus'), stage: 'fabrication', age: 21, soldAt: 14, paidPct: 0.5, checklist: { deposit: true, layout: true, sink: true },
    quote: (() => { const k = kitchen('m7', 'e3', true, true); k[1].addons.push({ id: 'a10', name: A.a10.name, price: A.a10.price, count: 2 }); k[1].pieces.push(P('Waterfall leg L', 42, 35.25, 'f'), P('Waterfall leg R', 42, 35.25, 'f')); return quote(k); })(),
    acts: [['template', bizDay(-6), '08:30', '2 hrs', [T('Luis')], true], ['fabrication', bizDay(0), '', 'Full day', [T('Sam')]], ['install', bizDay(3), '08:00', 'Full day', [T('Ray'), T('Tony')]]],
    notes: [['note', 'Elena wants the vein on the waterfall to flow down from the top — book-match the legs.', T('Luis'), 6], ['note', 'Slab #2 has a fissure near the end; cut around it.', T('Sam'), 1]] });
  addJob({ name: 'Lot 14 — The Aspen plan', cust: C('Lakeview'), stage: 'fabrication', age: 18, soldAt: 15, source: 'Builder', checklist: { deposit: true, layout: true, sink: true, cabinets: true }, paidPct: 0.3,
    quote: quote(kitchen('m1', 'e1', true)), acts: [['template', bizDay(-5), '07:30', '1 hr', [T('Luis')], true], ['fabrication', bizDay(1), '', 'Full day', [T('Sam')]], ['install', bizDay(2), '08:00', 'Full day', [T('Ray'), T('Tony')]]] });
  addJob({ name: 'Lot 15 — The Birch plan', cust: C('Lakeview'), stage: 'templated', age: 16, soldAt: 14, source: 'Builder', checklist: { deposit: true, layout: true }, paidPct: 0.3,
    quote: quote(kitchen('m1', 'e1', true)), acts: [['template', bizDay(-1), '07:30', '1 hr', [T('Luis')], true], ['fabrication', bizDay(4), '', 'Full day', [T('Sam')]]],
    notes: [['issue', 'Island cabinets out of level by 3/8" at the back — super said they will shim before install.', T('Luis'), 1]] });
  addJob({ name: 'Kitchen refresh', cust: C('Jordan'), stage: 'sold', age: 12, soldAt: 3, checklist: { deposit: true }, paidPct: 0.5,
    quote: quote(kitchen('m5', 'e2', false, true)), acts: [['template', bizDay(1), '10:00', '2 hrs', [T('Luis')]]] });
  addJob({ name: 'Laundry + powder room', cust: C('Barbara'), stage: 'sold', age: 9, soldAt: 2,
    quote: quote([area('Laundry', 'm2', 'e1', [P('Folding counter', 70, 25.5, 'fr')], [['a1', 1]]), area('Powder room', 'm2', 'e1', [P('Vanity', 31, 19, 'f')], [['a9', 1], ['a3', 1]])]) });
  addJob({ name: 'Whitfield residence kitchen', cust: C('Tasha'), stage: 'quoted', age: 13, quotedAt: 11, source: 'Designer', sales: T('Mike'),
    quote: quote(kitchen('m7', 'e7', true)), notes: [['note', 'Designer wants a 2" mitered edge on the island only. Sent revised number.', T('Mike'), 9]] });
  addJob({ name: 'Bar top & back bar', cust: C('Green Street'), stage: 'quoted', age: 4, quotedAt: 2, source: 'Cabinet shop',
    quote: quote([area('Bar top', 'm3', 'e5', [P('Bar top', 118, 14, 'fb'), P('Back bar', 96, 21, 'f')], [['a5', 1]])]) });
  addJob({ name: 'Lot 16 — The Aspen plan', cust: C('Lakeview'), stage: 'quoted', age: 6, quotedAt: 4, source: 'Builder', quote: quote(kitchen('m1', 'e1', true)) });
  addJob({ name: 'Outdoor kitchen', cust: C('Dale'), stage: 'lead', age: 1, source: 'Website', quote: null, notes: [['note', 'Wants granite for an outdoor grill island, about 12 ft. Call back after 5pm.', T('Dana'), 1]] });
  addJob({ name: 'Primary bathroom', cust: C('Rosa'), stage: 'lead', age: 5, source: 'Home show', quote: null });
  addJob({ name: 'Kitchen — marble', cust: C('Neil'), stage: 'lost', age: 30, quote: quote(kitchen('m8', 'e6', false)), notes: [['event', 'Moved from Quoted to Lost — went with a big-box store', T('Mike'), 12]] });

  /* slab inventory: some allocated to jobs in production, some used, a few remnants */
  const slabs = [];
  let sn = 1000;
  const J = (num) => (jobs.find((x) => x.number === num) || {}).id || null;
  const slab = (name, mat, n, o = {}) => { for (let i = 0; i < n; i++) { const m = M[mat]; slabs.push({ id: 'demo-sl' + (++sn), serial: 'S-' + sn, kind: 'slab', status: 'available', name, matId: mat, group: m.name, color: m.color, thick: '3cm', L: mat === 'm7' ? 128 : 126, W: mat === 'm7' ? 77 : 63, location: o.loc || 'Rack A' + ((sn % 6) + 1), lot: o.lot || '', supplier: o.sup || 'MSI', cost: o.cost || 0, notes: '', receivedAt: now - (o.age || 20) * DAY, demo, ...(o.s ? o.s(i) : {}) }); } };
  slab('Taj Mahal', 'm7', 4, { loc: 'Rack B1', lot: 'TM-2291', sup: 'Stone Source', cost: 2150, s: (i) => (i < 3 ? { status: 'allocated', jobId: J('J-1033') } : {}) });
  slab('Steel Grey', 'm1', 6, { lot: 'SG-118', sup: 'Granite Depot', cost: 690, s: (i) => (i < 2 ? { status: 'allocated', jobId: J('J-1034') } : i < 4 ? { status: 'allocated', jobId: J('J-1035') } : {}) });
  slab('Calacatta Laza', 'm6', 5, { lot: 'CL-77', sup: 'MSI', cost: 1480, s: (i) => (i < 2 ? { status: 'used', jobId: J('J-1031'), usedAt: now - 9 * DAY } : {}) });
  slab('Pure White', 'm4', 3, { lot: 'PW-402', sup: 'MSI', cost: 820, s: (i) => (i < 1 ? { status: 'used', jobId: J('J-1032'), usedAt: now - 3 * DAY } : {}) });
  slab('Absolute Black', 'm3', 2, { lot: 'AB-09', sup: 'Granite Depot', cost: 1150 });
  slab('Fantasy Brown', 'm8', 1, { lot: 'FB-31', sup: 'Stone Source', cost: 1900, loc: 'Yard' });
  const rem = (parentSerial, L, W, loc) => { const p = slabs.find((x) => x.serial === parentSerial); slabs.push({ ...p, id: 'demo-sl-r' + slabs.length, serial: parentSerial + '-R1', kind: 'remnant', status: 'available', jobId: null, parentId: p.id, L, W, location: loc, cost: 0, usedAt: null }); };
  rem('S-1011', 54, 26, 'Remnant rack');
  rem('S-1016', 38, 22.5, 'Remnant rack');

  return { team, customers, jobs, activities: acts, notes, files: [], slabs };
}
