import { Pressable, StyleSheet } from 'react-native';
import { Body } from './Text';
import { makeStyles } from './themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, paddingVertical: space.s, paddingHorizontal: space.m },
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline },
    primaryText: { color: colors.onAccent, fontWeight: '600' },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
  }),
);

/** An action. `primary` is the screen's main action; there is at most one per screen. */
export function Button({
  label,
  onPress,
  kind = 'secondary',
  disabled = false,
}: {
  label: string;
  onPress(): void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[kind], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Body style={kind === 'primary' && styles.primaryText}>{label}</Body>
    </Pressable>
  );
}
