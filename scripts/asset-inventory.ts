/**
 * Writes docs/ASSET-INVENTORY.md and docs/asset-inventory.csv: every media
 * file shipped in public/wp-content/uploads, with its type, size, pixel
 * dimensions, where it is used, what it shows (by usage), and whether the
 * source gives it alternative text. Also lists fonts and other bundled assets.
 *
 *   npm run inventory:assets
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { load } from 'cheerio';
import sharp from 'sharp';
import { footerQuickLinks } from '../src/config/navigation';
import { homeInfoCards, site } from '../src/config/site';
import { imageText } from '../src/config/image-text';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');
const UPLOADS = join(PUBLIC, 'wp-content', 'uploads');

interface Entry {
  path: string;
  kind: 'page' | 'post';
  html: string;
  media: string[];
}
const entries = ['pages', 'posts'].flatMap((name) => JSON.parse(readFileSync(join(ROOT, `src/content/generated/${name}.json`), 'utf8')) as Entry[]);

// What a people page lists, for describing the photographs on it.
const peopleGroup: Array<[RegExp, string]> = [
  [/^\/(tr\/)?(faculty-members|ogretim-uyeleri)\/$/, 'Photo of a faculty member'],
  [/^\/(tr\/)?(instructors|ogretim-gorevlileri)\/$/, 'Photo of an instructor'],
  [/^\/(tr\/)?(part-time-instructors|yari-zamanli)\/$/, 'Photo of a part-time instructor'],
  [/^\/(tr\/)?(administrative|idari)\/$/, 'Photo of administrative staff'],
  [/^\/(tr\/)?(staff|personel)\/$/, 'Photo of staff'],
  [/^\/(tr\/)?(graduate-students|lisansustu-ogrenciler)\/$/, 'Photo of a graduate student'],
  [/^\/(tr\/)?(undergraduate-students|lisans-ogrencileri)\/$/, 'Photo of an undergraduate student'],
  [/^\/(tr\/)?(retired-faculty-members|emekli-ogretim-uyeleri)\/$/, 'Photo of a retired faculty member'],
];

const templateUse = new Map<string, string[]>();
const addTemplate = (path: string, where: string) => templateUse.set(path, [...(templateUse.get(path) ?? []), where]);
addTemplate(site.emblem, 'site header and browser icon (all pages)');
for (const card of homeInfoCards) addTemplate(card.image.src, `homepage card “${card.title.en}”`);
for (const link of footerQuickLinks) {
  const href = typeof link.href === 'string' ? link.href : link.href.en;
  if (href.startsWith('/wp-content/uploads/')) addTemplate(href, `footer link “${link.label.en}”`);
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

interface Row {
  path: string;
  type: string;
  kb: number;
  dimensions: string;
  usedOn: string[];
  category: string;
  alt: string;
}

const rows: Row[] = [];
for (const file of walk(UPLOADS).sort()) {
  const path = `/${relative(PUBLIC, file).split('\\').join('/')}`;
  const ext = extname(file).slice(1).toLowerCase();
  const kb = Math.round(statSync(file).size / 1024);
  let dimensions = '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    const meta = await sharp(file, { failOn: 'none' }).metadata();
    dimensions = `${meta.autoOrient?.width ?? meta.width}×${meta.autoOrient?.height ?? meta.height}`;
  }
  const using = entries.filter((e) => e.media.includes(path));
  const usedOn = [...(templateUse.get(path) ?? []), ...using.map((e) => e.path)];

  // Alternative text as written in the source, wherever the file is shown as an image.
  const alts = using.flatMap((e) => {
    const $ = load(e.html, null, false);
    return $('img')
      .filter((_, img) => ($(img).attr('src') ?? '').split('?')[0] === path)
      .map((_, img) => ($(img).attr('alt') ?? '').trim())
      .get();
  });
  const sourceAlt = alts.length === 0 ? '' : alts.every(Boolean) ? 'yes' : alts.some(Boolean) ? 'partly' : 'no';
  // Text alternatives added in src/config/image-text.ts for images that carry information.
  const added = imageText[path];
  const alt = added?.text ? 'added, with text version' : added ? 'added' : sourceAlt;

  const people = using.map((e) => peopleGroup.find(([re]) => re.test(e.path))?.[1]).find(Boolean);
  let category: string;
  if (ext === 'pdf') category = 'Document (PDF)';
  else if (people) category = people;
  else if (templateUse.has(path)) category = /abet|amblem|logo/i.test(path) ? 'Logo' : 'Homepage image';
  else if (using.length && using.every((e) => e.kind === 'post')) category = 'News or announcement image';
  else if (using.length) category = 'Page image';
  else category = 'Not referenced';

  rows.push({ path, type: ext.toUpperCase(), kb, dimensions, usedOn, category, alt });
}

// ---------------------------------------------------------------- summary
const byCategory = new Map<string, Row[]>();
for (const r of rows) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);
const totalKb = rows.reduce((n, r) => n + r.kb, 0);
const mb = (kb: number) => (kb / 1024).toFixed(1);
const media = join(PUBLIC, '_media');
const variants = walk(media).filter((f) => f.endsWith('.webp'));
const variantKb = Math.round(variants.reduce((n, f) => n + statSync(f).size, 0) / 1024);
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
const fonts = Object.entries(pkg.dependencies).filter(([name]) => name.startsWith('@fontsource'));
const noAlt = rows.filter((r) => r.alt === 'no' || r.alt === 'partly');
const addedAlt = rows.filter((r) => r.alt.startsWith('added'));
const esc = (s: string) => s.replace(/\|/g, '\\|');

const md = `# Asset inventory

Generated by \`npm run inventory:assets\` from the files in \`public/wp-content/uploads/\` and the imported content. Do not edit by hand.

All media files were copied read-only from the public website (\`${site.legacyOrigin}\`) at their original paths, so existing links to them keep working. The build turns every image into responsive WebP variants (\`npm run media:process\`, written to \`public/_media/\`, not committed).

## Summary

| What | Files | Size |
|---|---:|---:|
${[...byCategory.entries()].sort((a, b) => b[1].length - a[1].length).map(([cat, list]) => `| ${cat} | ${list.length} | ${mb(list.reduce((n, r) => n + r.kb, 0))} MB |`).join('\n')}
| **Originals in \`public/wp-content/uploads/\`** | **${rows.length}** | **${mb(totalKb)} MB** |
| Generated WebP variants (build output) | ${variants.length} | ${mb(variantKb)} MB |

Images that carry information (charts, curriculum tables, posters, award photographs): **${addedAlt.length}** have a text alternative written for this site in \`src/config/image-text.ts\`, ${addedAlt.filter((r) => r.alt.includes('text version')).length} of them with a full text version below the image. Images whose source gives no alternative text and that are decorative or explained by the surrounding text (mostly portraits next to the person's name): **${noAlt.length}**; the page marks them as decorative.

## Other bundled assets

| Asset | Source | Licence |
|---|---|---|
${fonts.map(([name, version]) => `| ${name.replace('@fontsource-variable/', '')} (variable font, self-hosted) | npm \`${name}@${version}\` | SIL Open Font License 1.1 |`).join('\n')}
| Interface icons (\`src/components/Icon.astro\`) | Drawn for this project as inline SVG paths | Part of this project |
| Bilkent emblem (\`${site.emblem}\`) | Department website upload | University trademark: use as the department directs |
| ABET logo (\`/wp-content/uploads/2023/05/abet-eng.png\`) | Department website upload | ABET trademark: use under ABET's accreditation logo rules |

No external images, fonts, scripts or analytics are loaded. Embedded videos and posts (YouTube, LinkedIn) load from their providers only after the reader clicks.

## Every media file

| File | Type | Size | Pixels | What it is | Text alternative | Used on |
|---|---|---:|---|---|---|---|
${rows.map((r) => `| \`${esc(r.path.replace('/wp-content/uploads/', ''))}\` | ${r.type} | ${r.kb} KB | ${r.dimensions} | ${r.category} | ${r.alt || '–'} | ${esc(r.usedOn.join(', ') || '–')} |`).join('\n')}
`;
writeFileSync(join(ROOT, 'docs', 'ASSET-INVENTORY.md'), md);

const csv = [
  ['path', 'type', 'size_kb', 'pixels', 'category', 'text_alternative', 'used_on'],
  ...rows.map((r) => [r.path, r.type, String(r.kb), r.dimensions, r.category, r.alt, r.usedOn.join(' ')]),
]
  .map((cols) => cols.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
  .join('\n');
writeFileSync(join(ROOT, 'docs', 'asset-inventory.csv'), `${csv}\n`);

console.log(`${rows.length} files (${mb(totalKb)} MB) → docs/ASSET-INVENTORY.md, docs/asset-inventory.csv`);
for (const [cat, list] of byCategory) console.log(`  ${cat}: ${list.length}`);
