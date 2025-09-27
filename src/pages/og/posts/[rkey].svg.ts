export const prerender = false;
import type { APIRoute } from 'astro';
import { getPost } from '~/atproto/getPost';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 5); // cap lines to avoid overflow
}

export const GET: APIRoute = async ({ params, site, locals }) => {
  const rkey = params.rkey!;
  let title = 'Post';
  try {
    const post = await getPost(locals as any, rkey);
    title = post.title || title;
  } catch {}

  const width = 1200;
  const height = 630;
  const bg = '#0b0f14';
  const primary = '#0ea5e9';
  const safeTitle = escapeXml(title);
  const lines = wrapText(safeTitle, 28);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primary}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${primary}" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="40" y="40" width="1120" height="550" rx="24" fill="url(#g)" stroke="${primary}" stroke-opacity="0.25" />
    <g transform="translate(100,160)">
      ${lines
        .map(
          (line, i) => `<text x="0" y="${i * 74}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial" font-size="64" font-weight="700" fill="#e6edf3">${line}</text>`
        )
        .join('\n')}
    </g>
    <g transform="translate(100,520)">
      <text x="0" y="0" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="28" fill="#9ba7b0">skiddle.id</text>
    </g>
    <circle cx="1150" cy="80" r="6" fill="${primary}" />
    <circle cx="1126" cy="80" r="6" fill="${primary}" />
    <circle cx="1102" cy="80" r="6" fill="${primary}" />
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
