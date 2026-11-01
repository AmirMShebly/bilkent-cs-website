/**
 * Site navigation, transcribed from the live site:
 *   - header and top menus: WordPress navigation records in the export
 *     ("Header navigation", "Top menu"),
 *   - Turkish labels and URLs: the live theme's translation dictionary
 *     (migration/reference/live-theme-translations.json),
 *   - homepage buttons and footer columns: the live homepage template, which
 *     is not part of the export.
 * Deviations from the live menus are listed in docs/MIGRATION.md.
 */
import type { Lang } from '@/i18n/ui';

export type Localized = Record<Lang, string>;

export interface NavLink {
  label: Localized;
  /** One URL for both languages, or one per language. */
  href: string | Localized;
  /** Set when the target page exists in one language only. */
  targetLang?: Lang;
}

export interface NavGroup {
  label: Localized;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

export function localize(value: string | Localized, lang: Lang): string {
  return typeof value === 'string' ? value : value[lang];
}

const page = (en: string, tr: string): Localized => ({ en, tr });

export const mainNav: NavItem[] = [
  {
    label: { en: 'About', tr: 'Hakkında' },
    children: [
      { label: { en: 'Department Administration', tr: 'Bölüm İdaresi' }, href: page('/administrative/', '/tr/idari/') },
      { label: { en: 'Catalog Information', tr: 'Katalog' }, href: 'http://catalog.bilkent.edu.tr/current/dep/d11.html' },
      { label: { en: 'Mission and Objectives', tr: 'Misyon ve Amaçlar' }, href: page('/mission-and-objectives/', '/tr/misyon-ve-amaclar/') },
      { label: { en: 'Enrollment and Graduation Data', tr: 'Kayıt ve Mezun Sayıları' }, href: page('/enrollment-and-graduation-data/', '/tr/ogrenci-ve-mezun-sayilari/') },
      { label: { en: 'Faculty Awards', tr: 'Fakülte Ödülleri' }, href: page('/faculty-awards/', '/tr/fakulte-odulleri/') },
      { label: { en: 'News', tr: 'Haberler' }, href: page('/news/', '/tr/haberler/') },
    ],
  },
  {
    label: { en: 'Education', tr: 'Eğitim' },
    children: [
      { label: { en: 'Degree Programs', tr: 'Programlar' }, href: 'https://stars.bilkent.edu.tr/homepage/curriculum.php?DEPT=CS' },
      { label: { en: 'Course Offerings', tr: 'Açılan Dersler' }, href: 'https://stars.bilkent.edu.tr/homepage/offerings.php?DEPT=CS' },
      { label: { en: 'Course Catalog', tr: 'Ders Tanımları' }, href: 'http://catalog.bilkent.edu.tr/current/dep/dc11.html' },
      { label: { en: 'Course Homepages', tr: 'Ders Sayfaları' }, href: page('/course-homepages/', '/tr/ders-anasayfalari/') },
      { label: { en: 'Summer Training', tr: 'Yaz Stajı' }, href: 'https://cs.bilkent.edu.tr/~staj' },
      { label: { en: 'Exchange Programs', tr: 'Öğrenci Değişim Programları' }, href: 'http://www.cs.bilkent.edu.tr/~exchange/' },
      { label: { en: 'Data Science Certificate', tr: 'Veri Bilimi Sertifikası' }, href: 'http://mf.bilkent.edu.tr/?page_id=1965' },
    ],
  },
  {
    label: { en: 'Research', tr: 'Araştırma' },
    children: [
      { label: { en: 'Research Areas', tr: 'Araştırma Alanları' }, href: page('/research-areas/', '/tr/arastirma-alanlari/') },
      { label: { en: 'Research Groups', tr: 'Araştırma Grupları' }, href: page('/groups/', '/tr/gruplar/') },
      { label: { en: 'Projects', tr: 'Projeler' }, href: page('/projects/', '/tr/projeler/') },
      { label: { en: 'Publications', tr: 'Yayınlar' }, href: 'https://stars.bilkent.edu.tr/journal-publications/CS.html' },
      { label: { en: 'Seminars', tr: 'Seminerler' }, href: 'http://www.cs.bilkent.edu.tr/~sekreter/seminars/' },
      { label: { en: 'Undergraduate Research Opportunities', tr: 'Lisans Araştırma Olanakları' }, href: page('/undergraduate-research/', '/tr/lisans-arastirma/') },
    ],
  },
  {
    label: { en: 'People', tr: 'Kişiler' },
    children: [
      { label: { en: 'Faculty Members', tr: 'Öğretim Üyeleri' }, href: page('/faculty-members/', '/tr/ogretim-uyeleri/') },
      { label: { en: 'Full-time Instructors', tr: 'Tam Zamanlı Öğretim Görevlileri' }, href: page('/instructors/', '/tr/ogretim-gorevlileri/') },
      { label: { en: 'Part-time Instructors', tr: 'Yarı Zamanlı Öğretim Görevlileri' }, href: page('/part-time-instructors/', '/tr/yari-zamanli/') },
      { label: { en: 'Administrative Staff', tr: 'İdari Personel' }, href: page('/staff/', '/tr/personel/') },
      { label: { en: 'Graduate Students', tr: 'Lisansüstü Öğrenciler' }, href: page('/graduate-students/', '/tr/lisansustu-ogrenciler/') },
      { label: { en: 'Undergraduate Students', tr: 'Lisans Öğrencileri' }, href: page('/undergraduate-students/', '/tr/lisans-ogrencileri/') },
      { label: { en: 'Retired Faculty Members', tr: 'Emekli Öğretim Üyeleri' }, href: page('/retired-faculty-members/', '/tr/emekli-ogretim-uyeleri/') },
    ],
  },
  { label: { en: 'Contact', tr: 'İletişim' }, href: page('/contact/', '/tr/iletisim/') },
];

export const utilityNav: NavItem[] = [
  { label: { en: 'Bilkent University', tr: 'Bilkent Üniversitesi' }, href: 'https://w3.bilkent.edu.tr/bilkent/' },
  { label: { en: 'Faculty of Engineering', tr: 'Mühendislik Fakültesi' }, href: 'http://mf.bilkent.edu.tr/' },
  { label: { en: 'Prospective Students', tr: 'Aday Öğrenciler' }, href: page('/prospective-students/', '/tr/aday-ogrenciler/') },
  {
    label: { en: 'Student Facilities', tr: 'Öğrenci Olanakları' },
    children: [
      { label: { en: 'Library', tr: 'Kütüphane' }, href: 'https://library.bilkent.edu.tr/' },
      { label: { en: 'Dormitories', tr: 'Yurtlar' }, href: 'http://yurtlar.bilkent.edu.tr/en/' },
      // The live menu has a stray trailing comma in this URL; removed here.
      { label: { en: 'Sports Facilities', tr: 'Spor Merkezleri' }, href: 'https://w3.bilkent.edu.tr/www/beden-egitim-ve-spor-merkezi/' },
    ],
  },
  { label: { en: 'Academic Calendar', tr: 'Akademik Takvim' }, href: 'https://w3.bilkent.edu.tr/bilkent/academic-calendar/' },
  { label: { en: 'STARS', tr: 'STARS' }, href: 'https://stars.bilkent.edu.tr/' },
];

/** Buttons beside the news feed on the live homepage. */
export const homeQuickLinks: NavLink[] = [
  // The live button points to the Turkish prospective-students letter on both language versions.
  { label: { en: 'Undergraduate Program', tr: 'Lisans Programı' }, href: '/tr/universite-adaylarina/', targetLang: 'tr' },
  { label: { en: 'Graduate Programs', tr: 'Lisansüstü Programlar' }, href: '/graduate-programs/', targetLang: 'en' },
  { label: { en: 'Open Faculty Positions', tr: 'Öğretim Üyesi Pozisyonları' }, href: 'https://stars.bilkent.edu.tr/staffapp/CS_FACULTY' },
  { label: { en: 'Open Instructor Positions', tr: 'Öğretim Görevlisi Pozisyonları' }, href: '/instructor-positions/', targetLang: 'en' },
  { label: { en: 'CS Fair', tr: 'CS Fuarı' }, href: 'http://www.cs.bilkent.edu.tr/~csfair/' },
];

export const footerAbout: NavLink[] = [
  { label: { en: 'Mission and Objectives', tr: 'Misyon ve Amaçlar' }, href: page('/mission-and-objectives/', '/tr/misyon-ve-amaclar/') },
  { label: { en: 'Department Administration', tr: 'Bölüm İdaresi' }, href: page('/administrative/', '/tr/idari/') },
  { label: { en: 'Faculty Members', tr: 'Öğretim Üyeleri' }, href: page('/faculty-members/', '/tr/ogretim-uyeleri/') },
  { label: { en: 'Prospective Students', tr: 'Aday Öğrenciler' }, href: page('/prospective-students/', '/tr/aday-ogrenciler/') },
  { label: { en: 'News', tr: 'Haberler' }, href: page('/news/', '/tr/haberler/') },
];

export const footerQuickLinks: NavLink[] = [
  { label: { en: 'Summer Training', tr: 'Yaz Stajı' }, href: 'http://cs.bilkent.edu.tr/~staj' },
  // Label spelling ("Prerequisities") is as on the live site; see docs/MIGRATION.md.
  { label: { en: 'Course Prerequisities', tr: 'Ders Önşartları' }, href: '/wp-content/uploads/2023/04/prereq.jpg' },
  { label: { en: 'Exchange', tr: 'Değişim Programı' }, href: 'http://www.cs.bilkent.edu.tr/~exchange/' },
  { label: { en: 'Academic Calendar', tr: 'Akademik Takvim' }, href: 'https://w3.bilkent.edu.tr/bilkent/academic-calendar/' },
  { label: { en: 'STARS', tr: 'STARS' }, href: 'http://stars.bilkent.edu.tr' },
];
