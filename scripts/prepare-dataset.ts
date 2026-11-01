/**
 * Builds the filtered content dataset the site is generated from,
 * migration/source/public_content.json, from either
 *   - a WordPress export file (Tools → Export → All content: a WXR .xml file), or
 *   - a content pack in the dataset's own JSON format.
 *
 *   npm run dataset:prepare -- path/to/wordpress-export.xml
 *
 * Only published pages, posts and navigation records are kept. Private,
 * draft, pending, scheduled, trashed and password-protected items, as well
 * as attachments and every other record type, are dropped. HTML comments
 * other than the WordPress block delimiters (<!-- wp:… -->) are removed:
 * on the live site they hide content, such as entries for former staff,
 * that must not be republished.
 *
 * Also writes migration/source/README.md with the provenance: the input's
 * SHA-256, counts, and how many comments were removed where. It never
 * records the removed text. The input file itself does not belong in the
 * repository.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { load } from 'cheerio';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'migration', 'source', 'public_content.json');
const README = join(ROOT, 'migration', 'source', 'README.md');

export interface Term {
  domain: string;
  slug: string;
  name: string;
}
export interface Item {
  title: string;
  slug: string;
  original_url: string;
  content_html_or_wp_blocks: string;
  excerpt: string;
  published_at: string;
  parent_post_id: string;
  original_post_id: string;
  categories: Term[];
}
export interface Dataset {
  site_name: string;
  site_url: string;
  generated_from: string;
  published_pages: Item[];
  published_posts: Item[];
  published_navigation_records: Item[];
}

const BLOCK_DELIMITER = /^<!--\s*\/?wp:/;

/** Removes HTML comments except WordPress block delimiters; returns the cleaned HTML and the number removed. */
export function stripComments(html: string): { html: string; removed: number } {
  let removed = 0;
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, (comment) => {
    if (BLOCK_DELIMITER.test(comment)) return comment;
    removed++;
    return '';
  });
  return { html: cleaned, removed };
}

// ---------------------------------------------------------------- WXR
function fromWxr(xml: string): { dataset: Dataset; excluded: Record<string, number> } {
  const $ = load(xml, { xml: true });
  const channel = $('rss > channel').first();
  const pubDate = new Date(channel.children('pubDate').text().trim());
  const dataset: Dataset = {
    site_name: channel.children('title').first().text().trim(),
    site_url: channel.children('link').first().text().trim().replace(/\/?$/, '/'),
    generated_from: `WordPress WXR export ${Number.isNaN(pubDate.getTime()) ? 'of unknown date' : pubDate.toISOString().slice(0, 10)}`,
    published_pages: [],
    published_posts: [],
    published_navigation_records: [],
  };
  const excluded: Record<string, number> = {};
  const lists: Record<string, Item[]> = { page: dataset.published_pages, post: dataset.published_posts, wp_navigation: dataset.published_navigation_records };

  channel.children('item').each((_, el) => {
    const item = $(el);
    const field = (name: string) => item.children(name.replace(':', '\\:')).first().text();
    const type = field('wp:post_type');
    const status = field('wp:status');
    const reason = !lists[type] ? `type ${type}` : status !== 'publish' ? `status ${status}` : field('wp:post_password') ? 'password-protected' : '';
    if (reason) {
      excluded[reason] = (excluded[reason] ?? 0) + 1;
      return;
    }
    lists[type]!.push({
      title: field('title'),
      slug: field('wp:post_name'),
      original_url: field('link').trim(),
      content_html_or_wp_blocks: field('content:encoded'),
      excerpt: field('excerpt:encoded'),
      published_at: field('wp:post_date'),
      parent_post_id: field('wp:post_parent') || '0',
      original_post_id: field('wp:post_id'),
      categories: item
        .children('category')
        .map((__, c) => ({ domain: $(c).attr('domain') ?? '', slug: $(c).attr('nicename') ?? '', name: $(c).text() }))
        .get(),
    });
  });
  return { dataset, excluded };
}

// ---------------------------------------------------------------- main
export interface Prepared {
  dataset: Dataset;
  /** Records of the WXR file that were left out, by reason. */
  excluded: Record<string, number>;
  /** Hidden HTML comments removed, by path. */
  removed: Array<[string, number]>;
}

/** Filters a WXR export or a content pack (as text) into the dataset. */
export function prepare(text: string): Prepared {
  const { dataset, excluded } = text.trimStart().startsWith('<') ? fromWxr(text) : { dataset: JSON.parse(text) as Dataset, excluded: {} };
  const removed: Array<[string, number]> = [];
  for (const list of [dataset.published_pages, dataset.published_posts, dataset.published_navigation_records]) {
    for (const item of list) {
      const { html, removed: n } = stripComments(item.content_html_or_wp_blocks);
      item.content_html_or_wp_blocks = html;
      if (n) removed.push([item.original_url.replace(/^https?:\/\/[^/]+/, ''), n]);
    }
  }
  return { dataset, excluded, removed };
}

function main(input: string): void {
  const raw = readFileSync(input);
  const { dataset, excluded, removed } = prepare(raw.toString('utf8'));

  const output = `${JSON.stringify(dataset, null, 2)}\n`;
  writeFileSync(OUT, output);
  const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

  const readme = [
    '# Content dataset',
    '',
    '`public_content.json` is the filtered content dataset the site is generated from (`npm run import:content`) and verified against (`npm run verify:content`, `npm run verify`). It is produced by `npm run dataset:prepare` and must not be edited by hand.',
    '',
    '| | |',
    '|---|---|',
    `| Source | ${dataset.generated_from} (\`${basename(input)}\`) |`,
    `| SHA-256 of the source file | \`${sha(raw)}\` |`,
    `| SHA-256 of public_content.json | \`${sha(output)}\` |`,
    `| Published pages | ${dataset.published_pages.length} |`,
    `| Published posts | ${dataset.published_posts.length} |`,
    `| Navigation records | ${dataset.published_navigation_records.length} |`,
    '',
    '## Filters applied',
    '',
    '- Only published pages, posts and navigation records are kept. Private, draft, pending, scheduled, trashed and password-protected items, attachments and every other record type are dropped.',
    '- HTML comments other than WordPress block delimiters are removed. On the live site they hide content (for example entries for former staff) that must not be republished. The removed text is not recorded anywhere in this repository.',
    '',
    Object.keys(excluded).length
      ? `Records left out of the source file: ${Object.entries(excluded).sort().map(([k, v]) => `${k}: ${v}`).join('; ')}.`
      : 'The source file was already a filtered pack of published content.',
    '',
    `HTML comments removed: ${removed.reduce((n, [, c]) => n + c, 0)}${removed.length ? `, on ${removed.map(([p, c]) => `\`${p}\` (${c})`).join(', ')}` : ''}.`,
    '',
    'The department keeps the original export. It must never be committed: it can contain private pages, drafts and hidden content.',
    '',
  ].join('\n');
  writeFileSync(README, readme);
  console.log(`${dataset.published_pages.length} pages, ${dataset.published_posts.length} posts, ${dataset.published_navigation_records.length} navigation records → migration/source/public_content.json`);
  console.log(`${removed.reduce((n, [, c]) => n + c, 0)} hidden HTML comments removed; excluded: ${JSON.stringify(excluded)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run dataset:prepare -- path/to/wordpress-export.xml');
    process.exit(1);
  }
  main(resolve(input));
}
