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
}

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', (post) => import.meta.env.DEV || !post.data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getFeatured(): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((post) => post.data.featured).sort((a, b) => (a.data.featured ?? 0) - (b.data.featured ?? 0));
}

export function summarize(post: Post): PostSummary {
  return {
    slug: post.id,
    title: post.data.title,
    date: isoDate(post.data.date),
    topic: post.data.topic,
    minutes: readingMinutes(post.body ?? ''),
  };
}

export function postUrl(slug: string): string {
  return `/posts/${slug}/`;
}

export function tagUrl(tag: string): string {
  return `/tags/${tag}/`;
}
