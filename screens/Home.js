import * as React from "react";
import {Image, StyleSheet, Text, View, Pressable, ScrollView, SafeAreaView, FlatList, TouchableOpacity} from "react-native";
import HomeScreenContent from "../components/homeScreenContent";

const HomeScreen = () => {
  	
  	return (
    		<ScrollView style={styles.homescreen} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <HomeScreenContent></HomeScreenContent>
                    </View>
            </ScrollView>);
};

const styles = StyleSheet.create({

    content: {
        left: "4.071%",
        width: "88.407%"
    },

    homescreen: {
        flex: 1,
        height: 852,
        width: "100%",
        marginTop: 60,
        marginBottom: 100,
        backgroundColor: "#000"
    }
});

export default HomeScreen;
