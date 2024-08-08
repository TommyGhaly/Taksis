import * as React from "react";
import {StyleSheet, View, Image, Pressable, Text, TextInput} from "react-native";
import {ProgressBar, Button} from "react-native-paper";

const SelectChurch = () => {
    		
    		return (
      			<View style={styles.selectchurch}>
        				<View style={styles.component3}>
          					<View style={styles.searchResults}>
            						<View style={[styles.magnifyingGlasses, styles.magnifyingGlassesPosition]}>
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
        				</View>
        				<View style={styles.dontSeeYourChurchRegiste}>
          					<Pressable style={styles.magnifyingGlassesPosition} onPress={()=>{}}>
            						<Text style={styles.text}>
              							<Text style={styles.dontSeeYour}>{`Don’t see your church? `}</Text>
              							<Text style={styles.registerIt}>Register it</Text>
            						</Text>
          					</Pressable>
        				</View>
        				<View style={[styles.progressBar, styles.progressBarLayout]}>
          					<ProgressBar style={[styles.progressbar, styles.progressBarLayout]} progress={0.2} color="rgba(120, 120, 128, 0.32)" />
        				</View>
        				<Pressable style={styles.continuebutton} onPress={()=>{}}>
          					<Text style={styles.continue}>Continue</Text>
        				</Pressable>
        				<Button style={[styles.backarrow, styles.backarrowPosition]} mode="outlined" onPress={() => navigation.goBack()} contentStyle={styles.backArrowIconBtn} />
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			progressbar: {
        				backgroundColor: "#000",
        				width: "84.61%",
        				height: "3.29%"
      			},
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			magnifyingGlassesPosition: {
        				left: "0%",
        				top: "0%",
        				position: "absolute"
      			},
      			searchIconLayout: {
        				maxHeight: "100%",
        				maxWidth: "100%",
        				overflow: "hidden"
      			},
      			stmarkPosition: {
        				left: "10.18%",
        				height: "17.86%",
        				position: "absolute"
      			},
      			iconPosition: {
        				height: "100%",
        				maxHeight: "100%",
        				maxWidth: "100%",
        				left: "0%",
        				top: "0%",
        				bottom: "0%",
        				position: "absolute",
        				overflow: "hidden"
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
        				left: "10.03%",
        				right: "-0.15%",
        				width: "90.12%",
        				height: "0.71%",
        				borderStyle: "solid",
        				position: "absolute"
      			},
      			progressBarLayout: {
        				width: "84.61%",
        				height: "3.29%"
      			},
      			searchGlassIcon: {
        				bottom: "82.67%",
        				right: "0%",
        				height: "17.33%",
        				maxHeight: "100%",
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
        				bottom: "0.64%"
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
        				maxWidth: "100%",
        				overflow: "hidden"
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
        				height: "22.65%",
        				width: "90.33%",
        				top: "27.23%",
        				bottom: "50.12%",
        				left: "4.83%",
        				right: "4.83%",
        				position: "absolute"
      			},
      			dontSeeYour: {
        				color: "#8e8e93"
      			},
      			registerIt: {
        				color: "#6e85e3"
      			},
      			text: {
        				fontSize: 15,
        				letterSpacing: -0.1,
        				fontFamily: "Roboto-Regular",
        				textAlign: "center"
      			},
      			dontSeeYourChurchRegiste: {
        				top: 782,
        				left: 94,
        				width: 217,
        				height: 18,
        				position: "absolute"
      			},
      			progressBar: {
        				top: "8.45%",
        				right: "7.25%",
        				bottom: "88.26%",
        				left: "8.14%",
        				position: "absolute"
      			},
      			continue: {
        				fontSize: 17,
        				letterSpacing: -0.2,
        				fontWeight: "500",
        				fontFamily: "Roboto-Medium",
        				color: "#fff",
        				textAlign: "center"
      			},
      			continuebutton: {
        				height: "5.87%",
        				width: "91.09%",
        				top: "83.57%",
        				bottom: "10.56%",
        				borderRadius: 10,
        				backgroundColor: "#333",
        				borderColor: "rgba(0, 0, 0, 0.15)",
        				borderWidth: 1,
        				flexDirection: "row",
        				alignItems: "center",
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15,
        				borderStyle: "solid",
        				right: "4.83%",
        				left: "4.07%",
        				position: "absolute"
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				overflow: "hidden"
      			},
      			selectchurch: {
        				flex: 1,
        				height: 852,
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default SelectChurch;
    		