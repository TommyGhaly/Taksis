/**
 * carsMigration.js
 *
 * Four responsibilities:
 *
 * 0. Migrate unreg users from old locations → cars/unregistered/people
 * 1. Auto-migrate: qrCodes → cars (already-approved vehicles)
 * 2. Detect malformed cars: docs in `cars` where ownerIds contains objects
 * 3. Provide approve/delete helpers that resolve drivers to Taksis users
 *    or create unregistered user entries
 */

import {
  collection,
  deleteDoc,
  doc as firestoreDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Bump the version suffix to force every device to re-run phases 0/1.
const MIGRATED_KEY = (churchId) => `carsMigrated_v1_${churchId}`;

async function hasMigrated(churchId) {
  try {
    return (await AsyncStorage.getItem(MIGRATED_KEY(churchId))) === "1";
  } catch {
    // If we can't read the marker, re-running is safe (both phases are
    // idempotent) — just slower.
    return false;
  }
}

async function markMigrated(churchId) {
  try {
    await AsyncStorage.setItem(MIGRATED_KEY(churchId), "1");
  } catch {}
}

function cleanPlate(raw) {
  if (!raw) return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

// ── Unreg collection reference (single source of truth) ──────────────────────

const UNREG_COLLECTION = () =>
  collection(getFirestore(), "cars", "unregistered", "people");

// ── Phase 0: Migrate unregistered users from old locations ───────────────────

async function migrateUnregUsers(churchId) {
  let migrated = 0;

  // Source 1: qrCodes/unregistered/people
  try {
    const oldQrUnreg = await getDocs(
      collection(getFirestore(), "qrCodes", "unregistered", "people")
    );

    if (!oldQrUnreg.empty) {
      const BATCH_SIZE = 400;
      const docs = oldQrUnreg.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(getFirestore());
        for (const doc of chunk) {
          const targetRef = firestoreDoc(UNREG_COLLECTION(), doc.id);
          batch.set(targetRef, doc.data(), { merge: true });
          batch.delete(doc.ref);
          migrated++;
        }
        await batch.commit();
      }
      console.log(`[Migration] Moved ${docs.length} unreg users from qrCodes/unregistered/people`);
    }
  } catch (e) {
    console.error("[Migration] Error migrating qrCodes unreg:", e);
  }

  // Source 2: churches/{churchId}/unregistered_users
  if (churchId) {
    try {
      const oldChurchUnreg = await getDocs(collection(
        getFirestore(),
        "churches",
        churchId,
        "unregistered_users"
      ));

      if (!oldChurchUnreg.empty) {
        const BATCH_SIZE = 400;
        const docs = oldChurchUnreg.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(getFirestore());
          for (const doc of chunk) {
            const data = doc.data();
            delete data.church;
            const targetRef = firestoreDoc(UNREG_COLLECTION(), doc.id);
            batch.set(targetRef, data, { merge: true });
            batch.delete(doc.ref);
            migrated++;
          }
          await batch.commit();
        }
        console.log(`[Migration] Moved ${docs.length} unreg users from churches/${churchId}/unregistered_users`);
      }
    } catch (e) {
      console.error("[Migration] Error migrating church unreg:", e);
    }
  }

  // Source 3: top-level qrCodes docs with isUnregisteredUser flag
  try {
    const oldTopLevel = await getDocs(query(
      collection(getFirestore(), "qrCodes"),
      where("isUnregisteredUser", "==", true)
    ));

    if (!oldTopLevel.empty) {
      const BATCH_SIZE = 400;
      const docs = oldTopLevel.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(getFirestore());
        for (const doc of chunk) {
          const data = doc.data();
          delete data.isUnregisteredUser;
          delete data.church;
          const targetRef = firestoreDoc(UNREG_COLLECTION(), doc.id);
          batch.set(targetRef, { ...data, uid: doc.id }, { merge: true });
          batch.delete(doc.ref);
          migrated++;
        }
        await batch.commit();
      }
      console.log(`[Migration] Moved ${docs.length} unreg users from top-level qrCodes`);
    }
  } catch (e) {
    console.error("[Migration] Error migrating top-level qrCodes unreg:", e);
  }

  if (migrated > 0) {
    console.log(`[Migration] Total unreg users migrated: ${migrated}`);
  }

  return migrated;
}

// ── Driver resolution ────────────────────────────────────────────────────────

export async function resolveDriver(driver, churchUsers, unregUsers, churchId) {
  if (typeof driver === "string") {
    return driver;
  }

  if (driver.uid) {
    if (churchUsers.some((u) => u.uid === driver.uid)) return driver.uid;
    if (unregUsers.some((u) => u.uid === driver.uid)) return driver.uid;
    if (driver.uid.startsWith("unreg_")) return driver.uid;
  }

  const driverName = (driver.name || "").trim();
  const driverPhone = normalizePhone(driver.phone);

  if (driverPhone) {
    const match =
      churchUsers.find((u) => normalizePhone(u.phone) === driverPhone) ||
      unregUsers.find((u) => normalizePhone(u.phone) === driverPhone);
    if (match) return match.uid;
  }

  if (driverName) {
    const nameLower = driverName.toLowerCase();
    const match =
      churchUsers.find((u) => (u.name || "").trim().toLowerCase() === nameLower) ||
      unregUsers.find((u) => (u.name || "").trim().toLowerCase() === nameLower);
    if (match) return match.uid;
  }

  if (!driverName && !driverPhone) return null;

  return createUnregisteredUser(churchId, driverName, driverPhone);
}

async function createUnregisteredUser(churchId, name, phone) {
  const unregId = `unreg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    name: name || "Unknown",
    uid: unregId,
  };
  if (phone) data.phone = phone;

  await setDoc(firestoreDoc(UNREG_COLLECTION(), unregId), data);

  console.log(`[Migration] Created unreg user: ${unregId} (${name || "Unknown"})`);
  return unregId;
}

async function resolveAllDrivers(drivers, churchUsers, unregUsers, churchId) {
  const resolved = [];
  for (const d of drivers || []) {
    const uid = await resolveDriver(d, churchUsers, unregUsers, churchId);
    if (uid) resolved.push(uid);
  }
  return resolved;
}

// ── Phase 1: Auto-migrate qrCodes → cars ────────────────────────────────────

async function migrateQrCodes(churchId) {
  const qrSnap = await getDocs(query(
    collection(getFirestore(), "qrCodes"),
    where("church", "==", churchId)
  ));

  if (qrSnap.empty) return { created: 0, deleted: 0, errors: 0 };

  console.log(`[Migration] Found ${qrSnap.size} qrCodes to migrate`);
  const allDocs = [];

  for (const doc of qrSnap.docs) {
    const data = doc.data();
    if (data.isUnregisteredUser) {
      allDocs.push({ ref: doc.ref, skip: true });
      continue;
    }
    const plateId = cleanPlate(data.license || doc.id);
    if (!plateId) {
      allDocs.push({ ref: doc.ref, skip: true });
      continue;
    }
    allDocs.push({
      ref: doc.ref,
      targetId: plateId,
      data: {
        church: data.church || churchId,
        license: plateId,
        ownerIds: data.ownerIds || [],
        present: data.present || false,
        ...(data.make && { make: data.make }),
        ...(data.model && { model: data.model }),
        ...(data.color && { color: data.color }),
      },
    });
  }

  let created = 0, deleted = 0, errors = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const chunk = allDocs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getFirestore());
    for (const item of chunk) {
      if (item.skip) { batch.delete(item.ref); deleted++; continue; }
      batch.set(firestoreDoc(getFirestore(), "cars", item.targetId), item.data, { merge: true });
      created++;
      batch.delete(item.ref);
      deleted++;
    }
    try { await batch.commit(); }
    catch (e) { console.error("[Migration] Batch error:", e); errors += chunk.length; }
  }

  return { created, deleted, errors };
}

// ── Phase 2: Detect malformed cars ───────────────────────────────────────────

async function findMalformedCars(churchId) {
  const snap = await getDocs(query(
    collection(getFirestore(), "cars"),
    where("church", "==", churchId)
  ));

  const malformed = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const ownerIds = data.ownerIds || [];

    const hasObjectDrivers = ownerIds.some((entry) => typeof entry === "object" && entry !== null);
    if (!hasObjectDrivers) continue;

    malformed.push({
      id: doc.id,
      license: data.license || doc.id,
      church: data.church || churchId,
      drivers: ownerIds,
      make: data.make || null,
      model: data.model || null,
      color: data.color || null,
      source: "malformed_car",
    });
  }

  if (malformed.length > 0) {
    console.log(`[Migration] Found ${malformed.length} malformed car docs`);
  }

  return malformed;
}

// ── Phase 3: Fetch actual pending_registrations ──────────────────────────────

async function fetchPendingRegistrations(churchId) {
  const snap = await getDocs(query(
    collection(getFirestore(), "pending_registrations"),
    where("church", "==", churchId)
  ));

  if (snap.empty) return [];

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      license: cleanPlate(d.license || doc.id),
      church: d.church || churchId,
      drivers: d.drivers || [],
      make: d.make || null,
      model: d.model || null,
      color: d.color || null,
      source: "pending_registration",
    };
  });
}

// ── Approval / Fix actions ───────────────────────────────────────────────────

export async function approveReviewItem(churchId, item, resolvedOwnerIds) {
  const plateId = cleanPlate(item.license);
  if (!plateId) throw new Error("Cannot approve vehicle with no plate");

  if (item.source === "malformed_car") {
    await updateDoc(firestoreDoc(getFirestore(), "cars", item.id), {
      ownerIds: resolvedOwnerIds,
    });
    console.log(`[Migration] Fixed malformed car: ${plateId} → ${resolvedOwnerIds.length} owners`);
  } else {
    const carData = {
      church: churchId,
      license: plateId,
      ownerIds: resolvedOwnerIds,
      present: false,
      ...(item.make && { make: item.make }),
      ...(item.model && { model: item.model }),
      ...(item.color && { color: item.color }),
    };

    const batch = writeBatch(getFirestore());
    batch.set(firestoreDoc(getFirestore(), "cars", plateId), carData, { merge: true });
    batch.delete(firestoreDoc(getFirestore(), "pending_registrations", item.id));
    await batch.commit();
    console.log(`[Migration] Approved pending: ${plateId} → ${resolvedOwnerIds.length} owners`);
  }

  return { plateId, ownerIds: resolvedOwnerIds };
}

export async function deleteReviewItem(item) {
  if (item.source === "malformed_car") {
    await deleteDoc(firestoreDoc(getFirestore(), "cars", item.id));
    console.log(`[Migration] Deleted malformed car: ${item.license}`);
  } else {
    await deleteDoc(firestoreDoc(getFirestore(), "pending_registrations", item.id));
    console.log(`[Migration] Deleted pending: ${item.license}`);
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function runMigrationIfNeeded(churchId) {
  if (!churchId) return { migrated: false, reviewQueue: [] };

  try {
    // Phases 0 and 1 are genuinely one-time data moves (qrCodes → cars). They
    // used to re-run on every single mount of TrafficManager — four sequential
    // reads plus batch writes — while the screen sat on a spinner. Once a
    // church has been converted, skip straight to the detection phases.
    let didMigrate = false;
    let stats;
    const alreadyMigrated = await hasMigrated(churchId);

    if (!alreadyMigrated) {
      // Phase 0: migrate unreg users to cars/unregistered/people
      const unregMigrated = await migrateUnregUsers(churchId);
      if (unregMigrated > 0) {
        console.log(`[Migration] Phase 0 complete: ${unregMigrated} unreg users moved`);
      }

      // Phase 1: auto-migrate qrCodes → cars
      stats = await migrateQrCodes(churchId);
      didMigrate = stats.created > 0 || stats.deleted > 0 || unregMigrated > 0;
      if (stats.created > 0 || stats.deleted > 0) {
        console.log(`[Migration] Phase 1 complete:`, stats);
      }

      await markMigrated(churchId);
    }

    // Phases 2 and 3 are independent reads — run them concurrently rather than
    // one after the other.
    const [malformed, pending] = await Promise.all([
      findMalformedCars(churchId),
      fetchPendingRegistrations(churchId),
    ]);

    const reviewQueue = [...malformed, ...pending];

    if (reviewQueue.length > 0) {
      console.log(
        `[Migration] Review queue: ${malformed.length} malformed + ${pending.length} pending = ${reviewQueue.length} total`
      );
    }

    return {
      migrated: didMigrate,
      stats: didMigrate ? stats : undefined,
      reviewQueue,
    };
  } catch (e) {
    console.error("[Migration] Failed:", e);
    return { migrated: false, error: e.message, reviewQueue: [] };
  }
}