import React from "react";
import { Appearance, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { reportRenderError } from "../utils/crashReporter";
import { dark, light } from "../theme/palettes";

// This boundary wraps ThemeProvider (App.js), so useTheme isn't available —
// and a crash may have come from the provider itself. ThemeProvider pushes the
// user's appearance choice into Appearance.setColorScheme, so the native color
// scheme already reflects it once prefs have loaded.
function fallbackPalette() {
  try {
    return Appearance.getColorScheme() === "light" ? light : dark;
  } catch {
    return dark;
  }
}

// Without a boundary, an error thrown while rendering any screen unmounts the
// whole tree and the release app closes. This keeps the app open, reports
// where it happened (with the component stack), and offers a way back.
export default class CrashBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportRenderError(error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const styles = fallbackPalette().isDark ? darkStyles : lightStyles;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The problem has been reported. You can try again.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setState({ error: null })}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const buildStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: t.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    textAlign: "center",
    color: t.textMuted,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#8e8e93",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 17,
    color: "#000000",
  },
});

// Neutral gray button with black text reads in both modes, so it stays fixed.
const darkStyles = buildStyles(dark);
const lightStyles = buildStyles(light);
