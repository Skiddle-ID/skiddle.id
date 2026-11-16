import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const { origin, hostname } = new URL(request.url);
  // Only skiddle.id itself may be indexed: previews (*.workers.dev, which can show drafts) may not
  const live = hostname === 'skiddle.id' || hostname === 'www.skiddle.id';
  const body = live ? liveRobots(origin) : 'User-agent: *\nDisallow: /\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

/**
 * Search engines are welcome; AI training is not (see LICENSE-CONTENT.md). Content-Signal is
 * Cloudflare's Content Signals Policy (contentsignals.org): search yes, AI training no. The second
 * group turns away crawlers that collect text to train AI models. robots.txt is a request, not a lock.
 */
const AI_TRAINING_CRAWLERS = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent'];

function liveRobots(origin: string): string {
  return [
    '# The writing on skiddle.id is all rights reserved, and may not be used to train AI models.',
    '# https://github.com/Skiddle-ID/skiddle.id/blob/v3/LICENSE-CONTENT.md',
    'User-agent: *',
    'Content-Signal: search=yes, ai-train=no',
    'Allow: /',
    '',
    ...AI_TRAINING_CRAWLERS.map((bot) => `User-agent: ${bot}`),
    'Disallow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
