// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// Old Jekyll (Chirpy) pages that no longer exist. Every URL in
// tests/fixtures/legacy-urls.txt must keep resolving; `npm run test:links` enforces it.
const legacyRedirects = {
  '/archives': '/#posts',
  '/categories': '/#posts',
  '/page2': '/#posts',
  '/categories/technology': '/#posts',
  '/categories/ai': '/#posts',
  '/categories/operations': '/?topic=ai-operations#posts',
  '/categories/engineering': '/?topic=ai-engineering#posts',
  '/categories/how-to': '/?topic=ai-engineering#posts',
  '/categories/llm': '/?topic=ai-engineering#posts',
  '/categories/tooluse': '/?topic=ai-engineering#posts',
  '/categories/frontend': '/?topic=frontend-devops#posts',
  '/categories/devops': '/?topic=frontend-devops#posts',
};

export default defineConfig({
  site: 'https://tjklug.com',
  trailingSlash: 'ignore',
  integrations: [react(), mdx()],
  redirects: legacyRedirects,
  // The stylesheet is ~5 KB gzipped; inlining it removes the render-blocking request on slow phones.
  build: { inlineStylesheets: 'always' },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      defaultColor: false,
    },
  },
});
