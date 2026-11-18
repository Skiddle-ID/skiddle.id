/**
 * What a series adds to its posts, from its `id.skiddle.series` record (src/lib/pds-posts.ts),
 * edited in the admin app's series editor.
 */

/** A part that's planned but not published yet: "coming" in the series box, /series/ and the home page */
export interface PlannedPart {
  order: number;
  title: string;
}

export interface SeriesInfo {
  /** What the series is about, shown on /series/ */
  description?: string;
  /**
   * Parts planned but not published yet. They count towards "part 1 of 6". A published post with
   * the same part number takes a planned part's place by itself.
   */
  planned?: PlannedPart[];
  /** No last part, like a weekly series: "new every week" instead of "part 3 of 3" */
  ongoing?: boolean;
  /** How often new parts come out, e.g. 'every week' */
  cadence?: string;
}
