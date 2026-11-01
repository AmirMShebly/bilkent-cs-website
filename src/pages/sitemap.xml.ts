import type { APIRoute } from 'astro';
import { getSiteIndex } from '@/lib/routes';
import { href } from '@/lib/url';

/** All indexable URLs with their language alternates. */
export const GET: APIRoute = async ({ site }) => {
  const index = await getSiteIndex();
  const abs = (path: string) => new URL(href(path), site).href;
  const urls = index.routes
    .filter((r) => r.kind !== 'redirect')
    .map((r) => {
      const alternates = index.alternates.get(r.path);
      const links =
        alternates?.en && alternates.tr
          ? Object.entries(alternates)
              .map(([lang, path]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${abs(path)}"/>`)
              .join('\n')
          : '';
      return `  <url>\n    <loc>${abs(r.path)}</loc>${links ? `\n${links}` : ''}\n  </url>`;
    });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
