// Stand-in for the Claude dashboard runtime, so the same page runs as a plain static site.
(function () {
  const SOURCES = { attendance: 'data/attendance.json', name_review: 'data/name-review.json' };
  const DEFAULTS = { year: 'all', kind: 'all', day: 'all' };
  const loaded = {};
  const calcs = {};
  const calcCache = {};
  const draws = new Map();
  const listeners = [];
  let params = { ...DEFAULTS };
  let started = false;
  let queued = false;

  // The site's period picker sets from/to; every chart and calculation then sees only that stretch of attendance.
  let rangeKey = '';
  function checkRange() {
    const key = (params.from || '') + '|' + (params.to || '');
    if (key !== rangeKey) { rangeKey = key; for (const k of Object.keys(calcCache)) delete calcCache[k]; }
  }

  function data(id) {
    checkRange();
    if (id === 'attendance' && (params.from || params.to) && loaded[id]?.status === 'ok') {
      if (!calcCache[id]) {
        const f = params.from || '0000', t = params.to || '9999';
        if (!loaded[id].firstEver) {
          loaded[id].firstEver = new Map();
          for (const r of loaded[id].data) { const d = loaded[id].firstEver.get(r.name); if (!d || r.date < d) loaded[id].firstEver.set(r.name, r.date); }
        }
        const first = loaded[id].firstEver;
        // Carry each person's first-ever date so first-timers are counted against all history, not just this period.
        calcCache[id] = { status: 'ok', data: loaded[id].data.filter((r) => r.date >= f && r.date <= t).map((r) => ({ ...r, first_ever: first.get(r.name) })) };
      }
      return calcCache[id];
    }
    if (calcs[id]) {
      if (calcCache[id]) return calcCache[id];
      const ins = calcs[id].inputs.map(data);
      if (ins.some((d) => d.status === 'error')) return { status: 'error', data: [] };
      if (ins.some((d) => d.status !== 'ok')) return { status: 'loading', data: [] };
      try {
        calcCache[id] = { status: 'ok', data: calcs[id].fn(...ins.map((d) => d.data)) };
      } catch (e) {
        console.error(id, e);
        calcCache[id] = { status: 'error', data: [] };
      }
      return calcCache[id];
    }
    return loaded[id] ?? { status: 'loading', data: [] };
  }

  function run(name) {
    const fn = draws.get(name);
    for (const el of document.querySelectorAll(`[data-draw="${CSS.escape(name)}"]`)) {
      if (el.closest('[hidden]')) continue;
      try { fn(el); } catch (e) { console.error(name, e); }
    }
  }

  function render() {
    queued = false;
    for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } }
    for (const name of draws.keys()) run(name);
  }

  function schedule() {
    if (!started || queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  window.dash = {
    colors: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `var(--series-${i})`),
    calc(id, o) { calcs[id] = o; },
    data,
    // Site-only: a source's rows before the period picker filters them.
    raw(id) { return loaded[id] ?? { status: 'loading', data: [] }; },
    onData(fn) { listeners.push(fn); if (started) fn(); },
    draw(name, fn) { if (fn) draws.set(name, fn); else if (started) run(name); },
    params() { return { ...params }; },
    setParams(p) {
      for (const [k, v] of Object.entries(p)) { if (v == null) delete params[k]; else params[k] = v; }
      schedule();
    },
    resetParams() { params = { ...DEFAULTS }; schedule(); },
    setLink(name) { history.replaceState(null, '', '#' + name); },
    refresh() {},
  };

  document.addEventListener('DOMContentLoaded', () => {
    started = true;
    render();
    new MutationObserver((ms) => {
      // Ignore tooltips and other changes inside a drawing, or hovering would redraw the chart.
      if (ms.some((m) => m.oldValue !== m.target.getAttribute('hidden') && !m.target.parentElement?.closest('[data-draw]'))) schedule();
    }).observe(document.body, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true, subtree: true });
    let w = window.innerWidth;
    window.addEventListener('resize', () => { if (window.innerWidth !== w) { w = window.innerWidth; schedule(); } });
    for (const [id, url] of Object.entries(SOURCES)) {
      fetch(url, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((rows) => { loaded[id] = { status: 'ok', data: Array.isArray(rows) ? rows : rows.rows }; })
        .catch((e) => { console.error(id, e); loaded[id] = { status: 'error', data: [] }; })
        .finally(schedule);
    }
  });
})();
