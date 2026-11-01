// @ts-check
import { defineConfig } from 'astro/config';

/**
 * GitHub Pages serves a project site from https://<owner>.github.io/<repo>/,
 * so the base path must match the repository name. Both values come from the
 * environment so the same code builds for a project site, a user/organisation
 * site, or a custom domain. See README.md › Deployment.
 */
const site = process.env.SITE_URL ?? 'http://localhost:4321';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  // WordPress URLs end in a slash (/administrative/); keep that shape.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  i18n: {
    locales: ['en', 'tr'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
