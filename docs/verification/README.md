# Verification reports of the release

Snapshot of the reports for the release of 2026-11-01. They were produced with Node.js 22.23.4 and Astro 7.3.8 by the commands below. Running the commands again writes fresh copies to `reports/`. The release was also tested end to end from the ZIP extracted into an empty directory: built for a GitHub Pages project site (`/bilkent-cs-website/`) and for a custom domain (`/`).

| Report | Command | Contents |
|---|---|---|
| [content-source.md](content-source.md) | `npm run verify:content` | Generated content against the filtered dataset, field by field; media files all used and present |
| [route-coverage.md](route-coverage.md) | `npm run verify` | Every expected route (pages, posts, archive pages, 55 redirects), live-site URLs, language pairs |
| [link-report.md](link-report.md) | `npm run verify` | Internal links, link targets against the source, unresolved and dead links, corrected links, empty anchors |
| [content-parity.md](content-parity.md) | `npm run verify` | Word-by-word parity of every page and post, people directories, excerpts, missing images, markup and text-alternative checks |
| [browser-qa.md](browser-qa.md) | `npm run qa:browser` | 250 pages at 390 px and 1366 px: loads, sideways scrolling, axe-core accessibility at both widths, 15 interaction tests |
| [external-links.md](external-links.md) | `npm run links:external` | Every external link requested once, grouped by priority |
