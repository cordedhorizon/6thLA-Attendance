// Site-only: who was at an event, sortable tables, "data as of", links that remember the view,
// company pages and compare. Runs after members.js and uses its helpers (window.LA).
(function () {
  const L = window.LA;
  const { all, td, pill, emptyRow, tiles, legend, nameButton, openPerson, matchName, plural, addDays, daysBetween, dayOf, iso } = L;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const currentTab = () => document.querySelector('.la-page:not([hidden])')?.id || 'regiment';

  // ---------- who was at an event or drill ----------
  const dlg = el('dialog', 'mb-dialog');
  dlg.setAttribute('aria-labelledby', 'mb-dialog-title');
  document.addEventListener('DOMContentLoaded', () => document.body.append(dlg));
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });

  window.laShowPost = function (post) {
    const b = all();
    if (!b) return;
    const rs = b.data.filter((r) => r.post === post);
    if (!rs.length) return;
    const p = rs[0];
    dlg.replaceChildren();
    const head = el('div', 'mb-dialog-head');
    const h = el('h3', null, `${dayOf(p.date)} ${p.kind}, ${dayName(p.date)}`);
    h.id = 'mb-dialog-title';
    const close = el('button', 'bd-small', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => dlg.close());
    head.append(h, close);
    const m = p.score ? String(p.score).match(/^\s*(\d+)\s*[-–:]\s*(\d+)/) : null;
    const result = m ? (+m[1] > +m[2] ? `Won ${m[1]}-${m[2]}` : +m[1] < +m[2] ? `Lost ${m[1]}-${m[2]}` : `Drew ${m[1]}-${m[2]}`) : null;
    const sub = el('p', 'mb-note', [plural(rs.length, 'person', 'people') + ' attended', result].filter(Boolean).join('. ') + '. Click a name to open their card.');
    const body = el('div', 'mb-roster');
    const groups = d3.group(rs, (r) => r.company);
    for (const c of [...groups.keys()].sort((a, z) => companyRank(a) - companyRank(z) || a.localeCompare(z))) {
      const sec = el('section');
      const names = groups.get(c).map((r) => r.name).sort((a, z) => a.localeCompare(z));
      sec.append(el('h4', null, `${c} (${names.length})`));
      const ul = el('ul');
      for (const n of names) {
        const li = el('li');
        const btn = el('button', 'mb-name', n);
        btn.type = 'button';
        btn.addEventListener('click', () => { dlg.close(); openPerson(n); });
        li.append(btn);
        ul.append(li);
      }
      sec.append(ul);
      body.append(sec);
    }
    dlg.append(head, sub, body);
    if (!dlg.open) dlg.showModal();
  };
  const pickRow = (ev) => {
    const tr = ev.target.closest('tr[data-post]');
    if (!tr || ev.target.closest('button')) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.type === 'keydown') ev.preventDefault();
    window.laShowPost(tr.dataset.post);
  };
  document.addEventListener('click', pickRow);
  document.addEventListener('keydown', pickRow);
  // The builder's tip shows only when the chart has one point per event or drill.
  dash.onData(() => {
    const x = document.getElementById('bd-x');
    for (const t of document.querySelectorAll('.bd-pick-tip')) t.hidden = !x || x.value !== 'post';
  });
  document.getElementById('bd-x')?.addEventListener('change', () => {
    for (const t of document.querySelectorAll('.bd-pick-tip')) t.hidden = document.getElementById('bd-x').value !== 'post';
  });

  // ---------- sortable tables ----------
  function sortValue(cell) {
    const t = cell.textContent.trim();
    if (t === '' || t === '—') return null;
    if (/^-?[\d,]+(\.\d+)?%?$/.test(t)) return parseFloat(t.replace(/,/g, ''));
    if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(t)) return Date.parse(t + ' UTC');
    const lead = t.match(/^(\d[\d,]*) /);
    if (lead) return parseFloat(lead[1].replace(/,/g, ''));
    return t.toLowerCase();
  }
  function applySort(table) {
    const s = table._sort;
    const tb = table.tBodies[0];
    if (!s || !tb) return;
    const rows = [...tb.rows].filter((r) => !r.querySelector('.mb-empty'));
    const keyed = rows.map((r, i) => ({ r, i, v: r.cells[s.i] ? sortValue(r.cells[s.i]) : null }));
    keyed.sort((a, b) => {
      if (a.v == null && b.v == null) return a.i - b.i;
      if (a.v == null) return 1;
      if (b.v == null) return -1;
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v));
      return c * s.dir || a.i - b.i;
    });
    if (keyed.some((k, i) => k.r !== rows[i])) for (const k of keyed) tb.append(k.r);
  }
  function makeSortable(table) {
    if (table._sortable) return;
    table._sortable = true;
    const ths = [...table.querySelectorAll('thead th')];
    ths.forEach((th, i) => {
      const btn = el('button', 'mb-sort');
      btn.type = 'button';
      btn.append(th.textContent, el('span', 'mb-sort-icon'));
      btn.setAttribute('aria-label', `Sort by ${th.textContent}`);
      th.replaceChildren(btn);
      th.setAttribute('aria-sort', 'none');
      btn.addEventListener('click', () => {
        const s = table._sort;
        const numeric = th.classList.contains('la-n') || /seen|date|joined/i.test(th.textContent);
        table._sort = s && s.i === i ? { i, dir: -s.dir } : { i, dir: numeric ? -1 : 1 };
        ths.forEach((h, j) => h.setAttribute('aria-sort', j === i ? (table._sort.dir > 0 ? 'ascending' : 'descending') : 'none'));
        applySort(table);
      });
    });
    // Rows are redrawn whenever filters change; keep the chosen order.
    new MutationObserver(() => applySort(table)).observe(table.tBodies[0], { childList: true });
  }
  document.addEventListener('DOMContentLoaded', () => {
    for (const t of document.querySelectorAll('#recruits table, #results table, #milestones table, #check table, #company-card table')) makeSortable(t);
  });

  // ---------- data as of ----------
  dash.draw('mb-asof', (p) => {
    const b = all();
    p.textContent = b ? `Data up to ${dayName(b.latest)}, the latest event or drill on record.` : '';
  });

  // ---------- company pages ----------
  const coRows = document.querySelector('.mb-company-rows');
  if (coRows) {
    const open = (ev) => {
      const tr = ev.target.closest('tr[data-key]');
      if (!tr) return;
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.type === 'keydown') ev.preventDefault();
      dash.setParams({ co: decodeURIComponent(tr.dataset.key.split(',').pop()) });
      requestAnimationFrame(() => document.getElementById('company-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    };
    coRows.addEventListener('click', open);
    coRows.addEventListener('keydown', open);
    new MutationObserver(() => {
      for (const tr of coRows.rows) if (!tr.classList.contains('la-click')) { tr.classList.add('la-click'); tr.tabIndex = 0; tr.setAttribute('aria-selected', String(decodeURIComponent(tr.dataset.key.split(',').pop()) === P().co)); }
    }).observe(coRows, { childList: true });
  }
  for (const b of document.querySelectorAll('.mb-close-company')) b.addEventListener('click', () => dash.setParams({ co: null }));
  for (const b of document.querySelectorAll('.mb-copy-company')) {
    b.addEventListener('click', async () => {
      const url = location.origin + location.pathname + '#companies&co=' + encodeURIComponent(P().co || '');
      try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; } catch { prompt('Copy this link', url); }
      setTimeout(() => { b.textContent = 'Copy link'; }, 2000);
    });
  }
  dash.onData(() => { for (const c of document.querySelectorAll('#company-card')) c.hidden = !P().co; });

  function companyMembers(co) {
    const b = all();
    const rs = rows('attendance');
    if (!b || !rs) return null;
    const inP = rs.filter((r) => L.inPeriod(r.date));
    const counts = d3.rollup(inP, (v) => ({ events: v.filter((r) => r.kind === 'event').length, drills: v.filter((r) => r.kind === 'drill').length }), (r) => r.name);
    const out = [];
    for (const g of b.people.values()) {
      if (g.company !== co) continue;
      const since = daysBetween(g.last, b.latest);
      const c = counts.get(g.name);
      if (!c && since > 90) continue;
      out.push({ name: g.name, status: since <= 30 ? 'Active' : since <= 90 ? 'Quiet' : 'Inactive', events: c?.events ?? 0, drills: c?.drills ?? 0, last: g.last, since });
    }
    return out.sort((a, z) => a.since > 30 === z.since > 30 ? z.events + z.drills - (a.events + a.drills) || a.name.localeCompare(z.name) : a.since - z.since);
  }
  dash.draw('co-name', (h) => { h.textContent = P().co || '—'; });
  dash.draw('co-tiles', (box) => {
    const co = P().co;
    const b = all();
    const rs = rows('attendance');
    if (!co || !b || !rs) { tiles(box, []); return; }
    const inP = rs.filter((r) => L.inPeriod(r.date) && (P().day === 'all' || dayOf(r.date) === P().day));
    const avg = (k) => {
      const posts = new Set(inP.filter((r) => r.kind === k).map((r) => r.post)).size;
      return posts ? one(inP.filter((r) => r.kind === k && r.company === co).length / posts) : '—';
    };
    const mem = companyMembers(co) ?? [];
    const joined = [...b.people.values()].filter((g) => {
      const j = g.rows[0].company === 'Recruits' && g.rows.find((r) => r.company !== 'Recruits');
      return j && j.company === co && L.inPeriod(j.date);
    }).length;
    tiles(box, [
      ['Active members', fmt(mem.filter((m) => m.status === 'Active').length), 'Seen in the last 30 days'],
      ['Average at events', avg('event'), 'In the period picked'],
      ['Average at drills', avg('drill'), 'In the period picked'],
      ['Different people', fmt(new Set(inP.filter((r) => r.company === co).map((r) => r.name)).size), 'Attended in the period'],
      ...(co === 'Recruits' ? [] : [['Recruits who joined', fmt(joined), 'In the period picked']]),
    ]);
  });
  dash.draw('co-legend', (box) => legend(box, shownKinds().map((k) => [kindName[k], kindColor(k)])));
  dash.draw('co-chart', (box) => {
    const co = P().co;
    if (!chartState(box, 'company_monthly') || !co) return;
    const r = rows('company_monthly').filter((x) => x.company === co && onDay(x) && inYear(x.month));
    const months = monthRange(r);
    if (!months.length) return;
    lineChart(box, months, shownKinds().map((k) => ({ name: kindName[k], color: kindColor(k), values: new Map(r.filter((x) => x.kind === k).map((x) => [x.month, x.avg])) })), { height: 200, unit: ' average' });
  });
  dash.draw('co-rows', (tb) => {
    tb.replaceChildren();
    const co = P().co;
    const r = co ? companyMembers(co) : null;
    if (!r) return;
    if (!r.length) return emptyRow(tb, 6, 'Nobody to show for this period.');
    for (const x of r) {
      const tr = document.createElement('tr');
      nameButton(tr, x.name); pill(tr, x.status, x.status === 'Active' ? 'ok' : x.status === 'Quiet' ? 'warn' : 'bad');
      td(tr, fmt(x.events), 'la-n'); td(tr, fmt(x.drills), 'la-n'); td(tr, dayName(x.last)); td(tr, fmt(x.since), 'la-n');
      tb.append(tr);
    }
  });

  // ---------- compare ----------
  const cmp = {
    mode: document.getElementById('cmp-mode'), a: document.getElementById('cmp-a'), b: document.getElementById('cmp-b'),
    people: document.getElementById('cmp-people'), periods: document.getElementById('cmp-periods'),
    p1f: document.getElementById('cmp-p1f'), p1t: document.getElementById('cmp-p1t'), p2f: document.getElementById('cmp-p2f'), p2t: document.getElementById('cmp-p2t'),
  };
  const cmpMode = () => (P().cmp === 'periods' ? 'periods' : 'people');
  function quickPeriods(kind) {
    const b = all();
    if (!b) return;
    const end = b.latest;
    const back = (d, months) => iso(d3.utcMonth.offset(new Date(d + 'T00:00:00Z'), -months));
    if (kind === '3m') { const s2 = addDays(back(end, 3), 1); dash.setParams({ p2f: s2, p2t: end, p1f: addDays(back(s2, 3), 0), p1t: addDays(s2, -1) }); }
    if (kind === '3my') { const s2 = addDays(back(end, 3), 1); dash.setParams({ p2f: s2, p2t: end, p1f: back(s2, 12), p1t: back(end, 12) }); }
    if (kind === 'y') { const y = end.slice(0, 4); dash.setParams({ p2f: y + '-01-01', p2t: end, p1f: (y - 1) + '-01-01', p1t: (y - 1) + end.slice(4) }); }
  }
  if (cmp.mode) {
    for (const btn of cmp.mode.querySelectorAll('[data-mode]')) {
      btn.addEventListener('click', () => {
        dash.setParams({ cmp: btn.dataset.mode === 'periods' ? 'periods' : null });
        if (btn.dataset.mode === 'periods' && !P().p1f) quickPeriods('3my');
      });
    }
    for (const [k, input] of [['ca', cmp.a], ['cb', cmp.b]]) {
      const go = () => {
        const n = matchName(input.value);
        input.classList.toggle('mb-nomatch', !n && input.value.trim() !== '');
        if (n) { input.value = n; dash.setParams({ [k]: n }); } else if (!input.value.trim()) dash.setParams({ [k]: null });
      };
      input.addEventListener('change', go);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
    }
    for (const k of ['p1f', 'p1t', 'p2f', 'p2t']) {
      cmp[k].addEventListener('change', () => { if (!cmp[k].value || cmp[k].validity.valid) dash.setParams({ [k]: cmp[k].value || null }); });
    }
    for (const q of cmp.periods.querySelectorAll('[data-quick]')) q.addEventListener('click', () => quickPeriods(q.dataset.quick));
  }
  dash.onData(() => {
    if (!cmp.mode) return;
    const p = P();
    const mode = cmpMode();
    for (const btn of cmp.mode.querySelectorAll('[data-mode]')) btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    cmp.people.hidden = mode !== 'people';
    cmp.periods.hidden = mode !== 'periods';
    if (document.activeElement !== cmp.a) cmp.a.value = p.ca || '';
    if (document.activeElement !== cmp.b) cmp.b.value = p.cb || '';
    for (const k of ['p1f', 'p1t', 'p2f', 'p2t']) if (document.activeElement !== cmp[k]) cmp[k].value = p[k] || '';
    if (mode === 'periods' && !p.p1f && all()) quickPeriods('3my');
  });

  function periodStats(b, from, to) {
    const rs = b.data.filter((r) => r.date >= from && r.date <= to);
    const posts = b.posts.filter((x) => x.date >= from && x.date <= to);
    const held = (k) => posts.filter((x) => x.kind === k).length;
    const avg = (k) => (held(k) ? rs.filter((r) => r.kind === k).length / held(k) : null);
    const names = new Set(rs.map((r) => r.name));
    const fresh = [...names].filter((n) => b.people.get(n).first >= from).length;
    const joined = [...b.people.values()].filter((g) => { const j = g.rows[0].company === 'Recruits' && g.rows.find((r) => r.company !== 'Recruits'); return j && j.date >= from && j.date <= to; }).length;
    let w = 0, l = 0;
    for (const x of posts) {
      const m = x.kind === 'event' && x.score ? String(x.score).match(/^\s*(\d+)\s*[-–:]\s*(\d+)/) : null;
      if (m) { if (+m[1] > +m[2]) w += 1; else if (+m[1] < +m[2]) l += 1; }
    }
    const byDay = new Map();
    for (const d of DAYS) {
      const ps = posts.filter((x) => dayOf(x.date) === d);
      if (ps.length) byDay.set(d, Math.round(d3.mean(ps, (x) => x.n) * 10) / 10);
    }
    return { events: held('event'), drills: held('drill'), avgE: avg('event'), avgD: avg('drill'), people: names.size, fresh, joined, winRate: w + l ? w / (w + l) : null, byDay };
  }
  function personStats(b, name) {
    const g = b.people.get(name);
    if (!g) return null;
    const st = L.weekStreaks(g, b.latest);
    const fav = d3.greatest(d3.rollup(g.rows, (v) => v.length, (r) => dayOf(r.date)), ([, n]) => n);
    const ms = b.milestones.filter((m) => m.name === name);
    const msText = (k) => { const m = ms.find((x) => x.kind === k); return m ? `${fmt(m.count)} (${dayName(m.date)})` : 'None yet'; };
    return { g, rows: [
      ['Company', g.company, g.company],
      ['Events attended', fmt(g.events), g.events],
      ['Drills attended', fmt(g.drills), g.drills],
      ['Event rate', g.eventRate == null ? '—' : pct(g.eventRate), g.eventRate],
      ['Drill rate', g.drillRate == null ? '—' : pct(g.drillRate), g.drillRate],
      ['First seen', dayName(g.first), null],
      ['Last seen', dayName(g.last), null],
      ['Weeks in a row now', fmt(st.current), st.current],
      ['Longest run of weeks', fmt(st.longest), st.longest],
      ['Most often on', fav ? fav[0] + 's' : '—', null],
      ['Latest event milestone', msText('event'), null],
      ['Latest drill milestone', msText('drill'), null],
    ] };
  }
  function compareData() {
    const b = all();
    if (!b) return null;
    const p = P();
    if (cmpMode() === 'people') {
      const A = p.ca && personStats(b, p.ca), B = p.cb && personStats(b, p.cb);
      if (!A || !B) return { b, empty: 'Pick two members above to compare them.' };
      const postsA = new Set(A.g.rows.map((r) => r.post));
      const together = B.g.rows.filter((r) => postsA.has(r.post)).length;
      return { b, mode: 'people', A, B, together };
    }
    if (!p.p1f || !p.p1t || !p.p2f || !p.p2t) return { b, empty: 'Pick both periods above.' };
    return { b, mode: 'periods', A: periodStats(b, p.p1f, p.p1t), B: periodStats(b, p.p2f, p.p2t) };
  }
  const shortRange = (f, t) => `${dayName(f)} to ${dayName(t)}`;
  dash.draw('cmp-title', (h) => {
    const c = compareData();
    const p = P();
    h.textContent = !c || c.empty ? 'Comparison' : c.mode === 'people' ? `${p.ca} and ${p.cb}` : 'Two periods';
  });
  dash.draw('cmp-note', (n) => {
    const c = compareData();
    const p = P();
    if (!c) { n.textContent = ''; return; }
    if (c.empty) { n.textContent = c.empty; return; }
    n.textContent = c.mode === 'people'
      ? `They were at ${plural(c.together, 'event or drill', 'events and drills')} together. All figures use their whole history.`
      : `First period: ${shortRange(p.p1f, p.p1t)}. Second period: ${shortRange(p.p2f, p.p2t)}.`;
  });
  dash.draw('cmp-head', (tr) => {
    tr.replaceChildren();
    const c = compareData();
    const p = P();
    if (!c || c.empty) return;
    const cols = c.mode === 'people' ? ['', p.ca, p.cb] : ['', 'First period', 'Second period', 'Change'];
    cols.forEach((t, i) => { const th = el('th', i ? 'la-n' : null, t); tr.append(th); });
  });
  dash.draw('cmp-rows', (tb) => {
    tb.replaceChildren();
    const c = compareData();
    if (!c || c.empty) return;
    if (c.mode === 'people') {
      c.A.rows.forEach(([label, va, na], i) => {
        const [, vb, nb] = c.B.rows[i];
        const tr = el('tr');
        td(tr, label);
        const ca = td(tr, va, 'la-n'), cb = td(tr, vb, 'la-n');
        if (typeof na === 'number' && typeof nb === 'number' && na !== nb) (na > nb ? ca : cb).classList.add('mb-better');
        tb.append(tr);
      });
      return;
    }
    const { A, B } = c;
    const lines = [
      ['Events held', A.events, B.events, fmt],
      ['Drills held', A.drills, B.drills, fmt],
      ['Average event attendance', A.avgE, B.avgE, one],
      ['Average drill attendance', A.avgD, B.avgD, one],
      ['Different people', A.people, B.people, fmt],
      ['First-timers', A.fresh, B.fresh, fmt],
      ['Recruits who joined a company', A.joined, B.joined, fmt],
      ['Event win rate', A.winRate, B.winRate, pct],
    ];
    for (const [label, a, b2, f] of lines) {
      const tr = el('tr');
      td(tr, label); td(tr, a == null ? '—' : f(a), 'la-n'); td(tr, b2 == null ? '—' : f(b2), 'la-n');
      let ch = '—';
      if (a != null && b2 != null) {
        const d = b2 - a;
        ch = f === pct ? `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d * 100))} points` : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${f(Math.abs(Math.round(d * 10) / 10))}`;
      }
      const cell = td(tr, ch, 'la-n');
      if (a != null && b2 != null && b2 !== a) cell.classList.add(b2 > a ? 'mb-up' : 'mb-down');
      tb.append(tr);
    }
  });
  const cmpColors = () => [dash.colors[0], dash.colors[1]];
  dash.draw('cmp-chart-title', (h) => {
    const c = compareData();
    h.textContent = !c || c.empty ? '' : c.mode === 'people' ? 'Events and drills attended each month' : 'Average attendance by day of the week';
  });
  dash.draw('cmp-legend', (box) => {
    const c = compareData();
    const p = P();
    if (!c || c.empty) { box.replaceChildren(); return; }
    const names = c.mode === 'people' ? [p.ca, p.cb] : ['First period', 'Second period'];
    legend(box, names.map((n, i) => [n, cmpColors()[i]]));
  });
  dash.draw('cmp-chart', (box) => {
    box.replaceChildren();
    const c = compareData();
    box.classList.toggle('dash-skeleton', !c);
    if (!c || c.empty) return;
    const p = P();
    if (c.mode === 'people') {
      const per = (g) => d3.rollup(g.rows, (v) => v.length, (r) => r.date.slice(0, 7));
      const ma = per(c.A.g), mb = per(c.B.g);
      const ms = [...ma.keys(), ...mb.keys()];
      lineChart(box, monthsBetween(d3.min(ms), d3.max(ms)), [
        { name: p.ca, color: cmpColors()[0], values: ma },
        { name: p.cb, color: cmpColors()[1], values: mb },
      ], { height: 200, valueFmt: fmt, unit: ' attended' });
      return;
    }
    const days = DAYS.filter((d) => c.A.byDay.has(d) || c.B.byDay.has(d));
    if (!days.length) return;
    barChart(box, days, [
      { name: 'First period', color: cmpColors()[0], values: c.A.byDay },
      { name: 'Second period', color: cmpColors()[1], values: c.B.byDay },
    ], { height: 200, decimals: true, valueFmt: one, unit: ' average', catLabel: (d, bw) => (bw < 34 ? d.slice(0, 2) : d.slice(0, 3)), tipTitle: (d) => d + 's', csvLabel: 'Day' });
  });

  // ---------- top controls on the new tab ----------
  const prevShowTab = window.showTab;
  window.showTab = function (name, link) {
    prevShowTab(name, link);
    for (const fl of document.querySelectorAll('.la-filters')) if (name === 'compare') fl.hidden = true;
  };

  // ---------- links remember the view; Back moves between tabs ----------
  const KEYS = ['period', 'from', 'to', 'day', 'kind', 'grain', 'person', 'co', 'cmp', 'ca', 'cb', 'p1f', 'p1t', 'p2f', 'p2t'];
  const ONLY_ON = { person: 'people', co: 'companies', cmp: 'compare', ca: 'compare', cb: 'compare', p1f: 'compare', p1t: 'compare', p2f: 'compare', p2t: 'compare' };
  dash.setLink = () => {}; // the page's own tab links are replaced by the fuller ones below
  function wantHash() {
    const p = dash.params();
    const tab = currentTab();
    const q = new URLSearchParams();
    for (const k of KEYS) {
      const v = p[k];
      if (v == null || v === '' || v === 'all') continue;
      if ((k === 'from' || k === 'to') && p.period !== 'custom') continue;
      if (k === 'grain' && v === 'month') continue;
      if (ONLY_ON[k] && ONLY_ON[k] !== tab) continue;
      if (k.startsWith('p') && k.length === 3 && p.cmp !== 'periods') continue;
      if ((k === 'ca' || k === 'cb') && p.cmp === 'periods') continue;
      q.set(k, v);
    }
    const s = q.toString();
    return '#' + tab + (s ? '&' + s : '');
  }
  let lastTab = null;
  let applying = false;
  function syncHash() {
    if (applying) return;
    const tab = currentTab();
    if (/^#chart=/.test(location.hash) && tab === 'builder') { lastTab = tab; return; }
    const want = wantHash();
    if (location.hash === want) { lastTab = tab; return; }
    if (lastTab && lastTab !== tab) history.pushState(null, '', want);
    else history.replaceState(null, '', want);
    lastTab = tab;
  }
  dash.onData(() => requestAnimationFrame(syncHash));

  function presetRange(v) {
    const n = new Date();
    const t = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    const back = { '7d': d3.utcDay.offset(t, -7), '1m': d3.utcMonth.offset(t, -1), '3m': d3.utcMonth.offset(t, -3), '6m': d3.utcMonth.offset(t, -6), '1y': d3.utcYear.offset(t, -1), ytd: d3.utcYear.floor(t) }[v];
    return back ? [iso(back), iso(t)] : null;
  }
  function applyHash() {
    const h = location.hash.slice(1);
    if (!h || h.startsWith('chart=') || h.startsWith('person=')) return false;
    const [tab, rest] = [h.split('&')[0], h.split('&').slice(1).join('&')];
    if (!tabs.includes(tab)) return false;
    const q = new URLSearchParams(rest);
    const next = {};
    for (const k of KEYS) next[k] = q.get(k);
    next.day = next.day || 'all';
    next.kind = next.kind || 'all';
    const per = next.period || 'all';
    if (per === 'all') Object.assign(next, { period: 'all', year: 'all', from: null, to: null });
    else if (per.startsWith('y:')) Object.assign(next, { year: per.slice(2), from: null, to: null });
    else if (per === 'custom') next.year = 'all';
    else { const r = presetRange(per); if (r) Object.assign(next, { year: 'all', from: r[0], to: r[1] }); else Object.assign(next, { period: 'all', year: 'all', from: null, to: null }); }
    applying = true;
    lastTab = tab;
    if (currentTab() !== tab) showTab(tab, false);
    dash.setParams(next);
    requestAnimationFrame(() => { applying = false; });
    return true;
  }
  window.addEventListener('popstate', applyHash);
  document.addEventListener('DOMContentLoaded', () => {
    applyHash();
    if (currentTab() === 'compare') for (const fl of document.querySelectorAll('.la-filters')) fl.hidden = true;
  });
})();
