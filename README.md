# Bilkent CS Department website

A static rebuild of the [Bilkent University Computer Engineering Department website](https://w3.cs.bilkent.edu.tr/) with Astro, TypeScript and plain CSS, for GitHub Pages. It is completely separate from the production WordPress installation: nothing reads from or writes to WordPress at build time or at run time.

- **Content:** all 67 published pages and 164 posts from the department's WordPress export, at their original URLs, in English and Turkish. Paginated news and announcement archives, 55 redirects for old URLs, RSS feeds, a sitemap and a bilingual 404 page.
- **Design:** a design system in the university's navy and red, with redesigned faculty and student directories, long-form pages with a table of contents, and phone layouts for every page type ([DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)).
- **Media:** the 286 images and documents the content uses, at their original paths, served as responsive WebP ([ASSET-INVENTORY.md](docs/ASSET-INVENTORY.md)).
- **Checked on every push (GitHub Actions):**
  - the generated content against the filtered WordPress dataset, field by field;
  - every route, internal link, language pair and source word of the built site;
  - every page in Chromium at phone and desktop width, including accessibility (WCAG 2.1 AA, and WCAG 2.2 target size).

  The reports for this release are in [docs/verification/](docs/verification/).

Open decisions and content issues to correct in WordPress are in [docs/OPEN-ISSUES.md](docs/OPEN-ISSUES.md). None of them blocks the release.

## Quick start

Requirements: Node.js 22.23.4 as pinned in `.nvmrc` (any version allowed by "engines", `^22.19.0 || >=24.0.0`, works) and npm 10. `npm ci` refuses other versions.

```bash
npm ci
npm run dev        # http://localhost:4321 (the first run also makes the image variants, about a minute)
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Image variants (`media:process`), type check (`astro check`), then every route into `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run verify:content` | Generated content against `migration/source/public_content.json`, field by field (no build needed); every media file used and present; dataset self-test. Fails on stale or hand-edited content |
| `npm run verify` | Check `dist/` against the dataset: routes, live URLs, language pairs, links, word-level content parity, people directories, archives, feeds, text alternatives. Writes `reports/` and exits with an error on any failure |
| `npm run qa:browser` | Load every route in Chromium at 390 px and 1366 px: script errors, failed requests, sideways scrolling, axe-core accessibility at both widths, 15 interaction tests (including images on English and Turkish pages), screenshots. Writes `reports/`. Needs `npx playwright install chromium` once |
| `npm run check:engines` | The Node.js requirement matches every locked package |
| `npm run links:external` | Request every external link once (politely) and report dead ones by priority → `reports/external-links.md` |
| `npm run dataset:prepare -- export.xml` | Make the filtered dataset from a WordPress export (published items only, hidden comments removed) |
| `npm run import:content` | Regenerate `src/content/generated/*.json` and `docs/CONTENT-INVENTORY.md` from `migration/source/public_content.json` |
| `npm run fetch:media` | List media referenced by the content that are missing from `public/`. Add `-- --download` to copy them read-only from the live site |
| `npm run test:dataset` | Self-test of the dataset preparation (WordPress export round trip, filtering) |
| `npm run media:process` | Make responsive WebP variants and face-centred portrait crops (run by `build` and `dev`) |
| `npm run inventory:assets` | Regenerate `docs/ASSET-INVENTORY.md` and `docs/asset-inventory.csv` |

Build settings are environment variables, all optional. The deployment workflow sets them for you:

| Variable | Default | Meaning |
|---|---|---|
| `SITE_URL` | `http://localhost:4321` | Origin of the deployed site, for canonical URLs, the sitemap and feeds |
| `BASE_PATH` | `/` | Path the site is served under: `/<repo>/` for a GitHub Pages project site |
| `PUBLIC_ALLOW_INDEXING` | `false` | `true` only for the production launch; otherwise every page carries `noindex` |

To build exactly as GitHub Pages does for a project site:

```bash
SITE_URL=https://<owner>.github.io BASE_PATH=/<repo>/ npm run build
SITE_URL=https://<owner>.github.io BASE_PATH=/<repo>/ npm run verify
```

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for step-by-step GitHub Pages instructions. In short:

1. Push the project to a GitHub repository.
2. Set **Settings → Pages → Source** to **GitHub Actions**.
3. Run **Actions → Verify and deploy → Run workflow**.

The workflow (`.github/workflows/deploy.yml`, "Verify and deploy") runs every check on each push and pull request. Started by hand, it verifies, builds for the Pages address and publishes. It sets the base path automatically for project sites, `<owner>.github.io` sites and custom domains. Pages carry `noindex` until you run it with **Let search engines index the site** ticked at launch.

## Project layout

```
.github/workflows/deploy.yml   build → verify → GitHub Pages (manual trigger)
migration/
  source/                      filtered content dataset (published items only, hidden comments removed; see its README)
  reference/                   Turkish theme labels and recorded live-site URLs, used by verify
public/wp-content/uploads/     media files at their original WordPress paths
scripts/
  import-wordpress.ts          dataset → src/content/generated/*.json + docs/CONTENT-INVENTORY.md
  prepare-dataset.ts           WordPress export (WXR) → filtered dataset; test-dataset.ts tests it
  verify-content.ts            generated content against the dataset, field by field
  verify-site.ts               checks dist/ against the dataset (independent of the site code)
  check-external-links.ts      external link audit
  check-engines.ts             Node.js requirement against the lockfile
  qa-browser.ts                browser checks, accessibility, interaction tests, screenshots
  fetch-media.ts               read-only copy of referenced media from the live site
  process-media.ts             responsive WebP variants and portrait crops → public/_media/
  asset-inventory.ts           docs/ASSET-INVENTORY.md
src/
  config/                      navigation.ts (menus), site.ts (contact, homepage cards),
                               categories.ts (archives), content-rules.ts (documented content decisions)
  i18n/ui.ts                   interface strings in English and Turkish
  content/generated/           imported pages and posts (generated; do not edit by hand)
  content.config.ts            content collection schema
  lib/
    routes.ts                  route registry: pages, posts, archive pages, redirects, language pairs
    links.ts                   resolves links found in content against the registry
    html/transform.ts          WordPress HTML → published HTML (links, images, e-mail, embeds, tables)
    html/enhance.ts            heading anchors and table of contents for long pages
    html/people.ts             people pages → structured directory entries (every line kept)
    data.ts                    derived data: research areas, profiles, homepage figures
    images.ts                  reads the image manifest for responsive images
    sections.ts                breadcrumbs, section tabs, meta descriptions
  components/                  header, footer, home/, views/ (page, post, archive, redirect),
                               content/ (prose, long-form document, people directory), archive/, layout/
  layouts/BaseLayout.astro     document head, SEO, language alternates
  pages/                       index.astro, tr/index.astro, [...path].astro (all other routes),
                               404.astro, feeds, sitemap.xml.ts, robots.txt.ts
  scripts/                     menus and drawer, directory search and filters, table of contents,
                               e-mail links, click-to-load embeds
  styles/                      tokens.css, base.css, chrome.css, home.css, pages.css, prose.css
docs/                          see below
```

## Documents

| Document | Contents |
|---|---|
| [OPEN-ISSUES.md](docs/OPEN-ISSUES.md) | Approvals needed, and unresolved content, asset, link and translation issues |
| [ASSET-INVENTORY.md](docs/ASSET-INVENTORY.md) | Every media file: type, size, pixels, what it shows, alt text, where it is used (also as CSV) |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Publishing with GitHub Pages, custom domains, launch settings, troubleshooting |
| [CONTENT-UPDATES.md](docs/CONTENT-UPDATES.md) | Step-by-step update procedure when staff change WordPress content |
| [REDIRECTS.md](docs/REDIRECTS.md) | The 55 redirect pages, old URLs a static host cannot redirect, dead links |
| [DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Principles, tokens, components, the image pipeline |
| [MIGRATION.md](docs/MIGRATION.md) | Architecture, what the transformer changes, decisions, verification |
| [CONTENT-INVENTORY.md](docs/CONTENT-INVENTORY.md) | Every route, translation gap and block type in the export (generated) |
| [verification/](docs/verification/) | Reports of this release: content against the dataset, route coverage, links, content parity, browser QA, external links |

## How migrated content is handled

The import never rewrites wording. At build time `src/lib/html/transform.ts` changes markup only, and marks each substitution so that `npm run verify` can report it:

- **Links** resolve against the route registry. Old forms (Turkish pages without `/tr`, renamed slugs, category URLs) point straight to the current page. A link whose target exists nowhere keeps its text without the link, and is listed in the link report.
- **E-mail addresses** keep the live site's anti-harvesting markup. CSS displays them, and a small script turns them into `mailto:` links.
- **Images** keep their original paths and are served as responsive WebP variants.
- **People pages** (faculty, instructors, staff, students, administration, retired faculty) are parsed into directory cards by `src/lib/html/people.ts`, keeping every line of each entry in source order.
- **Embeds** (YouTube, LinkedIn) load only when the reader asks, and the original link is always shown.
- **Commented-out HTML**, which is invisible on the live site, is removed when the dataset is prepared. It is neither published nor stored in the repository.

## Editing

- **Menus:** `src/config/navigation.ts`. Each link has an English and a Turkish label. Internal links are written as the original WordPress paths (`/administrative/`, `/tr/idari/`), never with the deployment base path.
- **Contact details, social links, homepage cards:** `src/config/site.ts`.
- **Interface wording:** `src/i18n/ui.ts`. Strings marked `NEW` did not exist on the old site and need departmental review.
- **Content decisions** (link corrections, old-URL redirects, translation pairs WordPress does not record): `src/config/content-rules.ts`, each with its reason.
- **Pages, posts and media:** these come from WordPress. See [CONTENT-UPDATES.md](docs/CONTENT-UPDATES.md).
- **Text alternatives for informational images** (charts, posters, award photographs): `src/config/image-text.ts`.

Site-wide search is not included in this release; a static search index (for example Pagefind) is a planned post-launch improvement (OPEN-ISSUES U5).

## Licences

Code: written for the department. Fonts: Source Sans 3 and Source Serif 4 (SIL Open Font License 1.1, through Fontsource). Content, photographs and logos belong to Bilkent University and the people shown. See approvals P1 and P3 in [OPEN-ISSUES.md](docs/OPEN-ISSUES.md).
