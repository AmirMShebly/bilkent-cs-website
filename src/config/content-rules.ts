/**
 * Decisions about the source content that cannot be derived automatically.
 * Each rule says why it exists; all of them appear in the generated reports
 * (npm run verify), so none of them changes content silently.
 */

export interface LinkFix {
  to: string;
  reason: string;
}

/** Links in the content whose target is wrong in the source itself. */
export const linkFixes: Record<string, LinkFix> = {
  '/tr.linkedin.com/pub/huseyin-ozgur-tan-phd/11/19a/285': {
    to: 'https://tr.linkedin.com/pub/huseyin-ozgur-tan-phd/11/19a/285',
    reason: 'The source omits "https://", so on the live site the link resolves to a 404 under w3.cs.bilkent.edu.tr.',
  },
};

/**
 * Old URLs that WordPress redirects to a current page, checked against the
 * live site on 2026-11-01. They become redirect pages and are used to resolve
 * links in the content.
 */
export const legacyRedirects: Record<string, string> = {
  // WordPress "old slug" redirect.
  '/tr/duyurular/lisans-arastirma-olanaklari/': '/tr/duyurular/lisans-arastirma-olanaklari-bahar-2025/',
  // Linked from the "Side menu" navigation record; WordPress guessed the slug.
  '/en/instructor-position/': '/instructor-positions/',
  // The graduate programs page exists in English only; WordPress answers the Turkish path with it.
  '/tr/graduate-programs/': '/graduate-programs/',
};
// Category archives also answer under WordPress's /category/ and /tr/category/
// bases, including their page/N/ pages; src/lib/routes.ts generates those redirects
// from wpPath in src/config/categories.ts.

/**
 * Old URLs that still get a redirect page for visitors, but that content links
 * should not follow: the redirect target is a different item than the link meant.
 */
export const unresolvedInContent: Record<string, string> = {
  '/tr/duyurular/lisans-arastirma-olanaklari/':
    'Listed on /tr/universite-adaylarina/ as an earlier semester than Spring 2025, but WordPress redirects it to the Spring 2025 post, which the same list already links. The original post is not in the export.',
};

/**
 * External links whose target no longer exists. They were confirmed by two
 * separate checks on 2026-11-01 (`npm run links:external`). The link text is kept
 * and shown without a link, like unresolved internal links. Remove an entry once
 * the link is corrected in WordPress.
 */
export const deadLinks: Record<string, string> = {
  'http://alkanlab.org/support-asbu.html': 'HTTP 404 (page not found)',
  'http://alkanlab.org/support-tubitak1001-115e596.html': 'HTTP 404 (page not found)',
  'http://bdrl.cs.bilkent.edu.tr/cill': 'the domain no longer exists',
  'http://bdrl.cs.bilkent.edu.tr/sensorhex': 'the domain no longer exists',
  'http://bilnews.bilkent.edu.tr/cs-students-go-to-moscow-for-icpc/': 'HTTP 404 (page not found)',
  'http://bulut.aygunes.bilkent.edu.tr/cs421': 'the domain no longer exists',
  'http://donut.cs.bilkent.edu.tr/support-tubitak1001-215e172.html': 'HTTP 404 (page not found)',
  'http://europa.eu.int/comm/education/programmes/socrates/erasmus/erasmus_en.html': 'the domain no longer exists',
  'http://europa.eu.int/comm/index_en.htm': 'the domain no longer exists',
  'http://europa.eu.int/comm/research/fp6/index_en.html': 'the domain no longer exists',
  'http://europa.eu.int/comm/research/fp6/mariecurie-actions/action/fellow_en.html': 'the domain no longer exists',
  'http://homes.cs.washington.edu/~selim': 'HTTP 404 (page not found)',
  'http://neuravision.github.io/': 'HTTP 404 (page not found)',
  'http://russell.bilkent.edu.tr/': 'the domain no longer exists',
  'http://taziye.bilkent.edu.tr/DavidDavenport/': 'HTTP 404 (page not found)',
  'http://usenmez.bilkent.edu.tr/': 'the domain no longer exists',
  'http://www.cs.bilkent.edu.tr/~agursoy/eeeag247.html': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~aykanat/projects/103E028.html': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~aykanat/projects/see-grid.html': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~ilyas/EEEAG-244.html': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~mustafa.ozdal/projects/msca.htm': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~oulusoy/cs532.html': 'HTTP 404 (page not found)',
  'http://www.cs.bilkent.edu.tr/~s.rahimzadeh/CS223.html': 'HTTP 404 (page not found)',
  'http://www.dpt.gov.tr/': 'the domain no longer exists',
  'http://www.dpt.gov.tr/ing/': 'the domain no longer exists',
  'http://www.ee.washington.edu/research/isl/': 'HTTP 404 (page not found)',
  'http://www.ictmedia.com.tr/News/Index/9729/-stm-ctf-bu-yil-uluslararasi-bir-etkinlige-donustu': 'HTTP 404 (page not found)',
  'http://www.nlp.cs.bilkent.edu.tr/': 'the domain no longer exists',
  'http://www.provost.bilkent.edu.tr/publ/jrlpubs/JCS.htm': 'HTTP 404 (page not found)',
  'http://www.sukrutorun.com/': 'the domain no longer exists',
  'https://atauni.edu.tr/tolga-aydin': 'HTTP 404 (page not found)',
  'https://catalog.bilkent.edu.tr/instructor/i11639.html': 'HTTP 404 (page not found)',
  'https://catalog.bilkent.edu.tr/instructor/i11655.html': 'HTTP 404 (page not found)',
  'https://ec.europa.eu/programmes/horizon2020/en/h2020-section/marie-sklodowska-curie-actions': 'HTTP 404 (page not found)',
  'https://edizsaykol.weebly.com/': 'HTTP 404 (page not found)',
  'https://obss.com.tr/academic/': 'HTTP 404 (page not found)',
  'https://rubberduck.bilkent.online/query': 'the domain no longer exists',
  'https://upsideagency.pro/': 'the domain no longer exists',
  'https://www.sfari.org/funded-project/spatio-temporal-gene-discovery-for-autism-spectrum-disorder/': 'HTTP 404 (page not found)',
  'https://www.sfari.org/funded-project/speeding-up-autism-gene-discovery-via-deep-multitask-learning-of-data-from-cohorts-of-comorbid-neurodevelopmental-and-neuropsychiatric-disorders/': 'HTTP 404 (page not found)',
  'https://www.yok.gov.tr/Documents/Yayinlar/Yayinlarimiz/2019/gelecegin-meslekleri-calismalari/index.html': 'HTTP 404 (page not found)',
};

/**
 * Pages that are translations of each other but are not linked as such in
 * WordPress (no shared Polylang translation group).
 */
export const translationOverrides: Array<[en: string, tr: string]> = [
  ['/research-areas/security-and-privacy/', '/tr/arastirma-alanlari/guvenlik-ve-gizlilik/'],
  // News pairs that WordPress does not link. Each pair has the same lead image
  // and was published within 25 minutes; they should also be linked in Polylang.
  ['/news/prof-dr-mohammad-mahmoody-received-a-tubitak-2232-grant/', '/tr/haberler/prof-dr-mohammad-mahmoodyye-tubitak-2232-proje-destegi/'],
  ['/news/prof-dr-yusuf-sahillioglu-received-a-tubitak-1001-grant/', '/tr/haberler/prof-dr-yusuf-sahilliogluna-tubitak-1001-proje-destegi/'],
  ['/news/assist-prof-dr-ozgur-s-oguz-received-a-tubitak-1001-grant/', '/tr/haberler/dr-ogr-uyesi-ozgur-s-oguze-tubitak-1001-proje-destegi/'],
  ['/news/assoc-prof-dr-aysegul-dundar-received-a-tubitak-1001-grant/', '/tr/haberler/doc-dr-aysegul-dundara-tubitak-1001-proje-destegi/'],
  ['/news/assist-prof-dr-sinem-sav-received-a-tubitak-1001-grant/', '/tr/haberler/dr-ogr-uyesi-sinem-sava-tubitak-1001-proje-destegi/'],
  ['/news/assoc-prof-dr-eray-tuzun-received-a-tubitak-1001-grant/', '/tr/haberler/doc-dr-eray-tuzune-tubitak-1001-proje-destegi/'],
  ['/news/prof-dr-ozgur-ulusoy-received-a-tubitak-1001-grant/', '/tr/haberler/prof-dr-ozgur-ulusoya-tubitak-1001-proje-destegi/'],
  ['/news/bilkent-cs-recomb-2025/', '/tr/haberler/bilkent-cs-recomb-2025-2/'],
  ['/news/prof-dr-ugur-dogrusoz-received-a-tubitak-1001-grant/', '/tr/haberler/prof-dr-ugur-dogrusoze-tubitak-1001-proje-destegi/'],
  ['/news/prof-dr-fazli-can-received-a-tubitak-1001-grant/', '/tr/haberler/prof-dr-fazli-cana-tubitak-1001-proje-destegi/'],
];

/**
 * Turkish pages whose body is written in English (same as on the live site).
 * Their content is marked lang="en" so screen readers pronounce it correctly.
 */
export const englishBodyPages = new Set(['/tr/projeler/', '/tr/yayinlar/', '/tr/gruplar/']);

/** Pages whose body is a list of people, rendered as a structured directory. */
export const peoplePages = new Set([
  '/administrative/', '/tr/idari/',
  '/faculty-members/', '/tr/ogretim-uyeleri/',
  '/instructors/', '/tr/ogretim-gorevlileri/',
  '/part-time-instructors/', '/tr/yari-zamanli/',
  '/staff/', '/tr/personel/',
  '/graduate-students/', '/tr/lisansustu-ogrenciler/',
  '/undergraduate-students/', '/tr/lisans-ogrencileri/',
  '/retired-faculty-members/', '/tr/emekli-ogretim-uyeleri/',
]);
