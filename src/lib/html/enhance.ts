/**
 * Presentation structure for long content, applied after transformContent().
 * Wording and order never change; this only adds:
 *   - stable ids and anchor links on h2/h3, and a table of contents,
 *   - a class on "label lines" (a paragraph that is only bold text ending in ":"),
 *   - a class on the first paragraph of an article (the lead).
 */
import { load } from 'cheerio';
import type { Element } from 'domhandler';

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface Enhanced {
  html: string;
  toc: TocItem[];
}

export function slugify(text: string): string {
  return (
    text
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'section'
  );
}

export function enhanceHtml(html: string, options: { anchorLabel: string; leadParagraph?: boolean }): Enhanced {
  const $ = load(html, null, false);
  const used = new Set($('[id]').map((_, el) => $(el).attr('id')).get());
  const toc: TocItem[] = [];

  $('h2, h3').each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    let id = $el.attr('id');
    if (!id) {
      const base = slugify(text);
      id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      $el.attr('id', id);
    }
    $el.append(' ', $('<a class="anchor">#</a>').attr('href', `#${id}`).attr('aria-label', `${options.anchorLabel}: ${text}`));
    toc.push({ id, text, level: (el as Element).name === 'h2' ? 2 : 3 });
  });

  // Bold-only paragraphs ending in ":" introduce the list that follows.
  $('p').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const bold = $el.children('strong, b');
    if (bold.length === 1 && bold.text().trim() === text && text.endsWith(':')) $el.addClass('label-line');
  });

  if (options.leadParagraph) {
    const first = $.root().children('p').first();
    if (first.length && first.text().trim().length > 120) first.addClass('lead-paragraph');
  }

  return { html: $.html(), toc };
}
