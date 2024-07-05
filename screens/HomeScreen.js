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
      			<View style={styles.liturgyWrapper}>
        				<Text style={styles.liturgy}>Liturgy</Text>
      			</View>
      			<Image style={styles.redCopticCrossIcon} resizeMode="cover" source={require("../assets/redCopticCross.png")} />
      			<Text style={[styles.sun1, styles.sun1Typo]}>SUN</Text>
      			<Text style={[styles.sun2, styles.sunTypo]}>SUN</Text>
      			<Text style={[styles.sun3, styles.sunTypo]}>SUN</Text>
      			<Text style={[styles.jun7, styles.sun1Typo]}>JUN 7</Text>
      			<Text style={[styles.jun21, styles.junTypo]}>JUN 21</Text>
      			<Text style={[styles.jun29, styles.junTypo]}>JUN 29</Text>
      			<Text style={[styles.jun14, styles.junTypo]}>JUN 14</Text>
      			<Text style={[styles.liturgy1, styles.liturgyTypo]}>Liturgy</Text>
      			<Text style={[styles.liturgy2, styles.liturgyTypo]}>Liturgy</Text>
      			<Text style={[styles.liturgy3, styles.liturgyTypo]}>Liturgy</Text>
      			<Image style={[styles.rectangleIcon, styles.rectangleIconLayout]} resizeMode="cover" source={require("../assets/redRectangle.png")}/>
      			<Image style={[styles.homescreenChild2, styles.homescreenChildLayout1]} resizeMode="cover" source={require("../assets/redRectangle.png")} />
      			<Image style={[styles.homescreenChild3, styles.homescreenChildLayout]} resizeMode="cover" source={require("../assets/redRectangle.png")} />
      			<Image style={[styles.homescreenChild4, styles.rectangleIconLayout]} resizeMode="cover" source={require("../assets/greenRectangle.png")} />
      			<Image style={[styles.homescreenChild5, styles.homescreenChildLayout]} resizeMode="cover" source={require("../assets/greenRectangle.png")} />
      			<Image style={[styles.homescreenChild6, styles.homescreenChildLayout1]} resizeMode="cover" source={require("../assets/greenRectangle.png")} />
      			<Text style={[styles.available, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.available1, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.available2, styles.availableTypo]}>Available</Text>
      			<Text style={[styles.notAvailable, styles.notTypo]}>Not Available</Text>
      			<Text style={[styles.notAvailable1, styles.notTypo]}>Not Available</Text>
      			<Text style={[styles.notAvailable2, styles.notTypo]}>Not Available</Text>
      			<View style={styles.homescreenChild7} />
      			<Image style={[styles.cogoutlineIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/CogOutline.png")} />
      			<View style={styles.lineView} />
      			<Image style={[styles.homeIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/HomeOutline.png")} />
      			<Image style={[styles.userIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/UserOutline.png")} />
      			<Image style={[styles.pluscircleoutlineIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/PlusCircleOutline.png")} />
      			<Image style={[styles.chartpieoutlineIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/ChartPieOutline.png")} />
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
    		left: 90,
    		width: 193,
    		justifyContent: "center",
    		display: "flex",
    		textAlign: "center",
    		letterSpacing: -0.8,
    		fontSize: 20,
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
    		top: 777,
    		position: "absolute",
    		overflow: "hidden"
  	},
  	vectorIconLayout: {
    		maxHeight: "100%",
    		maxWidth: "100%",
    		bottom: "5.45%",
    		top: "92.42%",
    		height: "2.13%",
    		position: "absolute",
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
    		left: 29
  	},
  	rectangleView: {
    		top: 512
  	},
  	homescreenChild1: {
    		top: 686
  	},
  	liturgy: {
    		width: 193,
    		justifyContent: "center",
    		display: "flex",
    		textAlign: "center",
    		letterSpacing: -0.8,
    		fontSize: 20,
    		alignItems: "center",
    		fontFamily: "Inter-Black",
    		fontWeight: "900",
    		color: "#ff0000",
    		height: 50
  	},
  	liturgyWrapper: {
    		marginLeft: -105,
    		top: 736,
    		left: "50%",
    		alignItems: "center",
    		position: "absolute"
  	},
  	redCopticCrossIcon: {
    		top: 57,
    		left: 280,
    		width: 86,
    		height: 82,
    		position: "absolute"
  	},
  	sun1: {
    		left: 29
  	},
  	sun2: {
    		left: 24,
    		top: 689
  	},
  	sun3: {
    		top: 515,
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
  	liturgy1: {
    		top: 232
  	},
  	liturgy2: {
    		top: 564
  	},
  	liturgy3: {
    		top: 397
  	},
  	rectangleIcon: {
    		top: 278,
    		left: 29
  	},
  	homescreenChild2: {
    		left: 29
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
    		top: 282,
    		left: 215
  	},
  	available1: {
    		top: 452,
    		left: 218
  	},
  	available2: {
    		top: 620,
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
  	homescreenChild7: {
    		top: 764,
    		left: -35,
    		width: 506,
    		height: 121,
    		position: "absolute",
    		backgroundColor: "#000"
  	},
  	cogoutlineIcon: {
    		left: 328
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
  	homeIcon: {
    		width: "4.62%",
    		right: "83.85%",
    		left: "11.54%"
  	},
  	userIcon: {
    		width: "3.59%",
    		right: "67.44%",
    		left: "28.97%"
  	},
  	pluscircleoutlineIcon: {
    		left: 178
  	},
  	chartpieoutlineIcon: {
    		left: 253
  	},
  	homescreen: {
    		borderRadius: 30,
    		flex: 1,
    		width: "100%",
    		height: 844,
    		overflow: "hidden",
    		backgroundColor: "#000"
  	}
});

export default HomeScreen;
