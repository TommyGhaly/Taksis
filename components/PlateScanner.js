/**
 * PlateScanner — license plate scanner with bank check-deposit UX
 *
 * Flow:
 *   1. SCANNING  — live camera with guided viewfinder, real-time status
 *   2. LOCKING   — plate detected, progress ring fills as confidence builds
 *   3. REVIEWING — auto-captured plate shown on card for confirm/rescan
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
  Animated, Dimensions, Platform, Easing, Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import MlkitOcr from "react-native-mlkit-ocr";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Plate detection ──────────────────────────────────────────────────────────

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
  return cands[0].score >= 3 ? cands[0] : null;
}

// ── Guidance ─────────────────────────────────────────────────────────────────

const GUIDE = {
  init:    { msg: "Initializing camera…",           icon: "camera-outline",              color: "#8e8e93" },
  searching: { msg: "Point at a license plate",       icon: "viewfinder",                  color: "#fff"    },
  noPlate: { msg: "No plate found — try a new angle", icon: "rotate-3d-variant",            color: "#ff9f0a" },
  tooFar:  { msg: "Move closer to the plate",         icon: "magnify-plus-outline",        color: "#ff9f0a" },
  reading: { msg: "Reading plate — hold steady",      icon: "image-filter-center-focus",   color: "#64d2ff" },
  locking: { msg: "Locking on — don't move",           icon: "crosshairs-gps",              color: "#30d158" },
  done:    { msg: "Plate captured!",                    icon: "check-circle",                color: "#30d158" },
};

function getGuidance(blocks, candidate, consecutive) {
  if (!blocks || blocks.length === 0) return GUIDE.searching;
  if (blocks.length > 15 && !candidate) return GUIDE.tooFar;
  if (!candidate) return GUIDE.noPlate;
  if (consecutive >= 2) return GUIDE.locking;
  return GUIDE.reading;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONFIRM_FRAMES = 3;
const COOLDOWN = 350;
const WARMUP = 700;
const FRAME_W = SW * 0.84;
const FRAME_H = SW * 0.28;
const FRAME_Y = SH * 0.30;
const FRAME_X = (SW - FRAME_W) / 2;

// ── Component ────────────────────────────────────────────────────────────────

const PlateScanner = memo(({ visible, onPlateScanned, onClose, onManualEntry }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef(null);
  const cancelRef = useRef(false);
  const runRef = useRef(false);

  const [phase, setPhase] = useState("scanning"); // scanning | reviewing
  const [guide, setGuide] = useState(GUIDE.init);
  const [livePlate, setLivePlate] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [confirmed, setConfirmed] = useState(null);

  // Animations
  const ringProgress = useRef(new Animated.Value(0)).current;
  const frameScale = useRef(new Animated.Value(1)).current;
  const frameBorderAnim = useRef(new Animated.Value(0)).current;
  const plateSlide = useRef(new Animated.Value(20)).current;
  const plateOpacity = useRef(new Animated.Value(0)).current;
  const reviewScale = useRef(new Animated.Value(0.9)).current;
  const reviewOpacity = useRef(new Animated.Value(0)).current;
  const scanLineY = useRef(new Animated.Value(0)).current;

  // ── Reset on open ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setPhase("scanning");
      setLivePlate(null);
      setConfidence(0);
      setConfirmed(null);
      setGuide(GUIDE.init);
      cancelRef.current = false;
      runRef.current = false;
      ringProgress.setValue(0);
      frameScale.setValue(1);
      frameBorderAnim.setValue(0);
      plateSlide.setValue(20);
      plateOpacity.setValue(0);
      reviewScale.setValue(0.9);
      reviewOpacity.setValue(0);
      scanLineY.setValue(0);
      startScanLineLoop();
    } else {
      cancelRef.current = true;
    }
  }, [visible]);

  // ── Scan line animation (the horizontal sweep inside the frame) ────────────

  const startScanLineLoop = useCallback(() => {
    const loop = () => {
      scanLineY.setValue(0);
      Animated.timing(scanLineY, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) loop(); });
    };
    loop();
  }, [scanLineY]);

  // ── Animate plate appearing ────────────────────────────────────────────────

  const animatePlateIn = useCallback(() => {
    plateSlide.setValue(20);
    plateOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(plateSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(plateOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [plateSlide, plateOpacity]);

  // ── Animate confidence ring ────────────────────────────────────────────────

  useEffect(() => {
    Animated.timing(ringProgress, {
      toValue: confidence / CONFIRM_FRAMES,
      duration: 150,
      useNativeDriver: false,
    }).start();

    // Frame border color
    Animated.timing(frameBorderAnim, {
      toValue: confidence / CONFIRM_FRAMES,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [confidence]);

  const frameBorderColor = frameBorderAnim.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: ["rgba(255,255,255,0.3)", "#64d2ff", "#30d158", "#30d158"],
  });

  // ── Animate review card ────────────────────────────────────────────────────

  const animateReviewIn = useCallback(() => {
    reviewScale.setValue(0.9);
    reviewOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(reviewScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.timing(reviewOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [reviewScale, reviewOpacity]);

  // ── Frame pulse on lock ────────────────────────────────────────────────────

  const pulseFrame = useCallback(() => {
    Animated.sequence([
      Animated.timing(frameScale, { toValue: 1.02, duration: 100, useNativeDriver: true }),
      Animated.timing(frameScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [frameScale]);

  // ── Permission ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
  }, [visible, permission]);

  // ── OCR loop ───────────────────────────────────────────────────────────────

  const startOcr = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    cancelRef.current = false;

    let consec = { plate: null, count: 0 };
    await new Promise((r) => setTimeout(r, WARMUP));
    setGuide(GUIDE.searching);

    while (!cancelRef.current) {
      try {
        if (!camRef.current) {
          await new Promise((r) => setTimeout(r, 200));
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

        const cand = extractPlate(blocks);
        const g = getGuidance(blocks, cand, consec.count);
        setGuide(g);

        if (cand) {
          if (consec.plate === cand.text) {
            consec.count += 1;
          } else {
            consec = { plate: cand.text, count: 1 };
          }

          setLivePlate(cand.text);
          setConfidence(Math.min(consec.count, CONFIRM_FRAMES));

          if (consec.count === 1) animatePlateIn();
          if (consec.count === 2) pulseFrame();

          if (consec.count >= CONFIRM_FRAMES) {
            // Auto-capture
            setGuide(GUIDE.done);
            setConfirmed(cand.text);
            try { Vibration.vibrate(50); } catch {}
            setTimeout(() => {
              setPhase("reviewing");
              animateReviewIn();
            }, 400);
            break;
          }
        } else {
          consec.count = Math.max(0, consec.count - 1);
          setConfidence(Math.max(0, consec.count));
          if (consec.count === 0) {
            // Don't immediately clear — give user a moment
            setTimeout(() => {
              if (consec.count === 0) setLivePlate(null);
            }, 600);
          }
        }
      } catch {
        // Frame drop — continue
      }

      await new Promise((r) => setTimeout(r, COOLDOWN));
    }

    runRef.current = false;
  }, [animatePlateIn, animateReviewIn, pulseFrame]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (confirmed && onPlateScanned) onPlateScanned(confirmed);
  }, [confirmed, onPlateScanned]);

  const handleRescan = useCallback(() => {
    setPhase("scanning");
    setLivePlate(null);
    setConfidence(0);
    setConfirmed(null);
    setGuide(GUIDE.searching);
    ringProgress.setValue(0);
    frameBorderAnim.setValue(0);
    cancelRef.current = false;
    runRef.current = false;
    setTimeout(() => startOcr(), 300);
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
    if (!livePlate) return;
    cancelRef.current = true;
    setConfirmed(livePlate);
    setGuide(GUIDE.done);
    try { Vibration.vibrate(50); } catch {}
    setTimeout(() => {
      setPhase("reviewing");
      animateReviewIn();
    }, 200);
  }, [livePlate, animateReviewIn]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const scanLineTranslateY = scanLineY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_H - 4],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={st.root}>

        {/* Camera */}
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={startOcr}
        />

        {/* Dim overlay — 4 rects around the scan window */}
        <View style={[st.dim, { top: 0, height: FRAME_Y }]} />
        <View style={[st.dim, { top: FRAME_Y, left: 0, width: FRAME_X, height: FRAME_H }]} />
        <View style={[st.dim, { top: FRAME_Y, right: 0, width: FRAME_X, height: FRAME_H }]} />
        <View style={[st.dim, { top: FRAME_Y + FRAME_H, bottom: 0 }]} />

        {/* Scan frame */}
        <Animated.View
          style={[
            st.frame,
            { top: FRAME_Y, left: FRAME_X, width: FRAME_W, height: FRAME_H },
            { transform: [{ scale: frameScale }], borderColor: frameBorderColor },
          ]}
        >
          {/* Corner brackets */}
          <View style={[st.bracket, st.brTL]} />
          <View style={[st.bracket, st.brTR]} />
          <View style={[st.bracket, st.brBL]} />
          <View style={[st.bracket, st.brBR]} />

          {/* Scan line */}
          {phase === "scanning" && (
            <Animated.View
              style={[
                st.scanLine,
                { transform: [{ translateY: scanLineTranslateY }] },
                { backgroundColor: guide.color === "#30d158" ? "#30d158" : "#64d2ff" },
              ]}
            />
          )}
        </Animated.View>

        {/* ── Top bar ── */}
        <View style={st.topBar}>
          <TouchableOpacity style={st.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Scan plate</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ── Guidance pill ── */}
        <View style={[st.guidePill, { top: FRAME_Y - 52 }]}>
          <View style={[st.guideIconDot, { backgroundColor: guide.color + "20" }]}>
            <Icon name={guide.icon} size={16} color={guide.color} />
          </View>
          <Text style={[st.guideText, { color: guide.color }]}>{guide.msg}</Text>
        </View>

        {/* ── Live plate + confidence ── */}
        {phase === "scanning" && livePlate && (
          <Animated.View
            style={[
              st.liveContainer,
              { top: FRAME_Y + FRAME_H + 16 },
              { opacity: plateOpacity, transform: [{ translateY: plateSlide }] },
            ]}
          >
            <View style={st.liveInner}>
              <Text style={st.liveLabel}>DETECTED</Text>
              <Text style={st.livePlate}>{livePlate}</Text>
            </View>

            {/* Progress bar */}
            <View style={st.progressTrack}>
              <Animated.View
                style={[
                  st.progressFill,
                  {
                    width: ringProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={st.progressLabel}>
              {confidence < CONFIRM_FRAMES
                ? `Verifying… ${confidence}/${CONFIRM_FRAMES}`
                : "Confirmed!"}
            </Text>
          </Animated.View>
        )}

        {/* ── Bottom controls (scanning) ── */}
        {phase === "scanning" && (
          <View style={st.bottomBar}>
            <TouchableOpacity
              style={[st.useBtn, !livePlate && st.useBtnDisabled]}
              onPress={handleForceUse}
              disabled={!livePlate}
              activeOpacity={0.8}
            >
              <Icon name="check-bold" size={20} color={livePlate ? "#fff" : "rgba(255,255,255,0.3)"} />
              <Text style={[st.useBtnText, !livePlate && st.useBtnTextDisabled]}>
                {livePlate ? `Use "${livePlate}"` : "Waiting for plate…"}
              </Text>
            </TouchableOpacity>

            {onManualEntry && (
              <TouchableOpacity style={st.manualRow} onPress={handleManual} activeOpacity={0.7}>
                <Icon name="keyboard-outline" size={14} color="rgba(255,255,255,0.45)" />
                <Text style={st.manualText}>Type plate manually</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Review overlay ── */}
        {phase === "reviewing" && confirmed && (
          <View style={st.reviewBackdrop}>
            <Animated.View
              style={[
                st.reviewCard,
                { opacity: reviewOpacity, transform: [{ scale: reviewScale }] },
              ]}
            >
              {/* Success badge */}
              <View style={st.successBadge}>
                <Icon name="check-bold" size={20} color="#fff" />
              </View>

              <Text style={st.reviewTitle}>Plate captured</Text>

              {/* Plate display */}
              <View style={st.reviewPlateBox}>
                <Text style={st.reviewPlate}>{confirmed}</Text>
              </View>

              <Text style={st.reviewHint}>Does this look right?</Text>

              {/* Actions */}
              <View style={st.reviewActions}>
                <TouchableOpacity style={st.rescanBtn} onPress={handleRescan} activeOpacity={0.7}>
                  <Icon name="camera-retake-outline" size={18} color="#fff" />
                  <Text style={st.rescanText}>Rescan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                  <Text style={st.confirmText}>Confirm</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {onManualEntry && (
                <TouchableOpacity style={st.reviewManual} onPress={handleManual} activeOpacity={0.7}>
                  <Text style={st.reviewManualText}>Enter a different plate</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        )}

      </View>
    </Modal>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Dim overlay
  dim: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)" },

  // Scan frame
  frame: {
    position: "absolute",
    borderWidth: 2, borderRadius: 16,
    overflow: "hidden",
  },

  // Corner brackets
  bracket: {
    position: "absolute", width: 28, height: 28,
    borderColor: "#fff", borderWidth: 3,
  },
  brTL: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  brTR: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  brBL: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  brBR: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },

  // Scan line
  scanLine: {
    position: "absolute", left: 8, right: 8, height: 2,
    borderRadius: 1, opacity: 0.5,
  },

  // Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 58 : 36,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
  },
  topTitle: {
    fontSize: 16, fontWeight: "600", color: "#fff",
    letterSpacing: 0.3,
  },

  // Guidance pill
  guidePill: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingLeft: 6, paddingRight: 16, paddingVertical: 8,
    borderRadius: 24,
  },
  guideIconDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  guideText: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },

  // Live plate display
  liveContainer: {
    position: "absolute", alignSelf: "center",
    alignItems: "center",
    minWidth: 200,
  },
  liveInner: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14,
    borderRadius: 16, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  liveLabel: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: 4,
  },
  livePlate: {
    fontSize: 34, fontWeight: "800", color: "#fff",
    letterSpacing: 4, fontVariant: ["tabular-nums"],
  },

  // Progress bar
  progressTrack: {
    width: "100%", height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 10, overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 2,
    backgroundColor: "#30d158",
  },
  progressLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
    fontWeight: "500", marginTop: 6,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 48 : 28,
    paddingHorizontal: 24,
  },
  useBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#147efb",
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 28,
    width: "100%", justifyContent: "center",
  },
  useBtnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  useBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  useBtnTextDisabled: { color: "rgba(255,255,255,0.3)" },
  manualRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 16, paddingVertical: 4,
  },
  manualText: {
    fontSize: 13, color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },

  // Review
  reviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center", alignItems: "center",
    padding: 28,
  },
  reviewCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 28, padding: 32,
    width: "100%", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  successBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#30d158",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 20, fontWeight: "700", color: "#fff",
    marginBottom: 20,
  },
  reviewPlateBox: {
    backgroundColor: "rgba(48,209,88,0.08)",
    borderWidth: 2, borderColor: "rgba(48,209,88,0.4)",
    borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 18,
    marginBottom: 12,
  },
  reviewPlate: {
    fontSize: 38, fontWeight: "800", color: "#fff",
    letterSpacing: 5, fontVariant: ["tabular-nums"],
  },
  reviewHint: {
    fontSize: 14, color: "rgba(255,255,255,0.35)",
    marginBottom: 24,
  },
  reviewActions: { flexDirection: "row", gap: 12, width: "100%" },
  rescanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rescanText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  confirmBtn: {
    flex: 1.6, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
    backgroundColor: "#30d158",
  },
  confirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  reviewManual: { marginTop: 16, paddingVertical: 8 },
  reviewManualText: {
    fontSize: 13, color: "rgba(255,255,255,0.35)",
    textDecorationLine: "underline",
  },
});

export default PlateScanner;