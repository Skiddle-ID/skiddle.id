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
  /** The record's key, e.g. from-fear-to-flight: the series' page is /series/<key>/. It stays when the series is renamed */
  key?: string;
  /** What the series is about, shown on /series/ */
  description?: string;
  /** Its share card, drawn by the admin app and stored in the record (served from /media/<cid>) */
  coverImage?: { cid: string; mimeType: string };
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
