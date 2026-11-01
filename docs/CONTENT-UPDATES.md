# Updating the site when WordPress content changes

The site is generated from a **snapshot** of the WordPress content. Nothing connects the static site to WordPress automatically. When department staff change pages or posts in WordPress, someone runs the procedure below and publishes the result. Every step here is implemented and tested (`npm run test:dataset`, `npm run verify:content`, `npm run verify`, `npm run qa:browser`). None of them writes to WordPress.

Automatic synchronisation is **not implemented**; see "Possible later improvements" at the end.

## What is generated from what

```
WordPress  ──Tools → Export (WXR .xml)──▶  npm run dataset:prepare ──▶ migration/source/public_content.json   (committed)
                                                                            │
                                     npm run import:content ◀────────────────┘
                                            │
                                            ▼
                 src/content/generated/{pages,posts}.json + docs/CONTENT-INVENTORY.md                    (committed)
WordPress uploads ──npm run fetch:media -- --download──▶ public/wp-content/uploads/                     (committed)
                                            │
     npm run build ──▶ dist/ ──▶ npm run verify:content · npm run verify · npm run qa:browser ──▶ GitHub (CI) ──▶ manual deploy
```

- **Edited in WordPress:** pages, posts, and the images and documents they use.
- **Edited in this repository:** menus (`src/config/navigation.ts`), contact details and homepage cards (`src/config/site.ts`), interface wording (`src/i18n/ui.ts`), content decisions such as link corrections, redirects, translation pairs and dead links (`src/config/content-rules.ts`), and text alternatives for informational images (`src/config/image-text.ts`).

## Procedure (about 15 minutes, plus review)

Requirements: the project checked out, Node.js as pinned in `.nvmrc` (22.23.4; any version allowed by `package.json` "engines" works), and `npm ci` run once.

1. **Export from WordPress.** In WordPress: Tools → Export → All content → Download Export File. Save the `.xml` file **outside** the project folder. It contains private pages and drafts, and must never be committed.

2. **Make the filtered dataset.**
   ```bash
   npm run dataset:prepare -- ~/Downloads/bilkentcs.WordPress.2026-12-01.xml
   ```
   This keeps only published pages, posts and navigation records. It removes hidden HTML comments (for example commented-out former staff) and records the provenance in `migration/source/README.md`. It prints how many records were left out and why.

3. **Regenerate the site content.**
   ```bash
   npm run import:content
   ```
   This rewrites `src/content/generated/*.json` and `docs/CONTENT-INVENTORY.md`. Review the change with `git diff --stat` and `git diff src/content/generated/`. Every change should be one the department made.

4. **Copy new images and documents.**
   ```bash
   npm run fetch:media                 # lists referenced files that are missing
   npm run fetch:media -- --download   # copies them read-only from the live site
   ```
   This downloads only files the content references and that are not in the project yet. A file replaced in WordPress under the **same name** is not detected: copy it by hand into `public/wp-content/uploads/` at the same path. If a file is no longer used, `npm run verify:content` fails and names it. Delete it, because it may be unpublished material.

5. **Build and verify.**
   ```bash
   npm run build
   npm run verify:content    # generated content = dataset, media all used and present
   npm run verify            # routes, links, language pairs, word-level parity
   npx playwright install chromium   # once per machine
   npm run qa:browser        # every page at 390 and 1366 px: errors, layout, accessibility
   npm run inventory:assets  # refresh docs/ASSET-INVENTORY.md
   ```
   All four checks must pass. Their reports are in `reports/`.

6. **Handle what the checks report.** Typical cases:

   | Check message | What to do |
   |---|---|
   | A new page or post has no translation pair | If it is the translation of an existing item, link the two in WordPress (Polylang) and export again, or add the pair to `translationOverrides`. |
   | A link has no target, or a dead external link | Fix it in WordPress, or record the decision in `content-rules.ts` (`linkFixes`, `legacyRedirects`, `deadLinks`). |
   | A new image carries information (chart, poster, table) | Add alt text in WordPress, or add a text alternative to `src/config/image-text.ts`. |
   | `text alternative for …, which no page shows` | The image was removed from the content. Delete its entry in `image-text.ts`. |
   | A people page changed structure and a directory check fails | Keep the WordPress layout of one entry per person, separated by a horizontal line (`<hr>`), with "Label: value" lines. |
   | `migration/source/public_content.json`: SHA-256 does not match | The dataset was edited by hand. Regenerate it with step 2. |

7. **Commit and push.**
   ```bash
   git add -A && git commit -m "Content update from WordPress export of 2026-12-01" && git push
   ```
   GitHub Actions repeats all checks on the push (workflow "Verify and deploy").

8. **Publish.** When the checks pass: Actions → Verify and deploy → Run workflow. See `DEPLOYMENT.md`.

Every 3–6 months, also run `npm run links:external` to check the external links. It writes `reports/external-links.md`. Confirmed dead links go to `deadLinks` in `content-rules.ts`, or better, are fixed in WordPress.

## Possible later improvements (not implemented)

Each of these would be new work, and is described only so the department can decide:

- **Scheduled export through the WordPress REST API.** A script could read `/wp-json/wp/v2/pages` and `/wp-json/wp/v2/posts` (published items only) and write the same dataset format. Polylang translation links need Polylang Pro's REST support or a small plugin. A scheduled GitHub Actions job could open a pull request with the result, and the existing checks would gate it. Not built: the REST output (rendered HTML) differs from the export (block markup), and that difference has to be handled and tested first.
- **Editing in the repository instead of WordPress.** People, news and pages could become Markdown or YAML files edited through a Git-based CMS (for example Decap or Sveltia CMS), with WordPress retired. This needs a one-time conversion of the content model.
