import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';

const ProfileImageExpander = React.memo(({ 
  imageUrl, 
  size = 60, 
  onPress,
  finalSize = 300,
  borderRadius = 30,
  style = {}
}) => {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [profileImageLayout, setProfileImageLayout] = useState(null);
  const [isImageAnimating, setIsImageAnimating] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const profileImageRef = useRef(null);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const borderRadiusAnim = useRef(new Animated.Value(borderRadius)).current;
  const imageOpacityAnim = useRef(new Animated.Value(0)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacityAnim = useRef(new Animated.Value(0)).current;

  // Memoized image source for immediate updates
  const imageSource = useMemo(
    () => {
      if (imageLoadError || !imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
        return require("../assets/default_profile.png");
      }
      return { uri: imageUrl };
    },
    [imageUrl, imageLoadError]
  );

  useEffect(() => {
    if (imageModalVisible && profileImageLayout) {
      profileImageRef.current.measure((x, y, width, height, pageX, pageY) => {
        const windowWidth = Dimensions.get('window').width;
        const windowHeight = Dimensions.get('window').height;
        const baseSize = size;
        const finalBorderRadius = 8; // rounded corners
        // Calculate the exact center position of the profile image on screen
        const profileCenterX = pageX + width / 2;
        const profileCenterY = pageY + height / 2;
        // Initial position: profile image center relative to screen center
        const initialX = profileCenterX - windowWidth / 2;
        const initialY = profileCenterY - windowHeight / 2;
        // Final position: a little higher than center
        const finalX = 0;
        const finalY = -30; // A little higher than center
        
        // Set initial values - start exactly where profile image is
        translateXAnim.setValue(initialX);
        translateYAnim.setValue(initialY);
        scaleAnim.setValue(1);
        borderRadiusAnim.setValue(width / 2); // start as circle
        imageOpacityAnim.setValue(1); // Make animated image visible immediately
        overlayOpacityAnim.setValue(0);
        // Start animation and hide original image at the same time
        setTimeout(() => {
          setIsImageAnimating(true); // Hide original profile image
          // Overlapping animation: move to center, then start expanding after a short delay, both end together
          const moveDuration = 550;
          const expandDelay = 150;
          const expandDuration = moveDuration - expandDelay; // 400ms
          Animated.parallel([
            // Move to center and fade in overlay
            Animated.timing(translateXAnim, {
              toValue: finalX,
              duration: moveDuration,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }),
            Animated.timing(translateYAnim, {
              toValue: finalY,
              duration: moveDuration,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }),
            Animated.timing(overlayOpacityAnim, {
              toValue: 0.8,
              duration: 400,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }),
            // Start expanding after a short delay, but end at the same time as translation
            Animated.timing(scaleAnim, {
              toValue: finalSize / baseSize,
              duration: expandDuration,
              delay: expandDelay,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }),
            Animated.timing(borderRadiusAnim, {
              toValue: finalBorderRadius,
              duration: expandDuration,
              delay: expandDelay,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }),
          ]).start();
        }, 16); // Small delay to ensure positioning is complete
      });
    } else if (!imageModalVisible && profileImageLayout) {
      profileImageRef.current.measure((x, y, width, height, pageX, pageY) => {
        const windowWidth = Dimensions.get('window').width;
        const windowHeight = Dimensions.get('window').height;
        // Calculate the exact center position of the profile image on screen
        const profileCenterX = pageX + width / 2;
        const profileCenterY = pageY + height / 2;
        const initialX = profileCenterX - windowWidth / 2;
        const initialY = profileCenterY - windowHeight / 2;
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }),
          Animated.timing(borderRadiusAnim, {
            toValue: width / 2,
            duration: 800,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }),
          Animated.timing(translateXAnim, {
            toValue: initialX,
            duration: 600,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }),
          Animated.timing(translateYAnim, {
            toValue: initialY,
            duration: 600,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }),
          Animated.timing(overlayOpacityAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }),
        ]).start(() => {
          // Hide the animated image after animation completes
          imageOpacityAnim.setValue(0);
          setIsImageAnimating(false); // Show original profile image again
        });
      });
    }
  }, [imageModalVisible, profileImageLayout, size, finalSize]);

  const handlePress = () => {
    if (onPress) {
      onPress(); // Call the provided onPress function instead of opening modal
    } else {
      setImageModalVisible(true);
    }
  };

  return (
    <>
      <Modal
        animationType="none"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImageModalVisible(false)}
        >
          {/* Dark overlay background */}
          <Animated.View
            style={[
              styles.overlay,
              { opacity: overlayOpacityAnim },
              { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
            ]}
          />
          <Animated.Image
            style={[
              styles.enlargedImage,
              { width: size, height: size },
              { transform: [
                  { scale: scaleAnim },
                  { translateX: translateXAnim },
                  { translateY: translateYAnim },
                ] },
              { borderRadius: borderRadiusAnim },
              { opacity: imageOpacityAnim },
            ]}
            source={imageSource}
            onError={() => setImageLoadError(true)}
            resizeMode="contain"
            loadingIndicatorSource={require("../assets/default_profile.png")}
          />
        </TouchableOpacity>
      </Modal>
      
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <View style={{ position: 'relative', width: size, height: size }}>
          <Image
            ref={profileImageRef}
            style={[
              {
                width: size,
                height: size,
                borderRadius: borderRadius,
                borderWidth: 1,
                borderColor: '#333333',
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: isImageAnimating ? 0 : 1,
              },
              style,
            ]}
            source={imageSource}
            defaultSource={require('../assets/default_profile.png')}
            onError={() => setImageLoadError(true)}
            onLayout={e => setProfileImageLayout(e.nativeEvent.layout)}
            loadingIndicatorSource={require("../assets/default_profile.png")}
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
    position: 'absolute',  top: 0,
    left:0,
    right: 0,
    bottom: 0,
  },
  enlargedImage: {
    borderWidth: 1,
    borderColor: '#333333',
    position: 'absolute',
  },
});

export default ProfileImageExpander; 