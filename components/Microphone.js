import * as React from "react";
import {StyleSheet, View} from "react-native";

const Microphone = () => {
    return (
        <View style={[styles.rectangleView,
                        styles.lineView, 
                        styles.vectorView,
                        styles.bottomLine,
                        styles.leftLine, 
                        styles.rightLine]} />
    );
};


const style = StyleSheet.create({
    rectangleView: {
        borderRadius: 4,
        backgroundColor: "#8e8e93",
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 11
    },
    lineView: {
        backgroundColor: "#8e8e93",
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderTopWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 2,
        transform: [
            {
                rotate: "90deg"
            }
        ]
    },
    vectorView: {
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 6
    },
    bottomLine: {
        backgroundColor: "#8e8e93",
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 2
    },
    leftLine: {
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 2,
        transform: [
            {
                rotate: "90deg"
            }
        ]
    },
    rightLine: {
        borderStyle: "solid",
        borderColor: "#8e8e93",
        borderWidth: 1.5,
        flex: 1,
        width: "100%",
        height: 2,
        transform: [
            {
                rotate: "90deg"
            }
        ]
    }

});


export default Microphone;