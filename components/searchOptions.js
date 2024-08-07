import * as React from "react";
import {Image, StyleSheet, View, Pressable, Text, TextInput} from "react-native";

const searchOptions = () => {
  	
  	return (
    		<View style={styles.component3}>
      			<View style={styles.searchResults}>
        				<View style={styles.magnifyingGlasses}>
          					<Image style={[styles.searchGlassIcon, styles.searchIconLayout]} resizeMode="cover" source="Search glass.png" />
          					<Image style={[styles.searchGlassIcon1, styles.searchIconLayout]} resizeMode="cover" source="Search glass.png" />
          					<Image style={[styles.searchGlassIcon2, styles.searchIconLayout]} resizeMode="cover" source="Search glass.png" />
        				</View>
        				<Pressable style={[styles.stmark, styles.stmarkPosition]}>
          					<Image style={[styles.stmarklogoIcon, styles.iconPosition]} resizeMode="cover" source="StMarkLogo.png" />
          					<Text style={[styles.stMarkNatick, styles.andTypo]}>St. Mark, Natick, MA</Text>
        				</Pressable>
        				<Pressable style={[styles.stmaryArchaMich, styles.stmarkPosition]}>
          					<View style={[styles.stmaryArchaMichChild, styles.stmaryArchaMichChildPosition]} />
          					<Image style={[styles.stmaryarchamichlogoIcon, styles.stmaryArchaMichChildPosition]} resizeMode="cover" source="StMaryArchAMichLogo.png" />
          					<Text style={[styles.stMaryAnd, styles.andTypo]}>St. Mary and Archangel Michael, Nashua, NH</Text>
        				</Pressable>
        				<Pressable style={[styles.stphiloStmina, styles.stmarkPosition]}>
          					<Image style={[styles.stphilostminalogoIcon, styles.iconPosition]} resizeMode="cover" source="StPhiloStMinaLogo.png" />
          					<Text style={[styles.stPhilopaterAnd, styles.andTypo]}>St. Philopater and St Mina, Wayland, MA</Text>
        				</Pressable>
        				<View style={[styles.searchResultsChild, styles.searchPosition]} />
        				<View style={[styles.searchResultsItem, styles.searchPosition]} />
      			</View>
      			<TextInput style={styles.searchbar} placeholder="Search" placeholderTextColor="#8e8e93" />
    		</View>);
};

const styles = StyleSheet.create({
  	searchIconLayout: {
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
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		top: "0%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	andTypo: {
    		textAlign: "left",
    		color: "rgba(142, 142, 147, 0.5)",
    		lineHeight: 22,
    		fontSize: 11,
    		top: "4%",
    		fontFamily: "Inter-Regular",
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
    		height: "17.33%",
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute",
    		width: "100%",
    		top: "0%"
  	},
  	searchGlassIcon1: {
    		top: "40.98%",
    		bottom: "41.7%",
    		right: "0%",
    		height: "17.33%",
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	searchGlassIcon2: {
    		top: "82.67%",
    		right: "0%",
    		height: "17.33%",
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		left: "0%",
    		position: "absolute",
    		width: "100%",
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
    		right: "82.99%"
  	},
  	stMarkNatick: {
    		left: "27.89%"
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
    		left: "14.96%"
  	},
  	stmaryArchaMich: {
    		width: "82.04%",
    		top: "40.71%",
    		right: "7.78%",
    		bottom: "41.43%"
  	},
  	stphilostminalogoIcon: {
    		width: "10%",
    		right: "90%"
  	},
  	stPhilopaterAnd: {
    		left: "16.4%"
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
  	searchbar: {
    		height: "18.13%",
    		bottom: "81.87%",
    		fontSize: 16,
    		fontFamily: "Inter-Regular",
    		right: "0%",
    		left: "0%",
    		top: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	component3: {
    		flex: 1,
    		height: 193,
    		width: "100%"
  	}
});

export default searchOptions;
