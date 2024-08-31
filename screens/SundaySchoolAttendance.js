import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from "react-native";
import AttendenceList from "../components/attendenceList";
const SundaySchoolAttendence = () => {
  return (
    <ScrollView style={styles.attendence} showsVerticalScrollIndicator={false}>
      <View style={styles.attendancetitlePosition}>
        <Image
          style={styles.attendancetitleChild}
          resizeMode="cover"
          source={require("../assets/Rectangle 17.png")}
        />
        <Text style={styles.alhanAttendance}>Sunday School Attendence</Text>
      </View>
      <Pressable style={styles.addpersonParent} onPress={() => {}}>
        <Image resizeMode="cover" source={require("../assets/addPerson.png")} />
      </Pressable>
      <View style={styles.attendencelist}>
        <AttendenceList />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  attendencelist: {
    top: 100,
    height: "100%"
  },
  addpersonParent: {
    left: "89.31298%",
    top: 40,
  },
  alhanAttendance: {
    height: "52.11%",
    width: "82.5%",
    top: "30.94%",
    left: "14.758%",
    fontSize: 24,
    lineHeight: 24,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  attendancetitlePosition: {
    top: 20,
    position: "absolute",
    height: 71,
    width: 280,
  },
  attendancetitleChild: {
    left: "8.6514%",
  },
  attendence: {
    flex: 1,
    backgroundColor: "#000",
    height: "100%",
    width: "100%",
    marginTop: 60,
  },
});

export default SundaySchoolAttendence;
