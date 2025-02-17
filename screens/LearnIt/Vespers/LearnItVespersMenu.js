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
        name: "Stand up for prayer",
        url: "https://tasbeha.org/hymn_library/view/1909",
      },
      {
        name: "Let us pray",
        url: "https://tasbeha.org/hymn_library/view/1910",
      },
      {
        name: "Pray that God may have mercy",
        url: "https://tasbeha.org/hymn_library/view/1911",
      },
      {
        name: "Litany of the Departed",
        url: "https://tasbeha.org/hymn_library/view/1912",
      },
      {
        name: "Litany of the Sick",
        url: "https://tasbeha.org/hymn_library/view/1913",
      },
      {
        name: "Litany of the Travelers",
        url: "https://tasbeha.org/hymn_library/view/1914",
      },
      {
        name: "Pray for the Oblations",
        url: "https://tasbeha.org/hymn_library/view/1915",
      },
      {
        name: "Pray for the Holy Gospel",
        url: "https://tasbeha.org/hymn_library/view/1916",
      },
      {
        name: "Stand in the fear of God",
        url: "https://tasbeha.org/hymn_library/view/1917",
      },
      {
        name: "Litany of the Peace",
        url: "https://tasbeha.org/hymn_library/view/1918",
      },
      {
        name: "Litany of the Fathers",
        url: "https://tasbeha.org/hymn_library/view/1919",
      },
      {
        name: "Litany of the Place",
        url: "https://tasbeha.org/hymn_library/view/1920",
      },
      {
        name: "Litany of the Fruits, Waters, Plants",
        url: "https://tasbeha.org/hymn_library/view/1921",
      },
      {
        name: "Litany of the Congregation",
        url: "https://tasbeha.org/hymn_library/view/1922",
      },
      {
        name: "Bow your heads",
        url: "https://tasbeha.org/hymn_library/view/1923",
      },
      {
        name: "Let us attend in the fear of God",
        url: "https://tasbeha.org/hymn_library/view/1924",
      },
    ],
  },
  {
    id: "symbols",
    title: "Verses of the Symbols",
    subOptions: [
      {
        name: "Introduction of Adam Days",
        url: "https://tasbeha.org/hymn_library/view/48",
      },
      {
        name: "Introduction of Watos Days ",
        url: "https://tasbeha.org/hymn_library/view/49",
      },
      {
        name: "For the Intercessors",
        url: "https://tasbeha.org/hymn_library/view/50",
      },
      {
        name: "For the Apostles",
        url: "https://tasbeha.org/hymn_library/view/2588",
      },
      {
        name: "For the Martyrs",
        url: "https://tasbeha.org/hymn_library/view/2589",
      },
      {
        name: "For the Saints",
        url: "https://tasbeha.org/hymn_library/view/2590",
      },
      {
        name: "For the Fahers (Bishops)",
        url: "https://tasbeha.org/hymn_library/view/2591",
      },
      {
        name: "Annual Conclusion",
        url: "https://tasbeha.org/hymn_library/view/2592",
      },
    ],
  },
  {
    id: "doxology",
    title: "Doxology",
    subOptions: [
      {
        name: "Intro of the Doxologies",
        url: "https://tasbeha.org/hymn_library/view/439",
      },
      {
        name: "St. Mary Doxology (Vespers)",
        url: "https://tasbeha.org/hymn_library/view/24",
      },
      {
        name: "The Heavenly Orders Doxology",
        url: "https://tasbeha.org/hymn_library/view/419",
      },
      {
        name: "Archangel Michael Doxology",
        url: "https://tasbeha.org/hymn_library/view/418",
      },
      {
        name: "Archangel Gabriel Doxology",
        url: "https://tasbeha.org/hymn_library/view/1867",
      },
      {
        name: "Archangel Raphael Doxology",
        url: "https://tasbeha.org/hymn_library/view/1868",
      },
      {
        name: "Archangels Mikhail and Gabriel Watos Doxology",
        url: "https://tasbeha.org/hymn_library/view/2542",
      },
      {
        name: "Archangel Suriel Doxology",
        url: "https://tasbeha.org/hymn_library/view/1869",
      },
      {
        name: "The Four Creatures Doxology",
        url: "https://tasbeha.org/hymn_library/view/1870",
      },
      {
        name: "24 Presbyters Doxology",
        url: "https://tasbeha.org/hymn_library/view/1871",
      },
      {
        name: "144,000 Doxology",
        url: "https://tasbeha.org/hymn_library/view/1872",
      },
      {
        name: "St. John the Baptist - 1st",
        url: "https://tasbeha.org/hymn_library/view/421",
      },
      {
        name: "St. John the Baptist - 2nd",
        url: "https://tasbeha.org/hymn_library/view/1873",
      },
      {
        name: "Apostles Doxology - 1st",
        url: "https://tasbeha.org/hymn_library/view/422",
      },
      {
        name: "Apostles Doxology - 2nd",
        url: "https://tasbeha.org/hymn_library/view/437",
      },
      {
        name: "St. Mark Doxology - 1st",
        url: "https://tasbeha.org/hymn_library/view/420",
      },
      {
        name: "St. Mark Doxology - 2nd",
        url: "https://tasbeha.org/hymn_library/view/2027",
      },
      {
        name: "St. Peter & St. Paul Doxology",
        url: "https://tasbeha.org/hymn_library/view/1101",
      },
      {
        name: "St. John the Evangelist",
        url: "https://tasbeha.org/hymn_library/view/957",
      },
      {
        name: "Any Apostle Doxology",
        url: "https://tasbeha.org/hymn_library/view/1102",
      },
      {
        name: "St. Abanoub of Nehis",
        url: "https://tasbeha.org/hymn_library/view/2645",
      },
      {
        name: "St. Maurice",
        url: "https://tasbeha.org/hymn_library/view/2287",
      },
      {
        name: "St. Stephen",
        url: "https://tasbeha.org/hymn_library/view/1882",
      },
      {
        name: "St. George Doxology - 1st",
        url: "https://tasbeha.org/hymn_library/view/424",
      },
      {
        name: "St. George Doxology - 2nd",
        url: "https://tasbeha.org/hymn_library/view/2030",
      },
      {
        name: "St. Theodorus El-Shotbe - 1st",
        url: "https://tasbeha.org/hymn_library/view/1884",
      },
      {
        name: "St. Theodorus El-Shotbe - 2nd",
        url: "https://tasbeha.org/hymn_library/view/2031",
      },
      {
        name: "St. Theodorus El-Mashriqi",
        url: "https://tasbeha.org/hymn_library/view/1883",
      },
      {
        name: "St. Philopater Mercurius",
        url: "https://tasbeha.org/hymn_library/view/1880",
      },
      {
        name: "St. Mina Doxology - 1st",
        url: "https://tasbeha.org/hymn_library/view/1394",
      },
      {
        name: "St. Mina Doxology - 2nd",
        url: "https://tasbeha.org/hymn_library/view/2032",
      },
      {
        name: "Sts. Sergius & Bacchus",
        url: "https://tasbeha.org/hymn_library/view/1881",
      },
      {
        name: "Sts. Cosmas & Demian",
        url: "https://tasbeha.org/hymn_library/view/1885",
      },
      {
        name: "St. Sarapamon Doxology (Bishop of Nikiou)",
        url: "https://tasbeha.org/hymn_library/view/1876",
      },
      {
        name: "Sts. Abakir & John Doxology",
        url: "https://tasbeha.org/hymn_library/view/1875",
      },
      {
        name: "St. Victor Doxology",
        url: "https://tasbeha.org/hymn_library/view/1877",
      },
      {
        name: "All the Martyrs",
        url: "https://tasbeha.org/hymn_library/view/1276",
      },
      {
        name: "St. Demiana Doxology - 1st",
        url: "https://tasbeha.org/hymn_library/view/2029",
      },
      {
        name: "St. Demiana Doxology - 2nd (Glorification Hymn)",
        url: "https://tasbeha.org/hymn_library/view/2033",
      },
      {
        name: "Sts. Berbara & Juliana",
        url: "https://tasbeha.org/hymn_library/view/1878",
      },
      {
        name: "St. Marina (Martyr)",
        url: "https://tasbeha.org/hymn_library/view/1879",
      },
      {
        name: "Any Female Martyr Doxology",
        url: "https://tasbeha.org/hymn_library/view/2034",
      },
      {
        name: "Another Doxology for St. Macarius the Great",
        url: "https://tasbeha.org/hymn_library/view/2650",
      },
      {
        name: "Doxology for Saint Joseph",
        url: "https://tasbeha.org/hymn_library/view/2336",
      },
      {
        name: "Pope Kyrillos VI",
        url: "https://tasbeha.org/hymn_library/view/2654",
      },
      {
        name: "St. Arsenius Doxology",
        url: "https://tasbeha.org/hymn_library/view/2450",
      },
      {
        name: "Abba Antony",
        url: "https://tasbeha.org/hymn_library/view/1888",
      },
      {
        name: "Doxology for Saint Augustine",
        url: "https://tasbeha.org/hymn_library/view/2655",
      },
      {
        name: "Doxology for Abba Anthony & Abba Paul",
        url: "https://tasbeha.org/hymn_library/view/2648",
      },
      {
        name: "St. Paul the Hermit",
        url: "https://tasbeha.org/hymn_library/view/1898",
      },
      {
        name: "St. Macarius the Great - 1st",
        url: "https://tasbeha.org/hymn_library/view/1894",
      },
      {
        name: "St. Macarius the Alexandrian",
        url: "https://tasbeha.org/hymn_library/view/1893",
      },
      {
        name: "St. Macarius (Bishop of Edkow)",
        url: "https://tasbeha.org/hymn_library/view/1891",
      },
      {
        name: "St. Shenouda the Archimandrite",
        url: "https://tasbeha.org/hymn_library/view/1903",
      },
      {
        name: "St. John the Short",
        url: "https://tasbeha.org/hymn_library/view/1890",
      },
      {
        name: "Sts. Pishoy & Paul of Tammoh",
        url: "https://tasbeha.org/hymn_library/view/1899",
      },
      {
        name: "St. Pachomius and Theodore",
        url: "https://tasbeha.org/hymn_library/view/1896",
      },
      {
        name: "Sts. Maximus and Dometius",
        url: "https://tasbeha.org/hymn_library/view/1905",
      },
      {
        name: "Doxology for Abba Moses the Strong",
        url: "https://tasbeha.org/hymn_library/view/1895",
      },
      {
        name: "St. Samuel the Confessor",
        url: "https://tasbeha.org/hymn_library/view/1901",
      },
      {
        name: "St. John Kame",
        url: "https://tasbeha.org/hymn_library/view/1889",
      },
      {
        name: "St. Roweis (Teji)",
        url: "https://tasbeha.org/hymn_library/view/1900",
      },
      {
        name: "St. Parsoum the Naked",
        url: "https://tasbeha.org/hymn_library/view/1897",
      },
      {
        name: "St. Takla Haymanout",
        url: "https://tasbeha.org/hymn_library/view/1904",
      },
      {
        name: "The 3 Old Patriarchs",
        url: "https://tasbeha.org/hymn_library/view/1906",
      },
      {
        name: "St. Severus (Patriarch of Antioch)",
        url: "https://tasbeha.org/hymn_library/view/1902",
      },
      {
        name: "St. Abraam (Bishop of Fayoum)",
        url: "https://tasbeha.org/hymn_library/view/1886",
      },
      {
        name: "Conclusion of Doxologies",
        url: "https://tasbeha.org/hymn_library/view/423",
      },
    ],
  },
  {
    id: "fullService",
    title: "Full Service",
    subOptions: [
      {
        name: "The Thanksgiving Prayer",
        url: "https://tasbeha.org/hymn_library/view/1833",
      },
      {
        name: "The Litany for the Departed",
        url: "https://tasbeha.org/hymn_library/view/1834",
      },
      {
        name: "The Litany for the Sick",
        url: "https://tasbeha.org/hymn_library/view/1846",
      },
      {
        name: "The Litany for the Travelers",
        url: "https://tasbeha.org/hymn_library/view/1847",
      },
      {
        name: "The Litany for the Oblations",
        url: "https://tasbeha.org/hymn_library/view/6",
      },
      {
        name: "Graciously Oh Lord",
        url: "https://tasbeha.org/hymn_library/view/1835",
      },
      {
        name: "The Trisagion",
        url: "https://tasbeha.org/hymn_library/view/1836",
      },
      {
        name: "Hail to You - The Doxologies",
        url: "https://tasbeha.org/hymn_library/view/1850",
      },
      {
        name: "Introduction to the Creed",
        url: "https://tasbeha.org/hymn_library/view/1837",
      },
      {
        name: "The Orthodox Creed",
        url: "https://tasbeha.org/hymn_library/view/1852",
      },
      {
        name: "O God, have mercy upon us",
        url: "https://tasbeha.org/hymn_library/view/1840",
      },
      {
        name: "The Litany for the Gospel",
        url: "https://tasbeha.org/hymn_library/view/1842",
      },
      {
        name: "Another Litany for the Gospel",
        url: "https://tasbeha.org/hymn_library/view/2593",
      },
      {
        name: "The Psalm and Gospel",
        url: "https://tasbeha.org/hymn_library/view/1849",
      },
      {
        name: "The Gospel Response (Annual)",
        url: "https://tasbeha.org/hymn_library/view/1843",
      },
      {
        name: "The Five Short Litanies",
        url: "https://tasbeha.org/hymn_library/view/1844",
      },
      {
        name: "The Three Absolutions",
        url: "https://tasbeha.org/hymn_library/view/2594",
      },
      {
        name: "The Conclusion (Amen Alleluia)",
        url: "https://tasbeha.org/hymn_library/view/1853",
      },
      {
        name: "The Short Blessing",
        url: "https://tasbeha.org/hymn_library/view/1854",
      },
    ],
  },
];

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
