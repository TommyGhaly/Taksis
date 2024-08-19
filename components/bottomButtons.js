import React from "react";
import {Text, Image, Pressable, StyleSheet} from "react-native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import Attendence from "../screens/Attendence";
import Setting from "../screens/Setting"
import LearnItMainMenu from "../screens/LearnItMainMenu";
const Tab = createBottomTabNavigator();

const BottomButtons = ({screenList}) => {
    return (
        <Tab.Navigator >
            <Tab.Screen name="HomeScreen" component={HomeScreen}/>
            <Tab.Screen name="LearnItMainMenu" component={LearnItMainMenu}/>
            <Tab.Screen name="Settings" component={Setting}/>

        </Tab.Navigator>

    ); 
};

export default BottomButtons;