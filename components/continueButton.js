import * as React from "react";
import {Pressable, Text, StyleSheet} from "react-native";

const ContinueButton = (text, location) => {
    const navigation = useNavigation(); 
  	return (
    		<Pressable style={styles.continuebutton} onPress={()=>{navigation.navigate(location)}}>
      			<Text style={styles.continue}>{text}</Text>
    		</Pressable>);
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
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		borderWidth: 1,
    		flex: 1,
    		width: "100%",
    		height: 50,
    		flexDirection: "row",
    		alignItems: "center",
    		justifyContent: "center",
    		paddingHorizontal: 20,
    		paddingVertical: 15
  	}
});

export default ContinueButton;
