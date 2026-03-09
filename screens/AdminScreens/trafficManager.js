import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  FlatList, Modal, TextInput, Alert, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform, Keyboard, Dimensions, Switch, Animated,
} from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import {
  VehicleFormSheet, ApprovalFlow, PendingList,
  COLOR_OPTIONS, getUnregCollection,
} from "../../components/TrafficVehicleComponents";
import callFunction from "../../components/functionCalls";

const { width: SW, height: SH } = Dimensions.get("window");
const DEFAULT_PROFILE = require("../../assets/default_profile.png");
const NOTIFICATION_URL = "https://us-central1-taksis-a8ba7.cloudfunctions.net/traffic_notification";
const DEFAULT_CAR_LIMIT = 2;
const RESERVED_ID_PREFIXES = ["spsm_church_parking_management_", "unregistered"];

function isReservedId(id) {
  return RESERVED_ID_PREFIXES.some((p) => id?.startsWith(p));
}

async function migrateUnregUsers() {
  try {
    const snapshot = await firestore().collection("qrCodes")
      .where("isUnregisteredUser", "==", true).get();
    if (snapshot.empty) return;
    const batch = firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.set(getUnregCollection().doc(doc.id), { ...doc.data(), uid: doc.id });
      batch.delete(firestore().collection("qrCodes").doc(doc.id));
    });
    await batch.commit();
  } catch (e) { console.warn("Unreg migration failed:", e); }
}

function normalize(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }
function nameSimilar(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  const aParts = na.split(" "), bParts = nb.split(" ");
  return aParts.some((p) => bParts.includes(p) && p.length > 2);
}
function phoneSimilar(a, b) {
  if (!a || !b) return false;
  const clean = (s) => s.replace(/\D/g, "");
  const ca = clean(a), cb = clean(b);
  return ca === cb || (ca.length >= 7 && cb.includes(ca.slice(-7)));
}

// ── CarCard ───────────────────────────────────────────────────────────────────

const CarCard = memo(({ item, index, getUserById, getImageSource, onPress }) => {
  const ownerIds = item.ownerIds || [];
  const owners = ownerIds.map(getUserById).filter(Boolean);
  const visible = ownerIds.slice(0, 3);
  const extra = ownerIds.length - 3;
  const colorObj = COLOR_OPTIONS.find((c) => c.value === item.color);
  return (
    <TouchableOpacity
      style={[s.carCard, index === 0 && { marginTop: 0 }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[s.carStatusDot, item.present && s.carStatusDotPresent]} />
      <View style={s.carCardInfo}>
        <View style={s.carTopRow}>
          <Text style={[s.licenseText, item.present && s.licenseTextPresent]}>
            {item.license || "NO PLATE"}
          </Text>
          {colorObj && <View style={[s.carColorBar, { backgroundColor: colorObj.hex }]} />}
        </View>
        <Text style={s.ownerNames} numberOfLines={1}>
          {owners.map((o) => o.name?.split(" ")[0]).join(", ") || "Unknown"}
          {item.make || item.model ? ` · ${[item.make, item.model].filter(Boolean).join(" ")}` : ""}
        </Text>
      </View>
      <View style={s.avatarStack}>
        {visible.map((uid, i) => (
          <Image key={uid} source={getImageSource(uid)}
            style={[s.stackedAvatar, { marginLeft: i > 0 ? -12 : 0, zIndex: 3 - i }]}
            contentFit="cover" />
        ))}
        {extra > 0 && (
          <View style={s.extraBadge}><Text style={s.extraText}>+{extra}</Text></View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ── DriverCard ────────────────────────────────────────────────────────────────

const DriverCard = memo(({
  uid, user, imageSource, hasToken, presentCars, maxCars,
  limitEnabled, onNotify, onCall, isUnreg,
}) => {
  const overLimit = limitEnabled && presentCars > maxCars;
  return (
    <View style={s.driverCard}>
      <Image source={imageSource} style={s.driverAvatar} contentFit="cover" />
      <View style={s.driverInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.driverName}>{user.name}</Text>
          {isUnreg ? <View style={s.unregBadge}><Text style={s.unregBadgeText}>No Account</Text></View> : null}
        </View>
        {user.phone ? <Text style={s.driverPhone}>{user.phone}</Text> : null}
        {overLimit ? (
          <View style={s.limitWarning}>
            <Icon name="alert-circle" size={12} color="#ff9f0a" />
            <Text style={s.limitWarningText}>{presentCars}/{maxCars} cars</Text>
          </View>
        ) : null}
      </View>
      <View style={s.driverActions}>
        {hasToken && !isUnreg ? (
          <TouchableOpacity style={s.actionBtn} onPress={() => onNotify(uid)}>
            <Icon name="bell-outline" size={18} color="#ff9f0a" />
          </TouchableOpacity>
        ) : null}
        {user.phone ? (
          <TouchableOpacity style={[s.actionBtn, s.callActionBtn]} onPress={() => onCall(user.phone)}>
            <Icon name="phone" size={18} color="#34c759" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

// ── CarDetailModal ────────────────────────────────────────────────────────────

const CarDetailModal = memo(({
  visible, car, onClose, getUserById, getImageSource,
  driverTokens, getPresentCarsForPerson, maxCarsPerPerson, carLimitEnabled,
  onMarkPresent, onMarkAbsent, onEdit, onDelete, onNotify, onCall,
  showPresenceToggle = true,
}) => {
  const [driverSearch, setDriverSearch] = useState("");
  useEffect(() => { if (visible) setDriverSearch(""); }, [visible]);

  const filteredOwners = useMemo(() => {
    if (!car) return [];
    const q = driverSearch.toLowerCase().trim();
    return (car.ownerIds || []).filter((uid) => {
      if (!q) return true;
      const u = getUserById(uid);
      return u?.name?.toLowerCase().includes(q) || u?.phone?.toLowerCase().includes(q);
    });
  }, [car, driverSearch, getUserById]);

  if (!car) return null;
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={s.centerOverlay}>
        <View style={s.detailCard}>
          <View style={s.detailHeader}>
            <View style={s.detailPlate}>
              <Icon name="car" size={18} color={car.present ? "#34c759" : "#147efb"} />
              <Text style={[s.detailPlateText, car.present && { color: "#34c759" }]}>
                {car.license || "NO PLATE"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {(car.make || car.model || car.color) ? (
            <View style={s.vehicleInfoDisplay}>
              {car.color ? (
                <View style={[s.colorDotDetail, {
                  backgroundColor: COLOR_OPTIONS.find((c) => c.value === car.color)?.hex || "#888",
                }]} />
              ) : null}
              <Text style={s.vehicleInfoText}>
                {[COLOR_OPTIONS.find((c) => c.value === car.color)?.label, car.make, car.model]
                  .filter(Boolean).join(" ")}
              </Text>
            </View>
          ) : null}

          {showPresenceToggle ? (
            <TouchableOpacity
              style={car.present ? s.statusBtnPresent : s.statusBtnAbsent}
              onPress={() => car.present ? onMarkAbsent(car) : onMarkPresent(car)}
              activeOpacity={0.7}
            >
              <Icon name={car.present ? "check-circle" : "plus-circle-outline"} size={18}
                color={car.present ? "#34c759" : "#147efb"} />
              <Text style={car.present ? s.statusBtnTextPresent : s.statusBtnTextAbsent}>
                {car.present ? "Present — tap to mark left" : "Not Present — tap to mark here"}
              </Text>
            </TouchableOpacity>
          ) : (
            !car.present ? (
              <TouchableOpacity style={s.actionBtnGreen} onPress={() => onMarkPresent(car)} activeOpacity={0.8}>
                <Icon name="check" size={18} color="#fff" />
                <Text style={s.actionBtnText}>Mark as Here</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.actionBtnRed} onPress={() => onMarkAbsent(car)} activeOpacity={0.8}>
                <Icon name="logout" size={18} color="#fff" />
                <Text style={s.actionBtnText}>Mark as Left</Text>
              </TouchableOpacity>
            )
          )}

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Drivers</Text>

          {(car.ownerIds?.length ?? 0) > 3 ? (
            <View style={[s.searchBox, { marginBottom: 8 }]}>
              <Icon name="magnify" size={18} color="rgba(255,255,255,0.4)" />
              <TextInput style={s.searchInput} placeholder="Search drivers..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={driverSearch} onChangeText={setDriverSearch} />
              {driverSearch.length > 0 ? (
                <TouchableOpacity onPress={() => setDriverSearch("")}>
                  <Icon name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <FlatList
            data={filteredOwners} keyExtractor={(uid) => uid}
            style={s.driverList} showsVerticalScrollIndicator={false}
            renderItem={({ item: uid }) => {
              const u = getUserById(uid);
              if (!u) return null;
              return (
                <DriverCard uid={uid} user={u} imageSource={getImageSource(uid)}
                  hasToken={!!driverTokens[uid]} presentCars={getPresentCarsForPerson(uid)}
                  maxCars={maxCarsPerPerson} limitEnabled={carLimitEnabled}
                  onNotify={onNotify} onCall={onCall} isUnreg={uid.startsWith("unreg_")} />
              );
            }}
          />

          <View style={s.detailFooter}>
            <TouchableOpacity style={s.editBtn} onPress={() => onEdit(car)} activeOpacity={0.8}>
              <Icon name="pencil" size={18} color="#fff" />
              <Text style={s.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(car)} activeOpacity={0.8}>
              <Icon name="trash-can-outline" size={18} color="#ff453a" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// ── SubSheet ──────────────────────────────────────────────────────────────────

const SubSheet = memo(({ visible, onBack, onClose, title, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose || onBack}>
    <View style={s.subSheetOverlay}>
      <View style={s.subSheet}>
        <View style={s.subSheetHeader}>
          <TouchableOpacity onPress={onBack} style={s.subSheetBackBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={22} color="#147efb" />
            <Text style={s.subSheetBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.subSheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose || onBack} style={s.subSheetCloseBtn} activeOpacity={0.7}>
            <Icon name="close" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  </Modal>
));

// ── Main ──────────────────────────────────────────────────────────────────────

const TrafficManager = () => {
  const user = auth().currentUser;
  const [permission, requestPermission] = useCameraPermissions();

  const [churchId, setChurchId] = useState(null);
  const [cars, setCars] = useState([]);
  const carsRef = useRef([]);
  const [users, setUsers] = useState([]);
  const [unregUsers, setUnregUsers] = useState([]);
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const imageUrlsRef = useRef({});
  const [imgVer, setImgVer] = useState(0);
  const [loading, setLoading] = useState(true);

  const [carSearch, setCarSearch] = useState("");

  const [scannerVisible, setScannerVisible] = useState(false);
  const scannedRef = useRef(false);
  const [currentQrId, setCurrentQrId] = useState(null);

  const [regVisible, setRegVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingCar, setEditingCar] = useState(null);

  const [pendingListVisible, setPendingListVisible] = useState(false);
  const [pendingReadOnly, setPendingReadOnly] = useState(false);
  const [approvalData, setApprovalData] = useState(null);

  const [relinkVisible, setRelinkVisible] = useState(false);
  const [relinkSearch, setRelinkSearch] = useState("");

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [detailFromScan, setDetailFromScan] = useState(false);
  const [driverTokens, setDriverTokens] = useState({});

  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

  const [menuVisible, setMenuVisible] = useState(false);
  const [carLimitEnabled, setCarLimitEnabled] = useState(true);
  const [maxCarsPerPerson, setMaxCarsPerPerson] = useState(DEFAULT_CAR_LIMIT);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempLimit, setTempLimit] = useState(String(DEFAULT_CAR_LIMIT));

  // ── Listeners ──────────────────────────────────────────────────────────────

  useEffect(() => { migrateUnregUsers(); }, []);

  useEffect(() => {
    return firestore().collection("users").doc(user.uid)
      .onSnapshot((doc) => { if (doc.exists) setChurchId(doc.data()?.church ?? null); });
  }, [user.uid]);

  useEffect(() => {
    if (!churchId) return;
    return firestore().collection("churches").doc(churchId).onSnapshot((doc) => {
      if (doc.exists) {
        const limit = doc.data()?.maxCarsPerPerson;
        const enabled = limit !== null && limit !== undefined && limit !== 0;
        setCarLimitEnabled(enabled);
        setMaxCarsPerPerson(enabled ? limit : DEFAULT_CAR_LIMIT);
        setTempLimit(String(enabled ? limit : DEFAULT_CAR_LIMIT));
      }
    });
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const unsubCars = firestore().collection("qrCodes")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const carList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((d) => !d.isUnregisteredUser)
          .sort((a, b) => (a.license || "").localeCompare(b.license || ""));
        setCars(carList);
        carsRef.current = carList;
        setLoading(false);
        carList.forEach((c) => (c.ownerIds || []).forEach((uid) => fetchProfileImage(uid)));
      });

    const unsubUnreg = getUnregCollection().onSnapshot((snapshot) => {
      setUnregUsers(snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data(), isUnreg: true }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    });

    const unsubPending = firestore().collection("pending_registrations")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        setPendingVehicles(snapshot.docs.map((doc) => {
          const d = doc.data();
          return { id: doc.id, license: d.license, church: d.church,
            drivers: d.drivers || [], make: d.make, model: d.model, color: d.color };
        }));
      });

    return () => { unsubCars(); unsubUnreg(); unsubPending(); };
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    return firestore().collection("users").where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs
          .map((doc) => ({ uid: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setUsers(list);
        list.forEach((u) => fetchProfileImage(u.uid));
      });
  }, [churchId]);

  const fetchProfileImage = useCallback(async (uid) => {
    if (!uid || uid.startsWith("unreg_") || imageUrlsRef.current[uid]) return;
    imageUrlsRef.current[uid] = "pending";
    try {
      const url = await storage().ref(`profilePictures/${uid}.png`).getDownloadURL();
      imageUrlsRef.current[uid] = url;
      setImgVer((v) => v + 1);
    } catch { delete imageUrlsRef.current[uid]; }
  }, []);

  const allUsers = useMemo(
    () => [...users, ...unregUsers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users, unregUsers],
  );

  const getUserById = useCallback(
    (uid) => allUsers.find((u) => u.uid === uid),
    [allUsers],
  );

  const getImageSource = useCallback((uid) => {
    const url = imageUrlsRef.current[uid];
    return url && url !== "pending" ? { uri: url } : DEFAULT_PROFILE;
  }, [imgVer]);

  const getPresentCarsForPerson = useCallback(
    (uid) => cars.filter((car) => car.ownerIds?.includes(uid) && car.present).length,
    [cars],
  );

  const checkCarLimit = useCallback((car) => {
    if (!carLimitEnabled) return [];
    return (car.ownerIds || []).reduce((violations, uid) => {
      const currentCount = getPresentCarsForPerson(uid);
      const newCount = car.present ? currentCount : currentCount + 1;
      if (newCount > maxCarsPerPerson)
        violations.push({ uid, name: getUserById(uid)?.name || "Unknown", count: newCount });
      return violations;
    }, []);
  }, [carLimitEnabled, maxCarsPerPerson, getPresentCarsForPerson, getUserById]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const filteredCars = useMemo(() => {
    const q = carSearch.toLowerCase().trim();
    if (!q) return cars;
    return cars.filter((c) => {
      const ownerMatch = (c.ownerIds || []).some((uid) => {
        const u = getUserById(uid);
        return u?.name?.toLowerCase().includes(q) || u?.phone?.toLowerCase().includes(q);
      });
      return c.license?.toLowerCase().includes(q) || c.make?.toLowerCase().includes(q) ||
        c.model?.toLowerCase().includes(q) || ownerMatch;
    });
  }, [cars, carSearch, getUserById]);

  // Cars saved under wrong IDs — valid relink candidates
  const relinkableCars = useMemo(() =>
    cars.filter((c) => !isReservedId(c.id)), [cars]);

  const filteredRelinkCars = useMemo(() => {
    const q = relinkSearch.toLowerCase().trim();
    if (!q) return relinkableCars;
    return relinkableCars.filter((c) => {
      const ownerMatch = (c.ownerIds || []).some((uid) => {
        const u = getUserById(uid);
        return u?.name?.toLowerCase().includes(q) || u?.phone?.toLowerCase().includes(q);
      });
      return c.license?.toLowerCase().includes(q) || c.make?.toLowerCase().includes(q) || ownerMatch;
    });
  }, [relinkSearch, relinkableCars, getUserById]);

  const presentCount = useMemo(() => cars.filter((c) => c.present).length, [cars]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const markCarPresent = useCallback(async (car, skipLimitCheck = false) => {
    if (!skipLimitCheck) {
      const violations = checkCarLimit(car);
      if (violations.length > 0) {
        const names = violations.map((v) => `${v.name} (${v.count} cars)`).join(", ");
        Alert.alert("Car Limit Exceeded",
          `The following drivers have exceeded the ${maxCarsPerPerson} car limit:\n\n${names}\n\nMark as present anyway?`,
          [{ text: "Cancel", style: "cancel" },
           { text: "Mark Anyway", onPress: () => markCarPresent(car, true) }]);
        return;
      }
    }
    try {
      await firestore().collection("qrCodes").doc(car.id).update({ present: true });
    } catch { Alert.alert("Error", "Failed to mark car as present."); }
    setDetailModalVisible(false);
  }, [checkCarLimit, maxCarsPerPerson]);

  const markCarAbsent = useCallback(async (car) => {
    try {
      await firestore().collection("qrCodes").doc(car.id).update({ present: false });
    } catch { Alert.alert("Error", "Failed to mark car as absent."); }
    setDetailModalVisible(false);
  }, []);

  const clearAllAttendance = useCallback(() => {
    Alert.alert("Clear All Attendance", "This will mark all cars as not present. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => {
        try {
          const batch = firestore().batch();
          cars.filter((c) => c.present).forEach((car) =>
            batch.update(firestore().collection("qrCodes").doc(car.id), { present: false }));
          await batch.commit();
        } catch { Alert.alert("Error", "Failed to clear attendance."); }
        setMenuVisible(false);
      }},
    ]);
  }, [cars]);

  const saveCarLimitSettings = useCallback(async (enabled, limit) => {
    try {
      await firestore().collection("churches").doc(churchId)
        .update({ maxCarsPerPerson: enabled ? limit : 0 });
    } catch { Alert.alert("Error", "Failed to save settings."); }
  }, [churchId]);

  const handleToggleLimit = useCallback(async (enabled) => {
    setCarLimitEnabled(enabled);
    await saveCarLimitSettings(enabled, maxCarsPerPerson);
  }, [maxCarsPerPerson, saveCarLimitSettings]);

  const handleSaveLimit = useCallback(async () => {
    const parsed = parseInt(tempLimit, 10);
    if (isNaN(parsed) || parsed < 1) { Alert.alert("Invalid", "Enter a number greater than 0."); return; }
    setMaxCarsPerPerson(parsed);
    await saveCarLimitSettings(carLimitEnabled, parsed);
    setSettingsVisible(false);
  }, [tempLimit, carLimitEnabled, saveCarLimitSettings]);

  // ── Scanner ────────────────────────────────────────────────────────────────

  const openScanner = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan QR codes.");
        return;
      }
    }
    scannedRef.current = false;
    setScannerVisible(true);
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(({ data }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScannerVisible(false);
    setTimeout(() => { scannedRef.current = false; }, 500);

    const currentCars = carsRef.current;
    const existing = currentCars.find((c) => c.id === data);
    if (existing) {
      setSelectedCar(existing);
      setDriverTokens({});
      setDetailFromScan(true);
      setDetailModalVisible(true);
      checkDriverTokens(existing.ownerIds || []);
      return;
    }

    setCurrentQrId(data);
    setTimeout(() => setRegVisible(true), 100);
  }, [checkDriverTokens]);

  // ── Relink handler ─────────────────────────────────────────────────────────

  const handleRelink = useCallback((targetCar) => {
    Alert.alert(
      "Fix Corrupted File",
      `Relink "${targetCar.license || "this vehicle"}" to QR "${currentQrId}"?\n\nThe old document (${targetCar.id}) will be deleted and its data copied here.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Fix & Relink", style: "destructive", onPress: async () => {
          try {
            const { id: oldId, ...carData } = targetCar;
            const batch = firestore().batch();
            batch.set(firestore().collection("qrCodes").doc(currentQrId), carData);
            if (oldId !== currentQrId && oldId !== "unregistered") {
              batch.delete(firestore().collection("qrCodes").doc(oldId));
            }
            await batch.commit();
            setRelinkVisible(false);
            setRegVisible(false);
            Alert.alert("Fixed", `${targetCar.license || "Vehicle"} is now linked to the correct QR.`);
          } catch {
            Alert.alert("Error", "Failed to fix the corrupted file.");
          }
        }},
      ],
    );
  }, [currentQrId]);

  // ── Registration / Edit ────────────────────────────────────────────────────

  const handleRegSave = useCallback(async ({ license, make, model, color, drivers }) => {
    const carData = { church: churchId, license, ownerIds: drivers };
    if (make) carData.make = make;
    if (model) carData.model = model;
    if (color) carData.color = color;
    await firestore().collection("qrCodes").doc(currentQrId).set(carData);
  }, [churchId, currentQrId]);

  const handleEditSave = useCallback(async ({ license, make, model, color, drivers }) => {
    const updateData = {
      license, ownerIds: drivers,
      make: make || firestore.FieldValue.delete(),
      model: model || firestore.FieldValue.delete(),
      color: color || firestore.FieldValue.delete(),
    };
    await firestore().collection("qrCodes").doc(editingCar.id).update(updateData);
  }, [editingCar]);

  const openEditModal = useCallback((car) => {
    setEditingCar(car);
    setDetailModalVisible(false);
    setTimeout(() => setEditVisible(true), 100);
  }, []);

  const confirmDelete = useCallback((car) => {
    Alert.alert("Delete Vehicle?", `Remove ${car.license || "this vehicle"} permanently?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        firestore().collection("qrCodes").doc(car.id).delete();
        setDetailModalVisible(false);
        setEditVisible(false);
      }},
    ]);
  }, []);

  // ── Notify / Call ──────────────────────────────────────────────────────────

  const callDriver = useCallback((phone) => {
    if (phone) Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  }, []);

  const checkDriverTokens = useCallback(async (ownerIds) => {
    const tokens = {};
    await Promise.all(
      ownerIds.filter((uid) => !uid.startsWith("unreg_")).map(async (uid) => {
        try {
          const doc = await firestore().collection("users").doc(uid).get();
          const fcm = doc.data()?.fcmTokens;
          if (fcm && Object.keys(fcm).length > 0) tokens[uid] = fcm;
        } catch {}
      }),
    );
    setDriverTokens(tokens);
  }, []);

  const openNotify = useCallback((uid) => {
    const tokens = driverTokens[uid];
    if (!tokens || Object.keys(tokens).length === 0) return;
    setNotifyTokens(Object.values(tokens));
    setNotifyTitle("Please Move Your Car");
    setNotifyMsg("Your vehicle is blocking traffic. Please move it as soon as possible.");
    setDetailModalVisible(false);
    setNotifyVisible(true);
  }, [driverTokens]);

  const sendNotify = useCallback(() => {
    if (!notifyTitle.trim() || !notifyMsg.trim()) {
      Alert.alert("Missing Info", "Please enter title and message."); return;
    }
    callFunction(user, NOTIFICATION_URL,
      { tokens: notifyTokens, title: notifyTitle.trim(), message: notifyMsg.trim() },
      "Failed to send notification.");
    setNotifyVisible(false);
    Alert.alert("Sent", "Notification sent.");
  }, [notifyTitle, notifyMsg, notifyTokens, user]);

  const openCarDetail = useCallback((car) => {
    setSelectedCar(car);
    setDriverTokens({});
    setDetailFromScan(false);
    setDetailModalVisible(true);
    checkDriverTokens(car.ownerIds || []);
  }, [checkDriverTokens]);

  const renderCarItem = useCallback(({ item, index }) => (
    <CarCard item={item} index={index}
      getUserById={getUserById} getImageSource={getImageSource} onPress={openCarDetail} />
  ), [getUserById, getImageSource, openCarDetail]);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={s.loadingText}>Loading...</Text>
      </View>
    );
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>

   {/* Header */}
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
          <TouchableOpacity style={s.headerBtn} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
            <Icon name="cog-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerScanBtn} onPress={openScanner} activeOpacity={0.8}>
            <Icon name="qrcode-scan" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      {cars.length > 0 ? (
        <View style={[s.searchBox, { marginHorizontal: 16, marginBottom: 8 }]}>
          <Icon name="magnify" size={20} color="rgba(255,255,255,0.4)" />
          <TextInput style={s.searchInput} placeholder="Search by plate, owner, make..."
            placeholderTextColor="rgba(255,255,255,0.3)" value={carSearch} onChangeText={setCarSearch} />
          {carSearch.length > 0 ? (
            <TouchableOpacity onPress={() => setCarSearch("")}>
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Car list */}
      {cars.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Icon name="car-outline" size={40} color="rgba(255,255,255,0.15)" />
          </View>
          <Text style={s.emptyTitle}>No Vehicles</Text>
          <Text style={s.emptySubtitle}>Scan a QR code to get started</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={openScanner} activeOpacity={0.8}>
            <Icon name="qrcode-scan" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList data={filteredCars} keyExtractor={(item) => item.id}
          renderItem={renderCarItem} contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No results</Text>
            </View>
          }
        />
      )}

      {cars.length > 0 && (
        <TouchableOpacity style={s.fab} onPress={openScanner} activeOpacity={0.9}>
          <Icon name="qrcode-scan" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Registration ── */}
      <VehicleFormSheet
        visible={regVisible}
        mode="register"
        initialData={null}
        allUsers={allUsers}
        getImageSource={getImageSource}
        onSave={handleRegSave}
        onClose={() => setRegVisible(false)}
        pendingVehicles={pendingVehicles}
        onOpenPending={pendingVehicles.length > 0 ? () => {
          setRegVisible(false);
          setTimeout(() => setPendingListVisible(true), 300);
        } : null}
        onOpenRelink={relinkableCars.length > 0 ? () => {
          setRelinkSearch("");
          setRegVisible(false);
          setTimeout(() => setRelinkVisible(true), 300);
        } : null}
      />

      {/* ── Edit ── */}
      <VehicleFormSheet
        visible={editVisible}
        mode="edit"
        initialData={editingCar ? {
          license: editingCar.license, make: editingCar.make,
          model: editingCar.model, color: editingCar.color, drivers: editingCar.ownerIds,
        } : null}
        allUsers={allUsers}
        getImageSource={getImageSource}
        onSave={handleEditSave}
        onClose={() => setEditVisible(false)}
      />

      {/* ── Car detail ── */}
      <CarDetailModal
        visible={detailModalVisible} car={selectedCar}
        onClose={() => setDetailModalVisible(false)}
        getUserById={getUserById} getImageSource={getImageSource}
        driverTokens={driverTokens} getPresentCarsForPerson={getPresentCarsForPerson}
        maxCarsPerPerson={maxCarsPerPerson} carLimitEnabled={carLimitEnabled}
        onMarkPresent={markCarPresent} onMarkAbsent={markCarAbsent}
        onEdit={openEditModal} onDelete={confirmDelete}
        onNotify={openNotify} onCall={callDriver}
        showPresenceToggle={!detailFromScan}
      />

      {/* ── Pending list (SubSheet) ── */}
      <SubSheet
        visible={pendingListVisible}
        title="Pending Vehicles"
        onBack={() => {
          setPendingListVisible(false);
          setPendingReadOnly(false);
          setTimeout(() => setRegVisible(true), 300);
        }}
        onClose={() => {
          setPendingListVisible(false);
          setPendingReadOnly(false);
        }}
      >
        <PendingList
          pendingVehicles={pendingVehicles}
          hideHeader
          onClose={() => {
            setPendingListVisible(false);
            setPendingReadOnly(false);
          }}
          onSelect={pendingReadOnly ? null : (v) => {
            setPendingListVisible(false);
            setTimeout(() => setApprovalData({ vehicle: v, qrId: currentQrId }), 150);
          }}
        />
      </SubSheet>

      {/* ── Relink (fix corrupted file) (SubSheet) ── */}
      <SubSheet
        visible={relinkVisible}
        title="Fix Corrupted File"
        onBack={() => {
          setRelinkVisible(false);
          setTimeout(() => setRegVisible(true), 300);
        }}
        onClose={() => setRelinkVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.subSheetSubtitle}>
            Pick the vehicle whose data was saved under the wrong ID. It will be copied to this QR and the old entry deleted.
          </Text>
          <View style={[s.searchBox, { marginHorizontal: 16, marginTop: 4, marginBottom: 8 }]}>
            <Icon name="magnify" size={18} color="rgba(255,255,255,0.4)" />
            <TextInput style={s.searchInput} placeholder="Search by plate, owner, make..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={relinkSearch} onChangeText={setRelinkSearch} />
            {relinkSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setRelinkSearch("")}>
                <Icon name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={filteredRelinkCars}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 32 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, letterSpacing: 0 }}>
                  {relinkSearch.length > 0 ? "No vehicles match" : "No corrupted files found"}
                </Text>
              </View>
            }
            renderItem={({ item: c }) => {
              const owners = (c.ownerIds || []).map(getUserById).filter(Boolean);
              const colorObj = COLOR_OPTIONS.find((x) => x.value === c.color);
              return (
                <TouchableOpacity style={s.relinkCard} onPress={() => handleRelink(c)} activeOpacity={0.7}>
                  <View style={s.relinkCardLeft}>
                    {colorObj ? (
                      <View style={[s.carColorBar, { backgroundColor: colorObj.hex, marginRight: 10 }]} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={s.relinkLicense}>{c.license || "NO PLATE"}</Text>
                      <Text style={s.relinkMeta}>
                        {[c.make, c.model].filter(Boolean).join(" ") || "No info"}
                      </Text>
                      <Text style={s.relinkDrivers}>
                        {owners.map((o) => o.name?.split(" ")[0]).join(", ") || "Unknown"}
                      </Text>
                      <Text style={s.relinkId} numberOfLines={1}>ID: {c.id}</Text>
                    </View>
                  </View>
                  <View style={s.relinkBtn}>
                    <Icon name="link-variant" size={16} color="#bf5af2" />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SubSheet>

      {/* ── Approval flow ── */}
      <Modal visible={!!approvalData} animationType="none" transparent
        onRequestClose={() => setApprovalData(null)}>
        <View style={s.bottomOverlay}>
          <View style={s.approvalSheet}>
            <View style={s.sheetHeader}>
              <View style={s.sheetHeaderLeft} />
              <Text style={s.sheetTitle}>Approve — {approvalData?.vehicle?.license}</Text>
              <TouchableOpacity onPress={() => setApprovalData(null)}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {approvalData ? (
              <ApprovalFlow
                vehicle={approvalData.vehicle} churchUsers={users} unregUsers={unregUsers}
                currentQrId={approvalData.qrId} churchId={churchId}
                onDone={() => {
                  const lic = approvalData.vehicle.license;
                  setApprovalData(null);
                  setRegVisible(false);
                  Alert.alert("Registered", `${lic} has been registered.`);
                }}
                onCancel={() => setApprovalData(null)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Menu ── */}
      <Modal visible={menuVisible} animationType="fade" transparent onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={s.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.menuSheet}>
                <View style={s.menuHandle} />
                <TouchableOpacity style={s.menuItem}
                  onPress={() => { setMenuVisible(false); setSettingsVisible(true); }} activeOpacity={0.7}>
                  <View style={s.menuIconWrap}><Icon name="speedometer" size={20} color="#147efb" /></View>
                  <View style={s.menuItemContent}>
                    <Text style={s.menuItemText}>Car Limit</Text>
                    <Text style={s.menuItemSub}>{carLimitEnabled ? `${maxCarsPerPerson} per person` : "Disabled"}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={() => {
                  setMenuVisible(false);
                  setPendingReadOnly(true);
                  setTimeout(() => setPendingListVisible(true), 250);
                }} activeOpacity={0.7}>
                  <View style={[s.menuIconWrap, { backgroundColor: "rgba(255,159,10,0.15)" }]}>
                    <Icon name="clock-outline" size={20} color="#ff9f0a" />
                  </View>
                  <View style={s.menuItemContent}>
                    <Text style={s.menuItemText}>Pending Vehicles</Text>
                    <Text style={s.menuItemSub}>
                      {pendingVehicles.length > 0 ? `${pendingVehicles.length} awaiting approval` : "No pending vehicles"}
                    </Text>
                  </View>
                  {pendingVehicles.length > 0 && (
                    <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>{pendingVehicles.length}</Text></View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={clearAllAttendance} activeOpacity={0.7}>
                  <View style={[s.menuIconWrap, { backgroundColor: "rgba(255,69,58,0.15)" }]}>
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

      {/* ── Settings ── */}
      <Modal visible={settingsVisible} animationType="slide" transparent onRequestClose={() => setSettingsVisible(false)}>
        <View style={s.settingsOverlay}>
          <View style={s.settingsSheet}>
            <View style={s.settingsHeader}>
              <Text style={s.settingsTitle}>Car Limit</Text>
              <TouchableOpacity style={s.settingsCloseBtn} onPress={() => setSettingsVisible(false)}>
                <Icon name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={s.settingsBody}>
              <View style={s.settingCard}>
                <View style={s.settingRow}>
                  <View style={s.settingIconWrap}><Icon name="car-multiple" size={22} color="#147efb" /></View>
                  <View style={s.settingInfo}>
                    <Text style={s.settingLabel}>Enable Limit</Text>
                    <Text style={s.settingDesc}>Alert when exceeded</Text>
                  </View>
                  <Switch value={carLimitEnabled} onValueChange={handleToggleLimit} trackColor={{ true: "#34c759" }} />
                </View>
              </View>
              {carLimitEnabled ? (
                <View style={s.settingCard}>
                  <Text style={s.limitLabel}>Maximum per person</Text>
                  <View style={s.limitControl}>
                    <TouchableOpacity style={s.limitBtn}
                      onPress={() => setTempLimit(String(Math.max(1, parseInt(tempLimit, 10) - 1 || 1)))}
                      activeOpacity={0.7}>
                      <Icon name="minus" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={s.limitValueWrap}>
                      <Text style={s.limitValue}>{tempLimit}</Text>
                      <Text style={s.limitUnit}>cars</Text>
                    </View>
                    <TouchableOpacity style={s.limitBtn}
                      onPress={() => setTempLimit(String(Math.min(99, parseInt(tempLimit, 10) + 1 || 1)))}
                      activeOpacity={0.7}>
                      <Icon name="plus" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
            <View style={s.settingsFooter}>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveLimit} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Scanner ── */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={s.scanner}>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned} />
          <View style={s.scannerFrame}>
            <View style={[s.corner, s.cTL]} /><View style={[s.corner, s.cTR]} />
            <View style={[s.corner, s.cBL]} /><View style={[s.corner, s.cBR]} />
          </View>
          <Text style={s.scannerHint}>Align QR code</Text>
          <TouchableOpacity style={s.scannerClose} onPress={() => setScannerVisible(false)}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Notify ── */}
      {notifyVisible ? (
        <Modal visible animationType="fade" transparent onRequestClose={() => setNotifyVisible(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.centerOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View style={s.notifyCard}>
                  <View style={s.notifyIcon}><Icon name="bell-ring" size={24} color="#ff9f0a" /></View>
                  <Text style={s.notifyTitleText}>Send Notification</Text>
                  <TextInput style={s.notifyInput} placeholder="Title"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyTitle} onChangeText={setNotifyTitle} />
                  <TextInput style={[s.notifyInput, s.notifyTextarea]} placeholder="Message"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyMsg} onChangeText={setNotifyMsg} multiline textAlignVertical="top" />
                  <View style={s.notifyBtns}>
                    <TouchableOpacity style={s.notifyCancelBtn} onPress={() => setNotifyVisible(false)}>
                      <Text style={s.notifyCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.notifySendBtn} onPress={sendNotify}>
                      <Icon name="send" size={16} color="#fff" />
                      <Text style={s.notifySendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}

    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  loadingContainer: { flex: 1, backgroundColor: "#121212", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 12, letterSpacing: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: "700", color: "#fff", letterSpacing: -0.5 },
  headerStats: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34c759", marginRight: 6 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: 0 },
  headerDivider: { fontSize: 14, color: "rgba(255,255,255,0.3)", marginHorizontal: 6 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  headerScanBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#147efb", justifyContent: "center", alignItems: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 12, marginLeft: 8, letterSpacing: 0 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  carCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", padding: 14, borderRadius: 16, marginTop: 8, gap: 10 },
  carStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  carStatusDotPresent: { backgroundColor: "#34c759" },
  carCardInfo: { flex: 1, justifyContent: "center" },
  carTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  licenseText: { fontSize: 17, fontWeight: "600", color: "#fff", letterSpacing: 0.5 },
  licenseTextPresent: { color: "#34c759" },
  carColorBar: { width: 28, height: 14, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  ownerNames: { fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 0 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackedAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#1c1c1e" },
  extraBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2c2c2e", justifyContent: "center", alignItems: "center", marginLeft: -12, borderWidth: 2, borderColor: "#1c1c1e" },
  extraText: { fontSize: 11, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  emptySubtitle: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: 0 },
  emptyBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#147efb", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 24, gap: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: "#147efb", justifyContent: "center", alignItems: "center" },
  bottomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  centerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 24 },
  // SubSheet
  subSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  subSheet: { position: "absolute", bottom: 0, left: 0, right: 0, height: "88%", backgroundColor: "#1a1a1a", borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  subSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  subSheetBackBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, paddingHorizontal: 4, minWidth: 64 },
  subSheetBackText: { fontSize: 16, color: "#147efb", fontWeight: "500", letterSpacing: 0 },
  subSheetCloseBtn: { width: 64, alignItems: "flex-end", paddingRight: 4 },
  subSheetTitle: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  subSheetSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, letterSpacing: 0 },
  // Relink cards
  relinkCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 10 },
  relinkCardLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  relinkLicense: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  relinkMeta: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1, letterSpacing: 0 },
  relinkDrivers: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 1, letterSpacing: 0 },
  relinkId: { fontSize: 11, color: "rgba(191,90,242,0.6)", marginTop: 3, letterSpacing: 0 },
  relinkBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(191,90,242,0.12)", justifyContent: "center", alignItems: "center" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  sheetHeaderLeft: { width: 24 },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  approvalSheet: { backgroundColor: "#1c1c1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", height: "85%" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: "#1c1c1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  menuIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(20,126,251,0.15)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  menuItemContent: { flex: 1 },
  menuItemText: { fontSize: 16, fontWeight: "500", color: "#fff", letterSpacing: 0 },
  menuItemTextDanger: { fontSize: 16, fontWeight: "500", color: "#ff453a", letterSpacing: 0 },
  menuItemSub: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1, letterSpacing: 0 },
  pendingBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#ff9f0a", justifyContent: "center", alignItems: "center" },
  pendingBadgeText: { fontSize: 10, fontWeight: "700", color: "#000" },
  settingsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-start" },
  settingsSheet: { backgroundColor: "#1c1c1e", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingTop: 60 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  settingsTitle: { fontSize: 24, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  settingsCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  settingsBody: { paddingHorizontal: 20, paddingBottom: 20 },
  settingCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 12 },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(20,126,251,0.15)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: "500", color: "#fff", letterSpacing: 0 },
  settingDesc: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1, letterSpacing: 0 },
  limitLabel: { fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 16, textAlign: "center", letterSpacing: 0 },
  limitControl: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  limitBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  limitValueWrap: { alignItems: "center", marginHorizontal: 32 },
  limitValue: { fontSize: 48, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  limitUnit: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: -4, letterSpacing: 0 },
  settingsFooter: { paddingHorizontal: 20, paddingBottom: 40 },
  saveBtn: { backgroundColor: "#147efb", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveBtnText: { fontSize: 17, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  detailCard: { backgroundColor: "#1c1c1e", borderRadius: 20, padding: 20, width: "100%", maxHeight: SH * 0.8 },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  detailPlate: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(20,126,251,0.1)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 8 },
  detailPlateText: { fontSize: 18, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  vehicleInfoDisplay: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  colorDotDetail: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  vehicleInfoText: { fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: 0 },
  statusBtnPresent: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(52,199,89,0.1)", padding: 14, borderRadius: 12, gap: 10, marginBottom: 16 },
  statusBtnAbsent: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", padding: 14, borderRadius: 12, gap: 10, marginBottom: 16 },
  statusBtnTextPresent: { fontSize: 15, color: "#34c759", fontWeight: "500", flex: 1, letterSpacing: 0 },
  statusBtnTextAbsent: { fontSize: 15, color: "rgba(255,255,255,0.5)", flex: 1, letterSpacing: 0 },
  actionBtnGreen: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#34c759", paddingVertical: 14, borderRadius: 12, gap: 8, width: "100%", marginBottom: 16 },
  actionBtnRed: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#ff453a", paddingVertical: 14, borderRadius: 12, gap: 8, width: "100%", marginBottom: 16 },
  actionBtnText: { fontSize: 16, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  driverList: { maxHeight: 220 },
  detailFooter: { flexDirection: "row", marginTop: 16, gap: 10 },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#147efb", paddingVertical: 14, borderRadius: 12, gap: 8 },
  editBtnText: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  deleteBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: "rgba(255,69,58,0.12)", justifyContent: "center", alignItems: "center" },
  driverCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 12, marginBottom: 8 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22 },
  driverInfo: { flex: 1, marginLeft: 12 },
  driverName: { fontSize: 15, fontWeight: "500", color: "#fff", letterSpacing: 0 },
  driverPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 1, letterSpacing: 0 },
  limitWarning: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  limitWarningText: { fontSize: 12, color: "#ff9f0a", letterSpacing: 0 },
  driverActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center" },
  callActionBtn: { backgroundColor: "rgba(52,199,89,0.12)" },
  unregBadge: { backgroundColor: "rgba(255,159,10,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unregBadgeText: { fontSize: 10, fontWeight: "600", color: "#ff9f0a", letterSpacing: 0 },
  scanner: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  scannerFrame: { width: 240, height: 240 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#147efb", borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  scannerHint: { position: "absolute", bottom: 120, color: "#fff", fontSize: 15, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, letterSpacing: 0 },
  scannerClose: { position: "absolute", top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  notifyCard: { backgroundColor: "#1c1c1e", borderRadius: 20, padding: 24, width: SW - 48 },
  notifyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  notifyTitleText: { fontSize: 18, fontWeight: "600", color: "#fff", textAlign: "center", marginBottom: 20, letterSpacing: 0 },
  notifyInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 12, letterSpacing: 0 },
  notifyTextarea: { height: 80, textAlignVertical: "top", paddingTop: 12 },
  notifyBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  notifyCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" },
  notifyCancelText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.7)", letterSpacing: 0 },
  notifySendBtn: { flex: 1, flexDirection: "row", paddingVertical: 14, borderRadius: 10, backgroundColor: "#ff9f0a", alignItems: "center", justifyContent: "center", gap: 6 },
  notifySendText: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  pendingSheetOuter: { maxHeight: "80%", height: "80%" },
});

export default TrafficManager;