import React, { useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const DEFAULT_PROFILE = require('../assets/default_profile.png');

const SPRING_CONFIG = {
  damping: 25,
  stiffness: 120,
  mass: 1,
};

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

      setModalVisible(true);
      setIsAnimating(true);

      requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG);
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
    requestAnimationFrame(() => openOnce());
  }, [onPress]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setIsAnimating(false);
    progress.value = 0;
  }, []);

  const animatedImageStyle = useAnimatedStyle(() => {
    const p = progress.value;
    
    // Scale from initialScale (small) to 1 (full finalSize)
    const scaleVal = initialScale + p * (1 - initialScale);
    
    // Translate from start position to center
    const translateX = startX.value * (1 - p);
    const translateY = startY.value * (1 - p);
    
    // Border radius: from circular (size/2) to slightly rounded (8)
    // Account for scale: actual rendered radius = borderRadius * scale
    const targetStartRadius = size / 2;
    const targetEndRadius = 30;
    const currentRadius = (targetStartRadius + p * (targetEndRadius - targetStartRadius)) / scaleVal;
    
    return {
      transform: [
        { translateX },
        { translateY },
        { scale: scaleVal },
      ],
      borderRadius: currentRadius,
      opacity: p > 0.01 ? 1 : 0,
    };
  });

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.85,
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
      
      <TouchableOpacity onPress={openModal} activeOpacity={0.8}>
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
  },
  enlargedImage: {
    borderWidth: 1,
    borderColor: '#333333',
    position: 'absolute',
  },
});

export default ProfileImageExpander;