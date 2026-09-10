import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as avatarCache from './utils/avatarCache';

const UserContext = createContext();

const PROFILE_CACHE_KEY = 'userProfile_v1';

/**
 * Holds the auth user plus a single shared subscription to the signed-in user's
 * Firestore document.
 *
 * Screens used to each open their own users/{uid} listener (~18 of them), all
 * reading the same doc. `useUserProfile()` lets them share this one instead.
 * The last-known profile is persisted so a cold start has data immediately.
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [signUp, setSignUp] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const uidRef = useRef(null);

  // Restore the last profile so consumers aren't empty on first paint.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PROFILE_CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const cached = JSON.parse(raw);
        if (cached?.uid) {
          setProfile((prev) => prev ?? cached);
          avatarCache.primeFromUser(cached);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // One listener for the whole app.
  useEffect(() => {
    const uid = user?.uid ?? null;
    uidRef.current = uid;

    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const unsubscribe = onSnapshot(
      doc(getFirestore(), 'users', uid),
      (doc) => {
        if (uidRef.current !== uid) return;
        if (doc.exists) {
          const next = { uid, ...doc.data() };
          setProfile(next);
          avatarCache.primeFromUser(next);
          AsyncStorage.setItem(
            PROFILE_CACHE_KEY,
            JSON.stringify(next)
          ).catch(() => {});
        }
        setProfileLoading(false);
      },
      (error) => {
        console.error('[UserContext] profile listener error:', error);
        setProfileLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  // Memoized so consumers don't re-render on every provider render.
  const value = useMemo(
    () => ({ user, setUser, signUp, setSignUp, profile, profileLoading }),
    [user, signUp, profile, profileLoading]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

/**
 * The signed-in user's Firestore profile, shared app-wide.
 * Prefer this over opening another users/{uid} listener.
 */
export function useUserProfile() {
  const ctx = useContext(UserContext);
  return {
    profile: ctx?.profile ?? null,
    loading: ctx?.profileLoading ?? false,
  };
}

export async function clearCachedProfile() {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {}
}
