import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SchemaTooNewError } from '../../data/errors';
import { Button } from '../../ui/Button';
import { Body, Caption, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.m, gap: space.m },
    error: { color: colors.dangerText },
  }),
);

/**
 * Shown instead of the app when the database cannot be opened, migrated or read. Nothing is deleted here.
 * Data from a newer build cannot be fixed by retrying, so that case has no button. Export and restore arrive in M1b.
 */
export function Recovery({ error, onRetry }: { error: Error; onRetry(): void }) {
  const styles = useStyles();
  const tooNew = error instanceof SchemaTooNewError;
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Title>{tooNew ? 'Uygulama eski kaldı' : 'Veriler açılamadı'}</Title>
        <Body dim>
          {tooNew
            ? 'Verilerin bu uygulamanın daha yeni bir sürümüyle kaydedilmiş. Uygulamayı kapatıp açınca güncelleme iner. Hiçbir şey silinmedi.'
            : 'Uygulama veritabanını açarken bir hata oldu. Hiçbir şey silinmedi.'}
        </Body>
        <Caption style={styles.error}>{error.message}</Caption>
        {!tooNew && <Button kind="primary" label="Tekrar dene" onPress={onRetry} />}
      </View>
    </SafeAreaView>
  );
}
