/**
 * Markup for media that has not been migrated yet, used by the content
 * transformer so placeholders look and read the same everywhere. The data attribute lets the verification report count them.
 */
const ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4"/><circle cx="15.5" cy="9" r="1.5" fill="currentColor"/></svg>';

const PERSON_ICON =
  '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.8 19.5c1.2-3.5 4-5.2 7.2-5.2s6 1.7 7.2 5.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface PlaceholderOptions {
  src: string;
  alt: string;
  label: string;
  className?: string;
  /** Width in CSS pixels, from the original <img width>. */
  width?: number;
  variant?: 'image' | 'photo';
}

export function missingMediaHtml({ src, alt, label, className, width, variant = 'image' }: PlaceholderOptions): string {
  const name = alt ? `${alt} (${label})` : label;
  const classes = ['media', 'media--missing', `media--missing-${variant}`, className].filter(Boolean).join(' ');
  const style = width ? ` style="width:${width}px"` : '';
  return (
    `<span class="${classes}" role="img" aria-label="${escapeHtml(name)}" data-missing-src="${escapeHtml(src)}"${style}>` +
    (variant === 'photo' ? PERSON_ICON : ICON) +
    `<span class="media__label" aria-hidden="true">${escapeHtml(label)}</span></span>`
  );
}
