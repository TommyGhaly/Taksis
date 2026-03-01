import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
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
  Switch,
  ScrollView,
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

const getUnregCollection = () =>
  firestore().collection("qrCodes").doc("unregistered").collection("people");

async function migrateUnregUsers() {
  try {
    const snapshot = await firestore()
      .collection("qrCodes")
      .where("isUnregisteredUser", "==", true)
      .get();
    if (snapshot.empty) return;
    const batch = firestore().batch();
    snapshot.docs.forEach((doc) => {
      const dest = getUnregCollection().doc(doc.id);
      batch.set(dest, { ...doc.data(), uid: doc.id });
      batch.delete(firestore().collection("qrCodes").doc(doc.id));
    });
    await batch.commit();
  } catch (e) {
    console.warn("Unreg migration failed:", e);
  }
}

const COLOR_OPTIONS = [
  { label: "White", value: "white", hex: "#FFFFFF" },
  { label: "Black", value: "black", hex: "#1a1a1a" },
  { label: "Silver", value: "silver", hex: "#C0C0C0" },
  { label: "Gray", value: "gray", hex: "#808080" },
  { label: "Red", value: "red", hex: "#D32F2F" },
  { label: "Blue", value: "blue", hex: "#1976D2" },
  { label: "Green", value: "green", hex: "#388E3C" },
  { label: "Brown", value: "brown", hex: "#795548" },
  { label: "Beige", value: "beige", hex: "#D4C5A9" },
  { label: "Orange", value: "orange", hex: "#F57C00" },
  { label: "Yellow", value: "yellow", hex: "#FBC02D" },
  { label: "Gold", value: "gold", hex: "#FFD700" },
];

// ── Fuzzy helpers ─────────────────────────────────────────────────────────────

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function nameSimilar(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  const aParts = na.split(" ");
  const bParts = nb.split(" ");
  return aParts.some((p) => bParts.includes(p) && p.length > 2);
}

function phoneSimilar(a, b) {
  if (!a || !b) return false;
  const clean = (s) => s.replace(/\D/g, "");
  const ca = clean(a);
  const cb = clean(b);
  return ca === cb || (ca.length >= 7 && cb.includes(ca.slice(-7)));
}

// ── Replace CarCard component ────────────────────────────────────────────────

const CarCard = memo(
  ({ item, index, getUserById, getImageSource, onPress }) => {
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
        {/* Status dot */}
        <View style={[s.carStatusDot, item.present && s.carStatusDotPresent]} />

        {/* Center: license + color on top, owner/vehicle info below */}
        <View style={s.carCardInfo}>
          <View style={s.carTopRow}>
            <Text style={[s.licenseText, item.present && s.licenseTextPresent]}>
              {item.license || "NO PLATE"}
            </Text>
            {colorObj && (
              <View
                style={[s.carColorBar, { backgroundColor: colorObj.hex }]}
              />
            )}
          </View>
          <Text style={s.ownerNames} numberOfLines={1}>
            {owners.map((o) => o.name?.split(" ")[0]).join(", ") || "Unknown"}
            {item.make || item.model
              ? ` · ${[item.make, item.model].filter(Boolean).join(" ")}`
              : ""}
          </Text>
        </View>

        {/* Right: avatar stack */}
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
// ── UserSelectRow ─────────────────────────────────────────────────────────────

const UserSelectRow = memo(
  ({ item, selected, onPress, getImageSource, isUnreg, onDelete }) => (
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.userName}>{item.name}</Text>
          {isUnreg && (
            <View style={s.unregBadge}>
              <Text style={s.unregBadgeText}>No Account</Text>
            </View>
          )}
        </View>
        {item.phone ? <Text style={s.userPhone}>{item.phone}</Text> : null}
      </View>
      {isUnreg && onDelete ? (
        <TouchableOpacity
          style={s.unregDeleteBtn}
          onPress={() => onDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="trash-can-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      ) : null}
      <View style={[s.checkbox, selected && s.checkboxSelected]}>
        {selected ? <Icon name="check" size={14} color="#fff" /> : null}
      </View>
    </TouchableOpacity>
  ),
);

// ── DriverCard ────────────────────────────────────────────────────────────────

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
    isUnreg,
  }) => {
    const overLimit = limitEnabled && presentCars > maxCars;
    return (
      <View style={s.driverCard}>
        <Image source={imageSource} style={s.driverAvatar} contentFit="cover" />
        <View style={s.driverInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.driverName}>{user.name}</Text>
            {isUnreg ? (
              <View style={s.unregBadge}>
                <Text style={s.unregBadgeText}>No Account</Text>
              </View>
            ) : null}
          </View>
          {user.phone ? <Text style={s.driverPhone}>{user.phone}</Text> : null}
          {overLimit ? (
            <View style={s.limitWarning}>
              <Icon name="alert-circle" size={12} color="#ff9f0a" />
              <Text style={s.limitWarningText}>
                {presentCars}/{maxCars} cars
              </Text>
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
            <TouchableOpacity
              style={[s.actionBtn, s.callActionBtn]}
              onPress={() => onCall(user.phone)}
            >
              <Icon name="phone" size={18} color="#34c759" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  },
);

// ── ColorPicker ───────────────────────────────────────────────────────────────

const ColorPicker = memo(({ value, onSelect, visible, onToggle }) => {
  const selected = COLOR_OPTIONS.find((c) => c.value === value);
  return (
    <View>
      <TouchableOpacity
        style={s.colorPickerBtn}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {selected ? (
          <>
            <View style={[s.colorSwatch, { backgroundColor: selected.hex }]} />
            <Text style={s.colorPickerText}>{selected.label}</Text>
          </>
        ) : (
          <Text style={s.colorPickerPlaceholder}>Select color</Text>
        )}
        <Icon
          name={visible ? "chevron-up" : "chevron-down"}
          size={18}
          color="rgba(255,255,255,0.4)"
        />
      </TouchableOpacity>
      {visible ? (
        <View style={s.colorGrid}>
          {COLOR_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[
                s.colorOption,
                value === c.value && s.colorOptionSelected,
              ]}
              onPress={() => onSelect(c.value)}
              activeOpacity={0.7}
            >
              <View style={[s.colorOptionSwatch, { backgroundColor: c.hex }]} />
              <Text style={s.colorOptionLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
});

// ── AddGuestInline ────────────────────────────────────────────────────────────

const AddGuestInline = memo(({ visible, onSave, onCancel, saving }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (visible) {
      setName("");
      setPhone("");
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={s.inlineAddGuest}>
      <View style={s.inlineAddGuestHeader}>
        <Icon name="account-plus" size={18} color="#147efb" />
        <Text style={s.inlineAddGuestTitle}>Add Person</Text>
      </View>
      <TextInput
        style={s.inlineInput}
        placeholder="Full Name"
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={s.inlineInput}
        placeholder="Phone Number"
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <View style={s.inlineAddGuestBtns}>
        <TouchableOpacity
          style={s.inlineGuestCancelBtn}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={s.inlineGuestCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.inlineGuestSaveBtn,
            (!name.trim() || !phone.trim() || saving) && { opacity: 0.4 },
          ]}
          onPress={() => onSave(name.trim(), phone.trim())}
          disabled={!name.trim() || !phone.trim() || saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.inlineGuestSaveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── ApprovalFlow ──────────────────────────────────────────────────────────────

function ApprovalFlow({
  vehicle,
  churchUsers,
  unregUsers,
  currentQrId,
  churchId,
  onDone,
  onCancel,
}) {
  const [step, setStep] = useState(0);
  const [resolutions, setResolutions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [matchStage, setMatchStage] = useState("app");
  const [appMatches, setAppMatches] = useState([]);
  const [unregMatches, setUnregMatches] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const driver = vehicle.drivers[step];

  useEffect(() => {
    if (!driver) return;
    setNewName(driver.name);
    setNewPhone(driver.phone);
    if (driver.has_taksis) {
      const matches = churchUsers.filter(
        (u) =>
          nameSimilar(u.name, driver.name) ||
          phoneSimilar(u.phone, driver.phone),
      );
      setAppMatches(matches);
      setMatchStage(matches.length > 0 ? "app" : "unreg");
    } else {
      setMatchStage("unreg");
    }
    const uMatches = unregUsers.filter(
      (u) =>
        nameSimilar(u.name, driver.name) || phoneSimilar(u.phone, driver.phone),
    );
    setUnregMatches(uMatches);
  }, [step]);

  function resolveWith(uid, isUnreg) {
    const newRes = [...resolutions, { uid, isUnreg }];
    setResolutions(newRes);
    if (step + 1 < vehicle.drivers.length) {
      setStep((s) => s + 1);
    } else {
      finalize(newRes);
    }
  }

  async function createUnregAndResolve(name, phone) {
    setSaving(true);
    try {
      const docId = `unreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await getUnregCollection().doc(docId).set({ name, phone, uid: docId });
      resolveWith(docId, true);
    } catch {
      Alert.alert("Error", "Failed to create person.");
    } finally {
      setSaving(false);
    }
  }

  async function finalize(res) {
    setSaving(true);
    try {
      const ownerIds = res.map((r) => r.uid);
      const carData = {
        church: churchId,
        license: vehicle.license,
        ownerIds,
        present: false,
      };
      if (vehicle.make) carData.make = vehicle.make;
      if (vehicle.model) carData.model = vehicle.model;
      if (vehicle.color) carData.color = vehicle.color;
      await firestore().collection("qrCodes").doc(currentQrId).set(carData);
      await firestore()
        .collection("pending_registrations")
        .doc(vehicle.id)
        .delete();
      onDone();
    } catch {
      Alert.alert("Error", "Failed to register vehicle.");
    } finally {
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <View style={s.approvalCenter}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={s.approvalSavingText}>Saving...</Text>
      </View>
    );
  }

  const progress = `Driver ${step + 1} of ${vehicle.drivers.length}`;

  if (driver.has_taksis && matchStage === "app") {
    return (
      <View style={s.approvalContainer}>
        <Text style={s.approvalProgress}>{progress}</Text>
        <View style={s.approvalDriverHeader}>
          <Icon name="account-check" size={20} color="#147efb" />
          <Text style={s.approvalDriverName}>{driver.name}</Text>
          <View style={s.taksisBadge}>
            <Text style={s.taksisBadgeText}>Has Taksis</Text>
          </View>
        </View>
        <Text style={s.approvalSubtitle}>Select the matching Taksis user:</Text>
        <FlatList
          data={appMatches}
          keyExtractor={(u) => u.uid}
          style={s.approvalList}
          renderItem={({ item: u }) => (
            <TouchableOpacity
              style={s.matchRow}
              onPress={() => resolveWith(u.uid, false)}
              activeOpacity={0.7}
            >
              <View style={s.matchInfo}>
                <Text style={s.matchName}>{u.name}</Text>
                {u.phone ? <Text style={s.matchPhone}>{u.phone}</Text> : null}
              </View>
              <Icon
                name="chevron-right"
                size={20}
                color="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          )}
        />
        <View style={s.approvalActions}>
          <TouchableOpacity
            style={s.approvalSecondaryBtn}
            onPress={() => setMatchStage("unreg")}
            activeOpacity={0.7}
          >
            <Text style={s.approvalSecondaryText}>None of these match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.approvalDangerBtn}
            onPress={() => setMatchStage("unreg")}
            activeOpacity={0.7}
          >
            <Text style={s.approvalDangerText}>Not actually in app</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (matchStage === "unreg" && unregMatches.length > 0) {
    return (
      <View style={s.approvalContainer}>
        <Text style={s.approvalProgress}>{progress}</Text>
        <View style={s.approvalDriverHeader}>
          <Icon name="account" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={s.approvalDriverName}>{driver.name}</Text>
        </View>
        <Text style={s.approvalSubtitle}>
          Similar people already exist — is this one of them?
        </Text>
        <FlatList
          data={unregMatches}
          keyExtractor={(u) => u.uid}
          style={s.approvalList}
          renderItem={({ item: u }) => (
            <TouchableOpacity
              style={s.matchRow}
              onPress={() => resolveWith(u.uid, true)}
              activeOpacity={0.7}
            >
              <View style={s.matchInfo}>
                <Text style={s.matchName}>{u.name}</Text>
                {u.phone ? <Text style={s.matchPhone}>{u.phone}</Text> : null}
                <View style={s.unregBadge}>
                  <Text style={s.unregBadgeText}>No Account</Text>
                </View>
              </View>
              <Icon
                name="chevron-right"
                size={20}
                color="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={s.approvalSecondaryBtn}
          onPress={() => setMatchStage("new")}
          activeOpacity={0.7}
        >
          <Text style={s.approvalSecondaryText}>
            None of these — create new
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.approvalContainer}>
      <Text style={s.approvalProgress}>{progress}</Text>
      <View style={s.approvalDriverHeader}>
        <Icon name="account-plus" size={20} color="#34c759" />
        <Text style={s.approvalDriverName}>{driver.name}</Text>
      </View>
      <Text style={s.approvalSubtitle}>Add as unregistered person:</Text>
      <View style={s.approvalInputGroup}>
        <TextInput
          style={s.approvalInput}
          placeholder="Full Name"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={newName}
          onChangeText={setNewName}
          autoCapitalize="words"
        />
        <TextInput
          style={s.approvalInput}
          placeholder="Phone Number"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={newPhone}
          onChangeText={setNewPhone}
          keyboardType="phone-pad"
        />
      </View>
      <TouchableOpacity
        style={[
          s.approvalPrimaryBtn,
          (!newName.trim() || !newPhone.trim()) && { opacity: 0.4 },
        ]}
        onPress={() => createUnregAndResolve(newName.trim(), newPhone.trim())}
        disabled={!newName.trim() || !newPhone.trim()}
        activeOpacity={0.8}
      >
        <Text style={s.approvalPrimaryText}>Add & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── PendingList ───────────────────────────────────────────────────────────────

function PendingList({ pendingVehicles, onSelect, onClose }) {
  return (
    <View style={s.pendingSheet}>
      <View style={s.sheetHeader}>
        <View style={s.sheetHeaderLeft} />
        <Text style={s.sheetTitle}>Pending Registrations</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>
      {pendingVehicles.length === 0 ? (
        <View style={s.pendingEmpty}>
          <Icon name="car-clock" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={s.pendingEmptyText}>No pending registrations</Text>
        </View>
      ) : (
        <FlatList
          data={pendingVehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: v }) => (
            <TouchableOpacity
              style={s.pendingCard}
              onPress={() => onSelect(v)}
              activeOpacity={0.7}
            >
              <View style={s.pendingCardLeft}>
                <View style={s.pendingStatusDot} />
                <View>
                  <Text style={s.pendingLicense}>{v.license}</Text>
                  <Text style={s.pendingMeta}>
                    {[
                      v.make,
                      v.model,
                      COLOR_OPTIONS.find((c) => c.value === v.color)?.label,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No vehicle info"}
                  </Text>
                  <Text style={s.pendingDriverCount}>
                    {v.drivers.length} driver{v.drivers.length !== 1 ? "s" : ""}
                    : {v.drivers.map((d) => d.name.split(" ")[0]).join(", ")}
                  </Text>
                </View>
              </View>
              <Icon
                name="chevron-right"
                size={20}
                color="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TrafficManager = () => {
  const user = auth().currentUser;
  const [permission, requestPermission] = useCameraPermissions();

  const [churchId, setChurchId] = useState(null);
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [unregUsers, setUnregUsers] = useState([]);
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const imageUrlsRef = useRef({});
  const [imageUrlsVersion, setImageUrlsVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Registration
  const [registrationVisible, setRegistrationVisible] = useState(false);
  const [currentQrId, setCurrentQrId] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [licensePlate, setLicensePlate] = useState("");
  const [regMake, setRegMake] = useState("");
  const [regModel, setRegModel] = useState("");
  const [regColor, setRegColor] = useState("");
  const [regColorPickerOpen, setRegColorPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [regAddGuestOpen, setRegAddGuestOpen] = useState(false);
  const [addGuestSaving, setAddGuestSaving] = useState(false);

  // Pending
  const [pendingListVisible, setPendingListVisible] = useState(false);
  const [approvalVehicle, setApprovalVehicle] = useState(null);
  const [approvalQrId, setApprovalQrId] = useState(null);

  // Edit
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editLicense, setEditLicense] = useState("");
  const [editDrivers, setEditDrivers] = useState([]);
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editColorPickerOpen, setEditColorPickerOpen] = useState(false);
  const [editAddGuestOpen, setEditAddGuestOpen] = useState(false);

  // Detail
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [driverTokens, setDriverTokens] = useState({});

  // Notify
  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

  // Menu / Attendance / Settings
  const [menuVisible, setMenuVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [scannedCar, setScannedCar] = useState(null);
  const [carLimitEnabled, setCarLimitEnabled] = useState(true);
  const [maxCarsPerPerson, setMaxCarsPerPerson] = useState(DEFAULT_CAR_LIMIT);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempLimit, setTempLimit] = useState(String(DEFAULT_CAR_LIMIT));

  // ── Listeners ────────────────────────────────────────────────────────────────

  useEffect(() => {
    migrateUnregUsers();
  }, []);

  useEffect(() => {
    return firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) setChurchId(doc.data()?.church ?? null);
      });
  }, [user.uid]);

  useEffect(() => {
    if (!churchId) return;
    return firestore()
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
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;

    const unsubCars = firestore()
      .collection("qrCodes")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const carList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((d) => !d.isUnregisteredUser)
          .sort((a, b) => (a.license || "").localeCompare(b.license || ""));
        setCars(carList);
        setLoading(false);
        carList.forEach((c) =>
          (c.ownerIds || []).forEach((uid) => fetchProfileImage(uid)),
        );
      });

    const unsubUnreg = getUnregCollection().onSnapshot((snapshot) => {
      const list = snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data(), isUnreg: true }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUnregUsers(list);
    });

    const unsubPending = firestore()
      .collection("pending_registrations")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            license: d.license,
            church: d.church,
            drivers: d.drivers || [],
            make: d.make,
            model: d.model,
            color: d.color,
          };
        });
        setPendingVehicles(list);
      });

    return () => {
      unsubCars();
      unsubUnreg();
      unsubPending();
    };
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    return firestore()
      .collection("users")
      .where("church", "==", churchId)
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
      const url = await storage()
        .ref(`profilePictures/${uid}.png`)
        .getDownloadURL();
      imageUrlsRef.current[uid] = url;
      setImageUrlsVersion((v) => v + 1);
    } catch {
      delete imageUrlsRef.current[uid];
    }
  }, []);

  const allUsers = useMemo(
    () => [...users, ...unregUsers],
    [users, unregUsers],
  );

  const getUserById = useCallback(
    (uid) => allUsers.find((u) => u.uid === uid),
    [allUsers],
  );

  const getImageSource = useCallback(
    (uid) => {
      const url = imageUrlsRef.current[uid];
      return url && url !== "pending" ? { uri: url } : DEFAULT_PROFILE;
    },
    [imageUrlsVersion],
  );

  const filterUserList = useCallback(
    (query) => {
      if (!query.trim()) return allUsers;
      const q = query.toLowerCase();
      return allUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q),
      );
    },
    [allUsers],
  );

  const filteredUsers = useMemo(
    () => filterUserList(searchQuery),
    [filterUserList, searchQuery],
  );
  const editFilteredUsers = useMemo(
    () => filterUserList(editSearchQuery),
    [filterUserList, editSearchQuery],
  );

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

  // ── Actions ──────────────────────────────────────────────────────────────────

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
                .forEach((car) =>
                  batch.update(firestore().collection("qrCodes").doc(car.id), {
                    present: false,
                  }),
                );
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

  // ── Scanner ──────────────────────────────────────────────────────────────────

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
        setRegMake("");
        setRegModel("");
        setRegColor("");
        setRegColorPickerOpen(false);
        setRegAddGuestOpen(false);
        setSearchQuery("");
        setRegistrationVisible(true);
      }
    },
    [scanned, cars],
  );

  // ── Registration ──────────────────────────────────────────────────────────────

  const toggleDriverSelection = useCallback((uid) => {
    setSelectedDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }, []);

  const handleRegAddGuest = useCallback(async (name, phone) => {
    setAddGuestSaving(true);
    try {
      const docId = `unreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await getUnregCollection().doc(docId).set({ name, phone, uid: docId });
      setSelectedDrivers((prev) => [...prev, docId]);
      setRegAddGuestOpen(false);
    } catch {
      Alert.alert("Error", "Failed to add person.");
    } finally {
      setAddGuestSaving(false);
    }
  }, []);

  const handleEditAddGuest = useCallback(async (name, phone) => {
    setAddGuestSaving(true);
    try {
      const docId = `unreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await getUnregCollection().doc(docId).set({ name, phone, uid: docId });
      setEditDrivers((prev) => [...prev, docId]);
      setEditAddGuestOpen(false);
    } catch {
      Alert.alert("Error", "Failed to add person.");
    } finally {
      setAddGuestSaving(false);
    }
  }, []);

  const completeRegistration = useCallback(async () => {
    if (!licensePlate.trim()) {
      Alert.alert("Missing Info", "Please enter the license plate number.");
      return;
    }
    if (selectedDrivers.length === 0) {
      Alert.alert("Select Drivers", "Please select at least one driver.");
      return;
    }
    setSaving(true);
    try {
      const carData = {
        church: churchId,
        license: licensePlate.trim().toUpperCase(),
        ownerIds: selectedDrivers,
      };
      if (regMake.trim()) carData.make = regMake.trim();
      if (regModel.trim()) carData.model = regModel.trim();
      if (regColor) carData.color = regColor;
      await firestore().collection("qrCodes").doc(currentQrId).set(carData);
      setRegistrationVisible(false);
    } catch {
      Alert.alert("Error", "Failed to register vehicle.");
    } finally {
      setSaving(false);
    }
  }, [
    licensePlate,
    selectedDrivers,
    currentQrId,
    churchId,
    regMake,
    regModel,
    regColor,
  ]);

  // ── Delete unregistered ───────────────────────────────────────────────────────

  const deleteUnregisteredPerson = useCallback(
    (person) => {
      Alert.alert(
        "Delete Person?",
        `Remove ${person.name}? They will be unassigned from all cars.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const batch = firestore().batch();
                cars
                  .filter((c) => c.ownerIds?.includes(person.uid))
                  .forEach((car) =>
                    batch.update(
                      firestore().collection("qrCodes").doc(car.id),
                      {
                        ownerIds: firestore.FieldValue.arrayRemove(person.uid),
                      },
                    ),
                  );
                batch.delete(getUnregCollection().doc(person.uid));
                await batch.commit();
                setSelectedDrivers((prev) =>
                  prev.filter((id) => id !== person.uid),
                );
                setEditDrivers((prev) =>
                  prev.filter((id) => id !== person.uid),
                );
              } catch {
                Alert.alert("Error", "Failed to delete person.");
              }
            },
          },
        ],
      );
    },
    [cars],
  );

  // ── Edit ──────────────────────────────────────────────────────────────────────

  const openEditModal = useCallback((car) => {
    setEditLicense(car.license || "");
    setEditDrivers([...(car.ownerIds || [])]);
    setEditMake(car.make || "");
    setEditModel(car.model || "");
    setEditColor(car.color || "");
    setEditColorPickerOpen(false);
    setEditAddGuestOpen(false);
    setEditingCar(car);
    setEditSearchQuery("");
    setDetailModalVisible(false);
    setTimeout(() => setEditModalVisible(true), 100);
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
      const updateData = {
        license: editLicense.trim().toUpperCase(),
        ownerIds: editDrivers,
        make: editMake.trim() || firestore.FieldValue.delete(),
        model: editModel.trim() || firestore.FieldValue.delete(),
        color: editColor || firestore.FieldValue.delete(),
      };
      await firestore()
        .collection("qrCodes")
        .doc(editingCar.id)
        .update(updateData);
      setEditModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to update vehicle.");
    } finally {
      setSaving(false);
    }
  }, [editLicense, editDrivers, editingCar, editMake, editModel, editColor]);

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

  // ── Notify / Call ─────────────────────────────────────────────────────────────

  const callDriver = useCallback((phone) => {
    if (phone) Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  }, []);

  const checkDriverTokens = useCallback(async (ownerIds) => {
    const tokens = {};
    await Promise.all(
      ownerIds
        .filter((uid) => !uid.startsWith("unreg_"))
        .map(async (uid) => {
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

  // ── Render helpers ────────────────────────────────────────────────────────────

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

  // ── JSX ───────────────────────────────────────────────────────────────────────

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

      {/* Car list */}
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

      {/* ── Menu ── */}
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

      {/* ── Settings ── */}
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
              {carLimitEnabled ? (
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
              ) : null}
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

      {/* ── Attendance ── */}
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
            {scannedCar?.make || scannedCar?.model || scannedCar?.color ? (
              <Text style={s.attendanceVehicleInfo}>
                {[
                  COLOR_OPTIONS.find((c) => c.value === scannedCar?.color)
                    ?.label,
                  scannedCar?.make,
                  scannedCar?.model,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
            ) : null}
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

      {/* ── Scanner ── */}
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

      {/* ── Registration ── */}
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
          <View style={s.regSheet}>
            <View style={s.sheetHeader}>
              <TouchableOpacity
                style={s.pendingBtn}
                onPress={() => setPendingListVisible(true)}
                activeOpacity={0.7}
              >
                <Icon name="car-clock" size={16} color="#ff9f0a" />
                <Text style={s.pendingBtnText}>Pending</Text>
                {pendingVehicles.length > 0 ? (
                  <View style={s.pendingBadge}>
                    <Text style={s.pendingBadgeText}>
                      {pendingVehicles.length}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <Text style={s.sheetTitle}>Register Vehicle</Text>
              <TouchableOpacity onPress={() => setRegistrationVisible(false)}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={s.regScrollArea}
              contentContainerStyle={s.regScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.inputLabel}>License Plate *</Text>
              <TextInput
                style={s.plateInputSmall}
                placeholder="ABC-1234"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="characters"
                value={licensePlate}
                onChangeText={setLicensePlate}
                maxLength={10}
              />
              <Text style={[s.inputLabel, { marginTop: 20 }]}>
                Vehicle Info (optional)
              </Text>
              <View style={s.vehicleInfoRow}>
                <TextInput
                  style={[s.vehicleInput, { flex: 1, marginRight: 8 }]}
                  placeholder="Make"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={regMake}
                  onChangeText={setRegMake}
                />
                <TextInput
                  style={[s.vehicleInput, { flex: 1 }]}
                  placeholder="Model"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={regModel}
                  onChangeText={setRegModel}
                />
              </View>
              <ColorPicker
                value={regColor}
                onSelect={(v) => {
                  setRegColor(v === regColor ? "" : v);
                  setRegColorPickerOpen(false);
                }}
                visible={regColorPickerOpen}
                onToggle={() => setRegColorPickerOpen((p) => !p)}
              />
              <View style={s.driverSectionHeader}>
                <Text
                  style={[s.inputLabel, { marginTop: 20, marginBottom: 0 }]}
                >
                  Drivers *
                </Text>
                <TouchableOpacity
                  style={s.addPersonBtn}
                  onPress={() => setRegAddGuestOpen((p) => !p)}
                  activeOpacity={0.7}
                >
                  <Icon name="account-plus" size={16} color="#147efb" />
                  <Text style={s.addPersonBtnText}>Add Person</Text>
                </TouchableOpacity>
              </View>
              <AddGuestInline
                visible={regAddGuestOpen}
                onSave={handleRegAddGuest}
                onCancel={() => setRegAddGuestOpen(false)}
                saving={addGuestSaving}
              />
              <View style={[s.searchBox, { marginBottom: 8 }]}>
                <Icon name="magnify" size={20} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              {filteredUsers.map((item) => (
                <UserSelectRow
                  key={item.uid}
                  item={item}
                  selected={selectedDrivers.includes(item.uid)}
                  onPress={toggleDriverSelection}
                  getImageSource={getImageSource}
                  isUnreg={!!item.isUnreg || item.uid?.startsWith("unreg_")}
                  onDelete={
                    item.isUnreg || item.uid?.startsWith("unreg_")
                      ? deleteUnregisteredPerson
                      : undefined
                  }
                />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
            <View style={s.sheetFooter}>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  s.greenBtn,
                  (!licensePlate.trim() ||
                    selectedDrivers.length === 0 ||
                    saving) &&
                    s.btnDisabled,
                ]}
                onPress={completeRegistration}
                disabled={
                  !licensePlate.trim() || selectedDrivers.length === 0 || saving
                }
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>Register</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Pending list ── */}
      <Modal
        visible={pendingListVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPendingListVisible(false)}
      >
        <View style={s.bottomOverlay}>
          <PendingList
            pendingVehicles={pendingVehicles}
            onClose={() => setPendingListVisible(false)}
            onSelect={(v) => {
              setApprovalVehicle(v);
              setApprovalQrId(
                `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              );
              setPendingListVisible(false);
            }}
          />
        </View>
      </Modal>

      {/* ── Approval flow ── */}
      <Modal
        visible={!!approvalVehicle}
        animationType="slide"
        transparent
        onRequestClose={() => setApprovalVehicle(null)}
      >
        <View style={s.bottomOverlay}>
          <View style={s.approvalSheet}>
            <View style={s.sheetHeader}>
              <View style={s.sheetHeaderLeft} />
              <Text style={s.sheetTitle}>
                Approve — {approvalVehicle?.license}
              </Text>
              <TouchableOpacity onPress={() => setApprovalVehicle(null)}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {approvalVehicle ? (
              <ApprovalFlow
                vehicle={approvalVehicle}
                churchUsers={users}
                unregUsers={unregUsers}
                currentQrId={approvalQrId}
                churchId={churchId}
                onDone={() => {
                  const lic = approvalVehicle.license;
                  setApprovalVehicle(null);
                  setRegistrationVisible(false);
                  Alert.alert("Registered", `${lic} has been registered.`);
                }}
                onCancel={() => setApprovalVehicle(null)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Detail ── */}
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
                    selectedCar?.present ? { color: "#34c759" } : null,
                  ]}
                >
                  {selectedCar?.license || "NO PLATE"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Icon name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {selectedCar?.make || selectedCar?.model || selectedCar?.color ? (
              <View style={s.vehicleInfoDisplay}>
                {selectedCar?.color ? (
                  <View
                    style={[
                      s.colorDotDetail,
                      {
                        backgroundColor:
                          COLOR_OPTIONS.find(
                            (c) => c.value === selectedCar.color,
                          )?.hex || "#888",
                      },
                    ]}
                  />
                ) : null}
                <Text style={s.vehicleInfoText}>
                  {[
                    COLOR_OPTIONS.find((c) => c.value === selectedCar?.color)
                      ?.label,
                    selectedCar?.make,
                    selectedCar?.model,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              </View>
            ) : null}
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
                    isUnreg={uid.startsWith("unreg_")}
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

      {/* ── Edit ── */}
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
            <ScrollView
              style={s.regScrollArea}
              contentContainerStyle={s.regScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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
              <Text style={[s.inputLabel, { marginTop: 16 }]}>
                Vehicle Info (optional)
              </Text>
              <View style={s.vehicleInfoRow}>
                <TextInput
                  style={[s.vehicleInput, { flex: 1, marginRight: 8 }]}
                  placeholder="Make"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={editMake}
                  onChangeText={setEditMake}
                />
                <TextInput
                  style={[s.vehicleInput, { flex: 1 }]}
                  placeholder="Model"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={editModel}
                  onChangeText={setEditModel}
                />
              </View>
              <ColorPicker
                value={editColor}
                onSelect={(v) => {
                  setEditColor(v === editColor ? "" : v);
                  setEditColorPickerOpen(false);
                }}
                visible={editColorPickerOpen}
                onToggle={() => setEditColorPickerOpen((p) => !p)}
              />
              <View style={s.driverSectionHeader}>
                <Text
                  style={[s.inputLabel, { marginTop: 16, marginBottom: 0 }]}
                >
                  Drivers
                </Text>
                <TouchableOpacity
                  style={s.addPersonBtn}
                  onPress={() => setEditAddGuestOpen((p) => !p)}
                  activeOpacity={0.7}
                >
                  <Icon name="account-plus" size={16} color="#147efb" />
                  <Text style={s.addPersonBtnText}>Add Person</Text>
                </TouchableOpacity>
              </View>
              <AddGuestInline
                visible={editAddGuestOpen}
                onSave={handleEditAddGuest}
                onCancel={() => setEditAddGuestOpen(false)}
                saving={addGuestSaving}
              />
              <View style={[s.searchBox, { marginBottom: 8 }]}>
                <Icon name="magnify" size={20} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={editSearchQuery}
                  onChangeText={setEditSearchQuery}
                />
                {editSearchQuery.length > 0 ? (
                  <TouchableOpacity onPress={() => setEditSearchQuery("")}>
                    <Icon
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              {editFilteredUsers.map((item) => (
                <UserSelectRow
                  key={item.uid}
                  item={item}
                  selected={editDrivers.includes(item.uid)}
                  onPress={(uid) =>
                    setEditDrivers((prev) =>
                      prev.includes(uid)
                        ? prev.filter((id) => id !== uid)
                        : [...prev, uid],
                    )
                  }
                  getImageSource={getImageSource}
                  isUnreg={!!item.isUnreg || item.uid?.startsWith("unreg_")}
                  onDelete={
                    item.isUnreg || item.uid?.startsWith("unreg_")
                      ? deleteUnregisteredPerson
                      : undefined
                  }
                />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
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

      {/* ── Notify ── */}
      {notifyVisible ? (
        <Modal
          visible
          animationType="fade"
          transparent
          onRequestClose={() => setNotifyVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.centerOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
              >
                <View style={s.notifyCard}>
                  <View style={s.notifyIcon}>
                    <Icon name="bell-ring" size={24} color="#ff9f0a" />
                  </View>
                  <Text style={s.notifyTitleText}>Send Notification</Text>
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
        </Modal>
      ) : null}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 12 },

  // ── Header ──
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

  // ── Car List ──
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  carCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    gap: 10,
  },
  carStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  carStatusDotPresent: { backgroundColor: "#34c759" },
  carCardInfo: {
    flex: 1,
    justifyContent: "center",
  },
  carTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  licenseText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.5,
  },
  licenseTextPresent: { color: "#34c759" },
  carColorBar: {
    width: 28,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  ownerNames: { fontSize: 13, color: "rgba(255,255,255,0.4)" },

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

  // ── Empty State ──
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

  // ── FAB ──
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

  // ── Menu ──
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

  // ── Settings ──
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

  // ── Attendance ──
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
  cardClose: { position: "absolute", top: 16, right: 16, zIndex: 1 },
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
  attendanceVehicleInfo: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
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

  // ── Scanner ──
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

  // ── Sheets ──
  bottomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetHeaderLeft: { width: 24 },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#fff" },
  sheetFooter: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  // ── Registration ──
  regSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    height: "92%",
  },
  regScrollArea: { flex: 1 },
  regScrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },

  // ── Pending ──
  pendingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,159,10,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingBtnText: { fontSize: 13, fontWeight: "600", color: "#ff9f0a" },
  pendingBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff9f0a",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingBadgeText: { fontSize: 10, fontWeight: "700", color: "#000" },
  pendingSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    height: "80%",
  },
  pendingEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pendingEmptyText: { fontSize: 15, color: "rgba(255,255,255,0.3)" },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  pendingCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pendingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff9f0a",
  },
  pendingLicense: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  pendingMeta: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  pendingDriverCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },

  // ── Approval ──
  approvalSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    height: "85%",
  },
  approvalContainer: { flex: 1, padding: 20 },
  approvalCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  approvalSavingText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  approvalProgress: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  approvalDriverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  approvalDriverName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  approvalSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  approvalList: { flex: 1 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  matchInfo: { flex: 1, gap: 3 },
  matchName: { fontSize: 15, fontWeight: "600", color: "#fff" },
  matchPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  approvalActions: { gap: 8, marginTop: 12 },
  approvalSecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  approvalSecondaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  approvalDangerBtn: {
    backgroundColor: "rgba(255,69,58,0.1)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  approvalDangerText: { fontSize: 14, fontWeight: "500", color: "#ff453a" },
  approvalInputGroup: { gap: 10, marginBottom: 16 },
  approvalInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  approvalPrimaryBtn: {
    backgroundColor: "#34c759",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  approvalPrimaryText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  taksisBadge: {
    backgroundColor: "rgba(20,126,251,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taksisBadgeText: { fontSize: 11, fontWeight: "600", color: "#147efb" },

  // ── Search ──
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 8,
  },

  // ── User Select Row ──
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

  // ── Unregistered ──
  unregBadge: {
    backgroundColor: "rgba(255,159,10,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unregBadgeText: { fontSize: 10, fontWeight: "600", color: "#ff9f0a" },
  unregDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,69,58,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  // ── Add Person ──
  driverSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  addPersonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(20,126,251,0.12)",
    marginTop: 20,
  },
  addPersonBtnText: { fontSize: 13, fontWeight: "500", color: "#147efb" },
  inlineAddGuest: {
    backgroundColor: "rgba(20,126,251,0.08)",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.2)",
  },
  inlineAddGuestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inlineAddGuestTitle: { fontSize: 15, fontWeight: "600", color: "#fff" },
  inlineInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    marginBottom: 8,
  },
  inlineAddGuestBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  inlineGuestCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  inlineGuestCancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  inlineGuestSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#147efb",
    alignItems: "center",
  },
  inlineGuestSaveText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  // ── Vehicle Inputs ──
  vehicleInfoRow: { flexDirection: "row", marginBottom: 8 },
  vehicleInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  colorPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  colorPickerText: { flex: 1, color: "#fff", fontSize: 15 },
  colorPickerPlaceholder: {
    flex: 1,
    color: "rgba(255,255,255,0.3)",
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 10,
  },
  colorOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  colorOptionSelected: {
    backgroundColor: "rgba(20,126,251,0.2)",
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.4)",
  },
  colorOptionSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  colorOptionLabel: { fontSize: 13, color: "#fff" },
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

  // ── Buttons ──
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

  // ── Edit Sheet ──
  editSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    height: "92%",
  },

  // ── Detail Card ──
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
  vehicleInfoDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  colorDotDetail: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  vehicleInfoText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
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

  // ── Driver Card ──
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

  // ── Notify ──
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
  notifyTitleText: {
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
