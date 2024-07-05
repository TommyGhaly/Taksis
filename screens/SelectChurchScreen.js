import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";

const SelectChruch = () => {
  	
  	return (
    		<View style={styles.selectchruch}>
      			<View style={styles.selectchruchChild} />
      			<View style={styles.progressBar}>
        				<View style={[styles.track, styles.trackPosition]}>
          					<View style={[styles.filled, styles.trackPosition]} />
        				</View>
      			</View>
      			<View style={[styles.selectchruchItem, styles.iconLayout]} />
      			<Image style={styles.chevronLeftIcon} resizeMode="cover" source={require("../assets/redArrowLeft.png")} />
      			<Text style={styles.selectYourChurch}>Select your church</Text>
      			<Image style={[styles.image1Icon, styles.iconLayout]} resizeMode="cover" source={require("../assets/St_Philo_St_Mina_Logo.png")} />
      			<Text style={[styles.stPhilopaterAnd, styles.andTypo]}>St. Philopater and St Mina, Wayland, MA</Text>
      			<Text style={[styles.stMaryAnd, styles.andTypo]}>St. Mary and Archangel Michael, Nashua, NH</Text>
      			<Text style={[styles.stMarkNatick, styles.andTypo]}>St. Mark, Natick, MA</Text>
      			<View style={[styles.selectchruchInner, styles.lineViewLayout]} />
      			<View style={[styles.lineView, styles.lineViewLayout]} />
      			<Image style={[styles.image2Icon, styles.iconLayout]} resizeMode="cover" source={require("../assets/St_Mary_ArchA_Mich_Logo.png")} />
      			<Image style={[styles.image3Icon, styles.iconLayout]} resizeMode="cover" source={require("../assets/St_Mark_Logo.png")} />
      			<Image style={styles.image4Icon} resizeMode="cover" source={require("../assets/SearchBar.png")} />
      			<Image style={[styles.screenshot20240705At247, styles.screenshot20240705Position]} resizeMode="cover" source={require("../assets/SearchIcon.png")} />
      			<Image style={[styles.screenshot20240705At2471, styles.screenshot20240705Position]} resizeMode="cover" source={require("../assets/SearchIcon.png")} />
      			<Image style={[styles.screenshot20240705At2472, styles.screenshot20240705Position]} resizeMode="cover" source={require("../assets/SearchIcon.png")} />
    		</View>);
};

const styles = StyleSheet.create({
  	trackPosition: {
    		height: 4,
    		marginTop: -2,
    		top: "50%",
    		position: "absolute"
  	},
  	iconLayout: {
    		height: 25,
    		width: 25,
    		left: 58,
    		position: "absolute"
  	},
  	andTypo: {
    		color: "#d24141",
    		fontFamily: "Inter-Regular",
    		lineHeight: 22,
    		fontSize: 11,
    		left: 99,
    		textAlign: "left",
    		position: "absolute"
  	},
  	lineViewLayout: {
    		height: 1,
    		width: 301,
    		borderTopWidth: 1,
    		borderColor: "rgba(210, 65, 65, 0.6)",
    		borderStyle: "solid",
    		left: 58,
    		position: "absolute"
  	},
  	screenshot20240705Position: {
    		left: 23,
    		height: 24,
    		width: 24,
    		position: "absolute"
  	},
  	selectchruchChild: {
    		top: 0,
    		left: 0,
    		width: 393,
    		backgroundColor: "#000",
    		position: "absolute",
    		height: 852
  	},
  	filled: {
    		width: "22.43%",
    		right: "77.57%",
    		left: "0%",
    		borderRadius: 100,
    		backgroundColor: "#aa0b0b"
  	},
  	track: {
    		right: 16,
    		backgroundColor: "rgba(120, 120, 128, 0.32)",
    		left: 16
  	},
  	progressBar: {
    		marginTop: -354,
    		width: "84.61%",
    		right: "5.98%",
    		left: "9.41%",
    		height: 28,
    		top: "50%",
    		backgroundColor: "#000",
    		position: "absolute"
  	},
  	selectchruchItem: {
    		top: 289,
    		backgroundColor: "#fff",
    		width: 25,
    		left: 58
  	},
  	chevronLeftIcon: {
    		top: 74,
    		height: 24,
    		width: 24,
    		left: 16,
    		position: "absolute",
    		overflow: "hidden"
  	},
  	selectYourChurch: {
    		top: 126,
    		fontSize: 34,
    		letterSpacing: -0.3,
    		fontWeight: "500",
    		fontFamily: "Roboto-Medium",
    		color: "rgba(255, 0, 0, 0.8)",
    		display: "flex",
    		alignItems: "center",
    		width: 288,
    		height: 52,
    		textAlign: "left",
    		left: 16,
    		position: "absolute"
  	},
  	image1Icon: {
    		top: 232
  	},
  	stPhilopaterAnd: {
    		top: 233
  	},
  	stMaryAnd: {
    		top: 290
  	},
  	stMarkNatick: {
    		top: 348
  	},
  	selectchruchInner: {
    		top: 273
  	},
  	lineView: {
    		top: 331
  	},
  	image2Icon: {
    		top: 289
  	},
  	image3Icon: {
    		top: 347
  	},
  	image4Icon: {
    		top: 169,
    		width: 358,
    		height: 50,
    		left: 16,
    		position: "absolute"
  	},
  	screenshot20240705At247: {
    		top: 347
  	},
  	screenshot20240705At2471: {
    		top: 289
  	},
  	screenshot20240705At2472: {
    		top: 232
  	},
  	selectchruch: {
    		borderRadius: 30,
    		flex: 1,
    		width: "100%",
    		overflow: "hidden",
    		height: 852,
    		backgroundColor: "#fff"
  	}
});

export default SelectChruch;
