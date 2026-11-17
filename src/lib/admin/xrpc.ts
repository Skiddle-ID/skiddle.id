/**
 * Calls to Jeff's PDS through the admin app's signed-in session (DPoP-bound tokens, refreshed by
 * the OAuth client). Used by src/lib/admin/app.ts and src/lib/admin/editor.ts.
 */
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { DID } from '~/lib/standard-site.mjs';

export interface RepoRecord<T> {
  uri: string;
  cid: string;
  value: T;
}

/** A blob reference as it appears in a record */
export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export class XrpcError extends Error {
  constructor(
    readonly status: number,
    readonly error: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export async function xrpc<T>(session: OAuthSession, method: string, params?: Record<string, string>, body?: unknown): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const init: RequestInit | undefined =
    body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await session.fetchHandler(`/xrpc/${method}${query}`, init);
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new XrpcError(res.status, data.error, data.message || data.error || `${method} failed (${res.status})`);
  return data as T;
}

export async function getRecord<T>(session: OAuthSession, collection: string, rkey: string): Promise<RepoRecord<T> | null> {
  try {
    return await xrpc<RepoRecord<T>>(session, 'com.atproto.repo.getRecord', { repo: DID, collection, rkey });
  } catch (err) {
    if (err instanceof XrpcError && (err.error === 'RecordNotFound' || err.status === 404)) return null;
    throw err;
  }
}

export function putRecord(session: OAuthSession, collection: string, rkey: string, record: object, swapRecord?: string) {
  return xrpc<{ uri: string; cid: string }>(session, 'com.atproto.repo.putRecord', undefined, {
    repo: DID,
    collection,
    rkey,
    record,
    ...(swapRecord ? { swapRecord } : {}),
  });
}

/** A new record, under `rkey` (it fails if one is there already) or a key the PDS picks (a TID) */
export function createRecord(session: OAuthSession, collection: string, record: object, rkey?: string) {
  return xrpc<{ uri: string; cid: string }>(session, 'com.atproto.repo.createRecord', undefined, {
    repo: DID,
    collection,
    record,
    ...(rkey ? { rkey } : {}),
  });
}

export function deleteRecord(session: OAuthSession, collection: string, rkey: string, swapRecord?: string) {
  return xrpc<unknown>(session, 'com.atproto.repo.deleteRecord', undefined, {
    repo: DID,
    collection,
    rkey,
    ...(swapRecord ? { swapRecord } : {}),
  });
}

/** Every record in a collection */
export async function listRecords<T>(session: OAuthSession, collection: string): Promise<RepoRecord<T>[]> {
  const out: RepoRecord<T>[] = [];
  let cursor = '';
  do {
    const page = await xrpc<{ records: RepoRecord<T>[]; cursor?: string }>(session, 'com.atproto.repo.listRecords', {
      repo: DID,
      collection,
      limit: '100',
      ...(cursor ? { cursor } : {}),
    });
    out.push(...page.records);
    cursor = page.records.length ? (page.cursor ?? '') : '';
  } while (cursor);
  return out;
}

/** Uploads a file (an image) to the repo; a record must reference it, or the PDS drops it later */
export async function uploadBlob(session: OAuthSession, body: Blob): Promise<BlobRef> {
  const res = await session.fetchHandler('/xrpc/com.atproto.repo.uploadBlob', { method: 'POST', headers: { 'Content-Type': body.type }, body });
  const data = (await res.json().catch(() => ({}))) as { blob?: BlobRef; error?: string; message?: string };
  if (!res.ok || !data.blob) throw new XrpcError(res.status, data.error, data.message || data.error || `uploadBlob failed (${res.status})`);
  return data.blob;
}
