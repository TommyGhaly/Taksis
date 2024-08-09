import * as React from "react";
import {Pressable, Text, StyleSheet} from "react-native";
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
//fix the navigation and add affect to button with oppacy
const ContinueButton = ({location},{text}) => {
    const navigation = useNavigationContainerRef(); 
  	return (
				<Pressable style={styles.continuebutton} onPress={()=>{navigation.navigate({location})}}>
					<NavigationContainer ref={navigation}></NavigationContainer>
					<Text style={styles.continue}>{text}</Text>
    			</Pressable>
	);
};

const styles = StyleSheet.create({
  	continue: {
    		fontSize: 17,
    		letterSpacing: -0.2,
    		fontWeight: "500",
    		fontFamily: "Roboto-Medium",
    		color: "#fff",
    		textAlign: "center"
  	},
  	continuebutton: {
    		borderRadius: 10,
    		backgroundColor: "#333",
    		borderStyle: "solid",
    		borderColor: "#333333",
    		borderWidth: 1,
    		width: 358,
    		height: 50,
    		flexDirection: "row",
    		alignItems: "center",
    		justifyContent: "center",
    		paddingHorizontal: 20,
    		paddingVertical: 15
  	}
});

export default ContinueButton;
