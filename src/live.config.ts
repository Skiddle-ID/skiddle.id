/**
 * Live collections: content read when a page is requested instead of at build time.
 * Posts and series come from Jeff's AT Protocol repo (src/lib/pds-posts.ts).
 */
import { defineLiveCollection } from 'astro:content';
import { postsLoader, seriesLoader } from './lib/pds-posts';

export const collections = {
  pdsPosts: defineLiveCollection({ loader: postsLoader() }),
  pdsSeries: defineLiveCollection({ loader: seriesLoader() }),
};
