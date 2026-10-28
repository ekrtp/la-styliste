import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Title } from './Text';
import { makeStyles } from './themes';

const useStyles = makeStyles(({ colors, shape: { space } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.m, gap: space.s },
  }),
);

/** A tab with nothing in it yet: a title and one line saying what will appear here. */
export function EmptyState({ title, text }: { title: string; text: string }) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <Title>{title}</Title>
        <Body dim>{text}</Body>
      </View>
    </SafeAreaView>
  );
}
