import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const DEFAULT_PROFILE = require("../assets/default_profile.png");

const TrafficManager = () => {
  const user = auth().currentUser;
  const [permission, requestPermission] = useCameraPermissions();

  // Data state
  const [churchId, setChurchId] = useState(null);
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loading, setLoading] = useState(true);

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Registration state
  const [registrationVisible, setRegistrationVisible] = useState(false);
  const [currentQrId, setCurrentQrId] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [licensePlate, setLicensePlate] = useState("");
  const [missingPhones, setMissingPhones] = useState({});
  const [registrationStep, setRegistrationStep] = useState("select"); // 'select' | 'phones' | 'license'
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editLicense, setEditLicense] = useState("");
  const [editDrivers, setEditDrivers] = useState([]);

  // Car detail state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  // Delete confirmation
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [carToDelete, setCarToDelete] = useState(null);

  // Fetch church ID
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
    return () => unsub();
  }, [user.uid]);

  // Fetch cars for church
  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("qrCodes")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const carList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.license || "").localeCompare(b.license || ""));
        setCars(carList);
        setLoading(false);

        // Fetch profile images for all owners
        const allOwnerIds = [
          ...new Set(carList.flatMap((c) => c.ownerIds || [])),
        ];
        allOwnerIds.forEach((uid) => fetchProfileImage(uid));
      });
    return () => unsub();
  }, [churchId]);

  // Fetch users for church
  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("users")
      .where("church", "==", churchId)
      .onSnapshot((snapshot) => {
        const userList = snapshot.docs
          .map((doc) => ({ uid: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setUsers(userList);
        userList.forEach((u) => fetchProfileImage(u.uid));
      });
    return () => unsub();
  }, [churchId]);

  const fetchProfileImage = async (uid) => {
    if (imageUrls[uid]) return;
    try {
      const url = await storage()
        .ref(`profilePictures/${uid}.png`)
        .getDownloadURL();
      setImageUrls((prev) => ({ ...prev, [uid]: url }));
    } catch {
      // No profile image
    }
  };

  const getUserById = (uid) => users.find((u) => u.uid === uid);

  // Scanner handlers
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

      // Check if QR code exists
      const existingCar = cars.find((c) => c.id === data);
      if (existingCar) {
        setSelectedCar(existingCar);
        setDetailModalVisible(true);
      } else {
        // Start registration
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

  // Registration handlers
  const toggleDriverSelection = (uid) => {
    setSelectedDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const proceedToPhones = () => {
    if (selectedDrivers.length === 0) {
      Alert.alert(
        "Select Drivers",
        "Please select at least one driver for this vehicle."
      );
      return;
    }

    // Check which selected drivers are missing phone numbers
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
    // Validate all phones are filled
    const emptyPhones = Object.entries(missingPhones).filter(
      ([_, phone]) => !phone.trim()
    );
    if (emptyPhones.length > 0) {
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
      // Save phone numbers to user docs
      const phoneUpdates = Object.entries(missingPhones).map(([uid, phone]) =>
        firestore().collection("users").doc(uid).update({ phone: phone.trim() })
      );
      await Promise.all(phoneUpdates);

      // Create QR code doc
      await firestore().collection("qrCodes").doc(currentQrId).set({
        church: churchId,
        license: licensePlate.trim().toUpperCase(),
        ownerIds: selectedDrivers,
      });

      setRegistrationVisible(false);
      Alert.alert("Success", "Vehicle registered successfully!");
    } catch (err) {
      console.error("Registration error:", err);
      Alert.alert("Error", "Failed to register vehicle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Edit handlers
  const openEditModal = (car) => {
    setEditingCar(car);
    setEditLicense(car.license || "");
    setEditDrivers(car.ownerIds || []);
    setDetailModalVisible(false);
    setEditModalVisible(true);
  };

  const toggleEditDriver = (uid) => {
    setEditDrivers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const saveEdit = async () => {
    if (!editLicense.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter the license plate number."
      );
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
      Alert.alert("Success", "Vehicle updated successfully!");
    } catch (err) {
      console.error("Edit error:", err);
      Alert.alert("Error", "Failed to update vehicle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const confirmDelete = (car) => {
    setCarToDelete(car);
    setDeleteConfirmVisible(true);
  };

  const deleteCar = async () => {
    if (!carToDelete) return;
    setSaving(true);
    try {
      await firestore().collection("qrCodes").doc(carToDelete.id).delete();
      setDeleteConfirmVisible(false);
      setEditModalVisible(false);
      setDetailModalVisible(false);
      setCarToDelete(null);
      Alert.alert("Deleted", "Vehicle has been removed.");
    } catch (err) {
      console.error("Delete error:", err);
      Alert.alert("Error", "Failed to delete vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const callDriver = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  // Render car item
  const renderCarItem = ({ item }) => {
    const owners = (item.ownerIds || [])
      .map((uid) => getUserById(uid))
      .filter(Boolean);
    const firstOwner = owners[0];

    return (
      <TouchableOpacity
        style={styles.carItem}
        onPress={() => {
          setSelectedCar(item);
          setDetailModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.carItemLeft}>
          <Image
            source={
              firstOwner && imageUrls[firstOwner.uid]
                ? { uri: imageUrls[firstOwner.uid] }
                : DEFAULT_PROFILE
            }
            style={styles.carItemImage}
            contentFit="cover"
          />
          {owners.length > 1 && (
            <View style={styles.additionalOwnersBadge}>
              <Text style={styles.additionalOwnersText}>
                +{owners.length - 1}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.carItemRight}>
          <Text style={styles.licensePlate}>{item.license || "No Plate"}</Text>
          <Text style={styles.ownerName} numberOfLines={1}>
            {owners.map((o) => o.name).join(", ") || "Unknown"}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    );
  };

  // Render user selection item
  const renderUserItem = ({ item, selected, onToggle }) => (
    <TouchableOpacity
      style={[styles.userItem, selected && styles.userItemSelected]}
      onPress={() => onToggle(item.uid)}
      activeOpacity={0.7}
    >
      <Image
        source={
          imageUrls[item.uid] ? { uri: imageUrls[item.uid] } : DEFAULT_PROFILE
        }
        style={styles.userItemImage}
        contentFit="cover"
      />
      <View style={styles.userItemInfo}>
        <Text style={styles.userItemName}>{item.name}</Text>
        {item.phone && <Text style={styles.userItemPhone}>{item.phone}</Text>}
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <Icon name="check" size={16} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Traffic Management</Text>

      {cars.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="car-off" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyStateText}>No vehicles registered</Text>
          <Text style={styles.emptyStateSubtext}>
            Scan a QR code to register a vehicle
          </Text>
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={(item) => item.id}
          renderItem={renderCarItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Scan Button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={openScanner}
        activeOpacity={0.8}
      >
        <Icon name="qrcode-scan" size={24} color="#fff" />
        <Text style={styles.scanButtonText}>Scan QR Code</Text>
      </TouchableOpacity>

      {/* Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
          <TouchableOpacity
            style={styles.scannerCloseButton}
            onPress={() => setScannerVisible(false)}
          >
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.scannerHint}>
            Position QR code within the frame
          </Text>
        </View>
      </Modal>

      {/* Registration Modal */}
      <Modal
        visible={registrationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRegistrationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {registrationStep === "select" && "Select Drivers"}
                {registrationStep === "phones" && "Enter Phone Numbers"}
                {registrationStep === "license" && "Enter License Plate"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setRegistrationVisible(false)}
              >
                <Icon name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {registrationStep === "select" && (
              <>
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.uid}
                  renderItem={({ item }) =>
                    renderUserItem({
                      item,
                      selected: selectedDrivers.includes(item.uid),
                      onToggle: toggleDriverSelection,
                    })
                  }
                  style={styles.userList}
                  contentContainerStyle={styles.userListContent}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={proceedToPhones}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {registrationStep === "phones" && (
              <>
                <Text style={styles.stepSubtitle}>
                  These drivers don't have phone numbers saved:
                </Text>
                {Object.keys(missingPhones).map((uid) => {
                  const u = getUserById(uid);
                  return (
                    <View key={uid} style={styles.phoneInputRow}>
                      <Image
                        source={
                          imageUrls[uid]
                            ? { uri: imageUrls[uid] }
                            : DEFAULT_PROFILE
                        }
                        style={styles.phoneInputImage}
                        contentFit="cover"
                      />
                      <View style={styles.phoneInputInfo}>
                        <Text style={styles.phoneInputName}>{u?.name}</Text>
                        <TextInput
                          style={styles.phoneInput}
                          placeholder="Phone number"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="phone-pad"
                          value={missingPhones[uid]}
                          onChangeText={(text) =>
                            setMissingPhones((prev) => ({
                              ...prev,
                              [uid]: text,
                            }))
                          }
                        />
                      </View>
                    </View>
                  );
                })}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setRegistrationStep("select")}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={proceedToLicense}
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {registrationStep === "license" && (
              <>
                <Text style={styles.stepSubtitle}>
                  Enter the vehicle's license plate:
                </Text>
                <TextInput
                  style={styles.licenseInput}
                  placeholder="e.g. ABC-1234"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() =>
                      setRegistrationStep(
                        Object.keys(missingPhones).length > 0
                          ? "phones"
                          : "select"
                      )
                    }
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      saving && styles.disabledButton,
                    ]}
                    onPress={completeRegistration}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Register</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedCar?.license || "Vehicle"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Icon name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.detailSectionTitle}>Drivers</Text>
            {(selectedCar?.ownerIds || []).map((uid) => {
              const u = getUserById(uid);
              if (!u) return null;
              return (
                <View key={uid} style={styles.detailDriverRow}>
                  <Image
                    source={
                      imageUrls[uid] ? { uri: imageUrls[uid] } : DEFAULT_PROFILE
                    }
                    style={styles.detailDriverImage}
                    contentFit="cover"
                  />
                  <View style={styles.detailDriverInfo}>
                    <Text style={styles.detailDriverName}>{u.name}</Text>
                    {u.phone && (
                      <Text style={styles.detailDriverPhone}>{u.phone}</Text>
                    )}
                  </View>
                  {u.phone && (
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => callDriver(u.phone)}
                    >
                      <Icon name="phone" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={styles.detailButtonRow}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(selectedCar)}
              >
                <Icon name="pencil" size={18} color="#fff" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDelete(selectedCar)}
              >
                <Icon name="delete" size={18} color="#ff3b30" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Vehicle</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Icon name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.stepSubtitle}>License Plate</Text>
            <TextInput
              style={styles.licenseInput}
              placeholder="e.g. ABC-1234"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="characters"
              value={editLicense}
              onChangeText={setEditLicense}
            />

            <Text style={[styles.stepSubtitle, { marginTop: 20 }]}>
              Drivers
            </Text>
            <FlatList
              data={users}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) =>
                renderUserItem({
                  item,
                  selected: editDrivers.includes(item.uid),
                  onToggle: toggleEditDriver,
                })
              }
              style={[styles.userList, { maxHeight: 250 }]}
              contentContainerStyle={styles.userListContent}
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={saveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Icon
              name="alert-circle"
              size={48}
              color="#ff3b30"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.confirmTitle}>Delete Vehicle?</Text>
            <Text style={styles.confirmSubtitle}>
              This will permanently remove{" "}
              {carToDelete?.license || "this vehicle"} from the system.
            </Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  saving && styles.disabledButton,
                ]}
                onPress={deleteCar}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  header: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 20 },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyStateText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.5)",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    marginTop: 8,
  },

  // Car list
  listContent: { paddingBottom: 100 },
  carItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  carItemLeft: { position: "relative", marginRight: 14 },
  carItemImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#333",
  },
  additionalOwnersBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#147efb",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  additionalOwnersText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  carItemRight: { flex: 1 },
  licensePlate: { fontSize: 18, fontWeight: "700", color: "#fff" },
  ownerName: { fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 },

  // Scan button
  scanButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#147efb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  scanButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },

  // Scanner
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#147efb",
    borderRadius: 20,
  },
  scannerCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerHint: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "600", color: "#fff" },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // User list
  userList: { maxHeight: 350 },
  userListContent: { paddingBottom: 10 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  userItemSelected: {
    backgroundColor: "rgba(20,126,251,0.2)",
    borderWidth: 1,
    borderColor: "#147efb",
  },
  userItemImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#333",
  },
  userItemInfo: { flex: 1, marginLeft: 12 },
  userItemName: { fontSize: 16, fontWeight: "500", color: "#fff" },
  userItemPhone: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: { backgroundColor: "#147efb", borderColor: "#147efb" },

  // Buttons
  primaryButton: {
    backgroundColor: "#147efb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 10,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  buttonRow: { flexDirection: "row", marginTop: 16 },
  disabledButton: { opacity: 0.5 },

  // Phone input
  stepSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  phoneInputImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  phoneInputInfo: { flex: 1, marginLeft: 12 },
  phoneInputName: { fontSize: 14, color: "#fff", marginBottom: 6 },
  phoneInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
  },

  // License input
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

  // Detail modal
  detailSectionTitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 12,
  },
  detailDriverRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  detailDriverImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#333",
  },
  detailDriverInfo: { flex: 1, marginLeft: 12 },
  detailDriverName: { fontSize: 16, fontWeight: "500", color: "#fff" },
  detailDriverPhone: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#34c759",
    justifyContent: "center",
    alignItems: "center",
  },
  detailButtonRow: { flexDirection: "row", marginTop: 20, gap: 12 },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#147efb",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  editButtonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.15)",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  deleteButtonText: { fontSize: 15, fontWeight: "600", color: "#ff3b30" },

  // Confirm modal
  confirmModalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    width: "85%",
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 24,
  },
  confirmButtonRow: { flexDirection: "row", gap: 12, width: "100%" },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmCancelText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: "#ff3b30",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmDeleteText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});

export default TrafficManager;
