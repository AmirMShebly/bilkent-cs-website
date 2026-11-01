/**
 * Data derived from the imported content at build time for the homepage and
 * the people directories. Nothing here is written by hand: counts, research
 * areas and profiles come from the department's own pages, and every derived
 * value says where it comes from so the pages can cite it.
 */
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { categories, type CategoryKey } from '@/config/categories';
import { parsePeople, type Inline, type Person, type PersonLine } from '@/lib/html/people';
import { getSiteIndex, type Entry, type SiteIndex } from '@/lib/routes';
import { childrenInParentOrder, linkIndexOf } from '@/lib/sections';
import type { Lang } from '@/i18n/ui';

export const pagePath = {
  faculty: { en: '/faculty-members/', tr: '/tr/ogretim-uyeleri/' },
  instructors: { en: '/instructors/', tr: '/tr/ogretim-gorevlileri/' },
  partTime: { en: '/part-time-instructors/', tr: '/tr/yari-zamanli/' },
  graduate: { en: '/graduate-students/', tr: '/tr/lisansustu-ogrenciler/' },
  enrollment: { en: '/enrollment-and-graduation-data/', tr: '/tr/ogrenci-ve-mezun-sayilari/' },
  research: { en: '/research-areas/', tr: '/tr/arastirma-alanlari/' },
  mission: { en: '/mission-and-objectives/', tr: '/tr/misyon-ve-amaclar/' },
  courses: { en: '/course-homepages/', tr: '/tr/ders-anasayfalari/' },
} as const;

function page(index: SiteIndex, path: string): Entry {
  const entry = index.pages.find((p) => p.path === path);
  if (!entry) throw new Error(`Page ${path} not found`);
  return entry;
}

/** Lower-case, accent-free words for comparing names across pages. */
export function nameKey(text: string): string[] {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ---------------------------------------------------------------- research areas

export interface ResearchArea {
  title: string;
  path: string;
  /** Names listed under "Faculty Members" / "Öğretim Üyeleri" on the area page. */
  people: string[];
  courses: string[];
}

/**
 * Items listed under a bold label such as "Faculty Members" or "Öğretim
 * Üyeleri": every list item up to the next label or heading. Labels are
 * compared without case or diacritics ("Ögretim Üyeleri" occurs too).
 */
function listAfterLabel(html: string, labels: string[]): string[] {
  const $ = load(html, null, false);
  const wanted = labels.map((l) => nameKey(l).join(' '));
  const isLabel = (el: AnyNode) => {
    const $el = $(el);
    return $el.is('p') && $el.children('strong, b').length > 0 && $el.text().trim() === $el.children('strong, b').text().trim();
  };
  const label = $('p').filter((_, el) => isLabel(el) && wanted.includes(nameKey($(el).text()).join(' '))).first();
  if (!label.length) return [];
  const items: string[] = [];
  for (const el of label.nextAll().toArray()) {
    if (isLabel(el) || /^h[1-6]$/.test((el as Element).name)) break;
    items.push(...$(el).find('li').addBack('li').map((_, li) => $(li).text().trim()).get().filter(Boolean));
  }
  if (!items.length) throw new Error(`"${label.text().trim()}" is followed by no list items`);
  return items;
}

export async function researchAreas(lang: Lang): Promise<ResearchArea[]> {
  const index = await getSiteIndex();
  const parent = page(index, pagePath.research[lang]);
  return childrenInParentOrder(parent, index, lang).map((area) => ({
    title: area.title,
    path: area.path,
    people: listAfterLabel(area.html, ['Faculty Members', 'Öğretim Üyeleri']),
    courses: listAfterLabel(area.html, ['Courses', 'Dersler']),
  }));
}

// ---------------------------------------------------------------- people

export interface Profile {
  /** The name as written in the source, title included. */
  fullName: string;
  /** Academic title split off the front of the name ("Prof. Dr."), if any. */
  title?: string;
  /** The name without that title. */
  name: string;
  /** The name as parsed, which may be a link. */
  nameInlines: Inline[];
  role?: string;
  photo?: string;
  /** Every other line of the source entry, in source order. */
  lines: PersonLine[];
  /** First plain-text line, e.g. "Ph.D. Student" (used as a filter on student lists). */
  program?: string;
  /** Research areas whose pages list this person. */
  areas: Array<{ title: string; path: string }>;
}

const TITLE = /^((?:Prof\.|Assoc\.|Asst\.|Assist\.|Res\.|Dr\.|Engr\.|Doç\.|Öğr\.\s*Üyesi)\s*)+/;

export function inlineText(inlines: Inline[]): string {
  return inlines
    .map((i) => (i.type === 'email' ? `${i.user}@${i.domain}` : i.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toProfile(person: Person, areas: ResearchArea[]): Profile {
  const fullName = person.nameText;
  const title = fullName.match(TITLE)?.[0].trim();
  const name = title ? fullName.slice(title.length).trim() : fullName;
  const programLine = person.lines.find((l) => l.kind === 'text' && l.inlines.every((i) => i.type === 'text'));
  const key = new Set(nameKey(name));
  return {
    fullName,
    title,
    name,
    nameInlines: person.name,
    role: person.role,
    photo: person.photo?.src,
    lines: person.lines,
    program: programLine ? inlineText(programLine.inlines) : undefined,
    areas: areas
      .filter((area) =>
        area.people.some((listed) => {
          const words = nameKey(listed);
          return words.length > 0 && words.every((w) => key.has(w));
        }),
      )
      .map(({ title: areaTitle, path }) => ({ title: areaTitle, path })),
  };
}

/** Student lists use the compact directory layout. */
export const denseDirectories = new Set<string>([
  pagePath.graduate.en, pagePath.graduate.tr, '/undergraduate-students/', '/tr/lisans-ogrencileri/',
]);

/** Profiles of a people page, with research areas cross-referenced from the area pages. */
export async function directory(path: string, lang: Lang): Promise<Profile[]> {
  const index = await getSiteIndex();
  const areas = await researchAreas(lang);
  return parsePeople(page(index, path).html, linkIndexOf(index)).map((p) => toProfile(p, areas));
}

// ---------------------------------------------------------------- facts

export interface Fact {
  value: string;
  label: string;
  source: { path: string; label: string };
}

/** Counts and figures read from department pages, each with its source page. */
export async function facts(lang: Lang): Promise<Fact[]> {
  const index = await getSiteIndex();
  const tr = lang === 'tr';
  const count = (path: string) => parsePeople(page(index, path).html, linkIndexOf(index)).length;
  const areas = await researchAreas(lang);
  const enrollment = page(index, pagePath.enrollment[lang]);
  const $ = load(enrollment.html, null, false);
  const rows = $('tbody tr')
    .toArray()
    .map((tr) => $(tr).find('td').map((_, td) => $(td).text().trim()).get());
  const latest = rows[0] ?? [];
  const withDegrees = rows.find((r) => r[7]);
  const enrollmentSource = { path: pagePath.enrollment[lang], label: tr ? 'Öğrenci ve mezun sayıları' : 'Enrollment data' };

  const out: Fact[] = [
    { value: String(count(pagePath.faculty[lang])), label: tr ? 'öğretim üyesi' : 'faculty members', source: { path: pagePath.faculty[lang], label: tr ? 'Öğretim Üyeleri' : 'Faculty Members' } },
    { value: String(count(pagePath.instructors[lang])), label: tr ? 'tam zamanlı öğretim görevlisi' : 'full-time instructors', source: { path: pagePath.instructors[lang], label: tr ? 'Öğretim Görevlileri' : 'Instructors' } },
    { value: String(count(pagePath.graduate[lang])), label: tr ? 'lisansüstü öğrenci' : 'graduate students', source: { path: pagePath.graduate[lang], label: tr ? 'Lisansüstü Öğrenciler' : 'Graduate Students' } },
  ];
  if (latest[6]) out.push({ value: latest[6], label: tr ? `lisans öğrencisi, ${latest[0]} güz` : `undergraduate students, fall ${latest[0]}`, source: enrollmentSource });
  if (withDegrees) out.push({ value: withDegrees[7]!, label: tr ? `mezun, ${withDegrees[0]}` : `degrees conferred, ${withDegrees[0]}`, source: enrollmentSource });
  out.push({ value: String(areas.length), label: tr ? 'araştırma alanı' : 'research areas', source: { path: pagePath.research[lang], label: tr ? 'Araştırma Alanları' : 'Research Areas' } });
  return out;
}

// ---------------------------------------------------------------- posts

export async function latestIn(category: CategoryKey, lang: Lang, limit: number, exclude?: string): Promise<Entry[]> {
  const index = await getSiteIndex();
  return index.posts.filter((p) => p.lang === lang && p.categories.includes(category) && p.path !== exclude).slice(0, limit);
}

export function archivePath(category: CategoryKey, lang: Lang): string {
  return categories[category][lang].path;
}

/** The first paragraph of the mission page, quoted verbatim on the homepage. */
export async function missionStatement(lang: Lang): Promise<{ text: string; path: string }> {
  const index = await getSiteIndex();
  const mission = page(index, pagePath.mission[lang]);
  const $ = load(mission.html, null, false);
  return { text: $('p').first().text().trim(), path: mission.path };
}
