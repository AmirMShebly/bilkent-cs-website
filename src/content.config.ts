import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file } from 'astro/loaders';
import { smartPunctuation } from './lib/typography';

// Shape written by scripts/import-wordpress.ts.
const entry = z.object({
  kind: z.enum(['page', 'post']),
  lang: z.enum(['en', 'tr']),
  wpId: z.number(),
  wpParentId: z.number().nullable(),
  slug: z.string(),
  path: z.string().startsWith('/').endsWith('/'),
  // Shown with typographic quotes and dashes, as WordPress does on the live site.
  title: z.string().transform((title) => smartPunctuation(title)),
  publishedAt: z.string(),
  categories: z.array(z.string()),
  excerpt: z.string().nullable(),
  summary: z.string(),
  translationGroup: z.string().nullable(),
  html: z.string(),
  media: z.array(z.string()),
  blocks: z.array(z.string()),
  flags: z.array(z.string()),
});

export const collections = {
  pages: defineCollection({ loader: file('src/content/generated/pages.json'), schema: entry }),
  posts: defineCollection({ loader: file('src/content/generated/posts.json'), schema: entry }),
};
