/*
  Astro API Route: /lastfm.svg
  Returns a dynamic SVG showing your Last.fm recent track(s).
  Configuration via environment variables:
    - LASTFM_USERNAME
    - LASTFM_API_KEY
  Optional query params:
    - user: override username
    - limit: number of tracks to show (default 1, max 5)
    - theme: light | dark (default dark)

  Example embed (GitHub README):
  ![Last.fm](https://<your-domain>/lastfm.svg)
*/

import type { APIRoute } from 'astro';

const THEMES = {
  dark: {
    bg: '#0d1117',
    card: '#161b22',
    text: '#c9d1d9',
    accent: '#58a6ff',
    muted: '#8b949e',
    border: '#30363d',
  },
  light: {
    bg: '#ffffff',
    card: '#f6f8fa',
    text: '#1f2328',
    accent: '#0969da',
    muted: '#57606a',
    border: '#d0d7de',
  },
} as const;

type Theme = (typeof THEMES)[keyof typeof THEMES];

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const env = (locals as any)?.runtime?.env as Env | undefined;
    const username = url.searchParams.get('user') || env?.LASTFM_USERNAME || '';
    const apiKey = env?.LASTFM_API_KEY || '';
    const limitParam = Number(url.searchParams.get('limit') || '1');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(5, limitParam)) : 1;
    const themeKey = (url.searchParams.get('theme') || 'dark').toLowerCase() as keyof typeof THEMES;
    const theme = THEMES[themeKey] || THEMES.dark;

    if (!username || !apiKey) {
      return svgResponse(renderErrorSvg('Missing LASTFM_USERNAME or LASTFM_API_KEY env'), 400);
    }

    const endpoint = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
      username
    )}&api_key=${apiKey}&limit=${limit}&format=json`;

    const res = await fetch(endpoint, { headers: { 'User-Agent': 'Astro-LastFM-Route' } });
    if (!res.ok) {
      return svgResponse(renderErrorSvg(`Last.fm API error ${res.status}`), 502);
    }
    const data: any = await res.json();
    const tracks = (data?.recenttracks?.track || []).map((t: any) => ({
      artist: t?.artist?.['#text'] || 'Unknown Artist',
      name: t?.name || 'Unknown Track',
      album: t?.album?.['#text'] || '',
      nowPlaying: Boolean(t?.['@attr']?.nowplaying),
      url: t?.url || `https://www.last.fm/user/${username}`,
    }));

    const svg = renderTracksSvg({ username, tracks, theme });
    return svgResponse(svg, 200);
  } catch (err: any) {
    return svgResponse(renderErrorSvg('Unexpected error generating SVG'), 500);
  }
};

function svgResponse(svg: string, status = 200) {
  return new Response(svg, {
    status,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Cache for 5 minutes at the edge; allow stale for 10 minutes
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function renderTracksSvg({
  username,
  tracks,
  theme,
}: {
  username: string;
  tracks: Array<{ artist: string; name: string; album: string; nowPlaying: boolean; url: string }>;
  theme: Theme;
}) {
  const width = 600;
  const rowHeight = 54;
  const padding = 16;
  const titleHeight = 28;
  const height = padding * 2 + titleHeight + tracks.length * rowHeight;

  const rows = tracks
    .map((item, idx) => {
      const y = padding + titleHeight + idx * rowHeight + 10;
      const status = item.nowPlaying ? 'Now Playing' : 'Recently Played';
      return `
        <a href="${escapeXml(item.url)}" target="_blank">
          <text x="${padding}" y="${y}" fill="${theme.accent}" font-size="14" font-weight="600">${escapeXml(
        status
      )}</text>
          <text x="${padding}" y="${y + 18}" fill="${theme.text}" font-size="16" font-weight="700">${escapeXml(
        item.name
      )}</text>
          <text x="${padding}" y="${y + 36}" fill="${theme.muted}" font-size="13">${escapeXml(
        item.artist
      )}${item.album ? ' — ' + escapeXml(item.album) : ''}</text>
        </a>
      `;
    })
    .join('\n');

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Last.fm Recently Played">
  <style>
    .card { fill: ${theme.card}; stroke: ${theme.border}; stroke-width: 1px; }
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji','Segoe UI Emoji'; }
    a { text-decoration: none; }
  </style>
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" class="card"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${theme.bg}" opacity="0.6" rx="12"/>
  <text x="${padding}" y="${padding + 18}" fill="${theme.text}" font-size="16" font-weight="700">
    ♪ Last.fm: ${escapeXml(username)}
  </text>
  ${rows}
</svg>
  `.trim();
}

function renderErrorSvg(message: string) {
  const theme = THEMES.dark;
  const width = 600;
  const height = 90;
  const padding = 16;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Last.fm Error">
  <style>
    .card { fill: ${theme.card}; stroke: ${theme.border}; stroke-width: 1px; }
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji','Segoe UI Emoji'; }
  </style>
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" class="card"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${theme.bg}" opacity="0.6" rx="12"/>
  <text x="${padding}" y="${padding + 24}" fill="#f85149" font-size="18" font-weight="700">Last.fm Integration Error</text>
  <text x="${padding}" y="${padding + 48}" fill="#c9d1d9" font-size="14">${escapeXml(message)}</text>
</svg>
  `.trim();
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
