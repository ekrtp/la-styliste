import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { displayUri, thumbUri } from '../../media/photoFiles';
import { makeStyles, useTheme } from '../../ui/themes';

/** Size of the placeholder glyph. */
const PLACEHOLDER_ICON = 32;

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.surface },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  }),
);

/** An item's photo filling its parent, or a placeholder when it has none or its file is missing (M1a decision 4). */
export function PhotoImage({ photoId, size }: { photoId: string | null; size: 'thumb' | 'display' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (photoId === null || failed) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="shirt-outline" size={PLACEHOLDER_ICON} color={colors.textFaint} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: size === 'thumb' ? thumbUri(photoId) : displayUri(photoId) }}
      style={styles.fill}
      contentFit="contain"
      recyclingKey={photoId}
      cachePolicy="memory"
      onError={() => setFailed(true)}
    />
  );
}
