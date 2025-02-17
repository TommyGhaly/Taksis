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

const hymnsData = [
  {
    id: "arise_children",
    title: "Arise O children of the Light",
    url: "https://tasbeha.org/hymn_library/view/1234",
  },
  {
    id: "hymn_resurrection",
    title: "The Hymn for the Resurrection",
    url: "https://tasbeha.org/hymn_library/view/1235",
  },
  {
    id: "first_hoos",
    title: "The First Hoos",
    url: "https://tasbeha.org/hymn_library/view/1237",
  },
  {
    id: "first_hoos_lobsh",
    title: "The First Hoos Lobsh",
    url: "https://tasbeha.org/hymn_library/view/1238",
  },
  {
    id: "second_hoos",
    title: "The Second Hoos",
    url: "https://tasbeha.org/hymn_library/view/1239",
  },
  {
    id: "second_hoos_lobsh",
    title: "The Second Hoos Lobsh",
    url: "https://tasbeha.org/hymn_library/view/1240",
  },
  {
    id: "third_hoos",
    title: "The Third Hoos",
    url: "https://tasbeha.org/hymn_library/view/1241",
  },
  {
    id: "psali_three_saints",
    title: "Psali for the Three Saintly Children",
    url: "https://tasbeha.org/hymn_library/view/1242",
  },
  {
    id: "we_follow_you",
    title: "We follow You",
    url: "https://tasbeha.org/hymn_library/view/1243",
  },
  {
    id: "commemoration_saints",
    title: "The Commemoration of Saints",
    url: "https://tasbeha.org/hymn_library/view/1286",
  },
  {
    id: "fourth_hoos",
    title: "The Fourth Hoos",
    url: "https://tasbeha.org/hymn_library/view/1244",
  },
  {
    id: "psali",
    title: "Sunday Psali",
    subOptions: [
      {
        id: "sunday_psali_mary",
        title: "Psali for St. Mary",
        url: "https://tasbeha.org/hymn_library/view/1245",
      },
      {
        id: "sunday_psali_jesus",
        title: "Psali for Jesus Christ",
        url: "https://tasbeha.org/hymn_library/view/1246",
      },
    ],
  },
  {
    id: "sunday_theotokia",
    title: "Sunday Theotokia",
    subOptions: [
      {
        id: "sunday_theotokia_1",
        title: "First Part",
        url: "https://tasbeha.org/hymn_library/view/1247",
      },
      {
        id: "sunday_theotokia_2",
        title: "Second Part",
        url: "https://tasbeha.org/hymn_library/view/1248",
      },
      {
        id: "sunday_theotokia_3",
        title: "Third Part",
        url: "https://tasbeha.org/hymn_library/view/1249",
      },
      {
        id: "sunday_theotokia_4",
        title: "Fourth Part",
        url: "https://tasbeha.org/hymn_library/view/1250",
      },
      {
        id: "sunday_theotokia_5",
        title: "Fifth Part",
        url: "https://tasbeha.org/hymn_library/view/1251",
      },
      {
        id: "sunday_theotokia_6",
        title: "Sixth Part",
        url: "https://tasbeha.org/hymn_library/view/1252",
      },
      {
        id: "gospel_luke_2_29_32",
        title: "The Gospel (Luke 2:29-32)",
        url: "https://tasbeha.org/hymn_library/view/1253",
      },
      {
        id: "sunday_theotokia_7",
        title: "Seventh Part (Hail to you Mary)",
        url: "https://tasbeha.org/hymn_library/view/1254",
      },
      {
        id: "sunday_theotokia_righteous",
        title: "You are called righteous",
        url: "https://tasbeha.org/hymn_library/view/1255",
      },
      {
        id: "sunday_theotokia_8_9",
        title: "Eighth & Ninth Part",
        url: "https://tasbeha.org/hymn_library/view/1256",
      },
      {
        id: "sunday_theotokia_10_15",
        title: "Tenth-Fifteenth Parts",
        url: "https://tasbeha.org/hymn_library/view/1257",
      },
      {
        id: "sunday_theotokia_16_18",
        title: "Sixteenth-Eighteenth Parts",
        url: "https://tasbeha.org/hymn_library/view/1258",
      },
      {
        id: "conclusion_adam_theotokias",
        title: "Conclusion of Adam Theotokias",
        url: "https://tasbeha.org/hymn_library/view/1259",
      },
    ],
  },
  {
    id: "litany",
    title: "The Litany",
    url: "https://tasbeha.org/hymn_library/view/1260",
  },
];

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
