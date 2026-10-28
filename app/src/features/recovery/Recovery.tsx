import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Caption, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.m, gap: space.m },
    error: { color: colors.dangerText },
    button: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.button, paddingVertical: space.s, paddingHorizontal: space.m },
    buttonText: { color: colors.onAccent },
  }),
);

/** Shown instead of the app when the database cannot be opened, migrated or read. Nothing is deleted here. */
export function Recovery({ error, onRetry }: { error: string; onRetry(): void }) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Title>Veriler açılamadı</Title>
        <Body dim>Uygulama veritabanını açarken bir hata oldu. Hiçbir şey silinmedi.</Body>
        <Caption style={styles.error}>{error}</Caption>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Body style={styles.buttonText}>Tekrar dene</Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
