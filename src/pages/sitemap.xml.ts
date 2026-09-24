import type { APIContext } from 'astro';
import { SITE } from '../data/site';
import { isoDate } from '../lib/format';
import { getPosts, postUrl, tagUrl } from '../lib/posts';

// Served at /sitemap.xml, the URL search engines already have from the Jekyll site.
export async function GET(context: APIContext) {
  const site = context.site ?? new URL(SITE.url);
  const posts = await getPosts();
  const tags = [...new Set(posts.flatMap((post) => post.data.tags))];
  const entries: { path: string; lastmod?: string }[] = [
    { path: '/', lastmod: posts[0] && isoDate(posts[0].data.date) },
    { path: '/about/' },
    { path: '/tags/' },
    ...posts.map((post) => ({ path: postUrl(post.id), lastmod: isoDate(post.data.date) })),
    ...tags.map((tag) => ({ path: tagUrl(tag) })),
  ];
  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = `<loc>${new URL(path, site).href}</loc>`;
      return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
