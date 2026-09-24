import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TOPIC_IDS } from './lib/topics';

const FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)\.mdx?$/;

function frontMatterDate(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/posts',
    // Posts are named YYYY-MM-DD-slug.md and served at /posts/slug/, matching the old Jekyll URLs.
    generateId: ({ entry, data }) => {
      const match = FILENAME.exec(entry);
      if (!match) {
        throw new Error(`Post "${entry}" must be named YYYY-MM-DD-slug.md (lowercase slug).`);
      }
      const [, fileDate, slug] = match;
      if (frontMatterDate(data.date) !== fileDate) {
        throw new Error(
          `Post "${entry}" has date ${frontMatterDate(data.date)}, but its filename says ${fileDate}. Make them match.`,
        );
      }
      return slug;
    },
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        date: z.coerce.date(),
        topic: z.enum(TOPIC_IDS),
        tags: z.array(z.string().regex(/^[a-z0-9-]+$/, 'Tags are lowercase words joined by hyphens')).default([]),
        image: image(),
        description: z.string().max(200).optional(),
        featured: z.number().int().positive().optional(),
        stat: z.object({ value: z.string().min(1), label: z.string().min(1) }).optional(),
        draft: z.boolean().default(false),
      })
      .refine((post) => !post.featured || post.stat, {
        message: 'Featured posts need a stat (value and label) for their card.',
        path: ['stat'],
      }),
});

export const collections = { posts };
