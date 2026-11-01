/**
 * Checks the generated content (src/content/generated/*.json) against the
 * filtered source dataset (migration/source/public_content.json), field by
 * field, without using the importer's code:
 *   - every published page and post has exactly one generated entry, and no
 *     entry exists without a source item;
 *   - path, slug, language, parent, date, categories, translation group,
 *     title and excerpt match the source;
 *   - the body has the same text, the same links and the same images as the
 *     source (only the old site's origin may be removed from URLs);
 *   - the media list matches the uploads the body references;
 *   - no hidden HTML comments and no unexpected fields are present;
 *   - the dataset is the one recorded in migration/source/README.md;
 *   - every file in public/wp-content/uploads/ is used, and every used file exists.
 *
 *   npm run verify:content     (also runs the importer's --check and the dataset self-test)
 *
 * Exits with an error on any difference, so stale or edited content fails CI.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { load } from 'cheerio';
import { categories } from '../src/config/categories';
import { footerQuickLinks } from '../src/config/navigation';
import { homeInfoCards, site } from '../src/config/site';

const ROOT = resolve(import.meta.dirname, '..');
const REPORTS = process.env.VERIFY_REPORTS ?? join(ROOT, 'reports');
const DATASET = join(ROOT, 'migration', 'source', 'public_content.json');
const OLD_ORIGIN = /^https?:\/\/w3\.cs\.bilkent\.edu\.tr(?=\/|$)/;

interface Term { domain: string; slug: string; name: string }
interface SourceItem {
  title: string; slug: string; original_url: string; content_html_or_wp_blocks: string; excerpt: string;
  published_at: string; parent_post_id: string; original_post_id: string; categories: Term[];
}
interface Entry {
  id: string; kind: string; lang: string; wpId: number; wpParentId: number | null; slug: string; path: string;
  title: string; publishedAt: string; categories: string[]; excerpt: string | null; summary: string;
  translationGroup: string | null; html: string; media: string[]; blocks: string[]; flags: string[];
}

const problems: string[] = [];
const fail = (where: string, what: string) => void problems.push(`${where}: ${what}`);

// ---------------------------------------------------------------- dataset integrity
const raw = readFileSync(DATASET);
const recorded = readFileSync(join(ROOT, 'migration', 'source', 'README.md'), 'utf8').match(/SHA-256 of public_content\.json \| `([0-9a-f]{64})`/)?.[1];
const actualHash = createHash('sha256').update(raw).digest('hex');
if (recorded !== actualHash) fail('migration/source/public_content.json', `SHA-256 ${actualHash} does not match the one recorded in migration/source/README.md (${recorded ?? 'none'}); regenerate it with npm run dataset:prepare`);
const dataset = JSON.parse(raw.toString('utf8')) as { published_pages: SourceItem[]; published_posts: SourceItem[] };

// ---------------------------------------------------------------- helpers (independent of the importer)
const decode = (text: string) => load(`<p>${text}</p>`, null, false)('p').text();
const local = (url: string) => url.trim().replace(OLD_ORIGIN, '') || '/';
const withoutBlockComments = (html: string) => html.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
const hiddenComment = (html: string) => /<!--/.test(withoutBlockComments(html));

/** Text nodes in order, whitespace collapsed (comments are not text). */
function words(html: string): string {
  const $ = load(html, null, false);
  const out: string[] = [];
  const walk = (nodes: ReturnType<typeof $>['0'][]) => {
    for (const node of nodes) {
      if (!node) continue;
      if (node.type === 'text') out.push((node as unknown as { data: string }).data);
      else if ('children' in node) walk(node.children as never);
    }
  };
  walk($.root().toArray() as never);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function references(html: string): { links: string[]; images: string[]; srcsets: string[] } {
  const $ = load(html, null, false);
  return {
    links: $('a[href]').map((_, a) => local($(a).attr('href')!)).get(),
    images: $('img').map((_, i) => local($(i).attr('src') ?? '')).get(),
    srcsets: $('[srcset]').map((_, i) => ($(i).attr('srcset') ?? '').split(',').map((c) => local(c.trim())).join(', ')).get(),
  };
}

function uploads(html: string): string[] {
  const $ = load(html, null, false);
  const found = new Set<string>();
  $('[href], [src], [srcset]').each((_, el) => {
    const attrs = [$(el).attr('href'), $(el).attr('src'), ...($(el).attr('srcset') ?? '').split(',').map((c) => c.trim().split(/\s+/)[0])];
    for (const value of attrs) {
      const path = value ? local(value) : '';
      if (path.startsWith('/wp-content/uploads/')) found.add(path);
    }
  });
  return [...found].sort();
}

// Category slugs of each language, from the archive configuration.
const categoryKey = new Map<string, string>();
for (const [key, byLang] of Object.entries(categories)) {
  for (const cat of Object.values(byLang)) categoryKey.set(cat.wpPath.replace(/\/$/, '').split('/').pop()!, key);
}

const EXPECTED_FIELDS = ['blocks', 'categories', 'excerpt', 'flags', 'html', 'id', 'kind', 'lang', 'media', 'path', 'publishedAt', 'slug', 'summary', 'title', 'translationGroup', 'wpId', 'wpParentId'];

// ---------------------------------------------------------------- compare
let compared = 0;
for (const [kind, items, file] of [
  ['page', dataset.published_pages, 'pages.json'],
  ['post', dataset.published_posts, 'posts.json'],
] as const) {
  const generated = JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'generated', file), 'utf8')) as Entry[];
  const byId = new Map<number, Entry[]>();
  for (const e of generated) byId.set(e.wpId, [...(byId.get(e.wpId) ?? []), e]);
  const sourceIds = new Set(items.map((i) => Number(i.original_post_id)));
  for (const e of generated) if (!sourceIds.has(e.wpId)) fail(`${file} ${e.path}`, `no ${kind} with WordPress ID ${e.wpId} in the dataset`);

  for (const item of items) {
    const where = `${kind} ${local(item.original_url)}`;
    if (hiddenComment(item.content_html_or_wp_blocks)) fail(where, 'the dataset still contains a hidden HTML comment');
    const matches = byId.get(Number(item.original_post_id)) ?? [];
    if (matches.length !== 1) {
      fail(where, `${matches.length} generated entries for WordPress ID ${item.original_post_id}`);
      continue;
    }
    const e = matches[0]!;
    compared++;
    const terms = item.categories ?? [];
    const expect = <T>(field: string, got: T, want: T) => {
      if (JSON.stringify(got) !== JSON.stringify(want)) fail(where, `${field} is ${JSON.stringify(got)?.slice(0, 120)}, the source says ${JSON.stringify(want)?.slice(0, 120)}`);
    };
    const fields = Object.keys(e).sort();
    if (JSON.stringify(fields) !== JSON.stringify(EXPECTED_FIELDS)) fail(where, `unexpected fields: ${fields.filter((f) => !EXPECTED_FIELDS.includes(f)).join(', ') || 'missing fields'}`);
    expect('kind', e.kind, kind);
    expect('path', e.path, local(item.original_url));
    expect('id', e.id, local(item.original_url));
    expect('slug', e.slug, decodeURIComponent(item.slug));
    expect('lang', e.lang, terms.find((t) => t.domain === 'language')?.slug ?? 'en');
    expect('wpParentId', e.wpParentId, Number(item.parent_post_id) > 0 ? Number(item.parent_post_id) : null);
    expect('publishedAt', e.publishedAt, item.published_at.replace(' ', 'T'));
    expect('categories', [...e.categories].sort(), [...new Set(terms.filter((t) => t.domain === 'category').map((t) => categoryKey.get(t.slug) ?? t.slug))].sort());
    expect('translationGroup', e.translationGroup, terms.find((t) => t.domain === 'post_translations')?.slug ?? null);
    expect('title', e.title, decode(item.title));
    expect('excerpt', e.excerpt, item.excerpt.trim() ? decode(item.excerpt.trim()) : null);
    if (/<!--/.test(e.html)) fail(where, 'generated HTML contains an HTML comment');
    expect('body text', words(e.html), words(withoutBlockComments(item.content_html_or_wp_blocks)));
    const got = references(e.html);
    const want = references(withoutBlockComments(item.content_html_or_wp_blocks));
    expect('links', got.links, want.links);
    expect('images', got.images, want.images);
    expect('srcset', got.srcsets, want.srcsets);
    expect('media', e.media, uploads(item.content_html_or_wp_blocks));
  }
}

// ---------------------------------------------------------------- media files
const used = new Set<string>([site.emblem, ...homeInfoCards.map((c) => c.image.src)]);
for (const link of footerQuickLinks) {
  const href = typeof link.href === 'string' ? link.href : link.href.en;
  if (href.startsWith('/wp-content/uploads/')) used.add(href);
}
for (const file of ['pages.json', 'posts.json']) {
  for (const e of JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'generated', file), 'utf8')) as Entry[]) e.media.forEach((m) => used.add(m));
}
const walk = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)])) : [];
const shipped = new Set(walk(join(ROOT, 'public', 'wp-content', 'uploads')).map((f) => `/${relative(join(ROOT, 'public'), f).split('\\').join('/')}`));
for (const m of used) if (!shipped.has(decodeURI(m)) && !shipped.has(m)) fail('media', `${m} is used but missing from public/`);
for (const f of shipped) if (!used.has(f) && !used.has(encodeURI(f))) fail('media', `${f} is in public/ but nothing published uses it (remove it, or it may expose unpublished material)`);

// ---------------------------------------------------------------- report
mkdirSync(REPORTS, { recursive: true });
const md = [
  '# Generated content against the source dataset',
  '',
  `Generated by \`npm run verify:content\`. ${compared} pages and posts compared field by field with \`migration/source/public_content.json\` (SHA-256 \`${actualHash}\`), and ${shipped.size} media files with what the content and templates use.`,
  '',
  problems.length ? `## Problems: ${problems.length}\n\n${problems.map((p) => `- ${p}`).join('\n')}` : 'No differences: every generated entry matches its source item, and every shipped media file is used.',
  '',
].join('\n');
writeFileSync(join(REPORTS, 'content-source.md'), md);

if (problems.length) {
  console.error(`Content verification FAILED (${problems.length}):\n- ${problems.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`Content verification passed: ${compared} items match the dataset; ${shipped.size} media files all used and present.`);
