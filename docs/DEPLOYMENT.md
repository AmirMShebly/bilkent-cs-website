# Publishing on GitHub Pages

The project builds to plain static files. The workflow `.github/workflows/deploy.yml` ("Verify and deploy") does two things:

- **On every push to `main` and every pull request:** runs all checks. The dataset is compared with the generated content, then the site is built, and routes, links and language pairs are verified word by word. Every page is then loaded in Chromium at 390 px and 1366 px, with accessibility checks. Nothing is published.
- **When you start it by hand:** runs the same checks, then builds for your Pages address and publishes it.

## You need

- A GitHub account or organisation that may create repositories and use GitHub Pages. Pages from a **private** repository needs a paid plan (Pro, Team or Enterprise); a public repository works on any plan.
- On your computer: `git`. To build or test locally, also Node.js 22.23.4 (`.nvmrc`; any version allowed by `package.json` "engines", `^22.19.0 || >=24.0.0`, works) and about 1 GB of free disk space.

## Step 1. Unpack the release

```bash
unzip bilkent-cs-website-release.zip
cd bilkent-cs-website
```

Optional local check, the same one CI runs (about 4 minutes):

```bash
npm ci
npm run check:engines && npm run verify:content
SITE_URL=https://<owner>.github.io BASE_PATH=/<repository>/ npm run build
SITE_URL=https://<owner>.github.io BASE_PATH=/<repository>/ npm run verify
npx playwright install chromium
BASE_PATH=/<repository>/ npm run qa:browser
```

## Step 2. Create the repository on GitHub

On github.com: **+ → New repository**.
- Repository name: for example `bilkent-cs-website`. The site address will be `https://<owner>.github.io/bilkent-cs-website/`.
- Visibility: Public, or Private if your plan allows Pages for private repositories.
- Do **not** add a README, `.gitignore` or licence: the project has its own.

Then press **Create repository**.

## Step 3. Upload the project

In the unpacked `bilkent-cs-website` folder:

```bash
git init -b main
git add .
git status --short | head        # nothing from node_modules/, dist/, public/_media/ or reports/
git commit -m "Bilkent CS website release"
git remote add origin https://github.com/<owner>/<repository>.git
git push -u origin main
```

The upload is about 105 MB, most of it the 286 original media files. The largest file is 12 MB, well below GitHub's 100 MB limit per file, so Git LFS is not needed. (Uploading through the web page instead of `git` is not recommended: the browser accepts at most 100 files at a time.)

The push starts the workflow. Under **Actions**, the run "Verify and deploy" with the job "Content, links, build, browser and accessibility checks" should finish green in about 5 minutes. Its reports are attached to the run as `verification-reports`.

## Step 4. Enable GitHub Pages

In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Nothing else needs to be set there.

## Step 5. Publish

**Actions → Verify and deploy → Run workflow** (branch `main`).
- **Let search engines index the site:** leave it unticked for previews, so every page carries `noindex` and cannot compete with the current site in search results. Tick it only for the production launch.

The run verifies again, builds for the Pages address and publishes. The address appears on the run's summary page and under Settings → Pages:

| Repository | Address | Base path (set automatically) |
|---|---|---|
| `<owner>/<repository>` | `https://<owner>.github.io/<repository>/` | `/<repository>/` |
| `<owner>/<owner>.github.io` | `https://<owner>.github.io/` | `/` |
| Any repository with a custom domain | `https://<domain>/` | `/` |

## Optional

- **Publish on every push to `main`:** in `.github/workflows/deploy.yml`, change the deploy job's condition `if: github.event_name == 'workflow_dispatch'` to `if: github.event_name != 'pull_request'`.
- **Custom domain** (for example `cs.bilkent.edu.tr`): add a file `public/CNAME` containing only the domain, and set the domain under Settings → Pages → Custom domain. Then ask the DNS administrators for a `CNAME` record to `<owner>.github.io`, and tick **Enforce HTTPS**. Old feed and `?p=` URLs need a web server (see `REDIRECTS.md`).
- **Restrict who can publish:** Settings → Environments → `github-pages` → Deployment branches: `main` only (GitHub's default).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| The deploy job fails at "configure-pages" ("Get Pages site failed") | Pages is not enabled with Source: GitHub Actions (step 4), or the plan does not allow Pages for a private repository. |
| The site loads without styles or images | It was built without the base path. Publish through the workflow, which sets it automatically. |
| A verification step fails | Open the `verification-reports` artifact of the run. The failing report names the page and the problem, and nothing was published. `CONTENT-UPDATES.md` explains common fixes. |
| `npm ci` fails with `EBADENGINE` | The Node.js version is not supported. Use the version in `.nvmrc`. |
| Old WordPress URLs return 404 | Only the 55 redirects in `REDIRECTS.md` exist. Feed and `?p=` URLs need a server. |
