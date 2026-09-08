import { useEffect, useState } from "react";
import { Linking } from "react-native";

/**
 * Universal-link handling for the App Clip URLs.
 *
 * When the full app is installed, iOS opens *the app* rather than the App Clip,
 * and Android App Links do the same. So every clip URL needs a destination in
 * here too — otherwise an existing user tapping the parking-lot tag just lands
 * on the home screen, which reads as the tag being broken.
 *
 * This deliberately is not a React Navigation `linking` config. The app has five
 * NavigationContainers, four of them `independent`, and the target screen lives
 * inside one of those — so a linking config cannot address it without
 * restructuring navigation. A pending-route store that the two relevant screens
 * subscribe to is far less invasive.
 *
 * The pending route survives until something consumes it, which is what lets a
 * signed-out tap still land correctly: the link is held across the sign-in flow
 * rather than being dropped on the floor.
 */

const HOST = "spsmwayland.org";
const PATH_PREFIX = "c";

/**
 * Snippet slug -> route name inside SettingsNavigation.
 *
 * Mirrors `ClipDestination` in `ios-appclip/TaksisClip/ClipDestination.swift`.
 * A snippet added there needs an entry here, or the installed app will swallow
 * the link that the App Clip handles fine.
 */
const SNIPPET_ROUTES = {
  "register-vehicle": "RegisterVehicle",
};

// Built from the constants above so the two cannot drift. Both hosts are matched:
// `www` is where the files are actually served and what the app's associated
// domain names, and the apex 301s there, so a link to either refers to us.
const LINK_RE = new RegExp(
  `^https://(?:www\\.)?${HOST.replace(/\./g, "\\.")}/${PATH_PREFIX}/([a-z0-9-]+)`,
  "i"
);

/**
 * The Settings route a deep link points at, or null if the URL isn't one of ours.
 *
 * Parsed with a regex rather than `URL`, whose React Native implementation has
 * historically been incomplete for `hostname`/`pathname`.
 */
export function parseDeepLink(url) {
  if (typeof url !== "string") return null;
  const match = url.match(LINK_RE);
  if (!match) return null;
  return SNIPPET_ROUTES[match[1].toLowerCase()] ?? null;
}

let pendingRoute = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener(pendingRoute));
}

/** Records a URL if we recognize it. Returns the route, or null if ignored. */
export function handleDeepLinkUrl(url) {
  const route = parseDeepLink(url);
  if (route) {
    pendingRoute = route;
    emit();
  }
  return route;
}

/** Takes the pending route and clears it, so it is only navigated to once. */
export function consumePendingRoute() {
  const route = pendingRoute;
  if (route) {
    pendingRoute = null;
    emit();
  }
  return route;
}

/** The pending route, re-rendering the caller when it changes. */
export function usePendingRoute() {
  const [route, setRoute] = useState(pendingRoute);
  useEffect(() => {
    listeners.add(setRoute);
    // Re-sync in case a URL arrived between render and this effect.
    setRoute(pendingRoute);
    return () => {
      listeners.delete(setRoute);
    };
  }, []);
  return route;
}

/**
 * Starts listening for links. Call once, at the app root.
 *
 * `getInitialURL` covers a cold start (the app was launched *by* the link);
 * the `url` event covers a warm one. Returns an unsubscribe function.
 */
export function startDeepLinkListener() {
  let cancelled = false;

  Linking.getInitialURL()
    .then((url) => {
      if (!cancelled) handleDeepLinkUrl(url);
    })
    .catch(() => {});

  const subscription = Linking.addEventListener("url", ({ url }) => {
    handleDeepLinkUrl(url);
  });

  return () => {
    cancelled = true;
    subscription.remove();
  };
}
