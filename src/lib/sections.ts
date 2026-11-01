/**
 * Where a route sits in the site: breadcrumbs, the "In this section" menu and
 * the meta description. Sections come from the main menu (src/config/navigation.ts)
 * and from WordPress parent pages; nothing here invents a hierarchy that the
 * live site does not have.
 */
import { load } from 'cheerio';
import { isGroup, localize, mainNav, type NavGroup } from '@/config/navigation';
import { peoplePages } from '@/config/content-rules';
import { categories } from '@/config/categories';
import { isExternal } from '@/lib/url';
import type { LinkIndex } from '@/lib/links';
import type { Entry, Route, SiteIndex } from '@/lib/routes';
import { t, type Lang } from '@/i18n/ui';

export interface Crumb {
  label: string;
  path?: string;
}

export interface SectionLink {
  label: string;
  path: string;
  external?: boolean;
}

export interface Section {
  title: string;
  links: SectionLink[];
}

const homePath = (lang: Lang) => (lang === 'en' ? '/' : '/tr/');

const linkIndexes = new WeakMap<SiteIndex, LinkIndex>();

export function linkIndexOf(index: SiteIndex): LinkIndex {
  let links = linkIndexes.get(index);
  if (!links) {
    const routes = index.routes.filter((r) => r.kind !== 'redirect');
    links = {
      routePaths: new Set(routes.map((r) => r.path)),
      aliases: index.aliases,
      langOf: new Map(index.routes.map((r) => [r.path, r.lang])),
    };
    linkIndexes.set(index, links);
  }
  return links;
}

function menuGroupOf(path: string, lang: Lang): NavGroup | undefined {
  return mainNav.filter(isGroup).find((g) => g.children.some((c) => localize(c.href, lang) === path));
}

function parentOf(entry: Entry, index: SiteIndex): Entry | undefined {
  return entry.wpParentId ? index.pages.find((p) => p.wpId === entry.wpParentId) : undefined;
}

export function breadcrumbsFor(route: Route, index: SiteIndex): Crumb[] {
  const lang = route.lang;
  const crumbs: Crumb[] = [{ label: t(lang, 'nav.home'), path: homePath(lang) }];
  const groupCrumb = (path: string) => {
    const group = menuGroupOf(path, lang);
    if (group) crumbs.push({ label: group.label[lang] });
  };

  if (route.kind === 'page') {
    const parent = parentOf(route.entry, index);
    if (parent) {
      groupCrumb(parent.path);
      crumbs.push({ label: parent.title, path: parent.path });
    } else {
      groupCrumb(route.path);
    }
    crumbs.push({ label: route.title });
  } else if (route.kind === 'post') {
    const archive = categories[route.category][lang];
    groupCrumb(archive.path);
    crumbs.push({ label: archive.name, path: archive.path }, { label: route.title });
  } else if (route.kind === 'archive') {
    const root = categories[route.category][lang].path;
    groupCrumb(root);
    if (route.page > 1) crumbs.push({ label: route.title, path: root }, { label: t(lang, 'archive.page', { page: route.page }) });
    else crumbs.push({ label: route.title });
  }
  return crumbs;
}

export function sectionFor(route: Route, index: SiteIndex): Section | undefined {
  if (route.kind !== 'page') return undefined;
  const lang = route.lang;
  const entry = route.entry;

  // WordPress parent/child pages (the research areas). The parent page lists its
  // children itself, so the menu appears on the child pages only.
  const parent = parentOf(entry, index);
  if (parent) {
    const children = childrenInParentOrder(parent, index, lang);
    return {
      title: parent.title,
      links: [{ label: parent.title, path: parent.path }, ...children.map((c) => ({ label: c.title, path: c.path }))],
    };
  }
  if (index.pages.some((p) => p.wpParentId === entry.wpId)) return undefined;

  const group = menuGroupOf(route.path, lang);
  if (!group) return undefined;
  return {
    title: group.label[lang],
    links: group.children.map((c) => {
      const path = localize(c.href, lang);
      return { label: c.label[lang], path, external: isExternal(path) };
    }),
  };
}

/** Child pages in the order the parent page links them (the department's own order). */
export function childrenInParentOrder(parent: Entry, index: SiteIndex, lang: Lang): Entry[] {
  const $ = load(parent.html, null, false);
  const order = $('a[href]')
    .map((_, a) => $(a).attr('href') ?? '')
    .get()
    .map((href) => {
      const path = href.replace(/^https?:\/\/w3\.cs\.bilkent\.edu\.tr/, '').replace(/\/?$/, '/');
      return index.aliases.get(path) ?? path;
    });
  const rank = (p: Entry) => {
    const i = order.indexOf(p.path);
    return i < 0 ? 1000 + p.wpId : i;
  };
  return index.pages.filter((p) => p.wpParentId === parent.wpId && p.lang === lang).sort((a, b) => rank(a) - rank(b));
}

function clip(text: string, max: number, separator = ' '): string {
  const clean = text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = cut.lastIndexOf(separator);
  const kept = cut.slice(0, end > 0 ? end : cut.lastIndexOf(' ')).replace(/[,;:]$/, '').trim();
  // A finished sentence needs no ellipsis.
  return /[.!?…]["”’)]?$/.test(kept) && separator === ' ' ? kept : `${kept}…`;
}

/**
 * Meta description: the excerpt, else the start of the body. People pages list
 * names instead, so no contact details end up in search snippets.
 */
export function describe(entry: Entry, names?: string[], max = 160): string {
  if (peoplePages.has(entry.path) && names?.length) return clip(`${entry.title}: ${names.join(', ')}`, max, ', ');
  const text = clip(entry.excerpt ?? entry.summary, max);
  // Pages that are only a table (enrollment data) have no running text to quote.
  return text || `${entry.title} – ${t(entry.lang, 'site.title')}`;
}
