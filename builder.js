// Site-only extras: choose which charts show, and build your own charts.
// Runs after the page's own scripts, so it shares their helpers (lineChart, barChart, fmt, P, ...).
(function () {
  const STORE_HIDDEN = 'la-hidden-cards';
  const STORE_MINE = 'la-my-charts';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } };

  const MEASURES = {
    avg: 'Average attendance',
    event: 'Attendance at each event',
    share: 'Share of attendance',
    held: 'Events and drills held',
    people: 'Different people',
    attended: 'Times attended',
    fresh: 'First-timers',
    joined: 'Recruits who joined a company',
    promos: 'Promotions',
    milestones: 'Milestones reached',
    winrate: 'Event win rate',
    results: 'Wins and losses',
  };
  // What each measure counts, shown under the preview.
  const NOTES = {
    avg: 'How many attended a typical event or drill.',
    share: "Each group's part of all attendance in that column, as a percentage.",
    attended: 'Pick a person below. Counts the events and drills they attended.',
    fresh: "People counted on the day of their first appearance in our records.",
    joined: 'Counted on the day a recruit first appears under a company, by the company they joined.',
    promos: 'Counted on the first post that lists the new rank. Rank means the new rank.',
    milestones: 'Each time someone reaches 10, 25, 50, 75, 100 or every 50 after that, counted for events and drills separately.',
    winrate: 'Wins out of events won or lost. Company, rank and person filters don\'t apply, since the regiment plays as one.',
    results: 'Events with a score, split by result. Pick Nothing under Split by to count all scored events.',
  };
  const PERCENT = new Set(['share', 'winrate']);
  const REGIMENT_ONLY = new Set(['winrate', 'results']);
  const ACROSS = { post: 'Each event or drill', month: 'Month', quarter: 'Quarter', year: 'Year', day: 'Day of the week', battalion: 'Battalion', company: 'Company', rank: 'Rank' };
  const SPLITS = { none: 'Nothing', kind: 'Event or drill', battalion: 'Battalion', company: 'Company', day: 'Day of the week', rank: 'Rank', result: 'Result' };
  // Groupings of members, which the whole-regiment measures can't be broken down by.
  const MEMBER_GROUPS = ['battalion', 'company', 'rank'];
  const RESULT_NAMES = { W: 'Won', L: 'Lost', D: 'Drew' };

  // ---------- choose charts ----------
  const cards = () => [...document.querySelectorAll('.la-page > .la-card[id], .la-page > .la-grid > .la-card[id]')]
    .filter((c) => !['person', 'builder-form'].includes(c.id) && c.querySelector('h2'));
  let hidden = new Set(load(STORE_HIDDEN, []));
  function applyHidden() { for (const c of cards()) c.hidden = hidden.has(c.id); }

  function buildChooser() {
    for (const list of document.querySelectorAll('.bd-choose-list')) {
      list.replaceChildren();
      for (const page of document.querySelectorAll('.la-page')) {
        const own = cards().filter((c) => c.closest('.la-page') === page);
        if (!own.length) continue;
        const head = document.createElement('div');
        head.className = 'bd-choose-head';
        head.textContent = document.querySelector(`[data-tab="${page.id}"]`)?.textContent ?? page.id;
        list.append(head);
        for (const c of own) {
          const label = document.createElement('label');
          const box = document.createElement('input');
          box.type = 'checkbox';
          box.id = 'show-' + c.id;
          box.checked = !hidden.has(c.id);
          box.addEventListener('change', () => {
            if (box.checked) hidden.delete(c.id); else hidden.add(c.id);
            save(STORE_HIDDEN, [...hidden]);
            applyHidden();
          });
          label.append(box, document.createTextNode(c.querySelector('h2').textContent));
          list.append(label);
        }
      }
    }
  }
  for (const b of document.querySelectorAll('.bd-show-all')) {
    b.addEventListener('click', () => { hidden = new Set(); save(STORE_HIDDEN, []); applyHidden(); buildChooser(); });
  }

  // ---------- chart builder ----------
  const form = {
    measure: document.getElementById('bd-measure'),
    x: document.getElementById('bd-x'),
    split: document.getElementById('bd-split'),
    type: document.getElementById('bd-type'),
    company: document.getElementById('bd-company'),
    rank: document.getElementById('bd-rank'),
    person: document.getElementById('bd-person'),
    title: document.getElementById('bd-title'),
  };
  const readForm = () => ({
    measure: form.measure.value, x: form.x.value, split: form.split.value, type: form.type.value,
    company: form.company.value, rank: form.rank.value, person: form.person.value.trim(), title: form.title.value.trim(),
  });
  function writeForm(cfg) {
    for (const k of ['measure', 'x', 'split', 'type']) if (cfg[k]) form[k].value = cfg[k];
    form.company.dataset.want = cfg.company || 'all';
    form.company.value = cfg.company || 'all';
    form.rank.dataset.want = cfg.rank || 'all';
    form.rank.value = cfg.rank || 'all';
    form.person.value = cfg.person || '';
    form.title.value = cfg.title || '';
    syncForm();
  }
  for (const [sel, before] of [[form.x, 'company'], [form.split, 'company']]) {
    if (sel && ![...sel.options].some((o) => o.value === 'battalion')) sel.insertBefore(new Option('Battalion', 'battalion'), [...sel.options].find((o) => o.value === before) ?? null);
  }
  // Attendance at each event only makes sense one event at a time, so it and 'Each event or drill' go together.
  // Options that can't go with the current choices stay in the list, greyed out, with the reason after them.
  const baseText = new WeakMap();
  function mark(o, why) {
    if (!baseText.has(o)) baseText.set(o, o.textContent);
    o.disabled = !!why;
    o.textContent = why ? `${baseText.get(o)} (${why})` : baseText.get(o);
    o.title = why || '';
  }
  const label = (sel) => baseText.get(sel.selectedOptions[0]) ?? sel.selectedOptions[0]?.textContent ?? '';
  let changeNotes = [];
  function syncForm(changed) {
    const notes = [];
    const before = { x: form.x.value, split: form.split.value, measure: form.measure.value };
    if (changed === 'measure' && form.measure.value === 'event') form.x.value = 'post';
    if (form.x.value === 'post') form.measure.value = 'event';
    else if (form.measure.value === 'event') form.measure.value = 'avg';
    if (changed === 'measure' && form.measure.value === 'results' && form.split.value === 'none') form.split.value = 'result';
    const m = form.measure.value;
    const team = REGIMENT_ONLY.has(m);
    const mName = MEASURES[m];
    for (const o of form.x.options) mark(o, team && MEMBER_GROUPS.includes(o.value) ? `not with ${mName.toLowerCase()}` : null);
    if (form.x.selectedOptions[0]?.disabled) form.x.value = 'month';
    for (const o of form.split.options) {
      mark(o, o.value !== 'none' && o.value === form.x.value ? 'already used for Across'
        : team && MEMBER_GROUPS.includes(o.value) ? `not with ${mName.toLowerCase()}`
        : null);
    }
    if (form.split.selectedOptions[0]?.disabled) form.split.value = 'none';
    // Filters that a whole-regiment measure ignores are switched off, so it's clear they do nothing.
    for (const k of ['company', 'rank', 'person']) {
      form[k].disabled = team && !(k === 'person' && m === 'attended');
      form[k].title = form[k].disabled ? `${mName} counts the whole regiment, so this filter doesn't apply.` : '';
    }
    const what = { x: 'Across', split: 'Split by', measure: 'Show' };
    for (const k of ['measure', 'x', 'split']) {
      if (k === changed || form[k].value === before[k]) continue;
      const why = k === 'x' && form.x.value === 'post' ? 'attendance at each event is shown one event at a time'
        : k === 'measure' && before.x === 'post' && changed === 'x' ? `${ACROSS.post.toLowerCase()} only goes with attendance at each event`
        : k === 'measure' && form.x.value === 'post' ? 'each event or drill only shows attendance at that event'
        : k === 'x' && team ? `${mName.toLowerCase()} counts the whole regiment, not one group`
        : k === 'split' && before.split === form.x.value ? 'the same thing is already used for Across'
        : k === 'split' && team ? `${mName.toLowerCase()} counts the whole regiment, not one group`
        : k === 'split' && m === 'results' ? 'wins and losses are split by result'
        : null;
      notes.push(`${what[k]} changed to "${label(form[k])}"${why ? ` because ${why}` : ''}.`);
    }
    if (team) notes.push(`${mName} counts the regiment as a whole, so the Company, Rank and Person filters are off and battalion, company and rank are greyed out.`);
    if (form.x.value === 'battalion' || form.split.value === 'battalion') notes.push('Battalions only count A and B Company (1st Battalion) and C and D Company (2nd Battalion).');
    if (changed) changeNotes = notes;
    else changeNotes = notes.filter((n) => !n.includes(' changed to '));
    for (const n of document.querySelectorAll('.bd-measure-note')) n.textContent = NOTES[form.measure.value] ?? '';
    let box = document.querySelector('.bd-conflict');
    const note = document.querySelector('.bd-measure-note');
    if (!box && note) { box = document.createElement('p'); box.className = 'mb-note bd-conflict'; box.setAttribute('role', 'status'); note.after(box); }
    if (box) { box.textContent = changeNotes.join(' '); box.hidden = !changeNotes.length; }
  }

  function describe(cfg) {
    let s = cfg.x === 'post' ? 'Attendance at each event or drill' : `${MEASURES[cfg.measure]} by ${ACROSS[cfg.x].toLowerCase()}`;
    if (cfg.split !== 'none') s += `, split by ${SPLITS[cfg.split].toLowerCase()}`;
    const only = [];
    if (cfg.company && cfg.company !== 'all') only.push(cfg.company);
    if (cfg.rank && cfg.rank !== 'all') only.push(cfg.rank);
    if (cfg.person) only.push(cfg.person);
    if (only.length) s += ` (${only.join(', ')} only)`;
    return s;
  }

  const xKey = {
    post: (r) => r.post,
    month: (r) => r.date.slice(0, 7),
    quarter: (r) => `${r.date.slice(0, 4)}-Q${Math.floor((+r.date.slice(5, 7) - 1) / 3) + 1}`,
    year: (r) => r.date.slice(0, 4),
    day: (r) => r.day,
    company: (r) => r.company,
    battalion: (r) => window.LA.battalionOf(r.company),
    rank: (r) => r.rank || 'No rank',
  };
  const sKey = { none: () => 'All', kind: (r) => kindName[r.kind], company: (r) => r.company, battalion: (r) => window.LA.battalionOf(r.company), day: (r) => r.day, rank: (r) => r.rank || 'No rank', result: (r) => RESULT_NAMES[r.res] ?? 'No score' };
  const scoreOf = (s) => { const m = s ? String(s).match(/^\s*(\d+)\s*[-–:]\s*(\d+)/) : null; return m ? (+m[1] > +m[2] ? 'W' : +m[1] < +m[2] ? 'L' : 'D') : null; };
  const isMilestone = (n) => n === 10 || n === 25 || n === 75 || (n >= 50 && n % 50 === 0);

  // The records each measure counts, from the full history (filters are applied after).
  let recCache = { data: null, by: {} };
  function records(measure) {
    const b = window.LA?.all();
    if (!b) return null;
    if (recCache.data !== b.data) recCache = { data: b.data, by: {} };
    if (recCache.by[measure]) return recCache.by[measure];
    const people = [...b.people.values()];
    let out;
    if (measure === 'fresh') out = people.map((g) => g.rows[0]);
    else if (measure === 'joined') out = people.map((g) => g.rows[0].company === 'Recruits' && g.rows.find((r) => r.company !== 'Recruits')).filter(Boolean);
    else if (measure === 'promos') out = people.flatMap((g) => g.ranks.slice(1).map((x) => g.rows.find((r) => r.date >= x.date && r.rank === x.rank) ?? g.rows.find((r) => r.date >= x.date)));
    else if (measure === 'milestones') {
      out = [];
      for (const g of people) { const n = { event: 0, drill: 0 }; for (const r of g.rows) { n[r.kind] += 1; if (isMilestone(n[r.kind])) out.push(r); } }
    } else if (measure === 'winrate' || measure === 'results') {
      const seen = new Map();
      for (const r of b.data) if (r.kind === 'event' && !seen.has(r.post)) { const res = scoreOf(r.score); if (res) seen.set(r.post, { ...r, res, company: null, name: null, rank: null }); }
      out = [...seen.values()];
    } else out = b.data.map((r) => (r.kind === 'event' ? { ...r, res: scoreOf(r.score) } : r));
    recCache.by[measure] = out;
    return out;
  }

  let postInfo = new Map();
  function aggregate(cfg) {
    const measure = MEASURES[cfg.measure] ? cfg.measure : 'avg';
    if (measure === 'attended' && !cfg.person) return { need: 'Pick a person below to show how often they attended.' };
    const all = records(measure);
    if (!all) return null;
    const team = REGIMENT_ONLY.has(measure);
    const p = P();
    const rs = [];
    for (const r0 of all) {
      if (p.from && r0.date < p.from) continue;
      if (p.to && r0.date > p.to) continue;
      if (p.year !== 'all' && !r0.date.startsWith(p.year)) continue;
      if (p.kind !== 'all' && r0.kind !== p.kind) continue;
      const day = DAYS[new Date(r0.date + 'T00:00:00Z').getUTCDay()];
      if (p.day !== 'all' && day !== p.day) continue;
      if (!team && cfg.company && cfg.company !== 'all' && !window.LA.inGroup(r0.company, cfg.company)) continue;
      if ((cfg.x === 'battalion' || cfg.split === 'battalion') && !window.LA.battalionOf(r0.company)) continue;
      if (!team && cfg.rank && cfg.rank !== 'all' && r0.rank !== cfg.rank) continue;
      if (!team && cfg.person && r0.name.toLowerCase() !== cfg.person.toLowerCase()) continue;
      rs.push({ ...r0, day });
    }
    const cells = new Map();
    const xPosts = new Map();
    const xTotal = new Map();
    for (const r of rs) {
      const x = xKey[cfg.x](r), s = sKey[cfg.split](r);
      if (!xPosts.has(x)) xPosts.set(x, new Set());
      xPosts.get(x).add(r.post);
      const k = x + '\u0000' + s;
      if (!cells.has(k)) cells.set(k, { x, s, n: 0, posts: new Set(), names: new Set(), wins: 0, decided: 0 });
      const c = cells.get(k);
      c.n += 1; c.posts.add(r.post); if (!r.anon) c.names.add(r.name);
      if (r.res === 'W' || r.res === 'L') { c.decided += 1; if (r.res === 'W') c.wins += 1; }
      xTotal.set(x, (xTotal.get(x) ?? 0) + 1);
    }
    const value = (c) => {
      if (measure === 'event') return c.n;
      if (measure === 'held') return c.posts.size;
      if (measure === 'people') return c.names.size;
      if (['attended', 'fresh', 'joined', 'promos', 'milestones', 'results'].includes(measure)) return c.n;
      if (measure === 'share') return Math.round(c.n / xTotal.get(c.x) * 1000) / 10;
      if (measure === 'winrate') return c.decided ? Math.round(c.wins / c.decided * 1000) / 10 : null;
      const denom = cfg.split === 'company' || cfg.split === 'battalion' ? xPosts.get(c.x).size : c.posts.size;
      return Math.round(c.n / denom * 10) / 10;
    };
    let xs = [...new Set([...cells.values()].map((c) => c.x))];
    const byRank = (a, z) => (window.LA?.rankOrder(z) ?? 0) - (window.LA?.rankOrder(a) ?? 0) || a.localeCompare(z);
    if (cfg.x === 'day') xs = DAYS.filter((d) => xs.includes(d));
    else if (cfg.x === 'rank') xs.sort(byRank);
    else if (cfg.x === 'company') xs.sort((a, b) => companyRank(a) - companyRank(b) || a.localeCompare(b));
    else if (cfg.x === 'post') {
      const info = new Map(rs.map((r) => [r.post, r]));
      xs.sort((p, q) => info.get(p).date.localeCompare(info.get(q).date) || p.localeCompare(q));
      postInfo = info;
    } else xs.sort();
    if (cfg.x === 'month' && xs.length) xs = monthsBetween(xs[0], xs[xs.length - 1]);
    let ss = [...new Set([...cells.values()].map((c) => c.s))];
    if (cfg.split === 'day') ss = DAYS.filter((d) => ss.includes(d));
    else if (cfg.split === 'company') ss.sort((a, b) => companyRank(a) - companyRank(b) || a.localeCompare(b));
    else if (cfg.split === 'kind') ss = ['Events', 'Drills'].filter((k) => ss.includes(k));
    else if (cfg.split === 'rank') ss.sort(byRank);
    else if (cfg.split === 'result') ss = ['Won', 'Lost', 'Drew', 'No score'].filter((k) => ss.includes(k));
    const color = (s, i) => (cfg.split === 'kind' ? kindColor(s === 'Drills' ? 'drill' : 'event')
      : cfg.split === 'company' ? companyColor(s)
      : cfg.split === 'result' ? ({ Won: dash.colors[2], Lost: dash.colors[6] }[s] ?? 'var(--cds-chart-muted)')
      : dash.colors[i % dash.colors.length]);
    const series = ss.map((s, i) => ({
      name: cfg.split !== 'none' ? s : cfg.x === 'post' ? 'Attendance' : MEASURES[cfg.measure],
      color: color(s, i),
      values: new Map([...cells.values()].filter((c) => c.s === s).map((c) => [c.x, value(c)]).filter(([, v]) => v != null)),
    }));
    return { xs, series };
  }

  const qLabel = (q) => `${q.slice(5)} ’${q.slice(2, 4)}`;
  function drawCustom(el, cfg, height) {
    el.replaceChildren();
    const st = dash.data('attendance').status;
    el.classList.toggle('dash-skeleton', st === 'loading');
    if (st !== 'ok') return;
    const a = aggregate(cfg);
    if (!a || a.need || !a.xs.length) {
      const m = document.createElement('div');
      m.className = 'la-failed bd-empty';
      m.textContent = a?.need ?? 'Nothing matches these choices and the filters above.';
      el.append(m);
      return;
    }
    const opts = {
      height,
      valueFmt: PERCENT.has(cfg.measure) ? (v) => v + '%' : cfg.measure === 'avg' ? one : fmt,
      unit: '',
      decimals: cfg.measure === 'avg' || PERCENT.has(cfg.measure),
      stack: cfg.type === 'stacked',
      totalLabel: { avg: 'Average attendance', event: 'Attendance', held: 'Events and drills held', people: 'Total', share: 'Total', fresh: 'First-timers', joined: 'Recruits who joined', promos: 'Promotions', milestones: 'Milestones', results: 'Scored events', attended: 'Times attended' }[cfg.measure] ?? 'Total',
    };
    if (cfg.x === 'post') {
      const info = postInfo;
      const firstOfYear = new Set();
      let lastYear = null;
      for (const p of a.xs) { const yr = info.get(p).date.slice(0, 4); if (yr !== lastYear) { firstOfYear.add(p); lastYear = yr; } }
      opts.catLabel = (p) => (firstOfYear.has(p) ? info.get(p).date.slice(0, 4) : null);
      opts.tipTitle = (p) => `${info.get(p).day} ${dayName(info.get(p).date)}`;
      opts.connect = true;
      if (window.laShowPost) {
        opts.onPick = (p) => window.laShowPost(p);
        opts.extra = () => [{ text: 'Click to see who was there' }];
      }
    }
    if (cfg.x === 'quarter') { opts.catLabel = qLabel; opts.tipTitle = (q) => `${q.slice(5)} ${q.slice(0, 4)}`; }
    if (cfg.x === 'year') { opts.catLabel = (y) => y; opts.tipTitle = (y) => y; }
    if (cfg.x === 'day') { opts.catLabel = (d, bw) => (bw < 34 ? d.slice(0, 2) : d.slice(0, 3)); opts.tipTitle = (d) => d + 's'; }
    if (cfg.x === 'company' || cfg.x === 'battalion') { opts.catLabel = (c) => c; opts.tipTitle = (c) => c; }
    if (cfg.type === 'line') lineChart(el, a.xs, a.series, opts);
    else if (cfg.type === 'dots') lineChart(el, a.xs, a.series, { ...opts, dots: true, noLine: true });
    else barChart(el, a.xs, a.series, opts);
  }

  function legendFor(cfg) {
    const lg = document.createElement('div');
    lg.className = 'la-legend';
    const a = aggregate(cfg);
    if (!a || !a.series || a.series.length < 2) return lg;
    for (const s of a.series) {
      const span = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = s.color;
      span.append(i, document.createTextNode(s.name));
      lg.append(span);
    }
    return lg;
  }

  dash.draw('bd-preview', (el) => {
    const cfg = readForm();
    for (const d of document.querySelectorAll('.bd-preview-desc')) d.textContent = describe(cfg);
    for (const l of document.querySelectorAll('.bd-preview-legend')) l.replaceChildren(...legendFor(cfg).childNodes);
    drawCustom(el, cfg, 240);
  });

  const upgrade = (cfg) => (cfg.measure === 'total' ? { ...cfg, measure: cfg.x === 'post' ? 'event' : 'avg' } : cfg);
  let mine = load(STORE_MINE, []).map(upgrade);
  const persist = () => save(STORE_MINE, mine);
  const linkFor = (cfg) => {
    const { id, ...c } = cfg;
    return location.origin + location.pathname + '#chart=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(c)))));
  };

  dash.draw('bd-saved', (el) => {
    el.replaceChildren();
    showSaved();
    const pending = [];
    const manage = el.classList.contains('bd-manage');
    mine.forEach((cfg, idx) => {
      const card = document.createElement('div');
      card.className = 'la-card';
      card.dataset.hideKey = 'saved-' + (cfg.id || idx);
      const head = document.createElement('div');
      head.className = 'bd-card-head';
      const h = document.createElement('h3');
      h.textContent = cfg.title || describe(cfg);
      head.append(h);
      if (manage) {
        const tools = document.createElement('div');
        tools.className = 'bd-card-tools';
        const btn = (text, fn, label) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'bd-small'; b.textContent = text;
          if (label) b.setAttribute('aria-label', label);
          b.addEventListener('click', fn);
          tools.append(b);
        };
        if (idx > 0) btn('↑', () => { [mine[idx - 1], mine[idx]] = [mine[idx], mine[idx - 1]]; persist(); dash.draw('bd-saved'); }, 'Move up');
        btn('Edit', () => { writeForm(cfg); mine.splice(idx, 1); persist(); dash.draw('bd-saved'); dash.draw('bd-preview'); document.getElementById('builder-form').scrollIntoView({ block: 'start' }); });
        btn('Copy link', (ev) => {
          const b = ev.currentTarget;
          const url = linkFor(cfg);
          const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500); };
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
          else window.prompt('Copy this link:', url);
        });
        btn('Remove', () => { mine.splice(idx, 1); persist(); dash.draw('bd-saved'); });
        head.append(tools);
      }
      const p = document.createElement('p');
      p.textContent = describe(cfg);
      const chart = document.createElement('div');
      chart.className = 'la-chart la-short';
      card.append(head, ...(cfg.title ? [p] : []), legendFor(cfg), chart);
      el.append(card);
      pending.push([chart, cfg]);
    });
    // Draw once every card is in place, so each chart is sized to its own column.
    for (const [chart, cfg] of pending) drawCustom(chart, cfg, 200);
  });

  function showSaved() {
    for (const e of document.querySelectorAll('.bd-saved-empty')) e.hidden = mine.length > 0;
    for (const sec of document.querySelectorAll('.bd-saved-section')) sec.hidden = mine.length === 0;
  }
  dash.onData(showSaved);

  for (const b of document.querySelectorAll('#bd-add')) {
    b.addEventListener('click', () => {
      mine.push({ id: Date.now().toString(36), ...readForm() });
      persist();
      form.title.value = '';
      dash.draw('bd-saved');
      for (const n of document.querySelectorAll('.bd-added')) { n.hidden = false; setTimeout(() => { n.hidden = true; }, 2500); }
    });
  }
  for (const k of Object.keys(form)) {
    form[k].addEventListener(k === 'person' || k === 'title' ? 'input' : 'change', () => { syncForm(k); dash.draw('bd-preview'); });
  }

  // Company and person choices come from the data.
  let filled = false;
  dash.onData(() => {
    const r = rows('attendance');
    if (!r || filled) return;
    filled = true;
    const want = form.company.dataset.want || 'all';
    const bn = document.createElement('optgroup'); bn.label = 'Battalions';
    bn.append(...window.LA.BATTALIONS.map((x) => new Option(window.LA.battalionLabel(x), x)));
    const co = document.createElement('optgroup'); co.label = 'Companies';
    co.append(...companiesIn(r).map((c) => new Option(c, c)));
    form.company.replaceChildren(new Option('All companies', 'all'), bn, co);
    form.company.value = want;
    const ranks = [...new Set(r.map((x) => x.rank).filter(Boolean))].sort((a, z) => (window.LA?.rankOrder(z) ?? 0) - (window.LA?.rankOrder(a) ?? 0));
    const wantRank = form.rank.dataset.want || 'all';
    form.rank.replaceChildren(new Option('All ranks', 'all'), ...ranks.map((k) => new Option(k, k)));
    form.rank.value = ranks.includes(wantRank) ? wantRank : 'all';
    const names = [...new Set(r.map((x) => x.name))].sort((a, b) => a.localeCompare(b));
    for (const dl of document.querySelectorAll('#bd-people')) dl.replaceChildren(...names.map((n) => new Option(n)));
  });

  // ---------- period picker ----------
  const period = document.getElementById('period');
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  const iso = (d) => d3.utcFormat('%Y-%m-%d')(d);
  const todayIso = () => { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); };
  function presetRange(v) {
    const t = new Date(todayIso() + 'T00:00:00Z');
    const back = { '7d': d3.utcDay.offset(t, -7), '1m': d3.utcMonth.offset(t, -1), '3m': d3.utcMonth.offset(t, -3), '6m': d3.utcMonth.offset(t, -6), '1y': d3.utcYear.offset(t, -1), ytd: d3.utcYear.floor(t) }[v];
    return back ? [iso(back), iso(t)] : null;
  }
  function choose(v) {
    if (v === 'all') dash.setParams({ period: 'all', year: 'all', from: null, to: null });
    else if (v.startsWith('y:')) dash.setParams({ period: v, year: v.slice(2), from: null, to: null });
    else if (v === 'custom') {
      const p = dash.params();
      const [f, t] = [p.from || fromEl.min || '', p.to || todayIso()];
      dash.setParams({ period: 'custom', year: 'all', from: f || null, to: t || null });
    } else {
      const [f, t] = presetRange(v);
      dash.setParams({ period: v, year: 'all', from: f, to: t });
    }
  }
  if (period) {
    period.addEventListener('change', () => choose(period.value));
    for (const input of [fromEl, toEl]) {
      input.addEventListener('change', () => {
        if (input.value && !input.validity.valid) return;
        let f = fromEl.value || null, t = toEl.value || null;
        if (f && t && f > t) [f, t] = [t, f];
        dash.setParams({ period: 'custom', year: 'all', from: f, to: t });
      });
    }
  }
  let yearsFilled = false;
  dash.onData(() => {
    const p = dash.params();
    if (!period) return;
    const raw = dash.data('attendance');
    if (!yearsFilled && raw.status === 'ok' && !(p.from || p.to)) {
      yearsFilled = true;
      const dates = raw.data.map((r) => r.date);
      const lo = d3.min(dates), hi = d3.max(dates);
      fromEl.min = toEl.min = lo;
      fromEl.max = toEl.max = todayIso() > hi ? todayIso() : hi;
      const years = [...new Set(dates.map((d) => d.slice(0, 4)))].sort().reverse();
      for (const g of document.querySelectorAll('#period-years')) g.replaceChildren(...years.map((y) => new Option(y, 'y:' + y)));
    }
    period.value = p.period || (p.year && p.year !== 'all' ? 'y:' + p.year : 'all');
    for (const d of document.querySelectorAll('.bd-dates')) d.hidden = period.value !== 'custom';
    if (document.activeElement !== fromEl) fromEl.value = p.from || '';
    if (document.activeElement !== toEl) toEl.value = p.to || '';
  });
  const short = (d) => d3.utcFormat('%b %-d, %Y')(new Date(d + 'T00:00:00Z'));
  const PRESET_NAMES = { '7d': 'Past week', '1m': 'Past month', '3m': 'Past 3 months', '6m': 'Past 6 months', '1y': 'Past year', ytd: 'This year so far' };
  dash.draw('period', (el) => {
    const p = P();
    let text;
    if (p.from || p.to) {
      const span = `${p.from ? short(p.from) : 'the start'} to ${p.to ? short(p.to) : 'today'}`;
      text = PRESET_NAMES[p.period] ? `${PRESET_NAMES[p.period]} (${span})` : `From ${span}`;
    } else text = p.year === 'all' ? 'All time' : 'In ' + p.year;
    el.textContent = text + (p.day === 'all' ? '' : ', ' + p.day + 's only');
  });

  // On the Build a chart tab, the period and filters sit inside the builder so it's clear they shape the chart.
  const filters = document.querySelector('.la-filters');
  const filtersHome = filters?.parentElement;
  const slot = document.querySelector('.bd-filters-slot');
  function placeFilters(name) {
    if (!filters || !slot) return;
    if (name === 'builder') { if (filters.parentElement !== slot) slot.append(filters); }
    else if (filters.parentElement !== filtersHome) filtersHome.append(filters);
  }
  const pageShowTab = window.showTab;
  window.showTab = function (name, link) { pageShowTab(name, link); placeFilters(name); };

  // A shared link opens the builder with that chart loaded.
  function openShared() {
    const m = location.hash.match(/^#chart=(.+)$/);
    if (!m) return;
    try {
      writeForm(upgrade(JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))))));
      showTab('builder', false);
    } catch { /* bad link: ignore */ }
  }

  document.addEventListener('click', (ev) => {
    for (const d of document.querySelectorAll('.bd-choose[open]')) if (!d.contains(ev.target)) d.open = false;
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') for (const d of document.querySelectorAll('.bd-choose[open]')) d.open = false;
  });

  document.addEventListener('DOMContentLoaded', () => {
    syncForm();
    applyHidden();
    buildChooser();
    openShared();
    placeFilters(document.getElementById('builder')?.hidden === false ? 'builder' : '');
  });
})();
