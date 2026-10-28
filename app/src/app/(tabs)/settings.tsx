import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeMode } from '../../data/settings';
import { useAppData } from '../../state/AppData';
import { TAB_TR, THEME_MODE_TR, THEME_MODES } from '../../ui/labels';
import { Body, Caption, Label, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { paddingHorizontal: space.m, paddingTop: space.l, gap: space.m },
    row: { flexDirection: 'row', gap: space.s },
    option: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: space.s,
      borderRadius: radius.button,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
    },
    selected: { backgroundColor: colors.accent, borderColor: colors.accent },
    selectedText: { color: colors.onAccent },
    error: { color: colors.dangerText },
  }),
);

export default function SettingsScreen() {
  const styles = useStyles();
  const { settings, updateSettings } = useAppData();
  const [failed, setFailed] = useState(false);

  const choose = (mode: ThemeMode) => {
    setFailed(false);
    updateSettings({ themeMode: mode }).catch(() => setFailed(true));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <Title>{TAB_TR.settings}</Title>
        <Label dim>Görünüm</Label>
        <View style={styles.row}>
          {THEME_MODES.map((mode) => {
            const selected = settings.themeMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => choose(mode)}
                style={[styles.option, selected && styles.selected]}
              >
                <Body style={selected && styles.selectedText}>{THEME_MODE_TR[mode]}</Body>
              </Pressable>
            );
          })}
        </View>
        {failed && <Caption style={styles.error}>Kaydedilemedi, tekrar dene.</Caption>}
      </View>
    </SafeAreaView>
  );
}
