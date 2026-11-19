// JSON for the pages' JSON-LD blocks (src/lib/script-json.mjs).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scriptJson } from '../src/lib/script-json.mjs';

describe('scriptJson', () => {
  it('has no "<", so the text can’t end the script block', () => {
    const out = scriptJson({ headline: 'Why I stopped writing </script><img src=x>', about: '<!-- hi -->' });
    assert.equal(out.includes('<'), false);
  });
  it('is the same data', () => {
    const value = { '@type': 'BlogPosting', headline: 'a < b </script>', keywords: 'flying, atproto', n: 3 };
    assert.deepEqual(JSON.parse(scriptJson(value)), value);
  });
  it('leaves everything else as JSON.stringify writes it', () => {
    const value = { name: 'Laurensius Jeffrey', url: 'https://skiddle.id/posts/?a=1&b=2', text: 'Ꝁ 漢字 ✈️ "quoted"' };
    assert.equal(scriptJson(value), JSON.stringify(value));
  });
});
