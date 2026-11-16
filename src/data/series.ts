/**
 * Parts of a series that are planned but not published yet. They show as "coming" (not links) in
 * a post's series box, on the home page and on /series/, and count towards "part 1 of 6".
 *
 * Keys are series names, exactly as in the posts' `series:` frontmatter. When a post with the same
 * `series` and `order` is published, it takes the planned part's place by itself, so finished
 * entries can be removed here whenever it's convenient. Rename, reorder or drop a part by editing
 * its line.
 */
export interface PlannedPart {
  order: number;
  title: string;
}

export const plannedParts: Record<string, PlannedPart[]> = {
  'From Fear to Flight': [
    { order: 2, title: 'Ground School' },
    { order: 3, title: 'First Flights' },
    { order: 4, title: 'First Solo' },
    { order: 5, title: 'Planning Real Flights' },
    { order: 6, title: 'The Checkride' },
  ],
};
