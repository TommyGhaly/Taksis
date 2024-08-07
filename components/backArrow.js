import * as React from "react";
import {Pressable, Image, StyleSheet} from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import {useNavigation, ParamListBase} from "@react-navigation/native";

const backArrow = () => {
  	const navigation = useNavigation();
    		
    		return (
      			<Pressable style={styles.backarrow} onPress={() => navigation.goBack()}>
        				<Image style={styles.icon} resizeMode="cover" source={require("../assets/backArrow.png")} />
      			</Pressable>);
    		};
    		
    		const styles = StyleSheet.create({
      			icon: {
        				flex: 1,
        				height: "100%",
        				overflow: "hidden",
        				width: "100%"
      			},
      			backarrow: {
        				height: "2.8169%",
        				width: "100%"
      			}
    		});
    		
    		export default backArrow;
    		