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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";

const { width: SW, height: SH } = Dimensions.get("window");

export const getUnregCollection = () =>
  firestore().collection("qrCodes").doc("unregistered").collection("people");

export const COLOR_OPTIONS = [
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

// ── VehicleFormSheet ──────────────────────────────────────────────────────────

export const VehicleFormSheet = memo(
  ({
    visible,
    mode,
    initialData,
    allUsers,
    getImageSource,
    onSave,
    onClose,
    pendingVehicles,
    onOpenPending,
  }) => {
    const [license, setLicense] = useState("");
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [color, setColor] = useState("");
    const [colorOpen, setColorOpen] = useState(false);
    const [drivers, setDrivers] = useState([]);
    const [search, setSearch] = useState("");
    const [guestOpen, setGuestOpen] = useState(false);
    const [guestSaving, setGuestSaving] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (!visible) return;
      setLicense(initialData?.license ?? "");
      setMake(initialData?.make ?? "");
      setModel(initialData?.model ?? "");
      setColor(initialData?.color ?? "");
      setDrivers(initialData?.drivers ?? []);
      setSearch("");
      setColorOpen(false);
      setGuestOpen(false);
      setSaving(false);
    }, [visible, initialData]);

    const filteredUsers = useMemo(() => {
      const q = search.toLowerCase().trim();
      const list = q
        ? allUsers.filter(
            (u) =>
              u.name?.toLowerCase().includes(q) ||
              u.phone?.toLowerCase().includes(q),
          )
        : allUsers;
      return [...list].sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
    }, [allUsers, search]);

    const toggleDriver = useCallback((uid) => {
      setDrivers((prev) =>
        prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
      );
    }, []);

    const handleAddGuest = useCallback(async (name, phone) => {
      setGuestSaving(true);
      try {
        const docId = `unreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await getUnregCollection().doc(docId).set({ name, phone, uid: docId });
        setDrivers((prev) => [...prev, docId]);
        setGuestOpen(false);
      } catch {
        Alert.alert("Error", "Failed to add person.");
      } finally {
        setGuestSaving(false);
      }
    }, []);

    const handleSave = useCallback(async () => {
      if (!license.trim()) {
        Alert.alert("Missing Info", "Please enter the license plate number.");
        return;
      }
      if (drivers.length === 0) {
        Alert.alert("Select Drivers", "Please select at least one driver.");
        return;
      }
      setSaving(true);
      try {
        await onSave({
          license: license.trim().toUpperCase(),
          make,
          model,
          color,
          drivers,
        });
        onClose();
      } catch {
        Alert.alert("Error", "Failed to save vehicle.");
      } finally {
        setSaving(false);
      }
    }, [license, make, model, color, drivers, onSave, onClose]);

    const isReg = mode === "register";

    const renderUserItem = useCallback(
      ({ item }) => (
        <UserSelectRow
          item={item}
          selected={drivers.includes(item.uid)}
          onPress={toggleDriver}
          getImageSource={getImageSource}
          isUnreg={!!item.isUnreg || item.uid?.startsWith("unreg_")}
          onDelete={
            item.isUnreg || item.uid?.startsWith("unreg_")
              ? (person) => {
                  Alert.alert(
                    "Remove from list?",
                    `Remove ${person.name} from this vehicle?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () =>
                          setDrivers((prev) =>
                            prev.filter((id) => id !== person.uid),
                          ),
                      },
                    ],
                  );
                }
              : undefined
          }
        />
      ),
      [drivers, toggleDriver, getImageSource],
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={s.bottomOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={isReg ? s.regSheet : s.editSheet}>
            <View style={s.sheetHeader}>
              {isReg ? (
                <TouchableOpacity
                  style={s.pendingBtn}
                  onPress={onOpenPending}
                  activeOpacity={0.7}
                >
                  <Icon name="car-clock" size={16} color="#ff9f0a" />
                  <Text style={s.pendingBtnText}>Pending</Text>
                  {pendingVehicles?.length > 0 ? (
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>
                        {pendingVehicles.length}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : (
                <View style={s.sheetHeaderLeft} />
              )}
              <Text style={s.sheetTitle}>
                {isReg ? "Register Vehicle" : "Edit Vehicle"}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.uid}
              renderItem={renderUserItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.regScrollContent}
              ListHeaderComponent={
                <>
                  <Text style={s.inputLabel}>License Plate *</Text>
                  <TextInput
                    style={s.plateInputSmall}
                    placeholder="ABC-1234"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoCapitalize="characters"
                    value={license}
                    onChangeText={setLicense}
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
                      value={make}
                      onChangeText={setMake}
                    />
                    <TextInput
                      style={[s.vehicleInput, { flex: 1 }]}
                      placeholder="Model"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={model}
                      onChangeText={setModel}
                    />
                  </View>
                  <ColorPicker
                    value={color}
                    onSelect={(v) => {
                      setColor(v === color ? "" : v);
                      setColorOpen(false);
                    }}
                    visible={colorOpen}
                    onToggle={() => setColorOpen((p) => !p)}
                  />
                  <View style={s.driverSectionHeader}>
                    <Text
                      style={[s.inputLabel, { marginTop: 20, marginBottom: 0 }]}
                    >
                      Drivers *
                    </Text>
                    <TouchableOpacity
                      style={s.addPersonBtn}
                      onPress={() => setGuestOpen((p) => !p)}
                      activeOpacity={0.7}
                    >
                      <Icon name="account-plus" size={16} color="#147efb" />
                      <Text style={s.addPersonBtnText}>Add Person</Text>
                    </TouchableOpacity>
                  </View>
                  <AddGuestInline
                    visible={guestOpen}
                    onSave={handleAddGuest}
                    onCancel={() => setGuestOpen(false)}
                    saving={guestSaving}
                  />
                  <View style={[s.searchBox, { marginBottom: 8 }]}>
                    <Icon
                      name="magnify"
                      size={20}
                      color="rgba(255,255,255,0.4)"
                    />
                    <TextInput
                      style={s.searchInput}
                      placeholder="Search..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={search}
                      onChangeText={setSearch}
                    />
                    {search.length > 0 ? (
                      <TouchableOpacity onPress={() => setSearch("")}>
                        <Icon
                          name="close-circle"
                          size={18}
                          color="rgba(255,255,255,0.4)"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              }
              ListFooterComponent={<View style={{ height: 100 }} />}
            />

            <View style={s.sheetFooter}>
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  isReg && s.greenBtn,
                  (!license.trim() || drivers.length === 0 || saving) &&
                    s.btnDisabled,
                ]}
                onPress={handleSave}
                disabled={!license.trim() || drivers.length === 0 || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>
                    {isReg ? "Register" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

// ── ApprovalFlow ──────────────────────────────────────────────────────────────

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

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

export function ApprovalFlow({
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
  }, [step, driver, churchUsers, unregUsers]);

  function resolveWith(uid, isUnreg) {
    const newRes = [...resolutions, { uid, isUnreg }];
    setResolutions(newRes);
    if (step + 1 < vehicle.drivers.length) setStep((s) => s + 1);
    else finalize(newRes);
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
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
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
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={s.approvalSecondaryBtn}
          onPress={() => setMatchStage("new")}
          activeOpacity={0.7}
        >
          <Text style={s.approvalSecondaryText}>None of these — create new</Text>
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

export function PendingList({ pendingVehicles, onSelect, onClose }) {
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
          renderItem={({ item: v }) => {
            const Wrapper = onSelect ? TouchableOpacity : View;
            return (
              <Wrapper
                style={s.pendingCard}
                onPress={onSelect ? () => onSelect(v) : undefined}
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
                      {v.drivers.length} driver
                      {v.drivers.length !== 1 ? "s" : ""}:{" "}
                      {v.drivers.map((d) => d.name.split(" ")[0]).join(", ")}
                    </Text>
                  </View>
                </View>
                {onSelect ? (
                  <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                ) : null}
              </Wrapper>
            );
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
  regSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    height: "92%",
  },
  regScrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
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
    marginTop: 8,
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
  editSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    height: "92%",
  },
});