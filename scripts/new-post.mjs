// Usage: npm run new -- "Post title" [--topic ai-engineering]
// Creates src/content/posts/YYYY-MM-DD-slug.md with front matter the schema accepts.
import { existsSync, writeFileSync } from 'node:fs';

const TOPICS = ['ai-operations', 'ai-engineering', 'frontend-devops'];
const args = process.argv.slice(2);
const topicFlag = args.indexOf('--topic');
const topic = topicFlag >= 0 ? args.splice(topicFlag, 2)[1] : 'ai-operations';
const title = args.join(' ').trim();

if (!title) {
  console.error('Give the post a title: npm run new -- "Post title" [--topic ai-engineering]');
  process.exit(1);
}
if (!TOPICS.includes(topic)) {
  console.error(`Unknown topic "${topic}". Use one of: ${TOPICS.join(', ')}`);
  process.exit(1);
}

// Today's date where the author lives, so a late-evening post isn't dated tomorrow.
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const slug = title
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');
const file = `src/content/posts/${date}-${slug}.md`;

if (existsSync(file)) {
  console.error(`${file} already exists.`);
  process.exit(1);
}

writeFileSync(
  file,
  `---
title: ${JSON.stringify(title)}
date: ${date}
topic: ${topic}
tags: []
image: ../../assets/img/${slug}.png
draft: true
---

Opening paragraph. This becomes the description in search results and link previews unless you add a \`description\`.
`,
);

console.log(`Created ${file}
Next:
  1. Add the header image at src/assets/img/${slug}.png (the build fails until it exists).
  2. Remove "draft: true" when it is ready to publish. Drafts show in \`npm run dev\` only.`);
