import * as React from "react";
import { useState, useEffect } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const SettingsContent = () => {
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({
    name: ""
  });

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          if (userDoc.exists) {
            setUserRoles(userDoc.data());
          }
        }
      } catch (error) {
        console.error("Error fetching user roles: ", error);
      }
    };

    fetchUserRoles();
  }, []);
  return (
    <View style={styles.component1}>
      <View style={styles.attendancetitleWrapper}>
        <View style={[styles.attendancetitle, styles.groupChildPosition]}>
          <Image
            style={styles.attendancetitleChild}
            resizeMode="cover"
            source={require("../assets/Rectangle 17.png")}
          />
          <Text style={styles.settings}>Settings</Text>
        </View>
      </View>
      <View style={[styles.rectangleParent, styles.groupChildPosition]}>
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={styles.firstLast}>{userRoles.name}</Text>
      </View>
      <Text style={[styles.account, styles.roleTypo]}>Account</Text>
      <Text style={[styles.role, styles.roleTypo]}>Role</Text>
      <Text style={[styles.children, styles.roleTypo]}>Children</Text>
      <Text style={[styles.churchAdjustments, styles.roleTypo]}>
        Church Adjustments
      </Text>
      <TouchableOpacity
        style={[styles.rectangleGroup, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeName");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change name
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleContainer, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("AccountInfo");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Account info
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.groupPressable, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeAge");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change age
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent1, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeRank");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change deacon rank
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent2, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeRoles");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeChurchServices, styles.changePosition]}>
          Change church services that apply to you
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.groupView, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeChurch");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change church
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent4, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeChildren");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change your children
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.groupTouchableopacity, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("AddChild");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Add child
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent5, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("Settings");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change child’s settings
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent6, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeEmail");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change email
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent7, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangePhoneNumber");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change phone number
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent8, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangePassword");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change password
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent9, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("ChangeHeadAdmin");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Change head-admin
        </Text>
        <Image
          style={[styles.vectorIcon, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent10, styles.groupParentPosition]}
        activeOpacity={0.2}
        onPress={() => {
          navigation.navigate("RequestAdmin");
        }}
      >
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={[styles.changeName, styles.changePosition]}>
          Apply for admin
        </Text>
        <Image
          style={[styles.groupChild, styles.vectorIconLayout]}
          resizeMode="cover"
          source={require("../assets/Vector.png")}
        />
      </TouchableOpacity>
      <TouchableOpacity 
      style={[styles.signOut, styles.signoutlayout]}
      activeOpacity={0.2}
      onPress={() => auth().signOut()}>
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Text style={styles.signouttext}>
          Log out
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  groupChildPosition: {
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  roleTypo: {
    fontSize: 16,
    height: "3.24%",
    width: "57.76%",
    textAlign: "left",
    lineHeight: 22,
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  groupParentPosition: {
    height: "3.68%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  changePosition: {
    top: "4%",
    height: "88%",
    fontSize: 16,
    textAlign: "left",
    lineHeight: 22,
    left: "9.16%",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  vectorIconLayout: {
    left: "95.42%",
    right: "3.05%",
    width: "1.53%",
    height: "48%",
    maxHeight: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    position: "absolute",
  },
  attendancetitleChild: {
    borderRadius: 10,
    maxHeight: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    left: "0%",
    bottom: "0%",
    right: "0%",
    height: "100%",
    top: "0%",
    position: "absolute",
    width: "100%",
  },
  settings: {
    height: "60.56%",
    width: "91.43%",
    top: "19.72%",
    left: "4.29%",
    fontSize: 24,
    lineHeight: 40,
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  attendancetitle: {
    bottom: "0%",
    height: "100%",
    left: "0%",
    right: "0%",
    top: "0%",
  },
  attendancetitleWrapper: {
    height: "10.44%",
    width: "71.25%",
    right: "20.1%",
    bottom: "89.56%",
    left: 24,
    top: "0%",
    position: "absolute",
  },
  groupChild: {
    backgroundColor: "#1e1e1e",
    bottom: "0%",
    height: "100%",
    left: "0%",
    right: "0%",
    top: "0%",
  },
  firstLast: {
    height: "84.21%",
    width: "70.74%",
    top: "7.37%",
    fontSize: 36,
    textAlign: "left",
    lineHeight: 80,
    left: "9.16%",
    alignItems: "center",
    display: "flex",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  rectangleParent: {
    height: "13.97%",
    top: "14.12%",
    bottom: "71.91%",
    left: "0%",
    right: "0%",
  },
  account: {
    top: "29.26%",
    left: "9.16%",
    height: "3.24%",
  },
  role: {
    top: "53.97%",
    left: "8.65%",
  },
  children: {
    top: "74.85%",
    left: "9.16%",
    height: "3.24%",
  },
  churchAdjustments: {
    top: "91.91%",
    left: "8.65%",
  },
  changeName: {
    width: "57.76%",
    top: "4%",
    height: "88%",
  },
  vectorIcon: {
    top: "24%",
    bottom: "28%",
  },
  rectangleGroup: {
    top: "37.5%",
    bottom: "58.82%",
  },
  rectangleContainer: {
    top: "33.68%",
    bottom: "62.65%",
  },
  groupPressable: {
    top: "69.85%",
    bottom: "26.47%",
  },
  rectangleParent1: {
    top: "66.03%",
    bottom: "30.29%",
  },
  changeChurchServices: {
    width: "76.08%",
  },
  rectangleParent2: {
    top: "62.21%",
    bottom: "34.12%",
  },
  groupView: {
    top: "58.38%",
    bottom: "37.94%",
  },
  rectangleParent4: {
    top: "79.26%",
    bottom: "17.06%",
  },
  groupTouchableopacity: {
    top: "83.09%",
    bottom: "13.24%",
  },
  rectangleParent5: {
    top: "86.91%",
    bottom: "9.41%",
  },
  rectangleParent6: {
    top: "41.32%",
    bottom: "55%",
  },
  rectangleParent7: {
    top: "45.15%",
    bottom: "51.18%",
  },
  rectangleParent8: {
    top: "48.97%",
    bottom: "47.35%",
  },
  rectangleParent9: {
    top: "96.47%",
    bottom: "-0.15%",
  },
  vectorIcon14: {
    top: "20%",
    bottom: "32%",
  },
  rectangleParent10: {
    top: "100.29%",
    bottom: "-3.97%",
  },
  signOut: {
    top: "112.15%"
  },
  signOutsize:{
    height:50,
  },
  signoutlayout: {
      height: "7.68%",
      left: "0%",
      right: "0%",
      position: "absolute",
      width: "100%",
  },
  signouttext: {
    top: "25%",
    height: "88%",
    fontSize: 22,
    textAlign: "left",
    lineHeight: 22,
    left: "39.16%",
    color: "#ff000d",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  component1: {
    height: 680,
    width: "100%",
  },
});

export default SettingsContent;
