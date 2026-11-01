/**
 * Self-test of `npm run dataset:prepare`. It writes the committed dataset
 * as a WordPress WXR export, adds records that must be dropped (a draft, a
 * private page, a password-protected post, a trashed post, an attachment, a
 * menu item) and a hidden HTML comment, converts the result back, and
 * requires the committed dataset exactly. It also checks that the committed
 * dataset contains no hidden HTML comments.
 *
 *   npm run test:dataset
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { prepare, stripComments, type Dataset, type Item } from './prepare-dataset';

const ROOT = resolve(import.meta.dirname, '..');
const dataset = JSON.parse(readFileSync(join(ROOT, 'migration', 'source', 'public_content.json'), 'utf8')) as Dataset;
const failures: string[] = [];
const expect = (ok: boolean, message: string) => void (ok || failures.push(message));

const cdata = (text: string) => `<![CDATA[${text.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function itemXml(item: Item, type: string, status = 'publish', password = ''): string {
  return [
    '<item>',
    `<title>${cdata(item.title)}</title>`,
    `<link>${item.original_url}</link>`,
    '<dc:creator><![CDATA[editor]]></dc:creator>',
    `<content:encoded>${cdata(item.content_html_or_wp_blocks)}</content:encoded>`,
    `<excerpt:encoded>${cdata(item.excerpt)}</excerpt:encoded>`,
    `<wp:post_id>${item.original_post_id}</wp:post_id>`,
    `<wp:post_date>${cdata(item.published_at)}</wp:post_date>`,
    `<wp:post_name>${cdata(item.slug)}</wp:post_name>`,
    `<wp:status>${cdata(status)}</wp:status>`,
    `<wp:post_parent>${item.parent_post_id}</wp:post_parent>`,
    `<wp:post_type>${cdata(type)}</wp:post_type>`,
    `<wp:post_password>${cdata(password)}</wp:post_password>`,
    ...item.categories.map((c) => `<category domain="${escapeAttr(c.domain)}" nicename="${escapeAttr(c.slug)}">${cdata(c.name)}</category>`),
    '</item>',
  ].join('\n');
}

const date = dataset.generated_from.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '2026-11-01';
const sample = dataset.published_pages[0]!;
const decoy = (title: string): Item => ({ ...sample, title, slug: title.toLowerCase().replace(/\W+/g, '-'), original_post_id: '999999' });
const secret = 'Former Staff Member, e-mail: former@example.org';
const withComment = { ...sample, content_html_or_wp_blocks: `${sample.content_html_or_wp_blocks}<!-- ${secret} -->` };

const wxr = [
  '<?xml version="1.0" encoding="UTF-8" ?>',
  '<rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wfw="http://wellformedweb.org/CommentAPI/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">',
  '<channel>',
  `<title>${dataset.site_name}</title>`,
  `<link>${dataset.site_url.replace(/\/$/, '')}</link>`,
  `<pubDate>${new Date(`${date}T12:00:00Z`).toUTCString()}</pubDate>`,
  '<wp:wxr_version>1.2</wp:wxr_version>',
  itemXml(withComment, 'page'),
  ...dataset.published_pages.slice(1).map((i) => itemXml(i, 'page')),
  ...dataset.published_posts.map((i) => itemXml(i, 'post')),
  ...dataset.published_navigation_records.map((i) => itemXml(i, 'wp_navigation')),
  itemXml(decoy('Draft page'), 'page', 'draft'),
  itemXml(decoy('Private page'), 'page', 'private'),
  itemXml(decoy('Trashed post'), 'post', 'trash'),
  itemXml(decoy('Protected post'), 'post', 'publish', 'secret-password'),
  itemXml(decoy('Photo'), 'attachment', 'inherit'),
  itemXml(decoy('Menu item'), 'nav_menu_item', 'publish'),
  '</channel>',
  '</rss>',
].join('\n');

const result = prepare(wxr);
for (const key of ['published_pages', 'published_posts', 'published_navigation_records'] as const) {
  const got = result.dataset[key];
  const want = dataset[key];
  expect(got.length === want.length, `${key}: ${got.length} records, expected ${want.length}`);
  const firstDiff = want.findIndex((item, i) => !isDeepStrictEqual(item, got[i]));
  expect(firstDiff < 0, `${key}: record ${firstDiff} (${want[firstDiff]?.original_url}) differs after the WXR round trip`);
}
expect(result.dataset.site_url === dataset.site_url, `site_url ${result.dataset.site_url}`);
expect(result.dataset.generated_from === dataset.generated_from, `generated_from "${result.dataset.generated_from}"`);
expect(
  isDeepStrictEqual(result.excluded, { 'password-protected': 1, 'status draft': 1, 'status private': 1, 'status trash': 1, 'type attachment': 1, 'type nav_menu_item': 1 }),
  `excluded ${JSON.stringify(result.excluded)}`,
);
expect(result.removed.length === 1 && result.removed[0]![1] === 1, `removed comments ${JSON.stringify(result.removed)}`);
expect(!JSON.stringify(result.dataset).includes(secret), 'the hidden comment text survived the conversion');
expect(stripComments('<!-- wp:paragraph --><p>x</p><!-- hidden --><!-- /wp:paragraph -->').html === '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->', 'stripComments changed a block delimiter');

// The committed dataset itself must hold no hidden comments.
for (const item of [...dataset.published_pages, ...dataset.published_posts, ...dataset.published_navigation_records]) {
  expect(stripComments(item.content_html_or_wp_blocks).removed === 0, `hidden HTML comment in the committed dataset: ${item.original_url}`);
}

if (failures.length) {
  console.error(`Dataset self-test FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Dataset self-test passed: WXR round trip of ${dataset.published_pages.length + dataset.published_posts.length + dataset.published_navigation_records.length} records, 6 excluded records, hidden comments removed.`);
