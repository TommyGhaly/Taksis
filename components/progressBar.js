import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const ProgressBar = ({ startPercentage, endPercentage }) => {
  const progressAnim = useRef(new Animated.Value(startPercentage)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: endPercentage,
      duration: 1000, // Duration of the animation
      useNativeDriver: false,
    }).start();
  }, [endPercentage]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.filled,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'], // Adjust to your layout
            }),
          },
        ]}
      />
      <View style={styles.track} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(120, 120, 128, 0.32)',
    borderRadius: 2,
    position: 'relative',
  },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(120, 120, 128, 0.32)',
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
  filled: {
    height: '100%',
    backgroundColor: '#147efb',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default ProgressBar;