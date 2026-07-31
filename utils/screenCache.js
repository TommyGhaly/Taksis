/**
 * screenCache — the AsyncStorage read-through cache the roster and attendance
 * screens use to paint from disk before Firestore answers.
 *
 * This replaces six hand-copied `const CacheUtils = {...}` blocks. Copy-paste is
 * why only two of the six ever received the deferred-write fix below: the four
 * admin-side copies were still doing
 *
 *     await AsyncStorage.setItem(key, JSON.stringify(fullList))
 *
 * from *inside* a Firestore snapshot handler. `JSON.stringify` over a few hundred
 * user records is real synchronous work on the JS thread, and on AdminManager the
 * handler runs on every write to any user document — so the list hitched every time
 * anything anywhere changed. Nothing ever awaited the result for anything; the
 * `await` only served to put the stringify on the critical path.
 *
 * Usage — each screen makes its own instance at module scope:
 *
 *   const cache = makeScreenCache();                       // 72h, the common case
 *   const cache = makeScreenCache({ ttlMs: 24 * HOUR });   // explicit override
 *
 *   const cached = await cache.get(key);   // null when missing or stale
 *   cache.set(key, data);                  // fire-and-forget, do NOT await
 *   await cache.remove(key);               // awaitable; callers sequence on it
 *
 * Note the deliberate asymmetry: `get` and `remove` are async because callers
 * genuinely sequence on them (a screen waits for the cached paint, and the
 * pull-to-refresh paths clear a key before re-reading). `set` is not, because no
 * caller has ever needed to know when the write landed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { InteractionManager } from "react-native";

export const HOUR = 60 * 60 * 1000;

/**
 * The TTL every screen used except one. It is a factory parameter rather than a
 * module constant specifically because `screens/Alhan/AlhanAttendance.js` uses 24h,
 * and collapsing that to a single shared value would silently change its behavior.
 *
 * (Two of the 72h copies carried a `// Check if cache is still valid (24 hours)`
 * comment above a 72h expression. The comment was wrong, not the code.)
 */
export const DEFAULT_TTL_MS = 72 * HOUR;

export function makeScreenCache({ ttlMs = DEFAULT_TTL_MS } = {}) {
  return {
    /** Returns the cached value, or null if absent, stale, or unreadable. */
    async get(key) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < ttlMs) return parsed.data;
        }
      } catch (error) {
        // A corrupt or truncated entry is a cache miss, not an error worth
        // surfacing — the caller falls through to the network path either way.
        console.log("Cache read error:", error);
      }
      return null;
    },

    /**
     * Fire-and-forget, and deliberately deferred — this is the whole point of the
     * module. Callers invoke it from inside snapshot handlers (up to 16 times on a
     * cold load of a multi-grade screen), so the stringify runs after interactions
     * rather than between "data arrived" and "screen is interactive".
     *
     * Not async on purpose: returning a promise would invite an `await` that
     * reintroduces exactly the stall this removes. Worst case, a write still in
     * flight when the app is killed is lost and the next cold start reads from the
     * network instead of the cache.
     */
    set(key, data) {
      InteractionManager.runAfterInteractions(() => {
        AsyncStorage.setItem(
          key,
          JSON.stringify({ data, timestamp: Date.now() })
        ).catch((error) => console.log("Cache write error:", error));
      });
    },

    /** Awaitable: the refresh paths clear a key before re-reading it. */
    async remove(key) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.log("Cache remove error:", error);
      }
    },
  };
}

export default makeScreenCache;
