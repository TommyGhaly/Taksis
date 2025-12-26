import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Pressable, Image, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import storage from "@react-native-firebase/storage";

const HomeScreenNames = ({ role, user }) => {
  const [expand, setExpand] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user?.uid) {
      const fetchImage = async () => {
        try {
          const url = await storage().ref(`profilePictures/${user.uid}.png`).getDownloadURL();
          if (typeof url === "string" && url.trim() !== "") {
            setImageUrl(url);
          } else {
            setImageUrl(null);
          }
        } catch (error) {
          setImageUrl(null);
        }
      };

      fetchImage();
      const intervalId = setInterval(fetchImage, 10000);
      return () => clearInterval(intervalId);
    } else {
      setImageUrl(null);
    }
  }, [user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: expand ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: expand ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [expand]);

  const getIconName = () => {
    if (role === "Water") {
      return "water";
    } else if (role === "Wine") {
      return "wine";
    } else if (role === "Altar") {
      return "people";
    } else {
      return "book";
    }
  };

  const expandedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  return (
    <Pressable style={styles.card} onPress={() => setExpand(!expand)}>
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.expandedContent, { height: expandedHeight, opacity: opacityAnim }]}>
          <Image
            style={styles.profileImage}
            source={
              typeof imageUrl === "string" && imageUrl.trim() !== ""
                ? { uri: imageUrl }
                : require('../assets/default_profile.png')
            }
            defaultSource={require('../assets/default_profile.png')}
            onError={() => setImageUrl(null)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.row,
            {
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <Ionicons name={getIconName()} size={24} color="rgba(255,255,255,0.7)" style={styles.icon} />
          <Text style={styles.name}>
            {role}: {user?.name || "N/A"}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  contentContainer: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 10,
  },
  name: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  expandedContent: {
    alignItems: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginTop: 0,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 0,
    backgroundColor: "#3c3c3c",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    color: "#e0e0e0",
    fontSize: 14,
    textAlign: "center",
  },
});

export default HomeScreenNames;