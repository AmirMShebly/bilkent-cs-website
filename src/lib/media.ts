import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The WordPress export ships without image files. Media keep their original
 * paths (/wp-content/uploads/...), so a file is "available" once it has been
 * copied into public/ at the same path, e.g. with `npm run fetch:media`.
 * Until then components render a labelled placeholder instead of a broken image.
 */
const PUBLIC_DIR = join(process.cwd(), 'public');

export function isMediaAvailable(path: string): boolean {
  if (!path.startsWith('/')) return false;
  return existsSync(join(PUBLIC_DIR, decodeURI(path)));
}
