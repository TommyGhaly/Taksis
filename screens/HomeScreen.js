import * as React from "react";
import {Image, StyleSheet, Text, View, Pressable, ScrollView, SafeAreaView, FlatList, TouchableOpacity} from "react-native";
import HomeScreenContent from "../components/homeScreenContent";
import WeekRequest from "../components/weekRequest";
const HomeScreen = () => {
  	let inputProps={
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
    }
  	return (
                <ScrollView style={styles.homescreen} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <HomeScreenContent props={inputProps}/>
                    </View>
                    <View style={styles.request}>
                        <WeekRequest/>
                    </View>
                    <View style={styles.blackspace}/>
                </ScrollView>);
};

const styles = StyleSheet.create({

    content: {
        left: "4.071%",
        width: "88.407%"
    },
    request: {
        top: "2%",
        left: "7.373%",
    },
    homescreen: {
        flex: 1,
        height: 852,
        width: "100%",
        marginTop: 60,
        backgroundColor: "#000"
    }
});

export default HomeScreen;
