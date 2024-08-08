import * as React from "react";
import {Image, StyleSheet, Text, View, Pressable, TouchableOpacity} from "react-native";

const DefaultSettings = () => {
  	
  	return (
    		<View style={styles.component1}>
      			<View style={[styles.rectangleParent, styles.childPosition]}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.firstLast, styles.settingsFlexBox]}>First Last</Text>
      			</View>
      			<Text style={[styles.account, styles.roleTypo]}>Account</Text>
      			<Text style={[styles.role, styles.roleTypo]}>Role</Text>
      			<Text style={[styles.children, styles.roleTypo]}>Children</Text>
      			<Text style={[styles.churchAdjustments, styles.roleTypo]}>Church Adjustments</Text>
      			<TouchableOpacity style={[styles.rectangleGroup, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change name</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</TouchableOpacity>
      			<TouchableOpacity style={[styles.rectangleContainer, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Account info</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</TouchableOpacity>
      			<Pressable style={[styles.groupPressable, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change age</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<Pressable style={[styles.rectangleParent1, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change deacon rank</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<Pressable style={[styles.rectangleParent2, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeChurchServices, styles.changePosition]}>Change church services that apply to you</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<View style={[styles.groupView, styles.groupParentPosition]}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change or add church</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</View>
      			<Pressable style={[styles.groupView, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change or add church</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<Pressable style={[styles.rectangleParent4, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change your children</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<TouchableOpacity style={[styles.groupTouchableopacity, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change church info</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</TouchableOpacity>
      			<TouchableOpacity style={[styles.rectangleParent5, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Add child</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</TouchableOpacity>
      			<Pressable style={[styles.rectangleParent6, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change child’s settings</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<Pressable style={[styles.rectangleParent7, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change email</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
      			<TouchableOpacity style={[styles.rectangleParent8, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change phone number</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</TouchableOpacity>
      			<Pressable style={[styles.rectangleParent9, styles.groupParentPosition]} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeName, styles.changePosition]}>Change password</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source={require("../assets/vector.png")} />
      			</Pressable>
    		</View>);
};

const styles = StyleSheet.create({
  	childPosition: {
    		left: "0%",
    		right: "0%",
    		width: "100%"
  	},
  	vectorIconLayout: {
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		position: "absolute"
  	},
  	settingsFlexBox: {
    		alignItems: "center",
    		display: "flex",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		position: "absolute"
  	},
  	roleTypo: {
    		fontSize: 16,
    		height: "3.24%",
    		width: "57.76%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		position: "absolute"
  	},
  	groupParentPosition: {
    		height: "3.68%",
    		left: "0%",
    		right: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	changePosition: {
    		top: "4%",
    		height: "88%",
    		fontSize: 16,
    		left: "9.16%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		position: "absolute"
  	},
  	groupChild: {
    		backgroundColor: "#1e1e1e",
    		bottom: "0%",
    		height: "100%",
    		right: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	firstLast: {
    		height: "84.21%",
    		width: "70.74%",
    		top: "7.37%",
    		fontSize: 36,
    		left: "9.16%"
  	},
  	rectangleParent: {
    		height: "13.97%",
    		top: "14.12%",
    		bottom: "71.91%",
    		position: "absolute"
  	},
  	account: {
    		top: "29.26%",
    		left: "9.16%"
  	},
  	role: {
    		top: "53.97%",
    		left: "8.65%"
  	},
  	children: {
    		top: "74.85%",
    		left: "9.16%"
  	},
  	churchAdjustments: {
    		top: "91.91%",
    		left: "8.65%"
  	},
  	changeName: {
    		width: "57.76%",
    		top: "4%",
    		height: "88%"
  	},
  	vectorIcon: {
    		height: "48%",
    		width: "1.53%",
    		top: "24%",
    		right: "3.05%",
    		bottom: "28%",
    		left: "95.42%"
  	},
  	rectangleGroup: {
    		top: "37.5%",
    		bottom: "58.82%"
  	},
  	rectangleContainer: {
    		top: "33.68%",
    		bottom: "62.65%"
  	},
  	groupPressable: {
    		top: "69.85%",
    		bottom: "26.47%"
  	},
  	rectangleParent1: {
    		top: "66.03%",
    		bottom: "30.29%"
  	},
  	changeChurchServices: {
    		width: "76.08%"
  	},
  	rectangleParent2: {
    		top: "62.21%",
    		bottom: "34.12%"
  	},
  	groupView: {
    		top: "58.38%",
    		bottom: "37.94%"
  	},
  	rectangleParent4: {
    		top: "79.26%",
    		bottom: "17.06%"
  	},
  	groupTouchableopacity: {
    		top: "96.32%",
    		bottom: "0%"
  	},
  	rectangleParent5: {
    		top: "83.09%",
    		bottom: "13.24%"
  	},
  	rectangleParent6: {
    		top: "86.91%",
    		bottom: "9.41%"
  	},
  	rectangleParent7: {
    		top: "41.32%",
    		bottom: "55%"
  	},
  	rectangleParent8: {
    		top: "45.15%",
    		bottom: "51.18%"
  	},
  	rectangleParent9: {
    		top: "48.97%",
    		bottom: "47.35%"
  	},
  	component1: {
    		flex: 1,
    		height: 680,
    		width: "100%"
  	}
});

export default DefaultSettings;
