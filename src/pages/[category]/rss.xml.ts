import type { APIRoute, GetStaticPaths } from 'astro';
import { categories, categoryKeys, type CategoryKey } from '@/config/categories';
import { feedResponse } from '@/lib/feeds';

/** /news/rss.xml, /announcements/rss.xml, /uncategorized/rss.xml */
export const getStaticPaths: GetStaticPaths = () =>
  categoryKeys.map((key) => ({ params: { category: categories[key].en.path.replaceAll('/', '') }, props: { key } }));

export const GET: APIRoute = ({ site, props }) => feedResponse(site, 'en', props.key as CategoryKey);
