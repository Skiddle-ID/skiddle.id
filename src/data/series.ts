/**
 * Series details that don't live in the posts themselves. Keys are series names, exactly as in the
 * posts' `series:` frontmatter.
 *
 * - `planned`: parts that are planned but not published yet. They show as "coming" (not links) in a
 *   post's series box, on the home page and on /series/, and count towards "part 1 of 6". When a
 *   post with the same `series` and `order` is published, it takes the planned part's place by
 *   itself, so finished entries can be removed whenever it's convenient.
 * - `ongoing`: a series with no last part, like a weekly one. It shows "new every week" and a
 *   blinking cursor instead of "part 3 of 3" and a full progress bar, and its newest part ends with
 *   a "coming soon" card.
 * - `cadence`: how often new parts come out, e.g. 'every week' ("new every week").
 */
export interface PlannedPart {
  order: number;
  title: string;
}

export interface SeriesInfo {
  /** What the series is about, shown on /series/ (from its record; the admin app's series editor) */
  description?: string;
  planned?: PlannedPart[];
  ongoing?: boolean;
  cadence?: string;
}

export const seriesInfo: Record<string, SeriesInfo> = {
  'From Fear to Flight': {
    planned: [
      { order: 2, title: 'Ground School' },
      { order: 3, title: 'First Flights' },
      { order: 4, title: 'First Solo' },
      { order: 5, title: 'Planning Real Flights' },
      { order: 6, title: 'The Checkride' },
    ],
  },
  // Weekly notes on what's going on at Skiddle Labs
  'Lab Notes': { ongoing: true, cadence: 'every week' },
};
