/**
 * avatarCache — the single source of truth for profile picture URLs.
 *
 * Why this exists: resolving `profilePictures/{uid}.png` through
 * getDownloadURL() is a network round-trip, and the app used to do it
 * from ~30 files behind six different hand-rolled caches plus a dozen polling
 * timers. This module replaces all of that.
 *
 * How it works:
 *  1. Preferred path — `photoURL` is written onto the user's Firestore doc at
 *     upload time (see components/photoInput.js). Screens already read those
 *     docs, so calling primeFromUser() costs zero extra requests.
 *  2. Fallback — for users who predate that field, resolve once via Storage and
 *     persist the result. No migration needed.
 *
 * Freshness: a Storage download URL for a fixed path is stable across
 * re-uploads, so the URL alone can't signal "the photo changed". `photoUpdatedAt`
 * is the version token — it changes on upload, which changes the cache key and
 * forces exactly one refetch. That is what lets us poll never.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";
import {
  deleteField,
  doc,
  getFirestore,
  updateDoc,
} from "@react-native-firebase/firestore";

const STORAGE_PREFIX = "avatar_v1_";
// URLs are long-lived; `photoUpdatedAt` (not time) is what invalidates them.
const TTL = 30 * 24 * 60 * 60 * 1000;

// uid -> { url: string|null, version: string|null, ts: number }
const mem = new Map();
// uid -> Promise, so N simultaneous rows for one person share one request.
const inflight = new Map();
const subscribers = new Set();
let hydrated = false;

const keyFor = (uid) => `${STORAGE_PREFIX}${uid}`;

/**
 * Locally-minted ids for people who have no users/{uid} document:
 * `unreg_*` (unregistered drivers) and `manual_*` (manually added servants).
 *
 * Note this is NOT the same as "has no Storage object" — a manual_ servant does
 * have one (PhotoInput uploads under the temp id), which is why resolve() below
 * still only skips unreg_.
 */
const isSyntheticId = (uid) =>
  typeof uid === "string" &&
  (uid.startsWith("unreg_") || uid.startsWith("manual_"));

const versionOf = (user) => {
  const v = user?.photoUpdatedAt;
  if (!v) return null;
  // Firestore Timestamp | Date | number | string
  if (typeof v?.toMillis === "function") return String(v.toMillis());
  if (v instanceof Date) return String(v.getTime());
  return String(v);
};

/**
 * Self-coalescing: many notifies in one tick collapse into a single flush.
 *
 * Why this matters more than it looks. Every mounted <Avatar> subscribes here via
 * useSyncExternalStore, and each one calls resolve() on mount when it has no
 * cached url. Scrolling a long roster therefore lands hundreds of independent
 * getDownloadURL() resolutions, and an eager notify() per resolution means
 * hundreds of separate sweeps over every subscriber, each forcing a re-render —
 * interleaved with the scroll events RN is trying to deliver. That queue
 * starvation is exactly what VirtualizedList's "slow to update" warning measures
 * (its `dt` is the gap between consecutive scroll events, not a render duration).
 *
 * Batching here means no caller can storm the JS queue, however eagerly it writes.
 */
let notifyScheduled = false;

function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    subscribers.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("[avatarCache] subscriber error:", e);
      }
    });
  });
}

/** Subscribe to cache changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function persist(uid, entry) {
  AsyncStorage.setItem(keyFor(uid), JSON.stringify(entry)).catch(() => {});
}

/**
 * Load previously persisted entries into memory. Called once at startup so the
 * first render after a cold start can paint cached avatars immediately.
 */
export async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith(STORAGE_PREFIX)
    );
    if (!keys.length) return;
    const pairs = await AsyncStorage.multiGet(keys);
    const now = Date.now();
    const expired = [];
    pairs.forEach(([k, raw]) => {
      if (!raw) return;
      try {
        const entry = JSON.parse(raw);
        if (now - (entry.ts || 0) > TTL) {
          expired.push(k);
          return;
        }
        mem.set(k.slice(STORAGE_PREFIX.length), entry);
      } catch {
        expired.push(k);
      }
    });
    if (expired.length) AsyncStorage.multiRemove(expired).catch(() => {});
    if (mem.size) notify();
  } catch (e) {
    console.error("[avatarCache] hydrate failed:", e);
  }
}

/**
 * Feed a user/child object that was already fetched for other reasons.
 * This is the zero-cost path — prefer it wherever user docs are available.
 */
export function primeFromUser(user) {
  const uid = user?.uid || user?.id;
  if (!uid) return;

  const version = versionOf(user);
  const url = typeof user.photoURL === "string" && user.photoURL.trim()
    ? user.photoURL
    : null;
  if (!url) return;

  const prev = mem.get(uid);
  if (prev && prev.url === url && prev.version === version) return;

  const entry = { url, version, ts: Date.now() };
  mem.set(uid, entry);
  persist(uid, entry);
  notify();
}

/**
 * Batched bulk prime. Prefer this over looping primeFromUser().
 *
 * Doing it one user at a time meant one AsyncStorage.setItem (its own
 * JSON.stringify and bridge crossing) plus one notify() sweep *per user* — for a
 * few hundred rows that is hundreds of bridge calls fired synchronously from
 * inside a Firestore snapshot handler. Here it is a single multiSet and, because
 * notify() coalesces, a single subscriber flush.
 *
 * The writes are deliberately kept: hydrate() (called from App.js) reads them
 * back so avatars paint instantly on a cold start.
 */
export function primeMany(users) {
  const pairs = [];

  for (const user of users || []) {
    const uid = user?.uid || user?.id;
    if (!uid) continue;

    const url =
      typeof user.photoURL === "string" && user.photoURL.trim()
        ? user.photoURL
        : null;
    if (!url) continue;

    const version = versionOf(user);
    const prev = mem.get(uid);
    if (prev && prev.url === url && prev.version === version) continue;

    const entry = { url, version, ts: Date.now() };
    mem.set(uid, entry);
    pairs.push([keyFor(uid), JSON.stringify(entry)]);
  }

  if (!pairs.length) return;
  AsyncStorage.multiSet(pairs).catch(() => {});
  notify();
}

/** Synchronous read. Returns a URL string, or null if unknown/absent. */
export function peek(uid) {
  if (!uid) return null;
  return mem.get(uid)?.url ?? null;
}

/**
 * Resolve a uid's avatar URL, hitting the network only when necessary.
 * Concurrent calls for the same uid share one request.
 */
export function resolve(uid) {
  if (!uid || typeof uid !== "string") return Promise.resolve(null);
  // Only `unreg_` is skipped here, deliberately — not isSyntheticId(). Both
  // prefixes lack a users/{uid} doc, but `manual_*` people DO get a real
  // Storage upload (see ServantsAttendance), so they must still be resolved.
  if (uid.startsWith("unreg_")) return Promise.resolve(null);

  const cached = mem.get(uid);
  if (cached) return Promise.resolve(cached.url);

  const existing = inflight.get(uid);
  if (existing) return existing;

  const p = getDownloadURL(ref(getStorage(), `profilePictures/${uid}.png`))
    .then((url) => {
      const clean = typeof url === "string" && url.trim() ? url : null;
      const entry = { url: clean, version: null, ts: Date.now() };
      mem.set(uid, entry);
      persist(uid, entry);
      notify();
      return clean;
    })
    .catch(() => {
      // Cache the miss too — otherwise every snapshot refetches users who
      // simply have no photo, which was a major source of request churn.
      const entry = { url: null, version: null, ts: Date.now() };
      mem.set(uid, entry);
      persist(uid, entry);
      return null;
    })
    .finally(() => {
      inflight.delete(uid);
    });

  inflight.set(uid, p);
  return p;
}

/** Resolve many uids, deduped. Safe to call with a list containing repeats. */
export function resolveMany(uids) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  return Promise.all(unique.map(resolve));
}

/** Drop a uid so the next read refetches. Call after upload/removal. */
export async function invalidate(uid) {
  if (!uid) return;
  mem.delete(uid);
  inflight.delete(uid);
  try {
    await AsyncStorage.removeItem(keyFor(uid));
  } catch {}
  notify();
}

/** Record a freshly uploaded URL so the new photo shows without a refetch. */
export function set(uid, url, version = String(Date.now())) {
  if (!uid) return;
  const entry = {
    url: typeof url === "string" && url.trim() ? url : null,
    version,
    ts: Date.now(),
  };
  mem.set(uid, entry);
  persist(uid, entry);
  notify();
}

/**
 * Remove a profile picture everywhere: the Storage object, the `photoURL`
 * pointer on the user doc, and the local cache.
 *
 * Clearing the doc fields matters — otherwise the next users/{uid} snapshot
 * re-primes the cache with a URL whose object no longer exists, producing a
 * guaranteed-failing image request on every render of that person.
 */
export async function removePhoto(uid) {
  if (!uid) return;

  try {
    await deleteObject(ref(getStorage(), `profilePictures/${uid}.png`));
  } catch (e) {
    // Already gone is success as far as callers are concerned.
    if (e?.code !== "storage/object-not-found") throw e;
  }

  // Synthetic ids never have a users/{uid} doc, so skip the round-trip
  // entirely. Children can't be detected this way — their ids look like real
  // uids — so the try/catch below stays the general guard.
  if (!isSyntheticId(uid)) {
    try {
      await updateDoc(doc(getFirestore(), "users", uid), {
        photoURL: deleteField(),
        photoUpdatedAt: deleteField(),
      });
    } catch (e) {
      // Children / manually-created people have no top-level user doc.
      console.log("[avatarCache] photoURL not cleared on users doc:", e?.message);
    }
  }

  await invalidate(uid);
}

/** Cache-busted URI for <Image>. Version token keeps re-uploads visible. */
export function uriFor(uid) {
  const entry = mem.get(uid);
  if (!entry?.url) return null;
  if (!entry.version) return entry.url;
  return `${entry.url}${entry.url.includes("?") ? "&" : "?"}v=${entry.version}`;
}

export async function clearAll() {
  mem.clear();
  inflight.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith(STORAGE_PREFIX)
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {}
  notify();
}
