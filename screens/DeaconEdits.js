import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import IndividualProfile from "../components/individualProfile";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  if (num % 1 === 0) {
    return num.toString();
  }
  return num.toFixed(2).replace(/\.?0+$/, "");
};

const DeaconEdits = () => {
  const [church, setChurch] = useState(null);
  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const sectionListRef = useRef(null);
  const [isListReady, setIsListReady] = useState(false);
  const indexBarRef = useRef(null);
  const [indexBarLayout, setIndexBarLayout] = useState({ height: 0, y: 0 });
  const [activeLetter, setActiveLetter] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(40);
  const [availableLetters, setAvailableLetters] = useState([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        handleIndexTouch(gestureState.y0);
      },
      onPanResponderMove: (evt, gestureState) => {
        handleIndexTouch(gestureState.moveY);
      },
      onPanResponderRelease: () => {
        setActiveLetter(null);
      },
      onPanResponderTerminate: () => {
        setActiveLetter(null);
      },
    })
  ).current;

  const handleIndexTouch = (touchY) => {
    if (!indexBarLayout.height || availableLetters.length === 0) return;
    const relativeY = touchY - indexBarLayout.y;
    const positionRatio = Math.max(
      0,
      Math.min(relativeY / indexBarLayout.height, 1)
    );
    const letterIndex = Math.floor(positionRatio * availableLetters.length);
    const clampedIndex = Math.min(
      Math.max(letterIndex, 0),
      availableLetters.length - 1
    );
    const letter = availableLetters[clampedIndex];
    setActiveLetter(letter);
    scrollToSection(letter);
  };

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      Alert.alert("Error", "No user authenticated.");
      return;
    }

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            setChurch(doc.data().church || null);
          }
          setLoading(false);
        },
        () => {
          setLoading(false);
          Alert.alert("Error", "Failed to fetch church data.");
        }
      );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!church) return;

    const fetchProfilePictureUrls = async () => {
      try {
        const doc = await firestore().collection("churches").doc(church).get();
        if (doc.exists) {
          const deaconList = doc.data().deacons || [];
          const urls = {};
          await Promise.all(
            deaconList.map(async (deacon) => {
              if (deacon.uid) {
                try {
                  const url = await storage()
                    .ref(`profilePictures/${deacon.uid}.png`)
                    .getDownloadURL();
                  urls[deacon.uid] =
                    typeof url === "string" && url.trim() ? url : null;
                } catch {
                  urls[deacon.uid] = null;
                }
              }
            })
          );
          setProfilePictureUrls(urls);
        }
      } catch {}
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    const unsubscribe = firestore()
      .collection("churches")
      .doc(church)
      .onSnapshot(
        async (doc) => {
          if (doc.exists) {
            const deaconList = doc.data().deacons || [];

            const sortedDeacons = deaconList
              .map((deacon) => ({
                ...deacon,
                name: (deacon.name || "").trim().toLowerCase(),
              }))
              .sort(
                (a, b) =>
                  a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid)
              )
              .map((deacon) => ({
                ...deacon,
                name:
                  doc.data().deacons.find((d) => d.uid === deacon.uid)?.name ||
                  "",
              }));

            const grouped = sortedDeacons.reduce((acc, deacon) => {
              const firstLetter =
                deacon.name.charAt(0).toUpperCase() || "Other";
              if (!acc[firstLetter]) acc[firstLetter] = [];
              acc[firstLetter].push(deacon);
              return acc;
            }, {});

            const sectionData = Object.keys(grouped)
              .sort()
              .map((letter) => ({ title: letter, data: grouped[letter] }));

            const letters = sectionData.map((section) => section.title).sort();

            setDeacons(sortedDeacons);
            setSections(sectionData);
            setAvailableLetters(letters);
          }
        },
        () => Alert.alert("Error", "Failed to fetch deacons.")
      );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [church]);

  const openEditModal = (deacon) => {
    if (!deacon?.uid) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedDeacon(deacon);
    setModalVisible(true);
  };

  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedDeacon(null);
  };

  const scrollToSection = (letter) => {
    if (
      !sectionListRef.current ||
      !availableLetters.includes(letter) ||
      !isListReady
    )
      return;
    const sectionIndex = sections.findIndex(
      (section) => section.title.toUpperCase() === letter.toUpperCase()
    );
    if (sectionIndex >= 0) {
      setTimeout(() => {
        try {
          sectionListRef.current.scrollToLocation({
            sectionIndex,
            itemIndex: 0,
            animated: true,
            viewPosition: 0,
            viewOffset: 0, // No offset to make the clicked section the dominant header
          });
          ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
        } catch {}
      }, 0);
    }
  };

  // In the panResponder onPanResponderMove, add smoothing behavior to avoid jumpy scrolling
  onPanResponderMove: (evt, gestureState) => {
    const now = Date.now();
    if (
      !panResponder.lastScrollTime ||
      now - panResponder.lastScrollTime > 20
    ) {
      handleIndexTouch(gestureState.moveY);
      panResponder.lastScrollTime = now;
    }
  },
    // Initialize lastScrollTime
    (panResponder.lastScrollTime = 0);

  const renderDeacon = ({ item }) => (
    <TouchableOpacity
      style={styles.deaconItem}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.deaconImageContainer}>
        <Image
          style={styles.deaconImage}
          source={
            item.uid && profilePictureUrls[item.uid]
              ? { uri: profilePictureUrls[item.uid] }
              : require("../assets/default_profile.png")
          }
          defaultSource={require("../assets/default_profile.png")}
          onError={() =>
            setProfilePictureUrls((prev) => ({ ...prev, [item.uid]: null }))
          }
        />
      </View>
      <View style={styles.deaconInfo}>
        <Text style={styles.deaconName}>{item.name || "Unknown"}</Text>
        <Text style={styles.deaconDetail}>Age: {formatNumber(item.age)}</Text>
        <Text style={styles.deaconDetail}>
          Phone: {item.number || "Not provided"}
        </Text>
        <Text style={styles.deaconDetail}>
          Experience: {formatNumber(item.experience)}
        </Text>
        <Text style={styles.deaconDetail}>
          Frequency: {formatNumber(item.frequency)}
        </Text>
      </View>
      <Ionicons name="pencil" size={20} color="#147efb" />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View
      style={styles.sectionHeader}
      onLayout={({ nativeEvent }) => {
        if (!headerHeight) setHeaderHeight(nativeEvent.layout.height);
      }}
    >
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <Text style={styles.noData}>No deacons found.</Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderDeacon}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.uid || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
            onLayout={() => setIsListReady(true)}
            getItemLayout={(data, index) => {
              const ITEM_HEIGHT = 120;
              const HEADER_HEIGHT = headerHeight;
              let offset = 0,
                currentIndex = 0;
              for (let i = 0; i < sections.length; i++) {
                offset += HEADER_HEIGHT;
                if (index < currentIndex + sections[i].data.length) {
                  offset += (index - currentIndex) * ITEM_HEIGHT;
                  break;
                }
                offset += sections[i].data.length * ITEM_HEIGHT;
                currentIndex += sections[i].data.length;
              }
              return { length: ITEM_HEIGHT, offset, index };
            }}
          />
          <View
            ref={indexBarRef}
            style={styles.indexBar}
            onLayout={(event) => setIndexBarLayout(event.nativeEvent.layout)}
            {...panResponder.panHandlers}
          >
            {availableLetters.map((letter) => (
              <TouchableOpacity
                key={letter}
                style={styles.indexItem}
                onPress={() => scrollToSection(letter)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <Text
                  style={[
                    styles.indexText,
                    activeLetter === letter && styles.activeIndexText,
                  ]}
                >
                  {letter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {selectedDeacon && (
        <IndividualProfile
          userId={selectedDeacon.uid}
          show={modalVisible}
          onClose={handleCancel}
          church={church}
          week=""
          family={true}
          url="https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#aaa",
  },
  deaconItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deaconImageContainer: {
    marginRight: 12,
  },
  deaconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  deaconInfo: {
    flex: 1,
  },
  deaconName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  deaconDetail: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  noData: {
    textAlign: "center",
    fontSize: 16,
    color: "#aaa",
    marginTop: 20,
  },
  sectionHeader: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    zIndex: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  indexBar: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginLeft: 4,
  },
  indexItem: {
    justifyContent: "center",
    alignItems: "center",
    height: 22,
    width: "100%",
    paddingVertical: 0,
  },
  indexText: {
    fontSize: 12,
    color: "#147efb",
    fontWeight: "600",
  },
  activeIndexText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default DeaconEdits;
