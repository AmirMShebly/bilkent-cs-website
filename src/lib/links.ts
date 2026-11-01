/**
 * Classifies and resolves URLs found in migrated content against the route
 * registry. Content links are written as root-relative WordPress paths; this
 * decides whether each one is a page of this site, a media file, an external
 * link, or a link that has no target anywhere.
 */
import { deadLinks, linkFixes, unresolvedInContent, type LinkFix } from '@/config/content-rules';
import { site } from '@/config/site';
import { isMediaAvailable } from '@/lib/media';

export interface LinkIndex {
  routePaths: Set<string>;
  aliases: Map<string, string>;
  /** Language of each route, to mark links that lead to the other language. */
  langOf: Map<string, 'en' | 'tr'>;
}

export type ResolvedLink =
  | { kind: 'internal'; path: string; suffix: string; alias?: string }
  | { kind: 'media'; path: string; available: boolean; legacyUrl: string }
  | { kind: 'external'; url: string; fix?: LinkFix }
  | { kind: 'fragment'; id: string }
  | { kind: 'mailto'; user: string; domain: string }
  | { kind: 'tel'; url: string }
  | { kind: 'unresolved'; original: string };

const LEGACY_HOSTS = /^(?:https?:)?\/\/w3\.cs\.bilkent\.edu\.tr(?=[/?#]|$)/i;

/** "/foo" and "/foo/" are the same WordPress page; files keep their extension. */
export function normalizePath(path: string): string {
  if (path === '' || path === '/') return '/';
  const last = path.split('/').pop() ?? '';
  return path.endsWith('/') || last.includes('.') ? path : `${path}/`;
}

export function resolveHref(raw: string, index: LinkIndex): ResolvedLink {
  const href = raw.trim();
  const fix = linkFixes[href];
  if (fix) return { kind: 'external', url: fix.to, fix };
  // External pages confirmed gone: keep the text, drop the link.
  if (deadLinks[href]) return { kind: 'unresolved', original: raw };

  if (/^mailto:/i.test(href)) {
    const address = decodeURIComponent(href.slice(7).split('?')[0] ?? '');
    const at = address.lastIndexOf('@');
    return at > 0
      ? { kind: 'mailto', user: address.slice(0, at), domain: address.slice(at + 1) }
      : { kind: 'unresolved', original: raw };
  }
  if (/^tel:/i.test(href)) return { kind: 'tel', url: href };
  if (href.startsWith('#')) return { kind: 'fragment', id: decodeURIComponent(href.slice(1)) };

  const stripped = href.replace(LEGACY_HOSTS, '');
  // "https://w3.cs.bilkent.edu.tr" or "...edu.tr?x" without a path means the site root.
  const local = stripped !== href && !stripped.startsWith('/') ? `/${stripped}` : stripped;
  if (/^[a-z][a-z0-9+.-]*:/i.test(local) || local.startsWith('//')) return { kind: 'external', url: href };
  if (!local.startsWith('/')) return { kind: 'unresolved', original: raw };

  const match = local.match(/^([^?#]*)([?#].*)?$/);
  const path = normalizePath(match?.[1] ?? '/');
  const suffix = match?.[2] ?? '';
  // WordPress query permalinks (?p=, ?page_id=, ?cat=) name an item by ID, not a page of this site.
  if (/^\?(?:p|page_id|cat|attachment_id)=/i.test(suffix)) return { kind: 'unresolved', original: raw };

  if (path.startsWith('/wp-content/')) {
    return { kind: 'media', path, available: isMediaAvailable(path), legacyUrl: `${site.legacyOrigin}${path}` };
  }
  if (unresolvedInContent[path]) return { kind: 'unresolved', original: raw };
  // WordPress matches slugs case-insensitively; all routes here are lower case.
  const lower = path.toLowerCase();
  if (index.routePaths.has(lower)) return { kind: 'internal', path: lower, suffix };
  const target = index.aliases.get(lower);
  if (target) return { kind: 'internal', path: target, suffix, alias: path };
  return { kind: 'unresolved', original: raw };
}
