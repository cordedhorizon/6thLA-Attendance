// Site-only: Discord roles and awards (a snapshot read from the server), shown on member profiles and an Awards page.
// data/roles.json = { asof, roles: [{ role, group, people }], people: { name: [role index, ...] } }.
// Roles carry no dates, so nothing here follows the period picked above.
(function () {
  const LA = window.LA;
  const GROUPS = ['Medals', 'Ribbons', 'Badges and qualifications', 'Positions and teams'];
  const SHORT = { Medals: 'Medal', Ribbons: 'Ribbon', 'Badges and qualifications': 'Badge', 'Positions and teams': 'Role' };
  let R = null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const asof = () => (R?.asof ? d3.utcFormat('%-d %b %Y')(new Date(R.asof + 'T00:00:00Z')) : 'the last read');
  const held = (name) => (R?.people[name] ?? []).map((i) => R.roles[i]);
  const companyOf = (name) => LA.all()?.people.get(name)?.company ?? null;
  const redraw = () => { for (const n of ['p-awards', 'aw-rows', 'aw-top', 'aw-note']) dash.draw(n); };

  fetch('data/roles.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => { R = j; fillCompanies(); redraw(); })
    .catch((e) => console.error('roles', e));

  function nameLink(name) {
    const b = el('button', 'mb-name', name);
    b.type = 'button';
    b.addEventListener('click', () => LA.openPerson(name));
    return b;
  }

  // ---------- member profile ----------
  const extra = document.querySelector('#person [data-draw="p-extra"]');
  if (extra) {
    const box = el('div', 'mb-profile aw-profile');
    box.dataset.draw = 'p-awards';
    extra.after(box);
  }
  dash.draw('p-awards', (box) => {
    box.replaceChildren();
    const who = dash.params().person;
    if (!R || !who || !LA.all()?.people.has(who)) return;
    const mine = held(who);
    box.append(el('h3', 'aw-head', 'Roles and awards'));
    if (!mine.length) {
      box.append(el('p', 'mb-note', `None on record. Roles come from the Discord server as of ${asof()}; members who have left the server show none.`));
      return;
    }
    const dl = el('dl', 'aw-groups');
    for (const g of GROUPS) {
      const list = mine.filter((r) => r.group === g);
      if (!list.length) continue;
      const row = el('div');
      row.append(el('dt', null, `${g} (${list.length})`));
      const dd = el('dd', 'mb-chips');
      for (const r of list) dd.append(el('span', 'aw-chip aw-' + SHORT[g].toLowerCase(), r.role));
      row.append(dd);
      dl.append(row);
    }
    box.append(dl, el('p', 'mb-note', `From Discord roles as of ${asof()}. Shown in the server's own order.`));
  });

  // ---------- Awards page (under Members) ----------
  const people = document.getElementById('people');
  if (people && !document.getElementById('awards')) {
    const page = el('section', 'la-page');
    page.id = 'awards';
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('aria-labelledby', 'tab-awards');
    page.hidden = true;
    page.innerHTML = `
      <div class="la-card" id="awards-list">
        <h2>Awards and roles</h2>
        <p data-draw="aw-note">Medals, ribbons, badges and positions held by members who appear in attendance, read from the Discord server's roles.</p>
        <div class="la-tools">
          <select id="aw-group" class="mb-select" aria-label="Type"><option value="">All types</option>${GROUPS.map((g) => `<option>${g}</option>`).join('')}</select>
          <select id="aw-co" class="mb-select" aria-label="Company"><option value="">Whole regiment</option></select>
        </div>
        <div class="la-tablebox">
          <table class="la-table aw-table">
            <colgroup><col class="aw-c-role"><col class="aw-c-type"><col class="aw-c-n"><col></colgroup>
            <thead><tr><th>Award or role</th><th>Type</th><th class="la-n">Members</th><th>Who</th></tr></thead>
            <tbody data-draw="aw-rows"></tbody>
          </table>
        </div>
      </div>
      <div class="la-card" id="awards-top">
        <h2>Most decorated</h2>
        <p>Members with at least one medal, ribbon or badge, most first. Positions and teams are not counted.</p>
        <div class="la-tablebox">
          <table class="la-table">
            <thead><tr><th>Rank</th><th>Name</th><th>Company</th><th class="la-n">Medals</th><th class="la-n">Ribbons</th><th class="la-n">Badges</th><th class="la-n">Total</th></tr></thead>
            <tbody data-draw="aw-top"></tbody>
          </table>
        </div>
      </div>`;
    people.after(page);
    if (typeof tabs !== 'undefined' && !tabs.includes('awards')) tabs.push('awards');
    const row = document.querySelector('.la-tabs');
    if (row && !row.querySelector('[data-tab="awards"]')) {
      const b = el('button', null, 'Awards');
      b.id = 'tab-awards';
      b.setAttribute('role', 'tab');
      b.dataset.tab = 'awards';
      b.setAttribute('aria-selected', 'false');
      b.addEventListener('click', () => showTab('awards'));
      row.append(b);
    }
    for (const s of page.querySelectorAll('select')) s.addEventListener('change', () => { dash.draw('aw-rows'); dash.draw('aw-top'); });
  }
  // Roles are a snapshot, so the period and day filters don't apply on this page.
  const prevShowTab = window.showTab;
  window.showTab = function (name, link) {
    prevShowTab(name, link);
    if (name === 'awards') for (const fl of document.querySelectorAll('.la-filters, .la-kinds')) fl.hidden = true;
  };

  function fillCompanies() {
    const s = document.getElementById('aw-co');
    const b = LA.all();
    if (!s || !b || !R || s.options.length > 1) return;
    const cos = new Set();
    for (const n of Object.keys(R.people)) { const c = companyOf(n); if (c) cos.add(c); }
    for (const bat of LA.BATTALIONS) s.append(new Option(LA.battalionLabel(bat), bat));
    for (const c of [...cos].sort()) s.append(new Option(c, c));
  }
  dash.onData(fillCompanies);
  const picked = () => ({ group: document.getElementById('aw-group')?.value ?? '', co: document.getElementById('aw-co')?.value ?? '' });
  const inScope = (name, co) => LA.inGroup(companyOf(name), co);

  dash.draw('aw-note', (p) => {
    if (R) p.textContent = `Medals, ribbons, badges and positions held by members who appear in attendance, from the Discord server's roles as of ${asof()}. Roles carry no dates, so the period picked doesn't change this page. Members who have left the server aren't listed.`;
  });

  // Which "Show all" lists are open, so a redraw (or coming back from a member's card) keeps them open.
  const openLists = new Set();
  dash.draw('aw-rows', (tb) => {
    const box = tb.closest('.la-tablebox');
    const keep = box && [box.scrollTop, box.scrollLeft];
    tb.replaceChildren();
    if (!R || !LA.all()) return LA.emptyRow(tb, 4, 'Loading…');
    const { group, co } = picked();
    const holders = R.roles.map(() => []);
    for (const [name, list] of Object.entries(R.people)) {
      if (!inScope(name, co)) continue;
      for (const i of list) holders[i].push(name);
    }
    let shown = 0;
    R.roles.forEach((r, i) => {
      if (group && r.group !== group) return;
      shown += 1;
      const tr = document.createElement('tr');
      LA.td(tr, r.role);
      LA.td(tr, SHORT[r.group]);
      const n = LA.td(tr, String(holders[i].length), 'la-n');
      n.dataset.v = holders[i].length;
      const who = LA.td(tr, '');
      const names = holders[i].sort((a, b) => a.localeCompare(b));
      if (!names.length) who.textContent = 'Nobody yet';
      else if (names.length <= 8) for (const x of names) who.append(nameLink(x), ' ');
      else {
        const det = el('details', 'mb-more');
        det.open = openLists.has(r.role);
        det.addEventListener('toggle', () => { if (det.open) openLists.add(r.role); else openLists.delete(r.role); });
        det.append(el('summary', null, `Show all ${names.length}`));
        const wrap = el('div', 'aw-names');
        for (const x of names) wrap.append(nameLink(x), ' ');
        det.append(wrap);
        who.append(det);
      }
      tb.append(tr);
    });
    if (!shown) LA.emptyRow(tb, 4, 'Nothing of this type.');
    if (keep) [box.scrollTop, box.scrollLeft] = keep;
  });
  // Opening or closing a list leaves its "Show all" link where it was on screen.
  document.addEventListener('click', (ev) => {
    const sm = ev.target.closest?.('#awards-list .mb-more > summary');
    if (!sm) return;
    const box = sm.closest('.la-tablebox');
    const top = sm.getBoundingClientRect().top;
    requestAnimationFrame(() => {
      const moved = sm.getBoundingClientRect().top - top;
      if (!moved) return;
      if (box) box.scrollTop += moved;
      const left = sm.getBoundingClientRect().top - top;
      if (left) window.scrollBy(0, left);
    });
  });

  dash.draw('aw-top', (tb) => {
    tb.replaceChildren();
    if (!R || !LA.all()) return LA.emptyRow(tb, 7, 'Loading…');
    const { co } = picked();
    const list = [];
    for (const name of Object.keys(R.people)) {
      if (!inScope(name, co)) continue;
      const h = held(name);
      const c = (g) => h.filter((r) => r.group === g).length;
      const x = { name, medals: c('Medals'), ribbons: c('Ribbons'), badges: c('Badges and qualifications') };
      x.total = x.medals + x.ribbons + x.badges;
      if (x.total) list.push(x);
    }
    list.sort((a, b) => b.total - a.total || b.medals - a.medals || a.name.localeCompare(b.name));
    if (!list.length) return LA.emptyRow(tb, 7, 'No medals, ribbons or badges here.');
    for (const x of list) {
      const tr = document.createElement('tr');
      LA.nameButton(tr, x.name);
      LA.coCell(tr, companyOf(x.name));
      for (const k of ['medals', 'ribbons', 'badges', 'total']) { const c = LA.td(tr, String(x[k]), 'la-n'); c.dataset.v = x[k]; }
      tb.append(tr);
    }
  });
})();
