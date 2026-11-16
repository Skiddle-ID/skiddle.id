import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    /** Set automatically when a published post's text, title or description changes (scripts/mark-updated.mjs) */
    updatedDate: z.coerce.date().optional(),
    /** With draft: true, the time the post goes live by itself (scripts/publish-scheduled.mjs), e.g. 2026-11-20T09:00:00+07:00 */
    publishAt: z.coerce.date().optional(),
    category: z.enum(['infra', 'atproto', 'homelab', 'life']),
    lang: z.string().default('en'),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    series: z.string().optional(),
    order: z.number().optional(),
    rkey: z.string().optional(),
    /** at:// URI of the Bluesky post announcing this post; its replies show as comments */
    bluesky: z.string().startsWith('at://').optional(),
  }),
});

export const collections = { posts };
