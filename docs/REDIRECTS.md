# Redirects and old URLs

Every page and post keeps its WordPress URL, so most old links need no redirect. The site also serves **55 redirect pages** for old addresses that WordPress answered with a different page. GitHub Pages cannot send real HTTP redirects. Each redirect page is a small HTML page that forwards visitors at once (`<meta http-equiv="refresh">`), points search engines to the new address with a canonical link, and is marked `noindex`. `npm run verify` checks that every redirect exists and lands on the right page (`docs/verification/route-coverage.md` lists all 55 with their targets).

## The 55 redirect pages

| Kind | Count | Example | Why it is needed |
|---|---:|---|---|
| Turkish pages linked without `/tr` | 34 | `/arastirma-alanlari/` → `/tr/arastirma-alanlari/` | WordPress (Polylang) answers Turkish slugs without the language prefix, and some content and menus link them that way. |
| WordPress category archives | 18 | `/category/news/page/2/` → `/news/page/2/`, `/tr/category/haberler/` → `/tr/haberler/` | The live site's archives live under `/category/…`. The new archives use the shorter paths shown in the menus. Each paginated archive page gets its own redirect. |
| Renamed or moved items | 3 | see below | Observed on the live site on 2026-11-01. |

The three individual redirects (configured in `legacyRedirects`, `src/config/content-rules.ts`):

| Old URL | New URL | Reason |
|---|---|---|
| `/tr/duyurular/lisans-arastirma-olanaklari/` | `/tr/duyurular/lisans-arastirma-olanaklari-bahar-2025/` | WordPress "old slug" redirect. Content links to this URL are not followed, because they mean an earlier semester (OPEN-ISSUES L2). |
| `/en/instructor-position/` | `/instructor-positions/` | Linked from a WordPress navigation record. |
| `/tr/graduate-programs/` | `/graduate-programs/` | The page exists in English only, and WordPress answers the Turkish path with it. |

## Old URLs that a static host cannot redirect

These need rules on a web server (for example the university server, if the site is hosted there). GitHub Pages cannot provide them.

| Old URL | Suggested rule | Note |
|---|---|---|
| `/feed/`, `/tr/feed/`, `/category/<name>/feed/` | 301 to `/rss.xml`, `/tr/rss.xml`, `/<archive>/rss.xml` | RSS readers follow 301 redirects. On GitHub Pages, announce the new feed URLs instead. |
| `/?p=<id>`, `/?page_id=<id>` | 301 to the item's path (the ID is in `src/content/generated/*.json`, field `wpId`) | Query strings are ignored by static hosts, so these all show the homepage. |
| `/wp-admin/`, `/wp-login.php`, `/wp-json/…` | None (404) | WordPress endpoints. They must not be reachable on the public static site. |

## Links in the content that no longer lead anywhere

These are not redirects. The text is kept and shown without a link, marked "The target of this link no longer exists":

- 2 internal links whose target is not in the export (OPEN-ISSUES L1, L2).
- 41 external URLs confirmed gone by two separate checks: the domain no longer exists, or the server answers 404 (`deadLinks` in `src/config/content-rules.ts`, listed in `docs/verification/link-report.md`). Remove an entry once the link is corrected in WordPress.
