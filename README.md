# 6th Louisiana attendance

Static site showing attendance for the 6th Louisiana's events and drills, counted from the Discord #attendance and #drill-attendance channels.

- `index.html` – the page (charts, tables, filters)
- `dash-shim.js` – loads the data files and runs the page's charts
- `d3.min.js` – d3 7.9.0, bundled so the site needs no outside scripts
- `data/attendance.json` – one row per name per post: `{post, date, kind, company, name}`
- `data/name-review.json` – names that didn't match exactly one member

To update the numbers, replace the two files in `data/` and push. GitHub Pages republishes on its own.

Currently showing made-up sample data.
