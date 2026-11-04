// Site-only: find a member, member profiles, milestones, attendance check, recruits, event results and CSV downloads.
// Runs after the page's scripts and builder.js, so it shares their helpers (barChart, postChart, fmt, pct, P, rows, ...).
(function () {
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } };
  const iso = (d) => d3.utcFormat('%Y-%m-%d')(d);
  const toDate = (s) => new Date(s + 'T00:00:00Z');
  const addDays = (s, n) => iso(d3.utcDay.offset(toDate(s), n));
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const dayOf = (s) => DAYS[toDate(s).getUTCDay()];
  const plural = (n, one1, many) => `${fmt(n)} ${n === 1 ? one1 : many}`;
  const kindWord = { event: ['event', 'events'], drill: ['drill', 'drills'], any: ['event or drill', 'events and drills'] };

  // ---------- everything worked out once from the full history (not the period picked) ----------
  let base = null;
  let baseFor = null;
  function all() {
    const src = dash.raw('attendance');
    if (src.status !== 'ok') return null;
    if (baseFor === src.data) return base;
    baseFor = src.data;
    const data = [...src.data].sort((a, b) => a.date.localeCompare(b.date) || a.post.localeCompare(b.post));
    const posts = new Map();
    const people = new Map();
    for (const r of data) {
      if (!posts.has(r.post)) posts.set(r.post, { post: r.post, date: r.date, kind: r.kind, score: r.score ?? null, n: 0 });
      posts.get(r.post).n += 1;
      if (!people.has(r.name)) people.set(r.name, { name: r.name, rows: [] });
      people.get(r.name).rows.push(r);
    }
    const postList = [...posts.values()];
    const latest = data.length ? data[data.length - 1].date : iso(new Date());
    const heldBetween = (kind, from, to) => postList.filter((p) => p.kind === kind && p.date >= from && p.date <= to).length;
    for (const g of people.values()) {
      const rs = g.rows;
      g.first = rs[0].date;
      g.last = rs[rs.length - 1].date;
      // Latest company, but a recruit row never replaces a real company.
      g.company = rs[0].company;
      for (const r of rs) if (r.company !== 'Recruits' || g.company === 'Recruits') g.company = r.company;
      g.events = rs.filter((r) => r.kind === 'event').length;
      g.drills = rs.length - g.events;
      const he = heldBetween('event', g.first, g.last), hd = heldBetween('drill', g.first, g.last);
      g.eventRate = he ? g.events / he : null;
      g.drillRate = hd ? g.drills / hd : null;
      // Rank as written in each post; keep when it changed.
      g.ranks = [];
      for (const r of rs) if (r.rank && r.rank !== g.ranks[g.ranks.length - 1]?.rank) g.ranks.push({ rank: r.rank, date: r.date });
      g.rank = g.ranks[g.ranks.length - 1]?.rank ?? null;
    }
    // Milestones: the date each person reached 10, 25, 50, 75, 100, 150, ... events or drills.
    const milestones = [];
    for (const g of people.values()) {
      const n = { event: 0, drill: 0 };
      for (const r of g.rows) {
        n[r.kind] += 1;
        if (isMilestone(n[r.kind])) milestones.push({ date: r.date, name: g.name, company: r.company, kind: r.kind, count: n[r.kind] });
      }
    }
    milestones.sort((a, b) => b.date.localeCompare(a.date) || b.count - a.count || a.name.localeCompare(b.name));
    base = { data, posts: postList, people, latest, milestones, heldBetween };
    return base;
  }

  function isMilestone(n) { return n === 10 || n === 25 || n === 75 || (n >= 50 && n % 50 === 0); }
  function nextMilestone(n) { for (const m of [10, 25, 50, 75]) if (n < m) return m; return (Math.floor(n / 50) + 1) * 50; }

  // The period picked at the top: the shim handles from/to; a calendar year comes through as year.
  function inPeriod(date) {
    const p = P();
    if (p.from && date < p.from) return false;
    if (p.to && date > p.to) return false;
    return p.year === 'all' || date.startsWith(p.year);
  }

  function td(tr, text, cls) {
    const c = document.createElement('td');
    c.textContent = text;
    if (cls) c.className = cls;
    tr.append(c);
    return c;
  }
  function pill(tr, text, tone) {
    const c = td(tr, '');
    const s = document.createElement('span');
    s.className = 'mb-pill mb-' + tone;
    s.textContent = text;
    c.append(s);
  }
  function emptyRow(tb, cols, text) {
    const tr = document.createElement('tr');
    const c = td(tr, text, 'mb-empty');
    c.colSpan = cols;
    tb.append(tr);
  }
  function tiles(el, list) {
    el.replaceChildren();
    el.classList.toggle('dash-skeleton', !all());
    for (const [label, value, sub] of list) {
      const t = document.createElement('div');
      t.className = 'la-tile';
      const s = document.createElement('span'); s.textContent = label;
      const b = document.createElement('b'); b.className = 'la-num'; b.textContent = value;
      const d = document.createElement('div'); d.className = 'la-delta'; d.textContent = sub ?? '';
      t.append(s, b, d);
      el.append(t);
    }
  }
  function legend(el, items) {
    el.replaceChildren();
    for (const [name, color] of items) {
      const s = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = color;
      s.append(i, name);
      el.append(s);
    }
  }
  // Higher number = higher rank; anything not listed sorts in the middle.
  const LADDER = ['rct', 'pvt', 'pfc', 'cpl', 'sgt', 'ssgt', 'osgt', '1stsgt', '1sgt', 'qmsgt', 'sgtmaj', '2ndlt', '2lt', 'lt', '1stlt', '1lt', 'capt', 'cpt', 'maj', 'ltcol', 'col', 'gen'];
  const rankOrder = (k) => { if (!k) return null; const i = LADDER.indexOf(k.toLowerCase().replace(/[^a-z0-9]/g, '')); return i < 0 ? 8 : i; };
  const rankOf = (name) => all()?.people.get(name)?.rank ?? null;
  const withRank = (name) => { const r = rankOf(name); return r ? `${r} ${name}` : name; };
  function openCompany(co) {
    showTab('companies');
    dash.setParams({ co });
    requestAnimationFrame(() => document.getElementById('company-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
  function coButton(co) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mb-name mb-co';
    b.dataset.co = co;
    b.textContent = co;
    return b;
  }
  function coCell(tr, co, after) {
    const c = td(tr, '');
    if (!co) { c.textContent = '—'; return c; }
    c.append(coButton(co));
    if (after) c.append(after);
    return c;
  }
  // Any company name marked with data-co opens that company's page.
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-co]');
    if (!b) return;
    ev.stopPropagation();
    ev.preventDefault();
    document.querySelector('dialog[open]')?.close();
    openCompany(b.dataset.co);
  }, true);
  // Each name in a table comes with a Rank column just before it.
  function nameButton(tr, name) {
    const rk = rankOf(name);
    const rc = td(tr, rk ?? '—');
    if (rk) rc.dataset.v = rankOrder(rk);
    const c = td(tr, '');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mb-name';
    b.textContent = name;
    b.addEventListener('click', () => openPerson(name));
    c.append(b);
  }

  // ---------- find a member and member profiles ----------
  function openPerson(name) {
    showTab('people');
    dash.setParams({ person: name });
    requestAnimationFrame(() => { for (const p of document.querySelectorAll('#person')) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  }
  function matchName(q) {
    const b = all();
    if (!b || !q.trim()) return null;
    const want = q.trim().toLowerCase();
    const names = [...b.people.keys()];
    return names.find((n) => n.toLowerCase() === want) ?? (() => {
      const hits = names.filter((n) => n.toLowerCase().includes(want));
      return hits.length === 1 ? hits[0] : null;
    })();
  }
  const find = document.getElementById('find-member');
  if (find) {
    const go = () => {
      const n = matchName(find.value);
      find.classList.toggle('mb-nomatch', !n && find.value.trim() !== '');
      if (!n) return;
      find.value = '';
      find.blur();
      openPerson(n);
    };
    find.addEventListener('change', go);
    find.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
    find.addEventListener('input', () => find.classList.remove('mb-nomatch'));
  }
  for (const b of document.querySelectorAll('.mb-copy-person')) {
    b.addEventListener('click', async () => {
      const who = P().person;
      if (!who) return;
      const url = location.origin + location.pathname + '#person=' + encodeURIComponent(who);
      try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; } catch { prompt('Copy this link', url); }
      setTimeout(() => { b.textContent = 'Copy link'; }, 2000);
    });
  }

  let namesFilled = false;
  dash.onData(() => {
    const b = all();
    if (!b || namesFilled) return;
    namesFilled = true;
    const names = [...b.people.keys()].sort((x, y) => x.localeCompare(y));
    for (const dl of document.querySelectorAll('#all-members')) dl.replaceChildren(...names.map((n) => new Option(n)));
  });

  function weekStreaks(g, latest) {
    const weeks = [...new Set(g.rows.map((r) => +d3.utcMonday.floor(toDate(r.date))))].sort((a, b) => a - b);
    const WEEK = 7 * 864e5;
    let longest = 0, run = 0, prev = null;
    for (const w of weeks) { run = prev != null && w - prev === WEEK ? run + 1 : 1; longest = Math.max(longest, run); prev = w; }
    // A streak is still current if they attended this week or last week (the latest week on record).
    const now = +d3.utcMonday.floor(toDate(latest));
    const current = prev != null && now - prev <= WEEK ? run : 0;
    return { current, longest };
  }

  // One rank per line, newest first; past three, the older ones fold away behind "Show all".
  function rankHistory(g) {
    const SHOW = 3;
    const list = [...g.ranks].reverse().map((x, i, arr) => `${x.rank}: ${i === arr.length - 1 ? 'first seen' : 'from'} ${dayName(x.date)}`);
    const ul = (items) => { const u = document.createElement('ul'); u.className = 'mb-ranks'; for (const t of items) { const li = document.createElement('li'); li.textContent = t; u.append(li); } return u; };
    const box = document.createDocumentFragment();
    box.append(ul(list.slice(0, SHOW)));
    if (list.length > SHOW) {
      const det = document.createElement('details');
      det.className = 'mb-more';
      const sm = document.createElement('summary');
      sm.textContent = `Show ${list.length - SHOW} earlier`;
      det.addEventListener('toggle', () => { sm.textContent = det.open ? 'Show less' : `Show ${list.length - SHOW} earlier`; });
      det.append(sm, ul(list.slice(SHOW)));
      box.append(det);
    }
    return box;
  }
  dash.draw('p-extra', (el) => {
    el.replaceChildren();
    const b = all();
    const who = P().person;
    if (!b || !who || !b.people.has(who)) return;
    const g = b.people.get(who);
    const st = weekStreaks(g, b.latest);
    const byDay = d3.rollup(g.rows, (v) => v.length, (r) => dayOf(r.date));
    const fav = d3.greatest(byDay, ([, n]) => n);
    const mates = [...b.people.values()].filter((x) => x.company === g.company && x.rows.length >= 5);
    const avgOf = (f) => { const v = mates.map((x) => x[f]).filter((x) => x != null); return v.length ? d3.mean(v) : null; };
    const vs = (mine, theirs) => {
      if (mine == null || theirs == null) return ['—'];
      const d = Math.round((mine - theirs) * 100);
      return [d === 0 ? 'Same as average' : `${Math.abs(d)} points ${d > 0 ? 'above' : 'below'}`, `${pct(mine)} vs ${g.company} average ${pct(theirs)}`];
    };
    const reached = b.milestones.filter((m) => m.name === who);
    const lastMs = (k) => reached.find((m) => m.kind === k);
    const msText = (k) => {
      const n = k === 'event' ? g.events : g.drills;
      const got = lastMs(k);
      const nx = nextMilestone(n);
      return [got ? `${fmt(got.count)} ${kindWord[k][1]}` : 'None yet', `${got ? `Reached ${dayName(got.date)}. ` : ''}${fmt(nx - n)} more to reach ${fmt(nx)}`];
    };
    const items = [
      ['Rank history', g.ranks.length ? g.ranks[g.ranks.length - 1].rank : '—', g.ranks.length ? rankHistory(g) : null],
      ['Weeks in a row now', st.current ? plural(st.current, 'week', 'weeks') : 'Not this week'],
      ['Longest run', plural(st.longest, 'week', 'weeks')],
      ['Most often on', fav ? `${fav[0]}s (${plural(fav[1], 'time', 'times')})` : '—'],
      ['Event rate vs company', ...vs(g.eventRate, avgOf('eventRate'))],
      ['Drill rate vs company', ...vs(g.drillRate, avgOf('drillRate'))],
      ['Latest event milestone', ...msText('event')],
      ['Latest drill milestone', ...msText('drill')],
    ];
    const dl = document.createElement('dl');
    dl.className = 'mb-profile-list';
    for (const [k, v, sub] of items) {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      d.append(dt, dd);
      if (sub) { const s2 = document.createElement('dd'); s2.className = 'mb-sub'; if (sub instanceof Node) s2.append(sub); else s2.textContent = sub; d.append(s2); }
      dl.append(d);
    }
    const note = document.createElement('p');
    note.className = 'mb-note';
    note.textContent = `Company averages count ${g.company} members with 5 or more appearances. A week runs Monday to Sunday. These use all history, whatever period is picked.`;
    el.append(dl, note);
  });

  // ---------- milestones ----------
  dash.draw('ms-rows', (tb) => {
    tb.replaceChildren();
    const b = all();
    if (!b) return;
    const list = b.milestones.filter((m) => inPeriod(m.date) && (P().kind === 'all' || P().kind === m.kind));
    if (!list.length) return emptyRow(tb, 5, 'No milestones reached in this period.');
    for (const m of list.slice(0, 500)) {
      const tr = document.createElement('tr');
      td(tr, dayName(m.date)); nameButton(tr, m.name); coCell(tr, m.company); td(tr, `${fmt(m.count)} ${kindWord[m.kind][1]}`);
      tb.append(tr);
    }
  });
  dash.draw('ms-next', (tb) => {
    tb.replaceChildren();
    const b = all();
    if (!b) return;
    const since = addDays(b.latest, -60);
    const list = [];
    for (const g of b.people.values()) {
      if (g.last < since) continue;
      for (const k of ['event', 'drill']) {
        if (P().kind !== 'all' && P().kind !== k) continue;
        const n = k === 'event' ? g.events : g.drills;
        const nx = nextMilestone(n);
        list.push({ name: g.name, company: g.company, kind: k, next: nx, left: nx - n });
      }
    }
    list.sort((a, c) => a.left - c.left || c.next - a.next || a.name.localeCompare(c.name));
    if (!list.length) return emptyRow(tb, 5, 'Nobody seen in the last 60 days.');
    for (const x of list.slice(0, 40)) {
      const tr = document.createElement('tr');
      nameButton(tr, x.name); coCell(tr, x.company); td(tr, `${fmt(x.next)} ${kindWord[x.kind][1]}`); td(tr, fmt(x.left), 'la-n');
      tb.append(tr);
    }
  });

  // ---------- recruits ----------
  function recruits() {
    const b = all();
    if (!b) return null;
    const out = [];
    for (const g of b.people.values()) {
      if (g.rows[0].company !== 'Recruits') continue;
      const joinRow = g.rows.find((r) => r.company !== 'Recruits');
      const first30 = g.rows.filter((r) => r.date <= addDays(g.first, 29)).length;
      const status = joinRow ? 'Joined a company' : 'Still a recruit';
      const quiet = !joinRow && g.last < addDays(b.latest, -30);
      out.push({ name: g.name, first: g.first, last: g.last, status, quiet, joined: joinRow?.company ?? null, joinDate: joinRow?.date ?? null, days: joinRow ? daysBetween(g.first, joinRow.date) : null, first30 });
    }
    return out.filter((x) => inPeriod(x.first)).sort((a, c) => c.first.localeCompare(a.first) || a.name.localeCompare(c.name));
  }
  const STATUS = [['Joined a company', () => dash.colors[2], 'ok'], ['Still a recruit', () => dash.colors[0], 'warn']];
  dash.draw('rc-tiles', (el) => {
    const r = recruits() ?? [];
    const n = (s) => r.filter((x) => x.status === s).length;
    const days = r.filter((x) => x.days != null).map((x) => x.days);
    tiles(el, [
      ['New recruits', fmt(r.length), 'First seen in this period'],
      ['Joined a company', fmt(n('Joined a company')), r.length ? pct(n('Joined a company') / r.length) + ' of recruits' : ''],
      ['Typical days to join', days.length ? fmt(Math.round(d3.median(days))) : '—', 'Median'],
      ['Still a recruit', fmt(n('Still a recruit')), (() => { const q = r.filter((x) => x.quiet).length; return q ? `${fmt(q)} not seen in the last 30 days` : 'All seen in the last 30 days'; })()],
    ]);
  });
  dash.draw('rc-legend', (el) => legend(el, STATUS.map(([s, c]) => [s, c()])));
  dash.draw('rc-chart', (el) => {
    el.replaceChildren();
    const r = recruits();
    el.classList.toggle('dash-skeleton', !r);
    if (!r || !r.length) return;
    const ms = r.map((x) => x.first.slice(0, 7));
    const months = monthsBetween(d3.min(ms), d3.max(ms));
    const series = STATUS.map(([s, c]) => ({ name: s, color: c(), values: d3.rollup(r.filter((x) => x.status === s), (v) => v.length, (x) => x.first.slice(0, 7)) }));
    barChart(el, months, series, { height: 200, stack: true, totalLabel: 'New recruits' });
  });
  dash.draw('rc-rows', (tb) => {
    tb.replaceChildren();
    const r = recruits();
    if (!r) return;
    if (!r.length) return emptyRow(tb, 8, 'No recruits first seen in this period.');
    for (const x of r) {
      const tr = document.createElement('tr');
      nameButton(tr, x.name); td(tr, dayName(x.first));
      pill(tr, x.status, STATUS.find(([s]) => s === x.status)[2]);
      coCell(tr, x.joined, x.joined ? `, ${dayName(x.joinDate)}` : null);
      td(tr, x.days == null ? '—' : fmt(x.days), 'la-n'); td(tr, fmt(x.first30), 'la-n'); td(tr, dayName(x.last));
      tb.append(tr);
    }
  });

  // ---------- event results ----------
  const RES = { W: ['Win', () => dash.colors[2], 'ok'], L: ['Loss', () => dash.colors[6], 'bad'], D: ['Draw', () => 'var(--cds-chart-muted)', 'warn'] };
  function results() {
    const b = all();
    if (!b) return null;
    const out = [];
    for (const p of b.posts) {
      if (p.kind !== 'event' || !p.score || !inPeriod(p.date)) continue;
      if (P().day !== 'all' && dayOf(p.date) !== P().day) continue;
      const m = String(p.score).match(/^\s*(\d+)\s*[-–:]\s*(\d+)/);
      if (!m) continue;
      const us = +m[1], them = +m[2];
      out.push({ ...p, day: dayOf(p.date), us, them, res: us > them ? 'W' : us < them ? 'L' : 'D' });
    }
    return out.sort((a, c) => c.date.localeCompare(a.date));
  }
  dash.draw('rs-tiles', (el) => {
    const r = results() ?? [];
    const c = (k) => r.filter((x) => x.res === k);
    const avg = (v) => (v.length ? one(d3.mean(v, (x) => x.n)) : '—');
    const decided = c('W').length + c('L').length;
    tiles(el, [
      ['Record', `${c('W').length}–${c('L').length}${c('D').length ? '–' + c('D').length : ''}`, c('D').length ? 'Wins, losses, draws' : 'Wins and losses'],
      ['Win rate', decided ? pct(c('W').length / decided) : '—', plural(r.length, 'event with a score', 'events with a score')],
      ['Average attendance in wins', avg(c('W')), ''],
      ['Average attendance in losses', avg(c('L')), ''],
    ]);
  });
  dash.draw('rs-bands', (el) => {
    el.replaceChildren();
    const r = results();
    el.classList.toggle('dash-skeleton', !r);
    if (!r || r.length < 2) return;
    const lo = d3.min(r, (x) => x.n), hi = d3.max(r, (x) => x.n);
    const step = hi - lo > 60 ? 20 : hi - lo > 24 ? 10 : 5;
    const band = (n) => Math.floor(n / step) * step;
    const keys = d3.range(band(lo), band(hi) + 1, step).map((k) => `${k}–${k + step - 1}`);
    const groups = d3.group(r, (x) => { const k = band(x.n); return `${k}–${k + step - 1}`; });
    const rate = new Map();
    for (const [k, v] of groups) { const d = v.filter((x) => x.res !== 'D'); if (d.length) rate.set(k, Math.round(d.filter((x) => x.res === 'W').length / d.length * 100)); }
    barChart(el, keys, [{ name: 'Win rate', color: dash.colors[2], values: rate }], {
      height: 200, valueFmt: (v) => v + '%', unit: ' won', catLabel: (k) => k, tipTitle: (k) => `${k} attended`, csvLabel: 'Attendance',
      extra: (k) => [{ text: plural(groups.get(k)?.length ?? 0, 'event', 'events') }],
    });
  });
  dash.draw('rs-legend', (el) => legend(el, Object.values(RES).map(([s, c]) => [s, c()])));
  dash.draw('rs-dots', (el) => {
    el.replaceChildren();
    const r = results();
    el.classList.toggle('dash-skeleton', !r);
    if (!r || !r.length) return;
    postChart(el, [...r].reverse().map((x) => ({ post: x.post, date: x.date, day: x.day, value: x.n, color: RES[x.res][1](), name: `${RES[x.res][0]} ${x.us}-${x.them}` })), { height: 200, onPick: window.laShowPost ? (p) => window.laShowPost(p.post) : null });
  });
  dash.draw('rs-rows', (tb) => {
    tb.replaceChildren();
    const r = results();
    if (!r) return;
    if (!r.length) return emptyRow(tb, 5, 'No scored events in this period.');
    for (const x of r) {
      const tr = document.createElement('tr');
      tr.className = 'la-click';
      tr.tabIndex = 0;
      tr.dataset.post = x.post;
      td(tr, dayName(x.date)); td(tr, x.day); td(tr, `${x.us}-${x.them}`); pill(tr, RES[x.res][0], RES[x.res][2]); td(tr, fmt(x.n), 'la-n');
      tb.append(tr);
    }
  });

  // ---------- attendance check ----------
  const STORE_CHECK = 'la-check';
  const f = {
    scope: document.getElementById('ab-scope'), window: document.getElementById('ab-window'), days: document.getElementById('ab-days'),
    daysWrap: document.getElementById('ab-days-wrap'), kind: document.getElementById('ab-kind'),
    asof: document.getElementById('ab-asof'), companies: document.getElementById('ab-companies'), people: document.getElementById('ab-people'),
    person: document.getElementById('ab-person'), add: document.getElementById('ab-add'), recent: document.getElementById('ab-recent'),
  };
  let check = { scope: 'all', window: '30', days: 45, kind: 'any', min: 1, asof: '', companies: [], people: [], recent: true, ...load(STORE_CHECK, {}) };
  function saveCheck() { save(STORE_CHECK, check); dash.draw('ab-summary'); dash.draw('ab-key'); dash.draw('ab-rows'); }
  function writeCheck() {
    if (!f.scope) return;
    f.scope.value = check.scope; f.window.value = check.window; f.days.value = check.days; f.kind.value = check.kind;
    f.asof.value = check.asof; f.recent.checked = check.recent;
    f.daysWrap.hidden = check.window !== 'custom';
    f.companies.hidden = check.scope !== 'companies';
    f.people.hidden = check.scope !== 'people';
    const chips = f.people.querySelector('.mb-chips');
    chips.replaceChildren();
    for (const n of check.people) {
      const c = document.createElement('span');
      c.className = 'mb-chip';
      c.append(n);
      const x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + n);
      x.textContent = '×';
      x.addEventListener('click', () => { check.people = check.people.filter((p) => p !== n); writeCheck(); saveCheck(); });
      c.append(x);
      chips.append(c);
    }
    if (!check.people.length) { const e = document.createElement('span'); e.className = 'mb-note'; e.textContent = 'Nobody added yet.'; chips.append(e); }
    for (const box of f.companies.querySelectorAll('input')) box.checked = check.companies.includes(box.value);
  }
  if (f.scope) {
    const num = (el, lo, hi, d) => { const v = Math.round(+el.value); return Number.isFinite(v) && v >= lo ? Math.min(hi, v) : d; };
    f.scope.addEventListener('change', () => { check.scope = f.scope.value; writeCheck(); saveCheck(); });
    f.window.addEventListener('change', () => { check.window = f.window.value; writeCheck(); saveCheck(); });
    f.days.addEventListener('change', () => { check.days = num(f.days, 1, 730, 45); saveCheck(); });
    f.kind.addEventListener('change', () => { check.kind = f.kind.value; saveCheck(); });
    f.asof.addEventListener('change', () => { if (f.asof.value && !f.asof.validity.valid) return; check.asof = f.asof.value; saveCheck(); });
    f.recent.addEventListener('change', () => { check.recent = f.recent.checked; saveCheck(); });
    const addPerson = () => {
      const n = matchName(f.person.value);
      f.person.classList.toggle('mb-nomatch', !n && f.person.value.trim() !== '');
      if (!n) return;
      if (!check.people.includes(n)) check.people.push(n);
      f.person.value = '';
      writeCheck(); saveCheck();
    };
    f.add.addEventListener('click', addPerson);
    f.person.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addPerson(); } });
    f.person.addEventListener('input', () => f.person.classList.remove('mb-nomatch'));
    writeCheck();
  }
  let companiesFilled = false;
  dash.onData(() => {
    const b = all();
    if (!b || companiesFilled || !f.companies) return;
    companiesFilled = true;
    f.companies.replaceChildren();
    for (const c of companiesIn(b.data)) {
      const l = document.createElement('label');
      const i = document.createElement('input');
      i.type = 'checkbox'; i.value = c; i.checked = check.companies.includes(c);
      i.addEventListener('change', () => { check.companies = [...f.companies.querySelectorAll('input:checked')].map((x) => x.value); saveCheck(); });
      l.append(i, ' ' + c);
      f.companies.append(l);
    }
    f.asof.max = b.latest > iso(new Date()) ? b.latest : iso(new Date());
    f.asof.min = b.data[0]?.date ?? '';
    f.asof.placeholder = b.latest;
  });

  function runCheck() {
    const b = all();
    if (!b) return null;
    const to = check.asof || b.latest;
    const days = check.window === 'custom' ? check.days : +check.window;
    const from = addDays(to, -(days - 1));
    const counts = (r) => check.kind === 'any' || r.kind === check.kind;
    const held = b.posts.filter((p) => counts(p) && p.date >= from && p.date <= to).length;
    const out = [];
    let skipped = 0;
    for (const g of b.people.values()) {
      const before = g.rows.filter((r) => r.date <= to);
      if (!before.length) continue;
      let company = before[0].company;
      for (const r of before) if (r.company !== 'Recruits' || company === 'Recruits') company = r.company;
      if (check.scope === 'companies' && !check.companies.includes(company)) continue;
      if (check.scope === 'people' && !check.people.includes(g.name)) continue;
      if (check.scope !== 'people' && check.recent && !before.some((r) => r.date >= addDays(from, -183))) { skipped += 1; continue; }
      const inWin = before.filter((r) => r.date >= from && counts(r)).length;
      const lastOf = (k) => { for (let i = before.length - 1; i >= 0; i -= 1) if (before[i].kind === k) return before[i].date; return null; };
      const last = before[before.length - 1].date;
      out.push({ name: g.name, company, n: inWin, lastEvent: lastOf('event'), lastDrill: lastOf('drill'), since: daysBetween(last, to) });
    }
    out.sort((a, c) => (a.n > 0) - (c.n > 0) || c.since - a.since || a.name.localeCompare(c.name));
    return { from, to, held, out, skipped, flagged: out.filter((x) => x.n === 0).length };
  }
  dash.draw('ab-summary', (el) => {
    const r = runCheck();
    el.classList.toggle('dash-skeleton', !r);
    if (!r) { el.textContent = '—'; return; }
    const [w1, wn] = kindWord[check.kind];
    if (check.scope !== 'all' && !r.out.length) {
      el.textContent = check.scope === 'people' ? 'Add people above to check them.' : 'Tick one or more companies above.';
      return;
    }
    const span = `between ${dayName(r.from)} and ${dayName(r.to)}`;
    const held = `${plural(r.held, w1, wn)} ${r.held === 1 ? 'was' : 'were'} held ${span}`;
    const who = `${fmt(r.flagged)} of ${plural(r.out.length, 'person', 'people')} did not attend any of them`;
    el.textContent = `${held}. ${who}.` + (r.skipped ? ` ${plural(r.skipped, 'person', 'people')} who hadn't attended in the 6 months before were left out.` : '');
  });
  dash.draw('ab-key', (el) => {
    const r = runCheck();
    el.replaceChildren();
    if (!r) return;
    const [w1, wn] = kindWord[check.kind];
    const items = [
      ['Did not attend', 'bad', `wasn't at any of the ${plural(r.held, w1, wn)} held in the look-back period.`],
      ['Attended', 'ok', `was at one or more of them. The Attended column shows how many.`],
    ];
    for (const [s, tone, text] of items) {
      const li = document.createElement('li');
      const p = document.createElement('span');
      p.className = 'mb-pill mb-' + tone;
      p.textContent = s;
      li.append(p, ' ' + text);
      el.append(li);
    }
  });
  dash.draw('ab-rows', (tb) => {
    tb.replaceChildren();
    const r = runCheck();
    if (!r) return;
    for (const x of r.out) {
      const tr = document.createElement('tr');
      if (x.n === 0) pill(tr, 'Did not attend', 'bad'); else pill(tr, 'Attended', 'ok');
      nameButton(tr, x.name); coCell(tr, x.company); td(tr, fmt(x.n), 'la-n');
      td(tr, x.lastEvent ? dayName(x.lastEvent) : '—'); td(tr, x.lastDrill ? dayName(x.lastDrill) : '—'); td(tr, fmt(x.since), 'la-n');
      tb.append(tr);
    }
  });

  // ---------- which top controls make sense on each tab ----------
  const NO_KINDS = ['people', 'checks', 'recruits', 'results', 'check'];
  function fitControls(name) {
    for (const k of document.querySelectorAll('.la-kinds')) k.hidden = NO_KINDS.includes(name) && name !== 'milestones';
    // The check uses its own dates, so the period and filters don't apply there.
    for (const fl of document.querySelectorAll('.la-filters')) fl.hidden = name === 'check';
    for (const d of document.querySelectorAll('.la-day')) d.hidden = name === 'recruits' || name === 'milestones';
  }
  const prevShowTab = window.showTab;
  window.showTab = function (name, link) { prevShowTab(name, link); fitControls(name); };

  // ---------- zoom tip only where a zoomable chart is showing ----------
  function fitZoomTip() {
    const page = document.querySelector('.la-page:not([hidden])');
    const has = !!page && [...page.querySelectorAll('.la-chart svg')].some((s) => !s.closest('[hidden]'));
    for (const t of document.querySelectorAll('.la-zoomhint')) if (t.hidden === has) t.hidden = !has;
  }
  dash.onData(() => requestAnimationFrame(fitZoomTip));

  // ---------- CSV downloads ----------
  function csvOf(card) {
    const table = card.querySelector('table.la-table');
    if (table) {
      const head = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      const body = [...table.querySelectorAll('tbody tr')].filter((tr) => !tr.querySelector('.mb-empty')).map((tr) => [...tr.children].map((c) => c.textContent.trim()));
      return { head, rows: body };
    }
    const minis = [...card.querySelectorAll('.la-mini')].filter((m) => m.querySelector('.la-chart')?._csv);
    if (minis.length) {
      const first = minis[0].querySelector('.la-chart')._csv;
      return { head: ['Group', ...first.head], rows: minis.flatMap((m) => m.querySelector('.la-chart')._csv.rows.map((r) => [m.querySelector('h4')?.textContent ?? '', ...r])) };
    }
    const ch = [...card.querySelectorAll('.la-chart')].find((c) => c._csv && !c.closest('[hidden]'));
    return ch?._csv ?? null;
  }
  const cellText = (v) => { const s = v == null ? '' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function download(card) {
    const c = csvOf(card);
    if (!c || !c.rows.length) { alert('Nothing to download yet.'); return; }
    const text = [c.head, ...c.rows].map((r) => r.map(cellText).join(',')).join('\r\n');
    const title = (card.id === 'person' ? P().person : card.querySelector('h2, h3')?.textContent) || 'chart';
    const p = P();
    const when = p.from || p.to ? `${p.from || 'start'}-to-${p.to || 'today'}` : p.year !== 'all' ? p.year : '';
    const name = [title, when].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = `6thla-${name}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function addCsvButtons() {
    for (const card of document.querySelectorAll('.la-card')) {
      if (['builder-form', 'check-form', 'compare-form', 'person'].includes(card.id) || card.querySelector('.mb-csv')) continue;
      if (!card.querySelector('table.la-table, .la-chart, .la-minis')) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-small mb-csv';
      b.textContent = 'Download CSV';
      const tools = card.querySelector('.bd-card-tools, .mb-person-tools, .la-card-head');
      if (tools) tools.append(b);
      else { card.classList.add('mb-has-csv'); card.prepend(b); }
    }
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.mb-csv, .mb-csv-person');
    if (b) download(b.closest('.la-card'));
  });
  dash.onData(() => requestAnimationFrame(addCsvButtons));

  // ---------- links: #person=Name opens that member ----------
  function route() {
    const m = location.hash.match(/^#person=(.+)$/);
    if (!m) return;
    let name;
    try { name = decodeURIComponent(m[1]); } catch { return; }
    showTab('people', false);
    dash.setParams({ person: name });
  }
  window.addEventListener('hashchange', route);
  // Shared with more.js.
  window.LA = { rankOf, rankOrder, withRank, openCompany, coButton, coCell, all, inPeriod, td, pill, emptyRow, tiles, legend, nameButton, openPerson, matchName, weekStreaks, nextMilestone, kindWord, plural, addDays, daysBetween, dayOf, toDate, iso, load, save };
  document.addEventListener('DOMContentLoaded', () => {
    route();
    const open = document.querySelector('.la-page:not([hidden])');
    fitControls(open?.id ?? 'regiment');
    addCsvButtons();
  });
})();
