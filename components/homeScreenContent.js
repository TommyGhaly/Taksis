import * as React from "react";
import {Image, StyleSheet, Text, View} from "react-native";

const HomeScreenContent = () => {
  	
  	return (
    		<View style={styles.homescreencontent}>
      			<Image style={[styles.homescreencontentChild, styles.homescreencontentLayout]} resizeMode="cover" source="Rectangle 17.png" />
      			<Text style={[styles.thisWeeksService, styles.serviceFlexBox]}>This Week’s Service</Text>
      			<Image style={[styles.homescreencontentItem, styles.homescreencontentLayout]} resizeMode="cover" source="Rectangle 17.png" />
      			<Text style={[styles.yourNextService, styles.serviceFlexBox]}>Your Next Service</Text>
      			<View style={[styles.homescreencontentInner, styles.homescreencontentPosition]} />
      			<Text style={[styles.mmddyyyy, styles.mmddyyyyLayout]}>MM/DD/YYYY</Text>
      			<View style={[styles.rectangleView, styles.homescreencontentChildBorder]} />
      			<View style={[styles.homescreencontentChild1, styles.homescreencontentChildBorder]} />
      			<View style={[styles.homescreencontentChild2, styles.homescreencontentChildBorder]} />
      			<Text style={[styles.readings, styles.readingsFlexBox]}>Readings</Text>
      			<View style={[styles.homescreencontentChild3, styles.homescreencontentChildLayout]} />
      			<Text style={[styles.gospel, styles.gospelTypo]}>Gospel:</Text>
      			<Text style={[styles.firstLast, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild4, styles.homescreencontentChildLayout]} />
      			<Text style={[styles.praxis, styles.praxisPosition]}>Praxis:</Text>
      			<Text style={[styles.firstLast1, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild5, styles.homescreencontentChildLayout]} />
      			<Text style={[styles.catholicEpistle, styles.gospelTypo]}>Catholic Epistle:</Text>
      			<Text style={[styles.firstLast2, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild6, styles.homescreencontentChildLayout]} />
      			<Text style={[styles.paulineEpistle, styles.gospelTypo]}>Pauline Epistle:</Text>
      			<Text style={[styles.firstLast3, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild7, styles.homescreencontentChildPosition1]} />
      			<Text style={[styles.thHourGospel, styles.praxisPosition]}>6th Hour Gospel:</Text>
      			<Text style={[styles.firstLast4, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild8, styles.homescreencontentChildPosition1]} />
      			<Text style={[styles.rdHourGospel, styles.gospelTypo]}>3rd Hour Gospel:</Text>
      			<Text style={[styles.firstLast5, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild9, styles.homescreencontentChildLayout]} />
      			<Text style={[styles.matinsGospel, styles.gospelTypo]}>Matins Gospel:</Text>
      			<Text style={[styles.firstLast6, styles.gospelTypo]}>First Last</Text>
      			<View style={[styles.homescreencontentChild10, styles.homescreencontentChildPosition]} />
      			<View style={[styles.homescreencontentChild11, styles.homescreencontentChildPosition]} />
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
            <Text style={[styles.firstLastFirstLast, styles.firstLayout]}>First LastFirst Last</Text>
            <Text style={[styles.firstLastFirstLast1, styles.firstLayout]}>First LastFirst Last</Text>
            <Text style={[styles.offeringOfThe, styles.alterServersFlexBox]}>Offering of the lamb</Text>
            <Text style={[styles.alterServers, styles.alterServersFlexBox]}>Alter Servers</Text>
            <View style={[styles.homescreencontentChild12, styles.homescreencontentPosition]} />
            <View style={[styles.homescreencontentChild13, styles.homescreencontentChildBorder]} />
            <Text style={[styles.role, styles.serviceFlexBox]}>Role</Text>
            <Text style={[styles.mmddyyyy1, styles.mmddyyyyLayout]}>MM/DD/YYYY</Text>
            <View style={styles.homescreencontentChild14} />
            <Text style={[styles.yourRoleHere, styles.readingsFlexBox]}>Your role here</Text>
        </View>);
};

const styles = StyleSheet.create({
    homescreencontentLayout: {
        maxHeight: "100%",
        overflow: "hidden",
        maxWidth: "100%",
        left: "0%",
        right: "11.67%",
        width: "88.33%",
        height: "7.18%",
        borderRadius: 10,
        position: "absolute"
    },
    serviceFlexBox: {
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        height: "3.74%",
        color: "#8e8e93",
        width: "72.87%",
        position: "absolute"
    },
    homescreencontentPosition: {
        backgroundColor: "#1e1e1e",
        left: "5.99%",
        right: "0%",
        width: "94.01%",
        borderRadius: 10,
        position: "absolute"
    },
    mmddyyyyLayout: {
        width: "82.02%",
        height: "2.93%",
        left: "11.99%",
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
    homescreencontentChildBorder: {
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "4.85%",
        backgroundColor: "#1e1e1e",
        borderRadius: 10,
        position: "absolute"
    },
    readingsFlexBox: {
        height: "2.73%",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        position: "absolute"
    },
    homescreencontentChildLayout: {
        backgroundColor: "#000",
        borderRadius: 5,
        left: "28.08%",
        height: "1.82%",
        position: "absolute"
    },
    gospelTypo: {
        textAlign: "left",
        fontSize: 15,
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    praxisPosition: {
        marginLeft: -66.5,
        textAlign: "left",
        color: "#fff",
        fontSize: 15,
        left: "50%",
        top: "50%",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    homescreencontentChildPosition1: {
        right: "34.7%",
        width: "37.22%",
        backgroundColor: "#000",
        borderRadius: 5,
        left: "28.08%",
        height: "1.82%",
        position: "absolute"
    },
    homescreencontentChildPosition: {
        left: "27.13%",
        backgroundColor: "#000",
        borderRadius: 5,
        position: "absolute"
    },
    firstLayout: {
        width: 69,
        top: 598,
        height: 65,
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
        height: "5.16%",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        color: "#8e8e93",
        fontFamily: "Roboto-Regular",
        fontSize: 24,
        position: "absolute"
    },
    homescreencontentChild: {
        top: "0%",
        bottom: "92.82%"
    },
    thisWeeksService: {
        top: "2.72%",
        left: "7.57%",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        height: "3.74%"
    },
    homescreencontentItem: {
        top: "70.27%",
        bottom: "22.55%"
    },
    yourNextService: {
        top: "71.99%",
        left: "7.57%",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        height: "3.74%"
    },
    homescreencontentInner: {
        height: "59.05%",
        top: "9.2%",
        bottom: "31.75%"
    },
    mmddyyyy: {
        top: "11.02%",
        left: "11.99%"
    },
    rectangleView: {
        width: "49.53%",
        top: "16.78%",
        right: "39.75%",
        bottom: "78.36%",
        left: "10.73%",
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "4.85%"
    },
    homescreencontentChild1: {
        top: "41.15%",
        right: "16.4%",
        bottom: "53.99%",
        left: "10.73%",
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "4.85%",
        width: "72.87%"
    },
    homescreencontentChild2: {
        width: "70.98%",
        top: "54.2%",
        right: "17.67%",
        bottom: "40.95%",
        left: "11.36%",
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "4.85%"
    },
    readings: {
        width: "41.32%",
        top: "17.9%",
        left: "14.83%",
        color: "#8e8e93"
    },
    homescreencontentChild3: {
        width: "17.35%",
        top: "36.7%",
        right: "54.57%",
        bottom: "61.48%"
    },
    gospel: {
        marginTop: -133.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginLeft: -67.5,
        fontSize: 15
    },
    firstLast: {
        top: "36.5%",
        left: "46.06%",
        color: "#8e8e93"
    },
    homescreencontentChild4: {
        width: "16.09%",
        top: "34.48%",
        right: "55.84%",
        bottom: "63.7%"
    },
    praxis: {
        marginTop: -155.5
    },
    firstLast1: {
        top: "34.28%",
        left: "44.79%",
        color: "#8e8e93"
    },
    homescreencontentChild5: {
        width: "35.33%",
        top: "32.25%",
        right: "36.59%",
        bottom: "65.93%"
    },
    catholicEpistle: {
        marginTop: -177.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginLeft: -67.5,
        fontSize: 15
    },
    firstLast2: {
        top: "32.05%",
        left: "64.35%",
        color: "#8e8e93"
    },
    homescreencontentChild6: {
        width: "33.44%",
        top: "30.03%",
        right: "38.49%",
        bottom: "68.15%"
    },
    paulineEpistle: {
        marginTop: -199.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginLeft: -67.5,
        fontSize: 15
    },
    firstLast3: {
        top: "29.83%",
        left: "62.46%",
        color: "#8e8e93"
    },
    homescreencontentChild7: {
        top: "27.81%",
        bottom: "70.37%"
    },
    thHourGospel: {
        marginTop: -221.5
    },
    firstLast4: {
        top: "27.6%",
        left: "65.93%",
        color: "#8e8e93"
    },
    homescreencontentChild8: {
        top: "25.58%",
        bottom: "72.6%"
    },
    rdHourGospel: {
        marginTop: -243.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginLeft: -67.5,
        fontSize: 15
    },
    firstLast5: {
        top: "25.38%",
        left: "66.56%",
        color: "#8e8e93"
    },
    homescreencontentChild9: {
        width: "32.81%",
        top: "23.36%",
        right: "39.12%",
        bottom: "74.82%"
    },
    matinsGospel: {
        marginTop: -265.5,
        color: "#fff",
        left: "50%",
        top: "50%",
        marginLeft: -67.5,
        fontSize: 15
    },
    firstLast6: {
        top: "23.15%",
        left: "62.15%",
        color: "#8e8e93"
    },
    homescreencontentChild10: {
        height: "1.62%",
        width: "12.62%",
        top: "51.06%",
        right: "60.25%",
        bottom: "47.32%"
    },
    homescreencontentChild11: {
        width: "14.51%",
        top: "48.74%",
        right: "58.36%",
        bottom: "49.44%",
        height: "1.82%",
        left: "27.13%"
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
        top: 480,
        left: 89,
        width: 198,
        height: 65,
        textAlign: "left",
        fontSize: 15,
        alignItems: "center",
        display: "flex",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        position: "absolute"
    },
    firstLastFirstLast: {
        left: 92
    },
    firstLastFirstLast1: {
        left: 195
    },
    offeringOfThe: {
        width: "70.03%",
        top: "41.05%",
        left: "11.99%"
    },
    alterServers: {
        width: "70.66%",
        top: "54.1%",
        left: "11.67%"
    },
    homescreencontentChild12: {
        height: "20.53%",
        top: "79.47%",
        bottom: "0%"
    },
    homescreencontentChild13: {
        width: "22.71%",
        top: "86.05%",
        right: "35.65%",
        bottom: "9.1%",
        left: "41.64%",
        borderWidth: 1,
        borderColor: "#8e8e93",
        borderStyle: "solid",
        height: "4.85%"
    },
    role: {
        top: "86.35%",
        left: "16.4%",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
        fontFamily: "Roboto-Regular",
        lineHeight: 22,
        fontSize: 24,
        height: "3.74%"
    },
    mmddyyyy1: {
        top: "81.4%",
        left: "11.99%"
    },
    homescreencontentChild14: {
        height: "4.35%",
        width: "50.47%",
        top: "92.21%",
        right: "21.77%",
        bottom: "3.44%",
        left: "27.76%",
        backgroundColor: "#8e8e93",
        borderRadius: 10,
        position: "absolute"
    },
    yourRoleHere: {
        width: "48.26%",
        top: "93.02%",
        left: "28.71%",
        color: "#fff"
    },
    homescreencontent: {
        flex: 1,
        height: 989,
        width: "100%"
    }
});

export default HomeScreenContent;