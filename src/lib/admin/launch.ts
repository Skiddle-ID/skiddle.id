/**
 * Whether the admin app publishes posts: off until the v4 launch.
 *
 * Until then skiddle.id is built from git (v3), and v3's AT Protocol sync rewrites every post's
 * record from git and deletes the ones git doesn't have. So a post published, edited or
 * unpublished from here would 404 on skiddle.id, or be undone by the next sync. Drafts are a
 * separate collection the sync never touches, so they work now.
 *
 * At the launch (docs/v4/posts-on-atproto.md, "The switch"): set this to true, and add to the
 * sign-in's COLLECTIONS (src/lib/admin/oauth.ts) site.standard.document, id.skiddle.series and
 * app.bsky.feed.post (create, for the announcement). That turns on publishing and scheduling
 * drafts, saving and unpublishing published posts (src/lib/admin/editor.ts), saving and deleting
 * series (src/lib/admin/series.ts), saving pages and projects (src/lib/admin/page-editor.ts), and
 * saving redrawn share cards (src/lib/admin/redraw.ts). Then
 * set up the scheduler, which publishes scheduled drafts (workers/publisher/README.md).
 */
export const PUBLISHING_LIVE = false;

/** Why publishing is off, shown under the buttons it disables */
export const NOT_LIVE_YET =
  'Publishing from here starts with the v4 launch. Until then the site is built from git, and the sync would undo changes made here.';

/** The same for the page editors (src/lib/admin/page-editor.ts) */
export const PAGES_NOT_LIVE_YET =
  'Saving pages from here starts with the v4 launch. Until then skiddle.id shows the data files in git, and the parity check expects the records to match them. Changes are kept on this device.';

/** The same for series (src/lib/admin/series.ts) */
export const SERIES_NOT_LIVE_YET =
  'Saving series from here starts with the v4 launch. Until then the sync writes each series’ name, planned parts and cadence from git, and would undo changes made here. Changes are kept on this device.';
