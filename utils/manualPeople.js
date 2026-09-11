/**
 * manualPeople — servants a church tracks who have no app account.
 *
 * ── The model ────────────────────────────────────────────────────────────────
 *
 * A real servant's identity lives on `users/{uid}`, and the church subcollections
 * hold *projections* of that person keyed by the same uid:
 *
 *   users/{uid}                                       identity + roles
 *   churches/{c}/Servants Meeting/{uid}               attendance
 *   churches/{c}/Sunday School/Servants/Servants/{uid}  attendance + class flags
 *
 * A manual person has no `users` doc, so this module supplies the missing layer:
 *
 *   churches/{c}/ManualPeople/{manual_id}             identity (name/phone/email/classes)
 *
 * ...and writes the exact same two projections under the manual id. Every screen
 * that already reads those collections therefore picks a manual person up with no
 * change at all — SundaySchoolAttendance's shared-grade filter, the Servants
 * Meeting roster, the statistics exporters.
 *
 * Deliberately, a manual person always has BOTH projections. The backend keys
 * Servants Meeting membership off `isSSTeacher` (see `servant_ok` in
 * backend/functions/main.py), i.e. "Sunday School servant" and "Servants Meeting
 * member" are the same population. There is no user doc to carry that flag for a
 * manual person, so the invariant is enforced here instead: one registry doc, two
 * projection docs, always in lockstep.
 *
 * Note this is NOT what the "Servant Meeting Tracker" switch in ServantsAdmin
 * controls. That writes `isServant`, which gates access to the tracker *screen*
 * (MainContainer.js) — a permission, and a meaningless one for someone with no app.
 *
 * ── Ids ──────────────────────────────────────────────────────────────────────
 *
 * The `manual_` prefix predates this module: it is how ServantsAttendance has
 * always minted these, and utils/avatarCache.js keys its synthetic-id handling off
 * it. Kept as-is so existing docs and photos need no rewriting.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "@react-native-firebase/storage";
import { isAttendanceDateKey } from "./dateKeys";
import * as avatarCache from "./avatarCache";

// ── Ids ───────────────────────────────────────────────────────────────────────

export const MANUAL_PREFIX = "manual_";

export const isManualId = (id) =>
  typeof id === "string" && id.startsWith(MANUAL_PREFIX);

export const newManualId = () =>
  `${MANUAL_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Grades ────────────────────────────────────────────────────────────────────
//
// The display labels and their on-disk field names. This pairing was duplicated
// in ServantsAdmin (`gradesList` + `cleanFieldName`); it lives here now because
// both the registry and the Sunday School projection need it.

export const GRADES_LIST = [
  "Pre-School - Age 3",
  "Pre-School - Age 4",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
  "College",
];

const GRADE_FIELD_BY_LABEL = {
  "Pre-School - Age 3": "preSchoolAge3",
  "Pre-School - Age 4": "preSchoolAge4",
  "Kindergarten": "kindergarten",
  "1st Grade": "1",
  "2nd Grade": "2",
  "3rd Grade": "3",
  "4th Grade": "4",
  "5th Grade": "5",
  "6th Grade": "6",
  "7th Grade": "7",
  "8th Grade": "8",
  "9th Grade": "9",
  "10th Grade": "10",
  "11th Grade": "11",
  "12th Grade": "12",
  "College": "college",
};

/** Display label -> on-disk boolean field name. */
export const cleanFieldName = (grade) =>
  GRADE_FIELD_BY_LABEL[grade] || String(grade).toLowerCase().replace(/\s+/g, "");

const GRADE_FIELDS = new Set(Object.values(GRADE_FIELD_BY_LABEL));

/** The labels a Sunday School servant doc's boolean fields add up to. */
export const gradesFromFields = (data) =>
  GRADES_LIST.filter((g) => data?.[cleanFieldName(g)] === true);

// ── Document references ───────────────────────────────────────────────────────

const db = () => getFirestore();

export const manualPeopleRef = (church) =>
  collection(db(), "churches", church, "ManualPeople");

export const manualPersonRef = (church, id) =>
  doc(db(), "churches", church, "ManualPeople", id);

/**
 * The two collections a person is projected into, in the order a merge must
 * touch them.
 *
 * `carries` decides which of a manual doc's fields survive a merge into a real
 * account. Attendance keys always do. The Sunday School doc additionally carries
 * its class booleans, so syncing someone who was only ever tracked manually does
 * not silently drop the classes an admin assigned them.
 *
 * Picking fields by predicate rather than by excluding a list of known metadata
 * names is the same reasoning as isAttendanceDateKey's: a field added later
 * (`photoURL`, `createdAt`, anything DatabaseManager writes) should not be
 * assumed to be attendance.
 */
export const PROJECTIONS = [
  {
    key: "servantsMeeting",
    label: "Servants Meeting",
    ref: (church, id) =>
      doc(db(), "churches", church, "Servants Meeting", id),
    carries: (field) => isAttendanceDateKey(field),
  },
  {
    key: "sundaySchool",
    label: "Sunday School",
    ref: (church, id) =>
      doc(
        db(),
        "churches",
        church,
        "Sunday School",
        "Servants",
        "Servants",
        id
      ),
    carries: (field) => isAttendanceDateKey(field) || GRADE_FIELDS.has(field),
  },
];

const projection = (key) => PROJECTIONS.find((p) => p.key === key);

// ── Registry reads ────────────────────────────────────────────────────────────

/**
 * Every manual person in a church, shaped like the rows ServantsAdmin builds
 * from `users` docs: `id`, `name`, `ssGrades`.
 */
export function normalizeManualPerson(id, data) {
  return {
    id,
    uid: id,
    name: String(data?.name ?? ""),
    phone: data?.phone ?? "",
    email: data?.email ?? "",
    ssGrades: Array.isArray(data?.ssGrades) ? data.ssGrades : [],
    photoURL: data?.photoURL ?? null,
    photoUpdatedAt: data?.photoUpdatedAt ?? null,
    manual: true,
  };
}

export async function fetchManualPeople(church) {
  const snap = await getDocs(manualPeopleRef(church));
  return snap.docs.map((d) => normalizeManualPerson(d.id, d.data()));
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Create or update a manual person and both of their projections.
 *
 * Not a transaction: the three docs live in different collections and the
 * projections are derived, so a partial write leaves the registry authoritative
 * and the next save reconciles it. A failed write surfaces to the caller.
 */
export async function saveManualPerson(church, person) {
  const id = person.id || newManualId();
  const name = String(person.name || "").trim().replace(/\s+/g, " ");
  const ssGrades = Array.isArray(person.ssGrades)
    ? GRADES_LIST.filter((g) => person.ssGrades.includes(g))
    : [];

  await setDoc(
    manualPersonRef(church, id),
    {
      id,
      name,
      phone: String(person.phone || "").trim(),
      email: String(person.email || "").trim().toLowerCase(),
      ssGrades,
      manual: true,
      updatedAt: Date.now(),
      ...(person.createdAt ? {} : { createdAt: Date.now() }),
      ...(person.createdBy ? { createdBy: person.createdBy } : {}),
    },
    { merge: true }
  );

  // Sunday School projection: identity plus one boolean per class. Written for
  // every class every time — dropping a class has to clear its flag, not just
  // omit it, or the merge below would leave it set.
  const ssData = { uid: id, name, manual: true };
  for (const grade of GRADES_LIST) {
    ssData[cleanFieldName(grade)] = ssGrades.includes(grade);
  }
  await setDoc(projection("sundaySchool").ref(church, id), ssData, {
    merge: true,
  });

  // Servants Meeting projection: unconditional, per the invariant at the top.
  await setDoc(
    projection("servantsMeeting").ref(church, id),
    { uid: id, name, manual: true },
    { merge: true }
  );

  return id;
}

/**
 * Remove a manual person entirely: registry, both projections, and their photo.
 *
 * Deleting the photo is safe here in a way it is not for a real servant — a
 * manual person's `profilePictures/{manual_id}.png` is referenced by nothing
 * else, whereas a real user's is their app-wide profile picture.
 */
export async function deleteManualPerson(church, id) {
  await Promise.all(
    PROJECTIONS.map((p) => deleteDoc(p.ref(church, id)).catch(() => {}))
  );
  await deleteDoc(manualPersonRef(church, id));
  try {
    await avatarCache.removePhoto(id);
  } catch {}
}

// ── Photo ─────────────────────────────────────────────────────────────────────

/**
 * Move a manual person's photo onto the real account, if the move is a gain.
 *
 * A real user's existing picture always wins — they chose it. The manual copy is
 * dropped either way, because its id is about to stop existing.
 */
async function mergePhoto(manualId, realUID) {
  const storage = getStorage();
  const manualPhoto = ref(storage, `profilePictures/${manualId}.png`);
  const realPhoto = ref(storage, `profilePictures/${realUID}.png`);

  let manualUrl = null;
  try {
    manualUrl = await getDownloadURL(manualPhoto);
  } catch {
    return; // Nothing to move.
  }

  let realHasPhoto = false;
  try {
    await getDownloadURL(realPhoto);
    realHasPhoto = true;
  } catch {}

  if (!realHasPhoto) {
    try {
      const response = await fetch(manualUrl);
      const blob = await response.blob();
      await uploadBytes(realPhoto, blob);
      await avatarCache.invalidate(realUID);
    } catch (e) {
      console.warn("[manualPeople] photo copy failed:", e?.message);
    }
  }

  try {
    await avatarCache.removePhoto(manualId);
  } catch {}
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Link a manual person to a real account: fold both projections into the real
 * uid, hand over the photo, grant the Sunday School role, delete the manual side.
 *
 * The real account wins every conflict. Someone who has been using the app has
 * been marking their own attendance; the manual record is a stand-in for the
 * period before that, so it fills gaps rather than overwriting.
 *
 * ── On ordering ──────────────────────────────────────────────────────────────
 *
 * The `Servants Meeting` doc is written before `users/{uid}` gets
 * `isSSTeacher: true`. update_user (backend/functions/main.py) reconciles those
 * two against each other and treats a mismatch as a membership change, which
 * routes through remove_user_from_churches + add_user_to_churches — a
 * cross-church sweep that re-adds the person with a hardcoded `weeksSince`,
 * discarding their place in the schedule rotation. Writing the doc first means
 * `servant_ok` already holds by the time anything calls that endpoint.
 *
 * Returns a per-collection summary of how many attendance dates were carried
 * over, so the caller can tell the admin what actually moved.
 */
export async function mergeManualIntoReal(church, manualPerson, realUID) {
  const manualId = manualPerson?.id || manualPerson?.uid;
  if (!manualId || !isManualId(manualId)) {
    throw new Error("Not a manual person.");
  }
  if (!realUID || isManualId(realUID)) {
    throw new Error("Not a real account.");
  }

  // Identity is read from the registry rather than taken from the caller. The
  // Servants Meeting screen only ever holds that collection's projection, which
  // carries no `ssGrades` — trusting it would silently drop the classes an admin
  // assigned in Servants Management.
  let registryData = null;
  try {
    const registrySnap = await getDoc(manualPersonRef(church, manualId));
    if (registrySnap.exists) registryData = registrySnap.data();
  } catch {}

  // The real user's name is the one that survives — it is what they typed.
  let realName = "";
  let realUserData = null;
  try {
    const userSnap = await getDoc(doc(db(), "users", realUID));
    if (userSnap.exists) {
      realUserData = userSnap.data();
      realName = realUserData?.name || "";
    }
  } catch {}

  // Which set of classes survives, decided once and applied to both the user
  // doc and the Sunday School projection below.
  //
  // Real wins, as everywhere else — but "real" here means the account actually
  // has classes of its own. A brand-new sign-up has none, which is the common
  // case, and then the manual assignment is exactly what should carry over.
  const existingGrades = Array.isArray(realUserData?.ssGrades)
    ? realUserData.ssGrades
    : [];
  const manualGrades = Array.isArray(registryData?.ssGrades)
    ? registryData.ssGrades
    : Array.isArray(manualPerson?.ssGrades)
      ? manualPerson.ssGrades
      : [];
  const winningGrades =
    existingGrades.length > 0 ? existingGrades : manualGrades;

  const carried = {};

  for (const p of PROJECTIONS) {
    const manualRef = p.ref(church, manualId);
    const realRef = p.ref(church, realUID);

    const manualSnap = await getDoc(manualRef);
    if (!manualSnap.exists) {
      carried[p.key] = 0;
      continue;
    }
    const manualData = manualSnap.data() || {};

    const carriedFields = {};
    for (const [field, value] of Object.entries(manualData)) {
      if (p.carries(field)) carriedFields[field] = value;
    }

    const realSnap = await getDoc(realRef);
    const realData = realSnap.exists ? realSnap.data() || {} : {};

    // Real wins field by field. Anything the real doc already has — including a
    // date they marked themselves — is left exactly as it is.
    const merged = { ...carriedFields, ...realData };

    // Only dates that were actually new to the real doc count as carried over.
    const dates = Object.keys(carriedFields).filter(
      (field) => isAttendanceDateKey(field) && !(field in realData)
    ).length;

    // Restate the class flags from the winning grade list rather than letting
    // the field-by-field merge decide them.
    //
    // Field-by-field gets this wrong whenever the account has `ssGrades` but no
    // Sunday School doc yet — nothing on the real side wins, so the manual
    // person's flags land and the projection then contradicts the user doc.
    // One person cannot be teaching two different sets of classes.
    if (p.key === "sundaySchool") {
      for (const grade of GRADES_LIST) {
        merged[cleanFieldName(grade)] = winningGrades.includes(grade);
      }
    }

    await setDoc(
      realRef,
      { ...merged, uid: realUID, name: realName || realData.name || "" },
      { merge: true }
    );
    await deleteDoc(manualRef);

    carried[p.key] = dates;
  }

  await mergePhoto(manualId, realUID);

  // Grant the role. `winningGrades` is the same list the Sunday School
  // projection was just written with, so the two cannot disagree.
  try {
    await updateDoc(doc(db(), "users", realUID), {
      isSSTeacher: true,
      ssGrades: winningGrades,
    });
  } catch (e) {
    // The projections are already merged at this point, which is the part that
    // carries data. A missing role is recoverable from Servants Management; a
    // half-merged attendance history is not, so this does not rethrow.
    console.warn("[manualPeople] role not granted on users doc:", e?.message);
  }

  await deleteDoc(manualPersonRef(church, manualId)).catch(() => {});

  return { carried, realName };
}
