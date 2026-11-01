/**
 * Interface strings. Turkish labels that existed on the live site are copied
 * from its theme dictionary (migration/reference/live-theme-translations.json);
 * strings marked NEW did not exist on the old site and need departmental review.
 */
export const languages = {
  en: { label: 'English', htmlLang: 'en', ogLocale: 'en_US' },
  tr: { label: 'Türkçe', htmlLang: 'tr', ogLocale: 'tr_TR' },
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'en';

export const ui = {
  en: {
    'site.university': 'Bilkent University',
    'site.department': 'Department of Computer Engineering',
    'site.title': 'Bilkent University Computer Engineering Department',
    'a11y.skip': 'Skip to main content', // NEW
    'a11y.mainNav': 'Main', // NEW
    'a11y.utilityNav': 'University links', // NEW
    'a11y.menu': 'Menu', // NEW
    'a11y.closeMenu': 'Close menu', // NEW
    'a11y.switchLang': 'Türkçe sürüm', // NEW
    'home.announcements': 'Announcements', // category name in WordPress
    'home.news': 'News',
    'home.quickAccess': 'Quick access', // NEW
    'home.allNews': 'All news', // NEW
    'home.allAnnouncements': 'All announcements', // NEW
    'home.noPosts': 'No posts to show.', // NEW
    'post.readMore': 'Read More',
    'footer.contact': 'Contact Information',
    'footer.about': 'About Us',
    'footer.quickLinks': 'Quick Links',
    'footer.follow': 'Follow Us',
    'footer.address1': 'Bilkent University',
    'footer.address2': 'Computer Engineering Department',
    'footer.address3': 'Bilkent 06800 Ankara, Turkey',
    'footer.phone': 'Phone',
    'footer.fax': 'Fax',
    'footer.copyrightLabel': 'Copyright',
    'footer.copyright': 'Bilkent University Department of Computer Engineering. All Rights Reserved.',
    'media.missing': 'Image not yet migrated', // NEW
    'lang.turkishOnly': 'Turkish', // NEW
    'media.photoMissing': 'Photo not yet migrated', // NEW
    'content.table': 'Scrollable table', // NEW
    'content.linkedFile': 'Open {name}', // NEW
    'embed.notice': 'This content is hosted by {provider}. Loading it connects your browser to {provider}.', // NEW
    'embed.load': 'Load content from {provider}', // NEW
    'embed.open': 'Open on {provider}', // NEW
    'link.unresolved': 'The target of this link no longer exists', // NEW
    'nav.breadcrumb': 'Breadcrumb', // NEW
    'nav.home': 'Home',
    'nav.inSection': 'In this section', // NEW
    'archive.pagination': 'Pagination', // NEW
    'archive.page': 'Page {page}', // NEW
    'archive.pageOf': 'Page {page} of {total}', // NEW
    'archive.prev': 'Previous page', // NEW
    'archive.next': 'Next page', // NEW
    'archive.count': '{count} posts', // NEW
    'archive.empty': 'There are no posts in this category.', // NEW
    'post.category': 'Category', // NEW
    'post.prev': 'Previous post', // NEW
    'post.next': 'Next post', // NEW
    'post.back': 'All posts in {name}', // NEW
    'post.nav': 'More posts', // NEW
    'lang.noTranslation': 'No Turkish version of this page; the link opens the Turkish homepage', // NEW
    'lang.noTranslationArchive': 'No Turkish version of this page; the link opens the Turkish archive', // NEW
    'people.filter': 'Filter this list', // NEW
    'people.filterHint': 'Type a name or any other detail', // NEW
    'people.count': 'Showing {shown} of {total}', // NEW
    'people.none': 'No one matches this filter.', // NEW
    'redirect.moved': 'This page has moved to', // NEW
    'notFound.title': 'Page not found', // NEW
    'notFound.body': 'The page you are looking for does not exist or has moved.', // NEW
    'notFound.home': 'Go to the homepage', // NEW
    'meta.home': 'News, announcements, people, research areas and programs of the Department of Computer Engineering at Bilkent University.', // NEW
    'meta.archive': '{name} from the Department of Computer Engineering, Bilkent University.', // NEW
    'feed.title': '{name} – Bilkent University Computer Engineering', // NEW
    'lang.englishOnly': 'English', // NEW
    // Design system (all NEW)
    'site.faculty': 'Faculty of Engineering',
    'a11y.external': 'external site',
    'a11y.anchor': 'Link to this section',
    'toc.title': 'On this page',
    'home.facts': 'The department in numbers',
    'home.allResearch': 'All research areas',
    'home.allFaculty': 'All {count} faculty members',
    'home.areaPeople': '{count} faculty members',
    'home.areaPeopleOne': '1 faculty member',
    'home.areaCourses': '{count} courses',
    'home.areaCoursesOne': '1 course',
    'people.searchLabel': 'Search this list',
    'people.allAreas': 'All areas',
    'people.all': 'All',
    'people.byArea': 'Filter by research area',
    'people.byProgram': 'Filter by program',
    'people.areas': 'Research areas',
    'people.areasNote': 'Research areas are taken from the faculty lists on the research area pages.',
    'people.photosNote': 'Initials are shown where the source page has no photograph.',
    'post.moreIn': 'More {name}',
    'post.readIn': 'Türkçe oku',
  },
  tr: {
    'site.university': 'Bilkent Üniversitesi',
    'site.department': 'Bilgisayar Mühendisliği Bölümü',
    'site.title': 'Bilkent Üniversitesi Bilgisayar Mühendisliği Bölümü',
    'a11y.skip': 'Ana içeriğe geç',
    'a11y.mainNav': 'Ana menü',
    'a11y.utilityNav': 'Üniversite bağlantıları',
    'a11y.menu': 'Menü',
    'a11y.closeMenu': 'Menüyü kapat',
    'a11y.switchLang': 'English version',
    'home.announcements': 'Duyurular',
    'home.news': 'Haberler',
    'home.quickAccess': 'Hızlı erişim',
    'home.allNews': 'Tüm haberler',
    'home.allAnnouncements': 'Tüm duyurular',
    'home.noPosts': 'Gösterilecek gönderi yok.',
    'post.readMore': 'Devamı',
    'footer.contact': 'İletişim Bilgileri',
    'footer.about': 'Hakkımızda',
    'footer.quickLinks': 'Hızlı Bağlantılar',
    'footer.follow': 'Bizi Takip Edin',
    'footer.address1': 'Bilkent Üniversitesi',
    'footer.address2': 'Bilgisayar Mühendisliği Bölümü',
    'footer.address3': 'Bilkent 06800 Ankara, Türkiye',
    'footer.phone': 'Telefon',
    'footer.fax': 'Faks',
    'footer.copyrightLabel': 'Telif Hakkı',
    'footer.copyright': 'Bilkent Üniversitesi Bilgisayar Mühendisliği Bölümü. Bütün hakları saklıdır.',
    'media.missing': 'Görsel henüz aktarılmadı',
    'lang.turkishOnly': 'Türkçe',
    'media.photoMissing': 'Fotoğraf henüz aktarılmadı',
    'content.table': 'Kaydırılabilir tablo',
    'content.linkedFile': '{name} dosyasını aç',
    'embed.notice': 'Bu içerik {provider} tarafından sunuluyor. Yüklendiğinde tarayıcınız {provider} ile bağlantı kurar.',
    'embed.load': '{provider} içeriğini yükle',
    'embed.open': '{provider} üzerinde aç',
    'link.unresolved': 'Bu bağlantının hedefi artık mevcut değil',
    'nav.breadcrumb': 'Sayfa yolu',
    'nav.home': 'Ana Sayfa',
    'nav.inSection': 'Bu bölümde',
    'archive.pagination': 'Sayfalama',
    'archive.page': 'Sayfa {page}',
    'archive.pageOf': 'Sayfa {page} / {total}',
    'archive.prev': 'Önceki sayfa',
    'archive.next': 'Sonraki sayfa',
    'archive.count': '{count} yazı',
    'archive.empty': 'Bu kategoride yazı yok.',
    'post.category': 'Kategori',
    'post.prev': 'Önceki yazı',
    'post.next': 'Sonraki yazı',
    'post.back': '{name} sayfasındaki tüm yazılar',
    'post.nav': 'Diğer yazılar',
    'lang.noTranslation': 'Bu sayfanın İngilizce sürümü yok; bağlantı İngilizce ana sayfayı açar',
    'lang.noTranslationArchive': 'Bu sayfanın İngilizce sürümü yok; bağlantı İngilizce arşivi açar',
    'people.filter': 'Listeyi filtrele',
    'people.filterHint': 'Bir ad veya başka bir bilgi yazın',
    'people.count': '{total} kişiden {shown} gösteriliyor',
    'people.none': 'Bu filtreye uyan kimse yok.',
    'redirect.moved': 'Bu sayfa taşındı:',
    'notFound.title': 'Sayfa bulunamadı',
    'notFound.body': 'Aradığınız sayfa mevcut değil veya taşındı.',
    'notFound.home': 'Ana sayfaya git',
    'meta.home': 'Bilkent Üniversitesi Bilgisayar Mühendisliği Bölümü: haberler, duyurular, akademik kadro, araştırma alanları ve programlar.',
    'meta.archive': 'Bilkent Üniversitesi Bilgisayar Mühendisliği Bölümü – {name}.',
    'feed.title': '{name} – Bilkent Üniversitesi Bilgisayar Mühendisliği',
    'lang.englishOnly': 'İngilizce',
    'site.faculty': 'Mühendislik Fakültesi',
    'a11y.external': 'harici site',
    'a11y.anchor': 'Bu bölümün bağlantısı',
    'toc.title': 'Bu sayfada',
    'home.facts': 'Rakamlarla bölüm',
    'home.allResearch': 'Tüm araştırma alanları',
    'home.allFaculty': '{count} öğretim üyesinin tümü',
    'home.areaPeople': '{count} öğretim üyesi',
    'home.areaPeopleOne': '1 öğretim üyesi',
    'home.areaCourses': '{count} ders',
    'home.areaCoursesOne': '1 ders',
    'people.searchLabel': 'Bu listede ara',
    'people.allAreas': 'Tüm alanlar',
    'people.all': 'Tümü',
    'people.byArea': 'Araştırma alanına göre filtrele',
    'people.byProgram': 'Programa göre filtrele',
    'people.areas': 'Araştırma alanları',
    'people.areasNote': 'Araştırma alanları, araştırma alanı sayfalarındaki öğretim üyesi listelerinden alınmıştır.',
    'people.photosNote': 'Kaynak sayfada fotoğrafı olmayan kişiler için baş harfler gösterilir.',
    'post.moreIn': 'Diğer {name}',
    'post.readIn': 'Read in English',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type UiKey = keyof (typeof ui)['en'];

/** Looks up an interface string and fills {placeholders}. */
export function t(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  return ui[lang][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
