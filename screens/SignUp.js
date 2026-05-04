import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import { useUser } from "../UserContext";

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");
const REFERENCE_WIDTH = 375;
const REFERENCE_HEIGHT = 812;
const scale = (size) => (width / REFERENCE_WIDTH) * size;
const verticalScale = (size) => (height / REFERENCE_HEIGHT) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const MICROSOFT_CLIENT_ID = "149615d2-4f88-4222-b69c-f3b82f2b8901";
const MICROSOFT_TENANT = "waylandcopticchurch.org";
const microsoftDiscovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
};
const redirectUri = AuthSession.makeRedirectUri({
  scheme: "taksis",
  path: "redirect",
});

// ---------- Floating-label input ----------
const FloatingInput = React.forwardRef(({
  label,
  value,
  onChangeText,
  secureTextEntry,
  showToggle,
  onToggleSecure,
  isSecureVisible,
  autoCapitalize,
  keyboardType,
  textContentType,
  error,
  onBlur,
  onFocus,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  ...rest
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
    left: scale(14),
    top: animated.interpolate({
      inputRange: [0, 1],
      outputRange: [verticalScale(16), verticalScale(6)],
    }),
    fontSize: animated.interpolate({
      inputRange: [0, 1],
      outputRange: [moderateScale(15), moderateScale(11)],
    }),
    color: animated.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(255,255,255,0.35)", "rgba(255,255,255,0.5)"],
    }),
  };

  const borderColor = error
    ? "#ff453a"
    : focused
      ? "#147efb"
      : "rgba(255,255,255,0.08)";

  return (
    <View style={{ marginBottom: verticalScale(12) }}>
      <View style={[styles.inputWrap, { borderColor }]}>
        <Animated.Text style={labelStyle} pointerEvents="none">
          {label}
        </Animated.Text>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            onFocus && onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur && onBlur(e);
          }}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          style={styles.input}
          placeholderTextColor="rgba(255,255,255,0.3)"
          {...rest}
        />
        {showToggle ? (
          <Pressable
            onPress={onToggleSecure}
            style={styles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isSecureVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="rgba(255,255,255,0.35)"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={12} color="#ff453a" />
          <Text style={styles.errorText}>{error}</Text>
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
  const { setSignUp } = useUser();

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    setSignUp(true);
  }, []);

  GoogleSignin.configure({
    webClientId:
      "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const [msRequest, msResponse, msPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      redirectUri: redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: {
        nonce: "ms_signup_" + Date.now(),
        prompt: "select_account",
      },
    },
    microsoftDiscovery
  );

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
    const userRef = firestore().collection("users").doc(user.uid);
    await userRef.set(
      {
        uid: user.uid,
        name: fullName || user.displayName || "",
        email: user.email || "",
        admin: false,
        rank: "Chanter (Epsaltos)",
        experience: 1,
        frequency: 1,
        alhanGrades: [],
        ssGrades: [],
        nextWeekServe: "N/A",
      },
      { merge: true }
    );
  };

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (!isValid) return;
    setLoading("email");
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
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
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      const user = auth().currentUser;
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        await auth().signOut();
        navigation.navigate("SignIn");
        Alert.alert(
          "Already signed up.",
          "This email is already signed up for this app. Please sign in instead."
        );
        return;
      }
      await writeUserToDb(userCredential.user, userCredential.user.displayName);
      navigation.navigate("InputPhoto");
    } catch (error) {
      if (error?.code !== "12501") {
        Alert.alert("Sign Up Error", error?.message || "Google sign up failed.");
      }
    } finally {
      setLoading(null);
    }
  };

  const generateNonce = (length = 32) => {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const onAppleButtonPress = async () => {
    setLoading("apple");
    try {
      const rawNonce = generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const appleAuthRequestResponse = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error("Apple Sign-In failed - No identity token received.");
      }
      const { identityToken, fullName } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, rawNonce);
      const userCredential = await auth().signInWithCredential(appleCredential);
      const user = auth().currentUser;
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        await auth().signOut();
        navigation.navigate("SignIn");
        Alert.alert(
          "Already signed up.",
          "This email is already signed up for this app. Please sign in instead."
        );
        return;
      }
      const formattedFullName = fullName
        ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim()
        : "";
      await writeUserToDb(userCredential.user, formattedFullName);
      navigation.navigate("InputPhoto");
    } catch (error) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign Up Error", error?.message || "Apple sign up failed.");
      }
    } finally {
      setLoading(null);
    }
  };

  const onMicrosoftButtonPress = async () => {
    if (MICROSOFT_CLIENT_ID === "TODO_FILL_IN_MS_CLIENT_ID") {
      Alert.alert(
        "Not configured",
        "Microsoft sign-in needs an Azure app registration. Update MICROSOFT_CLIENT_ID in SignUp.js."
      );
      return;
    }
    if (!msRequest) return;
    setSignUp(true);
    setLoading("microsoft");
    try {
      const result = await msPromptAsync();
      if (result.type !== "success") {
        if (result.type !== "cancel") {
          Alert.alert("Sign Up Error", "Microsoft sign-in did not complete.");
        }
        return;
      }
    const idToken = result.params.id_token;
      if (!idToken) throw new Error("No identity token returned from Microsoft.");

      // ✅ Correct way with @react-native-firebase/auth
      const credential = auth.OAuthProvider.credential("microsoft.com", idToken);
      const userCredential = await auth().signInWithCredential(credential);
      const user = auth().currentUser;
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        await auth().signOut();
        navigation.navigate("SignIn");
        Alert.alert(
          "Already signed up.",
          "This email is already signed up for this app. Please sign in instead."
        );
        return;
      }
      await writeUserToDb(userCredential.user, userCredential.user.displayName || "");
      navigation.navigate("InputPhoto");
    } catch (error) {
      Alert.alert("Sign Up Error", error?.message || "Microsoft sign up failed.");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back arrow */}
        <View style={styles.backArrowContainer}>
          <BackArrow />
        </View>

        {/* Progress bar — full width, matching InputPhoto */}
        <View style={styles.progressBarContainer}>
          <ProgressBar startPercentage={0} endPercentage={1} />
        </View>

        {/* Headline */}
        <View style={styles.heading}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Sign up to join your church community on Ⲧⲁⲝⲓⲥ.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <FloatingInput
            label="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
            error={validation.name}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />
          <FloatingInput
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={validation.email}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <FloatingInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            showToggle
            isSecureVisible={showPwd}
            onToggleSecure={() => setShowPwd((s) => !s)}
            autoCapitalize="none"
            textContentType="newPassword"
            error={validation.password}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            blurOnSubmit={false}
          />

          {/* Password strength meter */}
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        i < pwdStrength
                          ? pwdStrength === 1
                            ? "#ff453a"
                            : pwdStrength === 2
                              ? "#ff9f0a"
                              : "#34c759"
                          : "rgba(255,255,255,0.08)",
                    },
                  ]}
                />
              ))}
              <Text style={styles.strengthLabel}>
                {pwdStrength === 0
                  ? "Too short"
                  : pwdStrength === 1
                    ? "Weak"
                    : pwdStrength === 2
                      ? "Okay"
                      : "Strong"}
              </Text>
            </View>
          )}

          <FloatingInput
            ref={confirmRef}
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            showToggle
            isSecureVisible={showConfirmPwd}
            onToggleSecure={() => setShowConfirmPwd((s) => !s)}
            autoCapitalize="none"
            textContentType="newPassword"
            error={validation.confirm}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />
        </View>

        {/* Continue button */}
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            (!isValid || isLoading) && styles.continueButtonDisabled,
            pressed && isValid && { opacity: 0.85 },
          ]}
          onPress={handleSignUp}
          disabled={!isValid || isLoading}
        >
          {loading === "email" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>or sign up with</Text>
          <View style={styles.divider} />
        </View>

        {/* Social row */}
        <View style={styles.socialRow}>
          <SocialButton
            onPress={onGoogleButtonPress}
            disabled={isLoading}
            isLoading={loading === "google"}
            icon={
              <Image
                style={styles.googleIcon}
                resizeMode="contain"
                source={require("../assets/googleLogo.png")}
              />
            }
            label="Google"
          />

          {Platform.OS === "ios" && AppleAuthentication ? (
            <SocialButton
              onPress={onAppleButtonPress}
              disabled={isLoading}
              isLoading={loading === "apple"}
              icon={<Ionicons name="logo-apple" size={26} color="#fff" />}
              label="Apple"
            />
          ) : null}

          <SocialButton
            onPress={onMicrosoftButtonPress}
            disabled={isLoading}
            isLoading={loading === "microsoft"}
            icon={<MicrosoftLogo />}
            label="Microsoft"
          />
        </View>

        {/* Sign in link */}
        <View style={styles.signInRow}>
          <Text style={styles.signInPrompt}>Already have an account?</Text>
          <Pressable
            onPress={() => navigation.navigate("SignIn")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.signInLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ---------- Helper components ----------

const SocialButton = ({ onPress, icon, label, disabled, isLoading }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.socialButton,
      disabled && { opacity: 0.5 },
      pressed && { transform: [{ scale: 0.97 }] },
    ]}
  >
    {isLoading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        <View style={styles.socialIconWrap}>{icon}</View>
        <Text style={styles.socialLabel}>{label}</Text>
      </>
    )}
  </Pressable>
);

const MicrosoftLogo = () => (
  <View style={styles.msLogo}>
    <View style={[styles.msSquare, { backgroundColor: "#f25022" }]} />
    <View style={[styles.msSquare, { backgroundColor: "#7fba00" }]} />
    <View style={[styles.msSquare, { backgroundColor: "#00a4ef" }]} />
    <View style={[styles.msSquare, { backgroundColor: "#ffb900" }]} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContent: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(32),
    flexGrow: 1,
  },

  // ---------- Progress bar (full-width, matches InputPhoto) ----------
  backArrowContainer: {
    marginBottom: verticalScale(16),
  },
  progressBarContainer: {
    height: verticalScale(6),
    backgroundColor: "#2A2A2A",
    borderRadius: moderateScale(3),
    marginBottom: verticalScale(32),
    overflow: "hidden",
  },

  // ---------- Heading ----------
  heading: {
    marginBottom: verticalScale(28),
  },
  title: {
    fontSize: moderateScale(34),
    fontWeight: "700",
    color: "#E0E0E0",
    letterSpacing: -0.5,
    lineHeight: moderateScale(40),
  },
  subtitle: {
    fontSize: moderateScale(15),
    color: "rgba(255,255,255,0.5)",
    marginTop: verticalScale(8),
    lineHeight: moderateScale(21),
  },

  // ---------- Form ----------
  form: {
    marginBottom: verticalScale(8),
  },
  inputWrap: {
    height: verticalScale(58),
    borderWidth: 1,
    borderRadius: moderateScale(12),
    backgroundColor: "#111",
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(14),
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#E0E0E0",
    paddingVertical: 0,
    paddingTop: verticalScale(8),
  },
  eyeBtn: {
    padding: scale(4),
    marginLeft: scale(4),
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: verticalScale(4),
    marginLeft: scale(4),
  },
  errorText: {
    fontSize: moderateScale(12),
    color: "#ff453a",
  },

  // Strength meter
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginTop: verticalScale(-4),
    marginBottom: verticalScale(10),
    paddingHorizontal: scale(2),
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: moderateScale(11),
    color: "rgba(255,255,255,0.45)",
    marginLeft: scale(8),
    minWidth: scale(50),
  },

  // ---------- Continue button ----------
  continueButton: {
    height: verticalScale(52),
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: moderateScale(12),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(8),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(20),
    elevation: 4,
    shadowColor: "#147EFB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  continueButtonDisabled: {
    backgroundColor: "#555",
    shadowOpacity: 0,
    elevation: 0,
  },
  continueText: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.2,
  },

  // ---------- Divider ----------
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  orText: {
    marginHorizontal: scale(12),
    fontSize: moderateScale(12),
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ---------- Social row ----------
  socialRow: {
    flexDirection: "row",
    gap: scale(10),
    marginBottom: verticalScale(28),
  },
  socialButton: {
    flex: 1,
    height: verticalScale(64),
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: moderateScale(14),
    justifyContent: "center",
    alignItems: "center",
    gap: verticalScale(4),
  },
  socialIconWrap: {
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  socialLabel: {
    fontSize: moderateScale(11),
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  googleIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
  },

  // Microsoft inline logo
  msLogo: {
    width: 22,
    height: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  msSquare: {
    width: 10,
    height: 10,
    borderRadius: 1,
  },

  // ---------- Sign in link ----------
  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(6),
    marginTop: "auto",
    paddingTop: verticalScale(12),
  },
  signInPrompt: {
    fontSize: moderateScale(14),
    color: "rgba(255,255,255,0.45)",
  },
  signInLink: {
    fontSize: moderateScale(14),
    color: "#147EFB",
    fontWeight: "600",
  },
});

export default SignUp;