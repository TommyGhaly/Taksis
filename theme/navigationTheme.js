import { useMemo } from "react";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useTheme } from "./ThemeContext";

/**
 * React Navigation theme for a NavigationContainer. The app nests several
 * `independent` containers (Settings, Learn It, Home…), and each paints the
 * area behind and between its screens from its own theme, so every one of
 * them must use this rather than a hardcoded object.
 */
export function useNavigationTheme() {
  const t = useTheme();
  return useMemo(() => {
    const base = t.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: t.isDark,
      colors: {
        ...base.colors,
        primary: t.accent,
        background: t.background,
        card: t.chrome,
        text: t.text,
        border: t.separator,
        notification: t.danger,
      },
    };
  }, [t]);
}
