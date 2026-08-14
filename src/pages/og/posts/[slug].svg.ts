export const prerender = true;
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }: any) => !data.draft);
  return posts.map((entry: any) => ({
    params: { slug: entry.slug || entry.id.replace(/\.mdx?$/, '') },
    props: { entry },
  }));
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 5);
}

import type { APIRoute } from 'astro';
export const GET: APIRoute = async ({ props }) => {
  const entry = (props as any).entry;
  const title = entry?.data?.title || 'Post';
  const width = 1200;
  const height = 630;
  const bg = '#fbfbfb';
  const primary = '#2a67a5';
  const accentWarm = '#eef6ff';
  const safeTitle = escapeXml(title);
  const lines = wrapText(safeTitle, 28);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="32" y="32" width="1136" height="566" rx="24" fill="${accentWarm}" stroke="#c2d6f0" />
    <rect x="64" y="64" width="1072" height="502" rx="16" fill="white" stroke="#c2d6f0" />
    <g transform="translate(96,180)">
      ${lines.map((line, i) => `<text x="0" y="${i * 72}" font-family="Outfit, system-ui, sans-serif" font-size="56" font-weight="700" fill="#1a2332">${line}</text>`).join('\n')}
    </g>
    <text x="96" y="520" font-family="Geist Mono, monospace" font-size="18" fill="#5a6b87">skiddle.id · ${escapeXml(entry?.data?.category || 'post')}</text>
    <text x="96" y="542" font-family="Geist Mono, monospace" font-size="14" fill="#5a6b87">warm blue · #2a67a5 · local markdown</text>
  </svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
