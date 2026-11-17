/**
 * The built-in status: what the site shows when the id.skiddle.status record in Jeff's AT Protocol
 * repo can't be read (src/lib/at-status.ts). The live status is set in the admin app (/admin/) or
 * with `npm run status`.
 */
import type { StatusState } from '~/lib/status-states.mjs';

export interface Status {
  /** What kind of status, which sets the dot's colour (src/lib/status-states.mjs) */
  state: StatusState;
  /** What the badge says after the dot */
  label: string;
  /** Where you are, shown before the local time */
  city: string;
  /** IANA time zone for the local time */
  timeZone: string;
}

export const status: Status = {
  state: 'available',
  label: 'open to consulting',
  city: 'Bangkok',
  timeZone: 'Asia/Bangkok',
};
