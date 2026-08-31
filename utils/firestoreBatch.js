/**
 * firestoreBatch — read or watch many documents by id without one request each.
 *
 * The pattern this replaces shows up in several places: `uids.map(uid =>
 * collection.doc(uid).get())` inside a `Promise.all`, or worse, one `onSnapshot`
 * per record. `DeaconEdits` was opening a listener per deacon — 60 listeners on a
 * mid-sized church, each firing its own `setState`.
 *
 * `where(documentId(), "in", [...])` fetches up to ID_CHUNK_SIZE documents per
 * request, so the cost becomes ceil(n / 30) instead of n.
 */
import firestore from "@react-native-firebase/firestore";

/**
 * Firestore's cap on values in an `in` filter. This was 10 for years and was
 * raised to 30; @react-native-firebase v21 wraps SDKs well past that change.
 *
 * If an `in` query ever starts failing with `invalid-argument`, drop this to 10 —
 * it is deliberately the single place the chunk size is defined, so that is a
 * one-line revert and every caller follows.
 */
export const ID_CHUNK_SIZE = 30;

/** Dedupe, drop falsy ids, and split into `in`-sized chunks. */
export function chunkIds(ids, size = ID_CHUNK_SIZE) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

/**
 * One-shot read. Resolves to `Map<id, data|null>`.
 *
 * Misses are present as `null` rather than absent, so callers can cache the
 * negative result and avoid re-requesting an id that does not exist (child
 * profiles have no user doc of their own, so this is the common case, not an edge
 * case).
 *
 * A failed chunk is logged and skipped rather than rejecting the whole read —
 * matching the per-id `catch` the call sites already had. Partial data beats an
 * empty screen here.
 */
export async function getDocsByIds(collectionName, ids, { chunkSize = ID_CHUNK_SIZE } = {}) {
  const result = new Map();
  const chunks = chunkIds(ids, chunkSize);
  if (chunks.length === 0) return result;

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      firestore()
        .collection(collectionName)
        .where(firestore.FieldPath.documentId(), "in", chunk)
        .get()
        .catch((err) => {
          console.error(`getDocsByIds(${collectionName}) chunk failed:`, err);
          return null;
        })
    )
  );

  snapshots.forEach((snap) => {
    snap?.docs.forEach((doc) => result.set(doc.id, { uid: doc.id, ...doc.data() }));
  });

  // Record the misses so callers don't retry them on every subsequent pass.
  chunks.flat().forEach((id) => {
    if (!result.has(id)) result.set(id, null);
  });

  return result;
}

/**
 * Live version: one `onSnapshot` per chunk instead of one per id.
 *
 * `onDocs(docsForThisChunk, idsInThisChunk)` receives only the chunk that
 * changed — merge on the caller's side, and put that merge behind a coalesced
 * flush, or several chunks delivering in the same tick will cause one render
 * each.
 *
 * The second argument is the ids that were *requested* for that chunk. A
 * snapshot only contains documents that exist, so without it a caller cannot
 * tell "this id is in another chunk" from "this id has no document" — and a
 * user doc that is deleted while being watched would never be cleared. Diff
 * the delivered docs against it to find the misses. (`getDocsByIds` solves the
 * same problem by reporting misses as explicit nulls.)
 *
 * `onChunkSettled(index)` fires on **both** success and error. That matters: a
 * "hold the skeleton until every source has reported" tally hangs forever if an
 * erroring source never reports. Same contract as the `finally` in
 * screens/SundaySchool/SundaySchoolAttendance.js.
 *
 * Returns a single unsubscribe that tears down every chunk listener.
 */
export function watchDocsByIds(
  collectionName,
  ids,
  { onDocs, onChunkSettled, onError } = {},
  { chunkSize = ID_CHUNK_SIZE } = {}
) {
  const chunks = chunkIds(ids, chunkSize);
  if (chunks.length === 0) return () => {};

  const unsubs = chunks.map((chunk, index) =>
    firestore()
      .collection(collectionName)
      .where(firestore.FieldPath.documentId(), "in", chunk)
      .onSnapshot(
        (snapshot) => {
          try {
            onDocs?.(
              snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })),
              chunk
            );
          } finally {
            onChunkSettled?.(index);
          }
        },
        (err) => {
          console.error(`watchDocsByIds(${collectionName}) chunk failed:`, err);
          try {
            onError?.(err, index);
          } finally {
            onChunkSettled?.(index);
          }
        }
      )
  );

  return () => unsubs.forEach((u) => u());
}

/** How many chunks a given id list will produce — for sizing a report tally. */
export function chunkCount(ids, size = ID_CHUNK_SIZE) {
  return chunkIds(ids, size).length;
}
