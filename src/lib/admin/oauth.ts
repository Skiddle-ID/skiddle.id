/**
 * AT Protocol OAuth for the admin app (/admin/). The app is a public OAuth client that runs
 * in the browser (@atproto/oauth-client-browser): no server, no secret and no database. The
 * tokens are DPoP-bound and stay in this browser's IndexedDB. Writes go straight to Jeff's PDS.
 *
 * The client ID is the URL of the client metadata (/oauth-client-metadata.json), which is
 * built from the host it's served on, so sign-in works on skiddle.id, the v4 staging site and
 * every preview. On 127.0.0.1 the app uses AT Protocol's loopback client instead (for
 * `astro dev`), whose sessions only last a day.
 */

/**
 * What the app may do with the account, and nothing else: write these collections and upload
 * images. Bluesky's sign-in page lists them. A new collection is added here, and signing in again
 * grants it; the app asks for that when its session lacks one (missingScopes).
 *   - id.skiddle.status: the status, and id.skiddle.statusLog: its history
 *   - id.skiddle.event: the timeline's events (docs/v4/timeline.md)
 *   - com.atproto.lexicon.schema: publishing the lexicons
 *   - id.skiddle.draft: posts being written (docs/v4/posts-on-atproto.md)
 *   - id.skiddle.site: the site's metadata for search engines and link previews
 *   - id.skiddle.project, .home, .cv, .services, .uses, .about, .now and .notes: the pages' content
 *     (docs/v4/pages-on-atproto.md), edited in the Pages section
 *   - site.standard.document: published posts (Standard.site), written when a post is published,
 *     edited or unpublished
 *   - id.skiddle.series: the series
 *   - id.skiddle.categories: the post categories, edited from the Posts section
 *   - app.bsky.feed.generator: a series' Bluesky feed (src/lib/bluesky-feed.mjs), published from
 *     the series editor
 * and, create only (CREATE_ONLY):
 *   - app.bsky.feed.post: the Bluesky post that announces a new post; the app never edits or
 *     deletes Bluesky posts
 */
export const COLLECTIONS = [
  'id.skiddle.status',
  'id.skiddle.statusLog',
  'id.skiddle.event',
  'com.atproto.lexicon.schema',
  'id.skiddle.draft',
  'id.skiddle.project',
  'id.skiddle.cv',
  'id.skiddle.services',
  'id.skiddle.uses',
  'id.skiddle.about',
  'id.skiddle.now',
  'id.skiddle.notes',
  'id.skiddle.home',
  'id.skiddle.site',
  'site.standard.document',
  'id.skiddle.series',
  'id.skiddle.categories',
  'app.bsky.feed.generator',
] as const;
/** Collections the app may only add to */
export const CREATE_ONLY = ['app.bsky.feed.post'] as const;
/** Uploads: a post's images */
export const BLOB_TYPES = ['image/*'] as const;
export const SCOPE = [
  'atproto',
  ...COLLECTIONS.map((c) => `repo:${c}`),
  ...CREATE_ONLY.map((c) => `repo:${c}?action=create`),
  ...BLOB_TYPES.map((t) => `blob:${t}`),
].join(' ');

/** The parts of SCOPE a session's granted scope doesn't have (it was signed in before they were added) */
export function missingScopes(granted: string): string[] {
  const have = new Set(granted.split(/\s+/));
  return SCOPE.split(' ').filter((s) => !have.has(s));
}

export const ADMIN_PATH = '/admin/';
export const CLIENT_METADATA_PATH = '/oauth-client-metadata.json';

export function isLoopback(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '[::1]' || hostname === 'localhost';
}

/** The client metadata for the app served from `origin` (an https origin) */
export function clientMetadata(origin: string) {
  return {
    client_id: `${origin}${CLIENT_METADATA_PATH}`,
    client_name: 'skiddle.id admin',
    client_uri: origin,
    logo_uri: `${origin}/android-chrome-192x192.png`,
    redirect_uris: [`${origin}${ADMIN_PATH}`] as [string],
    scope: SCOPE,
    grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
    response_types: ['code'] as ['code'],
    token_endpoint_auth_method: 'none' as const,
    application_type: 'web' as const,
    dpop_bound_access_tokens: true,
  };
}

/** The loopback client ID for local development (http://127.0.0.1:<port>/admin/) */
export function loopbackClientId(port: string): string {
  const redirect = `http://127.0.0.1${port ? `:${port}` : ''}${ADMIN_PATH}`;
  return `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(SCOPE)}`;
}
