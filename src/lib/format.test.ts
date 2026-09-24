import { describe, expect, it } from 'vitest';
import { dotDate, excerpt, isoDate, longDate, readingMinutes, wordCount } from './format';

describe('wordCount', () => {
  it('counts prose words', () => {
    expect(wordCount('It cost ninety-one cents, or $0.91.')).toBe(6);
  });

  it('ignores fenced code blocks', () => {
    const md = ['Two words', '```ts', 'const a = 1; const b = 2;', '```', 'three more words'].join('\n');
    expect(wordCount(md)).toBe(5);
  });
});

describe('readingMinutes', () => {
  it('rounds up at 230 words a minute', () => {
    expect(readingMinutes('word '.repeat(230))).toBe(1);
    expect(readingMinutes('word '.repeat(231))).toBe(2);
  });

  it('never reports zero minutes', () => {
    expect(readingMinutes('')).toBe(1);
  });
});

describe('dates', () => {
  // A post dated 2026-09-17 is parsed as UTC midnight, which is Sep 16 in Central time.
  const date = new Date('2026-09-17');

  it('formats in UTC so the calendar day never shifts', () => {
    expect(isoDate(date)).toBe('2026-09-17');
    expect(dotDate(date)).toBe('2026.09.17');
    expect(longDate(date)).toBe('Sep 17, 2026');
  });
});

describe('excerpt', () => {
  it('uses the first paragraph and strips markdown', () => {
    const md = '## Heading\n\nI built **a CI tool** with [Jev](https://typesafe.ai) and `code`.\n\nSecond paragraph.';
    expect(excerpt(md)).toBe('I built a CI tool with Jev and code.');
  });

  it('skips lists, images and code before the first paragraph', () => {
    const md = '![hero](x.png)\n\n- a list\n\n```\ncode\n```\n\nReal opening line.';
    expect(excerpt(md)).toBe('Real opening line.');
  });

  it('trims long text at a word boundary', () => {
    const text = excerpt('alpha beta gamma delta epsilon', 17);
    expect(text).toBe('alpha beta gamma…');
  });
});
