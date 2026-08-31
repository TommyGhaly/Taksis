/**
 * useServeDates — watch a set of servants for their last/next serve dates.
 *
 * Both the admin schedule editor and the main container showed a "last served
 * on / next serving on" line under each servant, and both built it by opening
 * one `onSnapshot` per servant. A full week is around eighteen people, so that
 * was eighteen live listeners each firing its own `setState` — the stall when
 * opening a week with a full roster.
 *
 * This uses the chunked watcher instead: `where(documentId(), "in", [...])`
 * covers 30 ids per listener, so a normal week costs one.
 *
 * Two things the per-document version got for free and this has to do by hand:
 *
 *   1. A chunk snapshot only contains documents that *exist*. The old code
 *      relied on `doc.exists` being false to clear a servant's entry, so the
 *      requested ids are diffed against what arrived to find the misses. Child
 *      profiles have no user document, so this is the common case.
 *   2. Chunks arrive independently. Updates are accumulated and flushed once a
 *      tick, or a multi-chunk roster would re-render once per chunk.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import * as avatarCache from "../utils/avatarCache";
import { watchDocsByIds } from "../utils/firestoreBatch";

export default function useServeDates() {
  const [lastServeData, setLastServeData] = useState({});
  const [nextServeData, setNextServeData] = useState({});

  // Live snapshot of every watched uid, so a flush can rebuild both maps
  // without reading React state.
  const entriesRef = useRef(new Map());
  const unsubRef = useRef(null);
  const flushRef = useRef(null);

  const flush = useCallback(() => {
    flushRef.current = null;
    const last = {};
    const next = {};
    entriesRef.current.forEach((data, uid) => {
      if (!data) return;
      if (data.lastServe) last[uid] = data.lastServe;
      if (data.nextWeekServe) next[uid] = data.nextWeekServe;
    });
    setLastServeData(last);
    setNextServeData(next);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushRef.current) return;
    flushRef.current = setTimeout(flush, 0);
  }, [flush]);

  const stopWatching = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (flushRef.current) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
    entriesRef.current = new Map();
    setLastServeData({});
    setNextServeData({});
  }, []);

  const watchServers = useCallback(
    (servers) => {
      stopWatching();

      const uids = (servers || []).map((s) => s?.uid).filter(Boolean);
      if (uids.length === 0) return;

      // Whatever the schedule document already carries is free to prime.
      avatarCache.primeMany(servers);

      unsubRef.current = watchDocsByIds("users", uids, {
        onDocs: (docs, chunk) => {
          const seen = new Set();
          docs.forEach((data) => {
            seen.add(data.uid);
            entriesRef.current.set(data.uid, data);
            // This document is already being read for serve dates, so priming
            // the avatar from it costs nothing extra.
            avatarCache.primeFromUser(data);
          });
          // Requested but absent: no user document, or it was just deleted.
          chunk.forEach((uid) => {
            if (!seen.has(uid)) entriesRef.current.set(uid, null);
          });
          scheduleFlush();
        },
      });
    },
    [scheduleFlush, stopWatching]
  );

  useEffect(() => stopWatching, [stopWatching]);

  return { lastServeData, nextServeData, watchServers, stopWatching };
}
