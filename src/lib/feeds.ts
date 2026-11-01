/**
 * RSS 2.0 feeds for the news archives, replacing WordPress's /feed/ URLs
 * (GitHub Pages cannot serve XML at a directory URL, so feeds live at
 * …/rss.xml; the old /feed/ paths need a server-level redirect at cut-over).
 */
import { categories, type CategoryKey } from '@/config/categories';
import { getSiteIndex, type Entry } from '@/lib/routes';
import { href } from '@/lib/url';
import { t, type Lang } from '@/i18n/ui';

const ITEMS = 20;

const xml = (text: string) => text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** Publication times in the export are Ankara local time (UTC+3, no daylight saving since 2016). */
function rfc822(iso: string): string {
  return new Date(`${iso}+03:00`).toUTCString();
}

export async function feedResponse(site: URL | undefined, lang: Lang, category?: CategoryKey): Promise<Response> {
  const index = await getSiteIndex();
  const posts: Entry[] = index.posts.filter((p) => p.lang === lang && (!category || p.categories.includes(category))).slice(0, ITEMS);
  const abs = (path: string) => new URL(href(path), site).href;
  const name = category ? categories[category][lang].name : t(lang, 'site.department');
  const home = category ? categories[category][lang].path : lang === 'en' ? '/' : '/tr/';
  const self = `${home}rss.xml`;
  const items = posts
    .map(
      (p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${abs(p.path)}</link>
      <guid isPermaLink="true">${abs(p.path)}</guid>
      <pubDate>${rfc822(p.publishedAt)}</pubDate>
      <description>${xml(p.excerpt ?? p.summary)}</description>
    </item>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(t(lang, 'feed.title', { name }))}</title>
    <link>${abs(home)}</link>
    <atom:link href="${abs(self)}" rel="self" type="application/rss+xml"/>
    <description>${xml(category ? t(lang, 'meta.archive', { name }) : t(lang, 'meta.home'))}</description>
    <language>${lang === 'en' ? 'en' : 'tr'}</language>
${posts[0] ? `    <lastBuildDate>${rfc822(posts[0].publishedAt)}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
