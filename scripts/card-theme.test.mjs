import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_DESIGNS, cardDesignOf, cardLogoCid } from '../src/lib/card-theme.mjs';

describe('card theme', () => {
  it('takes the design the record asks for, else the terminal one', () => {
    assert.equal(cardDesignOf({ cardDesign: 'logo' }), 'logo');
    assert.equal(cardDesignOf({ cardDesign: 'neon' }), 'terminal');
    assert.equal(cardDesignOf(null), 'terminal');
    assert.deepEqual(CARD_DESIGNS.map((d) => d.id), ['terminal', 'terminal-light', 'logo']);
  });

  it('takes the publication’s logo when a card can draw it', () => {
    const icon = (mimeType) => ({ icon: { $type: 'blob', ref: { $link: 'bafkreilogo' }, mimeType, size: 10 } });
    assert.equal(cardLogoCid(icon('image/png')), 'bafkreilogo');
    assert.equal(cardLogoCid(icon('image/jpeg')), 'bafkreilogo');
    assert.equal(cardLogoCid(icon('image/webp')), undefined);
    assert.equal(cardLogoCid({ name: 'Skiddle' }), undefined);
    assert.equal(cardLogoCid(null), undefined);
  });
});
