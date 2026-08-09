/**
 * MicrosoftSignInModal
 *
 * Renders Microsoft's login inside the app instead of handing off to
 * SFSafariViewController / a Custom Tab the way Firebase's signInWithRedirect
 * does. Drives Azure's authorize endpoint in a WebView, intercepts the redirect
 * back to REDIRECT_URI, redeems the code with PKCE, and reports the tokens up.
 *
 * The caller owns what happens next (sign in vs. sign up), so this component
 * never touches Firebase itself — it only produces { idToken, accessToken }.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import {
  createAuthRequest,
  parseRedirectParams,
  REDIRECT_URI,
} from "../utils/microsoftAuth";

const { width } = Dimensions.get("window");
const moderateScale = (size, factor = 0.5) =>
  size + ((width / 375) * size - size) * factor;

// The app has no SafeAreaProvider, so stay off react-native-safe-area-context
// and handle the status bar directly.
const TOP_INSET = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;

/**
 * WKWebView zooms the page in whenever a text field smaller than 16px takes
 * focus, so tapping Microsoft's email box made the whole login jump. Pinning
 * the viewport stops it — WKWebView honours user-scalable=no, unlike mobile
 * Safari. react-native-webview's zoom props are Android-only, so this is the
 * only lever on iOS.
 */
const LOCK_VIEWPORT = `
(function () {
  var want = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  var CSS = 'input,select,textarea{font-size:16px !important;}';

  function apply() {
    var head = document.head || document.documentElement;
    if (!head) return;

    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'viewport');
      head.appendChild(m);
    }
    if (m.getAttribute('content') !== want) m.setAttribute('content', want);

    // The viewport alone doesn't always hold: WKWebView zooms to make a focused
    // input legible whenever its font-size is under 16px, and Microsoft's boxes
    // are smaller than that. Forcing 16px removes the reason to zoom at all.
    if (!document.getElementById('taksis-no-zoom')) {
      var s = document.createElement('style');
      s.id = 'taksis-no-zoom';
      s.appendChild(document.createTextNode(CSS));
      head.appendChild(s);
    }
  }

  apply();
  // Microsoft re-renders between the email and password steps and restores its
  // own viewport each time, so watch rather than setting this once.
  if (document.documentElement) {
    new MutationObserver(apply).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
true;
`;

const MicrosoftSignInModal = ({ visible, onClose, onSuccess, onError }) => {
  const [authUrl, setAuthUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const verifierRef = useRef(null);
  // The redirect fires as a navigation, which WebView can report more than once.
  const settledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setAuthUrl(null);
      setLoading(true);
      verifierRef.current = null;
      settledRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { url, codeVerifier } = await createAuthRequest();
        if (cancelled) return;
        verifierRef.current = codeVerifier;
        setAuthUrl(url);
      } catch (e) {
        if (!cancelled) onError?.(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, onError]);

  const handleRedirect = useCallback(
    async (url) => {
      if (settledRef.current) return;
      settledRef.current = true;

      const params = parseRedirectParams(url);

      if (params.error) {
        // Azure's error_description is multi-line with trace ids; the first
        // line carries the AADSTS code and the actual explanation.
        const detail = (params.error_description || params.error).split("\n")[0];
        onError?.(new Error(detail));
        return;
      }
      if (!params.code) {
        onError?.(new Error("Microsoft did not return an authorization code."));
        return;
      }

      // Spinner stays up while the caller redeems the code server-side.
      setLoading(true);
      onSuccess?.({ code: params.code, codeVerifier: verifierRef.current });
    },
    [onSuccess, onError],
  );

  // Intercepting here keeps the custom scheme inside the WebView — the OS never
  // has to resolve taksis://, so no deep-link handling is involved.
  const onShouldStartLoadWithRequest = useCallback(
    (request) => {
      if (request.url?.startsWith(REDIRECT_URI)) {
        handleRedirect(request.url);
        return false;
      }
      return true;
    },
    [handleRedirect],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={[styles.container, { paddingTop: TOP_INSET }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={moderateScale(26)} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.title}>Sign in with Microsoft</Text>
          {/* Balances the close button so the title stays centered. */}
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.webWrap}>
          {authUrl ? (
            <WebView
              source={{ uri: authUrl }}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onLoadEnd={() => setLoading(false)}
              injectedJavaScriptBeforeContentLoaded={LOCK_VIEWPORT}
              injectedJavaScript={LOCK_VIEWPORT}
              // Some react-native-webview versions only run injected JS on iOS
              // when a message handler is present.
              onMessage={() => {}}
              onError={({ nativeEvent }) =>
                onError?.(
                  new Error(nativeEvent.description || "Failed to load Microsoft sign-in."),
                )
              }
              // Keeps a previous Microsoft session from silently signing the
              // user back in, and leaves no cookies behind afterwards.
              incognito
              startInLoadingState={false}
              style={styles.web}
            />
          ) : null}

          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#147EFB" />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: { width: moderateScale(34), alignItems: "flex-start" },
  title: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#E0E0E0",
    letterSpacing: -0.2,
  },
  webWrap: { flex: 1, backgroundColor: "#fff" },
  web: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
});

export default MicrosoftSignInModal;
