import * as React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  Image,
  View,
  TextInput,
} from "react-native";
import { Button } from "react-native-paper";

const ChangeChurch = () => {
  return (
    <View style={styles.changechurch}>
      <Pressable
        style={styles.continuebutton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
      <Text style={styles.selectTheChurchs}>
        Select the church(s) you regularly attend
      </Text>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <View style={styles.component3}>
        <View style={styles.searchResults}>
          <View style={styles.magnifyingGlasses}>
            <Image
              style={[styles.searchGlassIcon, styles.iconLayout]}
              resizeMode="cover"
              source="Search glass.png"
            />
            <Image
              style={[styles.searchGlassIcon1, styles.iconLayout]}
              resizeMode="cover"
              source="Search glass.png"
            />
            <Image
              style={[styles.searchGlassIcon2, styles.iconLayout]}
              resizeMode="cover"
              source="Search glass.png"
            />
          </View>
          <Pressable style={[styles.stmark, styles.stmarkPosition]}>
            <Image
              style={[styles.stmarklogoIcon, styles.iconPosition]}
              resizeMode="cover"
              source="StMarkLogo.png"
            />
            <Text style={[styles.stMarkNatick, styles.andTypo]}>
              St. Mark, Natick, MA
            </Text>
          </Pressable>
          <Pressable style={[styles.stmaryArchaMich, styles.stmarkPosition]}>
            <View
              style={[
                styles.stmaryArchaMichChild,
                styles.stmaryArchaMichChildPosition,
              ]}
            />
            <Image
              style={[
                styles.stmaryarchamichlogoIcon,
                styles.stmaryArchaMichChildPosition,
              ]}
              resizeMode="cover"
              source="StMaryArchAMichLogo.png"
            />
            <Text style={[styles.stMaryAnd, styles.andTypo]}>
              St. Mary and Archangel Michael, Nashua, NH
            </Text>
          </Pressable>
          <Pressable style={[styles.stphiloStmina, styles.stmarkPosition]}>
            <Image
              style={[styles.stphilostminalogoIcon, styles.iconPosition]}
              resizeMode="cover"
              source="StPhiloStMinaLogo.png"
            />
            <Text style={[styles.stPhilopaterAnd, styles.andTypo]}>
              St. Philopater and St Mina, Wayland, MA
            </Text>
          </Pressable>
          <View style={[styles.searchResultsChild, styles.searchPosition]} />
          <View style={[styles.searchResultsItem, styles.searchPosition]} />
        </View>
        <View style={styles.frameParent}>
          <TextInput
            style={styles.frameChild}
            placeholder="Search"
            placeholderTextColor="#8e8e93"
          />
          <Image
            style={[styles.searchGlassIcon3, styles.iconLayout]}
            resizeMode="cover"
            source="Search glass.png"
          />
          <Image
            style={[styles.microphoneIcon, styles.iconLayout]}
            resizeMode="cover"
            source="microphone.png"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  iconLayout: {
    maxHeight: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  stmarkPosition: {
    left: "10.18%",
    height: "17.86%",
    position: "absolute",
  },
  iconPosition: {
    height: "100%",
    maxHeight: "100%",
    maxWidth: "100%",
    left: "0%",
    top: "0%",
    bottom: "0%",
    position: "absolute",
    overflow: "hidden",
  },
  andTypo: {
    color: "rgba(142, 142, 147, 0.5)",
    lineHeight: 22,
    fontSize: 11,
    top: "4%",
    fontFamily: "Inter-Regular",
    textAlign: "left",
    position: "absolute",
  },
  stmaryArchaMichChildPosition: {
    right: "90.88%",
    width: "9.12%",
    height: "100%",
    left: "0%",
    top: "0%",
    bottom: "0%",
    position: "absolute",
  },
  searchPosition: {
    borderTopWidth: 1,
    borderColor: "rgba(142, 142, 147, 0.5)",
    left: "10.03%",
    right: "-0.15%",
    width: "90.12%",
    height: "0.71%",
    borderStyle: "solid",
    position: "absolute",
  },
  continue: {
    fontSize: 17,
    letterSpacing: -0.2,
    color: "#fff",
    textAlign: "center",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  continuebutton: {
    height: "5.87%",
    width: "91.09%",
    top: "83.57%",
    bottom: "10.56%",
    borderRadius: 10,
    backgroundColor: "#333",
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
    borderStyle: "solid",
    left: "4.07%",
    right: "4.83%",
    position: "absolute",
  },
  selectTheChurchs: {
    height: "6.1%",
    width: "88.3%",
    top: "14.79%",
    fontSize: 34,
    letterSpacing: -0.3,
    color: "rgba(142, 142, 147, 0.8)",
    display: "flex",
    textAlign: "left",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
    alignItems: "center",
    left: "4.07%",
    position: "absolute",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  searchGlassIcon: {
    bottom: "82.67%",
    right: "0%",
    height: "17.33%",
    maxWidth: "100%",
    left: "0%",
    position: "absolute",
    width: "100%",
    top: "0%",
  },
  searchGlassIcon1: {
    top: "40.98%",
    bottom: "41.7%",
    right: "0%",
    height: "17.33%",
    maxWidth: "100%",
    left: "0%",
    position: "absolute",
    width: "100%",
  },
  searchGlassIcon2: {
    top: "82.67%",
    right: "0%",
    height: "17.33%",
    maxWidth: "100%",
    left: "0%",
    position: "absolute",
    width: "100%",
    bottom: "0%",
  },
  magnifyingGlasses: {
    height: "99.36%",
    width: "7.19%",
    right: "92.81%",
    bottom: "0.64%",
    left: "0%",
    top: "0%",
    position: "absolute",
  },
  stmarklogoIcon: {
    width: "17.01%",
    right: "82.99%",
  },
  stMarkNatick: {
    left: "27.89%",
  },
  stmark: {
    width: "44.01%",
    top: "82.14%",
    right: "45.81%",
    bottom: "0%",
  },
  stmaryArchaMichChild: {
    backgroundColor: "#fff",
  },
  stmaryarchamichlogoIcon: {
    maxHeight: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  stMaryAnd: {
    left: "14.96%",
  },
  stmaryArchaMich: {
    width: "82.04%",
    top: "40.71%",
    right: "7.78%",
    bottom: "41.43%",
  },
  stphilostminalogoIcon: {
    width: "10%",
    right: "90%",
  },
  stPhilopaterAnd: {
    left: "16.4%",
  },
  stphiloStmina: {
    width: "74.85%",
    right: "14.97%",
    bottom: "82.14%",
    top: "0%",
  },
  searchResultsChild: {
    top: "70.36%",
    bottom: "28.93%",
  },
  searchResultsItem: {
    top: "28.93%",
    bottom: "70.36%",
  },
  searchResults: {
    height: "72.54%",
    width: "94.08%",
    top: "27.46%",
    right: "2.82%",
    left: "3.1%",
    bottom: "0%",
    position: "absolute",
  },
  frameChild: {
    top: 6,
    left: 33,
    width: 54,
    height: 15,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    position: "absolute",
  },
  searchGlassIcon3: {
    height: "68.86%",
    width: "6.76%",
    top: "14.29%",
    right: "91.55%",
    bottom: "16.86%",
    left: "1.69%",
    position: "absolute",
  },
  microphoneIcon: {
    height: "48.57%",
    width: "2.82%",
    top: "22.86%",
    right: "2.96%",
    bottom: "28.57%",
    left: "94.23%",
    position: "absolute",
  },
  frameParent: {
    top: 0,
    left: 0,
    width: 355,
    height: 35,
    position: "absolute",
  },
  component3: {
    height: "22.65%",
    width: "90.33%",
    top: "27.23%",
    bottom: "50.12%",
    left: "4.83%",
    right: "4.83%",
    position: "absolute",
  },
  changechurch: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default ChangeChurch;
