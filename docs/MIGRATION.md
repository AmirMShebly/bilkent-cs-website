# Migration: architecture, decisions and status

How the Bilkent CS WordPress site (https://w3.cs.bilkent.edu.tr/) becomes this static Astro site. Companion documents:

- [CONTENT-INVENTORY.md](CONTENT-INVENTORY.md): every route, translation gap and block type in the export (generated).
- [OPEN-ISSUES.md](OPEN-ISSUES.md): unresolved content and asset issues for the department.
- [CONTENT-UPDATES.md](CONTENT-UPDATES.md): how the site stays in sync when staff edit WordPress.
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md): the design system used on every page.
- [ASSET-INVENTORY.md](ASSET-INVENTORY.md): every media file, where it is used and what it shows (generated).
- [DEPLOYMENT.md](DEPLOYMENT.md): publishing with GitHub Pages.
- [verification/](verification/): the route coverage, link, content parity and browser QA reports of the delivered build. `npm run verify` and `npm run qa:browser` regenerate them in `reports/`.

## 1. Static site or WordPress theme

The export's own instructions asked whether the result must stay a WordPress theme. This project is the static option the brief asked for. GitHub Pages cannot run PHP, so anything WordPress does at request time (search, comments, forms, redirects by post ID) is replaced or dropped explicitly. Staff can keep editing in WordPress, with the static site built from it; see CONTENT-UPDATES.md.

## 2. Sources

| Source | Provides | Location |
|---|---|---|
| `public_content.json` (filtered WXR export, 2026‑11‑01; hidden HTML comments removed by `npm run dataset:prepare`) | 67 pages, 164 posts, 3 menus: HTML, language, categories, Polylang groups | `migration/source/` → `src/content/generated/*.json` |
| Public files on the live site (read-only copies) | The 286 media files referenced by the content, templates and menus | `public/wp-content/uploads/` (see ASSET-INVENTORY.md) |
| Live theme script (`var translator = {…}`) | Turkish menu labels and URL mapping, homepage text | `migration/reference/live-theme-translations.json` |
| Read-only checks of the live site | Redirects, archive URLs, feeds | `migration/reference/live-urls.json` |
| Live homepage template | Homepage layout, buttons, footer, social links, brand colours | Transcribed into `src/config/` |

## 3. Architecture

```
migration/source/public_content.json
   │ npm run import:content (scripts/import-wordpress.ts)
   ▼
src/content/generated/{pages,posts}.json ─────────────────────┐
   │ content collections (src/content.config.ts)               │
   ▼                                                           │
src/lib/routes.ts          route registry: pages, posts, archives, redirects, language pairs
src/lib/html/transform.ts  WordPress HTML → published HTML (markup only)
src/lib/html/people.ts     people pages → structured directory entries
src/pages/[...path].astro  every route except the homepages
   │ npm run build                                              │
   ▼                                                           ▼
dist/  ──────────────── npm run verify (scripts/verify-site.ts) ◄─ export + live-urls.json
   └────────────────── npm run qa:browser (scripts/qa-browser.ts)
```

- **URLs are preserved.** Directory output with trailing slashes reproduces every WordPress path. Old forms that WordPress answered (category URLs with `page/N/`, Turkish pages without `/tr`, renamed slugs) get redirect pages. Internal links go through `href()`, so the site works under any base path.
- **Languages.** English at `/`, Turkish under `/tr/`. Polylang groups pair translations, with documented additions in `src/config/content-rules.ts`. Untranslated pages say so in the language switch.
- **Archives.** News, Announcements and Uncategorized per language, 10 posts per page at `<archive>/page/N/`, as WordPress does. RSS per language and per archive.
- **People pages** (16) are parsed into directory entries that keep every source line in order, with search on long lists and filters by research area (faculty) or programme (students).
- **Media.** Content keeps `/wp-content/uploads/…` paths, and all 286 referenced files are in `public/`. `npm run media:process` (part of `npm run build`) makes responsive WebP variants and face-centred square crops, which pages use through `srcset`. Should a file ever be missing, a labelled placeholder appears instead of a broken image.
- **Design.** One design system for every page type (DESIGN-SYSTEM.md): the homepage, page header with section tabs, long-form pages with a table of contents, directories, articles, archives and the 404 page.
- **No third-party requests** until a reader asks: embeds are click-to-load, fonts are self-hosted, and there is no analytics.

## 4. What the transformer changes (and what it never changes)

It never changes wording. It does change:

| Change | Why |
|---|---|
| Links resolved against the route registry; old URLs point to the current page | Working links on the new host |
| Links whose target exists nowhere shown as text (`span.link-unresolved`) | No broken links, no lost text |
| E-mail addresses as `data-user`/`data-domain`, made into links by script | Keeps the live site's anti-harvesting policy |
| Images → responsive WebP `srcset` with the original's size; missing images → labelled placeholders | Fast pages, no layout shift, no broken images |
| A linked image without alt text or link text → the link is named after its target file | The link stays usable with a screen reader |
| YouTube/LinkedIn embeds → click-to-load, with the original URL | Privacy, performance |
| Heading levels start at h2; inline heading font sizes dropped | Correct outline, h1 stays the largest |
| A first table row of short labels becomes the header row; simple tables stack on phones; label columns stay visible | Readable tables |
| Typographic quotes, apostrophes and dashes | As WordPress shows them on the live site |
| HTML comments, scripts, inline event handlers removed | Hidden content stays hidden; nothing executable |
| `lang="en"` on Turkish pages whose body is English; `hreflang` on links to the other language | Accessibility |

## 5. Decisions recorded in `src/config/content-rules.ts`

- One link correction (malformed LinkedIn URL).
- Three redirects confirmed on the live site, plus generated category and Turkish-alias redirects (55 redirect pages in total).
- One old URL that keeps its redirect page but is not followed by content links (it would point at the wrong semester).
- Eleven translation pairs that WordPress does not record (10 news pairs, 1 page pair).
- Three Turkish pages marked as English-language content.
- The 16 pages rendered as people directories.

## 6. Verification

`npm run verify:content` compares `src/content/generated/*.json` with the dataset, field by field, using its own parsing rather than the importer's code. It checks titles, dates, languages, categories, translation groups, body text, links, images and media lists. It also fails on extra or missing items, unexpected fields, hidden comments, a dataset that differs from the one recorded in `migration/source/README.md`, and unused or missing media files. It also runs the importer in `--check` mode, so committed content that is stale or edited by hand fails in CI.

`npm run verify` derives its expectations from the export and from the recorded live URLs, not from the site code:

- **Routes:** every page, post, archive page and redirect exists, with language, title, canonical URL, h1 and description.
- **Live URLs:** every URL observed on the live site still leads to the same content.
- **Language pairs:** the switch and `hreflang` are correct; likely missing pairs are flagged.
- **Links:** all internal links, assets and fragments resolve. Each content link is matched with its source link and must reach the same target, by an independent resolution.
- **Content:** every source word appears in order, with case and diacritics, on the rendered page. Each people directory has one named card per source entry.
- **Archives:** membership, order, page size and pagination.
- **Other:** feeds, excerpts and markup hygiene.

The checks were tested by mutation. Swapping two students' advisors, swapping e-mail addresses between cards, stripping Turkish letters, reversing a page's sections, moving a person's details to another card and retargeting a link each make verification fail.

Parity ignores navigation and anything the design adds (breadcrumbs, section tabs, tables of contents, related posts, research-area links), so additions cannot stand in for missing content.

`npm run qa:browser` loads every route at 390 px and 1366 px in Chromium, with all external requests blocked. It checks for script errors, failed requests, horizontal scrolling, headings larger than the page title, empty photo slots and axe-core WCAG 2.1 A/AA rules. It also runs 13 interaction tests (menus with keyboard and focus trap, directory search and filters, table of contents, e-mail links, embeds, language switch, pagination, 404, and the no-JavaScript fallbacks) and takes screenshots.

Independent reviews checked milestone 2 (11 agents: content batches, site-wide, code, desktop and phone visuals) and the design integration (code and visual review). Their confirmed defects were fixed, and each fix is covered by the checks above.

## 7. Status

| Milestone | State |
|---|---|
| 1. Homepage and navigation | Done |
| 2. All pages and posts, archives, redirects, feeds, verification | Done (this document) |
| 3. Visual redesign | Done: on every page (DESIGN-SYSTEM.md); departmental sign-off pending (OPEN-ISSUES P7) |
| 4. Media migration | Done: 286 files; publication approval pending (OPEN-ISSUES P1) |
| 5. Editing workflow | Proposal in CONTENT-UPDATES.md |
| 6. Launch | Hosting, domain, redirects for feeds and ID URLs, indexing switch |
