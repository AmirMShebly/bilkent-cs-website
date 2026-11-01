/**
 * Reads a WordPress "people" page (faculty, staff, students, ...) into
 * structured entries without losing anything. Every people page separates
 * entries with <hr>; within an entry, each line becomes either the name, the
 * role heading, a "Label: value" field, a line of links, or plain text, in
 * source order. Nothing is rewritten: labels and values are the source text.
 */
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { resolveHref, type LinkIndex } from '@/lib/links';
import { href as withBase } from '@/lib/url';

export type Inline =
  | { type: 'text'; text: string; strong?: boolean }
  | { type: 'link'; text: string; href: string | null; original: string; legacyMedia?: boolean; fixedFrom?: string }
  | { type: 'email'; user: string; domain: string; label?: string };

export interface PersonLine {
  kind: 'field' | 'links' | 'text';
  /** Field label as written in the source, without the colon. */
  label?: string;
  inlines: Inline[];
}

export interface Person {
  role?: string;
  name: Inline[];
  nameText: string;
  photo?: { src: string; alt: string };
  lines: PersonLine[];
}

type Token =
  | { t: 'sep' }
  | { t: 'br' }
  | { t: 'heading'; text: string }
  | { t: 'img'; src: string; alt: string }
  | { t: 'inline'; inline: Inline };

const BLOCKS = new Set(['p', 'div', 'figure', 'li', 'ul', 'ol', 'tr', 'td', 'th', 'table', 'tbody', 'thead', 'section', 'article', 'header', 'figcaption', 'blockquote']);
const LABEL = /^\s*([\p{L}][\p{L}\p{M} .\-/]{0,30}):\s*/u;

const squash = (text: string) => text.replace(/\s+/g, ' ');

function linkInline(text: string, original: string, index: LinkIndex): Inline {
  const link = resolveHref(original, index);
  switch (link.kind) {
    case 'internal':
      return { type: 'link', text, original, href: withBase(link.path) + link.suffix };
    case 'media':
      return link.available
        ? { type: 'link', text, original, href: withBase(link.path) }
        : { type: 'link', text, original, href: link.legacyUrl, legacyMedia: true };
    case 'external':
      return { type: 'link', text, original, href: link.url, fixedFrom: link.fix ? original : undefined };
    case 'fragment':
    case 'tel':
      return { type: 'link', text, original, href: original };
    case 'mailto':
      return { type: 'email', user: link.user, domain: link.domain, label: text && text !== `${link.user}@${link.domain}` ? text : undefined };
    case 'unresolved':
      return { type: 'link', text, original, href: null };
  }
}

function tokenize(nodes: AnyNode[], index: LinkIndex, out: Token[], strong = false): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = squash((node as unknown as { data: string }).data);
      if (text) out.push({ t: 'inline', inline: { type: 'text', text, strong } });
      continue;
    }
    if (node.type !== 'tag') continue;
    const el = node as Element;
    const name = el.name;
    const attr = el.attribs;
    if (name === 'hr') out.push({ t: 'sep' });
    else if (name === 'br') out.push({ t: 'br' });
    else if (name === 'img') out.push({ t: 'img', src: attr.src ?? '', alt: attr.alt ?? '' });
    else if (/^h[1-6]$/.test(name)) {
      out.push({ t: 'br' }, { t: 'heading', text: squash(textOf(el)).trim() }, { t: 'br' });
    } else if (name === 'span' && /\be-mail\b/.test(attr.class ?? '') && attr['data-user']) {
      out.push({ t: 'inline', inline: { type: 'email', user: attr['data-user'], domain: attr['data-website'] ?? '' } });
    } else if (name === 'a' && attr.href) {
      const text = squash(textOf(el)).trim();
      // Photos may sit anywhere inside the link; keep them and the link text.
      for (const img of descendants(el, 'img')) out.push({ t: 'img', src: img.attribs.src ?? '', alt: img.attribs.alt ?? '' });
      if (text) out.push({ t: 'inline', inline: linkInline(text, attr.href, index) });
      if (descendants(el, 'br').length) out.push({ t: 'br' });
    } else if (name === 'strong' || name === 'b') {
      tokenize(el.children, index, out, true);
    } else if (BLOCKS.has(name)) {
      out.push({ t: 'br' });
      tokenize(el.children, index, out, strong);
      out.push({ t: 'br' });
    } else {
      tokenize(el.children, index, out, strong);
    }
  }
}

function descendants(el: Element, tag: string): Element[] {
  return el.children.flatMap((c) =>
    c.type === 'tag' ? [...((c as Element).name === tag ? [c as Element] : []), ...descendants(c as Element, tag)] : [],
  );
}

function textOf(el: AnyNode): string {
  if (el.type === 'text') return (el as unknown as { data: string }).data;
  if ('children' in el) return el.children.map(textOf).join('');
  return '';
}

function lineText(inlines: Inline[]): string {
  return inlines
    .map((i) => (i.type === 'email' ? `${i.label ?? ''} ${i.user}@${i.domain}` : i.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trim whitespace-only text at both ends of a line. */
function trimLine(inlines: Inline[]): Inline[] {
  const out = [...inlines];
  while (out[0]?.type === 'text' && !out[0].text.trim()) out.shift();
  while (out.at(-1)?.type === 'text' && !(out.at(-1) as { text: string }).text.trim()) out.pop();
  const first = out[0];
  if (first?.type === 'text') out[0] = { ...first, text: first.text.trimStart() };
  const last = out.at(-1);
  if (last?.type === 'text') out[out.length - 1] = { ...last, text: last.text.trimEnd() };
  return out;
}

function classify(inlines: Inline[]): PersonLine {
  const first = inlines[0];
  if (first?.type === 'text') {
    const m = first.text.match(LABEL);
    if (m) {
      const rest = first.text.slice(m[0].length);
      const value = trimLine([...(rest ? [{ ...first, text: rest }] : []), ...inlines.slice(1)]);
      if (value.length) return { kind: 'field', label: m[1]!.trim(), inlines: value };
    }
  }
  const meaningful = inlines.filter((i) => !(i.type === 'text' && !i.text.trim()));
  if (meaningful.length && meaningful.every((i) => i.type === 'link')) return { kind: 'links', inlines };
  return { kind: 'text', inlines };
}

export function parsePeople(html: string, index: LinkIndex): Person[] {
  const $ = load(html, null, false);
  const tokens: Token[] = [];
  tokenize($.root().toArray().flatMap((r) => ('children' in r ? r.children : [])), index, tokens);

  const entries: Token[][] = [[]];
  for (const tok of tokens) {
    if (tok.t === 'sep') entries.push([]);
    else entries.at(-1)!.push(tok);
  }

  const people: Person[] = [];
  for (const entry of entries) {
    const photoTok = entry.find((tk): tk is Extract<Token, { t: 'img' }> => tk.t === 'img');
    const firstHeading = entry.find((tk): tk is Extract<Token, { t: 'heading' }> => tk.t === 'heading');
    const role = firstHeading?.text;

    const lines: Inline[][] = [[]];
    for (const tok of entry) {
      if (tok.t === 'br') lines.push([]);
      else if (tok.t === 'heading') {
        // The first heading is the role; any further heading stays as a line of its own.
        lines.push(tok === firstHeading ? [] : [{ type: 'text', text: tok.text, strong: true }], []);
      } else if (tok.t === 'inline') lines.at(-1)!.push(tok.inline);
    }
    const content = lines.map(trimLine).filter((l) => lineText(l));
    if (!content.length && !photoTok) continue;

    // The name is the bold text on student pages; otherwise the first plain line
    // (or, failing that, a line holding a single link) before the first "Label:" field.
    const firstField = content.findIndex((l) => classify(l).kind === 'field');
    const beforeFields = (i: number) => firstField < 0 || i < firstField;
    let nameIdx = content.findIndex((l) => l.some((i) => i.type === 'text' && i.strong && i.text.trim()) && !LABEL.test(lineText(l)));
    if (nameIdx < 0) nameIdx = content.findIndex((l, i) => classify(l).kind === 'text' && beforeFields(i));
    if (nameIdx < 0) nameIdx = content.findIndex((l, i) => classify(l).kind === 'links' && l.filter((x) => x.type === 'link').length === 1 && beforeFields(i));
    if (nameIdx < 0) nameIdx = content.findIndex((l) => classify(l).kind === 'text');
    const name = nameIdx >= 0 ? content[nameIdx]! : [];

    people.push({
      role,
      name,
      nameText: lineText(name),
      photo: photoTok ? { src: photoTok.src, alt: photoTok.alt } : undefined,
      lines: content.filter((_, i) => i !== nameIdx).map(classify),
    });
  }
  return people;
}
