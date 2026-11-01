/**
 * Converts the filtered content dataset (migration/source/public_content.json,
 * made by `npm run dataset:prepare`) into the normalised JSON that the Astro
 * content collections read, and writes a content inventory report.
 *
 *   npm run import:content            # regenerate src/content/generated/ and docs/CONTENT-INVENTORY.md
 *   npm run import:content -- --check # fail if those files are not what the dataset produces
 *
 * The script never rewrites prose. It only:
 *   - strips Gutenberg block comments (<!-- wp:... -->) and keeps the HTML,
 *   - refuses datasets that still contain other HTML comments (hidden content
 *     on the live site, which dataset:prepare removes),
 *   - turns absolute links to the old site into root-relative paths,
 *   - records language, category, translation group and media references,
 *   - derives a plain-text summary (first words of the body) for listings,
 *   - flags blocks that cannot be migrated as-is.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { smartPunctuation } from '../src/lib/typography';

const ROOT = resolve(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');
const SOURCE = resolve(ROOT, process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'migration/source/public_content.json');
const OUT_DIR = resolve(ROOT, 'src/content/generated');
const REPORT = resolve(ROOT, 'docs/CONTENT-INVENTORY.md');
const OLD_ORIGINS = ['https://w3.cs.bilkent.edu.tr', 'http://w3.cs.bilkent.edu.tr'];
// WordPress builds automatic excerpts from the first 55 words.
const SUMMARY_WORDS = 55;

// Blocks whose markup survives as plain HTML.
const PORTABLE_BLOCKS = new Set([
  'paragraph', 'heading', 'list', 'list-item', 'image', 'group', 'separator',
  'table', 'spacer', 'columns', 'column', 'gallery',
]);

type Lang = 'en' | 'tr';
type Kind = 'page' | 'post';

interface WpTerm { domain: string; slug: string; name: string }
interface WpItem {
  title: string;
  slug: string;
  original_url: string;
  content_html_or_wp_blocks: string;
  excerpt: string;
  published_at: string;
  parent_post_id: string;
  original_post_id: string;
  categories: WpTerm[];
}
interface WpExport {
  site_url: string;
  generated_from: string;
  published_pages: WpItem[];
  published_posts: WpItem[];
  published_navigation_records: WpItem[];
}

export interface Entry {
  id: string;
  kind: Kind;
  lang: Lang;
  wpId: number;
  wpParentId: number | null;
  slug: string;
  path: string;
  title: string;
  publishedAt: string;
  /** Category slugs normalised to English (news, announcements, uncategorized). */
  categories: string[];
  /** Excerpt written in WordPress, if any. */
  excerpt: string | null;
  /** First words of the body text, for listings when no excerpt exists. */
  summary: string;
  translationGroup: string | null;
  html: string;
  media: string[];
  blocks: string[];
  flags: string[];
}

// Polylang gives each language its own category slug; map them to one key.
const CATEGORY_KEYS: Record<string, string> = {
  news: 'news',
  haberler: 'news',
  announcements: 'announcements',
  duyurular: 'announcements',
  uncategorized: 'uncategorized',
  siniflandirilmamis: 'uncategorized',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function toRootRelative(url: string): string {
  for (const origin of OLD_ORIGINS) {
    if (url.startsWith(origin)) return url.slice(origin.length) || '/';
  }
  return url;
}

function cleanHtml(raw: string, path: string): string {
  let html = raw.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
  if (/<!--/.test(html)) {
    throw new Error(`${path} contains hidden HTML comments. Prepare the dataset with npm run dataset:prepare, which removes them.`);
  }
  html = html.replace(/\b(href|src)="(https?:\/\/w3\.cs\.bilkent\.edu\.tr[^"]*)"/g,
    (_m, attr: string, url: string) => `${attr}="${toRootRelative(url)}"`);
  // srcset lists point at the same uploads; rewrite each candidate.
  html = html.replace(/\bsrcset="([^"]*)"/g, (_m, list: string) =>
    `srcset="${list.split(',').map((c) => toRootRelative(c.trim())).join(', ')}"`);
  return html.replace(/\n{3,}/g, '\n\n').trim();
}

const BLOCK = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'tr', 'td', 'th', 'table', 'blockquote', 'section', 'pre', 'dt', 'dd']);

/**
 * Running text for excerpts, as WordPress builds them: inline markup joins
 * without extra spaces, block boundaries become spaces, and images, captions,
 * embeds and tables are left out. E-mail addresses are dropped, because
 * excerpts end up in meta descriptions where the page's anti-harvesting markup
 * does not apply.
 */
function excerptText(html: string): string {
  const $ = load(html, null, false);
  $('figure, figcaption, iframe, script, style, .wp-block-embed, .wp-block-embed__wrapper, table, span.e-mail').remove();
  $('a[href^="mailto:"]').remove();
  const parts: string[] = [];
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') parts.push((node as unknown as { data: string }).data);
      else if (node.type === 'tag') {
        const block = BLOCK.has(node.name);
        if (block) parts.push(' ');
        walk(node.children);
        if (block) parts.push(' ');
      }
    }
  };
  walk($.root().toArray().flatMap((r) => ('children' in r ? r.children : [])));
  return decodeEntities(parts.join(''))
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();
}

/** The first SUMMARY_WORDS words; an ellipsis only when a sentence is cut. */
function summarise(text: string): string {
  const words = text.split(' ').filter(Boolean);
  if (words.length <= SUMMARY_WORDS) return words.join(' ');
  const cut = words.slice(0, SUMMARY_WORDS).join(' ').replace(/[,;:\-–—]+$/, '');
  return /[.!?…]["”’)]?$/.test(cut) ? cut : `${cut}…`;
}

function mediaRefs(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="(\/wp-content\/uploads\/[^"]+)"/g)) found.add(m[1]!);
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) {
    for (const candidate of m[1]!.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url?.startsWith('/wp-content/uploads/')) found.add(url);
    }
  }
  return [...found].sort();
}

function flagsFor(blocks: string[], html: string): string[] {
  const flags: string[] = [];
  const set = new Set(blocks);
  if (set.has('html')) flags.push('custom-html-block');
  if (set.has('embed')) flags.push('embed');
  if (set.has('latest-posts')) flags.push('dynamic-latest-posts');
  for (const b of set) {
    if (!PORTABLE_BLOCKS.has(b) && !['html', 'embed', 'latest-posts'].includes(b)) flags.push(`unhandled-block:${b}`);
  }
  if (/<iframe/i.test(html)) flags.push('iframe');
  if (/<script/i.test(html)) flags.push('inline-script');
  if (/<form/i.test(html)) flags.push('form');
  // WordPress shortcodes are lower-case: [name], [name key="v"], [/name].
  // "[at]"/"[dot]" are e-mail obfuscation and bracketed citations are not shortcodes.
  const text = html.replace(/<[^>]+>/g, '').replace(/\[(at|dot)\]/g, '');
  if (/\[\/?[a-z_][a-z0-9_-]*(\s+[a-z_-]+=("[^"]*"|'[^']*'|[^\s\]]+))*\s*\/?\]/.test(text)) flags.push('possible-shortcode');
  return flags;
}

function normalise(item: WpItem, kind: Kind): Entry {
  const terms = item.categories ?? [];
  const lang = (terms.find((t) => t.domain === 'language')?.slug ?? 'en') as Lang;
  const path = toRootRelative(item.original_url);
  const blocks = [...item.content_html_or_wp_blocks.matchAll(/<!--\s*wp:([a-z0-9/-]+)/g)].map((m) => m[1]!);
  const html = cleanHtml(item.content_html_or_wp_blocks, path);
  const excerpt = item.excerpt.trim() ? decodeEntities(item.excerpt.trim()) : null;
  const parent = Number(item.parent_post_id);
  return {
    id: path,
    kind,
    lang,
    wpId: Number(item.original_post_id),
    wpParentId: parent > 0 ? parent : null,
    slug: decodeURIComponent(item.slug),
    path,
    title: decodeEntities(item.title),
    publishedAt: item.published_at.replace(' ', 'T'),
    categories: [...new Set(terms.filter((t) => t.domain === 'category').map((t) => CATEGORY_KEYS[t.slug] ?? t.slug))],
    excerpt,
    summary: smartPunctuation(summarise(excerptText(html))),
    translationGroup: terms.find((t) => t.domain === 'post_translations')?.slug ?? null,
    html,
    media: mediaRefs(html),
    blocks: [...new Set(blocks)].sort(),
    flags: flagsFor(blocks, html),
  };
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function report(src: WpExport, pages: Entry[], posts: Entry[]): string {
  const all = [...pages, ...posts];
  const byGroup = new Map<string, Entry[]>();
  for (const e of all) if (e.translationGroup) byGroup.set(e.translationGroup, [...(byGroup.get(e.translationGroup) ?? []), e]);
  const counterpart = (e: Entry) => byGroup.get(e.translationGroup ?? '')?.find((o) => o.lang !== e.lang);
  const blockCounts = new Map<string, number>();
  for (const e of all) for (const b of e.blocks) blockCounts.set(b, (blockCounts.get(b) ?? 0) + 1);
  const media = new Set(all.flatMap((e) => e.media));

  const lines: string[] = [];
  lines.push('# Content inventory', '');
  lines.push(`Generated by \`npm run import:content\` from ${src.generated_from}. Do not edit by hand.`, '');
  lines.push('## Totals', '');
  lines.push('| Type | English | Turkish | Total |', '|---|---:|---:|---:|');
  for (const [label, list] of [['Pages', pages], ['Posts', posts]] as const) {
    lines.push(`| ${label} | ${list.filter((e) => e.lang === 'en').length} | ${list.filter((e) => e.lang === 'tr').length} | ${list.length} |`);
  }
  lines.push(`| Navigation records | | | ${src.published_navigation_records.length} |`);
  lines.push(`| Media files referenced in content | | | ${media.size} |`, '');

  lines.push('## Page routes', '');
  lines.push('Every route below must exist in the new site with the same path.', '');
  lines.push('| Path | Lang | Title | Counterpart | Flags |', '|---|---|---|---|---|');
  for (const p of [...pages].sort((a, b) => a.path.localeCompare(b.path))) {
    const other = counterpart(p);
    lines.push(`| \`${p.path}\` | ${p.lang} | ${escapeCell(p.title)} | ${other ? `\`${other.path}\`` : '**none**'} | ${p.flags.join(', ')} |`);
  }
  lines.push('');

  lines.push('## Post routes by category', '');
  const cats = new Map<string, Entry[]>();
  for (const p of posts) {
    const key = `${p.lang} / ${p.categories.join(', ') || '(none)'}`;
    cats.set(key, [...(cats.get(key) ?? []), p]);
  }
  lines.push('| Language / categories | Posts | Path pattern |', '|---|---:|---|');
  for (const [key, list] of [...cats].sort()) {
    const patterns = [...new Set(list.map((p) => p.path.replace(/[^/]+\/$/, '…/')))];
    lines.push(`| ${key} | ${list.length} | ${patterns.map((x) => `\`${x}\``).join(' ')} |`);
  }
  lines.push('');

  const untranslated = all.filter((e) => !counterpart(e));
  lines.push('## Content without a translation', '');
  lines.push(`${untranslated.length} items have no counterpart in the other language.`, '');
  for (const e of untranslated.sort((a, b) => a.path.localeCompare(b.path))) lines.push(`- \`${e.path}\` (${e.lang}, ${e.kind}) ${escapeCell(e.title)}`);
  lines.push('');

  lines.push('## Block usage', '');
  lines.push('| Block | Items using it | Migrates as plain HTML |', '|---|---:|---|');
  for (const [b, n] of [...blockCounts].sort((a, b) => b[1] - a[1])) lines.push(`| \`${b}\` | ${n} | ${PORTABLE_BLOCKS.has(b) ? 'yes' : '**review**'} |`);
  lines.push('');

  const flagged = all.filter((e) => e.flags.length);
  lines.push('## Items needing manual review', '');
  lines.push('| Path | Flags |', '|---|---|');
  for (const e of flagged.sort((a, b) => a.path.localeCompare(b.path))) lines.push(`| \`${e.path}\` | ${e.flags.join(', ')} |`);
  lines.push('');

  lines.push('## Hidden content', '');
  lines.push('Content hidden in HTML comments on the live site is removed when the dataset is prepared (`npm run dataset:prepare`) and is not stored in this repository. `migration/source/README.md` records how many comments were removed, and where.', '');

  lines.push('## Excerpts', '');
  lines.push(`${all.filter((e) => e.excerpt).length} of ${all.length} items have a WordPress excerpt. Listings fall back to the first ${SUMMARY_WORDS} words of the body.`, '');
  return lines.join('\n');
}

const src = JSON.parse(readFileSync(SOURCE, 'utf8')) as WpExport;
const pages = src.published_pages.map((p) => normalise(p, 'page'));
const posts = src.published_posts
  .map((p) => normalise(p, 'post'))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

const ids = new Set<string>();
for (const e of [...pages, ...posts]) {
  if (ids.has(e.id)) throw new Error(`Duplicate path ${e.id}`);
  ids.add(e.id);
}

const outputs: Array<[string, string]> = [
  [resolve(OUT_DIR, 'pages.json'), `${JSON.stringify(pages, null, 2)}\n`],
  [resolve(OUT_DIR, 'posts.json'), `${JSON.stringify(posts, null, 2)}\n`],
  [REPORT, report(src, pages, posts)],
];

if (CHECK) {
  // The committed files must be exactly what the dataset produces.
  const stale = outputs.filter(([file, content]) => !existsSync(file) || readFileSync(file, 'utf8') !== content);
  if (stale.length) {
    console.error(`Generated content is stale or was edited by hand: ${stale.map(([f]) => f.replace(`${ROOT}/`, '')).join(', ')}. Run npm run import:content and commit the result.`);
    process.exit(1);
  }
  console.log(`Generated content is up to date with ${SOURCE.replace(`${ROOT}/`, '')} (${pages.length} pages, ${posts.length} posts).`);
} else {
  for (const [file, content] of outputs) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  console.log(`Imported ${pages.length} pages and ${posts.length} posts from ${SOURCE}`);
  console.log(`Wrote ${OUT_DIR}/{pages,posts}.json and ${REPORT}`);
}
