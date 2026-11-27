/**
 * What the timeline shows besides Jeff's events (docs/v4/timeline.md, phase 2): his posts, status
 * changes and notes, as timeline entries (activitiesOf, src/lib/timeline.mjs). Each comes from the
 * reader its own page uses, all cached. A source that can't be read is left out and logged, so the
 * timeline still shows the rest.
 */
import { getStatusHistory } from '~/lib/at-status';
import { getNotes } from '~/lib/page-content';
import { postUrl } from '~/lib/posts';
import { sitePosts } from '~/lib/site-posts';
import { activitiesOf, type Activity } from '~/lib/timeline.mjs';

export async function getActivity(): Promise<Activity[]> {
  const [posts, statuses, notes] = await Promise.allSettled([sitePosts(), getStatusHistory(), getNotes()]);
  for (const [name, r] of [['posts', posts], ['statuses', statuses], ['notes', notes]] as const) {
    if (r.status === 'rejected') console.error(`timeline: reading the ${name} failed:`, r.reason);
  }
  return activitiesOf({
    posts: posts.status === 'fulfilled' ? posts.value.posts.map((p) => ({ title: p.data.title, href: postUrl(p), publishedAt: p.data.pubDate, series: p.data.series })) : [],
    statuses: statuses.status === 'fulfilled' ? statuses.value : [],
    notes: notes.status === 'fulfilled' ? notes.value : [],
  });
}
