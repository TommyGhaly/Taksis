import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

/**
 * Returns false until the current navigation/animation settles, then true.
 *
 * Why: tapping a drawer item mounts the target screen immediately, and that
 * screen's mount effects (Firestore listeners, sorts, date math) run on the JS
 * thread — the same thread driving the drawer-close animation. The animation
 * stalls halfway, leaving the drawer and the screen both half-visible.
 *
 * Gate data loading on this so the transition finishes first:
 *
 *   const ready = useAfterInteractions();
 *   useEffect(() => { if (!ready) return; ...open listeners... }, [ready]);
 *   if (!ready || loading) return <SkeletonScreen … />;
 *
 * The screen paints its skeleton instantly (cheap, no data), the drawer closes
 * smoothly, and the real work starts once the user is actually looking at it.
 */
export function useAfterInteractions() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => handle.cancel();
  }, []);

  return ready;
}

export default useAfterInteractions;
