import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnUI,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

const ProfileImageExpander = React.memo(({ 
  imageUrl, 
  size = 60, 
  onPress,
  finalSize = 300,
  borderRadius = 30,
  style = {}
}) => {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [isImageAnimating, setIsImageAnimating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const profileImageRef = useRef(null);

  // Single animation progress value
  const animationProgress = useSharedValue(0);
  const initialPosition = useSharedValue({ x: 0, y: 0 });
  const overlayOpacity = useSharedValue(0);

  const imageSource = useMemo(
    () => {
      if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
        return require("../assets/default_profile.png");
      }
      return imageUrl;
    },
    [imageUrl]
  );

  const isDefaultImage = useMemo(
    () => !imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "",
    [imageUrl]
  );

  const openModal = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    profileImageRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const windowWidth = Dimensions.get('window').width;
      const windowHeight = Dimensions.get('window').height;
      
      const profileCenterX = pageX + width / 2;
      const profileCenterY = pageY + height / 2;
      const initialX = profileCenterX - windowWidth / 2;
      const initialY = profileCenterY - windowHeight / 2;

      // Store initial position
      initialPosition.value = { x: initialX, y: initialY };
      
      setImageModalVisible(true);
      setIsImageAnimating(true);

      // Single animation trigger on UI thread
      runOnUI(() => {
        'worklet';
        animationProgress.value = withTiming(1, {
          duration: 650,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        overlayOpacity.value = withTiming(0.8, {
          duration: 500,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      })();
    });
  }, [onPress, size, finalSize, animationProgress, initialPosition, overlayOpacity]);

  const closeModal = useCallback(() => {
    setImageModalVisible(false);
    setIsImageAnimating(false);
    runOnUI(() => {
      'worklet';
      animationProgress.value = 0;
      overlayOpacity.value = 0;
    })();
  }, [animationProgress, overlayOpacity]);

  // Two-phase animation: center first (0→0.45), then expand (0.45→1)
  const animatedImageStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = animationProgress.value;
    
    return {
      transform: [
        { 
          // Phase 1: Stay same size
          // Phase 2: Expand to final size
          scale: interpolate(
            progress,
            [0, 0.45, 1],
            [1, 1, finalSize / size],
            'clamp'
          )
        },
        { 
          // Phase 1: Move to center X
          // Phase 2: Stay centered
          translateX: interpolate(
            progress,
            [0, 0.45, 1],
            [initialPosition.value.x, 0, 0],
            'clamp'
          )
        },
        { 
          // Phase 1: Move to center Y
          // Phase 2: Stay centered (slight adjustment)
          translateY: interpolate(
            progress,
            [0, 0.45, 1],
            [initialPosition.value.y, -30, -30],
            'clamp'
          )
        },
      ],
      // Phase 1: Stay circular
      // Phase 2: Transition to square
      borderRadius: interpolate(
        progress,
        [0, 0.45, 1],
        [size / 2, size / 2, 8],
        'clamp'
      ),
      opacity: interpolate(
        progress,
        [0, 0.1],
        [0, 1],
        'clamp'
      ),
    };
  }, [size, finalSize]);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <>
      <Modal
        animationType="none"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={closeModal}
        statusBarTranslucent
        hardwareAccelerated={true}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View
            style={[
              styles.overlay,
              { backgroundColor: 'rgba(0, 0, 0, 0.9)' },
              animatedOverlayStyle,
            ]}
            pointerEvents="none"
            needsOffscreenAlphaCompositing={false}
          />
          <AnimatedExpoImage
            style={[
              styles.enlargedImage,
              { width: size, height: size },
              animatedImageStyle,
            ]}
            source={imageSource}
            contentFit="contain"
            cachePolicy="memory-disk"
            placeholder={require("../assets/default_profile.png")}
            placeholderContentFit="contain"
            shouldRasterizeIOS={true}
            renderingMode="auto"
          />
        </TouchableOpacity>
      </Modal>
      
      <TouchableOpacity onPress={openModal} activeOpacity={0.8}>
        <View 
          ref={profileImageRef}
          style={{ position: 'relative', width: size, height: size }}
          collapsable={false}
        >
          <Image
            style={[
              {
                width: size,
                height: size,
                borderRadius: borderRadius,
                borderWidth: 1,
                borderColor: '#333333',
                opacity: isImageAnimating ? 0 : 1,
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
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  enlargedImage: {
    borderWidth: 1,
    borderColor: '#333333',
    position: 'absolute',
  },
});

export default ProfileImageExpander;