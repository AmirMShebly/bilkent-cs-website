/**
 * Post categories and their archive URLs. Names are the WordPress category
 * names from the export; URLs follow the live permalink structure
 * (/%category%/%postname%/), with pagination at <archive>/page/<n>/.
 */
import type { Lang } from '@/i18n/ui';

export type CategoryKey = 'news' | 'announcements' | 'uncategorized';

export interface CategoryInfo {
  path: string;
  name: string;
  /** WordPress's own category archive URL (also live); it redirects to `path`. */
  wpPath: string;
}

export const categories: Record<CategoryKey, Record<Lang, CategoryInfo>> = {
  news: {
    en: { path: '/news/', name: 'News', wpPath: '/category/news/' },
    tr: { path: '/tr/haberler/', name: 'Haberler', wpPath: '/tr/category/haberler/' },
  },
  announcements: {
    en: { path: '/announcements/', name: 'Announcements', wpPath: '/category/announcements/' },
    // On the live site the Turkish archive is only at /tr/category/duyurular/ (/tr/duyurular/ is a 404).
    tr: { path: '/tr/duyurular/', name: 'Duyurular', wpPath: '/tr/category/duyurular/' },
  },
  uncategorized: {
    en: { path: '/uncategorized/', name: 'Uncategorized', wpPath: '/category/uncategorized/' },
    tr: { path: '/tr/siniflandirilmamis/', name: 'Sınıflandırılmamış', wpPath: '/tr/category/siniflandirilmamis/' },
  },
};

export const categoryKeys = Object.keys(categories) as CategoryKey[];

/** WordPress shows 10 posts per archive page. */
export const POSTS_PER_PAGE = 10;

/** The category a post's URL belongs to (its first path segment). */
export function categoryFromPath(path: string): CategoryKey {
  for (const key of categoryKeys) {
    for (const lang of ['en', 'tr'] as const) {
      if (path.startsWith(categories[key][lang].path)) return key;
    }
  }
  throw new Error(`No category matches post path ${path}`);
}

export function archivePagePath(key: CategoryKey, lang: Lang, page: number): string {
  const base = categories[key][lang].path;
  return page <= 1 ? base : `${base}page/${page}/`;
}
