import * as React from "react";
import {Pressable, StyleSheet, View, Text, Image, TouchableOpacity} from "react-native";

const Settings = () => {
  	
  	return (
    		<View style={styles.settings}>
      			<TouchableOpacity style={[styles.rectangleParent, styles.rectanglePosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change super-admin</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
      			</TouchableOpacity>
      			<TouchableOpacity style={[styles.rectangleGroup, styles.rectanglePosition]} activeOpacity={0.2} onPress={()=>{}}>
        				<View style={[styles.groupChild, styles.childPosition]} />
        				<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Apply for admin</Text>
        				<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
      			</TouchableOpacity>
      			<View style={[styles.component1, styles.rectanglePosition]}>
        				<View style={styles.attendancetitleWrapper}>
          					<View style={[styles.attendancetitle, styles.childPosition]}>
            						<Image style={[styles.attendancetitleChild, styles.vectorIconLayout]} resizeMode="cover" source="Rectangle 17.png" />
            						<Text style={[styles.settings1, styles.settings1FlexBox]}>Settings</Text>
          					</View>
        				</View>
        				<View style={[styles.rectangleContainer, styles.rectanglePosition]}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.firstLast, styles.settings1FlexBox]}>First Last</Text>
        				</View>
        				<Text style={[styles.account, styles.roleLayout]}>Account</Text>
        				<Text style={[styles.role, styles.roleLayout]}>Role</Text>
        				<Text style={[styles.children, styles.roleLayout]}>Children</Text>
        				<Text style={[styles.churchAdjustments, styles.roleLayout]}>Church Adjustments</Text>
        				<TouchableOpacity style={[styles.groupTouchableopacity, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change name</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</TouchableOpacity>
        				<TouchableOpacity style={[styles.rectangleParent1, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Account info</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</TouchableOpacity>
        				<Pressable style={[styles.groupPressable, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change age</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<Pressable style={[styles.rectangleParent2, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change deacon rank</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<Pressable style={[styles.rectangleParent3, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeChurchServices, styles.changeTypo]}>Change church services that apply to you</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<View style={[styles.groupView, styles.groupParentPosition]}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change or add church</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</View>
        				<Pressable style={[styles.groupView, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change or add church</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<Pressable style={[styles.rectangleParent5, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change your children</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<TouchableOpacity style={[styles.rectangleParent6, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change church info</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</TouchableOpacity>
        				<TouchableOpacity style={[styles.rectangleParent7, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Add child</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</TouchableOpacity>
        				<Pressable style={[styles.rectangleParent8, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change child’s settings</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<Pressable style={[styles.rectangleParent9, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change email</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
        				<TouchableOpacity style={[styles.rectangleParent10, styles.groupParentPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change phone number</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</TouchableOpacity>
        				<Pressable style={[styles.rectangleParent11, styles.groupParentPosition]} onPress={()=>{}}>
          					<View style={[styles.groupChild, styles.childPosition]} />
          					<Text style={[styles.changeSuperAdmin, styles.changeTypo]}>Change password</Text>
          					<Image style={[styles.vectorIcon, styles.vectorIconLayout]} resizeMode="cover" source="Vector.png" />
        				</Pressable>
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	rectanglePosition: {
    		left: "0%",
    		right: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	childPosition: {
    		height: "100%",
    		bottom: "0%",
    		top: "0%",
    		left: "0%",
    		right: "0%",
    		width: "100%"
  	},
  	changeTypo: {
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		fontSize: 16,
    		top: "4%",
    		height: "88%",
    		left: "9.16%",
    		position: "absolute"
  	},
  	vectorIconLayout: {
    		maxHeight: "100%",
    		overflow: "hidden",
    		maxWidth: "100%",
    		position: "absolute"
  	},
  	settings1FlexBox: {
    		alignItems: "center",
    		display: "flex",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		position: "absolute"
  	},
  	roleLayout: {
    		height: "3.24%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		fontSize: 16,
    		width: "57.76%",
    		position: "absolute"
  	},
  	groupParentPosition: {
    		height: "3.68%",
    		left: "0%",
    		right: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	groupChild: {
    		backgroundColor: "#1e1e1e",
    		bottom: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	changeSuperAdmin: {
    		width: "57.76%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		fontSize: 16,
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
  	rectangleParent: {
    		top: "93.08%",
    		bottom: "3.99%",
    		height: "2.93%",
    		right: "0%"
  	},
  	rectangleGroup: {
    		top: "96.13%",
    		bottom: "0.94%",
    		height: "2.93%",
    		right: "0%"
  	},
  	attendancetitleChild: {
    		borderRadius: 10,
    		bottom: "0%",
    		top: "0%",
    		height: "100%",
    		left: "0%",
    		right: "0%",
    		width: "100%"
  	},
  	settings1: {
    		height: "60.56%",
    		width: "91.43%",
    		top: "19.72%",
    		left: "4.29%",
    		fontSize: 24
  	},
  	attendancetitle: {
    		bottom: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	attendancetitleWrapper: {
    		height: "10.44%",
    		width: "71.25%",
    		right: "20.1%",
    		bottom: "89.56%",
    		left: "8.65%",
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
  	rectangleContainer: {
    		height: "13.97%",
    		top: "14.12%",
    		bottom: "71.91%"
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
  	groupTouchableopacity: {
    		top: "37.5%",
    		bottom: "58.82%"
  	},
  	rectangleParent1: {
    		top: "33.68%",
    		bottom: "62.65%"
  	},
  	groupPressable: {
    		top: "69.85%",
    		bottom: "26.47%"
  	},
  	rectangleParent2: {
    		top: "66.03%",
    		bottom: "30.29%"
  	},
  	changeChurchServices: {
    		width: "76.08%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		fontSize: 16,
    		top: "4%",
    		height: "88%"
  	},
  	rectangleParent3: {
    		top: "62.21%",
    		bottom: "34.12%"
  	},
  	groupView: {
    		top: "58.38%",
    		bottom: "37.94%"
  	},
  	rectangleParent5: {
    		top: "79.26%",
    		bottom: "17.06%"
  	},
  	rectangleParent6: {
    		top: "96.32%",
    		bottom: "0%"
  	},
  	rectangleParent7: {
    		top: "83.09%",
    		bottom: "13.24%"
  	},
  	rectangleParent8: {
    		top: "86.91%",
    		bottom: "9.41%"
  	},
  	rectangleParent9: {
    		top: "41.32%",
    		bottom: "55%"
  	},
  	rectangleParent10: {
    		top: "45.15%",
    		bottom: "51.18%"
  	},
  	rectangleParent11: {
    		top: "48.97%",
    		bottom: "47.35%"
  	},
  	component1: {
    		height: "79.81%",
    		top: "13.15%",
    		bottom: "7.04%"
  	},
  	settings: {
    		backgroundColor: "#000",
    		flex: 1,
    		height: 852,
    		width: "100%"
  	}
});

export default Settings;
