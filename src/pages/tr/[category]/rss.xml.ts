import type { APIRoute, GetStaticPaths } from 'astro';
import { categories, categoryKeys, type CategoryKey } from '@/config/categories';
import { feedResponse } from '@/lib/feeds';

/** /tr/haberler/rss.xml, /tr/duyurular/rss.xml, /tr/siniflandirilmamis/rss.xml */
export const getStaticPaths: GetStaticPaths = () =>
  categoryKeys.map((key) => ({ params: { category: categories[key].tr.path.replace(/^\/tr\//, '').replaceAll('/', '') }, props: { key } }));

export const GET: APIRoute = ({ site, props }) => feedResponse(site, 'tr', props.key as CategoryKey);
