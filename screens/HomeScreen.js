import * as React from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from "react-native";
import HomeScreenContent from "../components/homeScreenContent";
import WeekRequest from "../components/weekRequest";
const HomeScreen = () => {
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
    nextRole: "Your Role Here",
  };
  return (
    <ScrollView style={styles.homescreen} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <HomeScreenContent props={inputProps} />
        <WeekRequest style={styles.request} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    top: 80,
    left: 26,
    width: 317,
  },
  request: {
    top: 59,
    height: 71,
    width: 280,
    left: 29,
  },
  homescreen: {
    flex: 1,
    height: 852,
    width: "100%",
    backgroundColor: "#000",
  },
});

export default HomeScreen;
