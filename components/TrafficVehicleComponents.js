import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Modal, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Changed: now points to cars/unregistered/people ──────────────────────────
export const getUnregCollection = () =>
  firestore().collection("cars").doc("unregistered").collection("people");

export const COLOR_OPTIONS = [
  { label: "White",  value: "white",  hex: "#FFFFFF" },
  { label: "Black",  value: "black",  hex: "#1a1a1a" },
  { label: "Silver", value: "silver", hex: "#C0C0C0" },
  { label: "Gray",   value: "gray",   hex: "#808080" },
  { label: "Red",    value: "red",    hex: "#D32F2F" },
  { label: "Blue",   value: "blue",   hex: "#1976D2" },
  { label: "Green",  value: "green",  hex: "#388E3C" },
  { label: "Brown",  value: "brown",  hex: "#795548" },
  { label: "Beige",  value: "beige",  hex: "#D4C5A9" },
  { label: "Orange", value: "orange", hex: "#F57C00" },
  { label: "Yellow", value: "yellow", hex: "#FBC02D" },
  { label: "Gold",   value: "gold",   hex: "#FFD700" },
];

// ── UserSelectRow ─────────────────────────────────────────────────────────────

const UserSelectRow = memo(({ item, selected, onPress, getImageSource, isUnreg, onDelete }) => (
  <TouchableOpacity
    style={[s.userRow, selected && s.userRowSelected]}
    onPress={() => onPress(item.uid)}
    activeOpacity={0.7}
  >
    <Image source={getImageSource(item.uid)} style={s.userAvatar} contentFit="cover" />
    <View style={s.userInfo}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={s.userName}>{item.name}</Text>
        {isUnreg && (
          <View style={s.unregBadge}><Text style={s.unregBadgeText}>No Account</Text></View>
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
));

// ── ColorPicker ───────────────────────────────────────────────────────────────

const ColorPicker = memo(({ value, onSelect }) => (
  <FlatList
    data={COLOR_OPTIONS}
    keyExtractor={(c) => c.value}
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingTop: 14 }}
    renderItem={({ item: c }) => {
      const selected = value === c.value;
      return (
        <TouchableOpacity
          onPress={() => onSelect(selected ? "" : c.value)}
          activeOpacity={0.75}
          style={s.swatchBtn}
        >
          <View style={[
            s.swatchCircle,
            { backgroundColor: c.hex },
            c.value === "white" && s.swatchCircleWhite,
            selected && s.swatchCircleSelected,
          ]} />
          <Text style={[s.swatchLabel, selected && s.swatchLabelSelected]}>{c.label}</Text>
        </TouchableOpacity>
      );
    }}
  />
));

// ── AddGuestInline ────────────────────────────────────────────────────────────

const AddGuestInline = memo(({ visible, onSave, onCancel, saving }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (visible) { setName(""); setPhone(""); }
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
        <TouchableOpacity style={s.inlineGuestCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.inlineGuestCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.inlineGuestSaveBtn, (!name.trim() || !phone.trim() || saving) && { opacity: 0.4 }]}
          onPress={() => onSave(name.trim(), phone.trim())}
          disabled={!name.trim() || !phone.trim() || saving}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.inlineGuestSaveText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── SelectedDriverChip ────────────────────────────────────────────────────────

const SelectedDriverChip = memo(({ uid, user, getImageSource, onRemove }) => (
  <View style={s.chip}>
    <Image source={getImageSource(uid)} style={s.chipAvatar} contentFit="cover" />
    <Text style={s.chipName} numberOfLines={1}>{user?.name?.split(" ")[0] ?? "?"}</Text>
    <TouchableOpacity onPress={() => onRemove(uid)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Icon name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
    </TouchableOpacity>
  </View>
));

// ── VehicleFormSheet ──────────────────────────────────────────────────────────

export const VehicleFormSheet = memo(({
  visible, mode, initialData, allUsers, getImageSource,
  onSave, onClose, pendingVehicles, onOpenPending, onOpenRelink,
}) => {
  const [license, setLicense] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
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
    setGuestOpen(false);
    setSaving(false);
  }, [visible, initialData]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? allUsers.filter((u) =>
          u.name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q))
      : allUsers;
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allUsers, search]);

  const toggleDriver = useCallback((uid) => {
    setDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  }, []);

  const removeDriver = useCallback((uid) => {
    setDrivers((prev) => prev.filter((id) => id !== uid));
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
      await onSave({ license: license.trim().toUpperCase(), make, model, color, drivers });
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save vehicle.");
    } finally {
      setSaving(false);
    }
  }, [license, make, model, color, drivers, onSave, onClose]);

  const isReg = mode === "register";

  const renderUserItem = useCallback(({ item }) => {
    const selected = drivers.includes(item.uid);
    const isUnreg = !!item.isUnreg || item.uid?.startsWith("unreg_");
    return (
      <TouchableOpacity
        style={[s.personRow, selected && s.personRowSelected]}
        onPress={() => toggleDriver(item.uid)}
        activeOpacity={0.7}
      >
        <Image source={getImageSource(item.uid)} style={s.personAvatar} contentFit="cover" />
        <View style={s.personInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.personName}>{item.name}</Text>
            {isUnreg && (
              <View style={s.unregBadge}><Text style={s.unregBadgeText}>No Account</Text></View>
            )}
          </View>
          {item.phone ? <Text style={s.personPhone}>{item.phone}</Text> : null}
        </View>
        <View style={[s.checkbox, selected && s.checkboxSelected]}>
          {selected ? <Icon name="check" size={13} color="#fff" /> : null}
        </View>
      </TouchableOpacity>
    );
  }, [drivers, toggleDriver, getImageSource]);

  const selectedDrivers = drivers.map((uid) => ({
    uid,
    user: allUsers.find((u) => u.uid === uid),
  }));

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.bottomOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={s.formSheet}>
          <View style={s.formHeader}>
            <TouchableOpacity onPress={onClose} style={s.formCloseBtn}>
              <Icon name="chevron-down" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            <Text style={s.formTitle}>{isReg ? "Register Vehicle" : "Edit Vehicle"}</Text>
            {isReg ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                {onOpenPending ? (
                  <TouchableOpacity style={s.pendingPill} onPress={onOpenPending} activeOpacity={0.7}>
                    <Icon name="car-clock" size={14} color="#ff9f0a" />
                    <Text style={s.pendingPillText}>Pending</Text>
                    {pendingVehicles?.length > 0 ? (
                      <View style={s.pendingDot}>
                        <Text style={s.pendingDotText}>{pendingVehicles.length}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ) : null}
                {onOpenRelink ? (
                  <TouchableOpacity style={s.relinkPill} onPress={onOpenRelink} activeOpacity={0.7}>
                    <Icon name="link-variant" size={14} color="#bf5af2" />
                    <Text style={s.relinkPillText}>Fix</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={{ width: 80 }} />
            )}
          </View>

          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.uid}
            renderItem={renderUserItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            ListHeaderComponent={
              <View>
                <View style={s.formSection}>
                  <Text style={s.formSectionLabel}>License Plate</Text>
                  <TextInput style={s.plateInput} placeholder="ABC · 1234" placeholderTextColor="rgba(255,255,255,0.15)" autoCapitalize="characters" value={license} onChangeText={setLicense} maxLength={10} />
                </View>
                <View style={s.formSection}>
                  <Text style={s.formSectionLabel}>Vehicle Info <Text style={s.formSectionOptional}>(optional)</Text></Text>
                  <View style={s.infoRow}>
                    <TextInput style={[s.infoInput, { flex: 1, marginRight: 8 }]} placeholder="Make" placeholderTextColor="rgba(255,255,255,0.25)" value={make} onChangeText={setMake} />
                    <TextInput style={[s.infoInput, { flex: 1 }]} placeholder="Model" placeholderTextColor="rgba(255,255,255,0.25)" value={model} onChangeText={setModel} />
                  </View>
                  <ColorPicker value={color} onSelect={setColor} />
                </View>
                {selectedDrivers.length > 0 && (
                  <View style={s.formSection}>
                    <Text style={s.formSectionLabel}>Selected Drivers</Text>
                    <View style={s.chipRow}>
                      {selectedDrivers.map(({ uid, user }) => (
                        <SelectedDriverChip key={uid} uid={uid} user={user} getImageSource={getImageSource} onRemove={removeDriver} />
                      ))}
                    </View>
                  </View>
                )}
                <AddGuestInline visible={guestOpen} onSave={handleAddGuest} onCancel={() => setGuestOpen(false)} saving={guestSaving} />
                <View style={s.peopleSectionHeader}>
                  <Text style={s.formSectionLabel}>Add Drivers</Text>
                  <TouchableOpacity style={s.addGuestBtn} onPress={() => setGuestOpen((p) => !p)} activeOpacity={0.7}>
                    <Icon name="account-plus-outline" size={15} color="#147efb" />
                    <Text style={s.addGuestBtnText}>Add Guest</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.searchRow}>
                  <Icon name="magnify" size={18} color="rgba(255,255,255,0.35)" />
                  <TextInput style={s.searchInput} placeholder="Search by name or phone..." placeholderTextColor="rgba(255,255,255,0.25)" value={search} onChangeText={setSearch} />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                      <Icon name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 14 }}>No people found</Text>
              </View>
            }
          />

          <View style={s.formFooter}>
            <View style={s.formFooterMeta}>
              <Icon name={license.trim() ? "check-circle" : "circle-outline"} size={14} color={license.trim() ? "#34c759" : "rgba(255,255,255,0.2)"} />
              <Text style={s.formFooterMetaText}>Plate</Text>
              <Icon name={drivers.length > 0 ? "check-circle" : "circle-outline"} size={14} color={drivers.length > 0 ? "#34c759" : "rgba(255,255,255,0.2)"} style={{ marginLeft: 12 }} />
              <Text style={s.formFooterMetaText}>{drivers.length} driver{drivers.length !== 1 ? "s" : ""}</Text>
            </View>
            <TouchableOpacity
              style={[s.formSaveBtn, isReg && s.formSaveBtnGreen, (!license.trim() || drivers.length === 0 || saving) && s.btnDisabled]}
              onPress={handleSave}
              disabled={!license.trim() || drivers.length === 0 || saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.formSaveBtnText}>{isReg ? "Register Vehicle" : "Save Changes"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ── Fuzzy helpers ─────────────────────────────────────────────────────────────

function normalize(str) { return str.toLowerCase().replace(/\s+/g, " ").trim(); }

function nameSimilar(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  const aParts = na.split(" "), bParts = nb.split(" ");
  return aParts.some((p) => bParts.includes(p) && p.length > 2);
}

function phoneSimilar(a, b) {
  if (!a || !b) return false;
  const clean = (str) => str.replace(/\D/g, "");
  const ca = clean(a), cb = clean(b);
  return ca === cb || (ca.length >= 7 && cb.includes(ca.slice(-7)));
}

// ── ApprovalFlow ──────────────────────────────────────────────────────────────

export function ApprovalFlow({ vehicle, churchUsers, unregUsers, currentQrId, churchId, onDone, onCancel }) {
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
        (u) => nameSimilar(u.name, driver.name) || phoneSimilar(u.phone, driver.phone),
      );
      setAppMatches(matches);
      setMatchStage(matches.length > 0 ? "app" : "unreg");
    } else {
      setMatchStage("unreg");
    }
    const uMatches = unregUsers.filter(
      (u) => nameSimilar(u.name, driver.name) || phoneSimilar(u.phone, driver.phone),
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

  // ── Changed: writes to "cars" instead of "qrCodes" ────────────────────────
  async function finalize(res) {
    setSaving(true);
    try {
      const ownerIds = res.map((r) => r.uid);
      const carData = { church: churchId, license: vehicle.license, ownerIds, present: false };
      if (vehicle.make) carData.make = vehicle.make;
      if (vehicle.model) carData.model = vehicle.model;
      if (vehicle.color) carData.color = vehicle.color;
      await firestore().collection("cars").doc(currentQrId).set(carData);
      await firestore().collection("pending_registrations").doc(vehicle.id).delete();
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
          <View style={s.taksisBadge}><Text style={s.taksisBadgeText}>Has Taksis</Text></View>
        </View>
        <Text style={s.approvalSubtitle}>Select the matching Taksis user:</Text>
        <FlatList
          data={appMatches}
          keyExtractor={(u) => u.uid}
          style={s.approvalList}
          renderItem={({ item: u }) => (
            <TouchableOpacity style={s.matchRow} onPress={() => resolveWith(u.uid, false)} activeOpacity={0.7}>
              <View style={s.matchInfo}>
                <Text style={s.matchName}>{u.name}</Text>
                {u.phone ? <Text style={s.matchPhone}>{u.phone}</Text> : null}
              </View>
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        />
        <View style={s.approvalActions}>
          <TouchableOpacity style={s.approvalSecondaryBtn} onPress={() => setMatchStage("unreg")} activeOpacity={0.7}>
            <Text style={s.approvalSecondaryText}>None of these match</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.approvalDangerBtn} onPress={() => setMatchStage("unreg")} activeOpacity={0.7}>
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
        <Text style={s.approvalSubtitle}>Similar people already exist — is this one of them?</Text>
        <FlatList
          data={unregMatches}
          keyExtractor={(u) => u.uid}
          style={s.approvalList}
          renderItem={({ item: u }) => (
            <TouchableOpacity style={s.matchRow} onPress={() => resolveWith(u.uid, true)} activeOpacity={0.7}>
              <View style={s.matchInfo}>
                <Text style={s.matchName}>{u.name}</Text>
                {u.phone ? <Text style={s.matchPhone}>{u.phone}</Text> : null}
                <View style={s.unregBadge}><Text style={s.unregBadgeText}>No Account</Text></View>
              </View>
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={s.approvalSecondaryBtn} onPress={() => setMatchStage("new")} activeOpacity={0.7}>
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
        <TextInput style={s.approvalInput} placeholder="Full Name" placeholderTextColor="rgba(255,255,255,0.25)" value={newName} onChangeText={setNewName} autoCapitalize="words" />
        <TextInput style={s.approvalInput} placeholder="Phone Number" placeholderTextColor="rgba(255,255,255,0.25)" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
      </View>
      <TouchableOpacity
        style={[s.approvalPrimaryBtn, (!newName.trim() || !newPhone.trim()) && { opacity: 0.4 }]}
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

export function PendingList({ pendingVehicles, onSelect, onClose, hideHeader = false }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return pendingVehicles;
    return pendingVehicles.filter((v) =>
      v.license?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.drivers?.some((d) =>
        d.name?.toLowerCase().includes(q) || d.phone?.toLowerCase().includes(q)),
    );
  }, [pendingVehicles, search]);

  return (
    <View style={s.pendingSheet}>
      {!hideHeader && (
        <View style={s.sheetHeader}>
          <View style={s.sheetHeaderLeft} />
          <Text style={s.sheetTitle}>Pending Registrations</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      )}
      {pendingVehicles.length === 0 ? (
        <View style={s.pendingEmpty}>
          <Icon name="car-clock" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={s.pendingEmptyText}>No pending registrations</Text>
        </View>
      ) : (
        <>
          <View style={[s.searchBox, { marginHorizontal: 16, marginTop: 12, marginBottom: 4 }]}>
            <Icon name="magnify" size={18} color="rgba(255,255,255,0.4)" />
            <TextInput style={s.searchInput} placeholder="Search by plate, name, make..." placeholderTextColor="rgba(255,255,255,0.3)" value={search} onChangeText={setSearch} />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Icon name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(v) => v.id}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 32 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No results</Text>
              </View>
            }
            renderItem={({ item: v }) => {
              const Wrapper = onSelect ? TouchableOpacity : View;
              return (
                <Wrapper style={s.pendingCard} onPress={onSelect ? () => onSelect(v) : undefined} activeOpacity={0.7}>
                  <View style={s.pendingCardLeft}>
                    <View style={s.pendingStatusDot} />
                    <View>
                      <Text style={s.pendingLicense}>{v.license}</Text>
                      <Text style={s.pendingMeta}>
                        {[v.make, v.model, COLOR_OPTIONS.find((c) => c.value === v.color)?.label]
                          .filter(Boolean).join(" · ") || "No vehicle info"}
                      </Text>
                      <Text style={s.pendingDriverCount}>
                        {v.drivers.length} driver{v.drivers.length !== 1 ? "s" : ""}: {v.drivers.map((d) => d.name.split(" ")[0]).join(", ")}
                      </Text>
                    </View>
                  </View>
                  {onSelect ? <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.3)" /> : null}
                </Wrapper>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bottomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  sheetHeaderLeft: { width: 24 },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  formSheet: { backgroundColor: "#181818", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "94%", height: "94%" },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  formCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center" },
  formTitle: { fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  pendingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,159,10,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  pendingPillText: { fontSize: 12, fontWeight: "600", color: "#ff9f0a", letterSpacing: 0 },
  pendingDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ff9f0a", justifyContent: "center", alignItems: "center" },
  pendingDotText: { fontSize: 9, fontWeight: "700", color: "#000" },
  relinkPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(191,90,242,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  relinkPillText: { fontSize: 12, fontWeight: "600", color: "#bf5af2", letterSpacing: 0 },
  formSection: { marginTop: 20 },
  formSectionLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  formSectionOptional: { fontWeight: "400", textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,0.2)" },
  plateInput: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 18, color: "#fff", fontSize: 26, fontWeight: "700", textAlign: "center", letterSpacing: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)" },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  infoInput: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#fff", fontSize: 15, letterSpacing: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(20,126,251,0.15)", borderRadius: 20, paddingVertical: 6, paddingLeft: 6, paddingRight: 10, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(20,126,251,0.25)" },
  chipAvatar: { width: 24, height: 24, borderRadius: 12 },
  chipName: { fontSize: 13, fontWeight: "600", color: "#fff", maxWidth: 80, letterSpacing: 0 },
  peopleSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
  addGuestBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(20,126,251,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  addGuestBtnText: { fontSize: 12, fontWeight: "600", color: "#147efb", letterSpacing: 0 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 2, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.06)" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 11, marginLeft: 6, letterSpacing: 0 },
  personRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 6, backgroundColor: "rgba(255,255,255,0.04)" },
  personRowSelected: { backgroundColor: "rgba(20,126,251,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(20,126,251,0.3)" },
  personAvatar: { width: 40, height: 40, borderRadius: 20 },
  personInfo: { flex: 1, marginLeft: 12 },
  personName: { fontSize: 15, fontWeight: "500", color: "#fff", letterSpacing: 0 },
  personPhone: { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 1, letterSpacing: 0 },
  formFooter: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#181818", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  formFooterMeta: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  formFooterMetaText: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 4, letterSpacing: 0 },
  formSaveBtn: { backgroundColor: "#147efb", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  formSaveBtnGreen: { backgroundColor: "#30d158" },
  formSaveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  pendingSheet: { flex: 1 },
  pendingEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  pendingEmptyText: { fontSize: 15, color: "rgba(255,255,255,0.3)", letterSpacing: 0 },
  pendingCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 16, marginBottom: 10 },
  pendingCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  pendingStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff9f0a" },
  pendingLicense: { fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: 0 },
  pendingMeta: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2, letterSpacing: 0 },
  pendingDriverCount: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, letterSpacing: 0 },
  approvalContainer: { flex: 1, padding: 20 },
  approvalCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  approvalSavingText: { color: "rgba(255,255,255,0.5)", fontSize: 14, letterSpacing: 0 },
  approvalProgress: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  approvalDriverHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  approvalDriverName: { fontSize: 18, fontWeight: "700", color: "#fff", flex: 1, letterSpacing: 0 },
  approvalSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16, letterSpacing: 0 },
  approvalList: { flex: 1 },
  matchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, marginBottom: 8 },
  matchInfo: { flex: 1, gap: 3 },
  matchName: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  matchPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 0 },
  approvalActions: { gap: 8, marginTop: 12 },
  approvalSecondaryBtn: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, padding: 14, alignItems: "center" },
  approvalSecondaryText: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.6)", letterSpacing: 0 },
  approvalDangerBtn: { backgroundColor: "rgba(255,69,58,0.1)", borderRadius: 10, padding: 14, alignItems: "center" },
  approvalDangerText: { fontSize: 14, fontWeight: "500", color: "#ff453a", letterSpacing: 0 },
  approvalInputGroup: { gap: 10, marginBottom: 16 },
  approvalInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15, letterSpacing: 0 },
  approvalPrimaryBtn: { backgroundColor: "#34c759", borderRadius: 12, padding: 16, alignItems: "center" },
  approvalPrimaryText: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  taksisBadge: { backgroundColor: "rgba(20,126,251,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  taksisBadgeText: { fontSize: 11, fontWeight: "600", color: "#147efb", letterSpacing: 0 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  checkboxSelected: { backgroundColor: "#147efb", borderColor: "#147efb" },
  unregBadge: { backgroundColor: "rgba(255,159,10,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unregBadgeText: { fontSize: 10, fontWeight: "600", color: "#ff9f0a", letterSpacing: 0 },
  unregDeleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,69,58,0.12)", justifyContent: "center", alignItems: "center", marginRight: 8 },
  inlineAddGuest: { backgroundColor: "rgba(20,126,251,0.08)", borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: "rgba(20,126,251,0.2)" },
  inlineAddGuestHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  inlineAddGuestTitle: { fontSize: 15, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  inlineInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#fff", fontSize: 15, marginBottom: 8, letterSpacing: 0 },
  inlineAddGuestBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  inlineGuestCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" },
  inlineGuestCancelText: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.6)", letterSpacing: 0 },
  inlineGuestSaveBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#147efb", alignItems: "center" },
  inlineGuestSaveText: { fontSize: 14, fontWeight: "600", color: "#fff", letterSpacing: 0 },
  swatchBtn: { alignItems: "center", gap: 5, paddingHorizontal: 4 },
  swatchCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  swatchCircleWhite: { borderColor: "rgba(255,255,255,0.2)" },
  swatchCircleSelected: { borderColor: "#147efb" },
  swatchLabel: { fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: "500", letterSpacing: 0 },
  swatchLabelSelected: { color: "#fff" },
  userRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.04)" },
  userRowSelected: { backgroundColor: "rgba(20,126,251,0.15)", borderWidth: 1, borderColor: "rgba(20,126,251,0.3)" },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: "500", color: "#fff", letterSpacing: 0 },
  userPhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2, letterSpacing: 0 },
  btnDisabled: { opacity: 0.35 },
});