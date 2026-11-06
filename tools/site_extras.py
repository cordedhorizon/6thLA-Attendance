"""Turn the Claude dashboard page into the site's index.html.

Usage: python3 tools/site_extras.py <dashboard-page.html> index.html
Adds the site-only parts: page wrapper, chart chooser, chart builder tab.
"""
import sys

page = open(sys.argv[1]).read().replace('<meta name="dash-one-writer">\n', '')

def rep(old, new):
    global page
    assert page.count(old) == 1, old[:60]
    page = page.replace(old, new)

rep("const tabs = ['regiment', 'companies', 'people', 'checks'];",
    "const tabs = ['regiment', 'companies', 'people', 'recruits', 'results', 'milestones', 'promotions', 'check', 'compare', 'checks', 'builder'];")
rep('''      <button id="tab-people" role="tab" data-tab="people" aria-selected="false">People</button>
''', '''      <button id="tab-people" role="tab" data-tab="people" aria-selected="false">People</button>
      <button id="tab-recruits" role="tab" data-tab="recruits" aria-selected="false">Recruits</button>
      <button id="tab-results" role="tab" data-tab="results" aria-selected="false">Results</button>
      <button id="tab-milestones" role="tab" data-tab="milestones" aria-selected="false">Milestones</button>
      <button id="tab-promotions" role="tab" data-tab="promotions" aria-selected="false">Promotions</button>
      <button id="tab-check" role="tab" data-tab="check" aria-selected="false">Attendance check</button>
      <button id="tab-compare" role="tab" data-tab="compare" aria-selected="false">Compare</button>
''')
# find a member, in the header
rep('''  </header>
''', '''    <div class="mb-find">
      <input id="find-member" type="search" list="all-members" placeholder="Find a member" aria-label="Find a member" autocomplete="off">
      <datalist id="all-members"></datalist>
      <p class="mb-asof" data-draw="mb-asof"></p>
      <p class="mb-asof">Site updated __BUILD__</p>
    </div>
  </header>
''')
# profile extras on the person card
rep('''        <button class="la-close" type="button">Close</button>
''', '''        <div class="mb-person-tools">
          <button class="bd-small mb-copy-person" type="button">Copy link</button>
          <button class="bd-small mb-csv-person" type="button">Download CSV</button>
          <button class="la-close" type="button">Close</button>
        </div>
''')
rep('''      </dl>
      <p>All years and days, whatever is picked above.</p>''', '''      </dl>
      <div class="mb-profile" data-draw="p-extra"></div>
      <p>All years and days, whatever is picked above.</p>''')
rep('''      <button id="tab-checks" role="tab" data-tab="checks" aria-selected="false">Name checks</button>
''', '''      <button id="tab-checks" role="tab" data-tab="checks" aria-selected="false">Name checks</button>
      <button id="tab-builder" role="tab" data-tab="builder" aria-selected="false">Build a chart</button>
''')
rep('''      <select id="year" data-draw="year" data-source="summary" aria-label="Year"></select>
''', '''      <select id="period" aria-label="Period">
        <option value="all">All time</option>
        <option value="7d">Past week</option>
        <option value="1m">Past month</option>
        <option value="3m">Past 3 months</option>
        <option value="6m">Past 6 months</option>
        <option value="1y">Past year</option>
        <option value="ytd">This year so far</option>
        <optgroup label="Calendar year" id="period-years"></optgroup>
        <option value="custom">Pick dates…</option>
      </select>
      <span class="bd-dates" hidden>
        <input type="date" id="from" aria-label="From date">
        <span>to</span>
        <input type="date" id="to" aria-label="To date">
      </span>
      <select id="year" data-draw="year" data-source="summary" aria-label="Year" hidden></select>
''')
rep('''    <div class="la-filters">
''', '''    <div class="la-filters">
      <details class="bd-choose">
        <summary>Choose charts</summary>
        <div class="bd-choose-panel">
          <p>Untick a chart to hide it. Your choice is saved in this browser.</p>
          <div class="bd-choose-list"></div>
          <button type="button" class="bd-small bd-show-all">Show all charts</button>
        </div>
      </details>
''')
# member-focused tabs (site only): recruits, results, milestones, attendance check
rep('''  <section id="checks" class="la-page"''', '''  <section id="recruits" class="la-page" role="tabpanel" aria-labelledby="tab-recruits" hidden>
    <div class="la-tiles" data-draw="rc-tiles"></div>
    <div class="la-card" id="recruit-flow">
      <h2>New recruits by month</h2>
      <p>When each recruit first showed up, and whether they have since chosen a company. Recruits are counted by their first appearance, so the period picked above sets which ones are shown.</p>
      <div class="la-legend" data-draw="rc-legend"></div>
      <div class="la-chart la-short" data-draw="rc-chart"></div>
    </div>
    <div class="la-card" id="recruit-list">
      <h2>Recruits</h2>
      <p>Someone stays a recruit until they choose a company and are listed under it.</p>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Rank</th><th>Name</th><th>First seen</th><th>Status</th><th>Joined</th><th class="la-n">Days to join</th><th class="la-n">Attended in first 30 days</th><th>Last seen</th></tr></thead>
          <tbody data-draw="rc-rows"></tbody>
        </table>
      </div>
    </div>
    <div class="la-card" id="retention">
      <h2>Do new people keep coming?</h2>
      <p>Everyone grouped by when they first attended. At each check-point, the share who attended at least once in the 30 days leading up to it. A dash means that group hasn't reached the check-point yet. People already attending when records begin are left out. This card uses its own dates below, not the period picked above, and remembers them in this browser.</p>
      <div class="bd-form">
        <label for="rt-from">First attended from <input id="rt-from" type="date"></label>
        <label for="rt-to">to <input id="rt-to" type="date"></label>
        <label for="rt-group">Group by
          <select id="rt-group"><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option></select>
        </label>
        <label for="rt-points">Check after (days)
          <input id="rt-points" type="text" inputmode="numeric" value="30, 90, 180" placeholder="30, 90, 180">
        </label>
      </div>
      <div class="la-legend" data-draw="rt-legend"></div>
      <div class="la-chart la-short" data-draw="rt-chart"></div>
      <div class="la-tablebox">
        <table class="la-table mb-retention">
          <thead><tr data-draw="rt-head"></tr></thead>
          <tbody data-draw="rt-rows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="results" class="la-page" role="tabpanel" aria-labelledby="tab-results" hidden>
    <div class="la-tiles" data-draw="rs-tiles"></div>
    <div class="la-grid">
      <div class="la-card" id="win-by-size">
        <h2>Win rate by attendance</h2>
        <p>Events grouped by how many attended. Point at a bar to see how many events are in each group.</p>
        <div class="la-chart la-short" data-draw="rs-bands"></div>
      </div>
      <div class="la-card" id="results-over-time">
        <h2>Results over time</h2>
        <p>Each event's attendance, colored by the result. Click a dot to see who was there.</p>
        <div class="la-legend" data-draw="rs-legend"></div>
        <div class="la-chart la-short" data-draw="rs-dots"></div>
      </div>
    </div>
    <div class="la-card" id="results-list">
      <h2>Every result</h2>
      <p>Scores come from the first line of each #attendance post, read as ours first. Click a row to see who was there.</p>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Date</th><th>Day</th><th>Score</th><th>Result</th><th class="la-n">Attendance</th></tr></thead>
          <tbody data-draw="rs-rows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="promotions" class="la-page" role="tabpanel" aria-labelledby="tab-promotions" hidden>
    <div class="la-tiles" data-draw="pr-tiles"></div>
    <div class="la-card" id="promotions-log">
      <h2>Promotions</h2>
      <p>Every rank change in the period picked above, newest first. A promotion is dated by the first post that lists the new rank. "At least" means the earlier rank started before our records do.</p>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Date</th><th>Rank</th><th>Name</th><th>Promoted to</th><th>From</th><th>Company</th><th class="la-n">Days in previous rank</th><th class="la-n">Attended in previous rank</th></tr></thead>
          <tbody data-draw="pr-rows"></tbody>
        </table>
      </div>
    </div>
    <div class="la-card" id="time-in-rank">
      <h2>Time in rank</h2>
      <p>Members seen in the last 60 days: how long they have held their current rank, and how many events and drills they have attended since. Useful for spotting who may be ready for promotion. "At least" means the rank started before our records do.</p>
      <div class="la-tools">
        <select id="tr-rank" class="mb-select" aria-label="Rank"><option value="">All ranks</option></select>
      </div>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Rank</th><th>Name</th><th>Company</th><th>Rank since</th><th class="la-n">Days in rank</th><th class="la-n">Events since</th><th class="la-n">Drills since</th></tr></thead>
          <tbody data-draw="tr-rows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="milestones" class="la-page" role="tabpanel" aria-labelledby="tab-milestones" hidden>
    <div class="la-grid">
      <div class="la-card" id="milestones-next">
        <h2>Coming up</h2>
        <p>Members seen in the last 60 days who are close to their next milestone.</p>
        <div class="la-tablebox">
          <table class="la-table">
            <thead><tr><th>Rank</th><th>Name</th><th>Company</th><th>Next milestone</th><th class="la-n">To go</th></tr></thead>
            <tbody data-draw="ms-next"></tbody>
          </table>
        </div>
      </div>
      <div class="la-card" id="milestones-reached">
        <h2>Milestones reached</h2>
        <p>In the period picked above, newest first. Milestones are 10, 25, 50, 75, 100 and every 50 after that, for events and drills separately.</p>
        <div class="la-tablebox">
          <table class="la-table">
            <thead><tr><th>Date</th><th>Rank</th><th>Name</th><th>Company</th><th>Milestone</th></tr></thead>
            <tbody data-draw="ms-rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <section id="check" class="la-page" role="tabpanel" aria-labelledby="tab-check" hidden>
    <div class="la-card" id="check-form">
      <h2>Attendance check</h2>
      <p>Find who hasn't been showing up. Pick who to check and how far back to look. Your choices are saved in this browser.</p>
      <div class="bd-form">
        <label for="ab-scope">Who
          <select id="ab-scope">
            <option value="all">Whole regiment</option>
            <option value="companies">Chosen companies</option>
            <option value="people">Chosen people</option>
          </select>
        </label>
        <label for="ab-window">Look back
          <select id="ab-window">
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
            <option value="21">3 weeks</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="custom">Number of days…</option>
          </select>
        </label>
        <label for="ab-days" id="ab-days-wrap" hidden>Days
          <input id="ab-days" type="number" min="1" max="730" value="45">
        </label>
        <label for="ab-kind">Count
          <select id="ab-kind">
            <option value="any">Events and drills</option>
            <option value="event">Events only</option>
            <option value="drill">Drills only</option>
          </select>
        </label>
        <label for="ab-asof">Up to (blank means latest on record)
          <input id="ab-asof" type="date">
        </label>
      </div>
      <div class="mb-checks" id="ab-companies" hidden></div>
      <div class="mb-people" id="ab-people" hidden>
        <div class="mb-people-add">
          <input id="ab-person" list="all-members" placeholder="Type a name" aria-label="Add a person" autocomplete="off">
          <button type="button" class="bd-small" id="ab-add">Add</button>
        </div>
        <div class="mb-chips"></div>
      </div>
      <label class="mb-inline" for="ab-recent"><input type="checkbox" id="ab-recent" checked> Leave out people who hadn't attended in the 6 months before the check</label>
    </div>
    <div class="la-card" id="check-results">
      <h2>Who's missing</h2>
      <p class="mb-summary" data-draw="ab-summary"></p>
      <ul class="mb-key" data-draw="ab-key" aria-label="What the statuses mean"></ul>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Status</th><th>Rank</th><th>Name</th><th>Company</th><th class="la-n">Attended</th><th>Last event</th><th>Last drill</th><th class="la-n">Days since seen</th></tr></thead>
          <tbody data-draw="ab-rows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="checks" class="la-page"''')

# clickable dots on the every-event chart, company pages
rep('Point at a dot to see its date and count.</p>', 'Point at a dot to see its date and count, or click it to see who was there.</p>')
rep('''    <div class="la-card" id="company-table">
      <h2>Companies</h2>''', '''    <div class="la-card" id="company-card" hidden>
      <div class="la-person-head">
        <h3 data-draw="co-name">—</h3>
        <div class="mb-person-tools">
          <button class="bd-small mb-copy-company" type="button">Copy link</button>
          <button class="bd-small mb-close-company" type="button">Close</button>
        </div>
      </div>
      <div class="la-tiles" data-draw="co-tiles"></div>
      <h4 class="mb-h4">Average attendance by month</h4>
      <div class="la-legend" data-draw="co-legend"></div>
      <div class="la-chart la-short" data-draw="co-chart"></div>
      <h4 class="mb-h4">Members</h4>
      <p class="mb-note">Everyone now listed under this company who attended in the period picked above or in the last 90 days. Active means seen in the last 30 days, quiet 31 to 90 days. Counts are for the period picked above.</p>
      <div class="la-tablebox">
        <table class="la-table">
          <thead><tr><th>Rank</th><th>Name</th><th>Status</th><th class="la-n">Events</th><th class="la-n">Drills</th><th>Last seen</th><th class="la-n">Days since seen</th></tr></thead>
          <tbody data-draw="co-rows"></tbody>
        </table>
      </div>
    </div>
    <div class="la-card" id="company-table">
      <h2>Companies</h2>''')
rep('''          <tbody data-draw="company-rows"></tbody>''', '''          <tbody data-draw="company-rows" class="mb-company-rows"></tbody>''')

# compare tab
rep('''  <section id="checks" class="la-page"''', '''  <section id="compare" class="la-page" role="tabpanel" aria-labelledby="tab-compare" hidden>
    <div class="la-card" id="compare-form">
      <h2>Compare</h2>
      <p>Put two members side by side, or the whole regiment or any company over any two stretches of time. For example, B Co against C Co this year, or the regiment now against a year ago.</p>
      <div class="la-seg" id="cmp-mode" role="group" aria-label="What to compare">
        <button type="button" data-mode="people" aria-pressed="true">Two members</button>
        <button type="button" data-mode="periods" aria-pressed="false">Regiment or companies</button>
      </div>
      <div class="bd-form" id="cmp-people">
        <label for="cmp-a">First member
          <input id="cmp-a" list="all-members" placeholder="Type a name" autocomplete="off">
        </label>
        <label for="cmp-b">Second member
          <input id="cmp-b" list="all-members" placeholder="Type a name" autocomplete="off">
        </label>
      </div>
      <div class="bd-form" id="cmp-periods" hidden>
        <label for="cmp-g1">First: who <select id="cmp-g1" class="mb-groups"></select></label>
        <label for="cmp-p1f">from <input id="cmp-p1f" type="date"></label>
        <label for="cmp-p1t">to <input id="cmp-p1t" type="date"></label>
        <label for="cmp-g2" class="mb-row-start">Second: who <select id="cmp-g2" class="mb-groups"></select></label>
        <label for="cmp-p2f">from <input id="cmp-p2f" type="date"></label>
        <label for="cmp-p2t">to <input id="cmp-p2t" type="date"></label>
        <div class="bd-wide mb-quick">
          <span>Quick picks:</span>
          <button type="button" class="bd-small" data-quick="3m">Last 3 months vs the 3 months before</button>
          <button type="button" class="bd-small" data-quick="3my">Last 3 months vs a year earlier</button>
          <button type="button" class="bd-small" data-quick="y">This year so far vs last year</button>
          <button type="button" class="bd-small" data-quick="same">Same dates for both</button>
        </div>
      </div>
    </div>
    <div class="la-card" id="compare-result">
      <h2 data-draw="cmp-title">—</h2>
      <p class="mb-summary" data-draw="cmp-note"></p>
      <div class="la-tablebox">
        <table class="la-table mb-compare">
          <thead><tr data-draw="cmp-head"></tr></thead>
          <tbody data-draw="cmp-rows"></tbody>
        </table>
      </div>
      <h4 class="mb-h4" data-draw="cmp-chart-title"></h4>
      <div class="la-legend" data-draw="cmp-legend"></div>
      <div class="la-chart la-short" data-draw="cmp-chart"></div>
    </div>
  </section>

  <section id="checks" class="la-page"''')

# custom charts on the Regiment tab, after the built-in ones
rep('''  </section>

  <section id="companies" class="la-page"''', '''    <div class="la-card" id="calendar">
      <h2>Attendance by day</h2>
      <p>Each square is a day, darker when more people attended. Days with no event or drill are left pale, and days outside our records are left out. Point at a day for details, or click it to see who was there. Follows the period, day and type picked above.</p>
      <div class="la-chart mb-cal" data-draw="cal"></div>
      <div class="la-legend mb-cal-key" data-draw="cal-key"></div>
    </div>
    <div class="bd-saved-section" hidden>
      <h2 class="bd-section-title">Your charts</h2>
      <div class="la-grid" data-draw="bd-saved"></div>
    </div>
  </section>

  <section id="companies" class="la-page"''')

rep('''</div>

<script>
dash.calc('summary', {''', '''  <section id="builder" class="la-page" role="tabpanel" aria-labelledby="tab-builder" hidden>
    <div class="la-card" id="builder-form">
      <h2>Build a chart</h2>
      <p>Chart almost anything on the site: attendance, first-timers, recruits joining, promotions, milestones and results. Pick what to show and how to break it down, then narrow it with the period and filters below. Charts you add appear here and at the bottom of the Regiment tab, saved in this browser. Use Copy link to share one.</p>
      <div class="bd-form">
        <label for="bd-measure">Show
          <select id="bd-measure">
            <optgroup label="Attendance">
              <option value="avg">Average attendance</option>
              <option value="event">Attendance at each event</option>
              <option value="share">Share of attendance (%)</option>
              <option value="held">Events and drills held</option>
              <option value="people">Different people</option>
              <option value="attended">Times one person attended</option>
            </optgroup>
            <optgroup label="Members">
              <option value="fresh">First-timers</option>
              <option value="joined">Recruits who joined a company</option>
              <option value="promos">Promotions</option>
              <option value="milestones">Milestones reached</option>
            </optgroup>
            <optgroup label="Results">
              <option value="winrate">Event win rate (%)</option>
              <option value="results">Wins and losses</option>
            </optgroup>
          </select>
        </label>
        <label for="bd-x">Across
          <select id="bd-x">
            <option value="post">Each event or drill</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="day">Day of the week</option>
            <option value="company">Company</option>
            <option value="rank">Rank</option>
          </select>
        </label>
        <label for="bd-split">Split by
          <select id="bd-split">
            <option value="none">Nothing</option>
            <option value="kind">Event or drill</option>
            <option value="company">Company</option>
            <option value="day">Day of the week</option>
            <option value="rank">Rank</option>
            <option value="result">Result (win, loss, draw)</option>
          </select>
        </label>
        <label for="bd-type">Chart
          <select id="bd-type">
            <option value="line">Line</option>
            <option value="bars">Bars</option>
            <option value="stacked">Stacked bars</option>
            <option value="dots">Dots</option>
          </select>
        </label>
        <label for="bd-company">Company
          <select id="bd-company"><option value="all">All companies</option></select>
        </label>
        <label for="bd-rank">Rank
          <select id="bd-rank"><option value="all">All ranks</option></select>
        </label>
        <label for="bd-person">Person
          <input id="bd-person" list="bd-people" placeholder="Anyone" autocomplete="off">
          <datalist id="bd-people"></datalist>
        </label>
        <label for="bd-title" class="bd-wide">Title
          <input id="bd-title" placeholder="Optional">
        </label>
      </div>
      <div class="bd-filters-slot"><span class="bd-slot-label">Period and filters</span></div>
      <p class="bd-preview-desc"></p>
      <p class="mb-note bd-measure-note"></p>
      <p class="mb-note bd-pick-tip" hidden>Click a point to see who was at that event or drill.</p>
      <div class="la-legend bd-preview-legend"></div>
      <div class="la-chart" data-draw="bd-preview"></div>
      <div class="bd-actions">
        <button type="button" id="bd-add" class="bd-primary">Add to my charts</button>
        <span class="bd-added" hidden>Added. It's below and on the Regiment tab.</span>
      </div>
    </div>
    <h2 class="bd-section-title">My charts</h2>
    <p class="bd-saved-empty">No charts yet. Build one above and click Add to my charts.</p>
    <div class="la-grid bd-manage" data-draw="bd-saved"></div>
  </section>
</div>

<script>
dash.calc('summary', {''')

head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>6th Louisiana Attendance</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<link rel="stylesheet" href="site.css">
<script src="d3.min.js"></script>
<script src="dash-shim.js"></script>
</head>
<body>
<main class="site">
'''
foot = '''
<script src="builder.js"></script>
<script src="members.js"></script>
<script src="awards.js"></script>
<script src="more.js"></script>
<footer class="site-foot">Counted from the 6th Louisiana Discord's #attendance and #drill-attendance channels.</footer>
</main>
</body>
</html>
'''
# ---- Real Discord data (2026-11-05): more companies, guests, and drills that only posted a headcount ----
# Headcount-only drills arrive as rows with anon: true (no name). They count as held and in attendance,
# never toward a person, a company's people, or first-timers.
REAL = [
 ("const ORDER = ['Field Staff', 'A Co', 'B Co', 'C Co', 'D Co', 'Battery', 'Recruits'];",
  "const ORDER = ['Field Staff', 'A Co', 'B Co', 'C Co', 'D Co', 'E Co', 'F Co', \"D'Aq.F\", 'I Co', 'Battery', 'Recruits', 'Guests'];"),
 ("const companiesIn = (r) => [...new Set(r.map((x) => x.company))]",
  "const companiesIn = (r) => [...new Set(r.filter((x) => x.company !== 'Unlisted').map((x) => x.company))]"),
 ("    for (const r of rs0) { const d = r.first_ever ?? r.date;",
  "    for (const r of rs0) { if (r.anon) continue; const d = r.first_ever ?? r.date;"),
 ("        const names = new Set(rs.map((r) => r.name));\n        const fresh",
  "        const names = new Set(rs.filter((r) => !r.anon).map((r) => r.name));\n        const fresh"),
 ("      for (const r of rs) { if (!by.has(r.company)) by.set(r.company, { n: 0, names: new Set() });",
  "      const named = rs.filter((r) => !r.anon).length;\n      for (const r of rs) { if (r.anon) continue; if (!by.has(r.company)) by.set(r.company, { n: 0, names: new Set() });"),
 ("share: g.n / rs.length, people: g.names.size", "share: g.n / named, people: g.names.size"),
 ("        const key = pk + '|' + r.company;", "        if (r.anon) continue;\n        const key = pk + '|' + r.company;"),
 ("    for (const r of [...rs0].sort((a, b) => a.date.localeCompare(b.date))) {",
  "    for (const r of rs0.filter((x) => !x.anon).sort((a, b) => a.date.localeCompare(b.date))) {"),
 ("        if ((year !== 'all' && r.year !== year) || (day !== 'all' && r.day !== day)) continue;",
  "        if (r.anon || (year !== 'all' && r.year !== year) || (day !== 'all' && r.day !== day)) continue;"),
 ("      const key = r.name + '|' + r.date.slice(0, 7);", "      if (r.anon) continue;\n      const key = r.name + '|' + r.date.slice(0, 7);"),
 ("    for (const r of [...attendance].sort((a, b) => a.date.localeCompare(b.date))) {",
  "    for (const r of attendance.filter((x) => !x.anon).sort((a, b) => a.date.localeCompare(b.date))) {"),
 ('<p class="la-sample"><b>Sample data.</b> Every name and number here is made up to show the layout. Real attendance from #attendance and #drill-attendance replaces it once it has been gathered.</p>',
  '<p class="la-sample">Counted from every post in #attendance (from Dec 2023) and #drill-attendance (from Mar 2024). Eight drills in Mar–Apr 2024 only posted a headcount: they count as held, but not toward anyone\'s own totals. No drills were posted from Jun 2024 to Oct 2025.</p>'),
 ('.la-sample { margin: 0; padding: var(--cds-pad-sm) var(--cds-pad-md); border: 1px dashed var(--color-border-line);',
  '.la-sample { margin: 0; padding: var(--cds-pad-sm) var(--cds-pad-md); border: 1px solid var(--color-border-line);'),
]
for a, b in REAL:
    rep(a, b)

# Stamp each local file with a hash of its contents, so browsers fetch the new copy after every change
# instead of reusing a cached one (GitHub Pages lets browsers cache files for 10 minutes).
import hashlib, os
out = head + page + foot
root = os.path.dirname(os.path.abspath(sys.argv[2]))
for f in ['site.css', 'd3.min.js', 'dash-shim.js', 'builder.js', 'members.js', 'awards.js', 'more.js']:
    v = hashlib.sha1(open(os.path.join(root, f), 'rb').read()).hexdigest()[:8]
    for attr in ('href', 'src'):
        out = out.replace(f'{attr}="{f}"', f'{attr}="{f}?v={v}"')
import datetime
out = out.replace('__BUILD__', datetime.datetime.now(datetime.timezone.utc).strftime('%b %-d, %Y, %H:%M UTC'))
open(sys.argv[2], 'w').write(out)
