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
          duration: 1000,
          easing: Easing.out(Easing.cubic),
        });
        overlayOpacity.value = withTiming(0.8, {
          duration: 1200,
          easing: Easing.out(Easing.cubic),
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

  // Overlapping animation: start expanding halfway through centering, both end together
  const animatedImageStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = animationProgress.value;
    
    return {
      transform: [
        { 
          // Start expanding at 50% and finish at 100% (same time as translation)
          scale: interpolate(
            progress,
            [0, 0.5, 1],
            [1, 1, finalSize / size],
            'clamp'
          )
        },
        { 
          // Move to center from 0% to 100%
          translateX: interpolate(
            progress,
            [0, 1],
            [initialPosition.value.x, 0],
            'clamp'
          )
        },
        { 
          // Move to center from 0% to 100%
          translateY: interpolate(
            progress,
            [0, 1],
            [initialPosition.value.y, -30],
            'clamp'
          )
        },
      ],
      // Start transitioning to square at 50% and finish at 100%
      borderRadius: interpolate(
        progress,
        [0, 0.5, 1],
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