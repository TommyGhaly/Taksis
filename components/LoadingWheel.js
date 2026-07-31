/**
 * LoadingWheel — a plain centred spinner on the app background.
 *
 * For the app *shell*, where the incoming layout genuinely isn't known: App.js
 * while auth initialises, and MainContainer while roles resolve. Either one can
 * go on to render any screen in the app, so a shaped skeleton would be guessing,
 * and a full-screen grey shimmer block just reads as a broken screen.
 *
 * Inside a screen, prefer components/Skeleton — there the shape *is* known, and a
 * skeleton keeps the layout stable so content doesn't jump when it lands.
 */
import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

const LoadingWheel = React.memo(({ color = "#147efb", size = "large" }) => (
  <View style={styles.container}>
    <ActivityIndicator size={size} color={color} />
  </View>
));

LoadingWheel.displayName = "LoadingWheel";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default LoadingWheel;
