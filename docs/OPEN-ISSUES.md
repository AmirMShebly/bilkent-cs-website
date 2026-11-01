# Unresolved issues and approvals

Everything below is reproduced faithfully on the new site: nothing was silently changed or removed. The items are decisions for the department, or corrections to make in WordPress before a later export. None of them blocks the release. The generated reports in `docs/verification/` list every affected URL.

Status: 2026-11-01, built from the WordPress export of the same date.

## 1. Approvals

| # | Item | Status |
|---|---|---|
| P1 | Publishing names, e-mail addresses, offices and photographs of faculty, staff and students, as on the current site, including in the repository. | **Approved** (media publication). |
| P2 | The visual design (`docs/DESIGN-SYSTEM.md`). | **Approved.** |
| P3 | Logos: the Bilkent emblem (header, browser icon) and the ABET logo (homepage card), both copied from the current site. Official vector (SVG) versions would look sharper than the 472 px PNG. | Covered by the media approval; replace with official files when available. |
| P4 | The filtered content dataset `migration/source/public_content.json` in the repository. It holds published pages, posts and navigation records only. Hidden HTML comments, including entries for former staff, are removed (`migration/source/README.md`). | Ready to publish; no hidden or unpublished records remain (checked by `npm run test:dataset`). |
| P5 | 68 interface strings that did not exist on the old site, marked `NEW` in `src/i18n/ui.ts` (for example "Skip to main content", "On this page"), and their Turkish versions. | Review recommended; not blocking. |
| P6 | Figures derived from department pages: homepage counts, and research-area links on faculty cards. Each figure links to its source page. | Review recommended; not blocking. |
| P7 | Hosting, domain and launch: GitHub Pages project site or a custom domain. Run the deployment with "Let search engines index the site" only for the production launch. | Department decision (`docs/DEPLOYMENT.md`). |

## 2. Media and assets

| # | Issue | Where | What is needed |
|---|---|---|---|
| A1 | **Text alternatives for informational images were written for this site.** The source gives 270 of the 286 media files no alt text. For the 32 that carry information, the text alternative is transcribed from the image (`src/config/image-text.ts`): the prerequisite chart, the curriculum tables, the graduate destination charts, the CS Fair posters and banners, the award and sponsor photographs, and the AI panel poster. 25 of them also get a full text version below the image. Some award photographs show names partly hidden behind the people on stage, mainly for CS Fair 2023 and 2024. In the text versions, the letters that cannot be read are shown as "…". The other 238 images are portraits beside the person's name, or photographs explained by the text, and are marked decorative. | `docs/ASSET-INVENTORY.md` (column "Text alternative"); CS Fair 2023–2026 announcements | Complete the partly hidden names (the CS Fair website has the full lists) in `src/config/image-text.ts`. Better still, add alt text and award lists in WordPress. |
| A2 | **Featured images are not in the export.** The live archives show a featured image for each post. The export has no attachment records, so the new site uses the first image in each post. For 10 Turkish news posts these differ, and two featured images (`2023/12/david_banner.jpg`, `2023/11/opc2023.png`) are not referenced anywhere in the export. | `/tr/haberler/` | Export with attachments, or a future REST-based export (`CONTENT-UPDATES.md`, "Possible later improvements"). |
| A3 | **Inconsistent and low-resolution photographs.** Portraits differ in background, framing and resolution (some are under 300 px). The homepage programme cards use 500 px images. The new layout crops portraits to a square around the face automatically. | Directories, homepage | New portraits to one specification (plain background, head and shoulders, at least 1000 px), and current department photography. The pipeline picks up replacements at the same paths. |
| A4 | **Large originals.** News photos are kept at their original size (up to several MB, 70 MB in total) because the content links to the full-size files. Pages load the optimised WebP variants instead. | `public/wp-content/uploads/` | None for launch. Optionally, replace the originals with 2000 px versions to keep the repository small. |

## 3. Content that is inconsistent in the source

| # | Issue | Where |
|---|---|---|
| C1 | The English and Turkish class representative lists differ: 4 people in English and 8 in Turkish. Bora Kafadar is "3rd Year" in English but "1. Sınıf" in Turkish. One list is out of date. | `/undergraduate-students/`, `/tr/lisans-ogrencileri/` |
| C2 | Research-area pages list people who are not in the faculty directory: Shervin Arashloo (4 areas) and Aynur Dayanık (a full-time instructor, listed under "Faculty Members"). They get no research-area link on a faculty card, because they have none. | `/research-areas/ai-and-ml/`, `/computer-vision/`, `/data-science/`, `/theory/`, `/software-engineering/` and their Turkish versions |
| C3 | Probable e-mail typo: `tabak@cs.bilkent.tr` (missing `.edu`). | `/part-time-instructors/`, `/tr/yari-zamanli/` |
| C4 | Some English pages use Turkish labels: "E-posta" and "Tel" on four faculty cards (Dündar, Öğüz, Öner, Sahillioğlu) and "E-posta:" on the English Contact page. The Turkish instructor pages use English labels. On the cards these labels are now read only by screen readers, since icons replace them on screen. | `/faculty-members/`, `/contact/`, `/tr/ogretim-gorevlileri/`, `/tr/yari-zamanli/` |
| C5 | The chair has two office and phone combinations: EA 418, (312) 290-1218 (Administration) and EA 402, (312) 290 15 77 (Faculty Members). Both may be correct (the chair's office and their own office). Please confirm. | `/administrative/`, `/faculty-members/` |
| C6 | İpek Sözen and Sibel Uğurlubilek share the phone number (312) 290 5067. | `/instructors/` |
| C7 | Spelling: "Koordinatorü" vs "Koordinatörü"; "Korpeoğlu" vs "Körpeoğlu"; "Aysegul Dündar" vs "Ayşegül"; "Course Prerequisities" (footer); "Ph.D" vs "Ph.D."; "Recieved" in two news titles and their URLs; `www.bilkent.edu` (missing `.tr`) and `tuba.gov.tr.` in two posts. | `/tr/idari/`, `/research-areas/data-science/`, `/research-areas/computer-graphics/`, footer, `/phd-graduates/`, news |
| C8 | Two different courses share the code CS553 on the AI & ML page. The Security and Privacy page has an empty item under "Courses". | `/research-areas/ai-and-ml/`, `/research-areas/security-and-privacy/` |
| C9 | Three Turkish pages have English bodies: Projects, Publications and Groups. They are marked `lang="en"` so screen readers pronounce them correctly. | `/tr/projeler/`, `/tr/yayinlar/`, `/tr/gruplar/` |
| C10 | The WordPress page source contains commented-out entries for five former part-time instructors. They are invisible on the live site and are **not** in this repository: the dataset preparation removes them. They should also be deleted in WordPress. | `/part-time-instructors/`, `/tr/yari-zamanli/` |
| C11 | The prospective-students card on the English homepage is in Turkish only. It is marked `lang="tr"` and its link carries a "Turkish" badge. | Homepage |
| C12 | CS Fair 2023–2026 each exist twice per language: an announcement and an "Uncategorized" post with different text. | `/announcements/cs-fair-*`, `/uncategorized/cs-fair-*` |
| C13 | Some page titles differ from their menu labels, and both appear in the section tabs and breadcrumbs: "Administrative" vs "Department Administration", "Staff" vs "Administrative Staff", "Undergraduate Class Representatives" vs "Undergraduate Students", and "Mission & Objectives" vs "Mission and Objectives". The Turkish site has the same issue: İdari vs Bölüm İdaresi, Personel vs İdari Personel, Gruplar vs Araştırma Grupları. | Menus, page titles |

## 4. Links

| # | Issue | Where | Decision taken here |
|---|---|---|---|
| L1 | A dead link (it returns 404 on the live site too). | `/tr/universite-adaylarina/` → `/tr/duyurular/lisans-arastirma-olanaklari-2/` | The text is kept and the link removed. |
| L2 | An older "Lisans Araştırma Olanakları" post is missing from the export. WordPress redirects its URL to the Spring 2025 post, which the same list already links. | `/tr/universite-adaylarina/` | Shown without a link. The old URL still redirects for visitors. |
| L3 | A malformed LinkedIn link (missing `https://`). | `/phd-graduates/`, `/tr/doktora-mezunlari/` | Corrected. Please confirm. |
| L4 | 37 empty links (no text) are invisible on the live site. Some look intended, for example the research group names on Groups (asaplab, lira-lab) and CS 470 on Course Homepages. | `docs/verification/link-report.md` › Empty anchors | Not rendered. Restore them in WordPress if wanted. |
| L5 | **External link audit** (`docs/verification/external-links.md`, `npm run links:external`, 2026-11-01). The source has 477 distinct external URLs. 41 were confirmed gone by two separate checks: the domain no longer exists, or the server answers 404. Most are old project, course and personal pages, and a few retired university servers. After those were unlinked, the published site has 436 external URLs: 255 OK, 77 working through a redirect, **0 broken**, and 13 unreachable (server errors, an expired certificate, timeouts; possibly temporary). The other 91 are inconclusive, because the sites refuse automated requests (mostly LinkedIn and some personal pages under `cs.bilkent.edu.tr/~`). | `docs/verification/external-links.md` | The 41 dead links are shown as text without a link (`deadLinks` in `src/config/content-rules.ts`); correct or remove them in WordPress. Check the 13 unreachable ones in a browser. Re-run the audit every few months. |

## 5. Translations

| # | Issue | Decision taken here |
|---|---|---|
| T1 | 10 English/Turkish news pairs are not linked in Polylang (same image, published minutes apart). | Paired in `src/config/content-rules.ts`. Please also link them in WordPress. |
| T2 | The Security and Privacy pages are not linked in Polylang. | Paired the same way. |
| T3 | No translation exists for `/graduate-programs/` (its Turkish version may be private), `/instructor-positions/`, `/tr/arastirma-gorevlisi-alimi/` or `/tr/universite-adaylarina/`, nor for two posts (the agentic-coding news item and "2024 Meslek Seminerleri"). | The language switch says so and goes to the other language's homepage or archive. |

## 6. URLs and features that change at cut-over

| # | Issue | Proposed handling |
|---|---|---|
| U1 | The live RSS feeds (`/feed/`, `/tr/feed/`, `/category/*/feed/`) cannot be served at those URLs on GitHub Pages. The new feeds are at `/rss.xml`, `/tr/rss.xml` and `<archive>/rss.xml`. | Server-level redirects if the site is hosted at the university. Otherwise announce the new feed URLs. |
| U2 | WordPress ID URLs (`/?p=123`, `/?page_id=613`) cannot be redirected by a static host. | A redirect map on the university web server, if old ID links matter. |
| U3 | Some URLs are new. `/tr/duyurular/` did not exist: the live Turkish announcements archive is `/tr/category/duyurular/`, which now redirects there. `/tr/haberler/page/N/` is paginated, whereas the live page lists all 65 posts. The feeds are also new. | Approve. |
| U4 | Some pages are linked from no menu: Services, Publications (the menu points to STARS), Ph.D. Graduates, the Turkish research-assistant call, and Instructor Positions (homepage button only). | Decide whether to add them to menus or retire them. |
| U5 | There is no site search: WordPress search is not available on a static site. | **Post-launch improvement.** A static search index (for example Pagefind) can be added at build time without a server. It was left out of this release to keep the release stable. |

## 7. Resolved in the release preparation

- **Media migrated:** all 286 referenced files are in the repository at their original paths, and none is missing or unused (`npm run verify:content`).
- **Design:** used on every page; 0 axe-core violations (WCAG 2.1 A/AA and WCAG 2.2 target size) at 390 px and 1366 px.
- **Node.js requirement:** "engines" now matches every locked package (`^22.19.0 || >=24.0.0`; the version pinned in `.nvmrc` is 22.23.4). `npm ci` refuses unsupported versions (`.npmrc`), and `npm run check:engines` guards this in CI.
- **Generated content:** CI fails when it is stale or inconsistent with the dataset (`npm run verify:content`).
- **Browser checks:** phone and desktop accessibility checks now run in CI on every push and pull request.
- **Dead links:** 41 dead external links are no longer clickable. The redirects are documented in `docs/REDIRECTS.md`.
- **Text alternatives:** written for informational images (A1).
- **Copyright year:** the footer shows the year the site is built, instead of a fixed 2025.
- **Hidden records:** hidden and obsolete personnel records were removed from the dataset and from the generated files.
- **Security advisories:** `npm audit` reports 0 vulnerabilities (Astro 7.3.8, sharp 0.35.5).

## 8. At launch (checklist)

1. Decide the hosting and domain (P7). For a custom domain, set up the server-level redirects in `docs/REDIRECTS.md` if the site is not on GitHub Pages.
2. Push to GitHub and enable Pages (`docs/DEPLOYMENT.md`). Check that the "Verify and deploy" run on `main` passes.
3. Run the deployment by hand, with indexing enabled only for the production launch.
4. Afterwards, keep content current with `docs/CONTENT-UPDATES.md`, and correct the source issues in sections 2–5 in WordPress.
