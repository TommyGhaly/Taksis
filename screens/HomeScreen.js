import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
} from "react-native";
import auth from "@react-native-firebase/auth";
import { Button } from "react-native-paper";
import HomeScreenContent from "../components/homeScreenContent";
import WeekRequest from "../components/weekRequest";
import { useUser } from "../UserContext";

const HomeScreen = ({ route }) => {
  const { user } = useUser();

  let inputProps = {
    matins: "First Last",
    third: "First Last",
    sixth: "First Last",
    pauline: "First Last",
    catholic: "First Last",
    praxis: "First Last",
    gospel: "First Last",
    water: "First Last",
    wine: "First Last",
    alterServers: ["First Last", "First Last", "First Last", "First Last"],
    curDate: "MM/DD/YYYY",
    nextDate: "MM/DD/YYYY",
    nextRole: "Your Role Here"
  };
  
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.homescreen}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Button style={styles.signOut} mode="contained" onPress={() => auth().signOut()}>
          Sign Out
        </Button>
        <View style={styles.content}>
          <HomeScreenContent props={inputProps} />
        </View>
        <View style={styles.request}>
          <WeekRequest />
        </View>
      </ScrollView>
      <View style={styles.blackspace} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContainer: {
    paddingBottom: 1, // Add padding to ensure content is above the bottom tab
  },
  homescreen: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000",
    marginTop: 60,
  },
  content: {
    marginTop: 20,
    marginLeft: 26,
    width: 317,
  },
  request: {
    marginTop: 20,
    height: 90,
    width: 280,
    marginLeft: 29,
  },
  signOut: {
    marginTop: 10,
  },
  blackspace: {
    height: 0, // Adjust height to match the bottom tab height
  },
});

export default HomeScreen;