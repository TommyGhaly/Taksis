import React, { useState, useEffect, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import callFunction from "../components/functionCalls";

const DEFAULT_PROFILE = require("../assets/default_profile.png");
const NOTIFICATION_URL = "https://us-central1-taksis-a8ba7.cloudfunctions.net/traffic_notification";

const TrafficManager = () => {
  const user = auth().currentUser;
  const [permission, requestPermission] = useCameraPermissions();

  const [churchId, setChurchId] = useState(null);
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loading, setLoading] = useState(true);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [registrationVisible, setRegistrationVisible] = useState(false);
  const [currentQrId, setCurrentQrId] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [licensePlate, setLicensePlate] = useState("");
  const [missingPhones, setMissingPhones] = useState({});
  const [registrationStep, setRegistrationStep] = useState("select");
  const [saving, setSaving] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editLicense, setEditLicense] = useState("");
  const [editDrivers, setEditDrivers] = useState([]);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [driverTokens, setDriverTokens] = useState({});



  useEffect(() => {
    const unsub = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (data?.church) setChurchId(data.church);
        }
      });
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("qrCodes")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.license || "").localeCompare(b.license || ""));
        setCars(list);
        setLoading(false);
        list.forEach((c) => (c.ownerIds || []).forEach(fetchProfileImage));
      });
    return unsub;
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("users")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs
          .map((doc) => ({ uid: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setUsers(list);
        list.forEach((u) => fetchProfileImage(u.uid));
      });
    return unsub;
  }, [churchId]);

  const fetchProfileImage = async (uid) => {
    if (!uid || imageUrls[uid]) return;
    try {
      const url = await storage()
        .ref(`profilePictures/${uid}.png`)
        .getDownloadURL();
      setImageUrls((prev) => ({ ...prev, [uid]: url }));
    } catch {}
  };

  const getUserById = useCallback(
    (uid) => users.find((u) => u.uid === uid),
    [users]
  );

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to scan QR codes."
        );
        return;
      }
    }
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      if (scanned) return;
      setScanned(true);
      setScannerVisible(false);

      const existing = cars.find((c) => c.id === data);
      if (existing) {
        setSelectedCar(existing);
        setDetailModalVisible(true);
      } else {
        setCurrentQrId(data);
        setSelectedDrivers([]);
        setLicensePlate("");
        setMissingPhones({});
        setRegistrationStep("select");
        setRegistrationVisible(true);
      }
    },
    [scanned, cars]
  );

  const toggleDriverSelection = (uid) => {
    setSelectedDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const proceedToPhones = () => {
    if (selectedDrivers.length === 0) {
      Alert.alert("Select Drivers", "Please select at least one driver.");
      return;
    }
    const missing = {};
    selectedDrivers.forEach((uid) => {
      const u = getUserById(uid);
      if (!u?.phone) missing[uid] = "";
    });
    if (Object.keys(missing).length > 0) {
      setMissingPhones(missing);
      setRegistrationStep("phones");
    } else {
      setRegistrationStep("license");
    }
  };

  const proceedToLicense = () => {
    const empty = Object.entries(missingPhones).filter(([_, p]) => !p.trim());
    if (empty.length > 0) {
      Alert.alert(
        "Missing Information",
        "Please enter phone numbers for all drivers."
      );
      return;
    }
    setRegistrationStep("license");
  };

  const completeRegistration = async () => {
    if (!licensePlate.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter the license plate number."
      );
      return;
    }
    setSaving(true);
    try {
      const updates = Object.entries(missingPhones).map(([uid, phone]) =>
        firestore().collection("users").doc(uid).update({ phone: phone.trim() })
      );
      await Promise.all(updates);
      await firestore().collection("qrCodes").doc(currentQrId).set({
        church: churchId,
        license: licensePlate.trim().toUpperCase(),
        ownerIds: selectedDrivers,
      });
      setRegistrationVisible(false);
    } catch (err) {
      Alert.alert("Error", "Failed to register vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (car) => {
    setEditLicense(car.license || "");
    setEditDrivers([...(car.ownerIds || [])]);
    setEditingCar(car);
    setDetailModalVisible(false);
    setTimeout(() => setEditModalVisible(true), 0);
  };

  const toggleEditDriver = (uid) => {
    setEditDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const saveEdit = async () => {
    if (!editLicense.trim()) {
      Alert.alert("Missing Information", "Please enter the license plate.");
      return;
    }
    if (editDrivers.length === 0) {
      Alert.alert("Select Drivers", "Please select at least one driver.");
      return;
    }
    setSaving(true);
    try {
      await firestore().collection("qrCodes").doc(editingCar.id).update({
        license: editLicense.trim().toUpperCase(),
        ownerIds: editDrivers,
      });
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert("Error", "Failed to update vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (car) => {
    Alert.alert(
      "Delete Vehicle?",
      `Remove ${car.license || "this vehicle"} permanently?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            firestore().collection("qrCodes").doc(car.id).delete();
            setDetailModalVisible(false);
            setEditModalVisible(false);
          },
        },
      ]
    );
  };

  const callDriver = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  };

  const checkDriverTokens = async (ownerIds) => {
    const tokens = {};
    await Promise.all(
      ownerIds.map(async (uid) => {
        try {
          const doc = await firestore().collection("users").doc(uid).get();
          const data = doc.data();
          if (data?.fcmTokens && Object.keys(data.fcmTokens).length > 0) {
            tokens[uid] = data.fcmTokens;
          }
        } catch {}
      })
    );
    setDriverTokens(tokens);
  };

  // Notification state
  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

  const openNotify = (uid) => {
    const tokens = driverTokens[uid];
    if (!tokens || Object.keys(tokens).length === 0) return;
    setNotifyTokens(Object.values(tokens));
    setNotifyTitle("Please Move Your Car");
    setNotifyMsg("Your vehicle is blocking traffic. Please move it as soon as possible.");
    setDetailModalVisible(false);
    setNotifyVisible(true);
  };

  const sendNotify = () => {
    if (!notifyTitle.trim() || !notifyMsg.trim()) {
      Alert.alert("Missing Info", "Please enter title and message.");
      return;
    }
    callFunction(
      user,
      NOTIFICATION_URL,
      { tokens: notifyTokens, title: notifyTitle.trim(), message: notifyMsg.trim() },
      "Failed to send notification."
    );
    setNotifyVisible(false);
    Alert.alert("Sent", "Notification sent.");
  };

  const openCarDetail = (car) => {
    setSelectedCar(car);
    setDriverTokens({});
    setDetailModalVisible(true);
    checkDriverTokens(car.ownerIds || []);
  };

  const getImageSource = (uid) =>
    imageUrls[uid] ? { uri: imageUrls[uid] } : DEFAULT_PROFILE;

  const renderCarItem = ({ item }) => {
    const ownerIds = item.ownerIds || [];
    const owners = ownerIds.map(getUserById).filter(Boolean);
    const visible = ownerIds.slice(0, 3);
    const extra = ownerIds.length - 3;

    return (
      <TouchableOpacity
        style={s.carItem}
        onPress={() => openCarDetail(item)}
        activeOpacity={0.7}
      >
        <View style={s.avatarStack}>
          {visible.map((uid, i) => (
            <Image
              key={uid}
              source={getImageSource(uid)}
              style={[
                s.stackedAvatar,
                { marginLeft: i > 0 ? -18 : 0, zIndex: 3 - i },
              ]}
            />
          ))}
          {extra > 0 && (
            <View style={s.extraBadge}>
              <Text style={s.extraText}>+{extra}</Text>
            </View>
          )}
        </View>
        <View style={s.carInfo}>
          <Text style={s.licensePlate}>{item.license || "No Plate"}</Text>
          <Text style={s.ownerNames} numberOfLines={1}>
            {owners.map((o) => o.name).join(", ") || "Unknown"}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color="rgba(255,255,255,0.25)" />
      </TouchableOpacity>
    );
  };

  const renderUserSelect = ({ item }) => {
    const selected = (
      registrationVisible ? selectedDrivers : editDrivers
    ).includes(item.uid);
    const onPress = registrationVisible
      ? toggleDriverSelection
      : toggleEditDriver;
    return (
      <TouchableOpacity
        style={[s.userRow, selected && s.userRowSelected]}
        onPress={() => onPress(item.uid)}
        activeOpacity={0.7}
      >
        <Image source={getImageSource(item.uid)} style={s.userAvatar} />
        <View style={s.userInfo}>
          <Text style={s.userName}>{item.name}</Text>
          {item.phone && <Text style={s.userPhone}>{item.phone}</Text>}
        </View>
        <View style={[s.radio, selected && s.radioSelected]}>
          {selected && <Icon name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#147efb" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.header}>Traffic Management</Text>

      {cars.length === 0 ? (
        <View style={s.empty}>
          <Icon name="car-off" size={56} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyText}>No vehicles registered</Text>
          <Text style={s.emptySubtext}>Scan a QR code to register</Text>
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={(item) => item.id}
          renderItem={renderCarItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={s.scanBtn}
        onPress={openScanner}
        activeOpacity={0.8}
      >
        <Icon name="qrcode-scan" size={22} color="#fff" />
        <Text style={s.scanBtnText}>Scan QR Code</Text>
      </TouchableOpacity>

      {/* Scanner */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={s.scanner}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={s.scannerOverlay}>
            <View style={s.scannerFrame} />
          </View>
          <TouchableOpacity
            style={s.scannerClose}
            onPress={() => setScannerVisible(false)}
          >
            <Icon name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={s.scannerHint}>Position QR code within frame</Text>
        </View>
      </Modal>

      {/* Registration */}
      <Modal
        visible={registrationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRegistrationVisible(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>
                {registrationStep === "select"
                  ? "Select Drivers"
                  : registrationStep === "phones"
                  ? "Phone Numbers"
                  : "License Plate"}
              </Text>
              <TouchableOpacity
                onPress={() => setRegistrationVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {registrationStep === "select" && (
              <>
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.uid}
                  renderItem={renderUserSelect}
                  style={s.userList}
                />
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={proceedToPhones}
                >
                  <Text style={s.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {registrationStep === "phones" && (
              <>
                {Object.keys(missingPhones).map((uid) => {
                  const u = getUserById(uid);
                  return (
                    <View key={uid} style={s.phoneRow}>
                      <Image
                        source={getImageSource(uid)}
                        style={s.phoneAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.phoneName}>{u?.name}</Text>
                        <TextInput
                          style={s.phoneInput}
                          placeholder="Phone number"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="phone-pad"
                          value={missingPhones[uid]}
                          onChangeText={(t) =>
                            setMissingPhones((p) => ({ ...p, [uid]: t }))
                          }
                        />
                      </View>
                    </View>
                  );
                })}
                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={s.secondaryBtn}
                    onPress={() => setRegistrationStep("select")}
                  >
                    <Text style={s.secondaryBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.primaryBtn}
                    onPress={proceedToLicense}
                  >
                    <Text style={s.primaryBtnText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {registrationStep === "license" && (
              <>
                <TextInput
                  style={s.licenseInput}
                  placeholder="ABC-1234"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                />
                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={s.secondaryBtn}
                    onPress={() =>
                      setRegistrationStep(
                        Object.keys(missingPhones).length ? "phones" : "select"
                      )
                    }
                  >
                    <Text style={s.secondaryBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.primaryBtn, saving && s.disabled]}
                    onPress={completeRegistration}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={s.primaryBtnText}>Register</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Car Detail */}
      <Modal
        visible={detailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>
                {selectedCar?.license || "Vehicle"}
              </Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedCar?.ownerIds || []}
              keyExtractor={(uid) => uid}
              style={s.driverList}
              renderItem={({ item: uid }) => {
                const u = getUserById(uid);
                if (!u) return null;
                const hasToken = !!driverTokens[uid];
                return (
                  <View style={s.driverRow}>
                    <Image
                      source={getImageSource(uid)}
                      style={s.driverAvatar}
                    />
                    <View style={s.driverInfo}>
                      <Text style={s.driverName}>{u.name}</Text>
                      {u.phone && <Text style={s.driverPhone}>{u.phone}</Text>}
                    </View>
                    <View style={s.driverActions}>
                      {hasToken && (
                        <TouchableOpacity
                          style={s.notifyBtn}
                          onPress={() => openNotify(uid)}
                        >
                          <Icon name="bell-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                      {u.phone && (
                        <TouchableOpacity
                          style={s.callBtn}
                          onPress={() => callDriver(u.phone)}
                        >
                          <Icon name="phone" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            <View style={s.detailBtns}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => openEditModal(selectedCar)}
              >
                <Icon name="pencil-outline" size={18} color="#fff" />
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => confirmDelete(selectedCar)}
              >
                <Icon name="trash-can-outline" size={18} color="#ff453a" />
                <Text style={s.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit */}
      <Modal
        visible={editModalVisible}
        animationType="none"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Edit Vehicle</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>License Plate</Text>
            <TextInput
              style={s.licenseInput}
              placeholder="ABC-1234"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              value={editLicense}
              onChangeText={setEditLicense}
            />

            <Text style={[s.label, { marginTop: 20 }]}>Drivers</Text>
            <FlatList
              data={users}
              keyExtractor={(item) => item.uid}
              renderItem={renderUserSelect}
              style={[s.userList, { maxHeight: 220 }]}
            />

            <TouchableOpacity
              style={[s.saveBtn, saving && s.disabled]}
              onPress={saveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notify - with keyboard handling */}
      {notifyVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.alertOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={s.keyboardAvoid}
            >
              <TouchableWithoutFeedback>
                <View style={s.alertBox}>
                  <View style={s.alertIconWrap}>
                    <Icon name="bell-ring" size={28} color="#ff9f0a" />
                  </View>
                  <Text style={s.alertTitle}>Send Notification</Text>
                  <Text style={s.alertSubtitle}>Customize the message to send</Text>
                  
                  <Text style={s.alertLabel}>Title</Text>
                  <TextInput
                    style={s.alertInput}
                    placeholder="Notification title"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={notifyTitle}
                    onChangeText={setNotifyTitle}
                    autoFocus
                    returnKeyType="next"
                  />
                  
                  <Text style={s.alertLabel}>Message</Text>
                  <TextInput
                    style={[s.alertInput, s.alertTextarea]}
                    placeholder="Notification message"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={notifyMsg}
                    onChangeText={setNotifyMsg}
                    multiline
                    textAlignVertical="top"
                    blurOnSubmit={true}
                    returnKeyType="done"
                  />
                  
                  <View style={s.alertBtns}>
                    <TouchableOpacity style={s.alertCancelBtn} onPress={() => setNotifyVisible(false)}>
                      <Text style={s.alertCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.alertSendBtn} onPress={sendNotify}>
                      <Icon name="send" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={s.alertSendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20 },
  center: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  header: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 20 },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyText: { fontSize: 17, color: "rgba(255,255,255,0.4)", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "rgba(255,255,255,0.25)", marginTop: 6 },

  carItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatarStack: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  stackedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#1c1c1e",
  },
  extraBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2c2c2e",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1c1c1e",
    marginLeft: -10,
  },
  extraText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  carInfo: { flex: 1 },
  licensePlate: { fontSize: 17, fontWeight: "600", color: "#fff" },
  ownerNames: { fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 2 },

  scanBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#147efb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  scanBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },

  scanner: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#147efb",
    borderRadius: 16,
  },
  scannerClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerHint: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    width: "88%",
    maxHeight: "75%",
    padding: 20,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },

  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
  },

  userList: { maxHeight: 280 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  userRowSelected: { backgroundColor: "rgba(20,126,251,0.2)" },
  userAvatar: { width: 38, height: 38, borderRadius: 19 },
  userInfo: { flex: 1, marginLeft: 10 },
  userName: { fontSize: 15, fontWeight: "500", color: "#fff" },
  userPhone: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: { backgroundColor: "#147efb", borderColor: "#147efb" },

  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  phoneAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  phoneName: { fontSize: 14, color: "#fff", marginBottom: 4 },
  phoneInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },

  licenseInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 2,
  },

  btnRow: { flexDirection: "row", marginTop: 16, gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#147efb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  disabled: { opacity: 0.5 },

  driverList: { maxHeight: 300 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  driverAvatar: { width: 42, height: 42, borderRadius: 21 },
  driverInfo: { flex: 1, marginLeft: 12 },
  driverName: { fontSize: 15, fontWeight: "500", color: "#fff" },
  driverPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  driverActions: { flexDirection: "row", gap: 8 },
  notifyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff9f0a",
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#34c759",
  },

  detailBtns: { flexDirection: "row", marginTop: 16, gap: 10 },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#147efb",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  editBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,69,58,0.12)",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "600", color: "#ff453a" },

  saveBtn: {
    backgroundColor: "#147efb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  // Notify alert styles
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  alertBox: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    width: 300,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  alertIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,159,10,0.15)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 20,
  },
  alertLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  alertInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  alertTextarea: {
    height: 90,
    paddingTop: 12,
  },
  alertBtns: {
    flexDirection: "row",
    marginTop: 4,
    gap: 12,
  },
  alertCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  alertCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  alertSendBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ff9f0a",
    alignItems: "center",
    justifyContent: "center",
  },
  alertSendText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});

export default TrafficManager;