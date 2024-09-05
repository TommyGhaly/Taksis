import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const HomeScreenContent = ({ curDate, gospel, praxis, catholic, pauline, sixth, third, matins, water, wine, nextDate, nextRole }) => {
    return (
        <View style={styles.homescreencontent}>
            <Image style={styles.image} resizeMode="cover" source={require("../assets/Rectangle 17.png")} />
            <Text style={styles.header}>Your Next Service</Text>
            <Text style={styles.date}>{curDate}</Text>

            <Text style={styles.sectionTitle}>Readings</Text>
            <Text style={styles.subtext}>Gospel: {gospel}</Text>
            <Text style={styles.subtext}>Praxis: {praxis}</Text>
            <Text style={styles.subtext}>Catholic Epistle: {catholic}</Text>
            <Text style={styles.subtext}>Pauline Epistle: {pauline}</Text>
            <Text style={styles.subtext}>6th Hour Gospel: {sixth}</Text>
            <Text style={styles.subtext}>3rd Hour Gospel: {third}</Text>
            <Text style={styles.subtext}>Matins Gospel: {matins}</Text>

            <View style={styles.separator} />

            <Text style={styles.waterWine}>Water: {water}</Text>
            <Text style={styles.waterWine}>Wine: {wine}</Text>

            <View style={styles.separator} />

            <Text style={styles.roleTitle}>Role</Text>
            <Text style={styles.date}>{nextDate}</Text>
            <Text style={styles.role}>{nextRole}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    homescreencontent: {
        padding: 16,             // Adds padding around the content
        backgroundColor: "#1e1e1e",  // Dark background for contrast
        borderRadius: 10,        // Rounds corners for better aesthetics
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        elevation: 5,            // Adds a shadow for better depth
    },
    image: {
        width: "100%",
        height: 200,
        borderRadius: 10,
        marginBottom: 16,        // Adds space below the image
    },
    header: {
        fontSize: 24,
        color: "#ffffff",
        textAlign: "center",
        marginBottom: 16,
    },
    date: {
        fontSize: 18,
        color: "#8e8e93",
        textAlign: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        color: "#ffffff",
        marginBottom: 8,
    },
    subtext: {
        fontSize: 16,
        color: "#8e8e93",
        marginBottom: 8,
    },
    waterWine: {
        fontSize: 16,
        color: "#ffffff",
        marginBottom: 8,
    },
    separator: {
        height: 1,
        backgroundColor: "#8e8e93",
        marginVertical: 16,     // Adds space between sections
    },
    roleTitle: {
        fontSize: 18,
        color: "#ffffff",
        textAlign: "center",
        marginBottom: 16,
    },
    role: {
        fontSize: 16,
        color: "#ffffff",
        textAlign: "center",
    },
});

export default HomeScreenContent;
