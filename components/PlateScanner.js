/**
 * PlateScanner — license plate scanner
 *
 * Key UX principles:
 *   - Always show what the system is doing (scanning, processing, found)
 *   - Show a visible activity indicator on every OCR cycle
 *   - Degrade gracefully: if OCR finds nothing, say so clearly
 *   - Let user override at any time with manual entry
 *
 * Props:
 *   visible        – boolean
 *   onPlateScanned – (plate: string) => void
 *   onClose        – () => void
 *   onManualEntry  – () => void (optional)
 */

import React, {
  useState, useEffect, useCallback, useRef, memo,
} from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Dimensions, Platform, ActivityIndicator, Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import MlkitOcr from "react-native-mlkit-ocr";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Detection ────────────────────────────────────────────────────────────────

function cleanPlate(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

const PLATE_RE = /^[A-Z0-9]{4,8}$/;

function scorePlate(t) {
  let s = 0;
  if (t.length >= 5 && t.length <= 8) s += 3;
  if (/[A-Z]/.test(t) && /[0-9]/.test(t)) s += 3;
  if (/^[A-Z]{3}[0-9]{4}$/.test(t)) s += 5;
  if (/^[0-9]{1,4}[A-Z]{2,3}$/.test(t)) s += 4;
  if (/^[A-Z]{1,2}[0-9]{2,4}[A-Z]{1,2}$/.test(t)) s += 4;
  return s;
}

function extractPlate(blocks) {
  const cands = [];
  const tryC = (raw) => {
    const c = cleanPlate(raw);
    if (PLATE_RE.test(c)) cands.push({ text: c, score: scorePlate(c) });
  };
  for (const b of blocks) {
    tryC(b.text);
    if (b.lines) b.lines.forEach((l) => tryC(l.text));
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  return cands[0].score >= 3 ? cands[0].text : null;
}

// ── State machine ────────────────────────────────────────────────────────────
//
//  STARTING  → camera warming up
//  SCANNING  → actively taking photos and running OCR each cycle
//  FOUND     → same plate seen N times, auto-confirmed
//  REVIEWING → showing result, waiting for user confirm/rescan
//
// Every cycle in SCANNING updates `frameCount` so the user can see it ticking.

const CONFIRM_AFTER = 3;
const COOLDOWN_MS = 400;

// ── Component ────────────────────────────────────────────────────────────────

const PlateScanner = memo(({ visible, onPlateScanned, onClose, onManualEntry }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef(null);
  const cancelRef = useRef(false);
  const runRef = useRef(false);

  const [status, setStatus] = useState("starting");
  const [frameCount, setFrameCount] = useState(0);
  const [lastOcrText, setLastOcrText] = useState(null); // raw OCR text for debug
  const [bestPlate, setBestPlate] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [confirmed, setConfirmed] = useState(null);
  const [ocrError, setOcrError] = useState(null);

  // ── Reset ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setStatus("starting");
      setFrameCount(0);
      setLastOcrText(null);
      setBestPlate(null);
      setConfidence(0);
      setConfirmed(null);
      setOcrError(null);
      cancelRef.current = false;
      runRef.current = false;
    } else {
      cancelRef.current = true;
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
  }, [visible, permission]);

  // ── OCR loop ───────────────────────────────────────────────────────────────

  const startOcr = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    cancelRef.current = false;

    // Camera warmup
    await new Promise((r) => setTimeout(r, 800));
    if (cancelRef.current) { runRef.current = false; return; }
    setStatus("scanning");

    let consec = { plate: null, count: 0 };
    let frames = 0;

    while (!cancelRef.current) {
      frames++;
      setFrameCount(frames);

      try {
        if (!camRef.current) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        const photo = await camRef.current.takePictureAsync({
          quality: 0.6,
          base64: false,
          skipProcessing: false,
        });
        if (cancelRef.current) break;

        const blocks = await MlkitOcr.detectFromUri(photo.uri);
        if (cancelRef.current) break;

        // Show what OCR actually sees (for user transparency)
        const allText = blocks.map((b) => b.text).join(" ");
        setLastOcrText(allText || null);
        setOcrError(null);

        const plate = extractPlate(blocks);

        if (plate) {
          if (consec.plate === plate) {
            consec.count++;
          } else {
            consec = { plate, count: 1 };
          }

          setBestPlate(plate);
          setConfidence(Math.min(consec.count, CONFIRM_AFTER));

          if (consec.count >= CONFIRM_AFTER) {
            setStatus("found");
            setConfirmed(plate);
            try { Vibration.vibrate(40); } catch {}
            // Brief pause to show "found" state, then move to review
            await new Promise((r) => setTimeout(r, 500));
            if (!cancelRef.current) setStatus("reviewing");
            break;
          }
        } else {
          // Gradual decay
          consec.count = Math.max(0, consec.count - 1);
          setConfidence(consec.count);
          if (consec.count === 0) setBestPlate(null);
        }
      } catch (err) {
        setOcrError(err?.message || "OCR failed");
      }

      await new Promise((r) => setTimeout(r, COOLDOWN_MS));
    }

    runRef.current = false;
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (confirmed) onPlateScanned?.(confirmed);
  }, [confirmed, onPlateScanned]);

  const handleRescan = useCallback(() => {
    setStatus("scanning");
    setBestPlate(null);
    setConfidence(0);
    setConfirmed(null);
    setFrameCount(0);
    setOcrError(null);
    cancelRef.current = false;
    runRef.current = false;
    setTimeout(() => startOcr(), 200);
  }, [startOcr]);

  const handleClose = useCallback(() => {
    cancelRef.current = true;
    onClose?.();
  }, [onClose]);

  const handleManual = useCallback(() => {
    cancelRef.current = true;
    onManualEntry?.();
  }, [onManualEntry]);

  const handleForceUse = useCallback(() => {
    if (!bestPlate) return;
    cancelRef.current = true;
    setConfirmed(bestPlate);
    setStatus("reviewing");
  }, [bestPlate]);

  // ── Status bar content ─────────────────────────────────────────────────────

  const getStatusContent = () => {
    switch (status) {
      case "starting":
        return { icon: null, text: "Starting camera…", color: "#8e8e93", showSpinner: true };
      case "scanning":
        if (ocrError) {
          return { icon: "alert-circle-outline", text: `Error: ${ocrError}`, color: "#ff453a", showSpinner: false };
        }
        if (bestPlate) {
          return { icon: "car", text: `Reading: ${bestPlate}`, color: "#64d2ff", showSpinner: true };
        }
        return { icon: "magnify", text: `Scanning… (frame ${frameCount})`, color: "#fff", showSpinner: true };
      case "found":
        return { icon: "check-circle", text: `Found: ${confirmed}`, color: "#30d158", showSpinner: false };
      case "reviewing":
        return { icon: "check-circle", text: "Confirm below", color: "#30d158", showSpinner: false };
      default:
        return { icon: "magnify", text: "Scanning…", color: "#fff", showSpinner: true };
    }
  };

  if (!visible) return null;

  const statusContent = getStatusContent();
  const frameX = (SW - SW * 0.84) / 2;
  const frameW = SW * 0.84;
  const frameH = SW * 0.28;
  const frameY = SH * 0.30;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={st.root}>

        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={startOcr}
        />

        {/* Dim overlay */}
        <View style={[st.dim, { top: 0, height: frameY }]} />
        <View style={[st.dim, { top: frameY, left: 0, width: frameX, height: frameH }]} />
        <View style={[st.dim, { top: frameY, right: 0, width: frameX, height: frameH }]} />
        <View style={[st.dim, { top: frameY + frameH, bottom: 0 }]} />

        {/* Frame */}
        <View
          style={[
            st.frame,
            { top: frameY, left: frameX, width: frameW, height: frameH },
            bestPlate && { borderColor: confidence >= CONFIRM_AFTER ? "#30d158" : "#64d2ff" },
          ]}
        >
          <View style={[st.bracket, st.brTL]} />
          <View style={[st.bracket, st.brTR]} />
          <View style={[st.bracket, st.brBL]} />
          <View style={[st.bracket, st.brBR]} />
        </View>

        {/* ── Top bar ── */}
        <View style={st.topBar}>
          <TouchableOpacity style={st.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Scan plate</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ── Status bar — always visible, always shows what's happening ── */}
        <View style={[st.statusBar, { top: frameY - 52 }]}>
          {statusContent.showSpinner && (
            <ActivityIndicator size="small" color={statusContent.color} style={{ marginRight: 8 }} />
          )}
          {statusContent.icon && !statusContent.showSpinner && (
            <Icon name={statusContent.icon} size={16} color={statusContent.color} style={{ marginRight: 8 }} />
          )}
          <Text style={[st.statusText, { color: statusContent.color }]}>
            {statusContent.text}
          </Text>
        </View>

        {/* ── Plate display (below frame, only when we have something) ── */}
        {status === "scanning" && bestPlate && (
          <View style={[st.plateBox, { top: frameY + frameH + 16 }]}>
            <Text style={st.plateText}>{bestPlate}</Text>
            {/* Simple confidence indicator */}
            <View style={st.confRow}>
              {Array.from({ length: CONFIRM_AFTER }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    st.confDot,
                    i < confidence ? st.confDotActive : null,
                  ]}
                />
              ))}
              <Text style={st.confLabel}>
                {confidence}/{CONFIRM_AFTER} confirmed
              </Text>
            </View>
          </View>
        )}

        {/* ── OCR debug line — shows raw text so user knows OCR is working ── */}
        {status === "scanning" && !bestPlate && lastOcrText && (
          <View style={[st.debugBox, { top: frameY + frameH + 16 }]}>
            <Icon name="text-recognition" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={st.debugText} numberOfLines={2}>
              Seeing: "{lastOcrText}"
            </Text>
          </View>
        )}

        {/* ── No text at all indicator ── */}
        {status === "scanning" && !bestPlate && !lastOcrText && frameCount > 3 && (
          <View style={[st.debugBox, { top: frameY + frameH + 16 }]}>
            <Icon name="eye-off-outline" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={st.debugText}>
              No text detected — try moving closer or adjusting angle
            </Text>
          </View>
        )}

        {/* ── Bottom controls ── */}
        {(status === "scanning" || status === "starting") && (
          <View style={st.bottomBar}>
            <TouchableOpacity
              style={[st.mainBtn, !bestPlate && st.mainBtnDisabled]}
              onPress={handleForceUse}
              disabled={!bestPlate}
              activeOpacity={0.8}
            >
              {bestPlate ? (
                <>
                  <Icon name="check" size={20} color="#fff" />
                  <Text style={st.mainBtnText}>Use "{bestPlate}"</Text>
                </>
              ) : (
                <Text style={st.mainBtnTextDisabled}>Waiting for plate…</Text>
              )}
            </TouchableOpacity>

            {onManualEntry && (
              <TouchableOpacity style={st.manualBtn} onPress={handleManual} activeOpacity={0.7}>
                <Icon name="keyboard-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={st.manualBtnText}>Type manually instead</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Review screen ── */}
        {status === "reviewing" && confirmed && (
          <View style={st.reviewBg}>
            <View style={st.reviewCard}>
              <View style={st.reviewBadge}>
                <Icon name="check" size={24} color="#fff" />
              </View>

              <Text style={st.reviewTitle}>Plate captured</Text>

              <View style={st.reviewPlateContainer}>
                <Text style={st.reviewPlate}>{confirmed}</Text>
              </View>

              <Text style={st.reviewSub}>Is this correct?</Text>

              <View style={st.reviewBtns}>
                <TouchableOpacity style={st.rescanBtn} onPress={handleRescan} activeOpacity={0.7}>
                  <Icon name="refresh" size={18} color="#fff" />
                  <Text style={st.rescanBtnText}>Rescan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                  <Text style={st.confirmBtnText}>Confirm</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {onManualEntry && (
                <TouchableOpacity style={st.reviewManualBtn} onPress={handleManual} activeOpacity={0.7}>
                  <Text style={st.reviewManualText}>Enter different plate</Text>
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

  dim: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" },

  frame: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 14,
  },
  bracket: { position: "absolute", width: 24, height: 24, borderColor: "#fff", borderWidth: 3 },
  brTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
  brTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
  brBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
  brBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 58 : 36,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center",
  },
  topTitle: { fontSize: 16, fontWeight: "600", color: "#fff" },

  // Status bar — the most important UI element
  statusBar: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: { fontSize: 13, fontWeight: "600" },

  // Plate display
  plateBox: {
    position: "absolute", alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(100,210,255,0.3)",
  },
  plateText: {
    fontSize: 32, fontWeight: "800", color: "#fff",
    letterSpacing: 4,
  },
  confRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8,
  },
  confDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  confDotActive: {
    backgroundColor: "#30d158",
  },
  confLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
    marginLeft: 4,
  },

  // Debug/transparency info
  debugBox: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
    maxWidth: SW * 0.8,
  },
  debugText: {
    fontSize: 12, color: "rgba(255,255,255,0.35)",
    flex: 1,
  },

  // Bottom
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 44 : 24,
    paddingHorizontal: 20,
  },
  mainBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10,
    backgroundColor: "#147efb",
    paddingVertical: 16, borderRadius: 14,
    width: "100%",
  },
  mainBtnDisabled: { backgroundColor: "rgba(255,255,255,0.06)" },
  mainBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  mainBtnTextDisabled: { fontSize: 15, fontWeight: "500", color: "rgba(255,255,255,0.25)" },
  manualBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 14, paddingVertical: 4,
  },
  manualBtnText: { fontSize: 13, color: "rgba(255,255,255,0.4)" },

  // Review
  reviewBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center", alignItems: "center",
    padding: 24,
  },
  reviewCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 24, padding: 28, width: "100%",
    alignItems: "center",
  },
  reviewBadge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#30d158",
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
  },
  reviewTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 20 },
  reviewPlateContainer: {
    backgroundColor: "rgba(48,209,88,0.08)",
    borderWidth: 2, borderColor: "rgba(48,209,88,0.3)",
    borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 16,
    marginBottom: 10,
  },
  reviewPlate: {
    fontSize: 36, fontWeight: "800", color: "#fff",
    letterSpacing: 5,
  },
  reviewSub: { fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 22 },
  reviewBtns: { flexDirection: "row", gap: 10, width: "100%" },
  rescanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rescanBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  confirmBtn: {
    flex: 1.6, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "#30d158",
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  reviewManualBtn: { marginTop: 14, paddingVertical: 6 },
  reviewManualText: { fontSize: 13, color: "rgba(255,255,255,0.3)", textDecorationLine: "underline" },
});

export default PlateScanner;