/**
 * The route registry: every URL the site generates, built once from the
 * content collections. Pages, posts, archives and redirects all come from
 * here, so the catch-all route, the language switcher, breadcrumbs and the
 * sitemap agree on what exists.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  archivePagePath,
  categories,
  categoryFromPath,
  categoryKeys,
  POSTS_PER_PAGE,
  type CategoryKey,
} from '@/config/categories';
import { legacyRedirects, translationOverrides } from '@/config/content-rules';
import type { Lang } from '@/i18n/ui';

export type Entry = CollectionEntry<'pages'>['data'];

interface RouteBase {
  path: string;
  lang: Lang;
  title: string;
}

export interface HomeRoute extends RouteBase {
  kind: 'home';
}

export interface PageRoute extends RouteBase {
  kind: 'page';
  entry: Entry;
}

export interface PostRoute extends RouteBase {
  kind: 'post';
  entry: Entry;
  category: CategoryKey;
}

export interface ArchiveRoute extends RouteBase {
  kind: 'archive';
  category: CategoryKey;
  page: number;
  totalPages: number;
  total: number;
  posts: Entry[];
  /** The WordPress page this archive replaces (only /tr/haberler/). */
  sourcePage?: Entry;
}

export interface RedirectRoute extends RouteBase {
  kind: 'redirect';
  to: string;
  reason: string;
}

export type Route = HomeRoute | PageRoute | PostRoute | ArchiveRoute | RedirectRoute;

export interface SiteIndex {
  routes: Route[];
  byPath: Map<string, Route>;
  /** Paths of the language versions of each page, keyed by path. */
  alternates: Map<string, Partial<Record<Lang, string>>>;
  /** Old URL → current path, for redirect pages and link resolution. */
  aliases: Map<string, string>;
  pages: Entry[];
  posts: Entry[];
}

const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'tr' : 'en');

function byNewest(a: Entry, b: Entry): number {
  return b.publishedAt.localeCompare(a.publishedAt) || a.path.localeCompare(b.path);
}

function pairTranslations(entries: Entry[]): Map<string, Partial<Record<Lang, string>>> {
  const alternates = new Map<string, Partial<Record<Lang, string>>>();
  const link = (a: string, aLang: Lang, b: string, bLang: Lang) => {
    alternates.set(a, { ...alternates.get(a), [aLang]: a, [bLang]: b });
    alternates.set(b, { ...alternates.get(b), [bLang]: b, [aLang]: a });
  };

  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.translationGroup) groups.set(e.translationGroup, [...(groups.get(e.translationGroup) ?? []), e]);
  }
  for (const members of groups.values()) {
    for (const a of members) {
      const b = members.find((m) => m.lang !== a.lang);
      if (b) link(a.path, a.lang, b.path, b.lang);
    }
  }
  for (const [en, tr] of translationOverrides) link(en, 'en', tr, 'tr');
  return alternates;
}

async function build(): Promise<SiteIndex> {
  const pages = (await getCollection('pages')).map((c) => c.data);
  const posts = (await getCollection('posts')).map((c) => c.data).sort(byNewest);
  const alternates = pairTranslations([...pages, ...posts]);
  const routes: Route[] = [];

  routes.push({ kind: 'home', path: '/', lang: 'en', title: 'Home' });
  routes.push({ kind: 'home', path: '/tr/', lang: 'tr', title: 'Ana Sayfa' });
  alternates.set('/', { en: '/', tr: '/tr/' });
  alternates.set('/tr/', { en: '/', tr: '/tr/' });

  // Archives first: /tr/haberler/ is both a WordPress page and the Turkish news archive.
  const archivePaths = new Set<string>();
  for (const key of categoryKeys) {
    for (const lang of ['en', 'tr'] as const) {
      const members = posts.filter((p) => p.lang === lang && p.categories.includes(key));
      const totalPages = Math.max(1, Math.ceil(members.length / POSTS_PER_PAGE));
      const info = categories[key][lang];
      const sourcePage = pages.find((p) => p.path === info.path);
      for (let page = 1; page <= totalPages; page++) {
        const path = archivePagePath(key, lang, page);
        archivePaths.add(path);
        routes.push({
          kind: 'archive',
          path,
          lang,
          title: sourcePage?.title ?? info.name,
          category: key,
          page,
          totalPages,
          total: members.length,
          posts: members.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
          sourcePage,
        });
      }
    }
    // Only the first pages are translations of each other: later pages list
    // different posts in each language, so they fall back to the archive root.
    const en = archivePagePath(key, 'en', 1);
    const tr = archivePagePath(key, 'tr', 1);
    alternates.set(en, { en, tr });
    alternates.set(tr, { en, tr });
  }

  for (const entry of pages) {
    if (archivePaths.has(entry.path)) continue;
    routes.push({ kind: 'page', path: entry.path, lang: entry.lang, title: entry.title, entry });
  }
  for (const entry of posts) {
    routes.push({ kind: 'post', path: entry.path, lang: entry.lang, title: entry.title, entry, category: categoryFromPath(entry.path) });
  }

  const byPath = new Map<string, Route>();
  for (const r of routes) {
    if (byPath.has(r.path)) throw new Error(`Two routes generate ${r.path}`);
    byPath.set(r.path, r);
  }

  // Redirect pages for URLs WordPress answered without a page of its own.
  const aliases = new Map<string, string>();
  const addAlias = (from: string, to: string, reason: string) => {
    if (byPath.has(from) || aliases.has(from)) return;
    const target = byPath.get(to);
    if (!target) throw new Error(`Redirect ${from} → ${to}: target does not exist`);
    aliases.set(from, to);
    routes.push({ kind: 'redirect', path: from, lang: target.lang, title: target.title, to, reason });
  };
  for (const [from, to] of Object.entries(legacyRedirects)) addAlias(from, to, 'WordPress redirect on the live site');
  // WordPress's own category archive URLs, with their page/N/ pages.
  for (const r of [...routes]) {
    if (r.kind !== 'archive') continue;
    const wpPath = categories[r.category][r.lang].wpPath;
    addAlias(r.page === 1 ? wpPath : `${wpPath}page/${r.page}/`, r.path, 'WordPress category archive URL');
  }
  // The live theme links Turkish pages without the /tr prefix (/idari/); WordPress redirects them.
  for (const entry of pages) {
    if (entry.lang === 'tr') addAlias(entry.path.replace(/^\/tr\//, '/'), entry.path, 'Turkish page linked without /tr prefix');
  }
  for (const r of routes) if (r.kind === 'redirect') byPath.set(r.path, r);

  return { routes, byPath, alternates, aliases, pages, posts };
}

let cached: Promise<SiteIndex> | undefined;

export function getSiteIndex(): Promise<SiteIndex> {
  cached ??= build();
  return cached;
}

export interface SwitchTarget {
  path: string;
  /** False when the page has no translation and the link goes to a fallback. */
  exact: boolean;
  fallback?: 'home' | 'archive';
}

/** Where the language switcher should go, and whether that is an exact translation. */
export function languageTarget(index: SiteIndex, route: Route): SwitchTarget {
  const lang = otherLang(route.lang);
  const exact = index.alternates.get(route.path)?.[lang];
  if (exact) return { path: exact, exact: true };
  if (route.kind === 'archive' || route.kind === 'post') {
    return { path: categories[route.category][lang].path, exact: false, fallback: 'archive' };
  }
  return { path: lang === 'en' ? '/' : '/tr/', exact: false, fallback: 'home' };
}
