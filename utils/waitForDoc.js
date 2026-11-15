import { onSnapshot } from "@react-native-firebase/firestore";

/**
 * Resolves once the document at `ref` satisfies `test`, i.e. once the screen's
 * own listener on that document has (or is about to have) the change.
 *
 * Used to hold a loading spinner until a Cloud Run write is actually on screen,
 * not just acknowledged over HTTP. The first snapshot comes from the local
 * cache, so if the write already arrived before the caller got here, this
 * resolves right away.
 *
 * Never rejects and always settles: `true` when the condition was met, `false`
 * on timeout or listener error, so a spinner can't stay up forever.
 *
 * @param ref       a DocumentReference
 * @param test      (data | null) => boolean; data is null when the doc is missing
 * @param timeoutMs how long to wait before giving up
 */
export const waitForDoc = (ref, test, timeoutMs = 10000) =>
  new Promise((resolve) => {
    let done = false;
    let unsubscribe = null;
    const finish = (matched) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
      resolve(matched);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    unsubscribe = onSnapshot(
      ref,
      (snap) => {
        let matched = false;
        try {
          matched = !!test(snap?.exists ? snap.data() : null);
        } catch {
          matched = false;
        }
        if (matched) finish(true);
      },
      () => finish(false),
    );
    // In case the first snapshot was delivered synchronously and already
    // finished before `unsubscribe` was assigned.
    if (done) unsubscribe();
  });

/** True when any reader slot or array entry (altar, extra, …) holds `uid`. */
export const scheduleHasUid = (data, uid) =>
  !!data &&
  Object.values(data).some((value) =>
    Array.isArray(value)
      ? value.some((entry) => entry?.uid === uid)
      : value?.uid === uid,
  );

export default waitForDoc;
