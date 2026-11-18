/**
 * Whether the admin app publishes: on since the v4 launch (docs/v4/switch.md), when skiddle.id
 * started rendering everything from Jeff's AT Protocol repo and git stopped holding posts.
 *
 * It turns on publishing and scheduling drafts, saving and unpublishing published posts
 * (src/lib/admin/editor.ts), saving and deleting series (src/lib/admin/series.ts), saving pages and
 * projects (src/lib/admin/page-editor.ts), and saving redrawn share cards (src/lib/admin/redraw.ts).
 * The sign-in asks for what they write (COLLECTIONS in src/lib/admin/oauth.ts). The scheduler
 * publishes scheduled drafts (workers/publisher/README.md).
 *
 * Kept as a switch, with its messages, so publishing can be paused by setting it to false.
 */
export const PUBLISHING_LIVE = true;

/** Why publishing is off, shown under the buttons it disables */
export const NOT_LIVE_YET = 'Publishing from here is paused.';

/** The same for the page editors (src/lib/admin/page-editor.ts) */
export const PAGES_NOT_LIVE_YET = 'Saving pages from here is paused. Changes are kept on this device.';

/** The same for series (src/lib/admin/series.ts) */
export const SERIES_NOT_LIVE_YET = 'Saving series from here is paused. Changes are kept on this device.';
