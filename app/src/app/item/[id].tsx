import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { CHOSEN_STATUSES, type ChosenStatus } from '../../core/tags';
import { getItem, getPhoto, setItemStatus, updateItem, type Item, type Photo } from '../../data/items';
import { draftFromTags, tagsFromDraft, type TagDraft } from '../../features/items/draft';
import { ItemForm } from '../../features/items/ItemForm';
import { PhotoImage } from '../../features/items/PhotoImage';
import { itemTitle, tagRows } from '../../features/items/summary';
import { useAppData, useDb } from '../../state/AppData';
import { Button } from '../../ui/Button';
import { SingleChips } from '../../ui/Chips';
import { CHOSEN_STATUS_TR, CUTOUT_TR, PHOTO_KIND_TR } from '../../ui/labels';
import { Body, Caption, Label } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2 },
    photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden' },
    row: { gap: space.xs },
    error: { color: colors.dangerText },
  }),
);

/** One item: its photo, tags and status, and the same form as the add screen to edit them (spec §11 "Parça"). */
export default function ItemScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { revision, changed } = useAppData();
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [photo, setPhoto] = useState<Photo | null>(null);
  // Set while editing.
  const [draft, setDraft] = useState<TagDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = await getItem(db, id);
      const primary = found?.primaryPhotoId ? await getPhoto(db, found.primaryPhotoId) : null;
      if (!live) return;
      setItem(found);
      setPhoto(primary);
    })().catch(() => {
      if (live) setMessage('Parça okunamadı.');
    });
    return () => {
      live = false;
    };
  }, [db, id, revision]);

  if (item === undefined) return <View style={styles.root}>{message !== null && <Caption style={styles.error}>{message}</Caption>}</View>;
  if (item === null) {
    return (
      <View style={styles.root}>
        <Body dim>Bu parça bulunamadı.</Body>
      </View>
    );
  }

  const chooseStatus = async (status: ChosenStatus | null) => {
    if (status === null || status === item.status) return;
    setMessage(null);
    try {
      await setItemStatus(db, item.id, status);
      changed();
    } catch {
      setMessage('Durum kaydedilemedi, tekrar dene.');
    }
  };

  const saveEdit = async () => {
    if (draft === null) return;
    const result = tagsFromDraft(draft);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    try {
      await updateItem(db, item.id, result.tags);
      setDraft(null);
      setMessage(null);
      changed();
    } catch {
      setMessage('Kaydedilemedi, tekrar dene.');
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <Stack.Screen options={{ title: itemTitle(item) }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.photo}>
          <PhotoImage photoId={item.primaryPhotoId} size="display" />
        </View>
        {photo !== null && (
          <Caption dim>
            {PHOTO_KIND_TR[photo.kind]} · {CUTOUT_TR[photo.cutoutState]}
          </Caption>
        )}
        <Label dim>Durum</Label>
        <SingleChips options={CHOSEN_STATUSES} labels={CHOSEN_STATUS_TR} value={item.status === 'draft' ? null : item.status} onChange={chooseStatus} />
        {draft === null ? (
          <>
            {tagRows(item).map((row) => (
              <View key={row.label} style={styles.row}>
                <Caption dim>{row.label}</Caption>
                <Body>{row.value}</Body>
              </View>
            ))}
            {message !== null && <Caption style={styles.error}>{message}</Caption>}
            <Button
              label="Düzenle"
              onPress={() => {
                setMessage(null);
                setDraft(draftFromTags(item));
              }}
            />
          </>
        ) : (
          <>
            <ItemForm draft={draft} onChange={setDraft} />
            {message !== null && <Caption style={styles.error}>{message}</Caption>}
            <Button kind="primary" label="Kaydet" onPress={saveEdit} />
            <Button
              label="Vazgeç"
              onPress={() => {
                setMessage(null);
                setDraft(null);
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
