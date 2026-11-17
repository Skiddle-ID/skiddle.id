import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { blobCid, cidString } from './blob.mjs';
import { checkCar } from './car.mjs';

/** A varint (LEB128) */
const varint = (/** @type {number} */ n) => {
  const out = [];
  do {
    out.push((n & 0x7f) | (n > 0x7f ? 0x80 : 0));
    n >>>= 7;
  } while (n);
  return Buffer.from(out);
};

/** A binary CIDv1 for a DAG-CBOR block */
const cidOf = (/** @type {Buffer} */ data) => Buffer.concat([Buffer.from([0x01, 0x71, 0x12, 0x20]), createHash('sha256').update(data).digest()]);

/** A CAR file with these blocks, whose header names `root` (default: the first block) */
function car(/** @type {Buffer[]} */ blocks, root = cidOf(blocks[0])) {
  // {"roots": [CID], "version": 1}
  const header = Buffer.concat([
    Buffer.from([0xa2, 0x65]), Buffer.from('roots'), Buffer.from([0x81, 0xd8, 0x2a, 0x58, 0x25, 0x00]), root,
    Buffer.from([0x67]), Buffer.from('version'), Buffer.from([0x01]),
  ]);
  const sections = blocks.map((data) => {
    const section = Buffer.concat([cidOf(data), data]);
    return Buffer.concat([varint(section.length), section]);
  });
  return Buffer.concat([varint(header.length), header, ...sections]);
}

const commit = Buffer.from('a commit');
const record = Buffer.alloc(300, 7); // over 127 bytes, so its length takes a two-byte varint

test('a good CAR file: its root and block count', () => {
  assert.deepEqual(checkCar(car([commit, record])), { root: cidString(cidOf(commit)), blocks: 2 });
});

test('a block that doesn’t match its hash', () => {
  const bytes = car([commit, record]);
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => checkCar(bytes), /doesn't match its hash/);
});

test('a file cut short', () => {
  const bytes = car([commit, record]);
  assert.throws(() => checkCar(bytes.subarray(0, bytes.length - 10)), /cut short/);
});

test('a root that isn’t in the file', () => {
  assert.throws(() => checkCar(car([record], cidOf(commit))), /isn't in the file/);
});

test('an empty file', () => {
  assert.throws(() => checkCar(new Uint8Array()), /empty/);
});

test('blobCid still gives the CID a PDS gives an image', () => {
  // The empty file's SHA-256, as a raw CIDv1
  assert.equal(blobCid(new Uint8Array()), 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku');
});
