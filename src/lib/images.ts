/**
 * Responsive image variants produced by `npm run media:process` (sharp).
 * The manifest maps an original upload path to WebP variants; components fall
 * back to the original file when an image has not been processed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMediaAvailable } from '@/lib/media';

export interface Variant {
  src: string;
  width: number;
}

export interface MediaRecord {
  width: number;
  height: number;
  /** Proportional WebP variants, smallest first. */
  variants: Variant[];
  /** Square crops centred on the most salient region (for portraits). */
  square: Variant[];
}

const MANIFEST = join(process.cwd(), 'public', '_media', 'manifest.json');
let cache: Record<string, MediaRecord> | undefined;

function manifest(): Record<string, MediaRecord> {
  if (!cache) cache = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, MediaRecord>) : {};
  return cache;
}

export function mediaRecord(path: string): MediaRecord | undefined {
  return manifest()[path];
}

/**
 * How an image should fill a fixed frame (thumbnails): graphics (PNG posters,
 * slides, diagrams) and very wide banners are shown whole; portrait photos are
 * cropped from the top, where faces are.
 */
export function frameFit(path: string): 'contain' | 'top' | 'cover' {
  const record = mediaRecord(path);
  if (!record) return 'cover';
  const ratio = record.width / record.height;
  if (/\.png$/i.test(path) || ratio > 2.1) return 'contain';
  return ratio < 1 ? 'top' : 'cover';
}

export function hasMedia(path: string | undefined): path is string {
  return Boolean(path && isMediaAvailable(path));
}
