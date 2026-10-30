import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHOSEN_STATUSES, SCALE, SEASONS, SLOTS, TEXTURES } from '../../core/tags';
import { DEFAULT_FILTER, matchesFilter, type WardrobeFilter } from '../../core/wardrobeFilter';
import { listItems, type Item } from '../../data/items';
import { PhotoImage } from '../../features/items/PhotoImage';
import { itemTitle } from '../../features/items/summary';
import { useAppData, useDb } from '../../state/AppData';
import { Button } from '../../ui/Button';
import { MultiChips } from '../../ui/Chips';
import { CHOSEN_STATUS_TR, FORMALITY_TR, SEASON_TR, SLOT_TR, TAB_TR, TEXTURE_TR } from '../../ui/labels';
import { Body, Caption, Label, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

/** Thumbnails per row: three on an iPhone 15 is about 120 pt each. */
const COLUMNS = 3;
/** One cell's width: a third of the row (`COLUMNS`). */
const CELL_WIDTH = '33.333%';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.m, paddingTop: space.m },
    filters: { paddingVertical: space.s, gap: space.s },
    grid: { paddingHorizontal: space.m - space.xs, paddingBottom: space.xl },
    cell: { width: CELL_WIDTH, aspectRatio: 1, padding: space.xs },
    cellInner: { flex: 1, borderRadius: radius.button, overflow: 'hidden' },
    note: { paddingVertical: space.m },
    error: { color: colors.dangerText },
  }),
);

/** The wardrobe: filters on top, a grid of thumbnails, "+ Ekle" (spec §11 "Gardırop"). */
export default function WardrobeScreen() {
  const styles = useStyles();
  const db = useDb();
  const { revision } = useAppData();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<WardrobeFilter>(DEFAULT_FILTER);
  const [moreFilters, setMoreFilters] = useState(false);

  useEffect(() => {
    let live = true;
    listItems(db).then(
      (list) => {
        if (!live) return;
        setItems(list);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [db, revision]);

  const visible = useMemo(() => (items ?? []).filter((item) => matchesFilter(item, filter)), [items, filter]);
  const set =
    <K extends keyof WardrobeFilter>(key: K) =>
    (value: WardrobeFilter[K]) =>
      setFilter((current) => ({ ...current, [key]: value }));

  const filters = (
    <View style={styles.filters}>
      <MultiChips options={SLOTS} labels={SLOT_TR} value={filter.slots} onChange={set('slots')} />
      <Button label={moreFilters ? 'Filtreleri gizle' : 'Diğer filtreler'} onPress={() => setMoreFilters((open) => !open)} />
      {moreFilters && (
        <>
          <Label dim>Durum</Label>
          <MultiChips options={CHOSEN_STATUSES} labels={CHOSEN_STATUS_TR} value={filter.statuses} onChange={set('statuses')} />
          <Label dim>Resmiyet</Label>
          <MultiChips options={SCALE} labels={FORMALITY_TR} value={filter.formality} onChange={set('formality')} />
          <Label dim>Mevsim</Label>
          <MultiChips options={SEASONS} labels={SEASON_TR} value={filter.seasons} onChange={set('seasons')} />
          <Label dim>Doku</Label>
          <MultiChips options={TEXTURES} labels={TEXTURE_TR} value={filter.textures} onChange={set('textures')} />
        </>
      )}
      {failed && <Caption style={styles.error}>Parçalar okunamadı. Uygulamayı kapatıp aç.</Caption>}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Title>{TAB_TR.index}</Title>
        <Button kind="primary" label="+ Ekle" onPress={() => router.push('/add')} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={filters}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={itemTitle(item)} onPress={() => router.push(`/item/${item.id}`)} style={styles.cell}>
            <View style={styles.cellInner}>
              <PhotoImage photoId={item.primaryPhotoId} size="thumb" />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          items === null ? undefined : (
            <Body dim style={styles.note}>
              {items.length === 0 ? 'Henüz parça yok. "+ Ekle" ile ilkini ekle.' : 'Bu filtrelere uyan parça yok.'}
            </Body>
          )
        }
      />
    </SafeAreaView>
  );
}
