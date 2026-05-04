import * as React from "react";
import { useState, useEffect, useRef } from "react";
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
} from "react-native";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import { useUser } from "../UserContext";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const REFERENCE_WIDTH = 375;
const REFERENCE_HEIGHT = 812;
const scale = (size) => (width / REFERENCE_WIDTH) * size;
const verticalScale = (size) => (height / REFERENCE_HEIGHT) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const MICROSOFT_CLIENT_ID = "827479e7-3afb-41ad-b426-31e2d42f9b44";
const MICROSOFT_TENANT = "common";
const microsoftDiscovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
};

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

  const borderColor = focused ? "#147efb" : "rgba(255,255,255,0.08)";

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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
    </View>
  );
});

const SignIn = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(null);
  const { setSignUp } = useUser();
  const passwordRef = useRef(null);

  useEffect(() => { setSignUp(false); }, []);

  GoogleSignin.configure({
    webClientId: "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const [msRequest, msResponse, msPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri(),
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: { nonce: "ms_signin_" + Date.now() },
    },
    microsoftDiscovery
  );

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading("email");
    try {
      await auth().signInWithEmailAndPassword(email, password);
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
      const cred = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(cred);
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
      const hashed = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        raw
      );
      const { identityToken } = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
      if (!identityToken) throw new Error("No identity token.");
      const cred = auth.AppleAuthProvider.credential(identityToken, raw);
      await auth().signInWithCredential(cred);
    } catch (e) {
      if (e?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Apple sign-in failed", e?.message);
    } finally {
      setLoading(null);
    }
  };

  const handleMicrosoft = async () => {
    if (!msRequest) return;
    setLoading("microsoft");
    try {
      const result = await msPromptAsync();
      if (result.type !== "success") {
        if (result.type !== "cancel") Alert.alert("Microsoft sign-in failed", "Did not complete.");
        return;
      }
      const idToken = result.params.id_token;
      if (!idToken) throw new Error("No identity token from Microsoft.");
      const provider = new auth.OAuthProvider("microsoft.com");
      const cred = provider.credential({ idToken });
      await auth().signInWithCredential(cred);
    } catch (e) {
      Alert.alert("Microsoft sign-in failed", e?.message);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;
  const canSubmit = email.length > 0 && password.length > 0;

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

        {/* Icon + heading */}
        <View style={styles.heading}>
          <Image
            source={require("../assets/lastSupperIcon.png")}
            style={styles.icon}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to Taksis.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <FloatingInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
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
            onToggleSecure={() => setShowPwd(s => !s)}
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />
        </View>

        {/* Forgot password */}
        <Pressable
          style={styles.forgotRow}
          onPress={() => navigation.navigate("PasswordReset")}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
          <Text style={styles.forgotLink}> Set new password</Text>
        </Pressable>

        {/* Continue button */}
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            (!canSubmit || isLoading) && styles.continueButtonDisabled,
            pressed && canSubmit && { opacity: 0.85 },
          ]}
          onPress={handleSignIn}
          disabled={!canSubmit || isLoading}
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
          <Text style={styles.orText}>or sign in with</Text>
          <View style={styles.divider} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialRow}>
          <SocialButton
            onPress={handleGoogle}
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

          {Platform.OS === "ios" ? (
            <SocialButton
              onPress={handleApple}
              disabled={isLoading}
              isLoading={loading === "apple"}
              icon={<Ionicons name="logo-apple" size={26} color="#fff" />}
              label="Apple"
            />
          ) : null}

          <SocialButton
            onPress={handleMicrosoft}
            disabled={isLoading}
            isLoading={loading === "microsoft"}
            icon={<MicrosoftLogo />}
            label="Microsoft"
          />
        </View>

        {/* Sign up link */}
        <View style={styles.signUpRow}>
          <Text style={styles.signUpPrompt}>Don't have an account?</Text>
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.signUpLink}> Sign up</Text>
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

const generateNonce = (length = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

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

  backArrowContainer: {
    marginBottom: verticalScale(16),
  },

  // ---------- Heading ----------
  heading: {
    marginBottom: verticalScale(28),
  },
  icon: {
    width: scale(220),
    height: scale(220) * (499 / 1089),
    alignSelf: "center",
    marginBottom: verticalScale(20),
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
    marginBottom: verticalScale(4),
  },
  inputWrap: {
    height: verticalScale(58),
    borderWidth: 1,
    borderRadius: moderateScale(12),
    backgroundColor: "#1A1A1A",
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

  // ---------- Forgot password ----------
  forgotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(20),
    marginTop: verticalScale(4),
  },
  forgotText: {
    fontSize: moderateScale(14),
    color: "rgba(255,255,255,0.45)",
  },
  forgotLink: {
    fontSize: moderateScale(14),
    color: "#147EFB",
    fontWeight: "600",
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

  // ---------- Sign up link ----------
  signUpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(6),
    marginTop: "auto",
    paddingTop: verticalScale(12),
  },
  signUpPrompt: {
    fontSize: moderateScale(14),
    color: "rgba(255,255,255,0.45)",
  },
  signUpLink: {
    fontSize: moderateScale(14),
    color: "#147EFB",
    fontWeight: "600",
  },
});

export default SignIn;