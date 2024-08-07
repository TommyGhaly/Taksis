import * as React from "react";
import {Image, StyleSheet, Text, Pressable, View, TextInput} from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import {useNavigation, ParamListBase} from "@react-navigation/native";

const addName = () => {
  	const navigation = useNavigation();
    		
    		return (
      			<View style={styles.alertTextField}>
        				<Image style={styles.backgroundIcon} resizeMode="cover" source="Background.png" />
        				<Text style={styles.description}>{`Write first and last name of participant. `}</Text>
        				<Text style={[styles.title, styles.titleTypo]}>Add name</Text>
        				<View style={styles.bottomActions}>
          					<Pressable style={[styles.rightAction, styles.actionPosition]}>
            						<View style={[styles.topBorder, styles.topPosition]} />
            						<View style={[styles.label, styles.labelPosition1]}>
              							<Text style={[styles.label1, styles.labelPosition]}>Add</Text>
            						</View>
          					</Pressable>
          					<Pressable style={[styles.leftAction, styles.actionPosition]} onPress={() => navigation.goBack()}>
            						<View style={[styles.topBorder, styles.topPosition]} />
            						<View style={[styles.label2, styles.labelPosition1]}>
              							<Text style={[styles.label3, styles.labelPosition]}>Cancel</Text>
            						</View>
          					</Pressable>
          					<View style={[styles.separator, styles.fieldPosition]} />
          					<View style={[styles.topBorder2, styles.topPosition]} />
        				</View>
        				<View style={styles.textfield}>
          					<TextInput style={[styles.field, styles.fieldPosition]} />
          					<Text style={styles.placeholder}>Name</Text>
        				</View>
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			titleTypo: {
        				fontFamily: "Roboto-Bold",
        				fontWeight: "600"
      			},
      			actionPosition: {
        				width: "50%",
        				bottom: "0%",
        				top: "0%",
        				height: "100%",
        				position: "absolute"
      			},
      			topPosition: {
        				height: 1,
        				top: 0,
        				left: 0,
        				right: 0,
        				position: "absolute"
      			},
      			labelPosition1: {
        				bottom: "0%",
        				top: "0%",
        				height: "100%",
        				position: "absolute"
      			},
      			labelPosition: {
        				top: "50%",
        				marginTop: -11,
        				left: "50%",
        				lineHeight: 22,
        				fontSize: 17,
        				textAlign: "center",
        				color: "#fff",
        				position: "absolute"
      			},
      			fieldPosition: {
        				bottom: 0,
        				position: "absolute"
      			},
      			backgroundIcon: {
        				maxWidth: "100%",
        				maxHeight: "100%",
        				overflow: "hidden",
        				left: "0%",
        				bottom: "0%",
        				right: "0%",
        				top: "0%",
        				height: "100%",
        				position: "absolute",
        				width: "100%"
      			},
      			description: {
        				top: 43,
        				width: 236,
        				textAlign: "center",
        				color: "#fff",
        				fontFamily: "Roboto-Regular",
        				lineHeight: 18,
        				fontSize: 13,
        				left: 16,
        				position: "absolute"
      			},
      			title: {
        				top: 19,
        				lineHeight: 22,
        				fontSize: 17,
        				fontFamily: "Roboto-Bold",
        				fontWeight: "600",
        				width: 236,
        				textAlign: "center",
        				color: "#fff",
        				left: 16,
        				position: "absolute"
      			},
      			topBorder: {
        				backgroundColor: "rgba(84, 84, 88, 0.65)"
      			},
      			label1: {
        				marginLeft: -14.85,
        				fontFamily: "Roboto-Bold",
        				fontWeight: "600"
      			},
      			label: {
        				width: "32.61%",
        				right: "33.31%",
        				left: "34.07%"
      			},
      			rightAction: {
        				left: "50%",
        				width: "50%",
        				right: "0%"
      			},
      			label3: {
        				marginLeft: -25.85,
        				fontFamily: "Roboto-Regular"
      			},
      			label2: {
        				width: "31.12%",
        				right: "34.07%",
        				left: "34.81%"
      			},
      			leftAction: {
        				right: "50%",
        				left: "0%",
        				width: "50%"
      			},
      			separator: {
        				marginLeft: -0.5,
        				top: 1,
        				width: 1,
        				backgroundColor: "rgba(84, 84, 88, 0.65)",
        				left: "50%"
      			},
      			topBorder2: {
        				backgroundColor: "rgba(60, 60, 67, 0.36)"
      			},
      			bottomActions: {
        				bottom: 1,
        				height: 44,
        				left: 0,
        				right: 0,
        				position: "absolute"
      			},
      			field: {
        				borderRadius: 5,
        				backgroundColor: "#1c1c1e",
        				borderStyle: "solid",
        				borderColor: "rgba(84, 84, 88, 0.65)",
        				borderWidth: 0.5,
        				top: 0,
        				bottom: 0,
        				left: 0,
        				right: 0
      			},
      			placeholder: {
        				bottom: 4,
        				left: 5,
        				color: "rgba(235, 235, 245, 0.3)",
        				textAlign: "left",
        				width: 72,
        				fontFamily: "Roboto-Regular",
        				lineHeight: 18,
        				fontSize: 13,
        				position: "absolute"
      			},
      			textfield: {
        				right: 16,
        				bottom: 62,
        				height: 25,
        				left: 16,
        				overflow: "hidden",
        				position: "absolute"
      			},
      			alertTextField: {
        				flex: 1,
        				height: 178,
        				width: "100%"
      			}
    		});
    		
    		export default addName;
    		