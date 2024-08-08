import * as React from "react";
import {Image, StyleSheet, Text, View} from "react-native";

const HomeScreenContent = () => {
  	
  	return (
    		<View style={styles.component5}>
      			<Image style={[styles.component5Child, styles.childLayout]} resizeMode="cover" source="Rectangle 17.png" />
      			<Text style={[styles.yourNextService, styles.roleFlexBox]}>Your Next Service</Text>
      			<View style={[styles.rectangleParent, styles.rectangleParentPosition2]}>
        				<View style={styles.frameChild} />
        				<Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>MM/DD/YYYY</Text>
        				<View style={[styles.frameItem, styles.frameBorder]} />
        				<View style={[styles.frameInner, styles.roleLayout]} />
        				<View style={[styles.rectangleView, styles.frameBorder]} />
        				<Text style={[styles.readings, styles.roleFlexBox]}>Readings</Text>
        				<View style={styles.frameParent}>
          					<View style={[styles.rectangleGroup, styles.rectangleParentPosition1]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.gospel, styles.gospelTypo]}>Gospel:</Text>
          					</View>
          					<Text style={[styles.firstLast, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.rectangleContainer, styles.rectangleParentPosition1]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.praxis, styles.gospelTypo]}>Praxis:</Text>
          					</View>
          					<Text style={[styles.firstLast1, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.frameView, styles.rectangleParentPosition1]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.catholicEpistle, styles.gospelTypo]}>Catholic Epistle:</Text>
          					</View>
          					<Text style={[styles.firstLast2, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.rectangleParent1, styles.rectangleParentPosition1]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.paulineEpistle, styles.gospelTypo]}>Pauline Epistle:</Text>
          					</View>
          					<Text style={[styles.firstLast3, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.rectangleParent2, styles.rectangleParentPosition]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.thHourGospel, styles.gospelTypo]}>6th Hour Gospel:</Text>
          					</View>
          					<Text style={[styles.firstLast4, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.rectangleParent3, styles.rectangleParentPosition]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.rdHourGospel, styles.gospelTypo]}>3rd Hour Gospel:</Text>
          					</View>
          					<Text style={[styles.firstLast5, styles.gospelTypo]}>First Last</Text>
          					<View style={[styles.rectangleParent4, styles.rectangleParentPosition1]}>
            						<View style={styles.frameChild1} />
            						<Text style={[styles.matinsGospel, styles.gospelTypo]}>Matins Gospel:</Text>
          					</View>
          					<Text style={[styles.firstLast6, styles.gospelTypo]}>First Last</Text>
        				</View>
        				<View style={[styles.rectangleParent5, styles.parentLayout]}>
          					<View style={[styles.frameChild8, styles.frameChildLayout]} />
          					<View style={[styles.frameChild9, styles.frameChildLayout]} />
          					<Text style={styles.waterFirstLastContainer}>
            						<Text style={styles.waterFirstLastContainer1}>
              							<Text style={styles.water}>{`Water: `}</Text>
              							<Text style={styles.firstLast7}>{`First Last
`}</Text>
                            <Text style={styles.water}>Wine:</Text>
              							<Text style={styles.firstLast7}>{` First Last
              							`}</Text>
                        </Text>
                    </Text>
                </View>
                <View style={[styles.firstLastFirstLastParent, styles.parentLayout]}>
                    <Text style={[styles.firstLastFirstLast, styles.firstLayout]}>First Last First Last</Text>
                    <Text style={[styles.firstLastFirstLast1, styles.firstLayout]}>First Last First Last</Text>
                </View>
                <Text style={[styles.offeringOfThe, styles.alterServersFlexBox]}>Offering of the lamb</Text>
                <Text style={[styles.alterServers, styles.alterServersFlexBox]}>Alter Servers</Text>
            </View>
            <View style={[styles.rectangleParent6, styles.rectangleParentPosition2]}>
                <View style={styles.frameChild} />
                <View style={[styles.frameChild11, styles.frameBorder]} />
                <Text style={[styles.role, styles.roleLayout]}>Role</Text>
                <Text style={[styles.mmddyyyy1, styles.mmddyyyyFlexBox]}>MM/DD/YYYY</Text>
                <View style={styles.frameChild12} />
                <Text style={[styles.yourRoleHere, styles.roleFlexBox]}>Your role here</Text>
            </View>
        </View>);
};

const styles = StyleSheet.create({
    attendancetitlePosition1: {
        left: "0%",
        position: "absolute"
    },
    attendancetitlePosition: {
        right: "0%",
        height: "100%",
        bottom: "0%",
        top: "0%",
        width: "100%"
    },
    childLayout: {
        maxHeight: "100%",
        overflow: "hidden",
        maxWidth: "100%",
        borderRadius: 10,
        left: "0%",
        position: "absolute"
    },
    roleFlexBox: {
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24
    },
    rectangleParentPosition2: {
        left: "5.99%",
        width: "94.01%",
        right: "0%",
        position: "absolute"
    },
    mmddyyyyFlexBox: {
        width: "87.25%",
        left: "6.38%",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        color: "#8e8e93",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        position: "absolute"
    },
    frameBorder: {
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        backgroundColor: "#1e1e1e",
        borderRadius: 10
    },
    roleLayout: {
        width: "77.52%",
        position: "absolute"
    },
    rectangleParentPosition1: {
        left: "-1.52%",
        height: "9.94%",
        position: "absolute"
    },
    gospelTypo: {
        textAlign: "left",
        fontSize: 15,
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    rectangleParentPosition: {
        right: "41.92%",
        width: "59.6%",
        left: "-1.52%",
        height: "9.94%",
        position: "absolute"
    },
    parentLayout: {
        height: "11.13%",
        position: "absolute"
    },
    frameChildLayout: {
        height: "27.69%",
        backgroundColor: "#000",
        borderRadius: 5,
        left: "-1.52%",
        position: "absolute"
    },
    firstLayout: {
        width: 69,
        height: 65,
        top: 0,
        textAlign: "left",
        fontSize: 15,
        alignItems: "center",
        display: "flex",
        color: "#8e8e93",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    alterServersFlexBox: {
        height: "8.73%",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        color: "#8e8e93",
        fontFamily: "Roboto-Regular",
        fontSize: 24,
        position: "absolute"
    },
    component5Child: {
        top: "70.27%",
        bottom: "22.55%",
        right: "11.67%",
        width: "88.33%",
        height: "7.18%",
        overflow: "hidden",
        maxWidth: "100%"
    },
    yourNextService: {
        height: "3.74%",
        width: "72.87%",
        top: "71.99%",
        left: "7.57%",
        color: "#8e8e93",
        position: "absolute"
    },
    frameChild: {
        backgroundColor: "#1e1e1e",
        borderRadius: 10,
        bottom: "0%",
        right: "0%",
        height: "100%",
        left: "0%",
        top: "0%",
        position: "absolute",
        width: "100%"
    },
    mmddyyyy: {
        height: "4.97%",
        left: "6.38%",
        top: "3.08%"
    },
    frameItem: {
        width: "52.68%",
        top: "12.84%",
        right: "42.28%",
        bottom: "78.94%",
        left: "5.03%",
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "8.22%",
        position: "absolute"
    },
    frameInner: {
        top: "54.11%",
        right: "17.45%",
        bottom: "37.67%",
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        backgroundColor: "#1e1e1e",
        borderRadius: 10,
        left: "5.03%",
        height: "8.22%"
    },
    rectangleView: {
        width: "75.5%",
        top: "76.2%",
        right: "18.79%",
        bottom: "15.58%",
        left: "5.7%",
        height: "8.22%",
        borderColor: "#8e8e93",
        borderStyle: "solid",
        position: "absolute"
    },
    readings: {
        height: "4.62%",
        width: "43.96%",
        top: "14.73%",
        left: "9.4%",
        color: "#8e8e93",
        position: "absolute"
    },
    frameChild1: {
        backgroundColor: "#000",
        borderRadius: 5,
        bottom: "0%",
        right: "0%",
        height: "100%",
        left: "0%",
        top: "0%",
        position: "absolute",
        width: "100%"
    },
    gospel: {
        marginLeft: -25.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleGroup: {
        width: "27.78%",
        top: "75.69%",
        right: "73.74%",
        bottom: "14.36%"
    },
    firstLast: {
        top: "74.59%",
        left: "27.27%",
        color: "#8e8e93"
    },
    praxis: {
        marginLeft: -22.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleContainer: {
        width: "25.76%",
        top: "63.54%",
        right: "75.76%",
        bottom: "26.52%"
    },
    firstLast1: {
        top: "62.43%",
        left: "25.25%",
        color: "#8e8e93"
    },
    catholicEpistle: {
        marginLeft: -54,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    frameView: {
        width: "56.57%",
        top: "51.38%",
        right: "44.95%",
        bottom: "38.67%"
    },
    firstLast2: {
        top: "50.28%",
        left: "56.57%",
        color: "#8e8e93"
    },
    paulineEpistle: {
        marginLeft: -51,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleParent1: {
        width: "53.54%",
        top: "39.23%",
        right: "47.98%",
        bottom: "50.83%"
    },
    firstLast3: {
        top: "38.12%",
        left: "53.54%",
        color: "#8e8e93"
    },
    thHourGospel: {
        marginLeft: -56,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleParent2: {
        top: "27.07%",
        bottom: "62.98%"
    },
    firstLast4: {
        top: "25.97%",
        left: "59.09%",
        color: "#8e8e93"
    },
    rdHourGospel: {
        marginLeft: -57,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleParent3: {
        top: "14.92%",
        bottom: "75.14%"
    },
    firstLast5: {
        top: "13.81%",
        left: "60.1%",
        color: "#8e8e93"
    },
    matinsGospel: {
        marginLeft: -50,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginTop: -11,
        fontSize: 15
    },
    rectangleParent4: {
        width: "52.53%",
        top: "2.76%",
        right: "48.99%",
        bottom: "87.29%"
    },
    firstLast6: {
        top: "1.66%",
        left: "53.03%",
        color: "#8e8e93"
    },
    frameParent: {
        height: "30.99%",
        top: "23.12%",
        right: "9.06%",
        bottom: "45.89%",
        left: "24.5%",
        width: "66.44%",
        position: "absolute"
    },
    frameChild8: {
        width: "21.72%",
        top: "35.38%",
        right: "79.8%",
        bottom: "36.92%"
    },
    frameChild9: {
        width: "24.75%",
        right: "76.77%",
        bottom: "69.23%",
        top: "3.08%"
    },
    water: {
        color: "#fff"
    },
    firstLast7: {
        color: "#8e8e93"
    },
    waterFirstLastContainer1: {
        width: "100%"
    },
    waterFirstLastContainer: {
        width: 198,
        height: 65,
        top: 0,
        left: 0,
        textAlign: "left",
        fontSize: 15,
        alignItems: "center",
        display: "flex",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    rectangleParent5: {
        top: "66.61%",
        right: "10.07%",
        bottom: "22.26%",
        left: "23.49%",
        width: "66.44%"
    },
    firstLastFirstLast: {
        left: 0,
        width: 69
    },
    firstLastFirstLast1: {
        left: 103
    },
    firstLastFirstLastParent: {
        width: "23.15%",
        top: "86.82%",
        right: "52.35%",
        bottom: "2.05%",
        left: "24.5%"
    },
    offeringOfThe: {
        width: "74.5%",
        top: "53.94%",
        left: "6.38%"
    },
    alterServers: {
        width: "75.17%",
        top: "76.03%",
        left: "6.04%"
    },
    rectangleParent: {
        height: "59.05%",
        top: "9.2%",
        bottom: "31.75%"
    },
    frameChild11: {
        height: "23.65%",
        width: "24.16%",
        top: "32.02%",
        right: "37.92%",
        bottom: "44.33%",
        left: "37.92%",
        position: "absolute"
    },
    role: {
        height: "18.23%",
        top: "33.5%",
        left: "11.07%",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        color: "#8e8e93"
    },
    mmddyyyy1: {
        height: "14.29%",
        top: "9.36%",
        left: "6.38%"
    },
    frameChild12: {
        height: "21.18%",
        width: "53.69%",
        top: "62.07%",
        right: "23.15%",
        bottom: "16.75%",
        left: "23.15%",
        backgroundColor: "#8e8e93",
        borderRadius: 10,
        position: "absolute"
    },
    yourRoleHere: {
        height: "13.3%",
        width: "51.34%",
        top: "66.01%",
        left: "24.16%",
        color: "#fff",
        position: "absolute"
    },
    rectangleParent6: {
        height: "20.53%",
        top: "79.47%",
        bottom: "0%"
    },
    component5: {
        flex: 1,
        height: 989,
        width: "100%"
    }
});

export default HomeScreenContent;