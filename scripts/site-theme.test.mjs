import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { siteThemeOf } from '../src/lib/site-theme.mjs';

describe('site theme', () => {
  it('takes the mode and accent the record asks for, field by field', () => {
    assert.deepEqual(siteThemeOf({ mode: 'light', accent: 'purple' }), { mode: 'light', accent: 'purple' });
    assert.deepEqual(siteThemeOf({ mode: 'sepia', accent: 'green' }), { mode: 'device', accent: 'green' });
    assert.deepEqual(siteThemeOf({ cardDesign: 'logo' }), { mode: 'device', accent: 'blue' });
    assert.deepEqual(siteThemeOf(null), { mode: 'device', accent: 'blue' });
  });
});
