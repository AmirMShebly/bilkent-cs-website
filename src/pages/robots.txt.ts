import type { APIRoute } from 'astro';
import { allowIndexing } from '@/lib/env';
import { href } from '@/lib/url';

export const GET: APIRoute = ({ site }) => {
  const rules = allowIndexing ? 'Allow: /' : 'Disallow: /';
  const body = `User-agent: *\n${rules}\n\nSitemap: ${new URL(href('/sitemap.xml'), site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
