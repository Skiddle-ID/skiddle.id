// Text fitting for the SVG cards (src/lib/embed-card.ts): how many monospace columns text takes,
// and how it's shortened and wrapped to fit.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fit, fitMiddle, textColumns, wrap } from '../src/lib/embed-card.ts';

const cp = (...points) => String.fromCodePoint(...points);

describe('textColumns', () => {
  it('Latin is one column a character', () => {
    assert.equal(textColumns('Lab Notes #2'), 12);
  });
  it('CJK, Hangul and emoji are two', () => {
    assert.equal(textColumns('漢字'), 4);
    assert.equal(textColumns('한국'), 4);
    assert.equal(textColumns('✈️'), 2);
  });
  it('CJK compatibility ideographs (U+F900–U+FAFF) are two', () => {
    assert.equal(textColumns(cp(0xf900)), 2);
    assert.equal(textColumns(cp(0xfaff)), 2);
  });
  // Code scanning alert #3: the range once started at U+8C48 instead of U+F900
  it('scripts between U+A4D0 and U+F8FF aren’t counted as wide', () => {
    const narrow = [
      0xa4d0, // Lisu
      0xa740, // Latin Extended-D
      0xa9b2, // Javanese
      0xab70, // Cherokee Supplement
      0xab30, // Latin Extended-E
      0xe000, // private use
      0xf8ff, // private use
    ];
    for (const p of narrow) assert.equal(textColumns(cp(p)), 1, `U+${p.toString(16).toUpperCase()}`);
  });
  it('Thai and other proportional scripts are 1.2', () => {
    assert.ok(Math.abs(textColumns('ไทย') - 3.6) < 1e-9);
  });
});

describe('fit', () => {
  it('leaves text that fits alone', () => {
    const javanese = cp(0xa9b2, 0xa9b2, 0xa9b2, 0xa9b2, 0xa9b2);
    assert.equal(fit(javanese, 5), javanese);
  });
  it('shortens text that doesn’t, ending with an ellipsis', () => {
    assert.equal(fit('Rebuilding skiddle.id', 10), 'Rebuildin…');
    assert.equal(fit('漢字漢字漢字', 6), '漢字…');
  });
});

describe('wrap', () => {
  it('breaks at spaces', () => {
    assert.deepEqual(wrap('My agents work while I sleep', 12, 3), ['My agents', 'work while I', 'sleep']);
  });
  it('breaks at each newline', () => {
    assert.deepEqual(wrap('Lab Notes #3\nskiddle.id/posts', 40, 2), ['Lab Notes #3', 'skiddle.id/posts']);
  });
  it('breaks inside a word that has no spaces, as in CJK', () => {
    assert.deepEqual(wrap('漢字漢字漢字漢字', 8, 2), ['漢字漢字', '漢字漢字']);
  });
  it('ends with an ellipsis when the text needs more lines', () => {
    assert.deepEqual(wrap('one two three four five six', 9, 2), ['one two', 'three fo…']);
    assert.deepEqual(wrap('first\nsecond\nthird', 20, 2), ['first', 'second third']);
    assert.deepEqual(wrap('first\nsecond\nthird and more', 15, 2), ['first', 'second third a…']);
  });
});

describe('fitMiddle', () => {
  it('leaves text that fits alone', () => {
    assert.equal(fitMiddle('Just Dream', 10), 'Just Dream');
  });
  it('cuts the middle, so the start and the end both show', () => {
    assert.equal(fitMiddle('abcdefghijklmnop', 7), 'abc…nop');
    assert.equal(fitMiddle('Jumping Machine (跳楼机) (伴奏)', 20), 'Jumping Ma…) (伴奏)');
  });
  it('never goes over the room it has', () => {
    for (const text of ['Jumping Machine (跳楼机) (伴奏)', 'ภูมิ วิภูริศ ศิริทิพย์', 'a'.repeat(50)]) {
      for (let max = 3; max < 30; max++) assert.ok(textColumns(fitMiddle(text, max)) <= max, `${text} @ ${max}`);
    }
  });
});
