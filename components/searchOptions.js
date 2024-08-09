import * as React from "react";
import {Image, StyleSheet, View, Pressable, Text, TextInput} from "react-native";

const SearchOptions = () => {
  	
  	return (
    		<View style={styles.component3}>
      			<View style={styles.searchResults}>
        				<View style={styles.magnifyingGlasses}>
          					<Image style={[styles.searchGlassIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/SearchOptionsGlass.png")} />
          					<Image style={[styles.searchGlassIcon1, styles.iconLayout]} resizeMode="cover" source={require("../assets/SearchOptionsGlass.png")} />
          					<Image style={[styles.searchGlassIcon2, styles.iconLayout]} resizeMode="cover" source={require("../assets/SearchOptionsGlass.png")} />
        				</View>
        				<Pressable style={[styles.stmark, styles.stmarkPosition]}>
          					<Image style={[styles.stmarklogoIcon, styles.iconPosition]} resizeMode="cover" source={require("../assets/StMarkLogo.png")} />
          					<Text style={[styles.stMarkNatick, styles.andTypo]}>St. Mark, Natick, MA</Text>
        				</Pressable>
        				<Pressable style={[styles.stmaryArchaMich, styles.stmarkPosition]}>
          					<View style={[styles.stmaryArchaMichChild, styles.stmaryArchaMichChildPosition]} />
          					<Image style={[styles.stmaryarchamichlogoIcon, styles.stmaryArchaMichChildPosition]} resizeMode="cover" source={require("../assets/StMaryArchAMichLogo.png")} />
          					<Text style={[styles.stMaryAnd, styles.andTypo]}>St. Mary and Archangel Michael, Nashua, NH</Text>
        				</Pressable>
        				<Pressable style={[styles.stphiloStmina, styles.stmarkPosition]}>
          					<Image style={[styles.stphilostminalogoIcon, styles.iconPosition]} resizeMode="cover" source={require("../assets/StPhiloStMinaLogo.png")} />
          					<Text style={[styles.stPhilopaterAnd, styles.andTypo]}>St. Philopater and St Mina, Wayland, MA</Text>
        				</Pressable>
        				<View style={[styles.searchResultsChild, styles.searchPosition]} />
        				<View style={[styles.searchResultsItem, styles.searchPosition]} />
      			</View>
      			<View style={styles.rectangleParent}>
        				<View style={[styles.frameChild, styles.iconPosition]} />
						<TextInput style={styles.frameTextinput} placeholder="Search" placeholderTextColor="#8e8e93" />
						<Pressable>
							<Image style={[styles.searchGlassIcon3, styles.iconLayout]} resizeMode="cover" source={require("../assets/SearchBarGlass.png")} />
						</Pressable>
						<Pressable>
							<Image style={[styles.microphoneIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/Microphone.png")} />
						</Pressable>
        				<Image style={[styles.searchGlassIcon3, styles.iconLayout]} resizeMode="cover" source={require("../assets/SearchBarGlass.png")} />
        				<Image style={[styles.microphoneIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/Microphone.png")} />
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	iconLayout: {
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%"
  	},
  	stmarkPosition: {
    		left: "10.18%",
    		height: "17.86%",
    		position: "absolute"
  	},
  	iconPosition: {
    		height: "100%",
    		left: "0%",
    		top: "0%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	stmaryArchaMichChildPosition: {
    		right: "90.88%",
    		width: "9.12%",
    		height: "100%",
    		left: "0%",
    		top: "0%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	searchPosition: {
    		borderTopWidth: 1,
    		borderColor: "rgba(142, 142, 147, 0.5)",
    		borderStyle: "solid",
    		left: "10.03%",
    		right: "-0.15%",
    		width: "90.12%",
    		height: "0.71%",
    		position: "absolute"
  	},
  	searchGlassIcon: {
    		bottom: "82.67%",
    		right: "0%",
    		width: "100%",
    		height: "17.33%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute",
    		top: "0%"
  	},
  	searchGlassIcon1: {
    		top: "40.98%",
    		bottom: "41.7%",
    		right: "0%",
    		width: "100%",
    		height: "17.33%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute"
  	},
  	searchGlassIcon2: {
    		top: "82.67%",
    		right: "0%",
    		width: "100%",
    		height: "17.33%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute",
    		bottom: "0%"
  	},
  	magnifyingGlasses: {
    		height: "99.36%",
    		width: "7.19%",
    		right: "92.81%",
    		bottom: "0.64%",
    		left: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	stmarklogoIcon: {
    		width: "17.01%",
    		right: "82.99%",
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%"
  	},
  	stMarkNatick: {
    		left: "27.89%",
    		color: "rgba(142, 142, 147, 0.5)",
    		fontSize: 11,
    		top: "4%",
    		textAlign: "left",
    		fontFamily: "Inter-Regular",
    		lineHeight: 22
  	},
  	stmark: {
    		width: "44.01%",
    		top: "82.14%",
    		right: "45.81%",
    		bottom: "0%"
  	},
  	stmaryArchaMichChild: {
    		backgroundColor: "#fff"
  	},
  	stmaryarchamichlogoIcon: {
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%"
  	},
  	stMaryAnd: {
    		left: "14.96%",
    		color: "rgba(142, 142, 147, 0.5)",
    		fontSize: 11,
    		top: "4%",
    		textAlign: "left",
    		fontFamily: "Inter-Regular",
    		lineHeight: 22
  	},
  	stmaryArchaMich: {
    		width: "82.04%",
    		top: "40.71%",
    		right: "7.78%",
    		bottom: "41.43%"
  	},
  	stphilostminalogoIcon: {
    		width: "10%",
    		right: "90%",
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%"
  	},
  	stPhilopaterAnd: {
    		left: "16.4%",
    		color: "rgba(142, 142, 147, 0.5)",
    		fontSize: 11,
    		top: "4%",
    		textAlign: "left",
    		fontFamily: "Inter-Regular",
    		lineHeight: 22
  	},
  	stphiloStmina: {
    		width: "74.85%",
    		right: "14.97%",
    		bottom: "82.14%",
    		top: "0%"
  	},
  	searchResultsChild: {
    		top: "70.36%",
    		bottom: "28.93%"
  	},
  	searchResultsItem: {
    		top: "28.93%",
    		bottom: "70.36%"
  	},
  	searchResults: {
    		height: "72.54%",
    		width: "94.08%",
    		top: "27.46%",
    		right: "2.82%",
    		left: "3.1%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	frameChild: {
    		borderRadius: 8,
    		backgroundColor: "rgba(85, 85, 85, 0.33)",
    		right: "0%",
    		width: "100%"
  	},
  	searchGlassIcon3: {
    		height: "68.86%",
    		width: "6.76%",
    		top: "14.29%",
    		right: "91.55%",
    		bottom: "16.86%",
    		left: "1.69%",
    		position: "absolute"
  	},
  	microphoneIcon: {
    		top: "22.86%",
    		right: "2%",
    		bottom: "28.57%",
    		left: "94",
    		position: "absolute"
  	},
  	rectangleParent: {
    		top: 0,
    		left: 0,
    		width: 355,
    		height: 35,
    		position: "absolute"
  	},
  	component3: {
    		flex: 1,
    		height: 193,
    		width: "100%"
  	},
	  frameTextinput: {
		left: "10.211%",
		flex: 1,
		width: "100%",
		height: 15,
		fontFamily: "Inter-Regular",
		fontSize: 16,
		color: "#8e8e93"
	}
});

export default SearchOptions;
