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
 * app.bsky.feed.post (create, for the announcement). That turns on publishing drafts, and saving
 * and unpublishing published posts (src/lib/admin/editor.ts).
 */
export const PUBLISHING_LIVE = false;

/** Why publishing is off, shown under the buttons it disables */
export const NOT_LIVE_YET =
  'Publishing from here starts with the v4 launch. Until then the site is built from git, and the sync would undo changes made here.';
