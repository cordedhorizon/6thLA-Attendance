// Site-only extras: choose which charts show, and build your own charts.
// Runs after the page's own scripts, so it shares their helpers (lineChart, barChart, fmt, P, ...).
(function () {
  const STORE_HIDDEN = 'la-hidden-cards';
  const STORE_MINE = 'la-my-charts';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } };

  const MEASURES = {
    avg: 'Average attendance',
    total: 'Total attendance',
    held: 'Events and drills held',
    people: 'Different people',
  };
  const ACROSS = { post: 'Each event or drill', month: 'Month', quarter: 'Quarter', year: 'Year', day: 'Day of the week', company: 'Company' };
  const SPLITS = { none: 'Nothing', kind: 'Event or drill', company: 'Company', day: 'Day of the week' };
  const TIME = ['month', 'quarter', 'year'];

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
    person: document.getElementById('bd-person'),
    title: document.getElementById('bd-title'),
  };
  const readForm = () => ({
    measure: form.measure.value, x: form.x.value, split: form.split.value, type: form.type.value,
    company: form.company.value, person: form.person.value.trim(), title: form.title.value.trim(),
  });
  function writeForm(cfg) {
    for (const k of ['measure', 'x', 'split', 'type']) if (cfg[k]) form[k].value = cfg[k];
    form.company.dataset.want = cfg.company || 'all';
    form.company.value = cfg.company || 'all';
    form.person.value = cfg.person || '';
    form.title.value = cfg.title || '';
    syncForm();
  }
  function syncForm() {
    const perPost = form.x.value === 'post';
    for (const o of form.measure.options) o.disabled = perPost && o.value !== 'total';
    if (perPost) form.measure.value = 'total';
    form.type.disabled = perPost;
    const lineOk = TIME.includes(form.x.value);
    form.type.querySelector('option[value="line"]').disabled = !lineOk;
    if (!lineOk && form.type.value === 'line') form.type.value = 'bars';
    for (const o of form.split.options) o.disabled = (o.value !== 'none' && o.value === form.x.value) || (perPost && o.value === 'company');
    if (perPost && form.split.value === 'company') form.split.value = 'none';
    if (form.split.value === form.x.value) form.split.value = 'none';
  }

  function describe(cfg) {
    let s = cfg.x === 'post' ? 'Attendance at each event or drill' : `${MEASURES[cfg.measure]} by ${ACROSS[cfg.x].toLowerCase()}`;
    if (cfg.split !== 'none') s += `, split by ${SPLITS[cfg.split].toLowerCase()}`;
    const only = [];
    if (cfg.company && cfg.company !== 'all') only.push(cfg.company);
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
  };
  const sKey = { none: () => 'All', kind: (r) => kindName[r.kind], company: (r) => r.company, day: (r) => r.day };

  function aggregate(cfg) {
    const all = rows('attendance');
    if (!all) return null;
    const p = P();
    const rs = [];
    for (const r0 of all) {
      if (p.year !== 'all' && !r0.date.startsWith(p.year)) continue;
      if (p.kind !== 'all' && r0.kind !== p.kind) continue;
      const day = DAYS[new Date(r0.date + 'T00:00:00Z').getUTCDay()];
      if (p.day !== 'all' && day !== p.day) continue;
      if (cfg.company && cfg.company !== 'all' && r0.company !== cfg.company) continue;
      if (cfg.person && r0.name.toLowerCase() !== cfg.person.toLowerCase()) continue;
      rs.push({ ...r0, day });
    }
    const cells = new Map();
    const xPosts = new Map();
    for (const r of rs) {
      const x = xKey[cfg.x](r), s = sKey[cfg.split](r);
      if (!xPosts.has(x)) xPosts.set(x, new Set());
      xPosts.get(x).add(r.post);
      const k = x + '\u0000' + s;
      if (!cells.has(k)) cells.set(k, { x, s, n: 0, posts: new Set(), names: new Set() });
      const c = cells.get(k);
      c.n += 1; c.posts.add(r.post); c.names.add(r.name);
    }
    const value = (c) => {
      if (cfg.measure === 'total') return c.n;
      if (cfg.measure === 'held') return c.posts.size;
      if (cfg.measure === 'people') return c.names.size;
      const denom = cfg.split === 'company' ? xPosts.get(c.x).size : c.posts.size;
      return Math.round(c.n / denom * 10) / 10;
    };
    if (cfg.x === 'post') {
      const ss = cfg.split === 'kind' ? ['Events', 'Drills'] : cfg.split === 'day' ? DAYS : ['All'];
      const used = ss.filter((s) => [...cells.values()].some((c) => c.s === s));
      const date = new Map(rs.map((r) => [r.post, r]));
      const points = [...cells.values()].map((c) => {
        const r = date.get(c.x);
        const i = used.indexOf(c.s);
        return {
          date: r.date, day: r.day, value: c.n, name: cfg.split === 'none' ? '' : c.s,
          color: cfg.split === 'kind' ? kindColor(c.s === 'Drills' ? 'drill' : 'event') : dash.colors[i % dash.colors.length],
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
      const series = used.map((s, i) => ({ name: s, color: cfg.split === 'kind' ? kindColor(s === 'Drills' ? 'drill' : 'event') : dash.colors[i % dash.colors.length] }));
      return { xs: points, points, series: cfg.split === 'none' ? [] : series };
    }
    let xs = [...new Set([...cells.values()].map((c) => c.x))];
    if (cfg.x === 'day') xs = DAYS.filter((d) => xs.includes(d));
    else if (cfg.x === 'company') xs.sort((a, b) => companyRank(a) - companyRank(b) || a.localeCompare(b));
    else xs.sort();
    if (cfg.x === 'month' && xs.length) xs = monthsBetween(xs[0], xs[xs.length - 1]);
    let ss = [...new Set([...cells.values()].map((c) => c.s))];
    if (cfg.split === 'day') ss = DAYS.filter((d) => ss.includes(d));
    else if (cfg.split === 'company') ss.sort((a, b) => companyRank(a) - companyRank(b) || a.localeCompare(b));
    else if (cfg.split === 'kind') ss = ['Events', 'Drills'].filter((k) => ss.includes(k));
    const color = (s, i) => (cfg.split === 'kind' ? kindColor(s === 'Drills' ? 'drill' : 'event')
      : cfg.split === 'company' ? companyColor(s) : dash.colors[i % dash.colors.length]);
    const series = ss.map((s, i) => ({
      name: cfg.split === 'none' ? MEASURES[cfg.measure] : s,
      color: color(s, i),
      values: new Map([...cells.values()].filter((c) => c.s === s).map((c) => [c.x, value(c)])),
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
    if (!a || !a.xs.length) {
      const m = document.createElement('div');
      m.className = 'la-failed bd-empty';
      m.textContent = 'Nothing matches these choices and the filters above.';
      el.append(m);
      return;
    }
    const opts = {
      height,
      valueFmt: cfg.measure === 'avg' ? one : fmt,
      unit: '',
      decimals: cfg.measure === 'avg',
      stack: cfg.type === 'stacked',
    };
    if (cfg.x === 'post') { postChart(el, a.points, { height }); return; }
    if (cfg.x === 'quarter') { opts.catLabel = qLabel; opts.tipTitle = (q) => `${q.slice(5)} ${q.slice(0, 4)}`; }
    if (cfg.x === 'year') { opts.catLabel = (y) => y; opts.tipTitle = (y) => y; }
    if (cfg.x === 'day') { opts.catLabel = (d, bw) => (bw < 34 ? d.slice(0, 2) : d.slice(0, 3)); opts.tipTitle = (d) => d + 's'; }
    if (cfg.x === 'company') { opts.catLabel = (c) => c; opts.tipTitle = (c) => c; }
    if (cfg.type === 'line' && TIME.includes(cfg.x)) lineChart(el, a.xs, a.series, opts);
    else barChart(el, a.xs, a.series, opts);
  }

  function legendFor(cfg) {
    const lg = document.createElement('div');
    lg.className = 'la-legend';
    const a = aggregate(cfg);
    if (!a || a.series.length < 2) return lg;
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

  let mine = load(STORE_MINE, []);
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
    form[k].addEventListener(k === 'person' || k === 'title' ? 'input' : 'change', () => { syncForm(); dash.draw('bd-preview'); });
  }

  // Company and person choices come from the data.
  let filled = false;
  dash.onData(() => {
    const r = rows('attendance');
    if (!r || filled) return;
    filled = true;
    const want = form.company.dataset.want || 'all';
    form.company.replaceChildren(new Option('All companies', 'all'), ...companiesIn(r).map((c) => new Option(c, c)));
    form.company.value = want;
    const names = [...new Set(r.map((x) => x.name))].sort((a, b) => a.localeCompare(b));
    for (const dl of document.querySelectorAll('#bd-people')) dl.replaceChildren(...names.map((n) => new Option(n)));
  });

  // A shared link opens the builder with that chart loaded.
  function openShared() {
    const m = location.hash.match(/^#chart=(.+)$/);
    if (!m) return;
    try {
      writeForm(JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))));
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
  });
})();
