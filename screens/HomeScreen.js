import * as React from "react";
import {StyleSheet, View, Text, Image} from "react-native";

const HomeScreen = () => {
  	
  	return (
    		<View style={styles.homescreen}>
      			<View style={styles.homescreenChild} />
      			<Text style={styles.thisWeeksService}>Services</Text>
      			<View style={[styles.homescreenItem, styles.homescreenLayout]} />
      			<View style={[styles.homescreenInner, styles.homescreenLayout]} />
      			<Text style={[styles.sun, styles.sunTypo]}>SUN</Text>
      			<View style={[styles.rectangleView, styles.homescreenLayout]} />
      			<View style={[styles.homescreenChild1, styles.homescreenLayout]} />
      			<View style={styles.frameView}>
        				<View style={styles.frameChild} />
      			</View>
      			<Image style={styles.image1Icon} resizeMode="cover" source="redCopticCross.png" />
      			<Text style={[styles.sun1, styles.sun1Typo]}>SUN</Text>
      			<Text style={[styles.sun2, styles.sunTypo]}>SUN</Text>
      			<Text style={[styles.sun3, styles.sunTypo]}>SUN</Text>
      			<Text style={[styles.jun7, styles.sun1Typo]}>JUN 7</Text>
      			<Text style={[styles.jun21, styles.junTypo]}>JUN 21</Text>
      			<Text style={[styles.jun29, styles.junTypo]}>JUN 29</Text>
      			<Text style={[styles.jun14, styles.junTypo]}>JUN 14</Text>
      			<Text style={[styles.liturgy, styles.liturgyTypo]}>Liturgy</Text>
      			<Text style={[styles.liturgy1, styles.liturgyTypo]}>Liturgy</Text>
      			<Text style={[styles.liturgy2, styles.liturgyTypo]}>Liturgy</Text>
      			<Image style={[styles.rectangleIcon, styles.rectangleIconLayout]} resizeMode="cover" source="redRectangle.png" />
      			<Image style={[styles.homescreenChild2, styles.homescreenChildLayout1]} resizeMode="cover" source="redRectangle.png" />
      			<Image style={[styles.homescreenChild3, styles.homescreenChildLayout]} resizeMode="cover" source="redRectangle.png" />
      			<Image style={[styles.homescreenChild4, styles.rectangleIconLayout]} resizeMode="cover" source="greenRectangle" />
      			<Image style={[styles.homescreenChild5, styles.homescreenChildLayout]} resizeMode="cover" source="greenRectangle.png" />
      			<Image style={[styles.homescreenChild6, styles.homescreenChildLayout1]} resizeMode="cover" source="greenRectangle.png" />
      			<Text style={[styles.available, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.available1, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.available2, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.notAvailable, styles.notTypo]}>Not Available</Text>
      			<Text style={[styles.notAvailable1, styles.notTypo]}>Not Available</Text>
      			<Text style={[styles.notAvailable2, styles.notTypo]}>Not Available</Text>
      			<View style={styles.homeoutlineParent}>
        				<Image style={styles.iconLayout} resizeMode="cover" source="HomeOutline.png" />
        				<Image style={[styles.useroutlineIcon, styles.iconLayout]} resizeMode="cover" source="UserOutline.png" />
        				<Image style={[styles.useroutlineIcon, styles.iconLayout]} resizeMode="cover" source="PlusCircleOutline.png" />
        				<Image style={[styles.useroutlineIcon, styles.iconLayout]} resizeMode="cover" source="ChartPieOutline.png" />
        				<Image style={[styles.useroutlineIcon, styles.iconLayout]} resizeMode="cover" source="CogOutline.png" />
      			</View>
      			<View style={styles.lineView} />
    		</View>);
};

const styles = StyleSheet.create({
	homescreenLayout: {
	height: 150,
	backgroundColor: "#2a2c34",
	borderRadius: 25,
	left: 16,
	width: 358,
	position: "absolute"
	},
	sunTypo: {
	width: 166,
	fontFamily: "Inter-Black",
	fontWeight: "900",
	letterSpacing: -1.9,
	fontSize: 48,
	height: 100,
	textAlign: "left",
	color: "#ff0000",
	position: "absolute"
	},
	sun1Typo: {
	top: 182,
	height: 100,
	width: 166,
	fontFamily: "Inter-Black",
	fontWeight: "900",
	letterSpacing: -1.9,
	fontSize: 48,
	textAlign: "left",
	color: "#ff0000",
	position: "absolute"
	},
	junTypo: {
	left: 200,
	height: 100,
	width: 166,
	fontFamily: "Inter-Black",
	fontWeight: "900",
	letterSpacing: -1.9,
	fontSize: 48,
	textAlign: "left",
	color: "#ff0000",
	position: "absolute"
	},
	liturgyTypo: {
	width: 193,
	display: "flex",
	textAlign: "center",
	letterSpacing: -0.8,
	fontSize: 20,
	left: 90,
	justifyContent: "center",
	alignItems: "center",
	fontFamily: "Inter-Black",
	fontWeight: "900",
	color: "#ff0000",
	height: 50,
	position: "absolute"
	},
	rectangleIconLayout: {
	height: 38,
	width: 135,
	borderRadius: 20,
	position: "absolute"
	},
	homescreenChildLayout1: {
	top: 614,
	height: 38,
	width: 135,
	borderRadius: 20,
	position: "absolute"
	},
	homescreenChildLayout: {
	top: 447,
	height: 38,
	width: 135,
	borderRadius: 20,
	position: "absolute"
	},
	availableTypo: {
	height: 98,
	width: 141,
	color: "#fff",
	justifyContent: "center",
	display: "flex",
	textAlign: "center",
	letterSpacing: -0.8,
	fontSize: 20,
	alignItems: "center",
	fontFamily: "Inter-Black",
	fontWeight: "900",
	position: "absolute"
	},
	notTypo: {
	left: 35,
	color: "#fff",
	textAlign: "center",
	letterSpacing: -0.8,
	fontSize: 20,
	fontFamily: "Inter-Black",
	fontWeight: "900",
	position: "absolute"
	},
	iconLayout: {
	height: 24,
	width: 24,
	overflow: "hidden"
	},
	homescreenChild: {
	top: 112,
	left: 115,
	height: 50,
	width: 358,
	position: "absolute"
	},
	thisWeeksService: {
	height: "4.23%",
	width: "74.62%",
	top: "9.48%",
	left: "3.08%",
	fontSize: 34,
	letterSpacing: -0.3,
	fontWeight: "500",
	fontFamily: "Roboto-Medium",
	textAlign: "left",
	color: "#ff0000",
	position: "absolute"
	},
	homescreenItem: {
	top: 176
	},
	homescreenInner: {
	top: 344
	},
	sun: {
	top: 347,
	height: 100,
	left: 29
	},
	rectangleView: {
	top: 512
	},
	homescreenChild1: {
	top: 686
	},
	frameChild: {
	width: 389,
	height: 100,
	backgroundColor: "#000"
	},
	frameView: {
	marginLeft: -194.5,
	top: 755,
	left: "50%",
	alignItems: "center",
	position: "absolute"
	},
	image1Icon: {
	top: 57,
	left: 254,
	width: 86,
	height: 82,
	position: "absolute"
	},
	sun1: {
	left: 29
	},
	sun2: {
	left: 24,
	top: 689,
	height: 100
	},
	sun3: {
	top: 515,
	height: 100,
	left: 29
	},
	jun7: {
	left: 204
	},
	jun21: {
	top: 514
	},
	jun29: {
	top: 689
	},
	jun14: {
	top: 348
	},
	liturgy: {
	top: 232
	},
	liturgy1: {
	top: 564
	},
	liturgy2: {
	top: 397
	},
	rectangleIcon: {
	top: 278,
	left: 26
	},
	homescreenChild2: {
	left: 23
	},
	homescreenChild3: {
	left: 29
	},
	homescreenChild4: {
	top: 277,
	left: 218
	},
	homescreenChild5: {
	left: 218
	},
	homescreenChild6: {
	left: 218
	},
	available: {
	top: 248,
	left: 215
	},
	available1: {
	top: 417,
	left: 218
	},
	available2: {
	top: 585,
	left: 218
	},
	notAvailable: {
	top: 285
	},
	notAvailable1: {
	top: 454
	},
	notAvailable2: {
	top: 622
	},
	useroutlineIcon: {
	marginLeft: 40
	},
	homeoutlineParent: {
	top: 724,
	left: -6,
	width: 403,
	height: 74,
	flexDirection: "row",
	paddingHorizontal: 15,
	paddingVertical: 20,
	justifyContent: "center",
	alignItems: "center",
	position: "absolute",
	backgroundColor: "#000",
	borderRadius: 30
	},
	lineView: {
	top: 150,
	left: 42,
	borderStyle: "solid",
	borderColor: "#ff0000",
	borderTopWidth: 1,
	width: 292,
	height: 1,
	position: "absolute"
	},
	homescreen: {
	flex: 1,
	width: "100%",
	height: 844,
	overflow: "hidden",
	borderRadius: 30,
	backgroundColor: "#000"
	}
	});
	export default HomeScreen;
	