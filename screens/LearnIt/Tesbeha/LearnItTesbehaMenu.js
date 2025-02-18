import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  LayoutAnimation,
  UIManager,
  Platform,
  Animated,
} from "react-native";
import BackArrow from "../../../components/backArrow";
import InAppBrowser from "react-native-inappbrowser-reborn";
import hymnsData from "./Tesbeha.json";

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

const LearnItTesbehaMenu = () => {
  const [expanded, setExpanded] = useState(null);

  // Animated value for the header (title)
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Create an animated value for each hymnsData item
  const itemAnimValues = useRef(
    hymnsData.map(() => new Animated.Value(0))
  ).current;

  // Trigger animations on mount
  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true }),
      ...itemAnimValues.map((anim) =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true })
      ),
    ]).start();
  }, []);

  // Toggle submenu expansion
  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const renderItem = ({ item, index }) => {
    const isExpanded = expanded === item.id;

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
        <Pressable
          style={styles.button}
          onPress={() =>
            item.subOptions ? toggleExpand(item.id) : openUrl(item.url)
          }
        >
          <Text style={styles.buttonText}>{item.title}</Text>
        </Pressable>

        {/* Render suboptions if they exist */}
        {isExpanded && item.subOptions && (
          <View style={styles.expandedContainer}>
            {item.subOptions.map((subItem, subIndex) => (
              <Animated.View
                key={subItem.id}
                style={[
                  styles.subAnimatedItem,
                  {
                    opacity: itemAnimValues[subIndex % itemAnimValues.length],
                    transform: [
                      {
                        translateY: itemAnimValues[
                          subIndex % itemAnimValues.length
                        ].interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  style={styles.subButton}
                  onPress={() => openUrl(subItem.url)}
                >
                  <Text style={styles.subButtonText}>{subItem.title}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backbutton} />
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
        <Text style={styles.title}>Tesbeha</Text>
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

export default LearnItTesbehaMenu;
