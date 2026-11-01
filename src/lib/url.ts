/**
 * Helpers for links. Every internal URL in the codebase is written as a
 * root-relative path that matches the old WordPress site ("/administrative/");
 * `href()` adds the deployment base path (e.g. "/bilkent-cs-website/") so the
 * same content works on GitHub Pages project sites and on a custom domain.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

export function href(path: string): string {
  if (isExternal(path) || path.startsWith('#')) return path;
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${withSlash}`;
}

/** Path without the base, for comparing with the current page. */
export function stripBase(pathname: string): string {
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}
