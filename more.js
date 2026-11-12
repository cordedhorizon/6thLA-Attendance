// Site-only: who was at an event, sortable tables, "data as of", links that remember the view,
// company pages and compare. Runs after members.js and uses its helpers (window.LA).
(function () {
  const L = window.LA;
  const { all, withRank, rankOf, coButton, td, pill, emptyRow, tiles, legend, nameButton, openPerson, matchName, plural, addDays, daysBetween, dayOf, iso } = L;
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
    const sub = el('p', 'mb-note', rs[0].anon ? `${plural(rs.length, 'person', 'people')} attended. Only a headcount was posted for this drill, so no names are listed.` : [plural(rs.length, 'person', 'people') + ' attended', result].filter(Boolean).join('. ') + '. Click a name to open their card.');
    const body = el('div', 'mb-roster');
    const groups = d3.group(rs.filter((r) => !r.anon), (r) => r.company);
    for (const c of [...groups.keys()].sort((a, z) => companyRank(a) - companyRank(z) || a.localeCompare(z))) {
      const sec = el('section');
      const names = groups.get(c).map((r) => r.name).sort((a, z) => a.localeCompare(z));
      const h4 = el('h4');
      h4.append(coButton(c), ` (${names.length})`);
      sec.append(h4);
      const ul = el('ul');
      for (const n of names) {
        const li = el('li');
        const btn = el('button', 'mb-name', withRank(n));
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
    if (cell.dataset.v != null && cell.dataset.v !== '') return +cell.dataset.v;
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
    for (const t of document.querySelectorAll('#recruits table:not(.mb-retention), #results table, #milestones table, #promotions table, #check table, #company-card table, #awards table')) makeSortable(t);
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
    if (!r.length) return emptyRow(tb, 7, 'Nobody to show for this period.');
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
    g1: document.getElementById('cmp-g1'), g2: document.getElementById('cmp-g2'),
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
    if (kind === 'same') { const p = P(); if (p.p1f && p.p1t) dash.setParams({ p2f: p.p1f, p2t: p.p1t }); }
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
    for (const [k, sel] of [['g1', cmp.g1], ['g2', cmp.g2]]) sel.addEventListener('change', () => dash.setParams({ [k]: sel.value || null }));
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
    const b = all();
    if (b && !cmp.g1.options.length) {
      for (const sel of [cmp.g1, cmp.g2]) {
        const bn = document.createElement('optgroup'); bn.label = 'Battalions';
        bn.append(...L.BATTALIONS.map((x) => new Option(L.battalionLabel(x), x)));
        const co = document.createElement('optgroup'); co.label = 'Companies';
        co.append(...companiesIn(b.data).map((c) => new Option(c, c)));
        sel.replaceChildren(new Option('Whole regiment', ''), bn, co);
      }
    }
    cmp.g1.value = p.g1 || '';
    cmp.g2.value = p.g2 || '';
    if (mode === 'periods' && !p.p1f && b) quickPeriods('3my');
  });
  const groupName = (g) => g || 'Whole regiment';

  function periodStats(b, from, to, group) {
    const rs = b.data.filter((r) => r.date >= from && r.date <= to && L.inGroup(r.company, group));
    const posts = b.posts.filter((x) => x.date >= from && x.date <= to);
    const held = (k) => posts.filter((x) => x.kind === k).length;
    const avg = (k) => (held(k) ? rs.filter((r) => r.kind === k).length / held(k) : null);
    const names = new Set(rs.filter((r) => !r.anon).map((r) => r.name));
    const fresh = [...names].filter((n) => b.people.get(n).first >= from).length;
    const joined = [...b.people.values()].filter((g) => { const j = g.rows[0].company === 'Recruits' && g.rows.find((r) => r.company !== 'Recruits'); return j && j.date >= from && j.date <= to && L.inGroup(j.company, group); }).length;
    let w = 0, l = 0;
    for (const x of posts) {
      const m = x.kind === 'event' && x.score ? String(x.score).match(/^\s*(\d+)\s*[-–:]\s*(\d+)/) : null;
      if (m) { if (+m[1] > +m[2]) w += 1; else if (+m[1] < +m[2]) l += 1; }
    }
    const byDay = new Map();
    for (const d of DAYS) {
      const ps = new Set(posts.filter((x) => dayOf(x.date) === d).map((x) => x.post));
      if (ps.size) byDay.set(d, Math.round(rs.filter((r) => ps.has(r.post)).length / ps.size * 10) / 10);
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
      ['Rank', g.rank ?? '—', null],
      ['Company', g.company, null, true],
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
    return { b, mode: 'periods', A: periodStats(b, p.p1f, p.p1t, p.g1), B: periodStats(b, p.p2f, p.p2t, p.g2) };
  }
  const shortRange = (f, t) => `${dayName(f)} to ${dayName(t)}`;
  dash.draw('cmp-title', (h) => {
    const c = compareData();
    const p = P();
    h.textContent = !c || c.empty ? 'Comparison' : c.mode === 'people' ? `${withRank(p.ca)} and ${withRank(p.cb)}`
      : (p.g1 || '') === (p.g2 || '') ? `${groupName(p.g1)}: two periods` : `${groupName(p.g1)} and ${groupName(p.g2)}`;
  });
  dash.draw('cmp-note', (n) => {
    const c = compareData();
    const p = P();
    if (!c) { n.textContent = ''; return; }
    if (c.empty) { n.textContent = c.empty; return; }
    n.textContent = c.mode === 'people'
      ? `They were at ${plural(c.together, 'event or drill', 'events and drills')} together. All figures use their whole history.`
      : `First: ${groupName(p.g1)}, ${shortRange(p.p1f, p.p1t)}. Second: ${groupName(p.g2)}, ${shortRange(p.p2f, p.p2t)}. Averages count only the people listed under that company; events and drills held and the win rate are the regiment's.`;
  });
  dash.draw('cmp-head', (tr) => {
    tr.replaceChildren();
    const c = compareData();
    const p = P();
    if (!c || c.empty) return;
    const cols = c.mode === 'people' ? [['', ''], [withRank(p.ca), ''], [withRank(p.cb), '']]
      : [['', ''], [groupName(p.g1), shortRange(p.p1f, p.p1t)], [groupName(p.g2), shortRange(p.p2f, p.p2t)], ['Change', '']];
    cols.forEach(([t, sub], i) => {
      const th = el('th', i ? 'la-n' : null, t);
      if (sub) th.append(el('span', 'mb-th-sub', sub));
      tr.append(th);
    });
  });
  dash.draw('cmp-rows', (tb) => {
    tb.replaceChildren();
    const c = compareData();
    if (!c || c.empty) return;
    if (c.mode === 'people') {
      c.A.rows.forEach(([label, va, na, isCo], i) => {
        const [, vb, nb] = c.B.rows[i];
        const tr = el('tr');
        td(tr, label);
        const ca = td(tr, isCo ? '' : va, 'la-n'), cb = td(tr, isCo ? '' : vb, 'la-n');
        if (isCo) { ca.append(coButton(va)); cb.append(coButton(vb)); }
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
      ['Recruits who joined', A.joined, B.joined, fmt],
      ["Regiment's event win rate", A.winRate, B.winRate, pct],
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
  const sides = (p) => [`${groupName(p.g1)}, ${shortRange(p.p1f, p.p1t)}`, `${groupName(p.g2)}, ${shortRange(p.p2f, p.p2t)}`];
  dash.draw('cmp-chart-title', (h) => {
    const c = compareData();
    h.textContent = !c || c.empty ? '' : c.mode === 'people' ? 'Events and drills attended each month' : 'Average attendance by day of the week';
  });
  dash.draw('cmp-legend', (box) => {
    const c = compareData();
    const p = P();
    if (!c || c.empty) { box.replaceChildren(); return; }
    const names = c.mode === 'people' ? [withRank(p.ca), withRank(p.cb)] : sides(p);
    legend(box, names.map((n, i) => [n, cmpColors()[i]]));
  });
  dash.draw('cmp-chart', (box) => {
    box.replaceChildren();
    const c = compareData();
    box.classList.toggle('dash-skeleton', !c);
    box.closest('.la-card')?.classList.toggle('mb-is-empty', !!c?.empty);
    if (!c || c.empty) return;
    const p = P();
    if (c.mode === 'people') {
      const per = (g) => d3.rollup(g.rows, (v) => v.length, (r) => r.date.slice(0, 7));
      const ma = per(c.A.g), mb = per(c.B.g);
      const ms = [...ma.keys(), ...mb.keys()];
      lineChart(box, monthsBetween(d3.min(ms), d3.max(ms)), [
        { name: withRank(p.ca), color: cmpColors()[0], values: ma },
        { name: withRank(p.cb), color: cmpColors()[1], values: mb },
      ], { height: 200, valueFmt: fmt, unit: ' attended' });
      return;
    }
    const days = DAYS.filter((d) => c.A.byDay.has(d) || c.B.byDay.has(d));
    if (!days.length) return;
    barChart(box, days, [
      { name: sides(p)[0], color: cmpColors()[0], values: c.A.byDay },
      { name: sides(p)[1], color: cmpColors()[1], values: c.B.byDay },
    ], { height: 200, decimals: true, valueFmt: one, unit: ' average', catLabel: (d, bw) => (bw < 34 ? d.slice(0, 2) : d.slice(0, 3)), tipTitle: (d) => d + 's', csvLabel: 'Day' });
  });

  // ---------- company names on the page's own tables and cards open the company page ----------
  function linkCompanies() {
    for (const tr of document.querySelectorAll('[data-draw="people-rows"] tr')) {
      const c = tr.cells[2];
      if (c && !c.querySelector('[data-co]') && c.textContent.trim() && c.textContent.trim() !== '—') { const co = c.textContent.trim(); c.replaceChildren(coButton(co)); }
    }
    for (const dd of document.querySelectorAll('[data-draw="p-stat"][data-f="company"]')) {
      const co = dd.textContent.trim();
      if (co && co !== '—' && !dd.querySelector('[data-co]')) dd.replaceChildren(coButton(co));
    }
    for (const h of document.querySelectorAll('.la-mini h4')) {
      const co = h.textContent.trim();
      if (co && !h.querySelector('[data-co]') && h.closest('#companies')) h.replaceChildren(coButton(co));
    }
  }
  dash.onData(() => requestAnimationFrame(linkCompanies));
  for (const tb of document.querySelectorAll('[data-draw="people-rows"]')) new MutationObserver(linkCompanies).observe(tb, { childList: true });

  // ---------- promotions and time in rank ----------
  // An earliest rank that isn't a recruit started before our records, or before we first saw them.
  const unsureStart = (g, i) => i === 0 && !/^rct/i.test(g.ranks[0].rank);
  function promotions() {
    const b = all();
    if (!b) return null;
    const out = [];
    for (const g of b.people.values()) {
      for (let i = 1; i < g.ranks.length; i += 1) {
        const prev = g.ranks[i - 1], cur = g.ranks[i];
        const company = g.rows.find((r) => r.date >= cur.date)?.company ?? g.company;
        const attended = g.rows.filter((r) => r.date >= prev.date && r.date < cur.date).length;
        out.push({ date: cur.date, name: g.name, to: cur.rank, from: prev.rank, company, days: daysBetween(prev.date, cur.date), atLeast: unsureStart(g, i - 1), attended, recruit: /^rct/i.test(prev.rank) });
      }
    }
    return out.sort((a, z) => z.date.localeCompare(a.date) || a.name.localeCompare(z.name));
  }
  const atLeast = (n, sure) => (sure ? fmt(n) : `at least ${fmt(n)}`);
  function numCell(tr, n, sure) { const c = td(tr, atLeast(n, sure), 'la-n'); c.dataset.v = n; return c; }
  dash.draw('pr-tiles', (box) => {
    const all_ = promotions();
    const r = (all_ ?? []).filter((x) => L.inPeriod(x.date) && !x.recruit);
    const sure = r.filter((x) => !x.atLeast).map((x) => x.days);
    const pairs = d3.rollups(r, (v) => v.length, (x) => `${x.from} to ${x.to}`).sort((a, z) => z[1] - a[1]);
    tiles(box, [
      ['Promotions', fmt(r.length), 'In the period picked, not counting recruits joining'],
      ['People promoted', fmt(new Set(r.map((x) => x.name)).size), ''],
      ['Typical time between ranks', sure.length ? `${fmt(Math.round(d3.median(sure)))} days` : '—', 'Median, where both dates are on record'],
      ['Most common', pairs.length ? pairs[0][0] : '—', pairs.length ? plural(pairs[0][1], 'time', 'times') : ''],
    ]);
  });
  dash.draw('pr-rows', (tb) => {
    tb.replaceChildren();
    const r = promotions();
    if (!r) return;
    const list = r.filter((x) => L.inPeriod(x.date));
    if (!list.length) return emptyRow(tb, 8, 'No rank changes in this period.');
    for (const x of list) {
      const tr = el('tr');
      td(tr, dayName(x.date)); nameButton(tr, x.name);
      const c1 = td(tr, x.to); c1.dataset.v = L.rankOrder(x.to);
      const c2 = td(tr, x.from); c2.dataset.v = L.rankOrder(x.from);
      L.coCell(tr, x.company); numCell(tr, x.days, !x.atLeast); numCell(tr, x.attended, !x.atLeast);
      tb.append(tr);
    }
  });
  const trRank = document.getElementById('tr-rank');
  trRank?.addEventListener('change', () => dash.draw('tr-rows'));
  dash.draw('tr-rows', (tb) => {
    tb.replaceChildren();
    const b = all();
    if (!b) return;
    const since60 = addDays(b.latest, -60);
    const list = [];
    for (const g of b.people.values()) {
      if (g.last < since60 || !g.ranks.length) continue;
      const i = g.ranks.length - 1, cur = g.ranks[i];
      const after = g.rows.filter((r) => r.date >= cur.date);
      list.push({ name: g.name, rank: cur.rank, company: g.company, since: cur.date, days: daysBetween(cur.date, b.latest), sure: !unsureStart(g, i), events: after.filter((r) => r.kind === 'event').length, drills: after.filter((r) => r.kind === 'drill').length });
    }
    if (trRank) {
      const want = trRank.value;
      const ranks = [...new Set(list.map((x) => x.rank))].sort((a, z) => L.rankOrder(z) - L.rankOrder(a));
      if (trRank.options.length !== ranks.length + 1) { trRank.replaceChildren(new Option('All ranks', ''), ...ranks.map((k) => new Option(k, k))); trRank.value = want; }
    }
    const shown = list.filter((x) => !trRank?.value || x.rank === trRank.value).sort((a, z) => z.events + z.drills - (a.events + a.drills) || a.name.localeCompare(z.name));
    if (!shown.length) return emptyRow(tb, 7, 'Nobody at this rank seen in the last 60 days.');
    for (const x of shown) {
      const tr = el('tr');
      nameButton(tr, x.name); L.coCell(tr, x.company);
      td(tr, x.sure ? dayName(x.since) : `${dayName(x.since)} or earlier`);
      numCell(tr, x.days, x.sure); numCell(tr, x.events, x.sure); numCell(tr, x.drills, x.sure);
      tb.append(tr);
    }
  });

  // ---------- retention: do new people keep coming? ----------
  const rt = { from: document.getElementById('rt-from'), to: document.getElementById('rt-to'), group: document.getElementById('rt-group'), points: document.getElementById('rt-points') };
  let rtState = { from: '', to: '', group: 'month', points: [30, 90, 180], ...L.load('la-retention', {}) };
  const parsePoints = (s) => [...new Set(String(s).split(/[^0-9]+/).map(Number).filter((n) => n >= 7 && n <= 1095))].sort((a, z) => a - z).slice(0, 6);
  function writeRt() {
    if (!rt.from) return;
    rt.from.value = rtState.from; rt.to.value = rtState.to; rt.group.value = rtState.group; rt.points.value = rtState.points.join(', ');
  }
  function saveRt() { L.save('la-retention', rtState); for (const n of ['rt-legend', 'rt-chart', 'rt-head', 'rt-rows']) dash.draw(n); }
  if (rt.from) {
    for (const k of ['from', 'to']) rt[k].addEventListener('change', () => { if (rt[k].value && !rt[k].validity.valid) return; rtState[k] = rt[k].value; saveRt(); });
    rt.group.addEventListener('change', () => { rtState.group = rt.group.value; saveRt(); });
    rt.points.addEventListener('change', () => { const p = parsePoints(rt.points.value); if (p.length) rtState.points = p; writeRt(); saveRt(); });
    writeRt();
  }
  const cohortKey = (d) => (rtState.group === 'year' ? d.slice(0, 4) : rtState.group === 'quarter' ? `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}` : d.slice(0, 7));
  const cohortLabel = (k) => (rtState.group === 'month' ? monthName(monthParse(k)) : k.replace('-', ' '));
  function retention() {
    const b = all();
    if (!b) return null;
    const start = b.data[0].date;
    const groups = new Map();
    for (const g of b.people.values()) {
      if (daysBetween(start, g.first) <= 30) continue;
      if (rtState.from && g.first < rtState.from) continue;
      if (rtState.to && g.first > rtState.to) continue;
      const k = cohortKey(g.first);
      if (!groups.has(k)) groups.set(k, { key: k, n: 0, hit: rtState.points.map(() => 0), known: rtState.points.map(() => 0) });
      const c = groups.get(k);
      c.n += 1;
      rtState.points.forEach((N, i) => {
        const lo = addDays(g.first, N - 29), hi = addDays(g.first, N);
        if (hi > b.latest) return;
        c.known[i] += 1;
        if (g.rows.some((r) => r.date >= lo && r.date <= hi)) c.hit[i] += 1;
      });
    }
    return [...groups.values()].sort((a, z) => a.key.localeCompare(z.key));
  }
  const rtColors = () => rtState.points.map((_, i) => dash.colors[i % dash.colors.length]);
  dash.draw('rt-legend', (box) => legend(box, rtState.points.map((N, i) => [`After ${N} days`, rtColors()[i]])));
  dash.draw('rt-chart', (box) => {
    box.replaceChildren();
    const r = retention();
    box.classList.toggle('dash-skeleton', !r);
    if (!r || !r.length) return;
    const keys = r.map((c) => c.key);
    const series = rtState.points.map((N, i) => ({ name: `After ${N} days`, color: rtColors()[i], values: new Map(r.filter((c) => c.known[i]).map((c) => [c.key, Math.round(c.hit[i] / c.known[i] * 100)])) }));
    lineChart(box, keys, series, {
      height: 200, yMax: 100, valueFmt: (v) => v + '%', dots: true, connect: true,
      ...(rtState.group === 'month' ? {} : { catLabel: (k) => k.replace('-', ' '), tipTitle: cohortLabel }),
      csvLabel: 'First attended',
      extra: (k) => { const c = r.find((x) => x.key === k); return c ? [{ text: plural(c.n, 'new person', 'new people') }] : []; },
    });
  });
  dash.draw('rt-head', (tr) => {
    tr.replaceChildren(el('th', null, 'First attended'), el('th', 'la-n', 'New people'), ...rtState.points.map((N) => el('th', 'la-n', `After ${N} days`)));
  });
  dash.draw('rt-rows', (tb) => {
    tb.replaceChildren();
    const r = retention();
    if (!r) return;
    if (!r.length) return emptyRow(tb, 2 + rtState.points.length, 'Nobody first attended between these dates.');
    for (const c of [...r].reverse()) {
      const tr = el('tr');
      td(tr, cohortLabel(c.key)); td(tr, fmt(c.n), 'la-n');
      rtState.points.forEach((_, i) => td(tr, c.known[i] ? `${pct(c.hit[i] / c.known[i])} (${c.hit[i]} of ${c.known[i]})` : '—', 'la-n'));
      tb.append(tr);
    }
  });

  // ---------- calendar heatmap ----------
  dash.draw('cal-key', (box) => {
    box.replaceChildren();
    const s = el('span', 'mb-cal-scale');
    s.append('Fewer');
    for (const o of [0.15, 0.35, 0.55, 0.75, 1]) { const i = el('i'); i.style.background = 'var(--series-1)'; i.style.opacity = o; s.append(i); }
    s.append('More');
    const none = el('span');
    const ni = el('i'); ni.style.background = 'var(--cds-chart-grid)';
    none.append(ni, 'No event or drill');
    box.append(s, none);
  });
  dash.draw('cal', (box) => {
    box.replaceChildren();
    const rs = rows('attendance');
    box.classList.toggle('dash-skeleton', !rs);
    if (!rs) return;
    const p = P();
    const kinds = shownKinds();
    const posts = new Map();
    for (const r of rs) {
      if (!kinds.includes(r.kind) || (p.year !== 'all' && !r.date.startsWith(p.year)) || (p.day !== 'all' && dayOf(r.date) !== p.day)) continue;
      if (!posts.has(r.post)) posts.set(r.post, { post: r.post, date: r.date, kind: r.kind, n: 0 });
      posts.get(r.post).n += 1;
    }
    const byDay = d3.group([...posts.values()], (x) => x.date);
    if (!byDay.size) { box.append(el('div', 'la-failed', 'Nothing in this period.')); return; }
    const max = d3.max([...posts.values()], (x) => x.n) || 1;
    box._csv = { head: ['Date', 'Day', 'Type', 'Attendance'], rows: [...posts.values()].sort((a, z) => a.date.localeCompare(z.date)).map((x) => [x.date, dayOf(x.date), x.kind === 'event' ? 'Event' : 'Drill', x.n]) };
    const dates = [...byDay.keys()].sort();
    const years = d3.range(+dates[dates.length - 1].slice(0, 4), +dates[0].slice(0, 4) - 1, -1);
    const span = [all()?.data[0]?.date ?? dates[0], all()?.latest ?? dates[dates.length - 1]];
    const scroll = el('div', 'mb-cal-scroll');
    box.append(scroll);
    const tip = makeTip(box);
    const C = 12, G = 2, L0 = 30, T0 = 16;
    for (const y of years) {
      const y0 = new Date(Date.UTC(y, 0, 1)), y1 = new Date(Date.UTC(y + 1, 0, 1));
      const weeks = d3.utcSunday.count(d3.utcSunday.floor(y0), y1) + 1;
      const W = L0 + weeks * (C + G), H = T0 + 7 * (C + G);
      const wrap = el('div', 'mb-cal-year');
      wrap.append(el('h4', 'mb-h4', String(y)));
      const svg = d3.select(wrap).append('svg').attr('width', W).attr('height', H).attr('class', 'la-svg');
      for (const [i, d] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']]) svg.append('text').attr('x', 0).attr('y', T0 + i * (C + G) + C - 2).text(d);
      for (const m of d3.utcMonths(y0, y1)) svg.append('text').attr('x', L0 + d3.utcSunday.count(y0, m) * (C + G)).attr('y', 10).text(d3.utcFormat('%b')(m));
      for (const d of d3.utcDays(y0, y1)) {
        const key = iso(d);
        if (key < span[0] || key > span[1]) continue; // outside our records
        const list = byDay.get(key);
        const x = L0 + d3.utcSunday.count(d3.utcSunday.floor(y0), d) * (C + G) - (d3.utcSunday.floor(y0) < y0 ? 0 : 0);
        const rect = svg.append('rect').attr('x', x).attr('y', T0 + d.getUTCDay() * (C + G)).attr('width', C).attr('height', C).attr('rx', 2);
        if (!list) { rect.style('fill', 'var(--cds-chart-grid)'); continue; }
        const top = d3.greatest(list, (z) => z.n);
        rect.style('fill', 'var(--series-1)').attr('fill-opacity', 0.15 + 0.85 * (top.n / max)).style('cursor', 'pointer');
        const node = rect.node();
        node.addEventListener('pointerenter', () => {
          const br = box.getBoundingClientRect(), rr = node.getBoundingClientRect();
          tip(rr.left - br.left + C / 2, rr.top - br.top, `${dayOf(key)} ${dayName(key)}`, list.map((z) => ({ text: `${z.kind === 'event' ? 'Event' : 'Drill'}: ${fmt(z.n)} attended` })).concat([{ text: 'Click to see who was there' }]));
        });
        node.addEventListener('pointerleave', () => tip());
        node.addEventListener('click', () => window.laShowPost(top.post));
      }
      scroll.append(wrap);
    }
    // On a narrow screen the year scrolls sideways: start at the latest months, then keep the reader's place.
    scroll.scrollLeft = box._calLeft ?? scroll.scrollWidth;
    scroll.addEventListener('scroll', () => { box._calLeft = scroll.scrollLeft; }, { passive: true });
  });

  // ---------- top controls on the new tab ----------
  const prevShowTab = window.showTab;
  window.showTab = function (name, link) {
    prevShowTab(name, link);
    for (const fl of document.querySelectorAll('.la-filters')) if (name === 'compare') fl.hidden = true;
  };

  // ---------- links remember the view; Back moves between tabs ----------
  const KEYS = ['period', 'from', 'to', 'day', 'kind', 'grain', 'person', 'co', 'cmp', 'ca', 'cb', 'g1', 'g2', 'p1f', 'p1t', 'p2f', 'p2t'];
  const ONLY_ON = { person: 'people', co: 'companies', cmp: 'compare', ca: 'compare', cb: 'compare', g1: 'compare', g2: 'compare', p1f: 'compare', p1t: 'compare', p2f: 'compare', p2t: 'compare' };
  dash.setLink = () => {}; // the page's own tab links are replaced by the fuller ones below
  // Each address matches its buttons: section, then sub-tab when the section has more than one.
  // Old addresses (the page ids, e.g. #regiment, #builder) still open and are swapped for the new ones.
  const ROUTES = {
    regiment: 'overview',
    results: 'events/results', patterns: 'events/days-and-calendar',
    companies: 'companies',
    people: 'members/people', recruits: 'members/recruits', promotions: 'members/promotions', milestones: 'members/milestones', awards: 'members/awards',
    check: 'tools/attendance-check', compare: 'tools/compare', builder: 'tools/build-a-chart', checks: 'tools/name-checks',
  };
  const TAB_OF = Object.fromEntries(Object.entries(ROUTES).map(([t, r]) => [r, t]));
  const OLD = { person: 'people', events: 'results', tools: 'check', members: 'people' };
  const routeOf = (tab) => ROUTES[tab] ?? tab;
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
      if (((k.startsWith('p') && k.length === 3) || k === 'g1' || k === 'g2') && p.cmp !== 'periods') continue;
      if ((k === 'ca' || k === 'cb') && p.cmp === 'periods') continue;
      q.set(k, v);
    }
    const s = q.toString();
    return '#' + routeOf(tab) + (s ? '&' + s : '');
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
    const [route, rest] = [decodeURIComponent(h.split('&')[0]).toLowerCase(), h.split('&').slice(1).join('&')];
    const tab = TAB_OF[route] ?? (tabs.includes(route) ? route : OLD[route]);
    if (!tab || !tabs.includes(tab)) return false;
    // An old or differently written address: swap it for the new one in place, so Back skips it.
    if (route !== routeOf(tab) || h.split('&')[0] !== route) history.replaceState(null, '', '#' + routeOf(tab) + (rest ? '&' + rest : ''));
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

// ---------- click a legend entry to hide or show it ----------
(function () {
  const hidden = new Map(); // card key -> Set of hidden legend names
  const autoKeys = new WeakMap();
  let n = 0;
  const keyOf = (card) => {
    if (!card) return null;
    if (card.id) return card.id;
    if (card.dataset.hideKey) return card.dataset.hideKey;
    if (!autoKeys.has(card)) autoKeys.set(card, 'card-' + ++n);
    return autoKeys.get(card);
  };
  // A legend says "Events" where the dots say "Event", and "Loss" where a dot says "Loss 1-2".
  const low = (s) => String(s ?? '').trim().toLowerCase();
  const sing = (s) => s.replace(/s$/, '');
  const isOff = (set, name) => {
    const a = low(name);
    for (const h of set) { const b = low(h); if (a === b || sing(a) === sing(b) || a.startsWith(b + ' ') || a.startsWith(sing(b) + ' ')) return true; }
    return false;
  };
  const hiddenFor = (el) => hidden.get(keyOf(el.closest('.la-card'))) ?? new Set();
  // Only entries that are showing: a legend can keep a hidden "Drills" entry while only events are picked.
  const legendSpans = (card) => [...card.querySelectorAll('.la-legend:not(.mb-cal-key) span')].filter((s) => s.querySelector('i') && s.getClientRects().length);
  const labelOf = (span) => span.textContent.trim();

  function mark(card) {
    if (!card || !card.querySelector('.la-chart')) return;
    const set = hidden.get(keyOf(card)) ?? new Set();
    for (const s of legendSpans(card)) {
      const off = set.has(labelOf(s));
      s.classList.add('la-lg-toggle');
      s.classList.toggle('la-lg-off', off);
      s.setAttribute('role', 'button');
      s.setAttribute('tabindex', '0');
      s.setAttribute('aria-pressed', String(!off));
      s.title = off ? 'Click to show' : 'Click to hide';
    }
  }
  const markLater = (el) => requestAnimationFrame(() => mark(el.closest('.la-card')));

  // Keep at least one series, so a chart is never empty.
  const keep = (list, set, nameOf) => { if (!set.size) return list; const k = list.filter((x) => !isOff(set, nameOf(x))); return k.length ? k : list; };
  for (const fn of ['lineChart', 'barChart']) {
    const orig = window[fn];
    if (typeof orig !== 'function') continue;
    window[fn] = function (el, xs, series, o) {
      markLater(el);
      return orig.call(this, el, xs, keep(series, hiddenFor(el), (s) => s.name), o);
    };
  }
  if (typeof window.postChart === 'function') {
    const orig = window.postChart;
    window.postChart = function (el, points, o) {
      markLater(el);
      return orig.call(this, el, keep(points, hiddenFor(el), (p) => p.name), o);
    };
  }

  function toggle(span) {
    const card = span.closest('.la-card');
    if (!card || !card.querySelector('.la-chart')) return;
    const key = keyOf(card);
    const set = hidden.get(key) ?? new Set();
    const name = labelOf(span);
    const all = legendSpans(card).map(labelOf);
    if (set.has(name)) set.delete(name);
    else if (all.filter((x) => !set.has(x) && x !== name).length) set.add(name);
    else set.clear(); // clicking the only one left showing brings them all back
    hidden.set(key, set);
    const names = new Set([...card.querySelectorAll('[data-draw]')].map((e) => e.dataset.draw));
    for (const nm of names) dash.draw(nm);
    const outer = card.closest('[data-draw]');
    if (outer) dash.draw(outer.dataset.draw);
    mark(card);
  }
  document.addEventListener('click', (e) => {
    const span = e.target.closest('.la-legend:not(.mb-cal-key) span');
    if (span && span.querySelector('i')) toggle(span);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const span = e.target.closest?.('.la-lg-toggle');
    if (span) { e.preventDefault(); toggle(span); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '.la-lg-toggle{cursor:pointer;user-select:none;border-radius:4px}.la-lg-toggle:hover{color:var(--color-fg)}.la-lg-toggle:focus-visible{outline:2px solid var(--color-focus,currentColor);outline-offset:2px}.la-lg-off{opacity:.45;text-decoration:line-through}.la-lg-off i{background:transparent!important;outline:1px solid var(--color-fg-muted)}';
    document.head.append(st);
    for (const c of document.querySelectorAll('.la-card')) mark(c);
  });
})();

// ---------- five sections, each with its own sub-tabs ----------
(function () {
  const SECTIONS = [
    ['Overview', ['regiment']],
    ['Events', ['results', 'patterns']],
    ['Companies', ['companies']],
    ['Members', ['people', 'recruits', 'promotions', 'milestones', 'awards']],
    ['Tools', ['check', 'compare', 'builder', 'checks']],
  ];
  const sectionOf = (tab) => SECTIONS.find(([, t]) => t.includes(tab)) ?? SECTIONS[0];
  const $ = (s) => document.querySelector(s);
  const make = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };

  // New "Days and calendar" page under Events, built from cards that were on the long Regiment page.
  const results = $('#results');
  if (results && !$('#patterns')) {
    const page = make('section', { id: 'patterns', class: 'la-page', role: 'tabpanel', 'aria-labelledby': 'tab-patterns', hidden: '' });
    const dayGrid = $('#by-day')?.closest('.la-grid');
    if (dayGrid) page.append(dayGrid);
    const held = $('#held');
    const mix = $('#mix');
    if (held) page.append(held);
    if (mix) { const old = mix.closest('.la-grid'); $('#companies')?.append(mix); if (old && !old.children.length) old.remove(); }
    const cal = $('#calendar');
    if (cal) page.append(cal);
    results.after(page);
    if (typeof tabs !== 'undefined' && !tabs.includes('patterns')) tabs.push('patterns');
  }

  // Sub-tab buttons, in section order.
  const row = $('.la-tabs');
  if (!row) return;
  if (!row.querySelector('[data-tab="patterns"]')) {
    const b = make('button', { id: 'tab-patterns', role: 'tab', 'data-tab': 'patterns', 'aria-selected': 'false' }, 'Days and calendar');
    b.addEventListener('click', () => showTab('patterns'));
    row.append(b);
  }
  for (const [, ts] of SECTIONS) for (const t of ts) { const b = row.querySelector(`[data-tab="${t}"]`); if (b) row.append(b); }
  row.setAttribute('aria-label', 'Pages in this section');

  const nav = make('nav', { class: 'la-sections', 'aria-label': 'Sections' });
  const last = {};
  for (const [name, ts] of SECTIONS) {
    const b = make('button', { type: 'button', 'data-section': name }, name);
    b.addEventListener('click', () => showTab(last[name] ?? ts[0]));
    nav.append(b);
  }
  row.closest('.la-bar')?.before(nav);

  function fit(name) {
    const [sec, ts] = sectionOf(name);
    last[sec] = name;
    for (const b of nav.children) b.setAttribute('aria-current', b.dataset.section === sec ? 'page' : 'false');
    // Only touch 'hidden' when it changes, or the observer below would keep firing.
    for (const b of row.querySelectorAll('[data-tab]')) { const h = !ts.includes(b.dataset.tab); if (b.hidden !== h) b.hidden = h; }
    if (row.hidden !== ts.length < 2) row.hidden = ts.length < 2;
    const on = row.querySelector(`[data-tab="${name}"]`);
    if (on && row.scrollWidth > row.clientWidth) {
      const a = on.offsetLeft - row.offsetLeft, z = a + on.offsetWidth;
      if (a < row.scrollLeft || z > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, a - 24);
    }
  }
  // A tile's change-from-last-year line is only a dash unless one year is picked: hide it then.
  const blankDeltas = () => { for (const d of document.querySelectorAll('.la-delta')) d.classList.toggle('mb-blank', d.textContent.trim() === '—'); };
  dash.onData(() => requestAnimationFrame(blankDeltas));
  const prev = window.showTab;
  window.showTab = function (name, link) { prev(name, link); fit(name); };
  fit(document.querySelector('.la-page:not([hidden])')?.id || 'regiment');
  // The page's own tab buttons call the original showTab, so keep the sections in step after any tab change.
  new MutationObserver(() => fit(document.querySelector('.la-page:not([hidden])')?.id || 'regiment'))
    .observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });

  const st = document.createElement('style');
  st.textContent = `
    .la-sections { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border-line); overflow-x: auto; scrollbar-width: none; }
    .la-sections button { font: inherit; font-size: var(--cds-font-size-body, 15px); font-weight: var(--cds-font-weight-medium, 500); padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--color-fg-muted); cursor: pointer; white-space: nowrap; }
    .la-sections button:hover { color: var(--color-fg); }
    .la-sections button[aria-current="page"] { color: var(--color-fg); border-bottom-color: var(--color-fg); }
    .la-sections button:focus-visible { outline: 2px solid var(--color-fg-muted); outline-offset: -2px; }
    .la-tabs[hidden] { display: none; }
    .la-tabs button[hidden] { display: none; }
    @media (max-width: 520px) { .la-sections { gap: 0; } .la-sections button { flex: 1 1 auto; padding: 8px 2px; font-size: 14px; } }`;
  document.head.append(st);
})();

// ---------- phones and tablets: hints say tap instead of point at or click ----------
(function () {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const SWAPS = [
    [/Point at a dot to see its date and count, or click it to see who was there\./g, 'Tap a dot to see who was there.'],
    [/Point at a day for details, or click it to see who was there\./g, 'Tap a day to see who was there.'],
    [/Point at an? /g, 'Tap a '],
    [/\bClick\b/g, 'Tap'],
    [/\bclick\b/g, 'tap'],
    [/\bclicking\b/g, 'tapping'],
  ];
  const fix = () => {
    const walk = document.createTreeWalker(document.querySelector('.la') ?? document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest('p, .bd-added, .mb-note') && !n.parentElement.closest('.la-tip, .la-zoomhint') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      let t = n.nodeValue;
      for (const [a, b] of SWAPS) t = t.replace(a, b);
      if (t !== n.nodeValue) n.nodeValue = t;
    }
  };
  document.addEventListener('DOMContentLoaded', fix);
  dash.onData(() => requestAnimationFrame(fix));
})();
