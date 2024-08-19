import * as React from "react";
import {Image, StyleSheet, Text, View, Pressable} from "react-native";

const LearnItMainMenu = () => {
  	
  	return (
    		<View style={styles.learnitmainmenu}>
      			<View style={styles.attendancetitleWrapper}>
        				<View style={styles.attendancetitle}>
          					<Image style={[styles.attendancetitleChild, styles.childPosition]} resizeMode="cover" source="Rectangle 17.png" />
          					<Text style={styles.learnToServe}>Learn to Serve</Text>
        				</View>
      			</View>
      			<Pressable style={[styles.tesbeha, styles.tesbehaPosition]} onPress={()=>{}}>
        				<View style={[styles.tesbehaChild, styles.childPosition]} />
        				<Text style={[styles.midnightPraisesTesbeha, styles.liturgy1Typo]}>Midnight Praises (Tesbeha)</Text>
      			</Pressable>
      			<Pressable style={[styles.liturgy, styles.tesbehaPosition]} onPress={()=>{}}>
        				<View style={[styles.tesbehaChild, styles.childPosition]} />
        				<Text style={[styles.liturgy1, styles.liturgy1Typo]}>Liturgy</Text>
      			</Pressable>
      			<Pressable style={[styles.vespers, styles.tesbehaPosition]} onPress={()=>{}}>
        				<View style={[styles.tesbehaChild, styles.childPosition]} />
        				<Text style={[styles.vespersAshaya, styles.liturgy1Typo]}>Vespers (Ashaya)</Text>
      			</Pressable>
    		</View>);
};

const styles = StyleSheet.create({
  	childPosition: {
    		borderRadius: 10,
    		left: "0%",
    		bottom: "0%",
    		right: "0%",
    		top: "0%",
    		height: "100%",
    		position: "absolute",
    		width: "100%"
  	},
  	tesbehaPosition: {
    		left: "27.23%",
    		right: "26.97%",
    		width: "45.8%",
    		height: "10.56%",
    		position: "absolute"
  	},
  	liturgy1Typo: {
    		color: "#000",
    		justifyContent: "center",
    		alignItems: "center",
    		display: "flex",
    		textAlign: "center",
    		fontFamily: "Roboto-Bold",
    		fontWeight: "700",
    		lineHeight: 22,
    		fontSize: 24,
    		position: "absolute"
  	},
  	attendancetitleChild: {
    		maxWidth: "100%",
    		overflow: "hidden",
    		maxHeight: "100%"
  	},
  	learnToServe: {
    		height: "60.56%",
    		width: "91.43%",
    		top: "19.72%",
    		left: "4.29%",
    		color: "#8e8e93",
    		justifyContent: "center",
    		alignItems: "center",
    		display: "flex",
    		textAlign: "center",
    		fontFamily: "Roboto-Bold",
    		fontWeight: "700",
    		lineHeight: 22,
    		fontSize: 24,
    		position: "absolute"
  	},
  	attendancetitle: {
    		left: "0%",
    		bottom: "0%",
    		right: "0%",
    		top: "0%",
    		height: "100%",
    		position: "absolute",
    		width: "100%"
  	},
  	attendancetitleWrapper: {
    		height: "8.33%",
    		width: "71.25%",
    		top: "13.15%",
    		right: "20.1%",
    		bottom: "78.52%",
    		left: "8.65%",
    		position: "absolute"
  	},
  	tesbehaChild: {
    		backgroundColor: "#555"
  	},
  	midnightPraisesTesbeha: {
    		top: "16.67%",
    		left: "4.44%",
    		width: "90.56%",
    		color: "#000"
  	},
  	tesbeha: {
    		top: "42.61%",
    		bottom: "46.83%"
  	},
  	liturgy1: {
    		top: "41.11%",
    		left: "4.44%",
    		width: "90.56%",
    		color: "#000"
  	},
  	liturgy: {
    		top: "28.76%",
    		bottom: "60.68%"
  	},
  	vespersAshaya: {
    		width: "82.78%",
    		top: "25.56%",
    		left: "8.33%"
  	},
  	vespers: {
    		top: "56.46%",
    		bottom: "32.98%"
  	},
  	learnitmainmenu: {
    		backgroundColor: "#000",
    		flex: 1,
    		height: 852,
    		width: "100%"
  	}
});

export default LearnItMainMenu;
