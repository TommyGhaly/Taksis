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
  const positionRef = useRef({ x: 0, y: 0 });

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

  const measurePosition = useCallback(() => {
    profileImageRef.current?.measure((x, y, w, h, pageX, pageY) => {
      // Calculate offset from center of screen to center of image
      const imageCenterX = pageX + w / 2;
      const imageCenterY = pageY + h / 2;
      const screenCenterX = WINDOW_WIDTH / 2;
      const screenCenterY = WINDOW_HEIGHT / 2;
      
      positionRef.current = {
        x: imageCenterX - screenCenterX,
        y: imageCenterY - screenCenterY,
      };
    });
  }, []);

  const openModal = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    // Re-measure position right before opening
    profileImageRef.current?.measure((x, y, w, h, pageX, pageY) => {
      const imageCenterX = pageX + w / 2;
      const imageCenterY = pageY + h / 2;
      const screenCenterX = WINDOW_WIDTH / 2;
      const screenCenterY = WINDOW_HEIGHT / 2;
      
      const offsetX = imageCenterX - screenCenterX;
      const offsetY = imageCenterY - screenCenterY;
      
      // If essentially centered (within 20px), don't translate at all
      startX.value = Math.abs(offsetX) < 20 ? 0 : offsetX;
      startY.value = Math.abs(offsetY) < 20 ? 0 : offsetY;
      progress.value = 0;
      
      setModalVisible(true);
      setIsAnimating(true);
      
      requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG);
      });
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
    
    // Interpolate from start position to center (0, 0)
    const translateX = startX.value * (1 - p);
    const translateY = startY.value * (1 - p);
    
    return {
      transform: [
        { translateX },
        { translateY },
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