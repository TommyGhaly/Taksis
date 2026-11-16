import React, { createContext, useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { makeStyles, useTheme, HeaderGlassButton } from "../theme";
import IconMCI from "react-native-vector-icons/MaterialCommunityIcons";

// Open "I can't make it" requests for an admin's church. The count is the
// church's unavailable queue, so it only drops once an admin (any admin)
// assigns a replacement - skipping in the modal does not clear it.
export const UnavailableAlertsContext = createContext({ count: 0, open: null });

const UnavailableAlertsBell = () => {
  const { count, open } = useContext(UnavailableAlertsContext);
  const styles = useStyles();
  const theme = useTheme();
  if (!open) return null; // not an admin
  const label = count > 99 ? "99+" : String(count);
  return (
    <TouchableOpacity
      onPress={open}
      disabled={count === 0}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        count === 0
          ? "No unavailable deacons"
          : `${count} unavailable deacon${count === 1 ? "" : "s"} need a replacement`
      }
    >
      <HeaderGlassButton>
        <IconMCI
          name={count > 0 ? "bell-badge-outline" : "bell-outline"}
          size={24}
          color={count > 0 ? theme.text : theme.textTertiary}
        />
      </HeaderGlassButton>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const useStyles = makeStyles((t) => ({
  button: { paddingHorizontal: 14, paddingVertical: 4 },
  badge: {
    position: "absolute",
    top: -2,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: t.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: t.onDanger, fontSize: 11, fontWeight: "700" },
}));

export default UnavailableAlertsBell;
