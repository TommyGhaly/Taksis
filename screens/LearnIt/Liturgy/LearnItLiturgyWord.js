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
    id: "deacon",
    title: "Deacon Responses",
    subOptions: [
      {
        name: "The Pauline Epistle",
        url: "https://tasbeha.org/hymn_library/view/1979",
      },
      {
        name: "The Catholic Epistle",
        url: "https://tasbeha.org/hymn_library/view/1980",
      },
      {
        name: "The Acts",
        url: "https://tasbeha.org/hymn_library/view/1981",
      },
    ],
  },
  {
    id: "full",
    title: "Full Service",
    subOptions: [
      {
        name: "Saved Amen - Sotees Amen",
        url: "https://tasbeha.org/hymn_library/view/1974",
      },
      {
        name: "Tay-shory",
        url: "https://tasbeha.org/hymn_library/view/675",
      },
      {
        name: "The golden censer (Tee-shory)",
        url: "https://tasbeha.org/hymn_library/view/76",
      },
      {
        name: "The Hymn of the Intercessions",
        url: "https://tasbeha.org/hymn_library/view/210",
      },
      {
        name: "Pi-ehmot Ghar",
        url: "https://tasbeha.org/hymn_library/view/320",
      },
      {
        name: "Pi-ehmot Ghar - Great",
        url: "https://tasbeha.org/hymn_library/view/318",
      },
      {
        name: "The Catholic Response - Apitjeek Evol",
        url: "https://tasbeha.org/hymn_library/view/435",
      },
      {
        name: "Praxis Response - Shere Maria",
        url: "https://tasbeha.org/hymn_library/view/322",
      },
      {
        name: "Another Praxis Response - Tote Alithos",
        url: "https://tasbeha.org/hymn_library/view/321",
      },
      {
        name: "The Hymn of the Trisagion",
        url: "https://tasbeha.org/hymn_library/view/325",
      },
      {
        name: "The Gospel Response - Ouneiato",
        url: "https://tasbeha.org/hymn_library/view/329",
      },
      {
        name: "The 3 Long Litanies",
        url: "https://tasbeha.org/hymn_library/view/1975",
      },
    ],
  },
];

const LearnItLiturgyWord = () => {
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
        <Text style={styles.title}>Litergy of the Word</Text>
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
    backgroundColor: "#1a1a1a",
    width: "100%",
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
    marginTop: 40,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
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
    marginBottom: 0,
  },
  buttonText: {
    fontSize: 22,
    color: "#ffffff",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#2c2c2c",
    paddingVertical: 25,
    width: "95%", // Ensures uniform size
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
    alignSelf: "center",
  },
  expandedContainer: {
    width: "90%",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignSelf: "center",
  },
  subButton: {
    backgroundColor: "#3a3a3a",
    paddingVertical: 15,
    width: "100%",
    borderRadius: 8,
    marginBottom: 15,
    alignItems: "center",
    alignSelf: "center",
  },
  subButtonText: {
    fontSize: 18,
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

export default LearnItLiturgyWord;
