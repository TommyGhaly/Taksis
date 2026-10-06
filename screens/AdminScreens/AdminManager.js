import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  Alert,
  Dimensions,
  Platform,
  TextInput,
  Keyboard,
  Animated,
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../../components/photoInput";
import Avatar from "../../components/Avatar";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import SkeletonScreen from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF, REMOVE_CLIPPED_ANDROID_ONLY } from "../../utils/listConfig";
import {
  makeSectionListGetItemLayout,
  makeRowHeightAudit,
} from "../../utils/sectionListLayout";
import { makeScreenCache } from "../../utils/screenCache";
import useAfterInteractions from "../../hooks/useAfterInteractions";
import useDeferredSearch from "../../hooks/useDeferredSearch";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const CacheUtils = makeScreenCache();

const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;

// Line boxes for the three lines in a user card, and for the section header.
// Named because ROW_H / HDR_H below are derived from them — changing a number
// here without changing nothing else is fine, but changing a *font size* without
// revisiting these will trip the __DEV__ drift warning in UserRow.
// Line boxes are ~1.3x their font size. At ~1.2x (their old values) iOS
// clipped the descenders of g/y/p/j, most visibly in names.
const NAME_LINE = 23;
const DETAIL_LINE = 19;
const HEADER_LINE = 24;

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
//
// The ceil-to-whole-pixel is not cosmetic either. Native rounds a scaled line box
// UP to the device pixel grid, and modelling that as plain multiplication (or as
// roundToNearestPixel) leaves each row a fraction of a point short — which then
// accumulates down the list. Verified on device: at a 0.94 font scale a declared
// 20pt line renders as exactly 19.0, and 14pt as 13.333, which is what ceil gives
// and rounding does not.
const FONT_SCALE = PixelRatio.getFontScale();
const PX = PixelRatio.get();
const LH = (v) => Math.ceil(v * FONT_SCALE * PX) / PX;

// userCard: 1px border top and bottom, 16*scale padding all round, then the
// tallest of the avatar and the three-line text block, then its own margin.
// The text block normally wins (62*scale vs 48*scale) but the max is kept
// because at large font scales the ordering does not change and at small ones
// the avatar would.
const TEXT_BLOCK_H =
  LH(NAME_LINE * scale) +
  4 * scale +
  LH(DETAIL_LINE * scale) +
  4 * scale +
  LH(DETAIL_LINE * scale);
const ROW_H =
  2 + 32 * scale + Math.max(48 * scale, TEXT_BLOCK_H) + 12 * scale;
// sectionHeader: 8*scale padding top and bottom around one 18*scale line.
const HDR_H = 16 * scale + LH(HEADER_LINE * scale);

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: () => ROW_H,
  getSectionHeaderHeight: () => HDR_H,
  // Footer and list-header default to 0: this list renders no section footer, no
  // ListHeaderComponent, and listContainer sets only paddingBottom/paddingRight.
});

const auditUserRow = makeRowHeightAudit("UserRow", ROW_H, 12 * scale);

const adminRoles = [
  { key: "admin", label: "Schedule Admin" },
  { key: "ssAdmin", label: "Servants Manager" },
  { key: "alhanAdmin", label: "Alhan Manager" },
  { key: "youthAdmin", label: "Youth Meeting Manager" },
  { key: "trafficAdmin", label: "Traffic Manager" },
  { key: "isServant", label: "Servants Meeting Tracker" },
  { key: "paschaAdmin", label: "Pascha Manager" },
];

/**
 * One roster row, memoized on the user doc.
 *
 * The row used to be an inline closure rebuilt on every parent render, so any
 * unrelated state change re-rendered every mounted cell — and with 48px avatars
 * in each one that showed up as a stutter mid-scroll.
 */
const UserRow = React.memo(({ item, onPress }) => {
  const activeRoles =
    adminRoles
      .filter((role) => item[role.key])
      .map((role) => role.label)
      .join(", ") || "No roles assigned";

  return (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      onLayout={auditUserRow}
    >
      <View style={styles.userImageContainer}>
        <Avatar
          uid={item.id}
          user={item}
          size={48 * scale}
          borderRadius={24 * scale}
          style={styles.userImage}
          showBorder={false}
        />
      </View>
      {/*
        These three are capped to one line and carry an explicit lineHeight so
        the card's height is a constant this screen can predict. `userRoles` in
        particular used to wrap — six role labels joined with ", " is easily two
        lines. See ROW_H below and utils/sectionListLayout.js for why that matters.
      */}
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.userChurch} numberOfLines={1}>
          {item.church || "No church assigned"}
        </Text>
        <Text style={styles.userRoles} numberOfLines={1}>
          Roles: {activeRoles}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, styles.editButton]}
        onPress={() => onPress(item)}
      >
        <Ionicons name="pencil" size={18 * scale} color="#fff" />
        <Text style={styles.buttonText}>Edit</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});
UserRow.displayName = "UserRow";

const SectionHeader = React.memo(({ title }) => (
  <View style={styles.sectionHeader}>
    {/*
      This overrides styles.sectionHeaderText's 22*scale, so the lineHeight has to
      live here too — putting it on the StyleSheet entry would describe a font size
      this header never actually renders at.
    */}
    <Text
      style={[
        styles.sectionHeaderText,
        { fontSize: 18 * scale, lineHeight: HEADER_LINE * scale },
      ]}
    >
      {title}
    </Text>
  </View>
));
SectionHeader.displayName = "SectionHeader";

const AdminManager = () => {
  const [church, setChurch] = useState(null);
  const [users, setUsers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-grouping the whole roster
  // and re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);

  // Hold the skeleton until the drawer/stack transition finishes, so the
  // snapshot work below doesn't compete with the animation on the JS thread.
  const ready = useAfterInteractions();

  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const userUnsubscribe = useRef(null);
  const usersUnsubscribe = useRef(null);
  // The church the roster listener is currently attached to.
  const attachedChurch = useRef(null);
  /**
   * Incremental roster index: id -> { item, key }.
   *
   * This listener is deliberately unscoped — it reads users across every church,
   * which is the capability this screen exists to provide. The cost of that is
   * churn: `onSnapshot` hands the callback the *full* `querySnapshot.docs` on every
   * delivery, so a single unrelated write anywhere (an FCM token refresh, a
   * `lastServe` bump from schedule generation, a photo upload in another church)
   * used to re-map and re-sort every user on the device.
   *
   * `docChanges()` reports only what actually changed, so steady-state cost drops
   * from n `doc.data()` deserializations to 1 — and each of those property reads
   * goes through @react-native-firebase's deprecation Proxy, so touching each doc
   * exactly once is the whole game. The first snapshot reports every doc as
   * "added", so cold-start behavior is unchanged.
   */
  const rosterRef = useRef(new Map());
  // Whether the roster listener has delivered at least once, so an empty
  // collection still drops the skeleton instead of waiting forever.
  const rosterDelivered = useRef(false);
  const cacheKeys = useRef({
    church: null,
    users: null,
  });
  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Lift the floating search bar above the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (!ready) return;
    isMounted.current = true;

    const initializeApp = async () => {
      const user = getAuth().currentUser;
      if (!user) {
        setLoading(false);
        Alert.alert("Error", "No user authenticated.");
        return;
      }

      cacheKeys.current = {
        church: `admin_manager_church_${user.uid}`,
        users: `admin_manager_users_${user.uid}`,
      };

      loadCachedData();
      setupUserChurchListener();
      // No timer here: the skeleton stays up until the users snapshot actually
      // delivers (see setupUsersListener). A 300ms timer used to hide it while
      // the read was still in flight, so the screen flashed empty.
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) userUnsubscribe.current();
      if (usersUnsubscribe.current) usersUnsubscribe.current();
    };
  }, [ready]);

  const loadCachedData = async () => {
    try {
      const [cachedChurch, cachedUsers] = await Promise.all([
        CacheUtils.get(cacheKeys.current.church),
        CacheUtils.get(cacheKeys.current.users),
      ]);

      if (cachedChurch && isMounted.current) setChurch(cachedChurch);
      if (cachedUsers && isMounted.current) {
        setUsers(cachedUsers);
        // Cached docs carry photoURL, so avatars paint with no Storage calls.
        avatarCache.primeMany(cachedUsers);
      }
    } catch (error) {
      console.log("Error loading cached data:", error);
    }
  };

  const setupUserChurchListener = () => {
    const user = getAuth().currentUser;

    userUnsubscribe.current = onSnapshot(
      doc(getFirestore(), "users", user.uid),
      async (doc) => {
        if (!isMounted.current) return;

        if (doc.exists) {
          const userChurch = doc.data().church || null;
          setChurch(userChurch);
          CacheUtils.set(cacheKeys.current.church, userChurch);

          // Only re-attach when the church actually changed. Re-attaching on
          // every write to your own user doc tore down the roster listener and
          // replayed a full snapshot, re-rendering the whole list each time.
          if (userChurch) {
            if (attachedChurch.current !== userChurch) {
              attachedChurch.current = userChurch;
              setupUsersListener(userChurch);
            }
          } else {
            // No church means no user list is coming — stop waiting.
            attachedChurch.current = null;
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      },
      () => {
        if (isMounted.current) {
          setLoading(false);
          Alert.alert("Error", "Failed to fetch church data.");
        }
      }
    );
  };

  const setupUsersListener = (churchId) => {
    if (usersUnsubscribe.current) usersUnsubscribe.current();
    // Re-attaching produces a fresh snapshot reporting every doc as "added", so the
    // index has to start empty or removed users would linger.
    rosterRef.current = new Map();
    rosterDelivered.current = false;

    // Note: deliberately no `.orderBy("name")`. Firestore omits documents that lack
    // the ordered field, and this roster is expected to contain users with no name
    // (hence the `?? ""` below) — ordering server-side would silently hide them.
    usersUnsubscribe.current = onSnapshot(
      collection(getFirestore(), "users"),
      (querySnapshot) => {
        if (!isMounted.current) return;

        const changes = querySnapshot.docChanges();
        const firstDelivery = !rosterDelivered.current;
        rosterDelivered.current = true;
        // Nothing changed and the list is already on screen: skip the sort and,
        // more importantly, don't hand SectionList a new array identity.
        if (!firstDelivery && changes.length === 0) return;

        const roster = rosterRef.current;
        const touched = [];

        for (const change of changes) {
          const id = change.doc.id;
          if (change.type === "removed") {
            roster.delete(id);
            continue;
          }
          const data = change.doc.data();
          // String() keeps the comparator total — a non-string `name` (e.g. a
          // number entered via DatabaseManager) used to reach .toLowerCase() and
          // throw, killing the whole snapshot handler.
          const name = String(data.name ?? "");
          const item = { ...data, id, name };
          // Sort key precomputed once per doc rather than built inside the
          // comparator, which runs O(n log n) times.
          roster.set(id, { item, key: name.trim().toLowerCase() });
          touched.push(item);
        }

        const userList = Array.from(roster.values())
          .sort(
            (a, b) =>
              a.key.localeCompare(b.key) ||
              (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0)
          )
          .map((entry) => entry.item);

        setUsers(userList);
        // These docs already carry photoURL, so priming the avatar cache here
        // costs no extra requests and replaces the old per-user
        // getDownloadURL() fan-out plus its 30s refetch timer. Only the changed
        // docs need priming — the rest are already in the cache.
        if (touched.length > 0) avatarCache.primeMany(touched);
        // Real data is on screen — only now drop the skeleton.
        setLoading(false);
        CacheUtils.set(cacheKeys.current.users, userList);
      },
      () => {
        if (isMounted.current) {
          setLoading(false);
          Alert.alert("Error", "Could not fetch users.");
        }
      }
    );
  };

  // Build sections from users + searchQuery.
  //
  // Derived with useMemo, not state-in-an-effect. An effect runs *after* the
  // render that set `users`, so in that first frame `users` was full while
  // `sections` was still [] — and the "No users found." branch below painted
  // before the effect caught up. Deriving it keeps the two consistent within a
  // single render.
  const sections = useMemo(() => {
    if (users.length === 0) return [];

    const filtered = search.active
      ? users.filter((u) => (u.name || "").toLowerCase().includes(search.lower))
      : users;

    const grouped = filtered.reduce((acc, user) => {
      const firstChar = (user.name || "").charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(user);
      return acc;
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b);
      })
      .map((letter) => ({ title: letter, data: grouped[letter] }));
  }, [users, search]);

  // AlphabetIndexBar takes this as an array prop, so building it inline in the JSX
  // handed it a new identity on every render and defeated its memoization.
  const availableLetters = useMemo(() => sections.map((s) => s.title), [sections]);

  const handleRemovePhoto = async () => {
    if (!selectedUser?.id) return;

    setDeletingPhoto(true);
    try {
      // Clears the Storage object, the photoURL pointer on the user doc, and
      // the cache — so a stale URL can't be re-primed by the next snapshot.
      await avatarCache.removePhoto(selectedUser.id);
      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not delete profile picture. Please try again."
      );
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleEditProfilePicture = () => {
    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Change Photo", onPress: () => setPhotoInputVisible(true) },
        { text: "Remove Photo", style: "destructive", onPress: handleRemovePhoto },
      ],
      { cancelable: true }
    );
  };

  const openEditModal = useCallback((user) => {
    if (!user?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedUser(user);
    const initialRoles = adminRoles
      .filter((role) => user[role.key])
      .map((role) => role.key);
    setSelectedRoles(initialRoles);
    setModalVisible(true);
  }, []);

  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedUser(null);
    setSelectedRoles([]);
  };

  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
    // PhotoInput writes the new URL straight into avatarCache (and onto the
    // user doc), so there is nothing to refetch on close.
  };

  const toggleRole = (roleKey) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const saveRoles = async () => {
    if (!selectedUser) return;

    try {
      const roleUpdates = {};
      adminRoles.forEach((role) => {
        roleUpdates[role.key] = selectedRoles.includes(role.key);
      });

      await updateDoc(doc(getFirestore(), "users", selectedUser.id), roleUpdates);

      await CacheUtils.remove(cacheKeys.current.users);
      setModalVisible(false);
    } catch {
      Alert.alert("Error", "Could not update roles. Please try again.");
    }
  };

  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;

    sectionListRef.current.scrollToLocation({
      sectionIndex,
      // 0 is the section header's own slot. This used to be 1, which targets
      // data item 0 and only lands on the header because sticky-header handling
      // subtracts the header's height back off — which in turn needed the
      // header's frame to be known. 0 addresses it directly.
      itemIndex: 0,
      animated: false,
      viewPosition: 0,
      viewOffset: 0,
    });
  };

  const renderSectionHeader = useCallback(
    ({ section: { title } }) => <SectionHeader title={title} />,
    []
  );

  const renderUser = useCallback(
    ({ item }) => <UserRow item={item} onPress={openEditModal} />,
    [openEditModal]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // Roster of people — rows land in place of these. Gated on the user list
  // rather than on `church`: church resolves from cache first, and dropping the
  // skeleton at that point flashed "No users found." until the snapshot landed.
  if (!ready || (loading && users.length === 0)) {
    return (
      <SkeletonScreen
        variant="personCards"
        count={isTablet ? 10 : 8}
        showHeader={false}
        rowLines={3}
        paddingHorizontal={paddingHorizontal}
        paddingTop={20}
        // Matches listContainer's inset for the alphabet index bar.
        bodyStyle={{ paddingRight: 32 }}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {sections.length === 0 ? (
        <Text style={styles.noData}>
          {search.active ? "No users match your search." : "No users found."}
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderUser}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            {...LIST_PERF}
            // Every row is a fixed height, so the offset of any letter is known
            // without having rendered it. This is what makes the A-Z bar land
            // instantly instead of failing: there used to be a no-op
            // onScrollToIndexFailed here, which meant tapping a far letter did
            // nothing at all. That handler is unreachable once getItemLayout is
            // set (VirtualizedList guards the whole failure path on it), so it
            // is gone rather than kept as a silent catch-all.
            getItemLayout={getItemLayout}
            // Android only: on iOS this blanked rows once the list was scrolled
            // past a screen or two. See utils/listConfig.js.
            removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
          {/*
            Gated on the deferred value, not the raw one, so the bar disappears
            in the same commit the list filters — otherwise it vanishes a frame
            early, while the full roster is still on screen.
          */}
          {!search.active && (
            <View style={styles.alphabetBarContainer}>
              <AlphabetIndexBar
                onLetterChange={scrollToSection}
                availableLetters={availableLetters}
              />
            </View>
          )}
        </View>
      )}

      {/* ---------- Floating bottom search bar with system material ---------- */}
      <Animated.View
        style={[
          styles.floatingBarWrapper,
          { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] },
        ]}
        pointerEvents="box-none"
      >
        <BlurView
          tint="systemChromeMaterialDark"
          intensity={80}
          style={styles.floatingBlur}
        >
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBar}
                placeholder="Search users"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </BlurView>
      </Animated.View>

      {selectedUser && (
        <Modal visible={modalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                { width: isTablet ? "70%" : "90%" },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Avatar
                      uid={selectedUser.id}
                      user={selectedUser}
                      size={80}
                      finalSize={300}
                      borderRadius={40}
                      style={styles.profileImage}
                      expandable
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={handleEditProfilePicture}
                      disabled={deletingPhoto}
                    >
                      <Ionicons name="pencil" size={16 * scale} color="#147efb" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>
                    Edit Roles for {selectedUser?.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeEditModal}>
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.rolesList}>
                {adminRoles.map((role) => (
                  <View key={role.key} style={styles.roleItem}>
                    <Text style={styles.roleText}>{role.label}</Text>
                    <Switch
                      value={selectedRoles.includes(role.key)}
                      onValueChange={() => toggleRole(role.key)}
                      trackColor={{ true: "#147efb" }}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveRoles}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Content of *this* modal (`inline`), not a second <Modal>: iOS
                will not present from a view controller that is already
                presenting, so a sibling modal here was dropped with no error
                and "Change Photo" opened nothing. */}
            <PhotoInput
              inline
              visible={photoInputVisible}
              onClose={closePhotoInputModal}
              userId={selectedUser.id}
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 20,
  },
  listWrapper: {
    flex: 1,
    position: "relative",
  },
  listContainer: {
    paddingBottom: 110, // leave room for the floating bar
    flexGrow: 1,
    paddingRight: 32,
  },
  alphabetBarContainer: {
    position: "absolute",
    top: 150 * scale,
    right: 0,
    width: 30,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  userImageContainer: {
    marginRight: 14 * scale,
  },
  userImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  userInfo: {
    flex: 1,
  },
  // The explicit lineHeights below are load-bearing, not cosmetic: a Text with
  // no lineHeight gets the *font's* natural line box, which JS cannot compute and
  // which differs between iOS (SF) and Android (Roboto). ROW_H has to know these.
  userName: {
    fontSize: 17 * scale,
    lineHeight: NAME_LINE * scale,
    fontWeight: "600",
    color: "#fff",
  },
  userChurch: {
    fontSize: 14 * scale,
    lineHeight: DETAIL_LINE * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  userRoles: {
    fontSize: 14 * scale,
    lineHeight: DETAIL_LINE * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
  },
  editButton: {
    backgroundColor: "#147efb",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14 * scale,
    fontWeight: "600",
    marginLeft: 6 * scale,
  },
  noData: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    marginTop: 20,
    fontSize: 16 * scale,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 22 * scale,
    fontWeight: "600",
    color: "#fff",
  },

  // ---------- Floating bottom search ----------
  floatingBarWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: Platform.OS === "ios" ? 28 : 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: Platform.OS === "android" ? "rgba(28,28,30,0.92)" : "transparent",
  },
  floatingInner: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147EFB",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12 * scale,
  },
  profileImage: {
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 6 * scale,
  },
  modalTitle: {
    fontSize: 18 * scale,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16 * scale,
    right: 16 * scale,
    padding: 4 * scale,
  },
  rolesList: {
    padding: 16 * scale,
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    marginBottom: 8 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  roleText: {
    color: "#fff",
    fontSize: 16 * scale,
    fontWeight: "500",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16 * scale,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "space-between",
    gap: 12 * scale,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14 * scale,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#147EFB",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16 * scale,
    fontWeight: "600",
  },
});

export default AdminManager;