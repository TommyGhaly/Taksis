import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import { COLOR_OPTIONS } from "../../components/TrafficVehicleComponents";

const ACCENT = "#147EFB";
const MAX_DRIVERS = 5;

const emptyDriver = () => ({ name: "", phone: "", has_taksis: false });

const RegisterVehicle = ({ navigation }) => {
  const [church, setChurch] = useState(null);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [drivers, setDrivers] = useState([emptyDriver()]);
  // Prefilled driver 1 from the user's profile, reused when registering another
  const [profileDriver, setProfileDriver] = useState(emptyDriver());
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pull the signed-in user's church + prefill driver 1 from their profile
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    getDoc(doc(getFirestore(), "users", user.uid))
      .then((doc) => {
        const data = doc.data() || {};
        setChurch(data.church || null);
        const prefilled = {
          name: data.name || "",
          phone: data.phone || "",
          // The signed-in user is a Taksis user by definition, so default on
          has_taksis: true,
        };
        setProfileDriver(prefilled);
        setDrivers((prev) => {
          const next = [...prev];
          next[0] = prefilled;
          return next;
        });
      })
      .catch((e) => console.error("Error loading profile:", e));
  }, []);

  const setDriverCount = (n) => {
    setDrivers((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      const next = [...prev];
      while (next.length < n) next.push(emptyDriver());
      return next;
    });
  };

  const updateDriver = (index, field, value) => {
    setDrivers((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const toggleColor = (value) => setColor((cur) => (cur === value ? "" : value));

  const resetForm = () => {
    setPlate("");
    setMake("");
    setModel("");
    setColor("");
    setDrivers([{ ...profileDriver }]);
    setErrors({});
    setSubmitted(false);
  };

  const validate = () => {
    const next = {};
    if (!plate.trim()) next.plate = "License plate is required.";

    const d1 = drivers[0];
    if (!d1.name.trim()) next.d0name = "Required.";
    else if (d1.name.trim().split(/\s+/).length < 2)
      next.d0name = "Please enter first and last name.";
    if (!d1.phone.trim()) next.d0phone = "Required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert("Error", "You must be signed in to register a vehicle.");
      return;
    }
    if (!church) {
      Alert.alert(
        "No church set",
        "We couldn't find your church. Please set your church in settings and try again."
      );
      return;
    }

    setIsLoading(true);
    try {
      const cleanedDrivers = drivers
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          phone: d.phone.trim(),
          has_taksis: !!d.has_taksis,
        }));

      const payload = {
        church,
        license: plate.trim().toUpperCase(),
        drivers: cleanedDrivers,
        present: false,
        status: "pending",
        created_at: serverTimestamp(),
      };
      if (make.trim()) payload.make = make.trim();
      if (model.trim()) payload.model = model.trim();
      if (color) payload.color = color;

      await addDoc(collection(getFirestore(), "pending_registrations"), payload);
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting registration:", error);
      Alert.alert("Submission failed", "Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <BackArrow style={styles.backArrow} />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Icon name="check" size={34} color="#34c759" />
          </View>
          <Text style={styles.successTitle}>Registration Submitted</Text>
          <Text style={styles.successText}>
            Your vehicle is pending approval. Once reviewed, your license plate
            will be recognized automatically at the lot — no sticker needed.
          </Text>
          <Pressable style={styles.doneButton} onPress={resetForm}>
            <Text style={styles.submitText}>Register another vehicle</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <BackArrow style={styles.backArrow} />
          <Text style={styles.eyebrow}>CHURCH PARKING PROGRAM</Text>
          <Text style={styles.title}>Register Vehicle</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* How it works */}
          <View style={styles.infoCard}>
            <Icon
              name="camera-outline"
              size={20}
              color={ACCENT}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.infoText}>
              <Text style={styles.infoStrong}>How it works — </Text>
              By submitting this form, your vehicle is registered for the church
              parking program.{" "}
              <Text style={styles.infoStrong}>
                No stickers are placed on your car.
              </Text>{" "}
              Your license plate is simply scanned by camera at the lot to
              confirm your registration.
            </Text>
          </View>

          {/* Vehicle Information */}
          <Text style={styles.sectionTitle}>VEHICLE INFORMATION</Text>

          <Field label="License Plate" required error={errors.plate}>
            <TextInput
              style={[
                styles.input,
                styles.plateInput,
                errors.plate && styles.inputError,
              ]}
              value={plate}
              onChangeText={(t) => setPlate(t)}
              placeholder="e.g. NH-ABC1234"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </Field>

          <View style={styles.twoCol}>
            <Field label="Make" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={make}
                onChangeText={setMake}
                placeholder="e.g. Toyota"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </Field>
            <Field label="Model" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="e.g. Camry"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </Field>
          </View>

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map((c) => {
              const selected = color === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.colorChip, selected && styles.colorChipSelected]}
                  onPress={() => toggleColor(c.value)}
                >
                  <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                  <Text
                    style={[
                      styles.colorLabel,
                      selected && styles.colorLabelSelected,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Drivers */}
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>DRIVERS</Text>

          <Text style={styles.fieldLabel}>Number of Drivers</Text>
          <View style={styles.countRow}>
            {Array.from({ length: MAX_DRIVERS }, (_, i) => i + 1).map((n) => {
              const active = drivers.length === n;
              return (
                <Pressable
                  key={n}
                  style={[styles.countPill, active && styles.countPillActive]}
                  onPress={() => setDriverCount(n)}
                >
                  <Text
                    style={[
                      styles.countText,
                      active && styles.countTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {drivers.map((driver, index) => (
            <View key={index} style={styles.driverBlock}>
              <View style={styles.driverHead}>
                <View style={styles.driverNum}>
                  <Text style={styles.driverNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.driverHeadLabel}>Driver {index + 1}</Text>
              </View>
              <View style={styles.driverBody}>
                <Field
                  label="Full Name"
                  required={index === 0}
                  error={index === 0 ? errors.d0name : undefined}
                >
                  <TextInput
                    style={[
                      styles.input,
                      index === 0 && errors.d0name && styles.inputError,
                    ]}
                    value={driver.name}
                    onChangeText={(t) => updateDriver(index, "name", t)}
                    placeholder="First and last name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </Field>
                <Field
                  label="Phone Number"
                  required={index === 0}
                  error={index === 0 ? errors.d0phone : undefined}
                >
                  <TextInput
                    style={[
                      styles.input,
                      index === 0 && errors.d0phone && styles.inputError,
                    ]}
                    value={driver.phone}
                    onChangeText={(t) => updateDriver(index, "phone", t)}
                    placeholder="(xxx) xxx-xxxx"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="phone-pad"
                  />
                </Field>

                <Pressable
                  style={[
                    styles.taksisToggle,
                    driver.has_taksis && styles.taksisToggleOn,
                  ]}
                  onPress={() =>
                    updateDriver(index, "has_taksis", !driver.has_taksis)
                  }
                >
                  <View
                    style={[
                      styles.pill,
                      driver.has_taksis && styles.pillOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.knob,
                        driver.has_taksis && styles.knobOn,
                      ]}
                    />
                  </View>
                  <Text style={styles.taksisText}>
                    <Text style={styles.taksisBold}>Taksis App</Text> — I have it
                    installed{" "}
                    <Text style={styles.taksisMuted}>(optional)</Text>
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            style={[styles.submitButton, isLoading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Registration</Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// Small labeled-field wrapper
const Field = ({ label, required, error, children, style }) => (
  <View style={[styles.field, style]}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.req}> *</Text>}
    </Text>
    {children}
    {error ? <Text style={styles.errText}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 6,
  },
  backArrow: {
    marginTop: 30,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: ACCENT,
    marginTop: 18,
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  infoCard: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: "rgba(20,126,251,0.08)",
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.22)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.6)",
  },
  infoStrong: {
    color: "#fff",
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.42)",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  req: {
    color: "#ff453a",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: "#fff",
  },
  plateInput: {
    fontWeight: "700",
    letterSpacing: 1,
  },
  inputError: {
    borderColor: "#ff453a",
  },
  errText: {
    fontSize: 12,
    color: "#ff453a",
    marginTop: 6,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  colorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  colorChipSelected: {
    borderColor: ACCENT,
    backgroundColor: "rgba(20,126,251,0.15)",
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  colorLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  colorLabelSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  countRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  countPill: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(20,126,251,0.15)",
  },
  countText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  countTextActive: {
    color: "#fff",
  },
  driverBlock: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  driverHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  driverNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  driverNumText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  driverHeadLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  driverBody: {
    padding: 14,
  },
  taksisToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  taksisToggleOn: {
    borderColor: "rgba(20,126,251,0.35)",
    backgroundColor: "rgba(20,126,251,0.05)",
  },
  pill: {
    width: 36,
    height: 21,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: 3,
    justifyContent: "center",
  },
  pillOn: {
    backgroundColor: ACCENT,
  },
  knob: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  knobOn: {
    backgroundColor: "#fff",
    alignSelf: "flex-end",
  },
  taksisText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.6)",
  },
  taksisBold: {
    color: "#fff",
    fontWeight: "600",
  },
  taksisMuted: {
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
  },
  submitButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  // Success
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(52,199,89,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  successText: {
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  secondaryButton: {
    height: 46,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
});

export default RegisterVehicle;
