import * as React from "react";
import {Text, StyleSheet, Pressable, Image, View} from "react-native";

const LearnAlhan = () => {
  	
  	return (
    		<View style={styles.component7}>
      			<Text style={[styles.thisIsWhere, styles.thisTypo]}>{`This is where some english translation of whatever they are sayign will go `}</Text>
      			<Text style={[styles.thisIsWhere1, styles.thisTypo]}>{`This is where some English-coptic translation of whatever they are sayign will go `}</Text>
      			<Text style={[styles.thisIsWhere2, styles.thisTypo]}>{`This is where some coptic translation of whatever they are sayign will go `}</Text>
      			<Text style={[styles.englishAudio, styles.audioTypo]}>English Audio</Text>
      			<Text style={[styles.copticAudio, styles.audioTypo]}>Coptic Audio</Text>
      			<Image style={[styles.component7Child, styles.component7Layout]} resizeMode="cover" source="Frame 23516.png" />
      			<Image style={[styles.component7Item, styles.component7Layout]} resizeMode="cover" source="Frame 23517.png" />
    		</View>);
};

const styles = StyleSheet.create({
  	thisTypo: {
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Inter-Regular",
    		fontSize: 16,
    		top: "0%",
    		width: "29.28%",
    		position: "absolute"
  	},
  	audioTypo: {
    		textAlign: "center",
    		color: "#fff",
    		lineHeight: 22,
    		letterSpacing: 0,
    		fontSize: 17,
    		top: "87.91%",
    		fontFamily: "Inter-Regular",
    		position: "absolute"
  	},
  	component7Layout: {
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		bottom: "0%",
    		top: "86.05%",
    		width: "8.29%",
    		height: "13.95%",
    		position: "absolute"
  	},
  	thisIsWhere: {
    		left: "0%"
  	},
  	thisIsWhere1: {
    		left: "35.36%"
  	},
  	thisIsWhere2: {
    		left: "70.72%"
  	},
  	englishAudio: {
    		left: "6.63%"
  	},
  	copticAudio: {
    		left: "54.42%"
  	},
  	component7Child: {
    		right: "54.7%",
    		left: "37.02%"
  	},
  	component7Item: {
    		right: "6.35%",
    		left: "85.36%"
  	},
  	component7: {
    		flex: 1,
    		width: "100%",
    		height: 215
  	}
});

export default LearnAlhan;
