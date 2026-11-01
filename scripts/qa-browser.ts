/**
 * Browser checks of the built site at phone and desktop widths:
 *   - every route loads without script errors or failed local requests,
 *   - no page scrolls horizontally,
 *   - axe-core accessibility rules (WCAG 2.1 A/AA, plus WCAG 2.2 AA target size
 *     for touch) at phone and desktop width,
 *   - every image loads on representative English and Turkish pages,
 *   - interaction tests (menus, directory search and filters, table of contents,
 *     e-mail links, embeds, pagination, language switch, no-JavaScript fallbacks),
 *   - screenshots of representative pages.
 *
 *   npm run qa:browser            # after npm run build
 *
 * The site is served from dist/ by a local server. All requests to other
 * hosts are blocked, so nothing reaches the live site or third parties.
 * Uses the Chromium build installed for Playwright (npx playwright install chromium).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, relative, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const SHOTS = join(REPORTS, 'screenshots');
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const PORT = Number(process.env.QA_PORT ?? 4330);
const ORIGIN = `http://localhost:${PORT}`;
const CONCURRENCY = 6;
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1366, height: 900 },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

/** Pages captured as screenshots: [file name, path, full-page height limit]. */
const SCREENSHOTS: Array<[string, string]> = [
  ['home-en', '/'],
  ['home-tr', '/tr/'],
  ['news-archive', '/news/'],
  ['news-archive-page-2', '/news/page/2/'],
  ['haberler-archive', '/tr/haberler/'],
  ['announcements-archive', '/announcements/'],
  ['post-with-table', '/announcements/undergraduate-research-opportunities-spring-2026/'],
  ['post-with-video', '/announcements/cs-fair-2025-3/'],
  ['post-tr', '/tr/haberler/prof-dr-mohammad-mahmoodyye-tubitak-2232-proje-destegi/'],
  ['faculty-members', '/faculty-members/'],
  ['ogretim-uyeleri', '/tr/ogretim-uyeleri/'],
  ['graduate-students', '/graduate-students/'],
  ['administrative', '/administrative/'],
  ['staff', '/staff/'],
  ['part-time-instructors', '/part-time-instructors/'],
  ['undergraduate-students', '/undergraduate-students/'],
  ['retired-faculty', '/retired-faculty-members/'],
  ['research-areas', '/research-areas/'],
  ['research-area-ai', '/research-areas/ai-and-ml/'],
  ['course-homepages', '/course-homepages/'],
  ['projects', '/projects/'],
  ['enrollment-data', '/enrollment-and-graduation-data/'],
  ['mission', '/mission-and-objectives/'],
  ['universite-adaylarina', '/tr/universite-adaylarina/'],
  ['phd-graduates', '/phd-graduates/'],
  ['contact', '/contact/'],
  ['not-found', '/this-page-does-not-exist/'],
];
const FULL_PAGE_MAX = 4000;

// ---------------------------------------------------------------- static server
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

function serve() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', ORIGIN);
    let path = decodeURIComponent(url.pathname);
    // Like GitHub Pages, only paths under the base path exist.
    const inside = BASE === '/' || path.startsWith(BASE);
    if (BASE !== '/' && inside) path = path.slice(BASE.length - 1);
    let file = join(DIST, path, path.endsWith('/') ? 'index.html' : '');
    let status = 200;
    if (!inside || !file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(DIST, '404.html');
      status = 404;
    }
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  }).listen(PORT);
}

// ---------------------------------------------------------------- routes
function listRoutes(dir = DIST): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listRoutes(full);
    if (name !== 'index.html') return [];
    if (/http-equiv="refresh"/.test(readFileSync(full, 'utf8'))) return [];
    return [`/${relative(DIST, dir).split('\\').join('/')}${dir === DIST ? '' : '/'}`.replace('//', '/')];
  });
}

const url = (path: string) => `${ORIGIN}${BASE === '/' ? path : `${BASE.slice(0, -1)}${path}`}`;

// ---------------------------------------------------------------- checks
interface PageResult {
  path: string;
  viewport: ViewportName;
  status: number;
  errors: string[];
  failedRequests: string[];
  overflow: number;
  offenders: string[];
  /** Headings rendered larger than the page title. */
  inverted: string[];
  /** Tables wider than their scroll box (informational). */
  scrollTables: string[];
  emptyPhotos: number;
  axe?: Array<{ id: string; impact: string; help: string; nodes: number; target: string }>;
}

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function blockExternal(page: Page): Promise<void> {
  await page.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort('blockedbyclient')));
}

async function checkPage(browser: Browser, path: string, viewport: ViewportName): Promise<PageResult> {
  const page = await browser.newPage({ viewport: VIEWPORTS[viewport] });
  await blockExternal(page);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(ORIGIN) && r.status() >= 400 && r.url() !== url(path)) failedRequests.push(`${r.status()} ${r.url()}`);
  });
  const response = await page.goto(url(path), { waitUntil: 'load' });
  const { overflow, offenders, inverted, scrollTables, emptyPhotos } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const rect = el.getBoundingClientRect();
      // Boxes past the right edge, or text that overflows its own box.
      const textOverflow = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && rect.right + (el.scrollWidth - el.clientWidth) > width + 1;
      if ((rect.right <= width + 1 && !textOverflow) || rect.width === 0) continue;
      if (el.closest('.table-scroll, .filters, .subnav, .visually-hidden, .skip, [hidden]')) continue;
      const desc = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList.length ? `.${[...el.classList].join('.')}` : ''}`;
      found.push(`${desc} (right ${Math.round(rect.right)}px)`);
      if (found.length >= 5) break;
    }
    const h1 = document.querySelector('main h1');
    const h1Size = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    const inverted = [...document.querySelectorAll<HTMLElement>('main :is(h2, h3, h4)')]
      .filter((h) => parseFloat(getComputedStyle(h).fontSize) > h1Size + 0.5)
      .map((h) => `${h.tagName.toLowerCase()} "${(h.textContent ?? '').trim().slice(0, 40)}" ${getComputedStyle(h).fontSize} > h1 ${h1Size}px`);
    const scrollTables = [...document.querySelectorAll<HTMLElement>('.table-scroll')]
      .filter((t) => t.scrollWidth > t.clientWidth + 1)
      .map((t) => {
        const first = t.querySelector('td, th');
        const sticky = first ? getComputedStyle(first).position === 'sticky' : false;
        return `${t.scrollWidth}px in ${t.clientWidth}px${sticky ? ', first column sticky' : ', no sticky column'}`;
      });
    const emptyPhotos = [...document.querySelectorAll('.person__photo')].filter((p) => !p.children.length).length;
    return { overflow: document.documentElement.scrollWidth - width, offenders: found, inverted, scrollTables, emptyPhotos };
  });
  let axe: PageResult['axe'];
  {
    await page.addScriptTag({ content: AXE_SOURCE });
    const result = await page.evaluate(async () => {
      // @ts-expect-error axe is injected above
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return r.violations.map((v: { id: string; impact: string; help: string; nodes: Array<{ target: string[] }> }) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        target: String(v.nodes[0]?.target ?? ''),
      }));
    });
    axe = result;
  }
  await page.close();
  return { path, viewport, status: response?.status() ?? 0, errors, failedRequests, overflow, offenders, inverted, scrollTables, emptyPhotos, axe };
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- interaction tests
interface TestResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function interactionTests(browser: Browser): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const test = async (name: string, viewport: ViewportName, path: string, fn: (page: Page) => Promise<string>) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[viewport] });
    await blockExternal(page);
    try {
      await page.goto(url(path), { waitUntil: 'load' });
      results.push({ name, ok: true, detail: await fn(page) });
    } catch (error) {
      results.push({ name, ok: false, detail: (error as Error).message.split('\n')[0]! });
    } finally {
      await page.close();
    }
  };
  const assert = (cond: unknown, message: string) => {
    if (!cond) throw new Error(message);
  };

  await test('Phone menu opens, expands a group and closes with Escape', 'mobile', '/', async (page) => {
    assert(!(await page.locator('#drawer').isVisible()), 'drawer visible before opening');
    await page.click('[data-drawer-open]');
    assert(await page.locator('#drawer').isVisible(), 'drawer not visible');
    await page.locator('#drawer [data-accordion]').first().click();
    const link = page.locator('#drawer-0 a').first();
    assert(await link.isVisible(), 'group link not visible');
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#drawer').isVisible()), 'drawer still visible after Escape');
    const focused = await page.evaluate(() => document.activeElement?.hasAttribute('data-drawer-open'));
    assert(focused, 'focus did not return to the menu button');
    return `first link: ${(await link.textContent())?.trim()}; Escape closes and returns focus`;
  });
  await test('Phone menu keeps keyboard focus inside', 'mobile', '/', async (page) => {
    await page.click('[data-drawer-open]');
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('#drawer')));
    assert(inside, 'focus left the open drawer');
    return 'focus stays in the drawer after 40 Tab presses';
  });
  await test('Desktop menu panel opens with keyboard and closes with Escape', 'desktop', '/', async (page) => {
    const toggle = page.locator('.nav [data-mega-toggle]').first();
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert((await toggle.getAttribute('aria-expanded')) === 'true', 'not expanded after Enter');
    assert(await page.locator('#mega-0').isVisible(), 'panel not visible');
    await page.keyboard.press('Escape');
    assert((await toggle.getAttribute('aria-expanded')) === 'false', 'not collapsed after Escape');
    assert(!(await page.locator('#mega-0').isVisible()), 'panel still visible');
    return 'expanded on Enter, collapsed on Escape';
  });
  await test('Graduate students: search and program filter', 'desktop', '/graduate-students/', async (page) => {
    const total = await page.locator('[data-person]').count();
    await page.fill('#directory-search', 'tuzun');
    const shown = await page.locator('[data-person]:visible').count();
    assert(shown > 0 && shown < total, `search showed ${shown} of ${total}`);
    await page.fill('#directory-search', 'zzzz-no-match');
    assert(await page.locator('[data-directory-empty]').isVisible(), 'no-match message hidden');
    await page.fill('#directory-search', '');
    await page.locator('.filters .chip').nth(1).click();
    const program = await page.locator('[data-person]:visible').count();
    assert(program > 0 && program < total, `program filter showed ${program} of ${total}`);
    return `${total} people; "tuzun" shows ${shown}; first program filter shows ${program}`;
  });
  await test('Faculty: research-area filter', 'desktop', '/faculty-members/', async (page) => {
    const total = await page.locator('[data-person]').count();
    const chip = page.locator('.filters .chip').nth(1);
    await chip.click();
    const shown = await page.locator('[data-person]:visible').count();
    assert((await chip.getAttribute('aria-pressed')) === 'true', 'chip not pressed');
    assert(shown > 0 && shown < total, `area filter showed ${shown} of ${total}`);
    return `"${(await chip.textContent())?.trim()}" shows ${shown} of ${total}`;
  });
  await test('Table of contents links to sections', 'desktop', '/mission-and-objectives/', async (page) => {
    const link = page.locator('.toc--side a').nth(1);
    const target = (await link.getAttribute('href')) ?? '';
    await link.click();
    assert(page.url().endsWith(target), `URL ${page.url()} does not end with ${target}`);
    const visible = await page.locator(target).evaluate((h) => h.getBoundingClientRect().top >= 0 && h.getBoundingClientRect().top < window.innerHeight);
    assert(visible, 'heading not in view (hidden under the sticky header?)');
    return `${target} in view`;
  });
  await test('E-mail addresses become mailto links', 'desktop', '/faculty-members/', async (page) => {
    const n = await page.locator('main a[href^="mailto:"]').count();
    assert(n >= 20, `only ${n} mailto links`);
    return `${n} mailto links`;
  });
  await test('Video embed loads only on request', 'desktop', '/announcements/cs-fair-2025-3/', async (page) => {
    assert((await page.locator('main iframe').count()) === 0, 'iframe present before click');
    await page.click('.embed__load');
    const src = await page.locator('main iframe').getAttribute('src');
    assert(src?.startsWith('https://www.youtube-nocookie.com/embed/'), `iframe src ${src}`);
    return `iframe ${src} (request blocked in QA)`;
  });
  await test('Language switcher goes to the translation', 'desktop', '/administrative/', async (page) => {
    const href = await page.locator('.utility a.langswitch').getAttribute('href');
    assert(href?.endsWith('/tr/idari/'), `switcher → ${href}`);
    return `switcher → ${href}`;
  });
  await test('News archive paginates', 'desktop', '/news/', async (page) => {
    const pages = await page.locator('.pagination a.pagination__page').count();
    await page.click('.pagination a[rel="next"]');
    assert(page.url().endsWith('/news/page/2/'), `next → ${page.url()}`);
    return `${pages} pages; next → /news/page/2/`;
  });
  await test('Unknown URL shows the 404 page', 'desktop', '/no-such-page/', async (page) => {
    const h1 = await page.locator('h1').textContent();
    assert(/not found/i.test(h1 ?? ''), `h1 "${h1}"`);
    return `h1 "${h1}"`;
  });
  await test('E-mail addresses are visible without JavaScript', 'desktop', '/faculty-members/', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await blockExternal(page);
    await page.goto(url('/faculty-members/'));
    const content = await page.locator('span.email').first().evaluate((el) => getComputedStyle(el, '::before').content);
    await context.close();
    assert(content && content !== 'none' && content !== 'normal', `::before content ${content}`);
    return `::before content ${content}`;
  });
  await test('Images load on representative English and Turkish pages', 'mobile', '/', async (page) => {
    const pages = ['/', '/tr/', '/faculty-members/', '/tr/ogretim-uyeleri/', '/graduate-students/', '/news/', '/tr/haberler/', '/announcements/cs-fair-2026-4/', '/tr/duyurular/cs-fair-2026-3/', '/tr/universite-adaylarina/', '/course-homepages/', '/tr/haberler/bilgisayar-muhendisligi-yeni-lisans-mufredati/'];
    let images = 0;
    for (const path of pages) {
      await page.goto(url(path), { waitUntil: 'load' });
      const broken = await page.evaluate(async () => {
        for (const img of document.images) img.loading = 'eager';
        // Inline callbacks only: tsx would wrap named helpers in a __name() call the page does not have.
        await Promise.all(
          [...document.images].map((img) =>
            img.complete
              ? null
              : new Promise((resolve) => {
                  img.addEventListener('load', resolve, { once: true });
                  img.addEventListener('error', resolve, { once: true });
                  setTimeout(resolve, 15_000);
                }),
          ),
        );
        return [...document.images].filter((img) => img.naturalWidth === 0).map((img) => img.currentSrc || img.src);
      });
      images += await page.evaluate(() => document.images.length);
      assert(broken.length === 0, `${path}: ${broken.length} image(s) did not load, e.g. ${broken[0]}`);
    }
    return `${images} images on ${pages.length} pages, all loaded`;
  });
  await test('Informational images have a text version', 'desktop', '/news/new-undergraduate-curriculum-for-computer-engineering/', async (page) => {
    const versions = page.locator('details.image-text');
    const count = await versions.count();
    assert(count === 2, `${count} text versions`);
    await versions.first().locator('summary').click();
    const rows = await versions.first().locator('tbody tr').count();
    assert(rows > 40, `curriculum text version has ${rows} table rows`);
    return `${count} text versions; curriculum table with ${rows} rows`;
  });
  await test('Phone menu links are reachable without JavaScript', 'mobile', '/', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: VIEWPORTS.mobile });
    const page = await context.newPage();
    await blockExternal(page);
    await page.goto(url('/'));
    const visible = await page.locator('#drawer-0 a').first().isVisible();
    const count = await page.locator('#drawer a:visible').count();
    await context.close();
    assert(visible, 'menu links hidden without JavaScript');
    return `${count} menu links listed`;
  });
  return results;
}

// ---------------------------------------------------------------- run
if (!existsSync(DIST)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}
const server = serve();
const browser = await chromium.launch();
try {
  const routes = listRoutes().sort();
  console.log(`Checking ${routes.length} routes at ${Object.keys(VIEWPORTS).join(' and ')} widths…`);
  const jobs = routes.flatMap((path) => (Object.keys(VIEWPORTS) as ViewportName[]).map((viewport) => ({ path, viewport })));
  const results = await pool(jobs, CONCURRENCY, ({ path, viewport }) => checkPage(browser, path, viewport));

  mkdirSync(SHOTS, { recursive: true });
  await pool(SCREENSHOTS, CONCURRENCY, async ([name, path]) => {
    for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
      const page = await browser.newPage({ viewport: VIEWPORTS[viewport] });
      await blockExternal(page);
      await page.goto(url(path), { waitUntil: 'load' });
      // Load lazy images and fonts before the full-page capture.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
        await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
        await document.fonts.ready;
      });
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({
        path: join(SHOTS, `${name}-${viewport}.png`),
        fullPage: true,
        clip: { x: 0, y: 0, width: VIEWPORTS[viewport].width, height: Math.min(height, FULL_PAGE_MAX) },
      });
      await page.close();
    }
  });
  const tests = await interactionTests(browser);

  // The phone menu, open, on the homepage (both languages).
  for (const [name, path] of [['menu-open-en', '/'], ['menu-open-tr', '/tr/']] as const) {
    const page = await browser.newPage({ viewport: VIEWPORTS.mobile });
    await blockExternal(page);
    await page.goto(url(path), { waitUntil: 'load' });
    await page.click('[data-drawer-open]');
    await page.locator('#drawer [data-accordion]').first().click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `${name}-mobile.png`), fullPage: true, clip: { x: 0, y: 0, width: VIEWPORTS.mobile.width, height: 1500 } });
    await page.close();
  }

  const problems = results.filter((r) => r.errors.length || r.failedRequests.length || r.overflow > 0 || r.status !== 200 || r.inverted.length || r.emptyPhotos);
  const scrolling = results.filter((r) => r.scrollTables.length);
  const axeByRule = new Map<string, { impact: string; help: string; pages: string[]; nodes: number; target: string }>();
  for (const r of results) {
    for (const v of r.axe ?? []) {
      const entry = axeByRule.get(v.id) ?? { impact: v.impact, help: v.help, pages: [], nodes: 0, target: v.target };
      entry.pages.push(`${r.path} (${r.viewport})`);
      entry.nodes += v.nodes;
      axeByRule.set(v.id, entry);
    }
  }
  const failedTests = tests.filter((t) => !t.ok);
  const summary = {
    routes: routes.length,
    pageLoads: results.length,
    loadProblems: problems.length,
    overflowing: results.filter((r) => r.overflow > 0).length,
    scriptErrors: results.filter((r) => r.errors.length).length,
    failedLocalRequests: results.filter((r) => r.failedRequests.length).length,
    axeRulesViolated: axeByRule.size,
    axePagesWithViolations: results.filter((r) => r.axe?.length).length,
    interactionTests: tests.length,
    interactionFailures: failedTests.length,
    screenshots: SCREENSHOTS.length * Object.keys(VIEWPORTS).length + 2,
    scrollingTables: scrolling.length,
  };
  writeFileSync(join(REPORTS, 'browser-qa.json'), `${JSON.stringify({ summary, results, tests, axe: [...axeByRule].map(([id, v]) => ({ id, ...v })) }, null, 2)}\n`);

  const md = (rows: string[][]) => rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
  writeFileSync(
    join(REPORTS, 'browser-qa.md'),
    [
      '# Browser QA',
      '',
      `Generated by \`npm run qa:browser\`: ${routes.length} routes (redirect pages excluded) loaded in Chromium at ${VIEWPORTS.mobile.width}px and ${VIEWPORTS.desktop.width}px wide, with all requests to other hosts blocked.`,
      '',
      md([['Check', 'Result'], ['---', '---'], ...Object.entries(summary).map(([k, v]) => [k, String(v)])]),
      '',
      '## Load problems',
      '',
      problems.length
        ? md([['Path', 'Width', 'Problem'], ['---', '---', '---'], ...problems.map((r) => [`\`${r.path}\``, r.viewport, [r.status !== 200 ? `HTTP ${r.status}` : '', r.overflow > 0 ? `scrolls ${r.overflow}px sideways: ${r.offenders.join(', ')}` : '', ...r.inverted, r.emptyPhotos ? `${r.emptyPhotos} empty photo slots` : '', ...r.errors, ...r.failedRequests].filter(Boolean).join('; ')])])
        : 'None: every page loaded without errors, failed requests, horizontal page scrolling, headings larger than the title or empty photo slots, at both widths.',
      '',
      '## Tables that scroll sideways',
      '',
      'Not a failure: wide tables scroll inside their own box. Each needs a visible cue (edge shadow) and a sticky first column so rows keep their label.',
      '',
      scrolling.length ? md([['Path', 'Width', 'Tables'], ['---', '---', '---'], ...scrolling.map((r) => [`\`${r.path}\``, r.viewport, r.scrollTables.join('; ')])]) : 'None.',
      '',
      `## Accessibility (axe-core, WCAG 2.1 A/AA and WCAG 2.2 AA target size, at ${VIEWPORTS.mobile.width}px and ${VIEWPORTS.desktop.width}px)`,
      '',
      axeByRule.size
        ? md([['Rule', 'Impact', 'Pages', 'Nodes', 'Example', 'Description'], ['---', '---', '---:', '---:', '---', '---'], ...[...axeByRule].map(([id, v]) => [id, v.impact, String(v.pages.length), String(v.nodes), `\`${v.target}\``, v.help])])
        : 'No violations.',
      '',
      '## Interaction tests',
      '',
      md([['Test', 'Result', 'Detail'], ['---', '---', '---'], ...tests.map((t) => [t.name, t.ok ? 'pass' : '**FAIL**', t.detail])]),
      '',
      '## Screenshots',
      '',
      `In \`reports/screenshots/\`, each page at both widths (full page, cut at ${FULL_PAGE_MAX}px):`,
      '',
      ...SCREENSHOTS.map(([name, path]) => `- \`${path}\`: \`${name}-mobile.png\`, \`${name}-desktop.png\``),
      '',
    ].join('\n'),
  );
  console.log(JSON.stringify(summary, null, 2));
  if (problems.length || failedTests.length || axeByRule.size) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
