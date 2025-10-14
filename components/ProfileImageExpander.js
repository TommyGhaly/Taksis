import React, { useState, useRef, useMemo } from 'react';
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
  runOnJS,
  Easing,
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

  // Reanimated shared values
  const scale = useSharedValue(1);
  const borderRadiusValue = useSharedValue(borderRadius);
  const imageOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
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

  const openModal = () => {
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

      // Set initial position
      translateX.value = initialX;
      translateY.value = initialY;
      scale.value = 1;
      borderRadiusValue.value = width / 2;
      imageOpacity.value = 1;
      overlayOpacity.value = 0;

      setImageModalVisible(true);
      setIsImageAnimating(true);

      // Slower animation - increased durations
      const duration = 650;
      const easingCurve = Easing.bezier(0.25, 0.1, 0.25, 1);

      translateX.value = withTiming(0, { duration, easing: easingCurve });
      translateY.value = withTiming(-30, { duration, easing: easingCurve });
      overlayOpacity.value = withTiming(0.8, { duration: 500, easing: easingCurve });
      
      // Delay scale and border radius slightly for overlap effect
      setTimeout(() => {
        scale.value = withTiming(finalSize / size, { duration: 550, easing: easingCurve });
        borderRadiusValue.value = withTiming(8, { duration: 550, easing: easingCurve });
      }, 150);
    });
  };

  const closeModal = () => {
    // No animation - instant close
    setImageModalVisible(false);
    setIsImageAnimating(false);
    imageOpacity.value = 0;
    overlayOpacity.value = 0;
  };

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    borderRadius: borderRadiusValue.value,
    opacity: imageOpacity.value,
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
          />
        </TouchableOpacity>
      </Modal>
      
      <TouchableOpacity onPress={openModal} activeOpacity={0.8}>
        <View 
          ref={profileImageRef}
          style={{ position: 'relative', width: size, height: size }}
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