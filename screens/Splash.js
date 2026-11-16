import * as React from "react";
import { ImageBackground, Text, View } from "react-native";
import { makeStyles } from "../theme";

const Splash = () => {
  const styles = useStyles();
  return (
    <View style={styles.splash}>
      <ImageBackground
        style={styles.dioceselogoIcon}
        resizeMode="cover"
        source={require("../assets/dioceseLogo.png")}
      />
      <Text
        style={styles.sponsoredBySt}
      >{`Sponsored by: St. Philopater & St. Mina
        				Coptic Orthodox Church, Wayland, MA`}</Text>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  dioceselogoIcon: {
    top: "17.02%",
    right: "14.5%",
    bottom: "50.12%",
    left: "14.25%",
    borderRadius: 140,
    position: "absolute",
  },
  sponsoredBySt: {
    top: "83.33%",
    left: "9.92%",
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "rgba(142, 142, 147, 0.75)",
    textAlign: "center",
    position: "absolute",
  },
  splash: {
    backgroundColor: t.isDark ? "#000" : t.background,
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
}));

export default Splash;
