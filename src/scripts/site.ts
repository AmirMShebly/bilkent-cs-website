/**
 * Site behaviour: menu panels, the phone drawer, directory search and
 * filters, table-of-contents highlighting, e-mail links and click-to-load
 * embeds. Every page remains usable without JavaScript.
 */
import { enhanceContent } from './enhance';

const desktop = window.matchMedia('(min-width: 64em)');

function megaMenus(): void {
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-mega-toggle]')];
  const close = (except?: HTMLButtonElement) =>
    toggles.forEach((t) => t !== except && t.setAttribute('aria-expanded', 'false'));
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      close(toggle);
      toggle.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = toggles.find((t) => t.getAttribute('aria-expanded') === 'true');
    if (open) {
      open.setAttribute('aria-expanded', 'false');
      open.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.nav__item')) close();
  });
  // Close a panel when keyboard focus moves out of its menu item.
  document.querySelectorAll<HTMLElement>('.nav__item').forEach((item) => {
    item.addEventListener('focusout', (e) => {
      const next = e.relatedTarget as Node | null;
      if (next && !item.contains(next)) item.querySelector('[data-mega-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });
}

function drawer(): void {
  const panel = document.querySelector<HTMLElement>('[data-drawer]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-drawer-open]');
  const closeBtn = panel?.querySelector<HTMLButtonElement>('[data-drawer-close]');
  if (!panel || !openBtn || !closeBtn) return;
  // Without JavaScript the drawer is a plain list of links in the page, so it
  // only becomes a modal dialog while it is open.
  const label = panel.dataset.label ?? '';
  const setOpen = (open: boolean, returnFocus = true) => {
    panel.hidden = !open;
    if (open) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', label);
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-label');
    }
    openBtn.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) closeBtn.focus();
    else if (returnFocus) openBtn.focus();
  };
  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key !== 'Tab') return;
    // Keep focus inside the open drawer.
    const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button')].filter((el) => el.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-accordion]').forEach((btn) => {
    btn.addEventListener('click', () => btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true')));
  });
  // Widened to desktop with the drawer open: the menu button is hidden there,
  // so focus moves to the first item of the desktop menu.
  desktop.addEventListener('change', () => {
    if (!desktop.matches || panel.hidden) return;
    const hadFocus = panel.contains(document.activeElement);
    setOpen(false, false);
    if (hadFocus) document.querySelector<HTMLElement>('.nav [data-mega-toggle], .nav a')?.focus();
  });
}

/** Case-, accent- and dotless-i-insensitive text for matching. */
function normalize(text: string): string {
  return text.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function directory(): void {
  const root = document.querySelector<HTMLElement>('[data-directory]');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>('[data-directory-search]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-area]')];
  const status = root.querySelector<HTMLElement>('[data-directory-status]');
  const empty = root.querySelector<HTMLElement>('[data-directory-empty]');
  const cards = [...root.querySelectorAll<HTMLElement>('[data-person]')];
  const text = cards.map((c) => normalize(c.textContent ?? ''));
  root.querySelectorAll<HTMLElement>('[data-js-only]').forEach((el) => (el.hidden = false));
  let area = '';

  const update = () => {
    const terms = normalize(input?.value ?? '').split(' ').filter(Boolean);
    let shown = 0;
    cards.forEach((card, i) => {
      const areas = (card.dataset.areas ?? '').split('|');
      const match = terms.every((t) => text[i]!.includes(t)) && (!area || areas.includes(area));
      card.hidden = !match;
      if (match) shown++;
    });
    if (status) status.textContent = (status.dataset.template ?? '').replace('{shown}', String(shown)).replace('{total}', String(cards.length));
    if (empty) empty.hidden = shown > 0;
  };
  input?.addEventListener('input', update);
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      area = chip.dataset.area === area ? '' : chip.dataset.area ?? '';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.area === area || (!area && c.dataset.area === ''))));
      update();
    }),
  );
  update();
}

function tocSpy(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  // The side and phone tables of contents link to the same headings.
  const byId = new Map<string, HTMLAnchorElement[]>();
  links.forEach((a) => {
    const id = decodeURIComponent(a.hash.slice(1));
    byId.set(id, [...(byId.get(id) ?? []), a]);
  });
  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      const current = [...byId.keys()].find((id) => visible.has(id));
      if (!current) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      byId.get(current)?.forEach((a) => a.setAttribute('aria-current', 'true'));
    },
    { rootMargin: '-120px 0px -60% 0px' },
  );
  byId.forEach((_, id) => {
    const heading = document.getElementById(id);
    if (heading) observer.observe(heading);
  });
}

/**
 * Section tabs and filter chips scroll sideways when they do not fit. Mark
 * which edges hide more items (the CSS fades them), and bring the current tab
 * into view.
 */
function scrollingRows(): void {
  document.querySelectorAll<HTMLElement>('.subnav ul, .filters').forEach((row) => {
    const update = () => {
      const start = row.scrollLeft > 1;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      if (start || end) row.dataset.overflow = start && end ? 'both' : start ? 'start' : 'end';
      else delete row.dataset.overflow;
    };
    const current = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
    }
    update();
    row.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  });
}

export function initSite(): void {
  megaMenus();
  drawer();
  // E-mail addresses become links first, so directory search can match them.
  enhanceContent();
  directory();
  tocSpy();
  scrollingRows();
}
