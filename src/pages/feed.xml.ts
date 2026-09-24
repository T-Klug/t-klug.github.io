import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../data/site';
import { excerpt } from '../lib/format';
import { getPosts, postUrl } from '../lib/posts';

// Same path as the old jekyll-feed output, so existing subscribers keep working.
export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description ?? excerpt(post.body ?? ''),
      link: postUrl(post.id),
      categories: post.data.tags,
    })),
  });
}
