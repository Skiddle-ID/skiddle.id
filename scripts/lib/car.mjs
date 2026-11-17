/**
 * Checks a CAR file, the format a PDS exports a repo in (com.atproto.sync.getRepo), for
 * scripts/backup.mjs. A CAR file is a header naming its root, then blocks, each stored with its CID,
 * which holds the block's SHA-256. Checking every block against its CID, and that the root is one
 * of them, catches a download that was cut short or changed. It doesn't read the records: that
 * would need a CBOR decoder, and a block that matches its hash is what was written.
 * https://ipld.io/specs/transport/car/carv1/
 */
import { createHash } from 'node:crypto';
import { cidString } from './blob.mjs';

/**
 * Reads an unsigned varint (LEB128) at `at`
 * @param {Uint8Array} bytes
 * @param {number} at
 * @returns {[value: number, next: number]}
 */
function varint(bytes, at) {
  let value = 0;
  let shift = 0;
  for (let i = at; i < bytes.length; i++) {
    value += (bytes[i] & 0x7f) * 2 ** shift;
    if (!(bytes[i] & 0x80)) return [value, i + 1];
    shift += 7;
    if (shift > 49) break;
  }
  throw new Error(`bad varint at byte ${at}`);
}

/**
 * Reads a binary CIDv1 at `at` (what AT Protocol uses): version, codec, then a multihash
 * @param {Uint8Array} bytes
 * @param {number} at
 */
function readCid(bytes, at) {
  let i = at;
  let version, code, length;
  [version, i] = varint(bytes, i);
  if (version !== 1) throw new Error(`CID version ${version} at byte ${at}, expected 1`);
  [, i] = varint(bytes, i); // codec
  [code, i] = varint(bytes, i);
  [length, i] = varint(bytes, i);
  if (code !== 0x12 || length !== 32) throw new Error(`hash 0x${code.toString(16)}/${length} at byte ${at}, expected SHA-256`);
  if (i + length > bytes.length) throw new Error(`CID at byte ${at} runs past the end`);
  return { cid: cidString(bytes.subarray(at, i + length)), digest: bytes.subarray(i, i + length), next: i + length };
}

/**
 * The root's CID from the header, which is DAG-CBOR: {"roots": [CID], "version": 1}. A CID in
 * DAG-CBOR is tag 42 (d8 2a) on a byte string (58 25: 37 bytes) that starts with a 0 byte.
 * @param {Uint8Array} header
 */
function rootOf(header) {
  for (let i = 0; i + 5 + 36 <= header.length; i++) {
    if (header[i] === 0xd8 && header[i + 1] === 0x2a && header[i + 2] === 0x58 && header[i + 3] === 0x25 && header[i + 4] === 0x00) {
      return readCid(header, i + 5).cid;
    }
  }
  throw new Error('the header names no root');
}

/**
 * Checks every block against its CID and that the root is one of the blocks
 * @param {Uint8Array} bytes
 * @returns {{ root: string, blocks: number }}
 */
export function checkCar(bytes) {
  if (!bytes.length) throw new Error('the CAR file is empty');
  const [headerLength, start] = varint(bytes, 0);
  if (start + headerLength > bytes.length) throw new Error('the header runs past the end');
  const root = rootOf(bytes.subarray(start, start + headerLength));
  let at = start + headerLength;
  let blocks = 0;
  let hasRoot = false;
  while (at < bytes.length) {
    const [length, next] = varint(bytes, at);
    const end = next + length;
    if (end > bytes.length) throw new Error(`block ${blocks + 1} runs past the end: the file is cut short`);
    const { cid, digest, next: data } = readCid(bytes, next);
    const actual = createHash('sha256').update(bytes.subarray(data, end)).digest();
    if (!actual.equals(digest)) throw new Error(`block ${cid} doesn't match its hash`);
    if (cid === root) hasRoot = true;
    blocks++;
    at = end;
  }
  if (!hasRoot) throw new Error(`the root ${root} isn't in the file`);
  return { root, blocks };
}
