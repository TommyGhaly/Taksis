import * as React from "react";
import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  LayoutAnimation,
  UIManager,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import BackArrow from "../../../components/backArrow";
import InAppBrowser from "react-native-inappbrowser-reborn";
import hymnsData from "./Vespers.json";
// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const openUrl = async (url) => {
  try {
    const isAvailable = await InAppBrowser.isAvailable();
    if (isAvailable) {
      await InAppBrowser.open(url, {
        dismissButtonStyle: "close",
        preferredBarTintColor: "#000",
        preferredControlTintColor: "white",
        readerMode: false,
        animated: true,
        modalPresentationStyle: "fullScreen",
        modalTransitionStyle: "coverVertical",
        modalEnabled: true,
        enableBarCollapsing: false,
        showTitle: false,
        enableUrlBarHiding: true,
        enableDefaultShare: true,
        forceCloseOnRedirection: false,
        headers: { "my-custom-header": "my-custom-header-value" },
      });
    } else {
      console.error("InAppBrowser is not available");
    }
  } catch (error) {
    console.error(error);
  }
};

const LearnItMatins = () => {
  const [expanded, setExpanded] = useState(null);

  // Animated value for the header (title)
  const headerAnim = React.useRef(new Animated.Value(0)).current;
  // Create an animated value for each hymnsData item
  const itemAnimValues = React.useRef(
    hymnsData.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    Animated.stagger(150, [
      // Animate header first
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      // Then animate each list item
      ...itemAnimValues.map((anim) =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true })
      ),
    ]).start();
  }, []);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const renderItem = ({ item, index }) => {
    // Calculate a max height for the sub-options container
    const scrollViewHeight = Math.min(50 * item.subOptions.length, 300);

    return (
      <Animated.View
        style={[
          styles.animatedItem,
          {
            transform: [
              {
                translateY: itemAnimValues[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            opacity: itemAnimValues[index],
          },
        ]}
      >
        <View>
          <Pressable
            style={styles.button}
            onPress={() => toggleExpand(item.id)}
          >
            <Text style={styles.buttonText}>{item.title}</Text>
          </Pressable>
          {expanded === item.id && (
            <ScrollView
              style={[
                styles.expandedContainer,
                { maxHeight: scrollViewHeight },
              ]}
              nestedScrollEnabled
            >
              {item.subOptions.map((sub, idx) => (
                <Pressable
                  key={idx}
                  style={styles.subButton}
                  onPress={() => openUrl(sub.url)}
                >
                  <Text style={styles.subButtonText}>{sub.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backbutton} />
      {/* Wrap the header in an Animated.View */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            opacity: headerAnim,
          },
        ]}
      >
        <Text style={styles.title}>Matins</Text>
      </Animated.View>
      <FlatList
        data={hymnsData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.buttonContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "flex-start",
  },
  titleContainer: {
    backgroundColor: "#2c2c2c", // Matching the header color from the first screen
    width: "80%",
    borderRadius: 12,
    paddingVertical: 20, // Smaller padding for a more compact title
    marginBottom: 30, // Adjusted for more consistent spacing
    marginTop: 20,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 24, // Smaller title size to match first screen
    fontWeight: "700", // Consistent font weight
    color: "#ffffff",
    textAlign: "center",
  },
  buttonContainer: {
    width: "90%",
    paddingBottom: 20,
    justifyContent: "center",
    alignContent: "center",
    alignSelf: "center",
  },
  animatedItem: {
    marginBottom: 20, // Adjusted for consistent spacing between items
  },
  buttonText: {
    fontSize: 22,
    color: "#ffffff",
    fontWeight: "700", // Matching the style of first screen
    textAlign: "center",
  },
  button: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 30, // Slightly smaller padding for consistent button sizes
    width: "100%", // Full width for uniform button size
    borderRadius: 12,
    marginBottom: 0,
    alignItems: "center",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  expandedContainer: {
    width: "100%", // Ensure suboption container takes full width
    backgroundColor: "#1a1a1a", // Match expanded section's background color
    borderRadius: 12, // Rounded corners
    padding: 10,
    marginBottom: 20,
    alignSelf: "center",
  },
  subButton: {
    backgroundColor: "#2a2a2a", // Match suboption button color
    paddingVertical: 15,
    width: "100%", // Stretch across
    borderRadius: 12, // Rounded corners
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  subButtonText: {
    fontSize: 18, // Consistent font size with suboptions
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    marginHorizontal: 5,
  },
  backbutton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
});

export default LearnItMatins;
