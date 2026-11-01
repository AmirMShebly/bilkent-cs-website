/**
 * Progressive enhancement for migrated content. Without JavaScript every
 * piece of information is still visible; these only add convenience.
 */

/** Addresses are written as data attributes (as on the live site) and become mailto links here. */
function upgradeEmails(): void {
  document.querySelectorAll<HTMLElement>('span.email[data-user][data-domain]').forEach((span) => {
    const address = `${span.dataset.user}@${span.dataset.domain}`;
    const label = span.textContent?.trim();
    const link = document.createElement('a');
    link.href = `mailto:${address}`;
    link.className = 'email-link';
    // Long addresses may wrap after the "@" (a <wbr> is not copied with the text).
    if (address.length > 26) link.append(`${span.dataset.user}@`, document.createElement('wbr'), span.dataset.domain ?? '');
    else link.append(address);
    if (label) {
      // The label stays as written; the address becomes the link.
      const wrapper = document.createElement('span');
      wrapper.append(`${label} – `, link);
      span.replaceWith(wrapper);
    } else {
      span.replaceWith(link);
    }
  });
}

/** Third-party embeds load only after the reader asks for them. */
function enableEmbeds(): void {
  document.querySelectorAll<HTMLElement>('figure.embed[data-embed-src]').forEach((figure) => {
    const button = figure.querySelector<HTMLButtonElement>('.embed__load');
    const frame = figure.querySelector<HTMLElement>('.embed__frame');
    if (!button || !frame) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = figure.dataset.embedSrc!;
      iframe.title = figure.dataset.embedTitle ?? '';
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.replaceChildren(iframe);
      frame.classList.add('is-loaded');
      iframe.focus();
    });
  });
}

export function enhanceContent(): void {
  upgradeEmails();
  enableEmbeds();
}
