/**
 * Verifies the built site (dist/) against the WordPress export and against
 * evidence recorded from the live site (migration/reference/live-urls.json).
 * It does not use the site's routing or link code, so a bug there cannot hide
 * itself. The only project input it reads is src/config/content-rules.ts: the
 * list of deliberate content decisions, which the reports list explicitly.
 *
 *   1. routes        – every page, post, archive page and redirect exists,
 *                      with the right language, title, canonical URL and h1;
 *   2. languages     – translation pairs link to each other; untranslated
 *                      pages say so; likely missing pairs are flagged;
 *   3. links         – every internal link, asset and #fragment resolves, and
 *                      every link in the content goes where the source pointed;
 *   4. content       – the words of every source item appear on its page in
 *                      the same order, with case and diacritics intact;
 *                      people directories have one named card per entry;
 *   5. archives      – membership, order, page size and pagination;
 *   6. feeds, media, excerpts and markup hygiene.
 *
 *   npm run verify                    # after npm run build
 *   npm run verify -- --report-only   # never exit with an error
 *
 * Reports are written to reports/. Nothing is fetched from the network.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import {
  englishBodyPages,
  legacyRedirects,
  linkFixes,
  peoplePages,
  translationOverrides,
  unresolvedInContent,
  deadLinks,
} from '../src/config/content-rules';
import { imageText } from '../src/config/image-text';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = process.env.VERIFY_DIST ?? join(ROOT, 'dist');
const REPORTS = process.env.VERIFY_REPORTS ?? join(ROOT, 'reports');
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const SITE = new URL(process.env.SITE_URL ?? "http://localhost:4321").origin;
const LEGACY = /^(?:https?:)?\/\/w3\.cs\.bilkent\.edu\.tr(?=[/?#]|$)/i;
const reportOnly = process.argv.includes('--report-only');

type Lang = 'en' | 'tr';
interface Entry {
  kind: 'page' | 'post';
  lang: Lang;
  path: string;
  title: string;
  html: string;
  summary: string;
  categories: string[];
  translationGroup: string | null;
  publishedAt: string;
  media: string[];
}
interface Fixture {
  mustResolve: Array<{ path: string; liveTarget: string }>;
  deadOnLive: string[];
  postsPerPage: { value: number };
  archives: Array<{ path: string; lang: Lang; category: string; wp: string; live: boolean }>;
}

const pages = JSON.parse(readFileSync(join(ROOT, 'src/content/generated/pages.json'), 'utf8')) as Entry[];
const posts = JSON.parse(readFileSync(join(ROOT, 'src/content/generated/posts.json'), 'utf8')) as Entry[];
const fixture = JSON.parse(readFileSync(join(ROOT, 'migration/reference/live-urls.json'), 'utf8')) as Fixture;
const entries = [...pages, ...posts];
const PER_PAGE = fixture.postsPerPage.value;

// ---------------------------------------------------------------- helpers
const withBase = (path: string) => (BASE === '/' ? path : `${BASE.slice(0, -1)}${path}`);
const stripBase = (path: string) => (BASE !== '/' && path.startsWith(BASE) ? path.slice(BASE.length - 1) : path);
const fileFor = (path: string) => join(DIST, decodeURI(path), path.endsWith('/') ? 'index.html' : '');
const normalizePath = (path: string) => {
  const p = path === '' ? '/' : path;
  const last = p.split('/').pop() ?? '';
  return p.endsWith('/') || last.includes('.') ? p : `${p}/`;
};
/** Undo typographic punctuation (the site sets quotes and dashes like WordPress does). */
const plainPunct = (text: string) =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\s+/g, ' ').trim();

function listHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listHtml(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

function routeOf(file: string): string {
  const rel = `/${relative(DIST, file).split('\\').join('/')}`;
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

/** Word tokens with case and diacritics kept (NFC), for order-sensitive comparison. */
function tokens(text: string): string[] {
  return text.normalize('NFC').match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

function spaced($: CheerioAPI, root: ReturnType<CheerioAPI>): string {
  root.find('*').each((_, el) => {
    $(el).append(' ');
  });
  return root.text();
}

function sourceDom(html: string): CheerioAPI {
  const $ = load(html, null, false);
  const strip = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === 'comment') node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      else if ('children' in node) strip([...node.children]);
    }
  };
  strip($.root().toArray());
  return $;
}

function sourceText(html: string): string {
  const $ = sourceDom(html);
  $('span.e-mail[data-user]').each((_, el) => {
    $(el).replaceWith(` ${$(el).attr('data-user')}@${$(el).attr('data-website')} `);
  });
  return spaced($, $.root());
}

function renderedText($: CheerioAPI): string {
  const main = $('main').clone();
  // Navigation and derived additions (tables of contents, related posts, research-area
  // links) are removed so they cannot stand in for missing content.
  main.find('.crumbs, .subnav, .toc, .anchor, .article-head__meta, .pagehead__meta, .pager, .aside-sticky, .toolbar, .directory-note, .person__areas, .pagination, .media__label').remove();
  main.find('span.email').each((_, el) => {
    const span = $(el);
    span.replaceWith(` ${span.text()} ${span.attr('data-user')}@${span.attr('data-domain')} `);
  });
  return spaced($, main);
}

/** Source tokens that are not found, in order, in the rendered tokens. */
function orderedMissing(source: string[], rendered: string[]): Array<{ at: number; token: string }> {
  const positions = new Map<string, number[]>();
  rendered.forEach((t, i) => positions.set(t, [...(positions.get(t) ?? []), i]));
  const missing: Array<{ at: number; token: string }> = [];
  let cursor = -1;
  source.forEach((token, at) => {
    const list = positions.get(token);
    if (!list) {
      missing.push({ at, token });
      return;
    }
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]! > cursor) hi = mid;
      else lo = mid + 1;
    }
    if (lo < list.length) cursor = list[lo]!;
    else missing.push({ at, token });
  });
  return missing;
}

// ---------------------------------------------------------------- expected routes
type Kind = 'home' | 'page' | 'post' | 'archive' | 'redirect';
interface Expected {
  path: string;
  kind: Kind;
  lang: Lang;
  title?: string;
  to?: string;
}
const expected = new Map<string, Expected>();
const expect = (e: Expected) => {
  if (!expected.has(e.path)) expected.set(e.path, e);
};
const langOfPath = new Map<string, Lang>(entries.map((e) => [e.path, e.lang]));

expect({ path: '/', kind: 'home', lang: 'en' });
expect({ path: '/tr/', kind: 'home', lang: 'tr' });

interface ArchiveExpectation {
  root: string;
  lang: Lang;
  category: string;
  members: Entry[];
  pages: number;
}
const archives: ArchiveExpectation[] = fixture.archives.map((a) => {
  const members = posts
    .filter((p) => p.lang === a.lang && p.categories.includes(a.category))
    .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt) || x.path.localeCompare(y.path));
  return { root: a.path, lang: a.lang, category: a.category, members, pages: Math.max(1, Math.ceil(members.length / PER_PAGE)) };
});
const archivePage = (root: string, n: number) => (n === 1 ? root : `${root}page/${n}/`);
for (const a of archives) for (let n = 1; n <= a.pages; n++) expect({ path: archivePage(a.root, n), kind: 'archive', lang: a.lang });
for (const e of entries) expect({ path: e.path, kind: e.kind, lang: e.lang, title: e.title });

// Redirects, from live-site evidence (not from the site's configuration).
const redirectTarget = new Map<string, string>();
for (const { path, liveTarget } of fixture.mustResolve) {
  if (path !== liveTarget) redirectTarget.set(path, liveTarget);
}
for (const a of fixture.archives) {
  const arch = archives.find((x) => x.root === a.path)!;
  for (let n = 1; n <= arch.pages; n++) redirectTarget.set(n === 1 ? a.wp : `${a.wp}page/${n}/`, archivePage(a.path, n));
}
for (const p of pages) {
  const alias = p.path.replace(/^\/tr\//, '/');
  if (p.lang === 'tr' && !expected.has(alias)) redirectTarget.set(alias, p.path);
}
for (const [from, to] of redirectTarget) {
  if (!expected.has(from)) expect({ path: from, kind: 'redirect', lang: langOfPath.get(to) ?? (to.startsWith('/tr/') ? 'tr' : 'en'), to });
}

// ---------------------------------------------------------------- translation pairs
const counterpart = new Map<string, string>();
const groups = new Map<string, Entry[]>();
for (const e of entries) if (e.translationGroup) groups.set(e.translationGroup, [...(groups.get(e.translationGroup) ?? []), e]);
for (const members of groups.values()) {
  for (const a of members) {
    const b = members.find((m) => m.lang !== a.lang);
    if (b) counterpart.set(a.path, b.path);
  }
}
for (const [en, tr] of translationOverrides) {
  counterpart.set(en, tr);
  counterpart.set(tr, en);
}
counterpart.set('/', '/tr/');
counterpart.set('/tr/', '/');
for (const cat of new Set(fixture.archives.map((a) => a.category))) {
  const en = fixture.archives.find((a) => a.category === cat && a.lang === 'en')?.path;
  const tr = fixture.archives.find((a) => a.category === cat && a.lang === 'tr')?.path;
  if (en && tr) {
    counterpart.set(en, tr);
    counterpart.set(tr, en);
  }
}

// ---------------------------------------------------------------- scan dist
if (!existsSync(DIST)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}
interface PageScan {
  route: string;
  $: CheerioAPI;
  redirect?: string;
}
const scans = new Map<string, PageScan>();
for (const file of listHtml(DIST)) {
  const route = routeOf(file);
  const $ = load(readFileSync(file, 'utf8'));
  const refresh = $('meta[http-equiv="refresh"]').attr('content');
  scans.set(route, { route, $, redirect: refresh?.split('url=')[1] });
}
const idsCache = new Map<string, Set<string>>();
const idsOf = (route: string) => {
  if (!idsCache.has(route)) {
    const scan = scans.get(route);
    idsCache.set(route, new Set(scan ? scan.$('[id], a[name]').map((_, el) => scan.$(el).attr('id') ?? scan.$(el).attr('name')).get() : []));
  }
  return idsCache.get(route)!;
};
const finalTarget = (route: string): string | undefined => {
  let current = route;
  for (let hops = 0; hops < 5; hops++) {
    const scan = scans.get(current);
    if (!scan) return undefined;
    if (!scan.redirect) return current;
    current = stripBase(scan.redirect);
  }
  return undefined;
};

// ---------------------------------------------------------------- 1. routes
interface RouteResult extends Expected {
  ok: boolean;
  problems: string[];
}
const routeResults: RouteResult[] = [];
for (const exp of [...expected.values()].sort((a, b) => a.path.localeCompare(b.path))) {
  const problems: string[] = [];
  const scan = scans.get(exp.path);
  if (!scan) {
    routeResults.push({ ...exp, ok: false, problems: ['missing from dist/'] });
    continue;
  }
  const $ = scan.$;
  const htmlLang = $('html').attr('lang');
  if (htmlLang !== exp.lang) problems.push(`<html lang="${htmlLang}">, expected "${exp.lang}"`);
  if (exp.kind === 'redirect') {
    const final = finalTarget(exp.path);
    if (!final) problems.push(`redirect chain from ${exp.path} does not end at a page`);
    else if (final !== exp.to) problems.push(`redirects to ${final}, expected ${exp.to}`);
  } else {
    if (!$('title').text().trim()) problems.push('empty <title>');
    const canonical = $('link[rel="canonical"]').attr('href');
    if (canonical !== `${SITE}${withBase(exp.path)}`) problems.push(`canonical ${canonical}`);
    const h1 = $('h1');
    if (h1.length !== 1) problems.push(`${h1.length} <h1> elements`);
    if (exp.title && plainPunct(h1.first().text()) !== plainPunct(exp.title)) problems.push(`<h1> "${h1.first().text().trim()}" ≠ title "${exp.title}"`);
    if (!$('meta[name="description"]').attr('content')) problems.push('no meta description');
  }
  routeResults.push({ ...exp, ok: problems.length === 0, problems });
}
const unexpected = [...scans.keys()].filter((r) => !expected.has(r) && r !== '/404.html').sort();

// Every URL observed on the live site must still lead to the same content.
const liveResults = fixture.mustResolve.map(({ path, liveTarget }) => {
  const final = finalTarget(path);
  const wanted = redirectTarget.get(liveTarget) ?? liveTarget;
  return { path, liveTarget, final, ok: final === wanted };
});

// ---------------------------------------------------------------- 2. languages
interface LangResult {
  path: string;
  expected: string | null;
  switcher: string | undefined;
  ok: boolean;
  problem?: string;
}
const langResults: LangResult[] = [];
for (const exp of expected.values()) {
  if (exp.kind === 'redirect') continue;
  const scan = scans.get(exp.path);
  if (!scan) continue;
  const $ = scan.$;
  const switcher = $('header .utility a.langswitch').attr('href');
  const exact = !$('header .utility a.langswitch').attr('title');
  const hreflang = $('link[rel="alternate"][hreflang]').map((_, el) => `${$(el).attr('hreflang')}=${$(el).attr('href')}`).get();
  const other = counterpart.get(exp.path) ?? null;
  let problem: string | undefined;
  if (other) {
    if (switcher !== withBase(other)) problem = `switcher → ${switcher}, expected ${withBase(other)}`;
    else if (!exact) problem = 'switcher marked as fallback although a translation exists';
    else if (!hreflang.some((h) => h.endsWith(`${SITE}${withBase(other)}`))) problem = 'hreflang alternate for the translation missing';
  } else if (exact) {
    problem = `no translation exists but switcher (${switcher}) is not marked as a fallback`;
  } else if (hreflang.length) {
    problem = 'hreflang alternates on a page without translation';
  }
  langResults.push({ path: exp.path, expected: other, switcher, ok: !problem, problem });
}

// Posts without a pair that share an image with an unpaired post in the other language, published within two days.
const likelyPairs: Array<{ en: string; tr: string; shared: string[]; hours: number }> = [];
const lonely = posts.filter((p) => !counterpart.has(p.path));
for (const a of lonely.filter((p) => p.lang === 'en')) {
  for (const b of lonely.filter((p) => p.lang === 'tr')) {
    const shared = a.media.filter((m) => b.media.includes(m));
    const hours = Math.abs(Date.parse(`${a.publishedAt}Z`) - Date.parse(`${b.publishedAt}Z`)) / 36e5;
    if (shared.length && hours < 48) likelyPairs.push({ en: a.path, tr: b.path, shared, hours: Math.round(hours * 10) / 10 });
  }
}

// ---------------------------------------------------------------- 3. links: existence
interface BrokenLink {
  page: string;
  attr: string;
  url: string;
  reason: string;
}
const broken: BrokenLink[] = [];
const external = new Map<string, Set<string>>();
const legacyMedia = new Map<string, Set<string>>();
let internalChecked = 0;
let fragmentsChecked = 0;

function checkInternal(page: string, attr: string, raw: string): void {
  internalChecked++;
  const [pathPart, hash] = raw.split('#', 2) as [string, string | undefined];
  if (BASE !== '/' && pathPart !== '' && !pathPart.startsWith(BASE)) {
    broken.push({ page, attr, url: raw, reason: `outside the base path ${BASE}` });
    return;
  }
  const target = pathPart === '' ? page : stripBase(pathPart.split('?')[0]!);
  if (!existsSync(fileFor(target))) {
    broken.push({ page, attr, url: raw, reason: 'target does not exist' });
    return;
  }
  if (hash && target.endsWith('/') && !idsOf(target).has(decodeURIComponent(hash))) {
    broken.push({ page, attr, url: raw, reason: `no element with id "${hash}"` });
  }
}

for (const scan of scans.values()) {
  const { $, route } = scan;
  const urls: Array<[string, string]> = [];
  $('a[href]').each((_, el) => void urls.push(['a', $(el).attr('href')!]));
  $('link[href]').each((_, el) => void urls.push([`link[rel=${$(el).attr('rel')}]`, $(el).attr('href')!]));
  $('img[src], script[src], iframe[src], source[src]').each((_, el) => void urls.push([el.tagName, $(el).attr('src')!]));
  $('img[srcset], source[srcset]').each((_, el) => {
    for (const c of $(el).attr('srcset')!.split(',')) urls.push(['srcset', c.trim().split(/\s+/)[0]!]);
  });
  if (scan.redirect) urls.push(['meta refresh', scan.redirect]);
  $('a[data-legacy-media]').each((_, el) => {
    const url = $(el).attr('href')!;
    legacyMedia.set(url, (legacyMedia.get(url) ?? new Set()).add(route));
  });
  for (const [attr, raw] of urls) {
    const url = raw.trim();
    if (!url || /^javascript:/i.test(url)) broken.push({ page: route, attr, url: raw, reason: 'empty or javascript: URL' });
    else if (/^(mailto|tel):/i.test(url)) continue;
    else if (/^https?:\/\//i.test(url) || url.startsWith('//')) {
      if (attr.startsWith('link[rel=canonical') || attr.startsWith('link[rel=alternate')) {
        if (url.startsWith(SITE)) checkInternal(route, attr, url.slice(SITE.length));
        continue;
      }
      external.set(url, (external.get(url) ?? new Set()).add(route));
    } else if (url.startsWith('#')) {
      fragmentsChecked++;
      if (url.length > 1 && !idsOf(route).has(decodeURIComponent(url.slice(1)))) {
        broken.push({ page: route, attr, url, reason: `no element with id "${url.slice(1)}" on this page` });
      }
    } else if (url.startsWith('/')) checkInternal(route, attr, url);
    else broken.push({ page: route, attr, url, reason: 'relative URL (not root-relative)' });
  }
}

// ---------------------------------------------------------------- 3b. links: same target as the source
type Target = { kind: 'route'; path: string } | { kind: 'external'; url: string } | { kind: 'media'; path: string } | { kind: 'unresolved' } | { kind: 'skip' };
const exportPaths = new Set([...entries.map((e) => e.path), ...archives.map((a) => a.root), '/', '/tr/']);
const trPages = new Set(pages.filter((p) => p.lang === 'tr').map((p) => p.path));

/** Where a source link should go, decided from the export and live evidence only. */
function expectedTarget(href: string): Target {
  const raw = href.trim();
  if (!raw || /^(mailto|tel):/i.test(raw) || raw.startsWith('#')) return { kind: 'skip' };
  if (linkFixes[raw]) return { kind: 'external', url: linkFixes[raw]!.to };
  if (deadLinks[raw]) return { kind: 'unresolved' };
  const stripped = raw.replace(LEGACY, '');
  const local = stripped !== raw && !stripped.startsWith('/') ? `/${stripped}` : stripped;
  if (/^[a-z][a-z0-9+.-]*:/i.test(local) || local.startsWith('//')) return { kind: 'external', url: raw };
  if (!local.startsWith('/')) return { kind: 'unresolved' };
  const [, pathPart = '/', query = ''] = local.match(/^([^?#]*)(\?[^#]*)?/) ?? [];
  if (/^\?(p|page_id|cat|attachment_id)=/i.test(query)) return { kind: 'unresolved' };
  // Upload paths are case-sensitive files; page slugs are matched case-insensitively, as WordPress does.
  if (pathPart.startsWith('/wp-content/')) return { kind: 'media', path: normalizePath(pathPart) };
  const path = normalizePath(pathPart).toLowerCase();
  if (unresolvedInContent[path]) return { kind: 'unresolved' };
  if (exportPaths.has(path)) return { kind: 'route', path };
  const viaRedirect = redirectTarget.get(path);
  if (viaRedirect) return { kind: 'route', path: viaRedirect };
  if (trPages.has(`/tr${path}`)) return { kind: 'route', path: `/tr${path}` };
  return { kind: 'unresolved' };
}

interface LinkMismatch {
  page: string;
  text: string;
  source: string;
  expected: string;
  actual: string;
}
const linkMismatches: LinkMismatch[] = [];
let linksAligned = 0;
const describeTarget = (t: Target) => (t.kind === 'route' || t.kind === 'media' ? `${t.kind} ${t.path}` : t.kind === 'external' ? t.url : t.kind);
const linkText = (text: string) => plainPunct(text).toLowerCase();

for (const e of entries) {
  const scan = scans.get(e.path);
  if (!scan) continue;
  const $s = sourceDom(e.html);
  const sourceLinks = $s('a[href]')
    .toArray()
    .map((el) => ({ text: linkText($s(el).text()), href: $s(el).attr('href')!, image: $s(el).find('img').length > 0 }))
    .filter((l) => (l.text || l.image) && expectedTarget(l.href).kind !== 'skip');
  const { $ } = scan;
  const content = $('main .prose, main .people').first();
  const rendered = content
    .find('a[href], span.link-unresolved')
    .toArray()
    .map((el) => {
      const node = $(el).clone();
      node.find('.lang-badge, .media__label').remove();
      return { text: linkText(node.text()), href: $(el).is('span') ? null : $(el).attr('href')!, image: $(el).find('img, .media--missing').length > 0 };
    });
  let cursor = 0;
  for (const link of sourceLinks) {
    const want = expectedTarget(link.href);
    // Links with text are matched by their text; image-only links by position among image links.
    const index = rendered.findIndex((r, i) => i >= cursor && (link.text ? r.text === link.text : r.image));
    if (index < 0) {
      linkMismatches.push({ page: e.path, text: link.text || '(image)', source: link.href, expected: describeTarget(want), actual: 'no matching link on the page' });
      continue;
    }
    cursor = index + 1;
    linksAligned++;
    const got = rendered[index]!;
    let actual: string;
    if (got.href === null) actual = 'unresolved';
    else if (/^https?:\/\//.test(got.href)) {
      actual = got.href.startsWith('https://w3.cs.bilkent.edu.tr/wp-content/') ? `media ${got.href.slice('https://w3.cs.bilkent.edu.tr'.length)}` : got.href;
    } else {
      const p = stripBase(got.href.split('#')[0]!.split('?')[0]!);
      actual = p.startsWith('/wp-content/') ? `media ${p}` : `route ${p}`;
    }
    const ok = want.kind === 'external' ? actual === want.url : actual === describeTarget(want);
    if (!ok) linkMismatches.push({ page: e.path, text: link.text || '(image)', source: link.href, expected: describeTarget(want), actual });
  }
}

// ---------------------------------------------------------------- 4. content parity (ordered)
interface ParityResult {
  path: string;
  sourceWords: number;
  missing: number;
  context: string[];
  ok: boolean;
}
const parity: ParityResult[] = [];
for (const e of entries) {
  const scan = scans.get(e.path);
  if (!scan) continue;
  const src = tokens(`${plainPunct(e.title)} ${sourceText(e.html)}`);
  const missing = orderedMissing(src, tokens(renderedText(scan.$)));
  const context = missing.slice(0, 5).map(({ at }) => `…${src.slice(Math.max(0, at - 4), at + 4).join(' ')}… (“${src[at]}”)`);
  parity.push({ path: e.path, sourceWords: src.length, missing: missing.length, context, ok: missing.length === 0 });
}

// People directories: one named card per source entry.
const peopleResults: Array<{ path: string; entries: number; cards: number; unnamed: number; ok: boolean }> = [];
for (const path of peoplePages) {
  const e = pages.find((p) => p.path === path);
  const scan = scans.get(path);
  if (!e || !scan) continue;
  const $ = sourceDom(e.html);
  const sourceEntries = ($.html() ?? '').split(/<hr\b[^>]*>/i).filter((chunk) => {
    const $c = load(chunk, null, false);
    return $c.root().text().trim() !== '' || $c('img').length > 0;
  }).length;
  const cards = scan.$('li.person');
  const unnamed = cards.filter((_, el) => !scan.$(el).find('.person__name').text().trim()).length;
  peopleResults.push({ path, entries: sourceEntries, cards: cards.length, unnamed, ok: sourceEntries === cards.length && unnamed === 0 });
}

// ---------------------------------------------------------------- 5. archives
interface ArchiveResult {
  path: string;
  problems: string[];
}
const archiveResults: ArchiveResult[] = [];
for (const a of archives) {
  for (let n = 1; n <= a.pages; n++) {
    const path = archivePage(a.root, n);
    const scan = scans.get(path);
    const want = a.members.slice((n - 1) * PER_PAGE, n * PER_PAGE).map((p) => p.path);
    if (!scan) {
      archiveResults.push({ path, problems: ['missing'] });
      continue;
    }
    const { $ } = scan;
    const problems: string[] = [];
    const got = $('.entries .entry__title a').map((_, el) => stripBase($(el).attr('href')!)).get();
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push('posts or order differ from the export');
    const next = $('.pagination a[rel="next"]').attr('href');
    const prev = $('.pagination a[rel="prev"]').attr('href');
    if (n < a.pages && stripBase(next ?? '') !== archivePage(a.root, n + 1)) problems.push(`next → ${next}`);
    if (n === a.pages && next) problems.push('next link on the last page');
    if (n > 1 && stripBase(prev ?? '') !== archivePage(a.root, n - 1)) problems.push(`prev → ${prev}`);
    if (a.pages > 1) {
      const numbered = $('.pagination a.pagination__page').length;
      const current = stripBase($('.pagination a[aria-current="page"]').attr('href') ?? '');
      if (numbered !== a.pages) problems.push(`${numbered} numbered page links, expected ${a.pages}`);
      if (current !== path) problems.push(`aria-current on ${current}`);
    }
    archiveResults.push({ path, problems });
  }
}

// ---------------------------------------------------------------- 6. feeds, media, excerpts, hygiene
const feedPaths = ['/rss.xml', '/tr/rss.xml', ...fixture.archives.map((a) => `${a.path}rss.xml`)];
const feedResults = feedPaths.map((path) => {
  const file = join(DIST, path);
  if (!existsSync(file)) return { path, items: 0, problems: ['missing'] };
  const $ = load(readFileSync(file, 'utf8'), { xml: true });
  const links = $('item > link').map((_, el) => $(el).text()).get();
  const problems = links
    .filter((l) => !l.startsWith(SITE) || !existsSync(fileFor(stripBase(l.slice(SITE.length)))))
    .map((l) => `item link ${l} does not exist`);
  if (!$('channel > title').text()) problems.push('no channel title');
  return { path, items: links.length, problems };
});

const summaryProblems = entries
  .filter((e) => /\s[,.;:!?](?!\.)|\.…|\S@\S/.test(e.summary))
  .map((e) => ({ path: e.path, summary: e.summary.slice(0, 120) }));

const placeholders = new Map<string, Set<string>>();
const unresolved: Array<{ page: string; href: string; text: string }> = [];
const fixed: Array<{ page: string; from: string; to: string }> = [];
const hygiene: Array<{ page: string; problem: string }> = [];
// Rendered images point at WebP variants; map them back to the upload they were made from.
const variantOf = new Map<string, string>();
const manifestFile = join(DIST, '_media', 'manifest.json');
if (existsSync(manifestFile)) {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, { variants: Array<{ src: string }>; square: Array<{ src: string }> }>;
  for (const [original, record] of Object.entries(manifest)) for (const v of [...record.variants, ...record.square]) variantOf.set(v.src, original);
}
const imageSource = (src: string) => {
  const path = stripBase(src.split('?')[0]!);
  return variantOf.get(path) ?? path;
};
const describedImages = new Set<string>();
for (const scan of scans.values()) {
  const { $, route } = scan;
  if (scan.redirect) continue;
  $('[data-missing-src]').each((_, el) => {
    const src = $(el).attr('data-missing-src')!;
    placeholders.set(src, (placeholders.get(src) ?? new Set()).add(route));
    if ($(el).attr('role') !== 'img' || !$(el).attr('aria-label')) hygiene.push({ page: route, problem: `placeholder for ${src} lacks role/label` });
  });
  $('.link-unresolved').each((_, el) => void unresolved.push({ page: route, href: $(el).attr('data-original-href') ?? '', text: $(el).text().trim() }));
  $('[data-link-fixed]').each((_, el) => void fixed.push({ page: route, from: $(el).attr('data-link-fixed')!, to: $(el).attr('href')! }));
  $('main img:not([alt])').each((_, el) => void hygiene.push({ page: route, problem: `<img src="${$(el).attr('src')}"> without alt` }));
  // Images that carry information must have the text alternative from src/config/image-text.ts.
  $('main .prose img').each((_, el) => {
    const original = imageSource($(el).attr('src') ?? '');
    if (!imageText[original]) return;
    describedImages.add(original);
    if (!$(el).attr('alt')?.trim()) hygiene.push({ page: route, problem: `informational image ${original} without alt text` });
    const holder = $(el).closest('figure').length ? $(el).closest('figure') : $(el).closest('a').length ? $(el).closest('a') : $(el);
    if (imageText[original]!.text && !holder.next('details.image-text').length) {
      hygiene.push({ page: route, problem: `informational image ${original} without its text version` });
    }
  });
  if ($('main iframe').length) hygiene.push({ page: route, problem: 'iframe in static HTML (embeds must load on demand)' });
  if ($('main span.e-mail').length) hygiene.push({ page: route, problem: 'unconverted e-mail span' });
  if (/<!--/.test($('main').html() ?? '')) hygiene.push({ page: route, problem: 'HTML comment inside <main>' });
  if ($('main .wp-block-embed__wrapper').length) hygiene.push({ page: route, problem: 'raw embed wrapper left in content' });
  if ($('main script, main [onclick], main [onload], main a[href^="javascript:"]').length) hygiene.push({ page: route, problem: 'script or inline handler in content' });
  $('main h2[style*="font-size"], main h3[style*="font-size"], main h4[style*="font-size"], main h5[style*="font-size"], main h6[style*="font-size"]').each(
    (_, el) => void hygiene.push({ page: route, problem: `inline font-size on <${(el as Element).name}> "${$(el).text().trim().slice(0, 40)}"` }),
  );
  if ($('main .person__photo').filter((_, el) => $(el).children().length === 0).length) hygiene.push({ page: route, problem: 'empty person photo slot' });
  $('main a[href]').each((_, el) => {
    const a = $(el);
    const named = a.text().trim() || a.attr('aria-label') || a.find('img[alt]').filter((__, img) => Boolean($(img).attr('alt')?.trim())).length;
    if (!named) hygiene.push({ page: route, problem: `link without text: ${a.attr('href')}` });
  });
  const ids = $('[id]').map((_, el) => $(el).attr('id')).get();
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) hygiene.push({ page: route, problem: `duplicate id(s): ${dupes.join(', ')}` });
  if (englishBodyPages.has(route) && $('main .prose').attr('lang') !== 'en') hygiene.push({ page: route, problem: 'English body without lang="en"' });
}

for (const src of Object.keys(imageText)) {
  if (!describedImages.has(src)) hygiene.push({ page: 'src/config/image-text.ts', problem: `text alternative for ${src}, which no page shows` });
}

const emptyAnchors = entries.flatMap((e) => {
  const $ = sourceDom(e.html);
  return $('a')
    .filter((_, el) => !$(el).attr('id') && !$(el).attr('name') && $(el).text().trim() === '' && $(el).find('img, svg, iframe, span.e-mail').length === 0)
    .map((_, el) => ({ page: e.path, href: $(el).attr('href') ?? '' }))
    .get();
});

// ---------------------------------------------------------------- reports
const routeFailures = routeResults.filter((r) => !r.ok);
const liveFailures = liveResults.filter((r) => !r.ok);
const langFailures = langResults.filter((r) => !r.ok);
const parityFailures = parity.filter((p) => !p.ok);
const peopleFailures = peopleResults.filter((p) => !p.ok);
const archiveFailures = archiveResults.filter((a) => a.problems.length);
const feedFailures = feedResults.filter((f) => f.problems.length);
const counts = {
  expectedRoutes: expected.size,
  byKind: Object.fromEntries((['home', 'page', 'post', 'archive', 'redirect'] as Kind[]).map((k) => [k, [...expected.values()].filter((e) => e.kind === k).length])),
  sourcePages: pages.length,
  sourcePosts: posts.length,
  htmlFilesInDist: scans.size,
  routeFailures: routeFailures.length,
  unexpectedRoutes: unexpected.length,
  liveUrlsChecked: liveResults.length,
  liveUrlFailures: liveFailures.length,
  languageChecks: langResults.length,
  languageFailures: langFailures.length,
  translationPairs: [...counterpart.keys()].filter((p) => expected.has(p)).length,
  likelyUnlinkedPairs: likelyPairs.length,
  internalLinksChecked: internalChecked,
  fragmentLinksChecked: fragmentsChecked,
  brokenInternalLinks: broken.length,
  contentLinksAligned: linksAligned,
  contentLinkMismatches: linkMismatches.length,
  externalUrls: external.size,
  legacyMediaLinks: legacyMedia.size,
  parityChecked: parity.length,
  parityFailures: parityFailures.length,
  peopleDirectories: peopleResults.length,
  peopleFailures: peopleFailures.length,
  archivePagesChecked: archiveResults.length,
  archiveFailures: archiveFailures.length,
  feeds: feedResults.length,
  feedFailures: feedFailures.length,
  summaryProblems: summaryProblems.length,
  missingImages: placeholders.size,
  unresolvedLinks: unresolved.length,
  linkFixes: fixed.length,
  emptyAnchorsDropped: emptyAnchors.length,
  hygieneProblems: hygiene.length,
};
const passed =
  !routeFailures.length && !unexpected.length && !liveFailures.length && !langFailures.length && !broken.length &&
  !linkMismatches.length && !parityFailures.length && !peopleFailures.length && !archiveFailures.length &&
  !feedFailures.length && !summaryProblems.length && !hygiene.length;

mkdirSync(REPORTS, { recursive: true });
writeFileSync(
  join(REPORTS, 'verification.json'),
  `${JSON.stringify({ passed, counts, routeResults, unexpected, liveResults, langResults, likelyPairs, broken, linkMismatches, external: [...external].map(([u, p]) => ({ url: u, pages: [...p] })), legacyMedia: [...legacyMedia].map(([u, p]) => ({ url: u, pages: [...p] })), parity, peopleResults, archiveResults, feedResults, summaryProblems, placeholders: [...placeholders].map(([s, p]) => ({ src: s, pages: [...p] })), unresolved, fixed, emptyAnchors, hygiene }, null, 2)}\n`,
);

const md = (rows: string[][]) => rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
const status = (ok: boolean) => (ok ? 'pass' : '**FAIL**');
const code = (s: string) => `\`${s}\``;

writeFileSync(
  join(REPORTS, 'route-coverage.md'),
  [
    '# Route coverage',
    '',
    `Generated by \`npm run verify\` from \`dist/\` (base path \`${BASE}\`). Expected routes come from the WordPress export and from URLs observed on the live site (\`migration/reference/live-urls.json\`), not from the site code.`,
    '',
    md([['Kind', 'Expected', 'Missing or wrong'], ['---', '---:', '---:'], ...Object.entries(counts.byKind).map(([k, n]) => [k, String(n), String(routeFailures.filter((r) => r.kind === k).length)])]),
    '',
    `Source: ${pages.length} pages and ${posts.length} posts. The page \`/tr/haberler/\` (a WordPress "latest posts" block) is rendered as the Turkish news archive. HTML files in dist/: ${scans.size} (including 404.html). Unexpected routes: ${unexpected.length ? unexpected.map(code).join(', ') : 'none'}.`,
    '',
    '## Problems',
    '',
    routeFailures.length ? md([['Path', 'Kind', 'Problems'], ['---', '---', '---'], ...routeFailures.map((r) => [code(r.path), r.kind, r.problems.join('; ')])]) : 'None.',
    '',
    '## URLs observed on the live site',
    '',
    md([['URL', 'Live target', 'Here it ends at', 'Status'], ['---', '---', '---', '---'], ...liveResults.map((r) => [code(r.path), code(r.liveTarget), r.final ? code(r.final) : '—', status(r.ok)])]),
    '',
    '## Archives',
    '',
    `${archiveResults.length} archive pages checked against the export: membership by category and language, newest first, ${PER_PAGE} per page, previous/next and numbered page links. ${archiveFailures.length} problems.`,
    '',
    archiveFailures.length ? md([['Archive page', 'Problems'], ['---', '---'], ...archiveFailures.map((a) => [code(a.path), a.problems.join('; ')])]) : '',
    '',
    '## Language mapping',
    '',
    `${langResults.length} pages checked; ${counts.translationPairs} have a translation. ${langFailures.length} problems.`,
    '',
    langFailures.length ? md([['Path', 'Problem'], ['---', '---'], ...langFailures.map((r) => [code(r.path), r.problem!])]) : '',
    '',
    `Translation pairs that WordPress does not record, set in \`src/config/content-rules.ts\`: ${translationOverrides.length}.`,
    '',
    ...translationOverrides.map(([en, tr]) => `- ${code(en)} ↔ ${code(tr)}`),
    '',
    `Unpaired posts that share an image with an unpaired post in the other language (likely translations still missing): ${likelyPairs.length ? '' : 'none.'}`,
    '',
    likelyPairs.length ? md([['English', 'Turkish', 'Shared media', 'Hours apart'], ['---', '---', '---', '---:'], ...likelyPairs.map((p) => [code(p.en), code(p.tr), p.shared.join(', '), String(p.hours)])]) : '',
    '',
    '## Feeds',
    '',
    md([['Feed', 'Items', 'Status'], ['---', '---:', '---'], ...feedResults.map((f) => [code(f.path), String(f.items), f.problems.length ? f.problems.join('; ') : 'pass'])]),
    '',
    '## All routes',
    '',
    md([['Path', 'Kind', 'Lang', 'Status', 'Translation / target'], ['---', '---', '---', '---', '---'], ...routeResults.map((r) => [code(r.path), r.kind, r.lang, status(r.ok), r.kind === 'redirect' ? `→ ${code(r.to!)}` : counterpart.get(r.path) ? code(counterpart.get(r.path)!) : '—'])]),
    '',
  ].join('\n'),
);

const hosts = new Map<string, number>();
for (const url of external.keys()) {
  const host = new URL(url.startsWith('//') ? `https:${url}` : url).host;
  hosts.set(host, (hosts.get(host) ?? 0) + 1);
}
writeFileSync(
  join(REPORTS, 'link-report.md'),
  [
    '# Link report',
    '',
    `Generated by \`npm run verify\`. ${internalChecked} internal links and assets and ${fragmentsChecked} same-page fragment links checked across ${scans.size} HTML files. ${linksAligned} links in the content were matched one by one with the source, and each target was compared with an independent resolution of the source URL. External links are listed, not fetched.`,
    '',
    `## Broken internal links: ${broken.length}`,
    '',
    broken.length ? md([['Page', 'Where', 'URL', 'Reason'], ['---', '---', '---', '---'], ...broken.map((b) => [code(b.page), b.attr, code(b.url), b.reason])]) : 'None.',
    '',
    `## Content links whose target differs from the source: ${linkMismatches.length}`,
    '',
    linkMismatches.length ? md([['Page', 'Link text', 'Source href', 'Expected', 'Rendered'], ['---', '---', '---', '---', '---'], ...linkMismatches.map((m) => [code(m.page), m.text, code(m.source), m.expected, m.actual])]) : 'None.',
    '',
    `## Links with no target anywhere: ${unresolved.length}`,
    '',
    'These links are dead in the source content or point to an item that is not in the export. Their text is kept and shown without a link.',
    '',
    unresolved.length ? md([['Page', 'Original href', 'Text'], ['---', '---', '---'], ...unresolved.map((u) => [code(u.page), code(u.href), u.text])]) : 'None.',
    '',
    ...Object.entries(unresolvedInContent).map(([path, why]) => `- ${code(path)}: ${why}`),
    '',
    `External pages confirmed gone (\`deadLinks\` in \`src/config/content-rules.ts\`, ${Object.keys(deadLinks).length}): ${Object.entries(deadLinks).map(([url, why]) => `${code(url)} (${why})`).join('; ')}.`,
    '',
    `## Corrected links: ${fixed.length}`,
    '',
    fixed.length ? md([['Page', 'Source href', 'Now'], ['---', '---', '---'], ...fixed.map((f) => [code(f.page), code(f.from), f.to])]) : 'None.',
    '',
    ...Object.entries(linkFixes).map(([from, fix]) => `- ${code(from)}: ${fix.reason}`),
    '',
    `## Media linked on the legacy site: ${legacyMedia.size}`,
    '',
    'Files under /wp-content/uploads/ that are linked (not embedded) from content or menus and are not in public/ yet. Until they are migrated, the links point to the file on w3.cs.bilkent.edu.tr.',
    '',
    legacyMedia.size ? md([['URL', 'Linked from'], ['---', '---'], ...[...legacyMedia].map(([u, p]) => [u, [...p].map(code).join(', ')])]) : 'None.',
    '',
    `## Empty anchors dropped: ${emptyAnchors.length}`,
    '',
    'Anchors without text or image render nothing on the live site; most point to deleted multisite uploads.',
    '',
    md([['Page', 'href'], ['---', '---'], ...emptyAnchors.map((a) => [code(a.page), code(a.href)])]),
    '',
    `## External links: ${external.size} unique URLs`,
    '',
    md([['Host', 'URLs'], ['---', '---:'], ...[...hosts].sort((a, b) => b[1] - a[1]).map(([h, n]) => [h, String(n)])]),
    '',
    `## Redirect pages: ${[...expected.values()].filter((e) => e.kind === 'redirect').length}`,
    '',
    `Old URLs that WordPress answered: ${Object.keys(legacyRedirects).length} configured in \`src/config/content-rules.ts\`, plus WordPress category archive URLs (with their page/N/ pages) and Turkish pages linked without \`/tr\`. Each is checked against \`migration/reference/live-urls.json\`.`,
    '',
  ].join('\n'),
);

writeFileSync(
  join(REPORTS, 'content-parity.md'),
  [
    '# Content parity',
    '',
    'For every page and post, the words of the source (title and body, with e-mail addresses expanded and HTML comments removed) must appear on the built page in the same order, with case and diacritics intact. Navigation and labels may add words; nothing may be missing, reordered or altered.',
    '',
    `${parity.length} items checked, ${parityFailures.length} with problems, ${parity.reduce((n, p) => n + p.sourceWords, 0)} source words in total.`,
    '',
    parityFailures.length ? md([['Path', 'Missing or out of order', 'First cases'], ['---', '---:', '---'], ...parityFailures.map((p) => [code(p.path), String(p.missing), p.context.join('<br>')])]) : 'Every source word is present, in order.',
    '',
    '## People directories',
    '',
    md([['Page', 'Source entries', 'Cards', 'Cards without a name', 'Status'], ['---', '---:', '---:', '---:', '---'], ...peopleResults.map((p) => [code(p.path), String(p.entries), String(p.cards), String(p.unnamed), status(p.ok)])]),
    '',
    '## Excerpts',
    '',
    summaryProblems.length ? md([['Path', 'Summary'], ['---', '---'], ...summaryProblems.map((s) => [code(s.path), s.summary])]) : 'No excerpt has a space before punctuation, an ellipsis after a full stop, or an e-mail address.',
    '',
    `## Images not yet migrated: ${placeholders.size}`,
    '',
    placeholders.size
      ? 'Shown as labelled placeholders until the files are copied to public/ (`npm run fetch:media -- --download`, see docs/CONTENT-UPDATES.md).'
      : 'None: every image and photograph referenced by the content is in public/.',
    '',
    placeholders.size ? md([['Image', 'Pages'], ['---', '---'], ...[...placeholders].sort().map(([s, p]) => [code(s), [...p].slice(0, 4).map(code).join(', ') + (p.size > 4 ? ` +${p.size - 4}` : '')])]) : '',
    '',
    `## Markup checks: ${hygiene.length} problems`,
    '',
    hygiene.length ? md([['Page', 'Problem'], ['---', '---'], ...hygiene.map((h) => [code(h.page), h.problem])]) : 'None.',
    '',
  ].join('\n'),
);

console.log(JSON.stringify(counts, null, 2));
console.log(passed ? '\nVerification passed.' : '\nVerification FAILED — see reports/.');
if (!passed && !reportOnly) process.exit(1);
