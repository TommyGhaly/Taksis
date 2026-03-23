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

import firestore from "@react-native-firebase/firestore";

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
  firestore().collection("cars").doc("unregistered").collection("people");

// ── Phase 0: Migrate unregistered users from old locations ───────────────────

async function migrateUnregUsers(churchId) {
  let migrated = 0;

  // Source 1: qrCodes/unregistered/people
  try {
    const oldQrUnreg = await firestore()
      .collection("qrCodes")
      .doc("unregistered")
      .collection("people")
      .get();

    if (!oldQrUnreg.empty) {
      const BATCH_SIZE = 400;
      const docs = oldQrUnreg.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = firestore().batch();
        for (const doc of chunk) {
          const targetRef = UNREG_COLLECTION().doc(doc.id);
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
      const oldChurchUnreg = await firestore()
        .collection("churches")
        .doc(churchId)
        .collection("unregistered_users")
        .get();

      if (!oldChurchUnreg.empty) {
        const BATCH_SIZE = 400;
        const docs = oldChurchUnreg.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = firestore().batch();
          for (const doc of chunk) {
            const data = doc.data();
            delete data.church;
            const targetRef = UNREG_COLLECTION().doc(doc.id);
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
    const oldTopLevel = await firestore()
      .collection("qrCodes")
      .where("isUnregisteredUser", "==", true)
      .get();

    if (!oldTopLevel.empty) {
      const BATCH_SIZE = 400;
      const docs = oldTopLevel.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = firestore().batch();
        for (const doc of chunk) {
          const data = doc.data();
          delete data.isUnregisteredUser;
          delete data.church;
          const targetRef = UNREG_COLLECTION().doc(doc.id);
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

  await UNREG_COLLECTION().doc(unregId).set(data);

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
  const qrSnap = await firestore()
    .collection("qrCodes")
    .where("church", "==", churchId)
    .get();

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
    const batch = firestore().batch();
    for (const item of chunk) {
      if (item.skip) { batch.delete(item.ref); deleted++; continue; }
      batch.set(firestore().collection("cars").doc(item.targetId), item.data, { merge: true });
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
  const snap = await firestore()
    .collection("cars")
    .where("church", "==", churchId)
    .get();

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
  const snap = await firestore()
    .collection("pending_registrations")
    .where("church", "==", churchId)
    .get();

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
    await firestore().collection("cars").doc(item.id).update({
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

    const batch = firestore().batch();
    batch.set(firestore().collection("cars").doc(plateId), carData, { merge: true });
    batch.delete(firestore().collection("pending_registrations").doc(item.id));
    await batch.commit();
    console.log(`[Migration] Approved pending: ${plateId} → ${resolvedOwnerIds.length} owners`);
  }

  return { plateId, ownerIds: resolvedOwnerIds };
}

export async function deleteReviewItem(item) {
  if (item.source === "malformed_car") {
    await firestore().collection("cars").doc(item.id).delete();
    console.log(`[Migration] Deleted malformed car: ${item.license}`);
  } else {
    await firestore().collection("pending_registrations").doc(item.id).delete();
    console.log(`[Migration] Deleted pending: ${item.license}`);
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function runMigrationIfNeeded(churchId) {
  if (!churchId) return { migrated: false, reviewQueue: [] };

  try {
    // Phase 0: migrate unreg users to cars/unregistered/people
    const unregMigrated = await migrateUnregUsers(churchId);
    if (unregMigrated > 0) {
      console.log(`[Migration] Phase 0 complete: ${unregMigrated} unreg users moved`);
    }

    // Phase 1: auto-migrate qrCodes → cars
    const stats = await migrateQrCodes(churchId);
    const didMigrate = stats.created > 0 || stats.deleted > 0 || unregMigrated > 0;
    if (stats.created > 0 || stats.deleted > 0) {
      console.log(`[Migration] Phase 1 complete:`, stats);
    }

    // Phase 2: find malformed cars
    const malformed = await findMalformedCars(churchId);

    // Phase 3: fetch pending registrations
    const pending = await fetchPendingRegistrations(churchId);

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