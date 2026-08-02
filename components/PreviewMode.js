import React from "react";

/**
 * Marks a subtree as a live *preview* of a screen rather than the screen itself.
 *
 * The home-screen selector mounts every screen at thumbnail scale so the user
 * can see what they're picking. Those are real mounts — listeners, reads and all
 * — which is fine, but a preview must not behave like the foreground screen:
 *
 *   - no <Modal>s or Alerts (RN renders both above everything, so a thumbnail
 *     would take over the settings screen it's sitting in)
 *   - no writes or migrations
 *   - no permission prompts, and no duplicate app-wide subscriptions when the
 *     same screen is already mounted for real behind the navigator
 *
 * Screens read it with `useIsPreview()` and skip that work. Read-only display
 * logic stays untouched, which is the whole point — the thumbnail should look
 * like the real thing.
 */
const PreviewModeContext = React.createContext(false);

export const PreviewModeProvider = ({ children }) => (
  <PreviewModeContext.Provider value={true}>{children}</PreviewModeContext.Provider>
);

export function useIsPreview() {
  return React.useContext(PreviewModeContext);
}

export default PreviewModeContext;
