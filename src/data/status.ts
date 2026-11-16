/**
 * The status badge at /status.svg: "● open to consulting · Bangkok 14:32". Change `label` (and
 * `available`) when it changes, e.g. `available: false, label: 'booked until March'`.
 */
export interface Status {
  /** Green dot when true, grey when false */
  available: boolean;
  /** What the badge says after the dot */
  label: string;
  /** Where you are, shown before the local time */
  city: string;
  /** IANA time zone for the local time */
  timeZone: string;
}

export const status: Status = {
  available: true,
  label: 'open to consulting',
  city: 'Bangkok',
  timeZone: 'Asia/Bangkok',
};
