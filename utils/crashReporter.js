// Crash reporting that does not wait for the next launch.
//
// Crashlytics writes a fatal report to disk and uploads it the next time the
// app opens. A Play reviewer whose app crashes rarely opens it again, so those
// reports never arrive. This module keeps a trail of what the user did, and
// when a JS error escapes it posts that trail and the raw stack to the
// report_crash function before letting the app die. Anything that could not be
// sent is kept on disk and retried on the next launch.
//
// Release stacks point into index.android.bundle / main.jsbundle; run
// scripts/crashes.py to map them back to source files.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getAuth } from "@react-native-firebase/auth";
import {
  getCrashlytics,
  log as crashlyticsLog,
  recordError,
  setAttribute,
} from "@react-native-firebase/crashlytics";

const REPORT_URL = "https://report-crash-hy6oofbihq-uc.a.run.app";
const PENDING_KEY = "crashReporter.pending";
const MAX_BREADCRUMBS = 60;
// Long enough for one POST on a slow network, short enough that a crashed app
// does not sit frozen in front of the user.
const SEND_TIMEOUT_MS = 3000;

const breadcrumbs = [];
let currentScreen = "";
let installed = false;

function appInfo() {
  const config = Constants.expoConfig ?? {};
  const constants = Platform.constants ?? {};
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: config.version ?? "",
    build: String(
      Platform.OS === "android"
        ? config.android?.versionCode ?? ""
        : config.ios?.buildNumber ?? ""
    ),
    device: [constants.Brand, constants.Model].filter(Boolean).join(" "),
    hermes: typeof HermesInternal === "object",
  };
}

// Records one step of what the user did. Kept in memory for our own report and
// sent to Crashlytics, which attaches its log to the next crash it uploads.
export function breadcrumb(message) {
  const line = `${new Date().toISOString()} ${message}`;
  breadcrumbs.push(line);
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  crashlyticsLog(getCrashlytics(), message);
}

export function setCurrentScreen(name) {
  if (!name || name === currentScreen) return;
  currentScreen = name;
  breadcrumb(`screen ${name}`);
  setAttribute(getCrashlytics(), "screen", name).catch(() => {});
}

function buildReport(error, { fatal, source, componentStack }) {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    message: `${err.name}: ${err.message}`,
    stack: err.stack ?? "",
    componentStack: componentStack ?? "",
    fatal: Boolean(fatal),
    source,
    screen: currentScreen,
    uid: getAuth().currentUser?.uid ?? "",
    breadcrumbs: [...breadcrumbs],
    occurredAt: new Date().toISOString(),
    ...appInfo(),
  };
}

async function post(report) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function savePending(report) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const pending = raw ? JSON.parse(raw) : [];
    pending.push(report);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-10)));
  } catch {
    // Nowhere left to put it; Crashlytics still has its own copy.
  }
}

async function sendPending() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const unsent = [];
    for (const report of JSON.parse(raw)) {
      if (!(await post({ ...report, delayed: true }))) unsent.push(report);
    }
    if (unsent.length) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(unsent));
    else await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Try again next launch.
  }
}

// Sends a report now, or saves it for the next launch if the send fails.
export async function reportError(error, options = {}) {
  const report = buildReport(error, options);
  if (!(await post(report))) await savePending(report);
}

// Called from the root error boundary: the app stays up, so this is non-fatal.
export function reportRenderError(error, componentStack) {
  if (error instanceof Error) {
    recordError(getCrashlytics(), error, "RenderError");
  }
  reportError(error, { fatal: false, source: "render", componentStack });
}

// Must run after getCrashlytics() so ours wraps Crashlytics' handler: we send
// first, then hand the error on for Crashlytics to record and the app to exit.
export function installCrashReporter() {
  if (installed) return;
  installed = true;

  const next = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, fatal) => {
    breadcrumb(`${fatal ? "fatal" : "error"} ${error?.message ?? error}`);
    reportError(error, { fatal, source: "global" }).finally(() =>
      next(error, fatal)
    );
  });

  breadcrumb(`launch ${JSON.stringify(appInfo())}`);
  sendPending();
}
