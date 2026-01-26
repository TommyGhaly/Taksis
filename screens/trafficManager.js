import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  ScrollView,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import callFunction from "../components/functionCalls";

const { width: SW, height: SH } = Dimensions.get("window");
const DEFAULT_PROFILE = require("../assets/default_profile.png");
const NOTIFICATION_URL =
  "https://us-central1-taksis-a8ba7.cloudfunctions.net/traffic_notification";
const DEFAULT_CAR_LIMIT = 2;

const CarCard = memo(
  ({ item, index, getUserById, getImageSource, onPress }) => {
    const ownerIds = item.ownerIds || [];
    const owners = ownerIds.map(getUserById).filter(Boolean);
    const visible = ownerIds.slice(0, 3);
    const extra = ownerIds.length - 3;
    const isPresent = item.present;

    return (
      <TouchableOpacity
        style={[s.carCard, index === 0 && { marginTop: 0 }]}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        <View style={s.carCardContent}>
          <View style={[s.carStatusDot, isPresent && s.carStatusDotPresent]} />
          <View style={s.carCardInfo}>
            <Text style={[s.licenseText, isPresent && s.licenseTextPresent]}>
              {item.license || "NO PLATE"}
            </Text>
            <Text style={s.ownerNames} numberOfLines={1}>
              {owners.map((o) => o.name?.split(" ")[0]).join(", ") || "Unknown"}
            </Text>
          </View>
        </View>
        <View style={s.avatarStack}>
          {visible.map((uid, i) => (
            <Image
              key={uid}
              source={getImageSource(uid)}
              style={[
                s.stackedAvatar,
                { marginLeft: i > 0 ? -12 : 0, zIndex: 3 - i },
              ]}
              contentFit="cover"
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
  },
);

const UserSelectRow = memo(({ item, selected, onPress, getImageSource }) => (
  <TouchableOpacity
    style={[s.userRow, selected && s.userRowSelected]}
    onPress={() => onPress(item.uid)}
    activeOpacity={0.7}
  >
    <Image
      source={getImageSource(item.uid)}
      style={s.userAvatar}
      contentFit="cover"
    />
    <View style={s.userInfo}>
      <Text style={s.userName}>{item.name}</Text>
      {item.phone && <Text style={s.userPhone}>{item.phone}</Text>}
    </View>
    <View style={[s.checkbox, selected && s.checkboxSelected]}>
      {selected && <Icon name="check" size={14} color="#fff" />}
    </View>
  </TouchableOpacity>
));

const DriverCard = memo(
  ({
    uid,
    user,
    imageSource,
    hasToken,
    presentCars,
    maxCars,
    limitEnabled,
    onNotify,
    onCall,
  }) => {
    const overLimit = limitEnabled && presentCars > maxCars;
    return (
      <View style={s.driverCard}>
        <Image source={imageSource} style={s.driverAvatar} contentFit="cover" />
        <View style={s.driverInfo}>
          <Text style={s.driverName}>{user.name}</Text>
          {user.phone && <Text style={s.driverPhone}>{user.phone}</Text>}
          {overLimit && (
            <View style={s.limitWarning}>
              <Icon name="alert-circle" size={12} color="#ff9f0a" />
              <Text style={s.limitWarningText}>
                {presentCars}/{maxCars} cars
              </Text>
            </View>
          )}
        </View>
        <View style={s.driverActions}>
          {hasToken && (
            <TouchableOpacity style={s.actionBtn} onPress={() => onNotify(uid)}>
              <Icon name="bell-outline" size={18} color="#ff9f0a" />
            </TouchableOpacity>
          )}
          {user.phone && (
            <TouchableOpacity
              style={[s.actionBtn, s.callActionBtn]}
              onPress={() => onCall(user.phone)}
            >
              <Icon name="phone" size={18} color="#34c759" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
);

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
  const [searchQuery, setSearchQuery] = useState("");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editLicense, setEditLicense] = useState("");
  const [editDrivers, setEditDrivers] = useState([]);
  const [editSearchQuery, setEditSearchQuery] = useState("");

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [driverTokens, setDriverTokens] = useState({});

  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

  const [menuVisible, setMenuVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [scannedCar, setScannedCar] = useState(null);

  const [carLimitEnabled, setCarLimitEnabled] = useState(true);
  const [maxCarsPerPerson, setMaxCarsPerPerson] = useState(DEFAULT_CAR_LIMIT);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempLimit, setTempLimit] = useState(String(DEFAULT_CAR_LIMIT));

  useEffect(() => {
    const unsub = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) setChurchId(doc.data()?.church);
      });
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("churches")
      .doc(churchId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const limit = doc.data()?.maxCarsPerPerson;
          const enabled = limit !== null && limit !== undefined && limit !== 0;
          setCarLimitEnabled(enabled);
          setMaxCarsPerPerson(enabled ? limit : DEFAULT_CAR_LIMIT);
          setTempLimit(String(enabled ? limit : DEFAULT_CAR_LIMIT));
        }
      });
    return unsub;
  }, [churchId]);

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

  const fetchProfileImage = useCallback(
    async (uid) => {
      if (!uid || imageUrls[uid]) return;
      try {
        const url = await storage()
          .ref(`profilePictures/${uid}.png`)
          .getDownloadURL();
        setImageUrls((prev) => ({ ...prev, [uid]: url }));
      } catch {}
    },
    [imageUrls],
  );

  const getUserById = useCallback(
    (uid) => users.find((u) => u.uid === uid),
    [users],
  );
  const getImageSource = useCallback(
    (uid) => (imageUrls[uid] ? { uri: imageUrls[uid] } : DEFAULT_PROFILE),
    [imageUrls],
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const editFilteredUsers = useMemo(() => {
    if (!editSearchQuery.trim()) return users;
    const q = editSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q),
    );
  }, [users, editSearchQuery]);

  const getPresentCarsForPerson = useCallback(
    (uid) =>
      cars.filter((car) => car.ownerIds?.includes(uid) && car.present).length,
    [cars],
  );

  const checkCarLimit = useCallback(
    (car) => {
      if (!carLimitEnabled) return [];
      return (car.ownerIds || []).reduce((violations, uid) => {
        const currentCount = getPresentCarsForPerson(uid);
        const newCount = car.present ? currentCount : currentCount + 1;
        if (newCount > maxCarsPerPerson) {
          violations.push({
            uid,
            name: getUserById(uid)?.name || "Unknown",
            count: newCount,
          });
        }
        return violations;
      }, []);
    },
    [carLimitEnabled, maxCarsPerPerson, getPresentCarsForPerson, getUserById],
  );

  const markCarPresent = useCallback(
    async (car, skipLimitCheck = false) => {
      if (!skipLimitCheck) {
        const violations = checkCarLimit(car);
        if (violations.length > 0) {
          const names = violations
            .map((v) => `${v.name} (${v.count} cars)`)
            .join(", ");
          Alert.alert(
            "Car Limit Exceeded",
            `The following drivers have exceeded the ${maxCarsPerPerson} car limit:\n\n${names}\n\nMark as present anyway?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Mark Anyway", onPress: () => markCarPresent(car, true) },
            ],
          );
          return;
        }
      }
      try {
        await firestore()
          .collection("qrCodes")
          .doc(car.id)
          .update({ present: true });
      } catch {
        Alert.alert("Error", "Failed to mark car as present.");
      }
      setAttendanceModalVisible(false);
      setDetailModalVisible(false);
    },
    [checkCarLimit, maxCarsPerPerson],
  );

  const markCarAbsent = useCallback(async (car) => {
    try {
      await firestore()
        .collection("qrCodes")
        .doc(car.id)
        .update({ present: false });
    } catch {
      Alert.alert("Error", "Failed to mark car as absent.");
    }
    setAttendanceModalVisible(false);
    setDetailModalVisible(false);
  }, []);

  const clearAllAttendance = useCallback(() => {
    Alert.alert(
      "Clear All Attendance",
      "This will mark all cars as not present. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const batch = firestore().batch();
              cars
                .filter((c) => c.present)
                .forEach((car) => {
                  batch.update(firestore().collection("qrCodes").doc(car.id), {
                    present: false,
                  });
                });
              await batch.commit();
            } catch {
              Alert.alert("Error", "Failed to clear attendance.");
            }
            setMenuVisible(false);
          },
        },
      ],
    );
  }, [cars]);

  const saveCarLimitSettings = useCallback(
    async (enabled, limit) => {
      try {
        await firestore()
          .collection("churches")
          .doc(churchId)
          .update({ maxCarsPerPerson: enabled ? limit : 0 });
      } catch {
        Alert.alert("Error", "Failed to save settings.");
      }
    },
    [churchId],
  );

  const handleToggleLimit = useCallback(
    async (enabled) => {
      setCarLimitEnabled(enabled);
      await saveCarLimitSettings(enabled, maxCarsPerPerson);
    },
    [maxCarsPerPerson, saveCarLimitSettings],
  );

  const handleSaveLimit = useCallback(async () => {
    const parsed = parseInt(tempLimit, 10);
    if (isNaN(parsed) || parsed < 1) {
      Alert.alert("Invalid", "Enter a number greater than 0.");
      return;
    }
    setMaxCarsPerPerson(parsed);
    await saveCarLimitSettings(carLimitEnabled, parsed);
    setSettingsVisible(false);
  }, [tempLimit, carLimitEnabled, saveCarLimitSettings]);

  const presentCount = useMemo(
    () => cars.filter((c) => c.present).length,
    [cars],
  );

  const openScanner = useCallback(async () => {
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
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      if (scanned) return;
      setScanned(true);
      setScannerVisible(false);
      const existing = cars.find((c) => c.id === data);
      if (existing) {
        setScannedCar(existing);
        setAttendanceModalVisible(true);
      } else {
        setCurrentQrId(data);
        setSelectedDrivers([]);
        setLicensePlate("");
        setMissingPhones({});
        setRegistrationStep("select");
        setSearchQuery("");
        setRegistrationVisible(true);
      }
    },
    [scanned, cars],
  );

  const toggleDriverSelection = useCallback((uid) => {
    setSelectedDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }, []);

  const proceedToPhones = useCallback(() => {
    if (selectedDrivers.length === 0) {
      Alert.alert("Select Drivers", "Please select at least one driver.");
      return;
    }
    const missing = selectedDrivers.reduce((acc, uid) => {
      const u = getUserById(uid);
      if (!u?.phone) acc[uid] = "";
      return acc;
    }, {});
    if (Object.keys(missing).length > 0) {
      setMissingPhones(missing);
      setRegistrationStep("phones");
    } else {
      setRegistrationStep("license");
    }
  }, [selectedDrivers, getUserById]);

  const proceedToLicense = useCallback(() => {
    if (Object.values(missingPhones).some((p) => !p.trim())) {
      Alert.alert(
        "Missing Info",
        "Please enter phone numbers for all drivers.",
      );
      return;
    }
    setRegistrationStep("license");
  }, [missingPhones]);

  const completeRegistration = useCallback(async () => {
    if (!licensePlate.trim()) {
      Alert.alert("Missing Info", "Please enter the license plate number.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(missingPhones).map(([uid, phone]) =>
          firestore()
            .collection("users")
            .doc(uid)
            .update({ phone: phone.trim() }),
        ),
      );
      await firestore().collection("qrCodes").doc(currentQrId).set({
        church: churchId,
        license: licensePlate.trim().toUpperCase(),
        ownerIds: selectedDrivers,
      });
      setRegistrationVisible(false);
    } catch {
      Alert.alert("Error", "Failed to register vehicle.");
    } finally {
      setSaving(false);
    }
  }, [licensePlate, missingPhones, currentQrId, churchId, selectedDrivers]);

  const openEditModal = useCallback((car) => {
    setEditLicense(car.license || "");
    setEditDrivers([...(car.ownerIds || [])]);
    setEditingCar(car);
    setEditSearchQuery("");
    setDetailModalVisible(false);
    setTimeout(() => setEditModalVisible(true), 0);
  }, []);

  const toggleEditDriver = useCallback((uid) => {
    setEditDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editLicense.trim()) {
      Alert.alert("Missing Info", "Please enter the license plate.");
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
    } catch {
      Alert.alert("Error", "Failed to update vehicle.");
    } finally {
      setSaving(false);
    }
  }, [editLicense, editDrivers, editingCar]);

  const confirmDelete = useCallback((car) => {
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
  }, []);

  const callDriver = useCallback((phone) => {
    if (phone) Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  }, []);

  const checkDriverTokens = useCallback(async (ownerIds) => {
    const tokens = {};
    await Promise.all(
      ownerIds.map(async (uid) => {
        try {
          const doc = await firestore().collection("users").doc(uid).get();
          const fcm = doc.data()?.fcmTokens;
          if (fcm && Object.keys(fcm).length > 0) tokens[uid] = fcm;
        } catch {}
      }),
    );
    setDriverTokens(tokens);
  }, []);

  const openNotify = useCallback(
    (uid) => {
      const tokens = driverTokens[uid];
      if (!tokens || Object.keys(tokens).length === 0) return;
      setNotifyTokens(Object.values(tokens));
      setNotifyTitle("Please Move Your Car");
      setNotifyMsg(
        "Your vehicle is blocking traffic. Please move it as soon as possible.",
      );
      setDetailModalVisible(false);
      setNotifyVisible(true);
    },
    [driverTokens],
  );

  const sendNotify = useCallback(() => {
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
  }, [notifyTitle, notifyMsg, notifyTokens, user]);

  const openCarDetail = useCallback(
    (car) => {
      setSelectedCar(car);
      setDriverTokens({});
      setDetailModalVisible(true);
      checkDriverTokens(car.ownerIds || []);
    },
    [checkDriverTokens],
  );

  const getStepNumber = () =>
    registrationStep === "select"
      ? 1
      : registrationStep === "phones"
        ? 2
        : Object.keys(missingPhones).length > 0
          ? 3
          : 2;
  const getTotalSteps = () => (Object.keys(missingPhones).length > 0 ? 3 : 2);

  const renderCarItem = useCallback(
    ({ item, index }) => (
      <CarCard
        item={item}
        index={index}
        getUserById={getUserById}
        getImageSource={getImageSource}
        onPress={openCarDetail}
      />
    ),
    [getUserById, getImageSource, openCarDetail],
  );

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={s.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Traffic</Text>
          <View style={s.headerStats}>
            <View style={s.statDot} />
            <Text style={s.headerSubtitle}>{presentCount} present</Text>
            <Text style={s.headerDivider}>·</Text>
            <Text style={s.headerSubtitle}>{cars.length} total</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Icon name="cog-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerScanBtn}
            onPress={openScanner}
            activeOpacity={0.8}
          >
            <Icon name="qrcode-scan" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {cars.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Icon name="car-outline" size={40} color="rgba(255,255,255,0.15)" />
          </View>
          <Text style={s.emptyTitle}>No Vehicles</Text>
          <Text style={s.emptySubtitle}>Scan a QR code to get started</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={openScanner}
            activeOpacity={0.8}
          >
            <Icon name="qrcode-scan" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Scan QR</Text>
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

      {cars.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={openScanner}
          activeOpacity={0.9}
        >
          <Icon name="qrcode-scan" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Menu */}
      <Modal
        visible={menuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={s.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.menuSheet}>
                <View style={s.menuHandle} />
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    setSettingsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconWrap}>
                    <Icon name="speedometer" size={20} color="#147efb" />
                  </View>
                  <View style={s.menuItemContent}>
                    <Text style={s.menuItemText}>Car Limit</Text>
                    <Text style={s.menuItemSub}>
                      {carLimitEnabled
                        ? `${maxCarsPerPerson} per person`
                        : "Disabled"}
                    </Text>
                  </View>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color="rgba(255,255,255,0.3)"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={clearAllAttendance}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      s.menuIconWrap,
                      { backgroundColor: "rgba(255,69,58,0.15)" },
                    ]}
                  >
                    <Icon name="refresh" size={20} color="#ff453a" />
                  </View>
                  <View style={s.menuItemContent}>
                    <Text style={s.menuItemTextDanger}>Clear Attendance</Text>
                    <Text style={s.menuItemSub}>Mark all as not present</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Settings - slides from top */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={s.settingsOverlay}>
          <View style={s.settingsSheet}>
            <View style={s.settingsHeader}>
              <Text style={s.settingsTitle}>Car Limit</Text>
              <TouchableOpacity
                style={s.settingsCloseBtn}
                onPress={() => setSettingsVisible(false)}
              >
                <Icon name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={s.settingsBody}>
              <View style={s.settingCard}>
                <View style={s.settingRow}>
                  <View style={s.settingIconWrap}>
                    <Icon name="car-multiple" size={22} color="#147efb" />
                  </View>
                  <View style={s.settingInfo}>
                    <Text style={s.settingLabel}>Enable Limit</Text>
                    <Text style={s.settingDesc}>Alert when exceeded</Text>
                  </View>
                  <Switch
                    value={carLimitEnabled}
                    onValueChange={handleToggleLimit}
                    trackColor={{ true: "#34c759" }}
                  />
                </View>
              </View>
              {carLimitEnabled && (
                <View style={s.settingCard}>
                  <Text style={s.limitLabel}>Maximum per person</Text>
                  <View style={s.limitControl}>
                    <TouchableOpacity
                      style={s.limitBtn}
                      onPress={() =>
                        setTempLimit(
                          String(Math.max(1, parseInt(tempLimit, 10) - 1 || 1)),
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Icon name="minus" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={s.limitValueWrap}>
                      <Text style={s.limitValue}>{tempLimit}</Text>
                      <Text style={s.limitUnit}>cars</Text>
                    </View>
                    <TouchableOpacity
                      style={s.limitBtn}
                      onPress={() =>
                        setTempLimit(
                          String(
                            Math.min(99, parseInt(tempLimit, 10) + 1 || 1),
                          ),
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            <View style={s.settingsFooter}>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={handleSaveLimit}
                activeOpacity={0.8}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attendance */}
      <Modal
        visible={attendanceModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <View style={s.centerOverlay}>
          <View style={s.attendanceCard}>
            <TouchableOpacity
              style={s.cardClose}
              onPress={() => setAttendanceModalVisible(false)}
            >
              <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            <View style={s.attendancePlate}>
              <Icon name="car" size={20} color="#147efb" />
              <Text style={s.attendancePlateText}>
                {scannedCar?.license || "NO PLATE"}
              </Text>
            </View>
            {scannedCar?.present ? (
              <>
                <View style={s.statusRow}>
                  <Icon name="check-circle" size={18} color="#34c759" />
                  <Text style={s.statusTextGreen}>Present</Text>
                </View>
                <TouchableOpacity
                  style={s.actionBtnRed}
                  onPress={() => markCarAbsent(scannedCar)}
                  activeOpacity={0.8}
                >
                  <Icon name="logout" size={18} color="#fff" />
                  <Text style={s.actionBtnText}>Mark as Left</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.statusRow}>
                  <Icon
                    name="car-off"
                    size={18}
                    color="rgba(255,255,255,0.4)"
                  />
                  <Text style={s.statusTextGray}>Not Present</Text>
                </View>
                <TouchableOpacity
                  style={s.actionBtnGreen}
                  onPress={() => markCarPresent(scannedCar)}
                  activeOpacity={0.8}
                >
                  <Icon name="check" size={18} color="#fff" />
                  <Text style={s.actionBtnText}>Mark as Here</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={s.detailLink}
              onPress={() => {
                setAttendanceModalVisible(false);
                openCarDetail(scannedCar);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.detailLinkText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          <View style={s.scannerFrame}>
            <View style={[s.corner, s.cTL]} />
            <View style={[s.corner, s.cTR]} />
            <View style={[s.corner, s.cBL]} />
            <View style={[s.corner, s.cBR]} />
          </View>
          <Text style={s.scannerHint}>Align QR code</Text>
          <TouchableOpacity
            style={s.scannerClose}
            onPress={() => setScannerVisible(false)}
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Registration */}
      <Modal
        visible={registrationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRegistrationVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.bottomOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={s.bottomSheet}>
            <View style={s.sheetHeader}>
              <View style={s.sheetHeaderLeft}>
                {registrationStep !== "select" && (
                  <TouchableOpacity
                    onPress={() =>
                      setRegistrationStep(
                        registrationStep === "license"
                          ? Object.keys(missingPhones).length
                            ? "phones"
                            : "select"
                          : "select",
                      )
                    }
                  >
                    <Icon name="arrow-left" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.sheetTitle}>
                {registrationStep === "select"
                  ? "Select Drivers"
                  : registrationStep === "phones"
                    ? "Phone Numbers"
                    : "License Plate"}
              </Text>
              <TouchableOpacity onPress={() => setRegistrationVisible(false)}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <View style={s.progressBar}>
              <View
                style={[
                  s.progressFill,
                  { width: `${(getStepNumber() / getTotalSteps()) * 100}%` },
                ]}
              />
            </View>
            <ScrollView
              style={s.sheetBody}
              contentContainerStyle={s.sheetBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {registrationStep === "select" && (
                <>
                  <View style={s.searchBox}>
                    <Icon
                      name="magnify"
                      size={20}
                      color="rgba(255,255,255,0.4)"
                    />
                    <TextInput
                      style={s.searchInput}
                      placeholder="Search..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Icon
                          name="close-circle"
                          size={18}
                          color="rgba(255,255,255,0.4)"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {filteredUsers.map((item) => (
                    <UserSelectRow
                      key={item.uid}
                      item={item}
                      selected={selectedDrivers.includes(item.uid)}
                      onPress={toggleDriverSelection}
                      getImageSource={getImageSource}
                    />
                  ))}
                  {filteredUsers.length === 0 && (
                    <Text style={s.noResults}>No users found</Text>
                  )}
                </>
              )}
              {registrationStep === "phones" &&
                Object.keys(missingPhones).map((uid) => {
                  const u = getUserById(uid);
                  return (
                    <View key={uid} style={s.phoneCard}>
                      <Image
                        source={getImageSource(uid)}
                        style={s.phoneAvatar}
                        contentFit="cover"
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
              {registrationStep === "license" && (
                <View style={s.licenseSection}>
                  <View style={s.plateIcon}>
                    <Icon name="card-text-outline" size={28} color="#147efb" />
                  </View>
                  <TextInput
                    style={s.plateInput}
                    placeholder="ABC-1234"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoCapitalize="characters"
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    maxLength={10}
                  />
                </View>
              )}
            </ScrollView>
            <View style={s.sheetFooter}>
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
                </TouchableOpacity>
              )}
              {registrationStep === "phones" && (
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={proceedToLicense}
                  activeOpacity={0.8}
                >
                  <Text style={s.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              )}
              {registrationStep === "license" && (
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    s.greenBtn,
                    (!licensePlate.trim() || saving) && s.btnDisabled,
                  ]}
                  onPress={completeRegistration}
                  disabled={!licensePlate.trim() || saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.primaryBtnText}>Register</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail */}
      <Modal
        visible={detailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={s.centerOverlay}>
          <View style={s.detailCard}>
            <View style={s.detailHeader}>
              <View style={s.detailPlate}>
                <Icon
                  name="car"
                  size={18}
                  color={selectedCar?.present ? "#34c759" : "#147efb"}
                />
                <Text
                  style={[
                    s.detailPlateText,
                    selectedCar?.present && { color: "#34c759" },
                  ]}
                >
                  {selectedCar?.license || "NO PLATE"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={
                selectedCar?.present ? s.statusBtnPresent : s.statusBtnAbsent
              }
              onPress={() =>
                selectedCar?.present
                  ? markCarAbsent(selectedCar)
                  : markCarPresent(selectedCar)
              }
              activeOpacity={0.7}
            >
              <Icon
                name={
                  selectedCar?.present ? "check-circle" : "plus-circle-outline"
                }
                size={18}
                color={selectedCar?.present ? "#34c759" : "#147efb"}
              />
              <Text
                style={
                  selectedCar?.present
                    ? s.statusBtnTextPresent
                    : s.statusBtnTextAbsent
                }
              >
                {selectedCar?.present ? "Present" : "Not Present"}
              </Text>
              <Icon
                name={selectedCar?.present ? "close" : "plus"}
                size={16}
                color={
                  selectedCar?.present ? "rgba(255,255,255,0.4)" : "#147efb"
                }
                style={{ marginLeft: "auto" }}
              />
            </TouchableOpacity>
            <Text style={s.sectionLabel}>Drivers</Text>
            <FlatList
              data={selectedCar?.ownerIds || []}
              keyExtractor={(uid) => uid}
              style={s.driverList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: uid }) => {
                const u = getUserById(uid);
                if (!u) return null;
                return (
                  <DriverCard
                    uid={uid}
                    user={u}
                    imageSource={getImageSource(uid)}
                    hasToken={!!driverTokens[uid]}
                    presentCars={getPresentCarsForPerson(uid)}
                    maxCars={maxCarsPerPerson}
                    limitEnabled={carLimitEnabled}
                    onNotify={openNotify}
                    onCall={callDriver}
                  />
                );
              }}
            />
            <View style={s.detailFooter}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => openEditModal(selectedCar)}
                activeOpacity={0.8}
              >
                <Icon name="pencil" size={18} color="#fff" />
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

      {/* Edit */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.bottomOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={s.editSheet}>
            <View style={s.sheetHeader}>
              <View style={s.sheetHeaderLeft} />
              <Text style={s.sheetTitle}>Edit Vehicle</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <View style={s.editStaticSection}>
              <Text style={s.inputLabel}>License Plate</Text>
              <TextInput
                style={s.plateInputSmall}
                placeholder="ABC-1234"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="characters"
                value={editLicense}
                onChangeText={setEditLicense}
                maxLength={10}
              />
              <Text style={[s.inputLabel, { marginTop: 20 }]}>Drivers</Text>
              <View style={[s.searchBox, { marginBottom: 0 }]}>
                <Icon name="magnify" size={20} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={editSearchQuery}
                  onChangeText={setEditSearchQuery}
                />
                {editSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setEditSearchQuery("")}>
                    <Icon
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={s.editListContainer}>
              <FlatList
                data={editFilteredUsers}
                keyExtractor={(item) => item.uid}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.editUserListContent}
                renderItem={({ item }) => (
                  <UserSelectRow
                    item={item}
                    selected={editDrivers.includes(item.uid)}
                    onPress={toggleEditDriver}
                    getImageSource={getImageSource}
                  />
                )}
                ListEmptyComponent={
                  <Text style={s.noResults}>No users found</Text>
                }
              />
            </View>
            <View style={s.sheetFooter}>
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
                  <Text style={s.primaryBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notify */}
      {notifyVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.centerOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={s.notifyCard}>
                <View style={s.notifyIcon}>
                  <Icon name="bell-ring" size={24} color="#ff9f0a" />
                </View>
                <Text style={s.notifyTitle}>Send Notification</Text>
                <TextInput
                  style={s.notifyInput}
                  placeholder="Title"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={notifyTitle}
                  onChangeText={setNotifyTitle}
                />
                <TextInput
                  style={[s.notifyInput, s.notifyTextarea]}
                  placeholder="Message"
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
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 12 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerStats: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34c759",
    marginRight: 6,
  },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  headerDivider: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    marginHorizontal: 6,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerScanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#147efb",
    justifyContent: "center",
    alignItems: "center",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  carCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1c1c1e",
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  carCardContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  carStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginRight: 12,
  },
  carStatusDotPresent: { backgroundColor: "#34c759" },
  carCardInfo: { flex: 1 },
  licenseText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.5,
  },
  licenseTextPresent: { color: "#34c759" },
  ownerNames: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#1c1c1e",
  },
  extraBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2c2c2e",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -12,
    borderWidth: 2,
    borderColor: "#1c1c1e",
  },
  extraText: { fontSize: 11, fontWeight: "600", color: "#fff" },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#fff" },
  emptySubtitle: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 4 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#147efb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },

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
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 20,
  },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(20,126,251,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuItemContent: { flex: 1 },
  menuItemText: { fontSize: 16, fontWeight: "500", color: "#fff" },
  menuItemTextDanger: { fontSize: 16, fontWeight: "500", color: "#ff453a" },
  menuItemSub: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1 },

  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
  },
  settingsSheet: {
    backgroundColor: "#1c1c1e",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 60,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  settingsTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  settingsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsBody: { paddingHorizontal: 20, paddingBottom: 20 },
  settingCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(20,126,251,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: "500", color: "#fff" },
  settingDesc: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  limitLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
    textAlign: "center",
  },
  limitControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  limitBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  limitValueWrap: { alignItems: "center", marginHorizontal: 32 },
  limitValue: { fontSize: 48, fontWeight: "700", color: "#fff" },
  limitUnit: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: -4 },
  settingsFooter: { paddingHorizontal: 20, paddingBottom: 40 },
  saveBtn: {
    backgroundColor: "#147efb",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 17, fontWeight: "600", color: "#fff" },

  centerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  attendanceCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
  },
  cardClose: { position: "absolute", top: 16, right: 16 },
  attendancePlate: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,126,251,0.1)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  attendancePlateText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 20,
  },
  statusTextGreen: { fontSize: 15, fontWeight: "500", color: "#34c759" },
  statusTextGray: { fontSize: 15, color: "rgba(255,255,255,0.4)" },
  actionBtnGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34c759",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    width: "100%",
  },
  actionBtnRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff453a",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    width: "100%",
  },
  actionBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  detailLink: { marginTop: 16 },
  detailLinkText: { fontSize: 15, color: "#147efb", fontWeight: "500" },

  scanner: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: { width: 240, height: 240 },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#147efb",
    borderWidth: 3,
  },
  cTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scannerHint: {
    position: "absolute",
    bottom: 120,
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
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

  bottomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetHeaderLeft: { width: 24 },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#fff" },
  progressBar: { height: 2, backgroundColor: "rgba(255,255,255,0.08)" },
  progressFill: { height: "100%", backgroundColor: "#147efb" },
  sheetBody: { padding: 20 },
  sheetBodyContent: { paddingBottom: 20 },
  sheetFooter: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 8,
  },
  noResults: {
    textAlign: "center",
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    marginTop: 20,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
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

  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
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

  licenseSection: { alignItems: "center", paddingVertical: 20 },
  plateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(20,126,251,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  plateInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 2,
    width: "100%",
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  plateInputSmall: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 1,
  },

  editStaticSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  editSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    height: "85%",
  },
  editListContainer: { flex: 1, paddingHorizontal: 20 },
  editUserListContent: { paddingBottom: 20, paddingTop: 4 },

  primaryBtn: {
    backgroundColor: "#147efb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  greenBtn: { backgroundColor: "#34c759" },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.4 },

  detailCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxHeight: SH * 0.7,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailPlate: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,126,251,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  detailPlateText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  statusBtnPresent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52,199,89,0.1)",
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  statusBtnAbsent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  statusBtnTextPresent: {
    fontSize: 15,
    color: "#34c759",
    fontWeight: "500",
    flex: 1,
  },
  statusBtnTextAbsent: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  driverList: { maxHeight: 200 },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  driverAvatar: { width: 44, height: 44, borderRadius: 22 },
  driverInfo: { flex: 1, marginLeft: 12 },
  driverName: { fontSize: 15, fontWeight: "500", color: "#fff" },
  driverPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1 },
  limitWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  limitWarningText: { fontSize: 12, color: "#ff9f0a" },
  driverActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  callActionBtn: { backgroundColor: "rgba(52,199,89,0.12)" },
  detailFooter: { flexDirection: "row", marginTop: 16, gap: 10 },
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

  notifyCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 24,
    width: SW - 48,
  },
  notifyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  notifyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  notifyInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  notifyTextarea: { height: 80, textAlignVertical: "top", paddingTop: 12 },
  notifyBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  notifyCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
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
    borderRadius: 10,
    backgroundColor: "#ff9f0a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notifySendText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

export default TrafficManager;
