/**
 * Copies media files referenced by the content from the live site into
 * public/ at their original paths (/wp-content/uploads/...), so existing
 * links keep working. Run it after importing a new export; files already in
 * public/ are skipped.
 *
 *   npm run fetch:media            # list what would be downloaded
 *   npm run fetch:media -- --download
 *   npm run fetch:media -- --download --only list.txt   # only the paths listed in a file
 *
 * It only reads public URLs, one at a time, and never writes to the WordPress
 * site. The files include people's photographs: publishing them needs the
 * department's approval (docs/OPEN-ISSUES.md, P1).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { site, homeInfoCards } from '../src/config/site';
import { footerQuickLinks } from '../src/config/navigation';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');
const download = process.argv.includes('--download');
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex > 0
  ? new Set(readFileSync(resolve(process.argv[onlyIndex + 1]!), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
  : undefined;

interface Entry { media: string[] }
const entries = ['pages', 'posts'].flatMap((name) =>
  JSON.parse(readFileSync(join(ROOT, `src/content/generated/${name}.json`), 'utf8')) as Entry[]);

// Media used by the theme (header, homepage, footer) rather than by content.
const templateMedia = [
  site.emblem,
  ...homeInfoCards.map((c) => c.image.src),
  ...footerQuickLinks.map((l) => (typeof l.href === 'string' ? l.href : l.href.en)),
].filter((p) => p.startsWith('/wp-content/uploads/'));

const paths = [...new Set([...templateMedia, ...entries.flatMap((e) => e.media)])].sort();
const missing = paths.filter((p) => !existsSync(join(PUBLIC, decodeURI(p))) && (!only || only.has(p)));

console.log(`${paths.length} media paths referenced, ${missing.length} not yet in public/.`);
if (!download) {
  for (const p of missing) console.log(`  ${p}`);
  console.log('\nRe-run with --download to fetch them from', site.legacyOrigin);
  process.exit(0);
}

const failed: string[] = [];
for (const p of missing) {
  // Be gentle with the live server: one request at a time, with a short pause.
  await new Promise((r) => setTimeout(r, 300));
  const url = new URL(p, site.legacyOrigin);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const target = join(PUBLIC, decodeURI(p));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    console.log(`  ok    ${p}`);
  } catch (error) {
    failed.push(p);
    console.log(`  fail  ${p} (${(error as Error).message})`);
  }
}
console.log(`\nDownloaded ${missing.length - failed.length}, failed ${failed.length}.`);
if (failed.length) process.exitCode = 1;
