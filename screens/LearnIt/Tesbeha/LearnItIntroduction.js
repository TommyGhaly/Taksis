import * as React from "react";
import { StyleSheet, View, Text, Pressable, Image } from "react-native";
import { Button } from "react-native-paper";

const LearnItIntroduction = () => {
  return (
    <View style={styles.learnitmatins}>
      <View style={styles.rectangleParent}>
        <View style={styles.frameChild} />
        <Text style={styles.matins}>Matins</Text>
      </View>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <View style={[styles.component7, styles.componentLayout]}>
        <Text
          style={[styles.thisIsWhere, styles.thisTypo]}
        >{`This is where some english translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere1, styles.thisTypo]}
        >{`This is where some English-coptic translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere2, styles.thisTypo]}
        >{`This is where some coptic translation of whatever they are sayign will go `}</Text>
        <Text style={[styles.englishAudio, styles.audioTypo]}>
          English Audio
        </Text>
        <Text style={[styles.copticAudio, styles.audioTypo]}>Coptic Audio</Text>
        <Image
          style={[styles.component7Child, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23516.png"
        />
        <Image
          style={[styles.component7Item, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23517.png"
        />
      </View>
      <View style={[styles.component8, styles.componentPosition]}>
        <Text
          style={[styles.thisIsWhere, styles.thisTypo]}
        >{`This is where some english translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere1, styles.thisTypo]}
        >{`This is where some English-coptic translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere2, styles.thisTypo]}
        >{`This is where some coptic translation of whatever they are sayign will go `}</Text>
        <Text style={[styles.englishAudio, styles.audioTypo]}>
          English Audio
        </Text>
        <Text style={[styles.copticAudio, styles.audioTypo]}>Coptic Audio</Text>
        <Image
          style={[styles.component7Child, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23516.png"
        />
        <Image
          style={[styles.component7Item, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23517.png"
        />
      </View>
      <View style={[styles.component9, styles.componentLayout]}>
        <Text
          style={[styles.thisIsWhere, styles.thisTypo]}
        >{`This is where some english translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere1, styles.thisTypo]}
        >{`This is where some English-coptic translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere2, styles.thisTypo]}
        >{`This is where some coptic translation of whatever they are sayign will go `}</Text>
        <Text style={[styles.englishAudio, styles.audioTypo]}>
          English Audio
        </Text>
        <Text style={[styles.copticAudio, styles.audioTypo]}>Coptic Audio</Text>
        <Image
          style={[styles.component7Child, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23516.png"
        />
        <Image
          style={[styles.component7Item, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23517.png"
        />
      </View>
      <View style={[styles.component10, styles.componentPosition]}>
        <Text
          style={[styles.thisIsWhere, styles.thisTypo]}
        >{`This is where some english translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere1, styles.thisTypo]}
        >{`This is where some English-coptic translation of whatever they are sayign will go `}</Text>
        <Text
          style={[styles.thisIsWhere2, styles.thisTypo]}
        >{`This is where some coptic translation of whatever they are sayign will go `}</Text>
        <Text style={[styles.englishAudio, styles.audioTypo]}>
          English Audio
        </Text>
        <Text style={[styles.copticAudio, styles.audioTypo]}>Coptic Audio</Text>
        <Image
          style={[styles.component7Child, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23516.png"
        />
        <Image
          style={[styles.component7Item, styles.component7Layout]}
          resizeMode="cover"
          source="Frame 23517.png"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  componentLayout: {
    height: 215,
    width: 362,
    left: 16,
    position: "absolute",
  },
  thisTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Inter-Regular",
    fontSize: 16,
    width: "29.28%",
    top: "0%",
    position: "absolute",
  },
  audioTypo: {
    color: "#fff",
    letterSpacing: 0,
    fontSize: 17,
    top: "87.91%",
    fontFamily: "Inter-Regular",
    textAlign: "center",
    lineHeight: 22,
    position: "absolute",
  },
  component7Layout: {
    maxHeight: "100%",
    maxWidth: "100%",
    top: "86.05%",
    width: "8.29%",
    height: "13.95%",
    overflow: "hidden",
    bottom: "0%",
    position: "absolute",
  },
  componentPosition: {
    left: 15,
    height: 215,
    width: 362,
    position: "absolute",
  },
  frameChild: {
    height: "100%",
    right: "0%",
    borderRadius: 10,
    backgroundColor: "#8e8e93",
    left: "0%",
    bottom: "0%",
    top: "0%",
    position: "absolute",
    width: "100%",
  },
  matins: {
    height: "57.87%",
    width: "31.26%",
    top: "21.05%",
    left: "34.17%",
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Roboto-Bold",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    lineHeight: 22,
    position: "absolute",
  },
  rectangleParent: {
    height: "8.8%",
    width: "82.7%",
    top: "14.08%",
    right: "8.65%",
    bottom: "77.11%",
    left: "8.65%",
    position: "absolute",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    overflow: "hidden",
    position: "absolute",
  },
  thisIsWhere: {
    left: "0%",
  },
  thisIsWhere1: {
    left: "35.36%",
  },
  thisIsWhere2: {
    left: "70.72%",
  },
  englishAudio: {
    left: "6.63%",
  },
  copticAudio: {
    left: "54.42%",
  },
  component7Child: {
    right: "54.7%",
    left: "37.02%",
  },
  component7Item: {
    right: "6.35%",
    left: "85.36%",
  },
  component7: {
    top: 253,
  },
  component8: {
    top: 490,
  },
  component9: {
    top: 727,
  },
  component10: {
    top: 964,
  },
  learnitmatins: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    width: "100%",
  },
});

export default LearnItIntroduction;
