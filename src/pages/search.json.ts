import type { APIRoute } from 'astro';
import { getPosts, postUrl } from '~/lib/posts';

// The command bar's search data (src/components/command-bar.astro). Built with the site and
// only downloaded the first time someone opens the command bar. Drafts are left out.
export const prerender = true;

/** Rough plain text from Markdown, for matching and result snippets (never rendered as HTML). */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/^import .*$/gm, ' ') // MDX imports
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
    .replace(/^\s*-{3,}\s*$/gm, ' ') // horizontal rules
    .replace(/[*`~]/g, '') // emphasis, inline code
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '') // _emphasis_, but keep snake_case words
    .replace(/[<>|]/g, ' ') // tags, tables
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const index = posts.map((p) => ({
    title: p.data.title,
    url: postUrl(p),
    description: p.data.description ?? '',
    tags: p.data.tags,
    category: p.data.category,
    series: p.data.series ?? '',
    date: p.data.pubDate.toISOString(),
    text: plainText(p.body ?? ''),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
