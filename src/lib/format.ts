const WORDS_PER_MINUTE = 230;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Drops fenced code blocks so how-to posts are not credited with reading their code. */
function stripCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1\s*$/gm, '');
}

export function wordCount(markdown: string): number {
  const words = stripCode(markdown).match(/[\p{L}\p{N}][\p{L}\p{N}'’.,$%-]*/gu);
  return words ? words.length : 0;
}

export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(wordCount(markdown) / WORDS_PER_MINUTE));
}

// Post dates are calendar dates, parsed as UTC midnight. Format in UTC so a
// Central-time build or visitor never shows the day before.
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dotDate(date: Date): string {
  return isoDate(date).replaceAll('-', '.');
}

export function longDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** First paragraph of plain text, trimmed to `max` characters at a word boundary. */
export function excerpt(markdown: string, max = 160): string {
  const paragraph = stripCode(markdown)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !/^(#|>|\||!\[|<|[-*+] |\d+\. )/.test(block));
  if (!paragraph) return '';
  const text = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
