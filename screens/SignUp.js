import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet, View, Text, TextInput, Pressable, Alert, Image,
  Dimensions, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Animated,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithCredential,
  signOut,
} from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import { useUser } from "../UserContext";
import { IS_TABLET, makeAuthTabletStyles } from "../utils/authTabletStyles";
import {
  signInWithMicrosoftCode,
  describeAuthError,
} from "../utils/microsoftAuth";
import MicrosoftSignInModal from "../components/MicrosoftSignInModal";
import { setPendingAppleName } from "../utils/pendingAppleName";

const { width, height } = Dimensions.get("window");
const REFERENCE_WIDTH = 375;
const REFERENCE_HEIGHT = 812;
const scale = (size) => (width / REFERENCE_WIDTH) * size;
const verticalScale = (size) => (height / REFERENCE_HEIGHT) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

const FloatingInput = React.forwardRef(({
  label, value, onChangeText, secureTextEntry, showToggle, onToggleSecure,
  isSecureVisible, autoCapitalize, keyboardType, textContentType, error,
  onBlur, onFocus, returnKeyType, onSubmitEditing, blurOnSubmit, t, ...rest
}, ref) => {
  const [focused, setFocused] = useState(false);
  const animated = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: focused || value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [focused, value, animated]);

  const labelStyle = {
    position: "absolute",
    left: t ? t.labelLeft : scale(14),
    top: animated.interpolate({ inputRange: [0, 1], outputRange: t ? t.labelTop : [verticalScale(16), verticalScale(6)] }),
    fontSize: animated.interpolate({ inputRange: [0, 1], outputRange: t ? t.labelFont : [moderateScale(15), moderateScale(11)] }),
    color: animated.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,255,255,0.35)", "rgba(255,255,255,0.5)"] }),
  };

  const borderColor = error ? "#ff453a" : focused ? "#147efb" : "rgba(255,255,255,0.08)";

  return (
    <View style={[{ marginBottom: verticalScale(12) }, t && t.fieldWrap]}>
      <View style={[styles.inputWrap, t && t.inputWrap, { borderColor }]}>
        <Animated.Text style={labelStyle} pointerEvents="none">{label}</Animated.Text>
        <TextInput
          ref={ref} value={value} onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          autoCapitalize={autoCapitalize} keyboardType={keyboardType}
          textContentType={textContentType} autoCorrect={false}
          onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
          onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
          returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit} style={[styles.input, t && t.input]}
          placeholderTextColor="rgba(255,255,255,0.3)" {...rest}
        />
        {showToggle ? (
          <Pressable onPress={onToggleSecure} style={[styles.eyeBtn, t && t.eyeBtn]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={isSecureVisible ? "eye-off-outline" : "eye-outline"} size={t ? t.eyeSize : 20} color="rgba(255,255,255,0.35)" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={[styles.errorRow, t && t.errorRow]}>
          <Ionicons name="alert-circle" size={t ? t.errorIconSize : 12} color="#ff453a" />
          <Text style={[styles.errorText, t && t.errorText]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

const SignUp = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(null);
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirm: false });
  const [msVisible, setMsVisible] = useState(false);
  const { setSignUp } = useUser();

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const { width: winW, height: winH } = useWindowDimensions();
  const t = useMemo(
    () => (IS_TABLET ? makeAuthTabletStyles(winW, winH) : null),
    [winW, winH]
  );

  useEffect(() => { setSignUp(true); }, []);

  GoogleSignin.configure({
    webClientId: "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const validation = useMemo(() => {
    const errs = {};
    const trimmed = name.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (touched.name) {
      if (!trimmed) errs.name = "Required";
      else if (words.length < 2) errs.name = "Enter your first and last name";
    }
    if (touched.email) {
      if (!email) errs.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    }
    if (touched.password) {
      if (!password) errs.password = "Required";
      else if (password.length < 8) errs.password = "At least 8 characters";
    }
    if (touched.confirm) {
      if (!confirmPassword) errs.confirm = "Required";
      else if (confirmPassword !== password) errs.confirm = "Passwords don't match";
    }
    return errs;
  }, [name, email, password, confirmPassword, touched]);

  const isValid =
    name.trim().split(/\s+/).filter(Boolean).length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    confirmPassword === password;

  const pwdStrength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const writeUserToDb = async (user, fullName) => {
    await setDoc(
      doc(getFirestore(), "users", user.uid),
      { uid: user.uid, name: fullName || user.displayName || "", email: user.email || "", admin: false, rank: "Chanter (Epsaltos)", experience: 1, frequency: 1, alhanGrades: [], ssGrades: [], nextWeekServe: "N/A" },
      { merge: true }
    );
  };

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (!isValid) return;
    setLoading("email");
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
      const user = userCredential.user;
      if (user) {
        await writeUserToDb(user, name);
        await user.updateProfile({ displayName: name });
        navigation.navigate("InputPhoto");
      }
    } catch (error) {
      Alert.alert("Sign Up Error", error.message);
    } finally {
      setLoading(null);
    }
  };

  const onGoogleButtonPress = async () => {
    setSignUp(true);
    setLoading("google");
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(getAuth(), googleCredential);
      const user = getAuth().currentUser;
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      if (userDoc.exists) {
        await signOut(getAuth());
        navigation.navigate("SignIn");
        Alert.alert("Already signed up.", "This email is already signed up. Please sign in instead.");
        return;
      }
      await writeUserToDb(userCredential.user, userCredential.user.displayName);
      navigation.navigate("InputPhoto");
    } catch (error) {
      if (error?.code !== "12501") Alert.alert("Sign Up Error", error?.message || "Google sign up failed.");
    } finally {
      setLoading(null);
    }
  };

  const generateNonce = (length = 32) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const onAppleButtonPress = async () => {
    setLoading("apple");
    try {
      const rawNonce = generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const appleAuthRequestResponse = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!appleAuthRequestResponse.identityToken) throw new Error("Apple Sign-In failed - No identity token received.");
      const { identityToken, fullName } = appleAuthRequestResponse;
      const appleCredential = AppleAuthProvider.credential(identityToken, rawNonce);
      setPendingAppleName(fullName);
      const userCredential = await signInWithCredential(getAuth(), appleCredential);
      const user = getAuth().currentUser;
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      if (userDoc.exists) {
        await signOut(getAuth());
        navigation.navigate("SignIn");
        Alert.alert("Already signed up.", "This email is already signed up. Please sign in instead.");
        return;
      }
      const formattedFullName = fullName ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim() : "";
      await writeUserToDb(userCredential.user, formattedFullName);
      navigation.navigate("InputPhoto");
    } catch (error) {
      setPendingAppleName(null); // never hand this name to a later sign-in
      if (error?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Sign Up Error", error?.message || "Apple sign up failed.");
    } finally {
      setLoading(null);
    }
  };

  const onMicrosoftCode = async (result) => {
    setMsVisible(false);
    setSignUp(true);
    setLoading("microsoft");
    try {
      const userCredential = await signInWithMicrosoftCode(result);
      const user = getAuth().currentUser;
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      if (userDoc.exists) {
        await signOut(getAuth());
        navigation.navigate("SignIn");
        Alert.alert("Already signed up.", "This email is already signed up. Please sign in instead.");
        return;
      }
      await writeUserToDb(userCredential.user, userCredential.user.displayName);
      navigation.navigate("InputPhoto");
    } catch (error) {
      if (error?.code === "auth/account-exists-with-different-credential") {
        navigation.navigate("SignIn");
        Alert.alert("Already signed up.", error.message);
      } else if (error?.code === "auth/wrong-tenant") {
        Alert.alert("SPSM account required", error.message);
      } else {
        Alert.alert("Sign Up Error", describeAuthError(error));
      }
    } finally {
      setLoading(null);
    }
  };

  const onMicrosoftError = (e) => {
    setMsVisible(false);
    Alert.alert("Sign Up Error", e?.message || "Microsoft sign up failed.");
  };

  const isLoading = loading !== null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <ScrollView contentContainerStyle={[styles.scrollContent, t && t.scrollContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.backArrowContainer, t && t.backArrowContainer]}><BackArrow size={t ? t.backArrowSize : undefined} /></View>
        <View style={[styles.progressBarContainer, t && t.progressBarContainer]}><ProgressBar startPercentage={0} endPercentage={1} /></View>

        <View style={[styles.heading, t && t.heading]}>
          <Text style={[styles.title, t && t.title]}>Create account</Text>
          <Text style={[styles.subtitle, t && t.subtitle]}>Sign up to join your church community on Ⲧⲁⲝⲓⲥ.</Text>
        </View>

        <View style={[styles.form, t && t.form]}>
          <FloatingInput t={t} label="Full name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" error={validation.name} onBlur={() => setTouched((prev) => ({ ...prev, name: true }))} returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} blurOnSubmit={false} />
          <FloatingInput t={t} ref={emailRef} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" error={validation.email} onBlur={() => setTouched((prev) => ({ ...prev, email: true }))} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false} />
          <FloatingInput t={t} ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry showToggle isSecureVisible={showPwd} onToggleSecure={() => setShowPwd((s) => !s)} autoCapitalize="none" textContentType="newPassword" error={validation.password} onBlur={() => setTouched((prev) => ({ ...prev, password: true }))} returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} blurOnSubmit={false} />

          {password.length > 0 && (
            <View style={[styles.strengthRow, t && t.strengthRow]}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.strengthBar, t && t.strengthBar, { backgroundColor: i < pwdStrength ? pwdStrength === 1 ? "#ff453a" : pwdStrength === 2 ? "#ff9f0a" : "#34c759" : "rgba(255,255,255,0.08)" }]} />
              ))}
              <Text style={[styles.strengthLabel, t && t.strengthLabel]}>{pwdStrength === 0 ? "Too short" : pwdStrength === 1 ? "Weak" : pwdStrength === 2 ? "Okay" : "Strong"}</Text>
            </View>
          )}

          <FloatingInput t={t} ref={confirmRef} label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry showToggle isSecureVisible={showConfirmPwd} onToggleSecure={() => setShowConfirmPwd((s) => !s)} autoCapitalize="none" textContentType="newPassword" error={validation.confirm} onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))} returnKeyType="done" onSubmitEditing={handleSignUp} />
        </View>

        <Pressable style={({ pressed }) => [styles.continueButton, t && t.continueButton, t && t.continueButtonSpaced, (!isValid || isLoading) && styles.continueButtonDisabled, pressed && isValid && { opacity: 0.85 }]} onPress={handleSignUp} disabled={!isValid || isLoading}>
          {loading === "email" ? <ActivityIndicator color="#fff" /> : (
            <><Text style={[styles.continueText, t && t.continueText]}>Continue</Text><Ionicons name="arrow-forward" size={t ? t.continueIconSize : 18} color="#fff" /></>
          )}
        </Pressable>

        <View style={[styles.dividerContainer, t && t.dividerContainer]}>
          <View style={styles.divider} />
          <Text style={[styles.orText, t && t.orText]}>or sign up with</Text>
          <View style={styles.divider} />
        </View>

        <View style={[styles.socialRow, t && t.socialRow]}>
          <SocialButton t={t} onPress={onGoogleButtonPress} disabled={isLoading} isLoading={loading === "google"} icon={<Image style={[styles.googleIcon, t && t.googleIcon]} resizeMode="contain" source={require("../assets/googleLogo.png")} />} label="Google" />
          {Platform.OS === "ios" && AppleAuthentication ? (
            <SocialButton t={t} onPress={onAppleButtonPress} disabled={isLoading} isLoading={loading === "apple"} icon={<Ionicons name="logo-apple" size={t ? t.socialIconSize : 26} color="#fff" />} label="Apple" />
          ) : null}
          <SocialButton t={t} onPress={() => setMsVisible(true)} disabled={isLoading} isLoading={loading === "microsoft"} icon={<Ionicons name="logo-microsoft" size={t ? t.socialIconSize : 26} color="#fff" />} label="Microsoft" />
        </View>

        <View style={[styles.signInRow, t && t.footerRow]}>
          <Text style={[styles.signInPrompt, t && t.footerText]}>Already have an account?</Text>
          <Pressable onPress={() => navigation.navigate("SignIn")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.signInLink, t && t.footerText]}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MicrosoftSignInModal
        visible={msVisible}
        onClose={() => setMsVisible(false)}
        onSuccess={onMicrosoftCode}
        onError={onMicrosoftError}
      />
    </KeyboardAvoidingView>
  );
};

const SocialButton = ({ onPress, icon, label, disabled, isLoading, t }) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.socialButton, t && t.socialButton, disabled && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.97 }] }]}>
    {isLoading ? <ActivityIndicator color="#fff" /> : (
      <><View style={[styles.socialIconWrap, t && t.socialIconWrap]}>{icon}</View><Text style={[styles.socialLabel, t && t.socialLabel]}>{label}</Text></>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scrollContent: { paddingHorizontal: scale(20), paddingTop: verticalScale(60), paddingBottom: verticalScale(32), flexGrow: 1 },
  backArrowContainer: { marginBottom: verticalScale(16) },
  progressBarContainer: { height: verticalScale(6), backgroundColor: "#2A2A2A", borderRadius: moderateScale(3), marginBottom: verticalScale(32), overflow: "hidden" },
  heading: { marginBottom: verticalScale(28) },
  title: { fontSize: moderateScale(34), fontWeight: "700", color: "#E0E0E0", letterSpacing: -0.5, lineHeight: moderateScale(40) },
  subtitle: { fontSize: moderateScale(15), color: "rgba(255,255,255,0.5)", marginTop: verticalScale(8), lineHeight: moderateScale(21) },
  form: { marginBottom: verticalScale(8) },
  inputWrap: { height: verticalScale(58), borderWidth: 1, borderRadius: moderateScale(12), backgroundColor: "#111", paddingHorizontal: scale(14), paddingTop: verticalScale(14), flexDirection: "row", alignItems: "center" },
  input: { flex: 1, fontSize: moderateScale(15), color: "#E0E0E0", paddingVertical: 0, paddingTop: verticalScale(8) },
  eyeBtn: { padding: scale(4), marginLeft: scale(4) },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: verticalScale(4), marginLeft: scale(4) },
  errorText: { fontSize: moderateScale(12), color: "#ff453a" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: scale(6), marginTop: verticalScale(-4), marginBottom: verticalScale(10), paddingHorizontal: scale(2) },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: moderateScale(11), color: "rgba(255,255,255,0.45)", marginLeft: scale(8), minWidth: scale(50) },
  continueButton: { height: verticalScale(52), width: "100%", backgroundColor: "#147EFB", borderRadius: moderateScale(12), flexDirection: "row", justifyContent: "center", alignItems: "center", gap: scale(8), marginTop: verticalScale(12), marginBottom: verticalScale(20), elevation: 4, shadowColor: "#147EFB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  continueButtonDisabled: { backgroundColor: "#555", shadowOpacity: 0, elevation: 0 },
  continueText: { fontSize: moderateScale(16), fontWeight: "600", color: "#fff", letterSpacing: -0.2 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginBottom: verticalScale(16) },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  orText: { marginHorizontal: scale(12), fontSize: moderateScale(12), color: "rgba(255,255,255,0.35)", fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  socialRow: { flexDirection: "row", gap: scale(10), marginBottom: verticalScale(28) },
  socialButton: { flex: 1, height: verticalScale(64), backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: moderateScale(14), justifyContent: "center", alignItems: "center", gap: verticalScale(4) },
  socialIconWrap: { height: 26, justifyContent: "center", alignItems: "center" },
  socialLabel: { fontSize: moderateScale(11), color: "rgba(255,255,255,0.65)", fontWeight: "500" },
  googleIcon: { width: moderateScale(24), height: moderateScale(24) },
  signInRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: scale(6), marginTop: "auto", paddingTop: verticalScale(12) },
  signInPrompt: { fontSize: moderateScale(14), color: "rgba(255,255,255,0.45)" },
  signInLink: { fontSize: moderateScale(14), color: "#147EFB", fontWeight: "600" },
});

export default SignUp;