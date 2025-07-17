import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const ALL_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const letterHeight = 16;
const barHeight = ALL_LETTERS.length * letterHeight;

export default function AlphabetIndexBar({ onLetterChange, availableLetters = [] }) {
  const lastLetterRef = useRef(null);

  const getLetterFromY = (locationY) => {
    const index = Math.floor(locationY / letterHeight);
    if (index < 0 || index >= ALL_LETTERS.length) return null;
    const letter = ALL_LETTERS[index];
    if (availableLetters.includes(letter)) return letter;
    // Find nearest available above, then below
    for (let i = index - 1; i >= 0; i--) {
      if (availableLetters.includes(ALL_LETTERS[i])) return ALL_LETTERS[i];
    }
    for (let i = index + 1; i < ALL_LETTERS.length; i++) {
      if (availableLetters.includes(ALL_LETTERS[i])) return ALL_LETTERS[i];
    }
    return null;
  };

  const handleLetter = (letter) => {
    if (letter && letter !== lastLetterRef.current) {
      lastLetterRef.current = letter;
      onLetterChange?.(letter);
      ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleLetter(getLetterFromY(evt.nativeEvent.locationY));
      },
      onPanResponderMove: (evt) => {
        handleLetter(getLetterFromY(evt.nativeEvent.locationY));
      },
      onPanResponderRelease: () => { lastLetterRef.current = null; },
      onPanResponderTerminate: () => { lastLetterRef.current = null; },
    })
  ).current;

  return (
    <View style={{ height: barHeight, width: 30, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-only"
        {...panResponder.panHandlers}
      />
      <View style={[styles.container, { height: barHeight, width: 30 }]}
        pointerEvents="none"
      >
        {ALL_LETTERS.map((letter, idx) => (
          <View key={letter} style={[styles.letterBox, { height: letterHeight }]}> 
            <Text style={styles.letter}>
              {letter}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: 30,
  },
  letterBox: {
    width: 26,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0,
  },
  letter: {
    fontSize: 11,
    color: '#147efb',
    fontWeight: '500',
  },
});

export { barHeight }; 