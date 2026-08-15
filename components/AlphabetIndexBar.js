import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const ALL_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const letterHeight = 16;
const barHeight = ALL_LETTERS.length * letterHeight;

export default function AlphabetIndexBar({ onLetterChange, availableLetters = [] }) {
  const lastLetterRef = useRef(null);
  // The PanResponder is built once, so its handlers would otherwise close over
  // the first render's props. Read the live values through refs instead.
  const availableLettersRef = useRef(availableLetters);
  const onLetterChangeRef = useRef(onLetterChange);
  availableLettersRef.current = availableLetters;
  onLetterChangeRef.current = onLetterChange;

  const getLetterFromY = (locationY) => {
    const index = Math.floor(locationY / letterHeight);
    if (index < 0 || index >= ALL_LETTERS.length) return null;
    return ALL_LETTERS[index];
  };

  const handleLetter = (letter) => {
    if (letter && letter !== lastLetterRef.current) {
      lastLetterRef.current = letter;
      // Haptic on every letter the finger lands on, even ones with no section,
      // so the press always feels registered. Only letters that actually have
      // people get to move the list.
      ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      if (availableLettersRef.current.includes(letter)) {
        onLetterChangeRef.current?.(letter);
      }
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