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
  Easing,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

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
  const [layoutReady, setLayoutReady] = useState(false);
  const profileImageRef = useRef(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const borderRadiusAnim = useSharedValue(size / 2);
  const opacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const initialPosition = useRef({ x: 0, y: 0 });

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

  const openModal = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    profileImageRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const profileCenterX = pageX + width / 2;
      const profileCenterY = pageY + height / 2;
      const initialX = profileCenterX - WINDOW_WIDTH / 2;
      const initialY = profileCenterY - WINDOW_HEIGHT / 2;

      initialPosition.current = { x: initialX, y: initialY };
      
      // Set initial values before showing modal
      scale.value = 1;
      translateX.value = initialX;
      translateY.value = initialY;
      borderRadiusAnim.value = size / 2;
      opacity.value = 1;
      overlayOpacity.value = 0;
      
      setImageModalVisible(true);
      setIsImageAnimating(true);
      setLayoutReady(true);

      const duration = 400;
      const easing = Easing.out(Easing.cubic);

      // All animations run together with same timing
      requestAnimationFrame(() => {
        overlayOpacity.value = withTiming(0.85, { duration, easing });
        translateX.value = withTiming(0, { duration, easing });
        translateY.value = withTiming(-30, { duration, easing });
        scale.value = withTiming(finalSize / size, { duration, easing });
        borderRadiusAnim.value = withTiming(8, { duration, easing });
      });
    });
  }, [onPress, size, finalSize]);

  const closeModal = useCallback(() => {
    setImageModalVisible(false);
    setIsImageAnimating(false);
    setLayoutReady(false);
    
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    borderRadiusAnim.value = size / 2;
    opacity.value = 0;
    overlayOpacity.value = 0;
  }, [size]);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    borderRadius: borderRadiusAnim.value,
    opacity: opacity.value,
  }));

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
        hardwareAccelerated
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View
            style={[styles.overlay, animatedOverlayStyle]}
            pointerEvents="none"
          />
          {layoutReady && (
            <AnimatedExpoImage
              style={[
                styles.enlargedImage,
                { width: size, height: size },
                animatedImageStyle,
              ]}
              source={imageSource}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={imageUrl}
              priority="high"
            />
          )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  enlargedImage: {
    borderWidth: 1,
    borderColor: '#333333',
    position: 'absolute',
  },
});

export default ProfileImageExpander;