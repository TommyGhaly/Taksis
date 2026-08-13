import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const DEFAULT_PROFILE = require('../assets/default_profile.png');

// Opening springs with a small amount of overshoot so the image settles rather
// than stopping dead. Closing uses a curve instead — a spring on the way out
// reads as lag, because nothing is left on screen to justify the settle.
//
// The rest thresholds are deliberately left at Reanimated's defaults (0.01
// displacement / 2 speed). Tightening them on a value that only travels 0→1
// buys nothing visible and keeps the spring evaluating for hundreds of ms
// after it has visually stopped, which costs a frame's compositing work per
// tick on a full-size image.
const OPEN_SPRING = {
  damping: 24,
  stiffness: 240,
  mass: 1,
};

// Ease-out, not ease-in-out: the shrink covers most of its distance in the
// first third, so the tap registers as immediate even though motion continues.
const CLOSE_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
};

// How long to wait for measureInWindow before giving up and opening centred.
// Only the pathological case (avatar hosted inside another Modal, where the
// callback never fires at all) ever waits this out.
const MEASURE_FALLBACK_MS = 120;

const ProfileImageExpander = React.memo(({ 
  imageUrl, 
  size = 60, 
  onPress,
  finalSize = 300,
  borderRadius = 30,
  style = {}
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const profileImageRef = useRef(null);
  const isClosing = useRef(false);
  const fallbackTimer = useRef(null);

  useEffect(() => () => clearTimeout(fallbackTimer.current), []);

  const progress = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Scale ratio: we render at finalSize and scale down to size/finalSize initially
  const initialScale = size / finalSize;

  // Callers pass either a URL string, a require()'d asset, or null — accept all.
  const isDefaultImage = useMemo(
    () => !imageUrl || (typeof imageUrl === "string" && imageUrl.trim() === ""),
    [imageUrl]
  );

  const imageSource = useMemo(() => {
    if (isDefaultImage) return DEFAULT_PROFILE;
    return imageUrl;
  }, [imageUrl, isDefaultImage]);

  // recyclingKey must be a string; require()'d assets come through as numbers.
  const recyclingKey = useMemo(
    () => (typeof imageUrl === "string" && imageUrl ? imageUrl : "default"),
    [imageUrl]
  );

  // Only remote sources need warming; require()'d assets are already bundled.
  const prefetchFullSize = useCallback(() => {
    if (typeof imageUrl !== "string" || !imageUrl) return;
    // Same policy the Image below reads from, so the warmed entry is the one
    // it actually looks up.
    Image.prefetch(imageUrl, "memory-disk").catch(() => {});
  }, [imageUrl]);

  const openModal = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    // Open from a given origin offset. Measuring is only an enhancement for the
    // zoom animation — the modal must open even when measure() never fires
    // (e.g. this avatar is hosted inside another Modal, where RN may not
    // invoke the callback at all).
    const open = (offsetX = 0, offsetY = 0) => {
      startX.value = Math.abs(offsetX) < 20 ? 0 : offsetX;
      startY.value = Math.abs(offsetY) < 20 ? 0 : offsetY;
      progress.value = 0;
      isClosing.current = false;

      setModalVisible(true);
      setIsAnimating(true);

      // Only the spring start waits on the JS thread. The image itself must not
      // — at p=0 it already sits exactly over the (now hidden) thumbnail, so
      // rendering it immediately is seamless, and a late frame here reads as
      // "nothing has happened yet" rather than as a blank hole.
      requestAnimationFrame(() => {
        progress.value = withSpring(1, OPEN_SPRING);
      });
    };

    const node = profileImageRef.current;
    if (!node?.measureInWindow) {
      open();
      return;
    }

    let opened = false;
    const openOnce = (x, y) => {
      if (opened) return;
      opened = true;
      clearTimeout(fallbackTimer.current);
      open(x, y);
    };

    node.measureInWindow((x, y, w, h) => {
      if (typeof x !== "number" || typeof y !== "number" || !w || !h) {
        openOnce();
        return;
      }
      openOnce(
        x + w / 2 - WINDOW_WIDTH / 2,
        y + h / 2 - WINDOW_HEIGHT / 2
      );
    });

    // Fallback: if measureInWindow never calls back, open centered anyway.
    //
    // This deadline has to be long enough to lose the race in the normal case.
    // measureInWindow is an async round-trip to the native thread; at one frame
    // (the old requestAnimationFrame) the fallback would routinely win whenever
    // the JS thread was busy, and the image would then fly in from the centre of
    // the screen instead of from the avatar. Same tap, two different animations,
    // decided by load — which is what made the open look erratic.
    fallbackTimer.current = setTimeout(() => openOnce(), MEASURE_FALLBACK_MS);
  }, [onPress]);

  // Tearing the modal down is deferred until the shrink finishes, so the image
  // lands back on the thumbnail instead of cutting out mid-air. The thumbnail
  // stays hidden until the same commit that unmounts the modal, so the handoff
  // never shows both copies or neither.
  const finishClose = useCallback(() => {
    // A re-open can interrupt the close; that open clears the flag and owns the
    // modal from then on, so a late callback from the cancelled close must not
    // tear it back down.
    if (!isClosing.current) return;
    setModalVisible(false);
    setIsAnimating(false);
    isClosing.current = false;
  }, []);

  const closeModal = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;

    // Teardown is not conditional on `finished`. An interrupted close that
    // never unmounts leaves a full-screen transparent modal over the app with
    // isClosing latched on, which swallows every subsequent tap.
    progress.value = withTiming(0, CLOSE_TIMING, () => {
      runOnJS(finishClose)();
    });
  }, [finishClose]);

  const animatedImageStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // Scale from initialScale (small) to 1 (full finalSize)
    const scaleVal = initialScale + p * (1 - initialScale);

    // Translate from start position to center
    const translateX = startX.value * (1 - p);
    const translateY = startY.value * (1 - p);

    // Border radius: morph from whatever the thumbnail actually uses to the
    // expanded radius. Divided by the scale because the transform multiplies
    // the rendered radius too, and the two have to cancel for the corner to
    // track the thumbnail's corner exactly.
    const targetStartRadius = borderRadius;
    const targetEndRadius = 30;
    const currentRadius = (targetStartRadius + p * (targetEndRadius - targetStartRadius)) / scaleVal;

    return {
      transform: [
        { translateX },
        { translateY },
        { scale: scaleVal },
      ],
      borderRadius: currentRadius,
    };
  });

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    // Clamped because the open spring overshoots past 1.
    opacity: Math.min(progress.value, 1) * 0.85,
  }));

  return (
    <>
      <Modal
        animationType="none"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
        statusBarTranslucent
        hardwareAccelerated
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View style={[styles.overlay, animatedOverlayStyle]} pointerEvents="none" />
          <AnimatedExpoImage
            style={[
              styles.enlargedImage,
              { width: finalSize, height: finalSize },
              animatedImageStyle
            ]}
            source={imageSource}
            contentFit={isDefaultImage ? "contain" : "cover"}
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            recyclingKey={recyclingKey}
          />
        </TouchableOpacity>
      </Modal>
      
      {/* Warm the full-size decode while the finger is still down. The modal
          mounts its Image only on open, so without this the decode starts at
          tap time and the first frames of the zoom have nothing to draw. */}
      <TouchableOpacity
        onPress={openModal}
        onPressIn={prefetchFullSize}
        activeOpacity={0.8}
      >
        <View 
          ref={profileImageRef}
          style={{ width: size, height: size }}
          collapsable={false}
        >
          <Image
            style={[
              {
                width: size,
                height: size,
                borderRadius,
                borderWidth: 1,
                borderColor: '#333333',
                opacity: isAnimating ? 0 : 1,
              },
              style,
            ]}
            source={imageSource}
            contentFit={isDefaultImage || !imageLoaded ? "contain" : "cover"}
            cachePolicy="memory-disk"
            placeholder={DEFAULT_PROFILE}
            placeholderContentFit="contain"
            transition={200}
            onLoad={() => setImageLoaded(true)}
            recyclingKey={recyclingKey}
          />
        </View>
      </TouchableOpacity>
    </>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    // The scrim's resting state must be invisible. Without this the view paints
    // opaque black for any frame where the Reanimated style has not landed yet
    // — and it is mounted into a Modal, whose native window comes up in its own
    // root, so those frames reliably exist on a slow JS thread.
    opacity: 0,
  },
  enlargedImage: {
    borderWidth: 1,
    borderColor: '#333333',
    position: 'absolute',
  },
});

export default ProfileImageExpander;