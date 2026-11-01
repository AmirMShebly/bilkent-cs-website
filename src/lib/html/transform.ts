/**
 * Turns imported WordPress HTML into the HTML this site publishes. It changes
 * markup and punctuation, never wording:
 *   - links resolve against the route registry (base path, old URLs, fixes);
 *     media that has not been migrated links to its file on the legacy site,
 *     and links with no target anywhere become plain text,
 *   - e-mail addresses keep the live site's anti-harvesting markup,
 *   - images that have not been migrated become labelled placeholders,
 *   - third-party embeds load only when the reader asks for them,
 *   - tables scroll horizontally on small screens; a plain label row becomes a header,
 *   - heading levels start at h2 under the page title, without inline font sizes,
 *   - quotes, apostrophes and dashes are set typographically, as on the live site,
 *   - scripts, inline event handlers and javascript: URLs are removed.
 * Data attributes mark every substitution so `npm run verify` can report them.
 */
import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element, Text } from 'domhandler';
import { resolveHref, type LinkIndex } from '@/lib/links';
import { isMediaAvailable } from '@/lib/media';
import { mediaRecord } from '@/lib/images';
import { imageText, imageTextLabel } from '@/config/image-text';
import { escapeHtml, missingMediaHtml } from '@/lib/placeholder';
import { smartPunctuation } from '@/lib/typography';
import { href as withBase } from '@/lib/url';
import { languages, t, type Lang } from '@/i18n/ui';

export interface TransformOptions {
  lang: Lang;
  index: LinkIndex;
}

export function transformContent(html: string, options: TransformOptions): string {
  const $ = load(html, null, false);
  removeComments($.root().toArray());
  sanitize($);
  convertEmails($);
  dropEmptyLinks($);
  rewriteLinks($, options);
  describeImages($, options);
  rewriteImages($, options);
  convertEmbeds($, options);
  promoteHeaderRows($);
  classifyTables($);
  wrapTables($, options);
  normalizeHeadings($);
  markLinkLists($);
  typeset($);
  return $.html();
}

function removeComments(nodes: AnyNode[]): void {
  for (const node of nodes) {
    if (node.type === 'comment') {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      continue;
    }
    if ('children' in node) removeComments([...node.children]);
  }
}

/** Defence in depth: the export has none of these, but nothing executable is ever published. */
function sanitize($: CheerioAPI): void {
  $('script, style, object, embed, form, input, button, textarea, select').remove();
  $('*').each((_, el) => {
    for (const name of Object.keys((el as Element).attribs)) {
      const value = (el as Element).attribs[name] ?? '';
      if (/^on/i.test(name) || (/^(href|src|action|formaction|xlink:href)$/i.test(name) && /^\s*javascript:/i.test(value))) {
        $(el).removeAttr(name);
      }
    }
  });
}

/** Markup for an address; scripts/enhance turns it into a mailto link. */
export function emailHtml(user: string, domain: string, label?: string): string {
  return `<span class="email" data-user="${escapeHtml(user)}" data-domain="${escapeHtml(domain)}">${label ? escapeHtml(label) : ''}</span>`;
}

function convertEmails($: CheerioAPI): void {
  // The live site renders <span class="e-mail" data-user data-website> with CSS.
  $('span.e-mail[data-user][data-website]').each((_, el) => {
    const $el = $(el);
    $el.replaceWith(emailHtml($el.attr('data-user')!, $el.attr('data-website')!));
  });
  // ...and rewrites every mailto link into that form in the browser.
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href')!.trim();
    if (!/^mailto:/i.test(href)) return;
    const address = decodeURIComponent(href.slice(7).split('?')[0] ?? '');
    const at = address.lastIndexOf('@');
    if (at <= 0) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    $el.replaceWith(emailHtml(address.slice(0, at), address.slice(at + 1), text && text !== address ? text : undefined));
  });
}

/**
 * Anchors with no text and no image are invisible on the live site (most point
 * to deleted multisite uploads). Anchors that hold an e-mail address or serve
 * as a fragment target (id/name) are kept.
 */
function dropEmptyLinks($: CheerioAPI): void {
  $('a').each((_, el) => {
    const $el = $(el);
    if ($el.attr('id') || $el.attr('name')) return;
    if ($el.text().trim() === '' && $el.find('img, svg, picture, iframe, video, span.email').length === 0) $el.remove();
  });
}

const STRONG_TURKISH = /[ğĞşŞıİ]/;

function rewriteLinks($: CheerioAPI, { lang, index }: TransformOptions): void {
  const ids = new Set($('[id], a[name]').map((_, el) => $(el).attr('id') ?? $(el).attr('name')).get());
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const original = $el.attr('href')!;
    const link = resolveHref(original, index);
    switch (link.kind) {
      case 'internal': {
        $el.attr('href', withBase(link.path) + link.suffix);
        // Mark links that lead to a page in the other language.
        const targetLang = index.langOf.get(link.path);
        if (targetLang && targetLang !== lang) {
          $el.attr('hreflang', languages[targetLang].htmlLang);
          if (targetLang === 'tr' && STRONG_TURKISH.test($el.text())) $el.attr('lang', 'tr');
        }
        break;
      }
      case 'media':
        if (link.available) {
          $el.attr('href', withBase(link.path));
        } else {
          $el.attr('href', link.legacyUrl).attr('data-legacy-media', '');
        }
        break;
      case 'external':
        $el.attr('href', link.url);
        if (link.fix) $el.attr('data-link-fixed', original);
        break;
      case 'fragment':
        if (!ids.has(link.id)) $el.attr('data-missing-fragment', '');
        break;
      case 'mailto':
      case 'tel':
        break;
      case 'unresolved':
        $el.replaceWith(
          `<span class="link-unresolved" data-original-href="${escapeHtml(original)}" title="${escapeHtml(t(lang, 'link.unresolved'))}">${$el.html() ?? ''}</span>`,
        );
        return;
    }
    if ($el.attr('target') === '_blank') $el.attr('rel', 'noopener noreferrer');
  });
}

/** Rendered width of an image in the source: the width attribute or an inline style width. */
function sourceWidth($img: Cheerio<Element>): number | undefined {
  const fromAttr = Number.parseInt($img.attr('width') ?? '', 10);
  const fromStyle = Number.parseFloat(($img.attr('style') ?? '').match(/(?:^|;)\s*width\s*:\s*([\d.]+)px/i)?.[1] ?? '');
  const width = Number.isFinite(fromStyle) && fromStyle > 0 ? fromStyle : fromAttr;
  return Number.isFinite(width) && width > 0 && width <= 600 ? Math.round(width) : undefined;
}

function fileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url, 'https://example.org').pathname.split('/').filter(Boolean).pop() ?? url);
  } catch {
    return url;
  }
}

/**
 * Images that carry information get the text alternative transcribed in
 * src/config/image-text.ts: an alt attribute, and for diagrams, posters and
 * award photographs a collapsible text version right after the image.
 */
function describeImages($: CheerioAPI, { lang }: TransformOptions): void {
  $('img').each((_, el) => {
    const $el = $(el as Element);
    const entry = imageText[($el.attr('src') ?? '').trim()];
    if (!entry) return;
    const alt = entry.alt[lang] ?? entry.alt.en ?? entry.alt.tr;
    if (alt && !$el.attr('alt')?.trim()) $el.attr('alt', alt);
    const text = entry.text?.[lang] ?? entry.text?.en ?? entry.text?.tr;
    if (!text) return;
    const textLang = entry.text?.[lang] ? '' : ` lang="${entry.text?.en ? 'en' : 'tr'}"`;
    const anchor = $el.closest('figure').length ? $el.closest('figure') : $el.closest('a').length ? $el.closest('a') : $el;
    anchor.after(`<details class="image-text"${textLang}><summary>${escapeHtml(imageTextLabel[lang])}</summary><div class="image-text__body">${text}</div></details>`);
  });
}

function rewriteImages($: CheerioAPI, { lang }: TransformOptions): void {
  $('img').each((_, el) => {
    const $el = $(el as Element);
    const src = ($el.attr('src') ?? '').trim();
    if ($el.attr('alt') === undefined) $el.attr('alt', '');
    if (!src.startsWith('/wp-content/')) {
      $el.attr('loading', 'lazy').attr('decoding', 'async');
      return;
    }
    if (!isMediaAvailable(src)) {
      // A placeholder inside a link says where the link goes, so the link stays usable.
      const link = $el.closest('a[href]');
      const target = link.length ? fileName(link.attr('href')!) : undefined;
      const label = target ? `${t(lang, 'media.missing')} · ${target}` : t(lang, 'media.missing');
      $el.replaceWith(
        missingMediaHtml({
          src,
          alt: $el.attr('alt') || (target ?? ''),
          label,
          width: sourceWidth($el),
          className: link.length ? 'media--linked' : undefined,
        }),
      );
      return;
    }
    const link = $el.closest('a[href]');
    if (link.length && !$el.attr('alt') && !link.text().trim() && !link.attr('aria-label')) {
      // The source gives this linked image no text; name the link after its target so it can be followed.
      link.attr('aria-label', t(lang, 'content.linkedFile', { name: fileName(link.attr('href')!) }));
    }
    $el.attr('src', withBase(src)).attr('loading', 'lazy').attr('decoding', 'async');
    // Optimised WebP variants (npm run media:process) replace WordPress's own size list.
    const record = mediaRecord(src);
    if (record?.variants.length) {
      const widest = record.variants.at(-1)!;
      $el.attr('src', withBase(widest.src));
      $el.attr('srcset', record.variants.map((v) => `${withBase(v.src)} ${v.width}w`).join(', '));
      const shown = sourceWidth($el);
      $el.attr('sizes', shown ? `${shown}px` : '(min-width: 64em) 760px, 100vw');
      if (!$el.attr('width') && !$el.attr('style')) $el.attr('width', String(record.width)).attr('height', String(record.height));
      return;
    }
    const srcset = $el.attr('srcset');
    if (srcset) {
      const kept = srcset
        .split(',')
        .map((c) => c.trim().split(/\s+/))
        .filter(([url]) => url && isMediaAvailable(url))
        .map(([url, size]) => [withBase(url!), size].filter(Boolean).join(' '));
      if (kept.length) $el.attr('srcset', kept.join(', '));
      else $el.removeAttr('srcset').removeAttr('sizes');
    }
  });
}

interface EmbedInfo {
  provider: string;
  url: string;
  /** Embeddable iframe URL; absent for providers that need their own script. */
  frameSrc?: string;
  ratio: string;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** YouTube start offsets: t=90, t=1m30s or start=90. */
function youtubeStart(url: string): number | undefined {
  const value = url.match(/[?&#](?:t|start)=([\dhms]+)/)?.[1];
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const [, h = '0', m = '0', s = '0'] = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/) ?? [];
  const total = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return total || undefined;
}

function describeEmbed(url: string, frameSrc?: string): EmbedInfo {
  const h = host(url);
  const id = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  if (id && /(^|\.)youtube\.com$|^youtu\.be$/.test(h)) {
    const start = youtubeStart(url);
    return { provider: 'YouTube', url, frameSrc: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`, ratio: '16 / 9' };
  }
  if (/(^|\.)linkedin\.com$/.test(h)) return { provider: 'LinkedIn', url, frameSrc: frameSrc ?? url, ratio: '504 / 622' };
  if (/(^|\.)twitter\.com$|^x\.com$/.test(h)) return { provider: 'X (Twitter)', url, ratio: '16 / 9' };
  return { provider: h || url, url, frameSrc, ratio: '16 / 9' };
}

function embedHtml(info: EmbedInfo, lang: Lang, title: string, caption: string): string {
  const { provider, url, frameSrc, ratio } = info;
  const link = `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
  const extra = caption ? `<span class="embed__text">${caption}</span> ` : '';
  if (!frameSrc) {
    return `<figure class="embed embed--link"><figcaption class="embed__caption">${extra}<span class="embed__provider">${escapeHtml(provider)}</span> ${link}</figcaption></figure>`;
  }
  return (
    `<figure class="embed" data-embed-src="${escapeHtml(frameSrc)}" data-embed-title="${escapeHtml(title || provider)}" style="--embed-ratio: ${ratio}">` +
    `<div class="embed__frame"><p class="embed__notice">${escapeHtml(t(lang, 'embed.notice', { provider }))}</p>` +
    `<button type="button" class="embed__load" hidden>${escapeHtml(t(lang, 'embed.load', { provider }))}</button></div>` +
    `<figcaption class="embed__caption">${extra}<span class="embed__provider">${escapeHtml(provider)}</span> ${link}</figcaption></figure>`
  );
}

function convertEmbeds($: CheerioAPI, { lang }: TransformOptions): void {
  $('figure.wp-block-embed').each((_, el) => {
    const $el = $(el);
    if ($el.find('iframe').length) return; // handled below with other iframes
    const url = $el.find('.wp-block-embed__wrapper').text().trim();
    if (!/^https?:\/\//.test(url)) return;
    $el.replaceWith(embedHtml(describeEmbed(url), lang, '', $el.children('figcaption').html() ?? ''));
  });
  $('iframe').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') ?? '';
    if (!/^https?:\/\//.test(src)) {
      $el.remove();
      return;
    }
    const holder = $el.closest('.wp-block-embed__wrapper, figure.wp-block-embed');
    const figure = $el.closest('figure.wp-block-embed');
    const caption = figure.children('figcaption').html() ?? '';
    let target: Cheerio<AnyNode> = holder.length ? holder.last() : $el;
    if (figure.length) target = figure;
    // A paragraph that only holds the embed would be split by the browser around a <figure>.
    const parent = target.parent('p');
    if (parent.length && parent.text().trim() === '' && parent.children().length === 1) target = parent;
    target.replaceWith(embedHtml(describeEmbed(src, src), lang, $el.attr('title') ?? '', caption));
  });
}

/** A first row of short, digit-free labels ("Title | Student | Advisor") becomes the table header. */
function promoteHeaderRows($: CheerioAPI): void {
  $('table').each((_, el) => {
    const $table = $(el);
    if ($table.find('thead, th').length) return;
    const rows = $table.find('tr');
    if (rows.length < 3) return;
    const first = rows.first();
    const cells = first.children('td');
    const labels = cells.map((_, c) => $(c).text().trim()).get();
    if (cells.length < 2 || !labels.every((l) => l && l.length <= 24 && !/\d/.test(l) && l.split(/\s+/).length <= 3)) return;
    const row = $('<tr></tr>');
    cells.each((_, c) => {
      row.append($('<th scope="col"></th>').html($(c).html() ?? ''));
    });
    first.remove();
    $table.prepend($('<thead></thead>').append(row));
  });
}

/**
 * Simple tables (2–4 labelled columns, no merged cells) stack into one card per
 * row on phones; tables whose first column is a short label (a year) keep that
 * column visible while the rest scrolls.
 */
function classifyTables($: CheerioAPI): void {
  $('table').each((_, el) => {
    const $table = $(el);
    const headers = $table.find('thead tr').last().children('th, td').map((_, c) => $(c).text().trim()).get();
    const merged = $table.find('[rowspan], [colspan]').length > 0;
    if (!merged && headers.length >= 2 && headers.length <= 4) {
      $table.addClass('table--stack');
      $table.find('tbody tr').each((_, tr) => {
        $(tr)
          .children('td')
          .each((i, td) => {
            if (headers[i]) $(td).attr('data-label', headers[i]);
          });
      });
      return;
    }
    const firstColumn = $table.find('tbody tr').map((_, tr) => $(tr).children().first().text().trim()).get();
    if (firstColumn.length && firstColumn.every((text) => text.length <= 16)) {
      $table.addClass('table--label-col');
      $table.find('thead th').each((_, th) => {
        if ($(th).text().trim().length <= 12) $(th).addClass('th-short');
      });
    }
  });
}

function wrapTables($: CheerioAPI, { lang }: TransformOptions): void {
  $('table').each((_, el) => {
    $(el).wrap(`<div class="table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(t(lang, 'content.table'))}"></div>`);
  });
}

/**
 * Shift heading levels so content headings start at h2 below the page's h1,
 * and drop inline font sizes so the site's type scale keeps h1 the largest.
 */
function normalizeHeadings($: CheerioAPI): void {
  const headings = $('h1, h2, h3, h4, h5, h6').toArray() as Element[];
  for (const h of headings) {
    const style = (h.attribs.style ?? '')
      .split(';')
      .filter((d) => d.trim() && !/^\s*(font-size|line-height)\s*:/i.test(d))
      .join(';');
    if (style) h.attribs.style = style;
    else delete h.attribs.style;
  }
  if (!headings.length) return;
  const levels = headings.map((h) => Number(h.name.slice(1)));
  const shift = Math.min(...levels) - 2;
  if (shift === 0) return;
  for (const [i, h] of headings.entries()) {
    h.name = `h${Math.min(6, Math.max(2, levels[i]! - shift))}`;
  }
}

/** Lists made only of links (course pages, groups) get roomier rows for touch screens. */
function markLinkLists($: CheerioAPI): void {
  $('ul, ol').each((_, el) => {
    const items = $(el).children('li');
    if (items.length < 4) return;
    const allLinks = items.toArray().every((li) => {
      const $li = $(li);
      const anchors = $li.children('a');
      return anchors.length === 1 && $li.text().trim() === anchors.text().trim();
    });
    if (allLinks) $(el).addClass('link-list');
  });
  // Long lists of short, flat items (graduates, course pages) are set in two columns on wide screens.
  $('ul, ol').each((_, el) => {
    const items = $(el).children('li');
    if (items.length < 12 || $(el).parents('li').length || items.find('ul, ol, p, figure, table').length) return;
    const longest = Math.max(...items.toArray().map((li) => $(li).text().trim().length));
    if (longest <= 80) $(el).addClass('list--columns');
  });
}

const NO_TYPESET = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style', 'textarea']);

const BLOCK_BOUNDARY = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'td', 'th', 'tr', 'figure', 'figcaption', 'blockquote', 'dt', 'dd']);

/** Typographic punctuation in text nodes, as wptexturize does on the live site. */
function typeset($: CheerioAPI): void {
  let before = ' ';
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        const text = node as Text;
        text.data = smartPunctuation(text.data, before);
        if (text.data) before = text.data.at(-1)!;
      } else if (node.type === 'tag') {
        if (BLOCK_BOUNDARY.has(node.name)) before = ' ';
        if (!NO_TYPESET.has(node.name)) walk(node.children);
        if (BLOCK_BOUNDARY.has(node.name)) before = ' ';
      }
    }
  };
  walk($.root().toArray().flatMap((r) => ('children' in r ? r.children : [])));
}
