import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// All letters A-Z plus # at the end
const ALL_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

export default function AlphabetIndexBar({ onLetterChange, availableLetters = [] }) {
  const lastLetterRef = useRef(null);

  // Get screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Calculate component position and dimensions
  const letterHeight = 16; // Slightly smaller for tighter spacing
  const barHeight = ALL_LETTERS.length * letterHeight;
  const barTopOffset = 100; // Change this value to move the bar up or down
  const rightOffset = 10; // 10px from right edge
  const barWidth = 30;

  // Calculate letter positions based on screen size
  const getLetterPositions = () => {
    const positions = {};
    ALL_LETTERS.forEach((letter, index) => {
      const letterTop = barTopOffset + (index * letterHeight); // Use unified offset
      const letterBottom = letterTop + letterHeight;
      positions[letter] = {
        top: letterTop,
        bottom: letterBottom,
        index: index
      };
    });
    return positions;
  };

  // Helper to find the nearest available letter (preferring the letter above)
  const findNearestAvailableLetter = (targetLetter) => {
    if (availableLetters.includes(targetLetter)) {
      return targetLetter;
    }
    
    // Find the nearest available letter
    const targetIndex = ALL_LETTERS.indexOf(targetLetter);
    if (targetIndex === -1) return null;
    
    // Search upwards first (preferred)
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (availableLetters.includes(ALL_LETTERS[i])) {
        return ALL_LETTERS[i];
      }
    }
    
    // Then search downwards if nothing found above
    for (let i = targetIndex + 1; i < ALL_LETTERS.length; i++) {
      if (availableLetters.includes(ALL_LETTERS[i])) {
        return ALL_LETTERS[i];
      }
    }
    
    return null;
  };

  // Helper to get letter from Y position using hardcoded positions
  const getLetterFromY = (pageY) => {
    const letterPositions = getLetterPositions();
    console.log('PageY:', pageY, 'pageY - 180:', pageY - 210);
    console.log('Available letters:', availableLetters);
    
    // Find which letter's position range contains this Y coordinate
    for (let i = 0; i < ALL_LETTERS.length; i++) {
      const letter = ALL_LETTERS[i];
      const position = letterPositions[letter];
      
      if (position && pageY - 172 >= position.top && pageY - 172 <= position.bottom) {
        const nearestLetter = findNearestAvailableLetter(letter);
        console.log('Touch in range of letter:', letter, 'position:', position, 'nearest:', nearestLetter);
        return nearestLetter;
      }
    }
    
    console.log('Touch not in any letter range');
    return null;
  };

  const handleLetter = (letter) => {
    if (letter && letter !== lastLetterRef.current) {
      console.log('Letter touched:', letter); // Debug log
      lastLetterRef.current = letter;
      if (onLetterChange) {
        console.log('Calling onLetterChange with:', letter); // Debug log
        onLetterChange(letter);
      }
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        console.log('PanResponder Grant triggered'); // Debug log
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        handleLetter(letter);
      },
      onPanResponderMove: (evt) => {
        console.log('PanResponder Move triggered'); // Debug log
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        handleLetter(letter);
      },
      onPanResponderRelease: () => {
        console.log('PanResponder Release'); // Debug log
        lastLetterRef.current = null;
      },
      onPanResponderTerminate: () => {
        console.log('PanResponder Terminate'); // Debug log
        lastLetterRef.current = null;
      },
    })
  ).current;

  return (
    <>
      {/* Invisible touch area positioned flush to parent */}
      <View
        style={[styles.touchArea, { 
          height: barHeight, 
          right: rightOffset,
          position: 'absolute',
          top: 0, // flush to parent
        }]}
        {...panResponder.panHandlers}
      />
      
      {/* Visual letters */}
      <View
        style={[styles.container, { height: barHeight, right: rightOffset, position: 'absolute', top: 0 }]}
      >
        {ALL_LETTERS.map((letter, index) => (
          <View
            key={letter}
            style={[styles.letterBox, { height: letterHeight }]}
          >
            <Text style={styles.letter}>
              {letter}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 30, // Increased width for better touch area
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'flex-start', // Changed to flex-start to align letters from top
  },
  touchArea: {
    position: 'absolute',
    top: 200,
    width: 30,
    zIndex: 101, // Higher than visual container
    backgroundColor: 'transparent', // Invisible
  },
  letterBox: {
    width: 26, // Increased width
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