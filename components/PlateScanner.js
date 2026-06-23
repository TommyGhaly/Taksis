/**
 * PlateScanner
 *
 * OCR: @react-native-ml-kit/text-recognition
 *
 * If the detected plate matches an existing car (via knownPlates prop),
 * it fires onPlateScanned immediately — no confirmation, no review.
 * Otherwise, it confirms once a candidate has been seen enough times across a
 * rolling window of recent frames (tolerant of OCR glyph flicker), then shows
 * a review sheet.
 *
 * Props:
 *   visible, onPlateScanned, onClose, onManualEntry, knownPlates
 *
 *   knownPlates — Set<string> or array of plate strings already in the system.
 *                 When a scanned plate matches, skips confirmation + review.
 */

import React, {
  useState, useEffect, useCallback, useRef, memo,
} from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Platform, ActivityIndicator, Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// ── Plate detection ──────────────────────────────────────────────────────────

function cleanPlate(r) {
  return r.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

const PLATE_RE = /^[A-Z0-9]{4,8}$/;

// Tokens that frequently appear ON a plate or its frame but are NOT the plate
// number. We drop these before scoring so they don't win or pollute combos.
const NON_PLATE_TOKENS = new Set([
  // State names (spaces removed, uppercased)
  "ALABAMA", "ALASKA", "ARIZONA", "ARKANSAS", "CALIFORNIA", "COLORADO",
  "CONNECTICUT", "DELAWARE", "FLORIDA", "GEORGIA", "HAWAII", "IDAHO",
  "ILLINOIS", "INDIANA", "IOWA", "KANSAS", "KENTUCKY", "LOUISIANA",
  "MAINE", "MARYLAND", "MASSACHUSETTS", "MICHIGAN", "MINNESOTA",
  "MISSISSIPPI", "MISSOURI", "MONTANA", "NEBRASKA", "NEVADA",
  "NEWHAMPSHIRE", "NEWJERSEY", "NEWMEXICO", "NEWYORK", "NORTHCAROLINA",
  "NORTHDAKOTA", "OHIO", "OKLAHOMA", "OREGON", "PENNSYLVANIA",
  "RHODEISLAND", "SOUTHCAROLINA", "SOUTHDAKOTA", "TENNESSEE", "TEXAS",
  "UTAH", "VERMONT", "VIRGINIA", "WASHINGTON", "WESTVIRGINIA",
  "WISCONSIN", "WYOMING",
  // Common slogans / words seen on plates and frames
  "DMV", "USA", "THE", "STATE", "GARDEN", "SUNSHINE", "EMPIRE",
  "GOLDEN", "LONE", "STAR", "LAND", "ENCHANTMENT", "FIRST", "LIBERTY",
  "GREAT", "LAKES", "OCEAN", "GRANITE", "TREASURE", "EVERGREEN",
  "PEACH", "BEAUTIFUL", "FAMOUS", "POTATOES", "WILD", "WONDERFUL",
  "LIVE", "FREE", "DIE", "COM", "WWW", "DEALER",
]);

const MONTH_ABBR = new Set([
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]);

// Is this token almost certainly NOT a plate? (registration stickers, frame
// branding, bare years, state names, etc.)
function isJunkToken(c) {
  if (!c) return true;
  if (NON_PLATE_TOKENS.has(c)) return true;
  if (MONTH_ABBR.has(c)) return true;
  // Bare 4-digit year (sticker), e.g. 2024–2029
  if (/^20\d{2}$/.test(c)) return true;
  // Pure-alpha tokens longer than 7 are almost always words, not plates
  if (/^[A-Z]{8,}$/.test(c)) return true;
  return false;
}

function scorePlate(t) {
  let s = 0;
  if (t.length >= 5 && t.length <= 8) s += 3;
  if (/[A-Z]/.test(t) && /[0-9]/.test(t)) s += 3;
  // Common US state layouts
  if (/^[A-Z]{3}[0-9]{3,4}$/.test(t)) s += 5;   // ABC1234 / ABC123
  if (/^[0-9][A-Z]{3}[0-9]{3}$/.test(t)) s += 5; // 7ABC123 (CA)
  if (/^[0-9]{1,4}[A-Z]{2,3}$/.test(t)) s += 4;
  if (/^[A-Z]{1,2}[0-9]{2,5}$/.test(t)) s += 4;
  if (/^[A-Z]{2}[0-9]{4,5}$/.test(t)) s += 4;
  // Mixed alnum at all, reasonable length — baseline so plain plates qualify
  if (t.length >= 5 && t.length <= 7 && /[A-Z]/.test(t) && /[0-9]/.test(t)) s += 1;
  return s;
}

// Glyph-normalization: collapse OCR-confusable characters to a single canonical
// form so the SAME physical plate read slightly differently across frames maps
// to one key. Used ONLY for grouping/counting — never shown to the user.
function normalizeGlyphs(c) {
  return c
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/D/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/B/g, "8")
    .replace(/S/g, "5")
    .replace(/Z/g, "2")
    .replace(/G/g, "6")
    .replace(/T/g, "7");
}

// Pull every plate-shaped candidate out of one OCR result. Returns an array of
// { t (raw cleaned), s (score) }. Includes recombined adjacent tokens so plates
// split across lines/blocks (e.g. "ABC" + "1234") are recovered.
function extractCandidates(result) {
  const cands = [];
  const seen = new Set();

  const tryAdd = (raw) => {
    const c = cleanPlate(raw);
    if (!PLATE_RE.test(c)) return;
    if (isJunkToken(c)) return;
    if (seen.has(c)) return;
    seen.add(c);
    cands.push({ t: c, s: scorePlate(c) });
  };

  // Also feed cleaned fragments that are individually too short/long but might
  // recombine into a valid plate with a neighbor.
  const fragments = [];
  const pushFragment = (raw) => {
    const c = cleanPlate(raw);
    if (c && c.length >= 1 && c.length <= 8) fragments.push(c);
  };

  const handleLineGroup = (texts) => {
    // Single tokens
    for (const txt of texts) {
      tryAdd(txt);
      txt.split(/\s+/).forEach((w) => { tryAdd(w); pushFragment(w); });
    }
    // Recombine adjacent fragments (handles "ABC" + "1234", "ABC" + "-" + "123")
    const flat = [];
    for (const txt of texts) {
      for (const w of txt.split(/\s+/)) {
        const c = cleanPlate(w);
        if (c) flat.push(c);
      }
    }
    for (let i = 0; i < flat.length - 1; i++) {
      const combo2 = flat[i] + flat[i + 1];
      if (combo2.length <= 8) tryAdd(combo2);
      if (i < flat.length - 2) {
        const combo3 = flat[i] + flat[i + 1] + flat[i + 2];
        if (combo3.length <= 8) tryAdd(combo3);
      }
    }
  };

  if (result?.blocks) {
    for (const block of result.blocks) {
      const texts = [block.text];
      if (block.lines) for (const line of block.lines) texts.push(line.text);
      handleLineGroup(texts);
    }
    // Cross-block recombination: blocks can split the two halves of a plate.
    const blockClean = result.blocks
      .map((b) => cleanPlate(b.text))
      .filter((c) => c && c.length <= 8 && !isJunkToken(c));
    for (let i = 0; i < blockClean.length - 1; i++) {
      const combo = blockClean[i] + blockClean[i + 1];
      if (combo.length <= 8) tryAdd(combo);
    }
  }

  if (result?.text) {
    result.text.split(/\s+/).forEach((w) => { tryAdd(w); pushFragment(w); });
  }

  return cands;
}

const CONFIRM = 3;          // times a plate must be seen within the window
const WINDOW = 6;           // rolling window of recent frames considered
const COOLDOWN = 400;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize knownPlates prop into a Set of cleaned strings */
function buildKnownSet(knownPlates) {
  if (!knownPlates) return null;
  if (knownPlates instanceof Set) {
    const s = new Set();
    knownPlates.forEach((p) => s.add(cleanPlate(p)));
    return s.size > 0 ? s : null;
  }
  if (Array.isArray(knownPlates)) {
    const s = new Set(knownPlates.map(cleanPlate).filter(Boolean));
    return s.size > 0 ? s : null;
  }
  return null;
}

// Rolling-window vote tracker. Each frame pushes its best candidate (raw + key).
// We keep the last WINDOW entries and find the normalized key seen most often;
// once it hits CONFIRM, we surface the best-scoring raw spelling for that key.
function makeVoteTracker() {
  return {
    history: [], // [{ key, raw, score }]
    push(entry) {
      this.history.push(entry);
      if (this.history.length > WINDOW) this.history.shift();
    },
    // Returns { key, raw, count } for the leading REAL candidate, or null.
    // The empty-frame sentinel (raw === null) is ignored for winner selection —
    // it only exists to age real votes out of the window.
    leader() {
      if (this.history.length === 0) return null;
      const counts = new Map();   // key -> count
      const bestRaw = new Map();  // key -> { raw, score }
      for (const e of this.history) {
        if (e.raw == null) continue; // skip empty-frame markers
        counts.set(e.key, (counts.get(e.key) || 0) + 1);
        const cur = bestRaw.get(e.key);
        if (!cur || e.score > cur.score) bestRaw.set(e.key, { raw: e.raw, score: e.score });
      }
      let bestKey = null, bestCount = 0;
      for (const [k, n] of counts) {
        if (n > bestCount) { bestCount = n; bestKey = k; }
      }
      if (bestKey == null) return null;
      return { key: bestKey, raw: bestRaw.get(bestKey).raw, count: bestCount };
    },
    reset() { this.history = []; },
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const PlateScanner = memo(({ visible, onPlateScanned, onClose, onManualEntry, knownPlates }) => {
  const [perm, reqPerm] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cam = useRef(null);
  const stop = useRef(false);
  const running = useRef(false);
  const votes = useRef(makeVoteTracker());

  const [phase, setPhase] = useState("start"); // start | scan | review
  const [frames, setFrames] = useState(0);
  const [rawText, setRawText] = useState(null);
  const [plate, setPlate] = useState(null);
  const [conf, setConf] = useState(0);
  const [final, setFinal] = useState(null);
  const [err, setErr] = useState(null);

  // Build known set once per render cycle
  const knownSet = useRef(null);
  useEffect(() => {
    knownSet.current = buildKnownSet(knownPlates);
  }, [knownPlates]);

  // Reset
  useEffect(() => {
    if (visible) {
      setPhase("start"); setFrames(0); setRawText(null);
      setPlate(null); setConf(0); setFinal(null); setErr(null);
      stop.current = false; running.current = false;
      votes.current.reset();
    } else {
      stop.current = true;
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !perm?.granted) reqPerm();
  }, [visible, perm]);

  // OCR loop
  const loop = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    stop.current = false;
    votes.current.reset();

    // Camera warmup
    await new Promise((r) => setTimeout(r, 700));
    if (stop.current) { running.current = false; return; }
    setPhase("scan");

    let f = 0;

    while (!stop.current) {
      f++;
      setFrames(f);

      try {
        if (!cam.current) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        const pic = await cam.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
          base64: false,
        });
        if (stop.current) break;

        let uri = pic.uri;
        if (Platform.OS === "android" && !uri.startsWith("file://")) {
          uri = `file://${uri}`;
        }

        const result = await TextRecognition.recognize(uri);
        if (stop.current) break;

        setRawText(result?.text || null);
        setErr(null);

        const candidates = extractCandidates(result);

        if (candidates.length > 0) {
          // Best candidate this frame (highest score; ties broken by length).
          candidates.sort((a, b) => (b.s - a.s) || (b.t.length - a.t.length));
          const best = candidates[0];

          // ── Fast path: any candidate matches a known plate → confirm now ──
          if (knownSet.current) {
            const hit = candidates.find((c) => knownSet.current.has(c.t));
            if (hit) {
              stop.current = true;
              try { Vibration.vibrate(40); } catch {}
              onPlateScanned?.(hit.t);
              break;
            }
          }

          // ── Vote: record this frame's best read under its normalized key ──
          votes.current.push({ key: normalizeGlyphs(best.t), raw: best.t, score: best.s });
          const leader = votes.current.leader();

          if (leader) {
            setPlate(leader.raw);
            setConf(Math.min(leader.count, CONFIRM));

            if (leader.count >= CONFIRM) {
              setFinal(leader.raw);
              try { Vibration.vibrate(40); } catch {}
              await new Promise((r) => setTimeout(r, 400));
              if (!stop.current) setPhase("review");
              break;
            }
          }
        } else {
          // No candidate this frame: push an empty marker so stale votes age
          // out of the window, but don't wipe progress instantly.
          votes.current.push({ key: "\u0000", raw: null, score: -1 });
          const leader = votes.current.leader();
          if (!leader || leader.raw == null) {
            setPlate(null);
            setConf(0);
          } else {
            setPlate(leader.raw);
            setConf(Math.min(leader.count, CONFIRM));
          }
        }
      } catch (e) {
        setErr(e?.message || "OCR error");
      }

      await new Promise((r) => setTimeout(r, COOLDOWN));
    }

    running.current = false;
  }, [onPlateScanned]);

  const rescan = useCallback(() => {
    setPhase("scan"); setPlate(null); setConf(0);
    setFinal(null); setFrames(0); setErr(null);
    stop.current = false; running.current = false;
    votes.current.reset();
    setTimeout(loop, 200);
  }, [loop]);

  const close = useCallback(() => { stop.current = true; onClose?.(); }, [onClose]);
  const manual = useCallback(() => { stop.current = true; onManualEntry?.(); }, [onManualEntry]);
  const confirm = useCallback(() => { if (final) onPlateScanned?.(final); }, [final, onPlateScanned]);
  const forceUse = useCallback(() => {
    if (!plate) return;
    stop.current = true;
    setFinal(plate);
    setPhase("review");
  }, [plate]);

  if (!visible) return null;

  // Status line
  let statusIcon = "magnify", statusMsg = "Scanning…", statusColor = "#8e8e93", spinning = true;
  if (phase === "start") { statusMsg = "Starting camera…"; }
  else if (err) { statusIcon = "alert-circle-outline"; statusMsg = err; statusColor = "#ff453a"; spinning = false; }
  else if (plate) { statusIcon = "car"; statusMsg = `Detected: ${plate}`; statusColor = "#64d2ff"; }
  else if (frames > 0) { statusMsg = `Scanning… frame ${frames}`; statusColor = "#fff"; }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={st.root}>

        <CameraView
          ref={cam}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={loop}
        />

        {/* ── Top ── */}
        <View style={[st.topSection, { paddingTop: insets.top + 8 }]}>
          <View style={st.navRow}>
            <TouchableOpacity style={st.navBtn} onPress={close} activeOpacity={0.7}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={st.navTitle}>Scan license plate</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={st.statusPill}>
            {spinning
              ? <ActivityIndicator size={14} color={statusColor} />
              : <Icon name={statusIcon} size={14} color={statusColor} />}
            <Text style={[st.statusText, { color: statusColor }]}>{statusMsg}</Text>
          </View>
        </View>

        {/* ── Viewfinder ── */}
        <View style={st.finderWrap}>
          <View style={[
            st.finder,
            plate && { borderColor: conf >= CONFIRM ? "#30d158" : "#64d2ff" },
          ]}>
            <View style={[st.c, st.cTL]} />
            <View style={[st.c, st.cTR]} />
            <View style={[st.c, st.cBL]} />
            <View style={[st.c, st.cBR]} />
          </View>
        </View>

        {/* ── Bottom ── */}
        <View style={[st.bottomSection, { paddingBottom: insets.bottom + 12 }]}>

          {/* Feedback area */}
          <View style={st.feedbackArea}>
            {phase === "scan" && plate ? (
              <View style={st.plateCard}>
                <Text style={st.plateLabel}>DETECTED</Text>
                <Text style={st.plateValue}>{plate}</Text>
                <View style={st.dots}>
                  {Array.from({ length: CONFIRM }).map((_, i) => (
                    <View key={i} style={[st.dot, i < conf && st.dotOn]} />
                  ))}
                  <Text style={st.dotLabel}>{conf}/{CONFIRM}</Text>
                </View>
              </View>
            ) : phase === "scan" && rawText ? (
              <View style={st.hintCard}>
                <Icon name="text-recognition" size={16} color="rgba(255,255,255,0.35)" />
                <Text style={st.hintText} numberOfLines={2}>
                  Reading text but no plate found yet
                </Text>
              </View>
            ) : phase === "scan" && frames > 3 ? (
              <View style={st.hintCard}>
                <Icon name="eye-off-outline" size={16} color="rgba(255,255,255,0.35)" />
                <Text style={st.hintText}>No text visible — move closer or adjust angle</Text>
              </View>
            ) : (
              <View style={st.hintCard}>
                <Icon name="crop-free" size={16} color="rgba(255,255,255,0.35)" />
                <Text style={st.hintText}>Position plate inside the frame above</Text>
              </View>
            )}
          </View>

          {/* Action button */}
          {phase !== "review" && (
            <TouchableOpacity
              style={[st.actionBtn, !plate && st.actionBtnOff]}
              onPress={forceUse}
              disabled={!plate}
              activeOpacity={0.8}
            >
              {plate ? (
                <>
                  <Icon name="check" size={20} color="#fff" />
                  <Text style={st.actionBtnText}>Use "{plate}"</Text>
                </>
              ) : (
                <Text style={st.actionBtnTextOff}>Waiting for plate…</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Manual entry */}
          {onManualEntry && phase !== "review" && (
            <TouchableOpacity style={st.manualRow} onPress={manual} activeOpacity={0.7}>
              <Icon name="keyboard-outline" size={14} color="rgba(255,255,255,0.45)" />
              <Text style={st.manualText}>Type plate manually</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Review ── */}
        {phase === "review" && final && (
          <View style={st.reviewOverlay}>
            <View style={[st.reviewSheet, { paddingBottom: insets.bottom + 24 }]}>
              <View style={st.reviewHandle} />

              <View style={st.reviewTop}>
                <View style={st.checkCircle}>
                  <Icon name="check" size={22} color="#fff" />
                </View>
                <Text style={st.reviewHeading}>Plate captured</Text>
              </View>

              <View style={st.reviewPlateRow}>
                <Text style={st.reviewPlateText}>{final}</Text>
              </View>

              <Text style={st.reviewQuestion}>Does this look correct?</Text>

              <View style={st.reviewBtns}>
                <TouchableOpacity style={st.btnSecondary} onPress={rescan} activeOpacity={0.7}>
                  <Icon name="refresh" size={18} color="#fff" />
                  <Text style={st.btnSecondaryText}>Rescan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.btnPrimary} onPress={confirm} activeOpacity={0.8}>
                  <Text style={st.btnPrimaryText}>Confirm</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {onManualEntry && (
                <TouchableOpacity style={st.reviewManual} onPress={manual} activeOpacity={0.7}>
                  <Text style={st.reviewManualText}>Enter a different plate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  topSection: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
  },
  navTitle: { fontSize: 15, fontWeight: "600", color: "#fff" },
  statusPill: {
    flexDirection: "row", alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginBottom: 16,
  },
  statusText: { fontSize: 13, fontWeight: "600", marginLeft: 8 },

  finderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  finder: {
    width: "84%", aspectRatio: 3.2,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", borderRadius: 14,
  },
  c: { position: "absolute", width: 22, height: 22, borderColor: "#fff", borderWidth: 3 },
  cTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
  cTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
  cBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
  cBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },

  bottomSection: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  feedbackArea: { marginBottom: 16 },
  plateCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(100,210,255,0.25)",
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
  },
  plateLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)", marginBottom: 4,
  },
  plateValue: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: 4 },
  dots: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", marginRight: 6 },
  dotOn: { backgroundColor: "#30d158" },
  dotLabel: { fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: 4 },
  hintCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  hintText: { fontSize: 13, color: "rgba(255,255,255,0.4)", flex: 1, marginLeft: 10 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#147efb", borderRadius: 14,
    paddingVertical: 16, marginBottom: 4,
  },
  actionBtnOff: { backgroundColor: "rgba(255,255,255,0.06)" },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", marginLeft: 10 },
  actionBtnTextOff: { fontSize: 15, color: "rgba(255,255,255,0.2)" },
  manualRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12,
  },
  manualText: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginLeft: 6 },

  reviewOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  reviewSheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 24,
    alignItems: "center",
  },
  reviewHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)", marginBottom: 20,
  },
  reviewTop: { alignItems: "center", marginBottom: 20 },
  checkCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#30d158",
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  reviewHeading: { fontSize: 18, fontWeight: "700", color: "#fff" },
  reviewPlateRow: {
    backgroundColor: "rgba(48,209,88,0.06)",
    borderWidth: 1.5, borderColor: "rgba(48,209,88,0.25)",
    borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 16, marginBottom: 8,
  },
  reviewPlateText: { fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: 5 },
  reviewQuestion: { fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 24 },
  reviewBtns: { flexDirection: "row", width: "100%" },
  btnSecondary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, borderRadius: 14, marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  btnSecondaryText: { fontSize: 15, fontWeight: "600", color: "#fff", marginLeft: 8 },
  btnPrimary: {
    flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: "#30d158",
  },
  btnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff", marginRight: 8 },
  reviewManual: { marginTop: 16, paddingVertical: 8 },
  reviewManualText: { fontSize: 13, color: "rgba(255,255,255,0.3)" },
});

export default PlateScanner;