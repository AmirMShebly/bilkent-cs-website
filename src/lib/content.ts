import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/ui';

export type Post = CollectionEntry<'posts'>['data'] | CollectionEntry<'pages'>['data'];

/** Latest posts in one language and category, newest first. */
export async function latestPosts(lang: Lang, category: string, limit: number): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => data.lang === lang && data.categories.includes(category));
  return posts
    .map((p) => p.data)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** First image in the body, used as the listing thumbnail (the export has no featured images). */
export function leadImage(post: Post): { src: string; alt: string } | null {
  const tag = post.html.match(/<img\b[^>]*>/i)?.[0];
  const src = tag?.match(/\bsrc="([^"]+)"/)?.[1];
  if (!tag || !src) return null;
  return { src, alt: tag.match(/\balt="([^"]*)"/)?.[1] ?? '' };
}

/** A shorter excerpt for compact listings: cut at a word, no ellipsis after a finished sentence. */
export function shortExcerpt(text: string, words: number): string {
  const all = text.split(' ').filter(Boolean);
  if (all.length <= words) return text;
  const cut = all.slice(0, words).join(' ').replace(/[,;:\-–—]+$/, '');
  return /[.!?…]["”’)]?$/.test(cut) ? cut : `${cut}…`;
}

export function formatDate(iso: string, lang: Lang, style: 'medium' | 'long' = 'medium'): string {
  // Dates in the export are local Ankara time without an offset; format them as written.
  return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${iso}Z`));
}
