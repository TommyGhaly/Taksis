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
          setImageUrl(url);
        } catch (error) {
          setImageUrl(null); // Set to null on any error, including object-not-found
        }
      };
      fetchImage();
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
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.profileImage}
              defaultSource={require('../assets/default_profile.png')}
              onError={() => setImageUrl(null)}
            />
          ) : (
            <Image
              source={require('../assets/default_profile.png')}
              style={styles.profileImage}
            />
          )}
        </Animated.View>
        <Animated.View
          style={[
            styles.row,
            {
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <Ionicons name={getIconName()} size={24} color="#fff" style={styles.icon} />
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
    backgroundColor: "#2c2c2c",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
    color: "#e0e0e0",
  },
  expandedContent: {
    alignItems: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#333333',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 5,
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