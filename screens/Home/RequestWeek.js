import * as React from "react";
import { Text, StyleSheet, View, Image, Pressable } from "react-native";
import { Button as RNEButton } from "@rneui/themed";
import { Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
const RequestWeek = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.requestweek}>
      <Text
        style={[styles.youCanOnly, styles.dateFlexBox]}
      >{`You can only request one week per month. It is not guaranteed you will be called to serve that week, but you (and any of your children) will be priority. `}</Text>
      <View style={[styles.pickerDateAndTimeInlin, styles.dateFlexBox]}>
        <View style={[styles.date, styles.dateFlexBox]}>
          <View style={styles.header}>
            <View style={[styles.arrows, styles.arrowsPosition]}>
              <Text style={styles.nextTypo}>􀆉</Text>
              <Text style={[styles.next, styles.nextTypo]}>􀆊</Text>
            </View>
            <View style={[styles.monthAndYear, styles.arrowsPosition]}>
              <Text style={[styles.monthYyyy, styles.monthYyyyTypo]}>
                June 2023
              </Text>
              <Text style={[styles.disclosure, styles.monthYyyyTypo]}>􀆊</Text>
            </View>
          </View>
          <View style={styles.dateHeader}>
            <Text style={styles.sun}>sun</Text>
            <Text style={styles.sun}>mon</Text>
            <Text style={styles.sun}>tue</Text>
            <Text style={styles.sun}>wed</Text>
            <Text style={styles.sun}>thu</Text>
            <Text style={styles.sun}>fri</Text>
            <Text style={styles.sun}>sat</Text>
          </View>
          <View style={styles.calendar}>
            <View style={styles.weekFlexBox}>
              <RNEButton
                radius="5"
                iconPosition="left"
                type="clear"
                containerStyle={styles.dayBtn}
                buttonStyle={styles.dayBtn1}
              />
              <RNEButton
                radius="5"
                iconPosition="left"
                type="clear"
                containerStyle={styles.day1Btn}
                buttonStyle={styles.day1Btn1}
              />
              <RNEButton
                radius="5"
                iconPosition="left"
                type="clear"
                containerStyle={styles.day2Btn}
                buttonStyle={styles.day2Btn1}
              />
              <RNEButton
                radius="5"
                iconPosition="left"
                type="clear"
                containerStyle={styles.day3Btn}
                buttonStyle={styles.day3Btn1}
              />
              <RNEButton
                title="2"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day5Btn}
                containerStyle={styles.day5Btn1}
                buttonStyle={styles.day5Btn2}
              />
              <RNEButton
                title="3"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day6Btn}
                containerStyle={styles.day6Btn1}
                buttonStyle={styles.day6Btn2}
              />
            </View>
            <View style={[styles.week2, styles.weekFlexBox]}>
              <RNEButton
                title="4"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day7Btn}
                containerStyle={styles.day7Btn1}
                buttonStyle={styles.day7Btn2}
              />
              <RNEButton
                title="5"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day8Btn}
                containerStyle={styles.day8Btn1}
                buttonStyle={styles.day8Btn2}
              />
              <RNEButton
                title="6"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day9Btn}
                containerStyle={styles.day9Btn1}
                buttonStyle={styles.day9Btn2}
              />
              <RNEButton
                title="7"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day10Btn}
                containerStyle={styles.day10Btn1}
                buttonStyle={styles.day10Btn2}
              />
              <RNEButton
                title="8"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day11Btn}
                containerStyle={styles.day11Btn1}
                buttonStyle={styles.day11Btn2}
              />
              <RNEButton
                title="9"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day12Btn}
                containerStyle={styles.day12Btn1}
                buttonStyle={styles.day12Btn2}
              />
              <RNEButton
                title="10"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day13Btn}
                containerStyle={styles.day13Btn1}
                buttonStyle={styles.day13Btn2}
              />
            </View>
            <View style={[styles.week2, styles.weekFlexBox]}>
              <RNEButton
                title="11"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day14Btn}
                containerStyle={styles.day14Btn1}
                buttonStyle={styles.day14Btn2}
              />
              <RNEButton
                title="12"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day15Btn}
                containerStyle={styles.day15Btn1}
                buttonStyle={styles.day15Btn2}
              />
              <RNEButton
                title="13"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day16Btn}
                containerStyle={styles.day16Btn1}
                buttonStyle={styles.day16Btn2}
              />
              <RNEButton
                title="14"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day17Btn}
                containerStyle={styles.day17Btn1}
                buttonStyle={styles.day17Btn2}
              />
              <RNEButton
                title="15"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day18Btn}
                containerStyle={styles.day18Btn1}
                buttonStyle={styles.day18Btn2}
              />
              <RNEButton
                title="16"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day19Btn}
                containerStyle={styles.day19Btn1}
                buttonStyle={styles.day19Btn2}
              />
              <RNEButton
                title="17"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day20Btn}
                containerStyle={styles.day20Btn1}
                buttonStyle={styles.day20Btn2}
              />
            </View>
            <View style={[styles.week2, styles.weekFlexBox]}>
              <RNEButton
                title="18"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day21Btn}
                containerStyle={styles.day21Btn1}
                buttonStyle={styles.day21Btn2}
              />
              <RNEButton
                title="19"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day22Btn}
                containerStyle={styles.day22Btn1}
                buttonStyle={styles.day22Btn2}
              />
              <RNEButton
                title="20"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day23Btn}
                containerStyle={styles.day23Btn1}
                buttonStyle={styles.day23Btn2}
              />
              <RNEButton
                title="21"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day24Btn}
                containerStyle={styles.day24Btn1}
                buttonStyle={styles.day24Btn2}
              />
              <RNEButton
                title="22"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day25Btn}
                containerStyle={styles.day25Btn1}
                buttonStyle={styles.day25Btn2}
              />
              <RNEButton
                title="23"
                type="clear"
                titleStyle={styles.day26Btn}
                containerStyle={styles.day26Btn1}
                buttonStyle={styles.day26Btn2}
              />
              <RNEButton
                title="24"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day27Btn}
                containerStyle={styles.day27Btn1}
                buttonStyle={styles.day27Btn2}
              />
            </View>
            <View style={[styles.week2, styles.weekFlexBox]}>
              <RNEButton
                title="25"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day28Btn}
                containerStyle={styles.day28Btn1}
                buttonStyle={styles.day28Btn2}
              />
              <RNEButton
                title="26"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day29Btn}
                containerStyle={styles.day29Btn1}
                buttonStyle={styles.day29Btn2}
              />
              <RNEButton
                title="27"
                radius="5"
                iconPosition="left"
                type="outline"
                titleStyle={styles.day30Btn}
                containerStyle={styles.day30Btn1}
                buttonStyle={styles.day30Btn2}
              />
              <RNEButton
                title="28"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day31Btn}
                containerStyle={styles.day31Btn1}
                buttonStyle={styles.day31Btn2}
              />
              <RNEButton
                title="29"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day32Btn}
                containerStyle={styles.day32Btn1}
                buttonStyle={styles.day32Btn2}
              />
              <RNEButton
                title="30"
                radius="5"
                iconPosition="left"
                type="clear"
                titleStyle={styles.day33Btn}
                containerStyle={styles.day33Btn1}
                buttonStyle={styles.day33Btn2}
              />
              <RNEButton
                radius="5"
                iconPosition="left"
                type="clear"
                containerStyle={styles.day34Btn}
                buttonStyle={styles.day34Btn1}
              />
            </View>
            <View style={[styles.frame, styles.frameSpaceBlock]}>
              <View style={[styles.separator, styles.separatorBorder]} />
            </View>
          </View>
        </View>
        <View style={[styles.frame1, styles.frameSpaceBlock]}>
          <View style={[styles.separator1, styles.separatorBorder]} />
        </View>
      </View>
      <View style={styles.attendancetitleWrapper}>
        <View style={styles.attendancetitlePosition}>
          <Image
            style={[
              styles.attendancetitleChild,
              styles.attendancetitlePosition,
            ]}
            resizeMode="cover"
            source="Rectangle 17.png"
          />
          <Text style={styles.selectASunday}>Select a Sunday</Text>
        </View>
      </View>
      <Button
        style={[styles.backarrow, styles.backarrowPosition]}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <Pressable
        style={[styles.continuebutton, styles.backarrowPosition]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  dayBtn: {
    position: "relative",
  },
  dayBtn1: {
    width: 40,
    height: 44,
  },
  day1Btn: {
    position: "relative",
  },
  day1Btn1: {
    width: 40,
    height: 44,
  },
  day2Btn: {
    position: "relative",
  },
  day2Btn1: {
    width: 40,
    height: 44,
  },
  day3Btn: {
    position: "relative",
  },
  day3Btn1: {
    width: 40,
    height: 44,
  },
  day4Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day5Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day5Btn1: {
    position: "relative",
  },
  day5Btn2: {
    width: 40,
    height: 44,
  },
  day6Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day6Btn1: {
    position: "relative",
  },
  day6Btn2: {
    width: 40,
    height: 44,
  },
  day7Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day7Btn1: {
    position: "relative",
  },
  day7Btn2: {
    width: 40,
    height: 44,
  },
  day8Btn: {
    color: "#0a84ff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day8Btn1: {
    position: "relative",
  },
  day8Btn2: {
    width: 40,
    height: 44,
  },
  day9Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day9Btn1: {
    position: "relative",
  },
  day9Btn2: {
    width: 40,
    height: 44,
  },
  day10Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day10Btn1: {
    position: "relative",
  },
  day10Btn2: {
    width: 40,
    height: 44,
  },
  day11Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day11Btn1: {
    position: "relative",
  },
  day11Btn2: {
    width: 40,
    height: 44,
  },
  day12Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day12Btn1: {
    position: "relative",
  },
  day12Btn2: {
    width: 40,
    height: 44,
  },
  day13Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day13Btn1: {
    position: "relative",
  },
  day13Btn2: {
    width: 40,
    height: 44,
  },
  day14Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day14Btn1: {
    position: "relative",
  },
  day14Btn2: {
    width: 40,
    height: 44,
  },
  day15Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day15Btn1: {
    position: "relative",
  },
  day15Btn2: {
    width: 40,
    height: 44,
  },
  day16Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day16Btn1: {
    position: "relative",
  },
  day16Btn2: {
    width: 40,
    height: 44,
  },
  day17Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day17Btn1: {
    position: "relative",
  },
  day17Btn2: {
    width: 40,
    height: 44,
  },
  day18Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day18Btn1: {
    position: "relative",
  },
  day18Btn2: {
    width: 40,
    height: 44,
  },
  day19Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day19Btn1: {
    position: "relative",
  },
  day19Btn2: {
    width: 40,
    height: 44,
  },
  day20Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day20Btn1: {
    position: "relative",
  },
  day20Btn2: {
    width: 40,
    height: 44,
  },
  day21Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day21Btn1: {
    position: "relative",
  },
  day21Btn2: {
    width: 40,
    height: 44,
  },
  day22Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day22Btn1: {
    position: "relative",
  },
  day22Btn2: {
    width: 40,
    height: 44,
  },
  day23Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day23Btn1: {
    position: "relative",
  },
  day23Btn2: {
    width: 40,
    height: 44,
  },
  day24Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day24Btn1: {
    position: "relative",
  },
  day24Btn2: {
    width: 40,
    height: 44,
  },
  day25Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day25Btn1: {
    position: "relative",
  },
  day25Btn2: {
    width: 40,
    height: 44,
  },
  day26Btn: {
    color: "#0a84ff",
    fontSize: 24,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
  },
  day26Btn1: {
    position: "relative",
  },
  day26Btn2: {
    width: 40,
    height: 44,
  },
  day27Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day27Btn1: {
    position: "relative",
  },
  day27Btn2: {
    width: 40,
    height: 44,
  },
  day28Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day28Btn1: {
    position: "relative",
  },
  day28Btn2: {
    width: 40,
    height: 44,
  },
  day29Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day29Btn1: {
    position: "relative",
  },
  day29Btn2: {
    width: 40,
    height: 44,
  },
  day30Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day30Btn1: {
    position: "relative",
  },
  day30Btn2: {
    width: 40,
    height: 44,
  },
  day31Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day31Btn1: {
    position: "relative",
  },
  day31Btn2: {
    width: 40,
    height: 44,
  },
  day32Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day32Btn1: {
    position: "relative",
  },
  day32Btn2: {
    width: 40,
    height: 44,
  },
  day33Btn: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  day33Btn1: {
    position: "relative",
  },
  day33Btn2: {
    width: 40,
    height: 44,
  },
  day34Btn: {
    position: "relative",
  },
  day34Btn1: {
    width: 40,
    height: 44,
  },
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  dateFlexBox: {
    justifyContent: "center",
    alignItems: "center",
  },
  arrowsPosition: {
    top: "50%",
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
  },
  nextTypo: {
    height: 24,
    width: 15,
    fontSize: 20,
    color: "#0a84ff",
    textAlign: "center",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  monthYyyyTypo: {
    textAlign: "left",
    letterSpacing: 0,
    fontFamily: "Roboto-Bold",
    fontWeight: "600",
    lineHeight: 22,
    fontSize: 17,
  },
  weekFlexBox: {
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    flexDirection: "row",
    alignSelf: "stretch",
  },
  frameSpaceBlock: {
    paddingLeft: 16,
    alignSelf: "stretch",
  },
  separatorBorder: {
    borderBottomWidth: 0.3,
    borderColor: "rgba(84, 84, 88, 0.65)",
    borderStyle: "solid",
    alignSelf: "stretch",
  },
  attendancetitlePosition: {
    left: "0%",
    bottom: "0%",
    right: "0%",
    top: "0%",
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  backarrowPosition: {
    left: "4.07%",
    position: "absolute",
  },
  youCanOnly: {
    height: "14.08%",
    width: "83.21%",
    top: "65.85%",
    left: "7.12%",
    display: "flex",
    color: "#8e8e93",
    alignItems: "center",
    textAlign: "center",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
    letterSpacing: -0.2,
    fontSize: 17,
    position: "absolute",
  },
  next: {
    marginLeft: 28,
  },
  arrows: {
    marginTop: -13,
    right: 16,
    flexDirection: "row",
  },
  monthYyyy: {
    color: "#fff",
  },
  disclosure: {
    marginLeft: 4,
    color: "#0a84ff",
    textAlign: "left",
    letterSpacing: 0,
  },
  monthAndYear: {
    marginTop: -12,
    left: 16,
    flexDirection: "row",
  },
  header: {
    alignSelf: "stretch",
    flex: 1,
  },
  sun: {
    fontSize: 13,
    lineHeight: 18,
    textTransform: "uppercase",
    color: "rgba(235, 235, 245, 0.3)",
    width: 32,
    height: 18,
    fontFamily: "Roboto-Bold",
    fontWeight: "600",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
  },
  dateHeader: {
    height: 20,
    paddingVertical: 0,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    width: 361,
    flexDirection: "row",
    alignItems: "center",
  },
  week2: {
    marginTop: 7,
  },
  separator: {
    height: 11,
  },
  frame: {
    marginTop: 7,
  },
  calendar: {
    paddingTop: 3,
    width: 361,
  },
  date: {
    height: 339,
    paddingTop: 6,
    alignSelf: "stretch",
  },
  separator1: {
    height: 0,
  },
  frame1: {
    justifyContent: "center",
    alignItems: "center",
  },
  pickerDateAndTimeInlin: {
    height: "35.36%",
    width: "91.86%",
    top: "26.06%",
    right: "5.34%",
    bottom: "38.58%",
    left: "2.8%",
    position: "absolute",
    backgroundColor: "#000",
    alignItems: "center",
  },
  attendancetitleChild: {
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  selectASunday: {
    height: "60.56%",
    width: "91.43%",
    top: "19.72%",
    left: "4.29%",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    color: "#8e8e93",
    position: "absolute",
  },
  attendancetitleWrapper: {
    height: "8.33%",
    width: "71.25%",
    top: "13.15%",
    right: "20.1%",
    bottom: "78.52%",
    left: "8.65%",
    position: "absolute",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    overflow: "hidden",
  },
  continue: {
    color: "#fff",
    textAlign: "center",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
    letterSpacing: -0.2,
    fontSize: 17,
  },
  continuebutton: {
    height: "5.87%",
    width: "91.09%",
    top: "83.57%",
    right: "4.83%",
    bottom: "10.56%",
    backgroundColor: "#333",
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    borderStyle: "solid",
    left: "4.07%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  requestweek: {
    borderRadius: 30,
    height: 852,
    overflow: "hidden",
    width: "100%",
    flex: 1,
    backgroundColor: "#000",
  },
});

export default RequestWeek;
