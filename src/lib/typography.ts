/**
 * Typographic punctuation, as WordPress's wptexturize applies it on the live
 * site: curly quotes and apostrophes, en dashes and ellipses. Only punctuation
 * changes; letters and digits never do, so word-level parity is unaffected.
 * Text that looks like a URL, an address or code is left alone.
 */
const SKIP = /:\/\/|www\.|@|[{}<>=;]|\b[a-z]+\.[a-z]{2,}\//i;

/**
 * `before` is the character that precedes this text in the document (text is
 * often split by inline tags, as in <a>Dündar</a>'s), so quotes curl the right way.
 */
export function smartPunctuation(text: string, before = ' '): string {
  if (!text || SKIP.test(text)) return text;
  const context = /[\p{L}\p{N}\s]/u.test(before) ? before : ' ';
  return (
    (context + text)
      // Apostrophes inside or at the end of words: Mahmoody'ye, Dündar's, students'.
      .replace(/(\p{L})'(?=\p{L})/gu, '$1’')
      .replace(/(\p{L})'(?=[\s.,;:!?)]|$)/gu, '$1’')
      // Quotes: opening after start, space or bracket; closing elsewhere. Not after digits (5'10").
      .replace(/(^|[\s([{“‘—–-])"(?=\S)/gu, '$1“')
      .replace(/(^|[\s([{“—–-])'(?=\S)/gu, '$1‘')
      .replace(/(?<!\d)"/g, '”')
      .replace(/(?<!\d)'/g, '’')
      // Dashes and ellipsis.
      .replace(/ -{1,2} /g, ' – ')
      .replace(/(\p{L}) ?--- ?(\p{L})/gu, '$1—$2')
      .replace(/\.\.\./g, '…')
  ).slice(1);
}
