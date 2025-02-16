import * as React from "react";
import { Pressable, StyleSheet, View, Text, Animated } from "react-native";
import { SharedElement } from "react-navigation-shared-element";
import BackArrow from "../../../components/backArrow";

const LearnItLiturgyMenu = ({ navigation }) => {
  // Create an animated value for the header
  const headerAnim = React.useRef(new Animated.Value(0)).current;

  // Create animated values for the menu options
  const animatedValues = [1, 2, 3, 4, 5].map(() => new Animated.Value(0));

  React.useEffect(() => {
    Animated.stagger(150, [
      // Animate the header first...
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true }),
      // Then animate each menu option
      ...animatedValues.map(anim =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true })
      )
    ]).start();
  }, []);

  return (
    <View style={styles.learnitliturgymenu}>
      {/* Wrap header in an Animated.View and use headerAnim */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              }
            ],
            opacity: headerAnim
          }
        ]}
      >
        <Text style={styles.optionText}>Liturgy</Text>
      </Animated.View>

      {["Matins", "OfferingLamb", "LiturgyWord", "LiturgyFaithful", "Distribution"].map(
        (screen, index) => (
          <Animated.View
            key={screen}
            style={[
              styles.option,
              {
                transform: [
                  {
                    translateY: animatedValues[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    })
                  }
                ],
                opacity: animatedValues[index]
              }
            ]}
          >
            <Pressable onPress={() => navigation.navigate(screen)}>
              <Text style={styles.optionText}>
                {screen.replace(/([A-Z])/g, " $1").trim()}
              </Text>
            </Pressable>
          </Animated.View>
        )
      )}

      <View style={styles.backbutton}>
        <BackArrow />
      </View>
    </View>
  );
};

LearnItLiturgyMenu.sharedElements = () => ["liturgyBox"];

const styles = StyleSheet.create({
  learnitliturgymenu: {
    backgroundColor: "#121212",
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: "center",
    backgroundColor: "#2c2c2c",
    padding: 20,
    paddingLeft: 120,
    paddingRight: 120,
    borderRadius: 10,
    justifyContent: "center"
  },
  option: {
    width: "100%",
    height: 70,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8
  },
  optionText: {
    fontSize: 24,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 30
  },
  backbutton: {
    position: "absolute",
    top: 20,
    left: 20
  }
});

export default LearnItLiturgyMenu;
