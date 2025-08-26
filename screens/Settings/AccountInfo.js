import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import BackArrow from "../../components/backArrow";
import ProfileImageExpander from "../../components/ProfileImageExpander";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const AccountInfo = ({ navigation }) => {
  const [userData, setUserData] = useState(null); // Initialize as null
  const [imageUrl, setImageUrl] = useState(null); // Initialize as null for consistency
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const user = auth().currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (user) {
          const userDoc = await firestore()
            .collection("users")
            .doc(user.uid)
            .get();
          if (userDoc.exists) {
            setUserData(userDoc.data());
          }
        }
      } catch (error) {
        Alert.alert("Error", "Failed to fetch user data. Please try again.");
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      const fetchImage = async () => {
        try {
          const url = await storage()
            .ref(`profilePictures/${user.uid}.png`)
            .getDownloadURL();
          // Ensure the URL is a non-empty string before setting it
          if (typeof url === "string" && url.trim() !== "") {
            setImageUrl(url);
          } else {
            setImageUrl(null);
          }
        } catch (error) {
          setImageUrl(null); // Fallback to default image on error
        }
      };

      // Fetch image immediately
      fetchImage();

      // Set up interval to check for updates every 30 seconds
      const intervalId = setInterval(fetchImage, 10000);

      // Cleanup interval on component unmount or user change
      return () => clearInterval(intervalId);
    } else {
      setImageUrl(null);
    }
  }, [user]);

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    try {
      const storagePath = `profilePictures/${user.uid}.png`;
      const newUrl = await storage().ref(storagePath).getDownloadURL();
      if (typeof newUrl === "string" && newUrl.trim() !== "") {
        setImageUrl(newUrl);
      } else {
        setImageUrl(null);
      }
    } catch (error) {
      setImageUrl(null);
    }
  };

  if (!userData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackArrow />
          <Text style={[styles.accountInfo, styles.text]}>Account info</Text>
        </View>
        <View style={styles.profileImageContainer}>
          <ProfileImageExpander
            imageUrl={imageUrl}
            size={100}
            finalSize={300}
            borderRadius={50}
            style={styles.profileImage}
          />
          <TouchableOpacity
            style={styles.editIconContainer}
            onPress={handleEditPhoto}
            activeOpacity={0.7}
            accessibilityLabel="Edit Profile Picture"
          >
            <Icon name="pencil" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>
            {userData.email || "example@gmail.com"}
          </Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.phone || "1234567890"}</Text>
        </View>
        {/* Conditionally render the Rank field if the user is a deacon */}
        {userData.isDeacon && (
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>{userData.rank || "Deacon"}</Text>
          </View>
        )}
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.church || "Church 1"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.DOB || "Date of Birth"}</Text>
        </View>
        {/* Conditionally render the Children heading and list if children exist */}
        {userData.children && userData.children.length > 0 && (
          <>
            <Text style={[styles.childHeading, styles.text]}>Children</Text>
            {(userData.children || []).map((child, index) => (
              <TouchableOpacity
                key={index}
                style={styles.childInfo}
                onPress={() =>
                  navigation.navigate("ChildAccountInfo", {
                    childUid: child.uid,
                  })
                }
              >
                <Text style={styles.infoText}>
                  {child.name || `Child ${index + 1} First Last`}
                </Text>
                <Image
                  style={styles.vectorIcon}
                  resizeMode="cover"
                  source={require("../../assets/vector.png")}
                />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <PhotoInput
        visible={showPhotoModal}
        onClose={handlePhotoUpload}
        userId={user?.uid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollViewContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  accountInfo: {
    fontSize: 24,
    marginLeft: 16, // Creates spacing between the back arrow and the title
  },
  infoBlock: {
    backgroundColor: "#2e2e2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#fff",
  },
  childHeading: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 12,
  },
  childInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2e2e2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  vectorIcon: {
    width: 8,
    height: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#333333",
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 30,
    position: "relative",
  },
  editIconContainer: {
    position: "absolute",
    top: -5,
    right: "50%",
    marginRight: -55,
    backgroundColor: "#147efb",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 16,
    color: "#aaa",
  },
});

export default AccountInfo;