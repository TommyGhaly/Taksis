import * as React from "react";
import {TextInput, StyleSheet} from "react-native";

const textInput = (placeHolder) => {
  	
  	return (
    		<TextInput style={styles.phoneOrEmail} placeholder={placeHolder} placeholderTextColor="#8e8e93" />);
};

const styles = StyleSheet.create({
  	phoneOrEmail: {
    		borderRadius: 10,
    		borderStyle: "solid",
    		borderColor: "#8e8e93",
    		borderWidth: 1,
    		flex: 1,
    		width: "100%",
    		height: 49,
    		flexDirection: "row",
    		alignItems: "center",
    		paddingHorizontal: 20,
    		paddingVertical: 15,
    		fontFamily: "Roboto-Regular",
    		fontSize: 17
  	}
});

export default textInput;
