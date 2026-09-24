import { getImage } from 'astro:assets';
import { getCollection, type CollectionEntry } from 'astro:content';
import { isoDate, readingMinutes } from './format';
import type { TopicId } from './topics';

export type Post = CollectionEntry<'posts'>;

/** What the post table needs; plain data so it can be passed to a React island. */
export interface PostSummary {
  slug: string;
  title: string;
  date: string;
  topic: TopicId;
  minutes: number;
  thumb: { src: string; srcset: string; width: number; height: number };
}

const THUMB_WIDTH = 120;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', (post) => import.meta.env.DEV || !post.data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getFeatured(): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((post) => post.data.featured).sort((a, b) => (a.data.featured ?? 0) - (b.data.featured ?? 0));
}

export async function summarize(post: Post): Promise<PostSummary> {
  const { image } = post.data;
  const height = Math.round((THUMB_WIDTH * image.height) / image.width);
  const thumb = await getImage({
    src: image,
    width: THUMB_WIDTH,
    widths: [THUMB_WIDTH, THUMB_WIDTH * 2],
    format: 'webp',
  });
  return {
    slug: post.id,
    title: post.data.title,
    date: isoDate(post.data.date),
    topic: post.data.topic,
    minutes: readingMinutes(post.body ?? ''),
    thumb: { src: thumb.src, srcset: thumb.srcSet.attribute, width: THUMB_WIDTH, height },
  };
}

export function postUrl(slug: string): string {
  return `/posts/${slug}/`;
}

export function tagUrl(tag: string): string {
  return `/tags/${tag}/`;
}
