import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  ScrollView,
  PanResponder,
  TextInput,
  Keyboard,
  Animated,
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
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
import {
  GRADES_LIST,
  cleanFieldName,
  deleteManualPerson,
  fetchMergeCandidates,
  isManualId,
  manualPeopleRef,
  mergeManualIntoReal,
  newManualId,
  normalizeManualPerson,
  saveManualPerson,
} from "../../utils/manualPeople";

// Simple cache utilities
const CacheUtils = makeScreenCache();

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Grades and their on-disk field names now live in utils/manualPeople.js, so the
// registry and this screen cannot drift apart on what "3rd Grade" is called.
const gradesList = GRADES_LIST;

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

// Line boxes for the two lines in a servant card, and for the section header.
// ROW_H / HDR_H below are derived from these — change a font size without
// revisiting them and the __DEV__ drift warning in ServantRow will say so.
const NAME_LINE = 20;
const DETAIL_LINE = 17;
const HEADER_LINE = 26;
// The delete button's tallest child is an Ionicons glyph, whose box JS cannot
// compute. Pinned to what it already measured so the row height is knowable.
const ACTION_BUTTON_H = 40;

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

// servantCard is a column: 1px border top and bottom, 16*scale padding all round,
// then the servantInfo row (the taller of the avatar and the two-line text
// block) plus its margin, then the pinned delete button, then the card's margin.
const TEXT_BLOCK_H = LH(NAME_LINE * scale) + 4 * scale + LH(DETAIL_LINE * scale);
const ROW_H =
  2 +
  32 * scale +
  Math.max(48 * scale, TEXT_BLOCK_H) +
  12 * scale +
  ACTION_BUTTON_H * scale +
  12 * scale;
// sectionHeader: 8*scale padding top and bottom around one 22*scale line.
const HDR_H = 16 * scale + LH(HEADER_LINE * scale);

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: () => ROW_H,
  getSectionHeaderHeight: () => HDR_H,
});

const auditServantRow = makeRowHeightAudit("ServantRow", ROW_H, 12 * scale);

/**
 * One roster row, memoized on the servant doc.
 *
 * The row used to be an inline closure rebuilt on every parent render, so any
 * unrelated state change re-rendered every mounted cell — with a 48px avatar in
 * each one, that showed up as a stutter mid-scroll.
 */
const ServantRow = React.memo(({ item, onPress, onRemove }) => (
  <TouchableOpacity
    style={styles.servantCard}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
    onLayout={auditServantRow}
  >
    <View style={styles.servantInfo}>
      <View style={styles.servantImageContainer}>
        <Avatar
          uid={item.id}
          user={item}
          size={48 * scale}
          borderRadius={24 * scale}
          style={styles.servantImage}
          showBorder={false}
        />
      </View>
      {/*
        Both capped to one line: a joined list of assigned classes wrapped to a
        second line for anyone teaching more than two or three, which made the
        card height vary per row. See ROW_H.
      */}
      <View style={styles.servantTextInfo}>
        {/*
          The badge sits inside the name's line box rather than on a line of its
          own, so a manual row is exactly as tall as a real one and ROW_H still
          holds. flexShrink on the Text is what keeps a long name from pushing
          the badge off the card.
        */}
        <View style={styles.servantNameRow}>
          <Text style={styles.servantName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.manual && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Manual</Text>
            </View>
          )}
        </View>
        <Text style={styles.servantGrades} numberOfLines={1}>
          {Array.isArray(item.ssGrades) && item.ssGrades.length > 0
            ? item.ssGrades.join(", ")
            : "No classes assigned"}
        </Text>
      </View>
    </View>
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={() => onRemove(item.id)}
      >
        <Ionicons name="trash" size={20 * scale} color="#fff" />
        <Text style={styles.buttonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
));
ServantRow.displayName = "ServantRow";

const SectionHeader = React.memo(({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
));
SectionHeader.displayName = "SectionHeader";

const ServantsAdmin = () => {
  // Core state
  const [church, setChurch] = useState(null);
  // Two sources, kept apart until the memo below merges them: real servants come
  // from `users` (isSSTeacher), manual ones from the church's ManualPeople
  // registry. They arrive on independent snapshots and must not clobber each other.
  const [servants, setServants] = useState([]);
  const [manualPeople, setManualPeople] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServant, setSelectedServant] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [isServantMeeting, setIsServantMeeting] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  // Manual-person editing. `draftId` is the id the photo is uploaded under, so
  // for a new person it has to exist before the form is filled in.
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [draftPhotoUploaded, setDraftPhotoUploaded] = useState(false);

  // Sync
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncCandidates, setSyncCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [indexBarLayout, setIndexBarLayout] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-grouping the whole roster
  // and re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);
  
  // Hold the skeleton until the navigation transition finishes, so the snapshot
  // work below doesn't compete with the animation on the JS thread.
  const ready = useAfterInteractions();

  // Refs
  const sectionListRef = useRef(null);
  const indexBarRef = useRef(null);
  const isMounted = useRef(true);
  const userUnsubscribe = useRef(null);
  const servantsUnsubscribe = useRef(null);
  const manualUnsubscribe = useRef(null);
  // The church the roster listener is currently attached to.
  const attachedChurch = useRef(null);
  const cacheKeys = useRef({
    church: null,
    servants: null,
    manual: null
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

  // Initialize and load cached data immediately
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

      // Set cache keys
      cacheKeys.current = {
        church: `servants_admin_church_${user.uid}`,
        servants: `servants_admin_list_${user.uid}`,
        manual: `servants_admin_manual_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();
      
      // Set up real-time listeners
      setupUserChurchListener();
      
      // No timer: the skeleton stays up until the servants snapshot actually
      // delivers. A 300ms timer used to hide it mid-flight, flashing an
      // empty screen before the real data landed.
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) {
        userUnsubscribe.current();
      }
      if (servantsUnsubscribe.current) {
        servantsUnsubscribe.current();
      }
      if (manualUnsubscribe.current) {
        manualUnsubscribe.current();
      }
    };
  }, [ready]);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedChurch, cachedServants, cachedManual] = await Promise.all([
        CacheUtils.get(cacheKeys.current.church),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.manual)
      ]);

      if (cachedChurch && isMounted.current) {
        setChurch(cachedChurch);
      }

      if (cachedServants && isMounted.current) {
        setServants(cachedServants);
        // Cached docs carry photoURL, so avatars paint with no Storage calls.
        avatarCache.primeMany(cachedServants);
      }

      if (cachedManual && isMounted.current) {
        setManualPeople(cachedManual);
        avatarCache.primeMany(cachedManual);
      }
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  // Set up user church listener
  const setupUserChurchListener = () => {
    const user = getAuth().currentUser;
    
    userUnsubscribe.current = onSnapshot(
      doc(getFirestore(), "users", user.uid),
      async (doc) => {
        if (!isMounted.current) return;
          
        if (doc.exists) {
          const userChurch = doc.data().church || null;
          setChurch(userChurch);
            
          // Cache church data
          CacheUtils.set(cacheKeys.current.church, userChurch);
            
          // Set up servants listener when church is available. Only re-attach
          // when the church actually changed — re-attaching on every write to
          // your own user doc tore down the roster listener and replayed a full
          // snapshot, re-rendering the whole list each time.
          if (userChurch) {
            if (attachedChurch.current !== userChurch) {
              attachedChurch.current = userChurch;
              setupServantsListener(userChurch);
              setupManualListener(userChurch);
            }
          } else {
            attachedChurch.current = null;
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      },
      (error) => {
        if (isMounted.current) {
          setLoading(false);
          Alert.alert("Error", "Failed to fetch church data.");
        }
      }
    );
  };

  // Set up servants listener
  const setupServantsListener = (churchId) => {
    // Clear previous listener if exists
    if (servantsUnsubscribe.current) {
      servantsUnsubscribe.current();
    }

    servantsUnsubscribe.current = onSnapshot(
      query(
        collection(getFirestore(), "users"),
        where("church", "==", churchId),
        where("isSSTeacher", "==", true)
      ),
      async (querySnapshot) => {
        if (!isMounted.current) return;
          
        // One pass, one doc.data() per doc. The third .map this replaces
        // re-derived `name` through `querySnapshot.docs.find(...)` — a linear
        // scan plus another deserialization per servant — to produce a value
        // the `...doc.data()` spread had already set. O(n²) dead work.
        // Sort key computed once per doc, not inside the comparator. Each
        // `doc` property read goes through @react-native-firebase's
        // deprecation Proxy, so each one is touched exactly once.
        const servantList = querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            // String() keeps the comparator total against a non-string `name`.
            const name = String(data.name ?? "");
            const id = doc.id;
            return { item: { ...data, id, name }, key: name.trim().toLowerCase(), id };
          })
          .sort(
            (a, b) =>
              a.key.localeCompare(b.key) ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
          )
          .map((entry) => entry.item);

        setServants(servantList);

        // These docs already carry photoURL, so priming the avatar cache
        // here costs no extra requests and replaces the old per-user
        // getDownloadURL() fan-out plus its 30s refetch timer.
        avatarCache.primeMany(servantList);

        // Real data is on screen — only now drop the skeleton.
        setLoading(false);

        // Cache servants data
        CacheUtils.set(cacheKeys.current.servants, servantList);
      },
      (error) => {
        if (isMounted.current) {
          setLoading(false);
          Alert.alert("Error", "Could not fetch servants.");
        }
      }
    );
  };

  // Set up manual-people listener
  //
  // Separate from the roster listener above because the two read different
  // collections and neither is a subset of the other: a manual person has no
  // `users` doc for the isSSTeacher query to match, and a real servant has no
  // registry entry. They are merged in `allServants` below.
  const setupManualListener = (churchId) => {
    if (manualUnsubscribe.current) {
      manualUnsubscribe.current();
    }

    manualUnsubscribe.current = onSnapshot(
      manualPeopleRef(churchId),
      (snapshot) => {
        if (!isMounted.current) return;
        const people = snapshot.docs.map((d) =>
          normalizeManualPerson(d.id, d.data())
        );
        setManualPeople(people);
        avatarCache.primeMany(people);
        CacheUtils.set(cacheKeys.current.manual, people);
      },
      () => {
        // Non-fatal: the real roster still renders. An alert here would fire on
        // every church that has never had a manual person, which is most of them.
        if (isMounted.current) setManualPeople([]);
      }
    );
  };

  /**
   * The roster the screen actually renders: real servants and manual ones in one
   * alphabetical list.
   *
   * Sorted here rather than relying on the roster listener's own sort, because
   * that one only ever saw the `users` half.
   */
  const allServants = useMemo(() => {
    if (manualPeople.length === 0) return servants;
    return [...servants, ...manualPeople].sort((a, b) => {
      const an = String(a.name ?? "").trim().toLowerCase();
      const bn = String(b.name ?? "").trim().toLowerCase();
      return an.localeCompare(bn) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }, [servants, manualPeople]);

  // Build sections from servants + searchQuery.
  //
  // Derived with useMemo, not state-in-an-effect. An effect runs *after* the
  // render that set `servants`, so in that first frame `servants` was full while
  // `sections` was still [] — and the "No servants found." branch below painted
  // before the effect caught up. Deriving it keeps the two consistent within a
  // single render.
  const sections = useMemo(() => {
    if (allServants.length === 0) return [];

    const filtered = search.active
      ? allServants.filter((s) => (s.name || "").toLowerCase().includes(search.lower))
      : allServants;

    // Group by first letter (A-Z or #)
    const grouped = filtered.reduce((acc, servant) => {
      const firstChar = (servant.name || '').charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(servant);
      return acc;
    }, {});

    // Convert to SectionList format - put # at the end
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      })
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }));
  }, [allServants, search]);

  const availableLetters = useMemo(
    () => sections.map((section) => section.title).sort(),
    [sections]
  );

  // Handle remove photo
  const handleRemovePhoto = async () => {
    if (!selectedServant?.id) return;

    setDeletingPhoto(true);
    try {
      // Clears the Storage object, the photoURL pointer on the user doc, and
      // the cache — so a stale URL can't be re-primed by the next snapshot.
      await avatarCache.removePhoto(selectedServant.id);
      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      Alert.alert("Error", "Could not delete profile picture. Please try again.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Handle edit profile picture
  const handleEditProfilePicture = () => {
    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Photo",
          onPress: () => setPhotoInputVisible(true),
        },
        {
          text: "Remove Photo",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
      ],
      { cancelable: true }
    );
  };

  // Open edit modal
  const openEditModal = useCallback((servant) => {
    if (!servant?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedServant(servant);
    setSelectedGrades(Array.isArray(servant.ssGrades) ? servant.ssGrades : []);
    setIsServantMeeting(servant.isServant || false);
    // Contact fields are editable for a manual person only — for a real servant
    // these live on their own profile and are theirs to change.
    setDraftName(servant.name || "");
    setDraftPhone(servant.phone || "");
    setDraftEmail(servant.email || "");
    setModalVisible(true);
  }, []);

  // ── Manual people ─────────────────────────────────────────────────────────

  /**
   * Open the add sheet.
   *
   * The id is minted up front because PhotoInput uploads to
   * `profilePictures/{id}.png`, so the id has to exist before a photo can be
   * attached — the same trick ServantsAttendance uses for its temp uid.
   */
  const openAddModal = useCallback(() => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setDraftId(newManualId());
    setDraftName("");
    setDraftPhone("");
    setDraftEmail("");
    setSelectedGrades([]);
    setDraftPhotoUploaded(false);
    setAddModalVisible(true);
  }, []);

  /**
   * Cancelling without saving drops any photo already uploaded under the draft
   * id, so Storage isn't left holding a file nothing references.
   */
  const cancelAddModal = useCallback(async () => {
    setAddModalVisible(false);
    const id = draftId;
    const hadPhoto = draftPhotoUploaded;
    setDraftId(null);
    setDraftName("");
    setDraftPhone("");
    setDraftEmail("");
    setSelectedGrades([]);
    setDraftPhotoUploaded(false);
    if (hadPhoto && id) {
      // The manual_ prefix means removePhoto skips the users/{id} write.
      try {
        await avatarCache.removePhoto(id);
      } catch {}
    }
  }, [draftId, draftPhotoUploaded]);

  const handleAddManual = async () => {
    if (!church || !draftId) return;
    const trimmed = draftName.trim().replace(/\s+/g, " ");
    if (trimmed.split(" ").filter(Boolean).length < 2) {
      Alert.alert(
        "Full name required",
        "Please enter both a first and last name so this person can be matched to their account later."
      );
      return;
    }

    setSavingManual(true);
    try {
      await saveManualPerson(church, {
        id: draftId,
        name: trimmed,
        phone: draftPhone,
        email: draftEmail,
        ssGrades: selectedGrades,
        createdBy: getAuth().currentUser?.uid || null,
      });
      setAddModalVisible(false);
      setDraftId(null);
      setDraftName("");
      setDraftPhone("");
      setDraftEmail("");
      setSelectedGrades([]);
      // Committed — the photo belongs to a saved person now, so cancelAddModal
      // must not delete it on the next open.
      setDraftPhotoUploaded(false);
    } catch (error) {
      Alert.alert("Error", "Could not add servant. " + error.message);
    } finally {
      setSavingManual(false);
    }
  };

  // Open photo input modal
  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedServant(null);
    setSelectedGrades([]);
    setIsServantMeeting(false);
    setDraftName("");
    setDraftPhone("");
    setDraftEmail("");
  };

  // Close photo input modal
  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
    // PhotoInput writes the new URL straight into avatarCache (and onto the
    // user doc), so there is nothing to refetch on close.
  };

  // Save classes
  const saveClasses = async () => {
    if (!selectedServant || !church) return;

    // A manual person has no `users` doc to hold the role, and their projections
    // are derived from the registry — so the whole save is one registry write.
    if (selectedServant.manual) {
      const trimmed = draftName.trim().replace(/\s+/g, " ");
      if (trimmed.split(" ").filter(Boolean).length < 2) {
        Alert.alert(
          "Full name required",
          "Please enter both a first and last name."
        );
        return;
      }
      try {
        await saveManualPerson(church, {
          id: selectedServant.id,
          name: trimmed,
          phone: draftPhone,
          email: draftEmail,
          ssGrades: selectedGrades,
          createdAt: selectedServant.createdAt,
        });
        await CacheUtils.remove(cacheKeys.current.manual);
        closeEditModal();
      } catch (error) {
        console.error("Error saving manual servant:", error);
        Alert.alert("Error", "Could not save changes. Please try again.");
      }
      return;
    }

    try {
      // 1. Update the user document (existing functionality)
      await updateDoc(doc(getFirestore(), "users", selectedServant.id), {
        ssGrades: selectedGrades,
        isServant: isServantMeeting,
      });

      // 2. Create/Update the servant document in the church's Sunday School collection
      const servantData = {
        name: selectedServant.name,
        uid: selectedServant.id,
      };

      // Add all grades as boolean fields
      gradesList.forEach((grade) => {
        const fieldName = cleanFieldName(grade);
        servantData[fieldName] = selectedGrades.includes(grade);
      });

      // Create or update the document
      await setDoc(
        doc(
          getFirestore(),
          "churches",
          church,
          "Sunday School",
          "Servants",
          "Servants",
          selectedServant.id
        ),
        servantData,
        { merge: true }
      );

      // Clear servants cache to force refresh
      await CacheUtils.remove(cacheKeys.current.servants);
      
      closeEditModal();
    } catch (error) {
      console.error("Error saving classes:", error);
      Alert.alert("Error", "Could not save classes. Please try again.");
    }
  };

  // Remove servant
  const removeServant = useCallback(async (servantId) => {
    if (!church) return;

    // Removing a manual person is unrecoverable in a way removing a real one is
    // not: a real servant keeps their `users` doc and can simply be re-added,
    // whereas a manual person's registry entry is the only record they exist at
    // all, and their attendance goes with it. Hence the confirm on this branch
    // only — the real-servant path keeps its existing one-tap behaviour.
    if (isManualId(servantId)) {
      Alert.alert(
        "Remove servant",
        "This permanently deletes their record and all of their attendance. It cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteManualPerson(church, servantId);
                await CacheUtils.remove(cacheKeys.current.manual);
              } catch (error) {
                console.error("Error removing manual servant:", error);
                Alert.alert("Error", "Could not remove servant. Please try again.");
              }
            },
          },
        ]
      );
      return;
    }

    try {
      // 1. Update the user document (existing functionality)
      await updateDoc(doc(getFirestore(), "users", servantId), {
        isSSTeacher: false,
        ssGrades: [],
        isServant: false,
      });

      // 2. Delete the servant document from the church's Sunday School collection
      await deleteDoc(doc(
        getFirestore(),
        "churches",
        church,
        "Sunday School",
        "Servants",
        "Servants",
        servantId
      ));
      
      // Clear servants cache to force refresh
      await CacheUtils.remove(cacheKeys.current.servants);
        
    } catch (error) {
      console.error("Error removing servant:", error);
      Alert.alert("Error", "Could not remove servant. Please try again.");
    }
  }, [church]);

  // ── Sync to a real account ────────────────────────────────────────────────

  /**
   * Candidates come from utils/manualPeople.js, which unions the accounts that
   * hold the Sunday School role with those already projected into Servants
   * Meeting. This screen used to read the Servants Meeting projection alone, so
   * any servant whose projection had drifted away from their `users` doc was
   * missing from the picker — on the roster, but unmergeable.
   */
  const openSyncModal = useCallback(async () => {
    if (!church) return;
    const person = selectedServant;
    setCandidateQuery("");
    setLoadingCandidates(true);
    setSyncModalVisible(true);
    try {
      const candidates = await fetchMergeCandidates(church, {
        excludeId: person?.id,
      });
      setSyncCandidates(candidates);
      // These docs already carry photoURL — free avatars, no Storage requests.
      avatarCache.primeMany(candidates);
    } catch {
      Alert.alert("Error", "Could not load accounts.");
      setSyncCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [church, selectedServant]);

  const filteredCandidates = useMemo(() => {
    const q = candidateQuery.trim().toLowerCase();
    if (!q) return syncCandidates;
    return syncCandidates.filter((c) =>
      String(c.name ?? "").toLowerCase().includes(q)
    );
  }, [syncCandidates, candidateQuery]);

  const handleSyncConfirm = useCallback(
    (candidate) => {
      const person = selectedServant;
      if (!person || !church) return;
      Alert.alert(
        "Sync to account",
        `Merge "${person.name}" into ${candidate.name}'s account?\n\nAny attendance ${candidate.name} already has takes priority. ${candidate.name} becomes a Sunday School servant, and this manual record will be deleted.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sync",
            onPress: async () => {
              setSyncing(true);
              try {
                const { carried, roleGranted } = await mergeManualIntoReal(
                  church,
                  person,
                  candidate.uid
                );
                const moved =
                  (carried.servantsMeeting || 0) + (carried.sundaySchool || 0);
                setSyncModalVisible(false);
                closeEditModal();
                await CacheUtils.remove(cacheKeys.current.manual);
                const dates =
                  moved > 0
                    ? `, carrying over ${moved} attendance ${moved === 1 ? "date" : "dates"}`
                    : "";
                Alert.alert(
                  "Synced",
                  `${person.name} was merged into ${candidate.name}'s account${dates}.` +
                    (roleGranted
                      ? ""
                      : `\n\nThe attendance moved, but ${candidate.name}'s Sunday School Teacher role could not be set — turn it on from Servants Management.`)
                );
              } catch (e) {
                Alert.alert("Sync failed", e.message);
              } finally {
                setSyncing(false);
              }
            },
          },
        ]
      );
    },
    [church, selectedServant]
  );

  const renderCandidate = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.candidateRow}
        onPress={() => handleSyncConfirm(item)}
        disabled={syncing}
        activeOpacity={0.7}
      >
        <Avatar
          uid={item.uid}
          user={item}
          size={40}
          borderRadius={20}
          showBorder={false}
        />
        <Text style={styles.candidateName} numberOfLines={1}>
          {item.name || "Unnamed"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    ),
    [handleSyncConfirm, syncing]
  );

  const candidateKeyExtractor = useCallback((item) => item.uid, []);

  // Scroll to section
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) {
      return;
    }
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

  // Handle index bar touch and drag
  const handleIndexBarTouch = (letter) => {
    if (letter !== currentLetter) {
      setCurrentLetter(letter);
      scrollToSection(letter);
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    }
  };

  // Pan responder for sliding through letters
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!indexBarLayout || availableLetters.length === 0) return;
        const { pageY } = evt.nativeEvent;
        const letterHeight = indexBarLayout.height / availableLetters.length;
        const index = Math.floor((pageY - indexBarLayout.y) / letterHeight);
        const clampedIndex = Math.max(0, Math.min(index, availableLetters.length - 1));
        const letter = availableLetters[clampedIndex];
        handleIndexBarTouch(letter);
      },
      onPanResponderMove: (evt) => {
        if (!indexBarLayout || availableLetters.length === 0) return;
        const { pageY } = evt.nativeEvent;
        const letterHeight = indexBarLayout.height / availableLetters.length;
        const index = Math.floor((pageY - indexBarLayout.y) / letterHeight);
        const clampedIndex = Math.max(0, Math.min(index, availableLetters.length - 1));
        const letter = availableLetters[clampedIndex];
        handleIndexBarTouch(letter);
      },
      onPanResponderRelease: () => {
        setCurrentLetter(null);
      },
    })
  ).current;

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section: { title } }) => <SectionHeader title={title} />,
    []
  );

  // Render servant item
  const renderServant = useCallback(
    ({ item }) => (
      <ServantRow item={item} onPress={openEditModal} onRemove={removeServant} />
    ),
    [openEditModal, removeServant]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // A roster of person cards — rows land in place of these. Gated on the
  // servant list rather than on `church`: church resolves from cache first, and
  // dropping the skeleton then flashed "No servants found." until the snapshot
  // landed.
  if (!ready || (loading && allServants.length === 0)) {
    return (
      <SkeletonScreen
        variant="personCards"
        count={isTablet ? 10 : 8}
        showHeader={false}
        paddingHorizontal={paddingHorizontal}
        paddingTop={20}
        // Matches listContainer's inset for the alphabet index bar.
        bodyStyle={{ paddingRight: 32 }}
        header={
          <Text style={[styles.header, { fontSize: 24 }]}>
            Manage Sunday School
          </Text>
        }
      />
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      <Text style={[styles.header, { fontSize: 24  }]}>
        Manage Sunday School
      </Text>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>
          {search.active ? "No servants match your search." : "No servants found."}
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderServant}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            {...LIST_PERF}
            // Every row is a fixed height, so the offset of any letter is known
            // without having rendered it. This is what makes the A-Z bar land
            // instantly instead of failing: the handler that used to sit here
            // swallowed the failure and left the list where it was, so tapping a
            // far letter did nothing. It is unreachable once getItemLayout is
            // set (VirtualizedList guards the whole failure path on it), so it is
            // gone rather than kept as a silent catch-all.
            getItemLayout={getItemLayout}
            // Android only: on iOS this blanked rows once the list was scrolled
            // past a screen or two. See utils/listConfig.js.
            removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
          {/* Gated on the deferred value so the bar and the list change together. */}
          {sections.length > 0 && !search.active && (
            <View style={{ position: 'absolute', top: 100 * scale, right: 0, width: 30 }}>
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
                placeholder="Search servants"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {selectedServant && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Avatar
                      uid={selectedServant.id}
                      user={selectedServant}
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
                      <Ionicons
                        name="pencil"
                        size={16 * scale}
                        color="#147efb"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Assign Classes for {selectedServant?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              {/*
                The switch writes `isServant`, which grants access to the
                Servants Meeting tracker *screen*. There is no app for it to
                unlock for someone who has no account, so it is hidden rather
                than shown disabled. Their Servants Meeting membership is not
                affected — utils/manualPeople.js keeps that projection
                unconditional, matching what isSSTeacher does for real servants.
              */}
              {!selectedServant?.manual && (
                <View style={styles.servantTrackerContainer}>
                  <Text
                    style={[styles.servantTrackerText, { fontSize: 16 * scale }]}
                  >
                    Servant Meeting Tracker
                  </Text>
                  <Switch
                    value={isServantMeeting}
                    onValueChange={(value) => setIsServantMeeting(value)}
                    trackColor={{ false: "#555", true: "#147efb" }}
                    thumbColor={isServantMeeting ? "#fff" : "#aaa"}
                  />
                </View>
              )}
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {selectedServant?.manual && (
                  <View style={styles.manualFields}>
                    <TouchableOpacity
                      style={styles.syncRow}
                      onPress={openSyncModal}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="link-outline" size={18} color="#147efb" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.syncRowTitle}>Sync to account</Text>
                        <Text style={styles.syncRowSubtitle}>
                          Merge this record into their account once they join
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="rgba(255,255,255,0.4)"
                      />
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>Full name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={draftName}
                      onChangeText={setDraftName}
                      placeholder="First and last name"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="words"
                      autoCorrect={false}
                    />

                    <Text style={styles.inputLabel}>Phone (optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={draftPhone}
                      onChangeText={setDraftPhone}
                      placeholder="Used to match them to their account"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="phone-pad"
                    />

                    <Text style={styles.inputLabel}>Email (optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={draftEmail}
                      onChangeText={setDraftEmail}
                      placeholder="Used to match them to their account"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
                <View style={styles.modalContent}>
                  {/* Fixed 16-item list inside a ScrollView: virtualization was
                      already disabled via scrollEnabled={false}, so a plain map
                      is cheaper and avoids the nested-VirtualizedList warning. */}
                  <View style={styles.gradesList}>
                    {gradesList.map((grade) => (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradeItem,
                          selectedGrades.includes(grade) &&
                            styles.gradeItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedGrades((prev) => {
                            const toggled = prev.includes(grade)
                              ? prev.filter((g) => g !== grade)
                              : [...prev, grade];
                            return gradesList.filter((g) =>
                              toggled.includes(g)
                            );
                          });
                        }}
                      >
                        <Text
                          style={[styles.gradeText, { fontSize: 16 * scale }]}
                        >
                          {grade}
                        </Text>
                        {selectedGrades.includes(grade) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20 * scale}
                            color="#147efb"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveClasses}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/*
              Rendered inside the edit modal rather than as its own <Modal>.
              iOS will not present a view controller that is already
              presenting, so a sibling <Modal> here is silently dropped and the
              Sync row looks dead with no error. Same constraint that
              PhotoInput's `inline` prop exists for. As an overlay it also
              returns to the edit form on cancel instead of to the roster.
            */}
            {syncModalVisible && (
              <View style={styles.syncInlineOverlay}>
                <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Sync {selectedServant?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSyncModalVisible(false)}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.syncSearchWrap}>
                <Ionicons
                  name="search"
                  size={16}
                  color="rgba(255,255,255,0.55)"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchBar}
                  placeholder="Search accounts"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={candidateQuery}
                  onChangeText={setCandidateQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {loadingCandidates ? (
                <View style={styles.syncLoading}>
                  <ActivityIndicator color="#147EFB" />
                </View>
              ) : (
                // The wrapper's height is explicit on purpose. modalContainer sizes
                // itself to its content, and a FlatList in a content-sized parent
                // has no height to virtualize against — it collapses to nothing.
                // The sibling edit modal gets away with a bare ScrollView because
                // its children are all laid out; a virtualized list is not.
                <View style={styles.syncListWrap}>
                  <FlatList
                    {...LIST_PERF}
                    data={filteredCandidates}
                    renderItem={renderCandidate}
                    keyExtractor={candidateKeyExtractor}
                    contentContainerStyle={styles.syncListContent}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <Text style={styles.syncEmpty}>
                        {candidateQuery
                          ? "No accounts match your search."
                          : "No accounts in this church yet. Once this person signs up, they'll appear here."}
                      </Text>
                    }
                  />
                </View>
              )}

              {syncing && (
                <View style={styles.syncOverlay}>
                  <ActivityIndicator size="large" color="#147EFB" />
                </View>
              )}
                </View>
              </View>
            )}

            {/* Same constraint as the sync overlay above: content of *this*
                modal (`inline`), not a second <Modal>. Stacked, it was never
                presented and "Change Photo" opened nothing. */}
            <PhotoInput
              inline
              visible={photoInputVisible}
              onClose={closePhotoInputModal}
              userId={selectedServant.id}
            />
          </View>
        </Modal>
      )}

      {/* ── Add a servant with no account ── */}
      <Modal
        visible={addModalVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.headerContent}>
                <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                  Add Servant Manually
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={cancelAddModal}
              >
                <Ionicons name="close" size={24 * scale} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.manualFields}>
                <TouchableOpacity
                  style={styles.photoPickerRow}
                  onPress={openPhotoInputModal}
                  activeOpacity={0.8}
                >
                  <View style={styles.photoPickerCircle}>
                    {draftPhotoUploaded ? (
                      <Avatar
                        uid={draftId}
                        size={64}
                        borderRadius={32}
                        showBorder={false}
                      />
                    ) : (
                      <Ionicons
                        name="camera-outline"
                        size={28}
                        color="rgba(255,255,255,0.4)"
                      />
                    )}
                  </View>
                  <Text style={styles.photoPickerLabel}>
                    {draftPhotoUploaded ? "Change photo" : "Add photo (optional)"}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Full name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="First and last name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabel}>Phone (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={draftPhone}
                  onChangeText={setDraftPhone}
                  placeholder="Used to match them to their account"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Email (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  placeholder="Used to match them to their account"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { marginTop: 18 }]}>Classes</Text>
                <Text style={styles.fieldHint}>
                  A servant only appears in a class's attendance list once they
                  are assigned to it.
                </Text>
              </View>

              <View style={styles.gradesList}>
                {gradesList.map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    style={[
                      styles.gradeItem,
                      selectedGrades.includes(grade) && styles.gradeItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedGrades((prev) => {
                        const toggled = prev.includes(grade)
                          ? prev.filter((g) => g !== grade)
                          : [...prev, grade];
                        return gradesList.filter((g) => toggled.includes(g));
                      });
                    }}
                  >
                    <Text style={[styles.gradeText, { fontSize: 16 * scale }]}>
                      {grade}
                    </Text>
                    {selectedGrades.includes(grade) && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20 * scale}
                        color="#147efb"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelAddModal}
              >
                <Text style={[styles.modalButtonText, { fontSize: 16 * scale }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  (!draftName.trim() || savingManual) && { opacity: 0.4 },
                ]}
                onPress={handleAddManual}
                disabled={!draftName.trim() || savingManual}
              >
                <Text style={[styles.modalButtonText, { fontSize: 16 * scale }]}>
                  {savingManual ? "Adding…" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/*
            `inline` rather than its own <Modal>: iOS will not present a view
            controller that is already presenting, so a stacked modal here is
            silently dropped and the photo button looks dead.
          */}
          {addModalVisible && draftId && (
            <PhotoInput
              inline
              visible={photoInputVisible}
              onClose={() => setPhotoInputVisible(false)}
              userId={draftId}
              onUploadSuccess={() => setDraftPhotoUploaded(true)}
            />
          )}
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 20,
  },
  header: {
    fontWeight: "600",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 110, // leave room for the floating bar
    flexGrow: 1,
    paddingRight: 32,
  },
  servantCard: {
    flexDirection: "column",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  servantInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12 * scale,
  },
  servantImageContainer: {
    marginRight: 14 * scale,
  },
  servantImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  servantTextInfo: {
    flex: 1,
  },
  // Explicit lineHeights are load-bearing: a Text without one gets the font's
  // natural line box, which JS cannot compute and which differs across platforms.
  servantNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  servantName: {
    fontSize: 17 * scale,
    lineHeight: NAME_LINE * scale,
    fontWeight: "600",
    color: "#fff",
    flexShrink: 1,
  },
  // Sized to stay inside NAME_LINE's box: 10pt text plus 2pt of padding either
  // side is ~15pt, under the 20*scale line it shares. See servantNameRow.
  manualBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,159,10,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,159,10,0.45)",
  },
  manualBadgeText: {
    fontSize: 10,
    lineHeight: 11,
    fontWeight: "700",
    color: "#ff9f0a",
  },
  servantGrades: {
    fontSize: 14 * scale,
    lineHeight: DETAIL_LINE * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ACTION_BUTTON_H * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
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
    lineHeight: HEADER_LINE * scale,
    fontWeight: "600",
    color: "#fff",
  },
  indexBar: {
    position: "absolute",
    right: 0,
    top: (Platform.OS === 'ios' ? 140 : 120),
    height: height - (Platform.OS === 'ios' ? 200 : 180),
    width: indexBarWidth,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-evenly",
    zIndex: 1,
  },
  indexItem: {
    width: 20,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  indexItemActive: {
    backgroundColor: "#147EFB",
  },
  indexText: {
    color: "#147EFB",
    fontWeight: "500",
    fontSize: 11,
  },
  indexTextActive: {
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#147efb",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    width: "85%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 16 * scale,
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
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16 * scale,
    right: 16 * scale,
  },
  modalContent: {
    padding: 16 * scale,
  },
  servantTrackerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    margin: 16 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  servantTrackerText: {
    color: "#fff",
    fontWeight: "600",
  },
  // ---------- Manual people ----------
  manualFields: {
    paddingHorizontal: 16 * scale,
    paddingTop: 16 * scale,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  fieldHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  photoPickerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoPickerLabel: {
    color: "#147efb",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 14,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,126,251,0.1)",
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.3)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  syncRowTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  syncRowSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  syncSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    margin: 16 * scale,
    marginBottom: 8,
  },
  syncListWrap: {
    height: height * 0.45,
  },
  syncListContent: {
    paddingHorizontal: 16 * scale,
    paddingBottom: 16,
    flexGrow: 1,
  },
  syncLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  syncEmpty: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  // Covers the edit modal's own overlay, so the sync panel reads as a step on
  // top of the form rather than a separate screen.
  syncInlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  syncOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  candidateName: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },

  gradesList: {
    paddingHorizontal: 16 * scale,
  },
  gradeItem: {
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
  gradeItemSelected: {
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    borderColor: "rgba(20, 126, 251, 0.3)",
  },
  gradeText: {
    color: "#fff",
    fontWeight: "500",
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
    borderRadius: 14,
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
    fontWeight: "600",
  },
});

export default ServantsAdmin;