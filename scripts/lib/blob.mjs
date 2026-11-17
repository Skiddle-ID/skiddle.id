/**
 * Images as AT Protocol blobs, for the scripts that write records (scripts/standard-site-sync.mjs),
 * check them (scripts/check-lexicons.mjs) and back them up (scripts/backup.mjs). Node only.
 */
import { createHash } from 'node:crypto';

/** MIME types of the images a post may show, by file extension */
export const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

/** The image's MIME type from its file name, or undefined */
export const imageType = (/** @type {string} */ path) => IMAGE_TYPES[path.split('.').pop()?.toLowerCase() ?? ''];

/**
 * The CID a PDS gives a blob: CIDv1, raw codec, SHA-256, in base32. Lets a script tell whether an
 * image is already uploaded without uploading it again.
 * @param {Uint8Array} bytes
 */
export function blobCid(bytes) {
  return cidString(Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), createHash('sha256').update(bytes).digest()]));
}

/**
 * A binary CID as text: base32, with the "b" multibase prefix
 * @param {Uint8Array} raw
 */
export function cidString(raw) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let out = 'b';
  for (const byte of raw) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

/**
 * A blob reference for an image, as it appears in a record ({ $type: 'blob', ref, mimeType, size })
 * @param {Uint8Array} bytes
 * @param {string} mimeType
 */
export const blobRef = (bytes, mimeType) => ({ $type: 'blob', ref: { $link: blobCid(bytes) }, mimeType, size: bytes.length });
