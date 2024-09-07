import React, { useState, useEffect } from "react";
import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from "react-native";
import HomeScreenContent from "../../components/homeScreenContent";
import WeekRequest from "../../components/weekRequest";
import { useUser } from "../../UserContext";
import { Ionicons } from '@expo/vector-icons';  // Using Ionicons for icons

const HomeScreen = ({ route }) => {
  const { user } = useUser();

  // Function to format date as MM/DD/YYYY
  const formatDate = (date) => {
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();

    return `${month < 10 ? `0${month}` : month}/${day < 10 ? `0${day}` : day}/${year}`;
  };

  // Get the current date and the next service date (e.g., 7 days later)
  const [curDate, setCurDate] = useState(formatDate(new Date()));
  const [nextDate, setNextDate] = useState(
    formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7 days later
  );

  useEffect(() => {
    // Update dates every day when the component renders or updates
    const today = new Date();
    setCurDate(formatDate(today));
    setNextDate(formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000))); // 7 days from today
  }, []);

  const inputProps = {
    matins: "First Last",
    third: "First Last",
    sixth: "First Last",
    pauline: "First Last",
    catholic: "First Last",
    praxis: "First Last",
    gospel: "First Last",
    water: "First Last",
    wine: "First Last",
    curDate, // Current date
    nextDate, // Next service date
    nextRole: "Your Role Here",  // User's role for the next service
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.homescreen}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.header}>Services of Week{"\n"}{inputProps.curDate}</Text>

        {/* Section for Readings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Readings</Text>

          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Matins: {inputProps.matins}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Third Hour: {inputProps.third}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Sixth Hour: {inputProps.sixth}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Pauline Epistle: {inputProps.pauline}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Catholic Epistle: {inputProps.catholic}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Praxis: {inputProps.praxis}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Gospel: {inputProps.gospel}</Text>
          </View>
        </View>

        {/* Section for Offerings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offering of the Lamb</Text>

          <View style={styles.card}>
            <Ionicons name="water" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Water: {inputProps.water}</Text>
          </View>
          <View style={styles.card}>
            <Ionicons name="wine" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.name}>Wine: {inputProps.wine}</Text>
          </View>
        </View>

        {/* Box for Next Service Week */}
        <View style={styles.nextServiceBox}>
          <Text style={styles.nextServiceHeader}>Next Service Week</Text>
          <Text style={styles.nextServiceText}>
            Your next service is on: {inputProps.nextDate}
          </Text>
          <Text style={styles.nextServiceText}>Role: {inputProps.nextRole}</Text>
        </View>

        {/* Request a Week Button */}
        <TouchableOpacity style={styles.requestButton}>
          <Text style={styles.requestButtonText}>Request a Week</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.blackspace} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",  // Very dark grey background
  },
  scrollContainer: {
    paddingBottom: 20,  // Padding at the bottom for better spacing
  },
  homescreen: {
    flex: 1,
    width: "100%",
  },
  header: {
    fontSize: 28,
    color: "#e0e0e0",  // Light gray for text
    textAlign: "center",
    marginVertical: 20,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    color: "#4d9cff",  // Soft blue for section titles
    marginBottom: 10,
    fontWeight: "bold",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2c2c",  // Darker card background
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,  // Slightly lighter shadow for variety
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    marginRight: 10,
  },
  name: {
    fontSize: 18,
    color: "#e0e0e0",  // Light gray for text
  },
  nextServiceBox: {
    backgroundColor: "#333333",  // Dark gray background for the box
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,  // Slightly lighter shadow for variety
    shadowRadius: 4,
    elevation: 4,
  },
  nextServiceHeader: {
    fontSize: 20,
    color: "#4d9cff",  // Soft blue for header
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  nextServiceText: {
    fontSize: 16,
    color: "#e0e0e0",  // Light gray for text
    textAlign: "center",
    marginBottom: 5,
  },
  // Request button styles
  requestButton: {
    backgroundColor: "#147efb",  // Soft blue button color
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,  // Rounded button
    marginVertical: 20,
    alignSelf: "center",  // Center the button horizontally
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,  // Lighter elevation for a softer look
  },
  requestButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
  },
  blackspace: {
    height: 0,
    backgroundColor: "#1a1a1a",  // Matching background color for spacing
  },
});

export default HomeScreen;
