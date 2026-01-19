import React, { useState, useEffect, useCallback } from "react";
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
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import callFunction from "../components/functionCalls";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_PROFILE = require("../assets/default_profile.png");
const NOTIFICATION_URL =
  "https://us-central1-taksis-a8ba7.cloudfunctions.net/traffic_notification";

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

  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

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
    [users],
  );

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to scan QR codes.",
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
    [scanned, cars],
  );

  const toggleDriverSelection = (uid) => {
    setSelectedDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
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
        "Please enter phone numbers for all drivers.",
      );
      return;
    }
    setRegistrationStep("license");
  };

  const completeRegistration = async () => {
    if (!licensePlate.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter the license plate number.",
      );
      return;
    }
    setSaving(true);
    try {
      const updates = Object.entries(missingPhones).map(([uid, phone]) =>
        firestore()
          .collection("users")
          .doc(uid)
          .update({ phone: phone.trim() }),
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
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
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
      ],
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
      }),
    );
    setDriverTokens(tokens);
  };

  const openNotify = (uid) => {
    const tokens = driverTokens[uid];
    if (!tokens || Object.keys(tokens).length === 0) return;
    setNotifyTokens(Object.values(tokens));
    setNotifyTitle("Please Move Your Car");
    setNotifyMsg(
      "Your vehicle is blocking traffic. Please move it as soon as possible.",
    );
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
      {
        tokens: notifyTokens,
        title: notifyTitle.trim(),
        message: notifyMsg.trim(),
      },
      "Failed to send notification.",
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

  const renderCarItem = ({ item, index }) => {
    const ownerIds = item.ownerIds || [];
    const owners = ownerIds.map(getUserById).filter(Boolean);
    const visible = ownerIds.slice(0, 3);
    const extra = ownerIds.length - 3;

    return (
      <TouchableOpacity
        style={[s.carCard, index === 0 && { marginTop: 0 }]}
        onPress={() => openCarDetail(item)}
        activeOpacity={0.7}
      >
        <View style={s.carCardLeft}>
          <View style={s.licenseBadge}>
            <Icon name="car" size={16} color="#147efb" />
            <Text style={s.licenseText}>{item.license || "NO PLATE"}</Text>
          </View>
          <Text style={s.ownerNames} numberOfLines={1}>
            {owners.map((o) => o.name?.split(" ")[0]).join(", ") || "Unknown"}
          </Text>
        </View>
        <View style={s.avatarStack}>
          {visible.map((uid, i) => (
            <Image
              key={uid}
              source={getImageSource(uid)}
              style={[
                s.stackedAvatar,
                { marginLeft: i > 0 ? -14 : 0, zIndex: 3 - i },
              ]}
            />
          ))}
          {extra > 0 && (
            <View style={s.extraBadge}>
              <Text style={s.extraText}>+{extra}</Text>
            </View>
          )}
        </View>
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
        <View style={[s.checkbox, selected && s.checkboxSelected]}>
          {selected && <Icon name="check" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const getStepNumber = () => {
    if (registrationStep === "select") return 1;
    if (registrationStep === "phones") return 2;
    return Object.keys(missingPhones).length > 0 ? 3 : 2;
  };

  const getTotalSteps = () => (Object.keys(missingPhones).length > 0 ? 3 : 2);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <View style={s.loadingCard}>
          <ActivityIndicator size="large" color="#147efb" />
          <Text style={s.loadingText}>Loading vehicles...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Traffic Manager</Text>
          <Text style={s.headerSubtitle}>
            {cars.length} {cars.length === 1 ? "vehicle" : "vehicles"}{" "}
            registered
          </Text>
        </View>
        <TouchableOpacity
          style={s.headerScanBtn}
          onPress={openScanner}
          activeOpacity={0.8}
        >
          <Icon name="qrcode-scan" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {cars.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Icon name="car-off" size={48} color="rgba(255,255,255,0.2)" />
          </View>
          <Text style={s.emptyTitle}>No Vehicles Yet</Text>
          <Text style={s.emptySubtitle}>
            Scan a QR code to register your first vehicle
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={openScanner}
            activeOpacity={0.8}
          >
            <Icon name="qrcode-scan" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={(item) => item.id}
          renderItem={renderCarItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Scan Button */}
      {cars.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={openScanner}
          activeOpacity={0.9}
        >
          <Icon name="qrcode-scan" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Scanner Modal */}
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
            <View style={s.scannerTop} />
            <View style={s.scannerMiddle}>
              <View style={s.scannerSide} />
              <View style={s.scannerFrame}>
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
              </View>
              <View style={s.scannerSide} />
            </View>
            <View style={s.scannerBottom}>
              <Text style={s.scannerHint}>Align QR code within frame</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.scannerClose}
            onPress={() => setScannerVisible(false)}
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Registration Modal */}
      <Modal
        visible={registrationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRegistrationVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                {registrationStep !== "select" && (
                  <TouchableOpacity
                    style={s.backBtn}
                    onPress={() => {
                      if (registrationStep === "license") {
                        setRegistrationStep(
                          Object.keys(missingPhones).length
                            ? "phones"
                            : "select",
                        );
                      } else {
                        setRegistrationStep("select");
                      }
                    }}
                  >
                    <Icon name="arrow-left" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.modalHeaderCenter}>
                <Text style={s.modalTitle}>
                  {registrationStep === "select"
                    ? "Select Drivers"
                    : registrationStep === "phones"
                      ? "Phone Numbers"
                      : "License Plate"}
                </Text>
                <Text style={s.modalStep}>
                  Step {getStepNumber()} of {getTotalSteps()}
                </Text>
              </View>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={() => setRegistrationVisible(false)}
              >
                <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={s.progressBar}>
              <View
                style={[
                  s.progressFill,
                  { width: `${(getStepNumber() / getTotalSteps()) * 100}%` },
                ]}
              />
            </View>

            {/* Content */}
            <View style={s.modalBody}>
              {registrationStep === "select" && (
                <>
                  <Text style={s.sectionLabel}>Who drives this vehicle?</Text>
                  <FlatList
                    data={users}
                    keyExtractor={(item) => item.uid}
                    renderItem={renderUserSelect}
                    style={s.userList}
                    showsVerticalScrollIndicator={false}
                  />
                </>
              )}

              {registrationStep === "phones" && (
                <>
                  <Text style={s.sectionLabel}>
                    Enter missing phone numbers
                  </Text>
                  <View style={s.phonesList}>
                    {Object.keys(missingPhones).map((uid) => {
                      const u = getUserById(uid);
                      return (
                        <View key={uid} style={s.phoneCard}>
                          <Image
                            source={getImageSource(uid)}
                            style={s.phoneAvatar}
                          />
                          <View style={s.phoneInputWrap}>
                            <Text style={s.phoneName}>{u?.name}</Text>
                            <TextInput
                              style={s.phoneInput}
                              placeholder="(123) 456-7890"
                              placeholderTextColor="rgba(255,255,255,0.25)"
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
                  </View>
                </>
              )}

              {registrationStep === "license" && (
                <>
                  <View style={s.licenseIconWrap}>
                    <Icon name="card-text-outline" size={32} color="#147efb" />
                  </View>
                  <Text style={s.licenseLabel}>Enter License Plate</Text>
                  <TextInput
                    style={s.licenseInput}
                    placeholder="ABC-1234"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoCapitalize="characters"
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    maxLength={10}
                  />
                  <Text style={s.licenseHint}>
                    This will help identify the vehicle
                  </Text>
                </>
              )}
            </View>

            {/* Footer */}
            <View style={s.modalFooter}>
              {registrationStep === "select" && (
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    selectedDrivers.length === 0 && s.btnDisabled,
                  ]}
                  onPress={proceedToPhones}
                  disabled={selectedDrivers.length === 0}
                  activeOpacity={0.8}
                >
                  <Text style={s.primaryBtnText}>Continue</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              )}

              {registrationStep === "phones" && (
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={proceedToLicense}
                  activeOpacity={0.8}
                >
                  <Text style={s.primaryBtnText}>Continue</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              )}

              {registrationStep === "license" && (
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    s.successBtn,
                    (!licensePlate.trim() || saving) && s.btnDisabled,
                  ]}
                  onPress={completeRegistration}
                  disabled={!licensePlate.trim() || saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Icon name="check" size={18} color="#fff" />
                      <Text style={s.primaryBtnText}>Register Vehicle</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Car Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.detailModal}>
            <View style={s.detailHeader}>
              <View style={s.detailLicenseBadge}>
                <Icon name="car" size={20} color="#147efb" />
                <Text style={s.detailLicense}>
                  {selectedCar?.license || "NO PLATE"}
                </Text>
              </View>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <Text style={s.detailSectionLabel}>Drivers</Text>
            <FlatList
              data={selectedCar?.ownerIds || []}
              keyExtractor={(uid) => uid}
              style={s.driverList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: uid }) => {
                const u = getUserById(uid);
                if (!u) return null;
                const hasToken = !!driverTokens[uid];
                return (
                  <View style={s.driverCard}>
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
                          style={s.actionBtn}
                          onPress={() => openNotify(uid)}
                        >
                          <Icon name="bell-outline" size={18} color="#ff9f0a" />
                        </TouchableOpacity>
                      )}
                      {u.phone && (
                        <TouchableOpacity
                          style={[s.actionBtn, s.callActionBtn]}
                          onPress={() => callDriver(u.phone)}
                        >
                          <Icon name="phone" size={18} color="#34c759" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            <View style={s.detailFooter}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => openEditModal(selectedCar)}
                activeOpacity={0.8}
              >
                <Icon name="pencil-outline" size={18} color="#fff" />
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => confirmDelete(selectedCar)}
                activeOpacity={0.8}
              >
                <Icon name="trash-can-outline" size={18} color="#ff453a" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft} />
              <View style={s.modalHeaderCenter}>
                <Text style={s.modalTitle}>Edit Vehicle</Text>
              </View>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={s.sectionLabel}>License Plate</Text>
              <TextInput
                style={s.licenseInput}
                placeholder="ABC-1234"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="characters"
                value={editLicense}
                onChangeText={setEditLicense}
                maxLength={10}
              />

              <Text style={[s.sectionLabel, { marginTop: 24 }]}>Drivers</Text>
              <FlatList
                data={users}
                keyExtractor={(item) => item.uid}
                renderItem={renderUserSelect}
                style={[s.userList, { maxHeight: 220 }]}
                showsVerticalScrollIndicator={false}
              />
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  (!editLicense.trim() || editDrivers.length === 0 || saving) &&
                    s.btnDisabled,
                ]}
                onPress={saveEdit}
                disabled={
                  !editLicense.trim() || editDrivers.length === 0 || saving
                }
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Modal */}
      {notifyVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.notifyOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={s.notifyAvoid}
            >
              <TouchableWithoutFeedback>
                <View style={s.notifyModal}>
                  <View style={s.notifyIconWrap}>
                    <Icon name="bell-ring" size={28} color="#ff9f0a" />
                  </View>
                  <Text style={s.notifyTitle}>Send Notification</Text>
                  <Text style={s.notifySubtitle}>
                    Customize the message below
                  </Text>

                  <Text style={s.notifyLabel}>Title</Text>
                  <TextInput
                    style={s.notifyInput}
                    placeholder="Notification title"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyTitle}
                    onChangeText={setNotifyTitle}
                    autoFocus
                    returnKeyType="next"
                  />

                  <Text style={s.notifyLabel}>Message</Text>
                  <TextInput
                    style={[s.notifyInput, s.notifyTextarea]}
                    placeholder="Notification message"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyMsg}
                    onChangeText={setNotifyMsg}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={s.notifyBtns}>
                    <TouchableOpacity
                      style={s.notifyCancelBtn}
                      onPress={() => setNotifyVisible(false)}
                    >
                      <Text style={s.notifyCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.notifySendBtn}
                      onPress={sendNotify}
                    >
                      <Icon name="send" size={16} color="#fff" />
                      <Text style={s.notifySendText}>Send</Text>
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
  container: { flex: 1, backgroundColor: "#000" },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#1a1a1a",
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
  },
  loadingText: { color: "rgba(255,255,255,0.6)", fontSize: 15, marginTop: 16 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff" },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  headerScanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#147efb",
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#147efb",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
    gap: 8,
  },
  emptyBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },

  // Car List
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  carCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  carCardLeft: { flex: 1 },
  licenseBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  licenseText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  ownerNames: { fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 6 },
  avatarStack: { flexDirection: "row", alignItems: "center", marginLeft: 12 },
  stackedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  extraBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -14,
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  extraText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#147efb",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#147efb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Scanner
  scanner: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: { ...StyleSheet.absoluteFillObject },
  scannerTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  scannerMiddle: { flexDirection: "row", height: 260 },
  scannerSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  scannerFrame: { width: 260, height: 260, position: "relative" },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#147efb",
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scannerBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    paddingTop: 40,
  },
  scannerHint: {
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scannerClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Modal Base
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalHeaderLeft: { width: 40 },
  modalHeaderCenter: { flex: 1, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },
  modalStep: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  progressBar: { height: 3, backgroundColor: "rgba(255,255,255,0.1)" },
  progressFill: { height: "100%", backgroundColor: "#147efb" },

  modalBody: { padding: 20 },
  modalFooter: {
    padding: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
  },

  // User List
  userList: { maxHeight: 300 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  userRowSelected: {
    backgroundColor: "rgba(20,126,251,0.15)",
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.3)",
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: "500", color: "#fff" },
  userPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: { backgroundColor: "#147efb", borderColor: "#147efb" },

  // Phone Input
  phonesList: { gap: 12 },
  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 12,
  },
  phoneAvatar: { width: 40, height: 40, borderRadius: 20 },
  phoneInputWrap: { flex: 1, marginLeft: 12 },
  phoneName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 6,
  },
  phoneInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
  },

  // License Input
  licenseIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(20,126,251,0.1)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  licenseLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  licenseInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 3,
  },
  licenseHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    marginTop: 12,
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#147efb",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  successBtn: { backgroundColor: "#34c759" },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.4 },

  // Detail Modal
  detailModal: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailLicenseBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,126,251,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  detailLicense: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  detailSectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  driverList: { maxHeight: 280 },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  driverAvatar: { width: 48, height: 48, borderRadius: 24 },
  driverInfo: { flex: 1, marginLeft: 14 },
  driverName: { fontSize: 16, fontWeight: "500", color: "#fff" },
  driverPhone: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  driverActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  callActionBtn: { backgroundColor: "rgba(52,199,89,0.12)" },
  detailFooter: { flexDirection: "row", marginTop: 16, gap: 12 },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#147efb",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  editBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  deleteBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(255,69,58,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Notify Modal
  notifyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  notifyAvoid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  notifyModal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    width: SCREEN_WIDTH - 48,
    padding: 24,
  },
  notifyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  notifyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  notifySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  notifyLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  notifyInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
    marginBottom: 16,
  },
  notifyTextarea: { height: 100, paddingTop: 14 },
  notifyBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  notifyCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  notifyCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  notifySendBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ff9f0a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notifySendText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

export default TrafficManager;
