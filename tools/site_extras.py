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
    "const tabs = ['regiment', 'companies', 'people', 'checks', 'builder'];")
rep('''      <button id="tab-checks" role="tab" data-tab="checks" aria-selected="false">Name checks</button>
''', '''      <button id="tab-checks" role="tab" data-tab="checks" aria-selected="false">Name checks</button>
      <button id="tab-builder" role="tab" data-tab="builder" aria-selected="false">Build a chart</button>
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
# custom charts on the Regiment tab, after the built-in ones
rep('''  </section>

  <section id="companies" class="la-page"''', '''    <div class="bd-saved-section" hidden>
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
      <p>Pick what to show and how to break it down. The year, day and type filters at the top apply here too. Charts you add appear here and at the bottom of the Regiment tab, saved in this browser. Use Copy link to share one.</p>
      <div class="bd-form">
        <label for="bd-measure">Show
          <select id="bd-measure">
            <option value="avg">Average attendance</option>
            <option value="total">Total attendance</option>
            <option value="held">Events and drills held</option>
            <option value="people">Different people</option>
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
          </select>
        </label>
        <label for="bd-split">Split by
          <select id="bd-split">
            <option value="none">Nothing</option>
            <option value="kind">Event or drill</option>
            <option value="company">Company</option>
            <option value="day">Day of the week</option>
          </select>
        </label>
        <label for="bd-type">Chart
          <select id="bd-type">
            <option value="line">Line</option>
            <option value="bars">Bars</option>
            <option value="stacked">Stacked bars</option>
          </select>
        </label>
        <label for="bd-company">Company
          <select id="bd-company"><option value="all">All companies</option></select>
        </label>
        <label for="bd-person">Person
          <input id="bd-person" list="bd-people" placeholder="Anyone" autocomplete="off">
          <datalist id="bd-people"></datalist>
        </label>
        <label for="bd-title" class="bd-wide">Title
          <input id="bd-title" placeholder="Optional">
        </label>
      </div>
      <p class="bd-preview-desc"></p>
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
<footer class="site-foot">Counted from the 6th Louisiana Discord's #attendance and #drill-attendance channels.</footer>
</main>
</body>
</html>
'''
open(sys.argv[2], 'w').write(head + page + foot)
