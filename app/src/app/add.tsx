import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ItemPhotoKind } from '../core/tags';
import { addItem } from '../features/items/addItem';
import { EMPTY_DRAFT, tagsFromDraft } from '../features/items/draft';
import { ItemForm } from '../features/items/ItemForm';
import { PermissionDeniedError, pickPhoto, type PhotoSource } from '../media/pick';
import { LowStorageError } from '../media/pipeline';
import { useAppData, useDb } from '../state/AppData';
import { Button } from '../ui/Button';
import { ITEM_PHOTO_KINDS, PHOTO_KIND_HINT_TR, PHOTO_KIND_TR } from '../ui/labels';
import { Body, Caption, Title } from '../ui/Text';
import { makeStyles, useTheme } from '../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    fill: { flex: 1 },
    scroll: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    preview: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.surface },
    choices: { gap: space.s },
    error: { color: colors.dangerText },
  }),
);

/** Add an item by hand: the photo kind, then the camera or the library, then the tag form (spec §11 "Ekle"). */
export default function AddScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const db = useDb();
  const { changed } = useAppData();
  const [kind, setKind] = useState<ItemPhotoKind | null>(null);
  const [asset, setAsset] = useState<ImagePickerAsset | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  // Set synchronously so a second tap before the re-render cannot start a second save.
  const savingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async (source: PhotoSource) => {
    setMessage(null);
    try {
      const picked = await pickPhoto(source);
      if (picked !== null) setAsset(picked);
    } catch (e) {
      setMessage(e instanceof PermissionDeniedError ? "Kamera izni kapalı. iPhone Ayarlar'ından izin verebilirsin." : 'Fotoğraf açılamadı, tekrar dene.');
    }
  };

  const save = async () => {
    if (savingRef.current || kind === null || asset === null) return;
    const result = tagsFromDraft(draft);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await addItem(db, asset, kind, result.tags);
      changed();
      router.back();
    } catch (e) {
      setMessage(e instanceof LowStorageError ? 'Telefonda yer kalmadı. Biraz yer açıp tekrar dene.' : 'Kaydedilemedi, tekrar dene.');
      savingRef.current = false;
      setSaving(false);
    }
  };

  const messageLine = message !== null && <Caption style={styles.error}>{message}</Caption>;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <Title>Parça ekle</Title>
            <Button label="Kapat" disabled={saving} onPress={() => router.back()} />
          </View>
          {kind === null ? (
            <View style={styles.choices}>
              <Body dim>Fotoğraf nasıl çekildi?</Body>
              {ITEM_PHOTO_KINDS.map((k) => (
                <Button key={k} label={`${PHOTO_KIND_TR[k]}: ${PHOTO_KIND_HINT_TR[k]}`} onPress={() => setKind(k)} />
              ))}
            </View>
          ) : asset === null ? (
            <View style={styles.choices}>
              <Body dim>{PHOTO_KIND_TR[kind]}</Body>
              <Button kind="primary" label="Fotoğraf çek" onPress={() => pick('camera')} />
              <Button label="Galeriden seç" onPress={() => pick('library')} />
              <Button label="Geri" onPress={() => setKind(null)} />
              {messageLine}
            </View>
          ) : (
            <>
              <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="contain" />
              <Button label="Başka fotoğraf seç" disabled={saving} onPress={() => setAsset(null)} />
              <ItemForm draft={draft} onChange={setDraft} />
              {messageLine}
              {saving ? <ActivityIndicator color={colors.text} /> : <Button kind="primary" label="Kaydet" onPress={save} />}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
