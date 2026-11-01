/**
 * Department-wide facts shown in the header, footer and homepage. Text is
 * copied from the live homepage template (not part of the WordPress export);
 * Turkish versions come from the live theme's translation dictionary.
 */
import type { Localized } from './navigation';

export const site = {
  /** The WordPress site this project replaces. Used for documentation only. */
  legacyOrigin: 'https://w3.cs.bilkent.edu.tr',
  emblem: '/wp-content/uploads/2023/03/amblem-tr.png',
  contact: {
    phone: '(312) 290 1218',
    phoneUri: 'tel:+903122901218',
    fax: '(312) 266 4047',
  },
  social: [
    { network: 'LinkedIn', label: 'Bilkent CS Network', href: 'https://www.linkedin.com/groups/1662997/' },
    { network: 'X', label: 'CS@Bilkent', href: 'https://x.com/CS_Bilkent' },
    { network: 'YouTube', label: 'Bilkent CS', href: 'https://www.youtube.com/@BilkentComputerEngineering' },
  ],
} as const;

export interface InfoCard {
  title: Localized;
  body: Localized;
  /** Language the text is written in when only one version exists. */
  textLang?: 'en' | 'tr';
  /** `contain` for logos, which must not be cropped. */
  image: { src: string; alt: Localized; fit?: 'cover' | 'contain' };
  link?: { href: string; label: Localized; targetLang?: 'en' | 'tr' };
}

/** The three cards in the blue band on the live homepage. */
export const homeInfoCards: InfoCard[] = [
  {
    // Shown in Turkish on both language versions of the live homepage.
    title: { en: 'Üniversite Adaylarına', tr: 'Üniversite Adaylarına' },
    body: {
      en: 'Sevgili Üniversite Adayları,\nYoğun bir hazırlık döneminin ardından hayatınızın belki de en önemli kararlarından biri olan meslek ve üniversite seçimi aşamasında olduğunuz bu günlerde sizlere yardımcı olabilmek amacıyla bir sayfa hazırladık. Bu sayfada bilgisayar mühendisliği mesleği hakkında genel bilgiler ve Bilkent Bilgisayar Mühendisliği Bölümündeki lisans programı hakkında açıklayıcı bilgiler bulacaksınız.',
      tr: 'Sevgili Üniversite Adayları,\nYoğun bir hazırlık döneminin ardından hayatınızın belki de en önemli kararlarından biri olan meslek ve üniversite seçimi aşamasında olduğunuz bu günlerde sizlere yardımcı olabilmek amacıyla bir sayfa hazırladık. Bu sayfada bilgisayar mühendisliği mesleği hakkında genel bilgiler ve Bilkent Bilgisayar Mühendisliği Bölümündeki lisans programı hakkında açıklayıcı bilgiler bulacaksınız.',
    },
    textLang: 'tr',
    image: { src: '/wp-content/uploads/2023/03/students-working-500x315.jpg', alt: { en: 'Students working', tr: 'Çalışan öğrenciler' } },
    // NEW: the live card has no link; it points to the page the letter introduces.
    link: { href: '/tr/universite-adaylarina/', label: { en: 'Read More', tr: 'Devamı' }, targetLang: 'tr' },
  },
  {
    title: { en: 'Graduate Programs', tr: 'Lisansüstü Programlar' },
    body: {
      en: 'Current research areas of Department of Computer Engineering M.S. and Ph.D. degree programs are algorithms, artificial intelligence, bioinformatics, computer graphics, computer networks, computer vision, cryptography, data mining, data science, database systems, graph visualization, high performance computing, information retrieval, machine learning, mobile and wireless systems, natural language processing, parallel and distributed systems, pattern recognition, robotics, scientific computing, software engineering, and virtual reality.',
      tr: 'Bilgisayar Mühendisliği yüksek lisans ve doktora derece programları araştırma alanları şunlardır: algoritmalar, yapay zeka, biyoinformatik, bilgisayar grafikleri, bilgisayar ağları, bilgisayarla görme, kriptografi, veri madenciliği, veri bilimi, veritabanı sistemleri, grafik görselleştirme, yüksek performanslı bilgi işlem, bilgi alma, makine öğrenimi, mobil ve kablosuz sistemler, doğal dil işleme, paralel ve dağıtık sistemler, örüntü tanıma, robotik, bilimsel hesaplama, yazılım mühendisliği ve sanal gerçeklik.',
    },
    image: { src: '/wp-content/uploads/2023/03/students-working2-500x308.jpg', alt: { en: 'Students working', tr: 'Çalışan öğrenciler' } },
    // NEW: the live card has no link.
    link: { href: '/graduate-programs/', label: { en: 'Read More', tr: 'Devamı' }, targetLang: 'en' },
  },
  {
    title: { en: 'ABET', tr: 'ABET' },
    body: {
      en: 'The Computer Engineering BS Program is accredited by the Engineering Accreditation Commission of ABET, https://www.abet.org, under the General Criteria and the Program Criteria for Electrical, Computer, Communications, Telecommunication(s) and Similarly Named Engineering Programs.',
      tr: 'Bilgisayar Mühendisliği Lisans Programı, ABET Mühendislik Akreditasyon Komisyonu tarafından Genel Kriterler ve Elektrik, Bilgisayar, Haberleşme, Telekomünikasyon(lar) ve Benzeri Adlı Mühendislik Programları için Program Kriterleri kapsamında akredite edilmiştir.',
    },
    image: { src: '/wp-content/uploads/2023/05/abet-eng.png', alt: { en: 'ABET logo', tr: 'ABET logosu' }, fit: 'contain' },
    link: { href: 'https://www.abet.org/', label: { en: 'www.abet.org', tr: 'www.abet.org' } },
  },
];
