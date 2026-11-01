/**
 * Generates responsive WebP variants for every image in public/wp-content/uploads:
 *   - proportional widths (320–1600 px, never upscaled),
 *   - square crops centred on the most salient region (portraits in directories).
 * Writes them to public/_media/ with a manifest that the site reads at build time.
 * Runs before every build; files whose content has not changed since the last
 * run are skipped, and variants of deleted uploads are removed.
 *
 *   npm run media:process
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const UPLOADS = join(ROOT, 'public', 'wp-content', 'uploads');
const OUT = join(ROOT, 'public', '_media');
const MANIFEST = join(OUT, 'manifest.json');
const WIDTHS = [320, 640, 960, 1280, 1600];
const SQUARES = [160, 320, 480];
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface Variant {
  src: string;
  width: number;
}
interface MediaRecord {
  width: number;
  height: number;
  variants: Variant[];
  square: Variant[];
  /** SHA-1 of the original, to skip unchanged files. */
  hash: string;
}

function walk(dir: string, filter: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, filter) : filter(name) ? [full] : [];
  });
}

const previous: Record<string, MediaRecord> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const manifest: Record<string, MediaRecord> = {};
let processed = 0;

for (const file of walk(UPLOADS, (name) => IMAGE.has(extname(name).toLowerCase()))) {
  const key = `/${relative(join(ROOT, 'public'), file).split('\\').join('/')}`;
  const hash = createHash('sha1').update(readFileSync(file)).digest('hex');
  const known = previous[key];
  if (known?.hash === hash && [...known.variants, ...known.square].every((v) => existsSync(join(ROOT, 'public', v.src)))) {
    manifest[key] = known;
    continue;
  }
  const base = key.replace(/^\/wp-content\/uploads\//, '').replace(/\.[^.]+$/, '');
  // Variants are named without the extension; two uploads that differ only by it would overwrite each other.
  const clash = Object.keys(manifest).find((other) => other !== key && other.replace(/\.[^.]+$/, '').toLowerCase() === key.replace(/\.[^.]+$/, '').toLowerCase());
  if (clash) throw new Error(`${key} and ${clash} would share variant names; rename one of them`);
  const image = sharp(file, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!width || !height) continue;

  const variants: Variant[] = [];
  for (const w of WIDTHS.filter((w) => w < width).concat(width <= 1600 ? [width] : [])) {
    const out = join(OUT, `${base}-${w}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    await sharp(file, { failOn: 'none' }).rotate().resize({ width: w }).webp({ quality: 78 }).toFile(out);
    variants.push({ src: `/_media/${base}-${w}.webp`, width: w });
  }
  const square: Variant[] = [];
  for (const s of SQUARES.filter((s) => s <= Math.min(width, height))) {
    const out = join(OUT, `${base}-sq${s}.webp`);
    await sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: s, height: s, fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toFile(out);
    square.push({ src: `/_media/${base}-sq${s}.webp`, width: s });
  }
  manifest[key] = { width, height, variants, square, hash };
  processed++;
}

// Remove variants that no upload needs any more.
const wanted = new Set(Object.values(manifest).flatMap((r) => [...r.variants, ...r.square].map((v) => join(ROOT, 'public', v.src))));
let removed = 0;
for (const file of walk(OUT, (name) => name.endsWith('.webp'))) {
  if (!wanted.has(file)) {
    rmSync(file);
    removed++;
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`${Object.keys(manifest).length} images in manifest, ${processed} processed now, ${removed} stale variants removed → public/_media/`);
