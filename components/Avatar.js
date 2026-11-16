/**
 * Avatar — the one profile picture component.
 *
 * Pass a `uid` and it resolves the URL through utils/avatarCache (memory →
 * AsyncStorage → network, deduped, no polling) and renders through expo-image
 * with cachePolicy="memory-disk", so the bytes live on the device permanently.
 *
 * Pass `user` instead (or as well) when you already have the doc — that primes
 * the cache from `photoURL` for free, with no Storage round-trip at all.
 *
 * Set `expandable` to get the tap-to-zoom behaviour of ProfileImageExpander.
 */
import React, { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import * as avatarCache from "../utils/avatarCache";
import ProfileImageExpander from "./ProfileImageExpander";
import { useTheme, useDefaultAvatar } from "../theme";

/**
 * Subscribe to the cache and re-render only when this uid's URI actually
 * changes. Avoids the app-wide "bump a counter" re-render storm.
 */
function useAvatarUri(uid) {
  const subscribe = useCallback((cb) => avatarCache.subscribe(cb), []);
  const getSnapshot = useCallback(() => (uid ? avatarCache.uriFor(uid) : null), [uid]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const Avatar = React.memo(({
  uid,
  user,
  size = 40,
  borderRadius,
  style,
  expandable = false,
  finalSize = 300,
  onPress,
  showBorder = true,
  onDisplay,
}) => {
  const t = useTheme();
  const DEFAULT_PROFILE = useDefaultAvatar();
  const resolvedUid = uid || user?.uid || user?.id || null;
  const uri = useAvatarUri(resolvedUid);

  // Free path: adopt photoURL from a doc we already have.
  useEffect(() => {
    if (user) avatarCache.primeFromUser(user);
  }, [user, user?.photoURL, user?.photoUpdatedAt]);

  // Fallback path: resolve via Storage once, then it's cached forever.
  // `uri` is a dep so an invalidate() (e.g. after a photo change) re-resolves
  // instead of leaving the avatar blank. This can't loop: resolve() caches
  // misses too, so a second call for the same uid never hits the network.
  useEffect(() => {
    if (resolvedUid && !uri) avatarCache.resolve(resolvedUid);
  }, [resolvedUid, uri]);

  const radius = borderRadius ?? size / 2;

  if (expandable) {
    return (
      <ProfileImageExpander
        imageUrl={uri}
        size={size}
        borderRadius={radius}
        finalSize={finalSize}
        onPress={onPress}
        style={style}
      />
    );
  }

  const img = (
    <Image
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          ...(showBorder ? { borderWidth: 1, borderColor: t.surfaceHighest } : null),
        },
        style,
      ]}
      source={uri ? { uri } : DEFAULT_PROFILE}
      placeholder={DEFAULT_PROFILE}
      placeholderContentFit="cover"
      contentFit="cover"
      cachePolicy="memory-disk"
      // Profile photos are stored at camera resolution (up to ~4300px). Without
      // this, every mount decodes the full image and then downscales it to the
      // avatar's size synchronously on the main thread — the dominant cost when
      // a roster scrolls. With it, SDWebImage decodes straight to a thumbnail
      // at the view's pixel size on its background coder queue (and caches that
      // thumbnail), so the main thread just displays it. Safe here because an
      // avatar is a fixed-size square that never resizes after layout.
      enforceEarlyResizing
      recyclingKey={uri || `default-${resolvedUid || "none"}`}
      transition={120}
      onDisplay={onDisplay}
    />
  );

  if (!onPress) return img;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      {img}
    </TouchableOpacity>
  );
});

Avatar.displayName = "Avatar";

export default Avatar;
