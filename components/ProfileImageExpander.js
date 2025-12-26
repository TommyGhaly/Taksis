import React, { useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Spring config tuned for smooth, non-bouncy animation
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
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
  const positionRef = useRef({ x: 0, y: 0 });

  // Single progress value drives everything
  const progress = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const imageSource = useMemo(() => {
    if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return require("../assets/default_profile.png");
    }
    return imageUrl;
  }, [imageUrl]);

  const isDefaultImage = useMemo(
    () => !imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "",
    [imageUrl]
  );

  // Pre-measure position on mount and periodically
  const measurePosition = useCallback(() => {
    profileImageRef.current?.measure((x, y, w, h, pageX, pageY) => {
      positionRef.current = {
        x: pageX + w / 2 - WINDOW_WIDTH / 2,
        y: pageY + h / 2 - WINDOW_HEIGHT / 2,
      };
    });
  }, []);

  const openModal = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    // Use pre-measured position, measure again for accuracy
    profileImageRef.current?.measure((x, y, w, h, pageX, pageY) => {
      const posX = pageX + w / 2 - WINDOW_WIDTH / 2;
      const posY = pageY + h / 2 - WINDOW_HEIGHT / 2;
      
      startX.value = posX;
      startY.value = posY;
      progress.value = 0;
      
      setModalVisible(true);
      setIsAnimating(true);
      
      // Single spring animation drives all interpolations
      progress.value = withSpring(1, SPRING_CONFIG);
    });
  }, [onPress]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setIsAnimating(false);
    progress.value = 0;
  }, []);

  const animatedImageStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scaleVal = 1 + p * (finalSize / size - 1);
    
    return {
      transform: [
        { translateX: startX.value * (1 - p) },
        { translateY: startY.value * (1 - p) - p * 30 },
        { scale: scaleVal },
      ],
      borderRadius: (size / 2) * (1 - p) + 8 * p,
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
            style={[styles.enlargedImage, { width: size, height: size }, animatedImageStyle]}
            source={imageSource}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
          />
        </TouchableOpacity>
      </Modal>
      
      <TouchableOpacity onPress={openModal} activeOpacity={0.8}>
        <View 
          ref={profileImageRef}
          style={{ width: size, height: size }}
          collapsable={false}
          onLayout={measurePosition}
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
            placeholder={require("../assets/default_profile.png")}
            placeholderContentFit="contain"
            transition={200}
            onLoad={() => setImageLoaded(true)}
            recyclingKey={imageUrl}
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