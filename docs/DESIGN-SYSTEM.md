# Design system

The design is used on every page of the site. It was developed from reviewed prototypes of the homepage, the faculty directory, an announcement and a long-form page, in English and Turkish, built from the real content. It is implemented in plain CSS with design tokens. There is no CSS framework.

Code: `src/styles/` (tokens and styles, all scoped to the `.ds` class on `<body>`), `src/components/` (layout, header, footer and page components), `src/scripts/site.ts` (behaviour), `scripts/process-media.ts` (image pipeline).

## Principles

1. **Institutional, then modern.** Navy and Bilkent blue carry the identity. Bilkent red is a precise accent (rules, markers, tags) and is never used as a background. Headlines use a serif, which signals an academic institution; the interface uses a humanist sans-serif for clarity.
2. **The content is the design.** Every word comes from the department's pages. Figures are computed from department pages and link to their source. Nothing is added to make a page look fuller: no stock photographs and no invented slogans.
3. **People first.** Real photographs cropped around faces. Names, titles and contact actions are easy to scan and to use on a phone.
4. **Readable long-form pages.** About 70 characters per line and 18 px text. Long pages get a table of contents, and every section has an anchor link.
5. **Bilingual by construction.** Every component works in English and Turkish. The language switch goes to the matching page, and every typeface covers the Turkish letters.
6. **Accessible and fast.** WCAG 2.1 AA contrast, visible focus, keyboard-operable menus and full use without JavaScript. Fonts are self-hosted, images are responsive WebP, and no third-party request is made until the reader asks for one.

## Tokens (`src/styles/tokens.css`)

**Colour.** Contrast ratios are against white, for colours used as text.

| Token | Value | Use |
|---|---|---|
| `--navy-950` | `#061634` | Hero, footer, headings (17.9:1) |
| `--navy-900` / `--navy-800` | `#0a2150` / `#102c66` | Hover states, dark surfaces |
| `--blue-600` | `#1f4fa2` | Links and primary actions; the live theme's Bilkent blue (7.8:1) |
| `--blue-50` / `--blue-100` | `#f2f6fd` / `#e3ebfa` | Tinted sections, chips |
| `--red-600` | `#ed1c24` | Bilkent red: rules, markers, large text only (4.4:1) |
| `--red-700` | `#c8102e` | Red text, tags, numbering (5.9:1) |
| `--ink-900` / `--ink-600` / `--ink-500` | `#0e1726` / `#475467` / `#5d6b82` | Body, secondary and meta text (18 / 7.7 / 5.4:1) |
| `--ink-50` … `--ink-300` | | Surfaces and borders |
| `--on-dark-muted` | `#bcd0f5` | Secondary text on navy (11.5:1) |

**Type.** Source Serif 4 for headlines (with optical sizes) and Source Sans 3 for text and interface. Both are OFL-licensed variable fonts, self-hosted through Fontsource, with Latin Extended for ğ, ş, ı and İ.

| Role | Size | Notes |
|---|---|---|
| Display (homepage) | 40–72 px | Serif 600, tracking −0.02em |
| Page title | 34–52 px | Serif 600 |
| Section | 28–38 px | Serif 600 |
| Card title | 22–26 px | Serif 600 |
| Lead | 17–20 px | Sans, ink-600 |
| Body | 17 px interface, 18 px long-form | Line height 1.62 / 1.75 |
| Eyebrow / tag | 13 px | Sans 700, uppercase, 0.09em, red-700 with a red rule |

**Space and layout.** A 4 px base scale (`--s-1` … `--s-24`). Content width 76rem with a fluid gutter of 16–40 px. Reading measure 42rem (about 70 characters). Section spacing 56–104 px, fluid.

**Shape and depth.** Radii of 6, 10 and 16 px; three shadow levels; 180 ms ease-out transitions, turned off under `prefers-reduced-motion`.

## Components

| Component | Where | Notes |
|---|---|---|
| Header: utility bar, department lockup, full-width menu panels | All pages | Panels open with a click or Enter, and close with Escape or a click outside. On phones a full-screen drawer with accordions and a focus trap opens instead. Without JavaScript, panels open on hover and focus, and on phones every menu link is listed below the header. The language switch is in the utility bar, the phone header and the drawer, and says when a page has no translation. |
| Footer | All pages | Address, phone (`tel:` link), About and Quick links, social links with icons. |
| Hero | Homepage | Navy with a faint engineering grid. The department's name, the mission statement quoted verbatim from the Mission page, the latest announcement as a card, and the homepage quick links. |
| Figures band | Homepage | Numbers computed at build time from department pages (faculty, instructors, graduate students, enrolment, degrees, research areas). Each links to its source. |
| News grid, dated notices | Homepage, article sidebar | A lead story with photo, then a grid of four. Announcements are shown as dated notices. |
| Research area list | Homepage | In the department's order, with faculty and course counts read from each area page. |
| Programme cards | Homepage | The three cards of the live homepage, kept verbatim. Logos are shown whole, never cropped. |
| Page header, section tabs | Inner pages | Breadcrumb and title on a tinted band. Tabs list the sibling pages of the menu section or parent page on one row. If they do not fit, the row scrolls sideways, fades at the edge that hides more tabs, and brings the current tab into view. |
| Directory | The 16 people pages | Search for lists of more than 12 people. Faculty pages filter by research area and student pages by programme (the filter bar stays in view on wide screens). Every line of each source entry is shown in source order. Contact lines get icons, and their source labels stay as screen-reader text. Role and title lines take the same height on every card, so names line up across a row. The large layout uses 4:5 portraits (88 px circles on phones); the compact layout (students) uses 72 px circles. People without a photograph in the source get their initials. A photograph that is in the source but missing from the build gets a labelled placeholder, which the verification report counts. |
| Article | Announcements, news | Title, category tag, date and a link to the translation. A lead paragraph, full-width figures and tables, previous and next posts, and a sidebar of more posts from the category. |
| Long-form page | Every page with two or more sections | A sticky table of contents that highlights the current section (collapsible on phones), anchored headings, numbered statements for ordered lists, and label lines. |
| Archive | News, announcements (EN and TR) | Dated entries with the first image of each post, 10 per page as on WordPress, and numbered pagination (previous / current / next on phones). |
| Thumbnails | Homepage, archives | 4:3 frames. Photographs fill the frame, and portraits are cropped from the top, where faces are. Graphics (posters, slides, diagrams) and very wide banners are shown whole on a tinted ground. |
| Lists | Migrated content | Red bullets and numbered statements. Lists made only of links get roomier rows for touch. Long lists of short items (graduates, course pages) use two columns on wide screens. |
| Tables | All | Header row. On phones, simple tables become stacked cards; wide tables scroll inside their own box, with a sticky label column and edge shadows. |
| Embeds | Posts | YouTube and LinkedIn load only after a click, from privacy-preserving hosts. The original link is always shown. |

## Photographs and media

`npm run media:process`, which runs at the start of every build, turns each upload into:

- WebP variants from 320 to 1600 px, used in `srcset` with the original's pixel size declared to avoid layout shift;
- square crops for portraits at 160, 320 and 480 px, centred on the most salient region (sharp `attention`).

It writes a manifest that the components read at build time. Unchanged files are skipped by content hash, and variants of deleted uploads are removed. A replacement photograph at the same path is picked up automatically.

## Maintaining the design

- Change tokens, not individual values. Colours, type sizes and spacing live in `tokens.css`.
- New components follow the same pattern: an Astro component in `src/components/`, styles in the matching file in `src/styles/` (`chrome.css` for the header and footer, `home.css` for the homepage, `pages.css` for inner pages, `prose.css` for migrated content), and interface strings in both languages in `src/i18n/ui.ts`.
- After any visual change, run `npm run build && npm run verify && npm run qa:browser`. The browser check fails on sideways scrolling, script errors, headings larger than the page title and axe-core violations, at phone and desktop widths.

## Not decided yet

- Whether the English homepage should keep the Turkish-only prospective-students card (OPEN-ISSUES C11).
- Menu labels and page titles (OPEN-ISSUES C13).
- Search (a static index such as Pagefind).
- Official logo files (OPEN-ISSUES P3) and new photography (A3).
