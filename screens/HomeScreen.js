import * as React from "react";
import { Image, StyleSheet, Text, View, Pressable, ScrollView, SafeAreaView, FlatList, TouchableOpacity } from "react-native";
import auth from '@react-native-firebase/auth';
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
    }
    return (
        <ScrollView style={styles.homescreen} showsVerticalScrollIndicator={false}>
            <Text style={{ color: "white", fontSize: 30, textAlign: "center", margin: 20 }}>Welcome, {user.displayName}</Text>
            <Button mode="contained" onPress={() => auth().signOut()}>Sign Out</Button>
            <View style={styles.content}>
                <HomeScreenContent props={inputProps} />
            </View>
            <View style={styles.request}>
                <WeekRequest />
            </View>
            <View style={styles.blackspace} />
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
