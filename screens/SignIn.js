import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Text,
  Image,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from "react-native";
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import { useUser } from "../UserContext";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
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
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const FloatingInput = React.forwardRef(({
  label, value, onChangeText, secureTextEntry, showToggle, onToggleSecure,
  isSecureVisible, autoCapitalize, keyboardType, textContentType,
  returnKeyType, onSubmitEditing, blurOnSubmit, t, ...rest
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

  return (
    <View style={[{ marginBottom: verticalScale(12) }, t && t.fieldWrap]}>
      <View style={[styles.inputWrap, t && t.inputWrap, { borderColor: focused ? "#147efb" : "rgba(255,255,255,0.08)" }]}>
        <Animated.Text style={labelStyle} pointerEvents="none">{label}</Animated.Text>
        <TextInput
          ref={ref} value={value} onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          autoCapitalize={autoCapitalize} keyboardType={keyboardType}
          textContentType={textContentType} autoCorrect={false}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
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
    </View>
  );
});

const SignIn = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(null);
  const [msVisible, setMsVisible] = useState(false);
  const { setSignUp } = useUser();
  const passwordRef = useRef(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const t = useMemo(
    () => (IS_TABLET ? makeAuthTabletStyles(winW, winH) : null),
    [winW, winH]
  );

  useEffect(() => { setSignUp(false); }, []);

  GoogleSignin.configure({
    webClientId: "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading("email");
    try {
      // Android keyboards append a space after a suggested email
      await signInWithEmailAndPassword(getAuth(), email.trim(), password);
    } catch (e) {
      Alert.alert("Sign-in failed", e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading("google");
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      const cred = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), cred);
    } catch (e) {
      if (e?.code !== "12501") Alert.alert("Google sign-in failed", e?.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading("apple");
    try {
      const raw = generateNonce();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
      const { identityToken, fullName } = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
      if (!identityToken) throw new Error("No identity token.");
      const cred = AppleAuthProvider.credential(identityToken, raw);
      setPendingAppleName(fullName);
      await signInWithCredential(getAuth(), cred);
    } catch (e) {
      setPendingAppleName(null); // never hand this name to a later sign-in
      if (e?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Apple sign-in failed", e?.message);
    } finally {
      setLoading(null);
    }
  };

  const handleMicrosoftCode = async (result) => {
    setMsVisible(false);
    setLoading("microsoft");
    try {
      await signInWithMicrosoftCode(result);
    } catch (e) {
      if (e?.code === "auth/account-exists-with-different-credential") {
        Alert.alert("Account already exists", e.message);
      } else if (e?.code === "auth/wrong-tenant") {
        Alert.alert("SPSM account required", e.message);
      } else {
        Alert.alert("Microsoft sign-in failed", describeAuthError(e));
      }
    } finally {
      setLoading(null);
    }
  };

  const handleMicrosoftError = (e) => {
    setMsVisible(false);
    Alert.alert("Microsoft sign-in failed", e?.message);
  };

  const isLoading = loading !== null;
  const canSubmit = email.length > 0 && password.length > 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <ScrollView contentContainerStyle={[styles.scrollContent, t && t.scrollContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.backArrowContainer, t && t.backArrowContainer]}><BackArrow size={t ? t.backArrowSize : undefined} /></View>

        <View style={[styles.heading, t && t.heading]}>
          <Image source={require("../assets/lastSupperIcon.png")} style={[styles.icon, t && t.icon]} resizeMode="contain" />
          <Text style={[styles.title, t && t.title]}>Welcome back</Text>
          <Text style={[styles.subtitle, t && t.subtitle]}>Sign in to continue to Ⲧⲁⲝⲓⲥ.</Text>
        </View>

        <View style={[styles.form, t && t.form]}>
          <FloatingInput
            t={t}
            label="Email" value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false}
          />
          <FloatingInput
            t={t}
            ref={passwordRef} label="Password" value={password} onChangeText={setPassword}
            secureTextEntry showToggle isSecureVisible={showPwd} onToggleSecure={() => setShowPwd(s => !s)}
            autoCapitalize="none" textContentType="password" returnKeyType="done" onSubmitEditing={handleSignIn}
          />
        </View>

        <Pressable style={[styles.forgotRow, t && t.forgotRow]} onPress={() => navigation.navigate("PasswordReset")} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={[styles.forgotText, t && t.forgotText]}>Forgot password?</Text>
          <Text style={[styles.forgotLink, t && t.forgotText]}> Set new password</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.continueButton, t && t.continueButton, (!canSubmit || isLoading) && styles.continueButtonDisabled, pressed && canSubmit && { opacity: 0.85 }]}
          onPress={handleSignIn} disabled={!canSubmit || isLoading}
        >
          {loading === "email" ? <ActivityIndicator color="#fff" /> : (
            <><Text style={[styles.continueText, t && t.continueText]}>Continue</Text><Ionicons name="arrow-forward" size={t ? t.continueIconSize : 18} color="#fff" /></>
          )}
        </Pressable>

        <View style={[styles.dividerContainer, t && t.dividerContainer]}>
          <View style={styles.divider} />
          <Text style={[styles.orText, t && t.orText]}>or sign in with</Text>
          <View style={styles.divider} />
        </View>

        <View style={[styles.socialRow, t && t.socialRow]}>
          <SocialButton
            t={t}
            onPress={handleGoogle} disabled={isLoading} isLoading={loading === "google"}
            icon={<Image style={[styles.googleIcon, t && t.googleIcon]} resizeMode="contain" source={require("../assets/googleLogo.png")} />}
            label="Google"
          />
          {Platform.OS === "ios" ? (
            <SocialButton
              t={t}
              onPress={handleApple} disabled={isLoading} isLoading={loading === "apple"}
              icon={<Ionicons name="logo-apple" size={t ? t.socialIconSize : 26} color="#fff" />} label="Apple"
            />
          ) : null}
          <SocialButton
            t={t}
            onPress={() => setMsVisible(true)} disabled={isLoading} isLoading={loading === "microsoft"}
            icon={<Ionicons name="logo-microsoft" size={t ? t.socialIconSize : 26} color="#fff" />}
            label="Microsoft"
          />
        </View>

        <View style={[styles.signUpRow, t && t.footerRow]}>
          <Text style={[styles.signUpPrompt, t && t.footerText]}>Don't have an account?</Text>
          <Pressable onPress={() => navigation.navigate("SignUp")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.signUpLink, t && t.footerText]}> Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MicrosoftSignInModal
        visible={msVisible}
        onClose={() => setMsVisible(false)}
        onSuccess={handleMicrosoftCode}
        onError={handleMicrosoftError}
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

const generateNonce = (length = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scrollContent: { paddingHorizontal: scale(20), paddingTop: verticalScale(60), paddingBottom: verticalScale(32), flexGrow: 1 },
  backArrowContainer: { marginBottom: verticalScale(16) },
  heading: { marginBottom: verticalScale(28) },
  icon: { width: scale(220), height: scale(220) * (499 / 1089), alignSelf: "center", marginBottom: verticalScale(20) },
  title: { fontSize: moderateScale(34), fontWeight: "700", color: "#E0E0E0", letterSpacing: -0.5, lineHeight: moderateScale(40) },
  subtitle: { fontSize: moderateScale(15), color: "rgba(255,255,255,0.5)", marginTop: verticalScale(8), lineHeight: moderateScale(21) },
  form: { marginBottom: verticalScale(4) },
  inputWrap: { height: verticalScale(58), borderWidth: 1, borderRadius: moderateScale(12), backgroundColor: "#1A1A1A", paddingHorizontal: scale(14), paddingTop: verticalScale(14), flexDirection: "row", alignItems: "center" },
  input: { flex: 1, fontSize: moderateScale(15), color: "#E0E0E0", paddingVertical: 0, paddingTop: verticalScale(8) },
  eyeBtn: { padding: scale(4), marginLeft: scale(4) },
  forgotRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: verticalScale(20), marginTop: verticalScale(4) },
  forgotText: { fontSize: moderateScale(14), color: "rgba(255,255,255,0.45)" },
  forgotLink: { fontSize: moderateScale(14), color: "#147EFB", fontWeight: "600" },
  continueButton: { height: verticalScale(52), width: "100%", backgroundColor: "#147EFB", borderRadius: moderateScale(12), flexDirection: "row", justifyContent: "center", alignItems: "center", gap: scale(8), marginBottom: verticalScale(20), elevation: 4, shadowColor: "#147EFB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
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
  signUpRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: scale(6), marginTop: "auto", paddingTop: verticalScale(12) },
  signUpPrompt: { fontSize: moderateScale(14), color: "rgba(255,255,255,0.45)" },
  signUpLink: { fontSize: moderateScale(14), color: "#147EFB", fontWeight: "600" },
});

export default SignIn;