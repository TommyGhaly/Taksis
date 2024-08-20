import * as React from "react";
import {StyleSheet, View, ScrollView, Text, Pressable} from "react-native";
import BackArrow from "../../../components/backArrow";
const LearnItTesbehaMenu = ({navigation}) => {
    		
    		return (
      			<View style={styles.learnittesbehamenu}>
                        <View style={styles.backbutton}>
                            <BackArrow/>
                        </View>
        				<Pressable style={[styles.rectangleParent, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('Introduction')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.introduction, styles.canticleTypo]}>Introduction</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleGroup, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('FirstCanticle')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.firstCanticle, styles.canticleTypo]}>First  Canticle</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleContainer, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('SecondCanticle')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.secondCanticle, styles.canticleTypo]}>{`Second Canticle `}</Text>
        				</Pressable>
        				<Pressable style={[styles.framePressable, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('ThirdCanticle')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.thirdCanticle, styles.canticleTypo]}>Third Canticle</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleParent1, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('Commemoration')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.theCommemoration, styles.canticleTypo]}>{`The Commemoration `}</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleParent2, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('FourthCanticle')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.fourthCanticle, styles.canticleTypo]}>Fourth Canticle</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleParent3, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('AdamPsali')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.adamPsali, styles.canticleTypo]}>Adam Psali</Text>
        				</Pressable>
        				<Pressable style={[styles.rectangleParent4, styles.rectangleParentPosition]} onPress={()=>{navigation.navigate('SundayTheotokia')}}>
          					<View style={[styles.frameChild, styles.childPosition]} />
          					<Text style={[styles.sundayTheotokia, styles.canticleTypo]}>Sunday Theotokia</Text>
        				</Pressable>
        				<View style={styles.tesbeha}>
          					<View style={[styles.tesbehaChild, styles.childPosition]} />
          					<Text style={[styles.midnightPraisesTesbeha, styles.canticleTypo]}>Midnight Praises (Tesbeha)</Text>
        				</View>
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
                backbutton: {
					top: 74,
					left: 16
      			},
      			rectangleParentPosition: {
        				left: "18.32%",
        				right: "18.07%",
        				width: "63.61%",
        				height: "4.46%",
        				position: "absolute"
      			},
      			childPosition: {
        				borderRadius: 10,
        				left: "0%",
        				bottom: "0%",
        				top: "0%",
        				height: "100%",
        				position: "absolute"
      			},
      			canticleTypo: {
        				justifyContent: "center",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24,
        				position: "absolute"
      			},
      			frameChild: {
        				width: "100.4%",
        				right: "-0.4%",
        				backgroundColor: "#8e8e93"
      			},
      			introduction: {
        				width: "55.24%",
        				left: "22.59%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleParent: {
        				top: "32.86%",
        				bottom: "62.68%"
      			},
      			firstCanticle: {
        				width: "62.76%",
        				left: "18.83%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleGroup: {
        				top: "42.61%",
        				bottom: "52.93%"
      			},
      			secondCanticle: {
        				width: "73.64%",
        				left: "13.39%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleContainer: {
        				top: "52.35%",
        				bottom: "43.19%"
      			},
      			thirdCanticle: {
        				width: "63.6%",
        				left: "18.41%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			framePressable: {
        				top: "62.09%",
        				bottom: "33.45%"
      			},
      			theCommemoration: {
        				width: "95.8%",
        				left: "2.09%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleParent1: {
        				top: "71.83%",
        				bottom: "23.71%"
      			},
      			fourthCanticle: {
        				width: "69.44%",
        				left: "15.48%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleParent2: {
        				top: "81.57%",
        				bottom: "13.97%"
      			},
      			adamPsali: {
        				width: "51.48%",
        				left: "24.27%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleParent3: {
        				top: "91.31%",
        				bottom: "4.23%"
      			},
      			sundayTheotokia: {
        				width: "81.16%",
        				left: "9.62%",
        				top: "21.05%",
        				alignItems: "center",
        				display: "flex",
        				textAlign: "center",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				lineHeight: 24,
        				fontSize: 24
      			},
      			rectangleParent4: {
        				top: "101.06%",
        				bottom: "-5.52%"
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				left: "4.07%",
        				overflow: "hidden",
        				position: "absolute"
      			},
      			tesbehaChild: {
        				right: "0%",
        				backgroundColor: "#555",
        				width: "100%"
      			},
      			midnightPraisesTesbeha: {
        				marginTop: -22,
        				marginLeft: -146.5,
        				top: "50%",
        				left: "50%",
        				width: 294
      			},
      			tesbeha: {
        				height: "10.56%",
        				width: "82.7%",
        				top: "14.32%",
        				right: "8.65%",
        				bottom: "75.12%",
        				left: "8.65%",
        				position: "absolute"
      			},
      			learnittesbehamenu: {
        				backgroundColor: "#000",
        				flex: 1,
        				height: "100%",
        				width: "100%"
      			}
    		});
    		
    		export default LearnItTesbehaMenu;
    		