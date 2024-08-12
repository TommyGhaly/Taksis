import * as React from "react";
import {Image, StyleSheet, Text, View, Pressable, ScrollView, TouchableOpacity} from "react-native";
import HomeScreenContent from "../components/homeScreenContent";

const HomeScreen = () => {
  	
  	return (
    		<View style={styles.homescreen}>
                <ScrollView>
                    <View style={styles.content}>
                        <HomeScreenContent></HomeScreenContent>
                    </View>
                </ScrollView>
            </View>);
};

const styles = StyleSheet.create({

    content: {
        top: "7.0422%",
        left: "4.071%",
        width: "88.407%"
    },
    homescreen: {
        flex: 1,
        height: 1852,
        width: "100%",
        backgroundColor: "#000"
    }
});

export default HomeScreen;
