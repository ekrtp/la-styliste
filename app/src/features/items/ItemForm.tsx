import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  COLORS, CONDITIONS, DETAILS, MATERIALS, PATTERNS, SCALE, SEASONS, SILHOUETTES, SLOTS, SUBCATEGORIES, TEXTURES,
  type Subcategory,
} from '../../core/tags';
import { MultiChips, SingleChips } from '../../ui/Chips';
import {
  COLOR_TR, CONDITION_TR, DETAIL_TR, FORMALITY_TR, MATERIAL_TR, PATTERN_TR, SEASON_TR, SILHOUETTE_TR, SLOT_TR,
  SUBCATEGORY_TR, TEXTURE_TR, WARMTH_TR,
} from '../../ui/labels';
import { Label } from '../../ui/Text';
import { makeStyles, useTheme } from '../../ui/themes';
import { withSlot, type TagDraft } from './draft';

const useStyles = makeStyles(({ colors, typeScale, shape: { space, radius } }) =>
  StyleSheet.create({
    form: { gap: space.l },
    field: { gap: space.s },
    input: {
      ...typeScale.body,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radius.button,
      paddingHorizontal: space.m,
      paddingVertical: space.s,
    },
    // Three lines of body text and the padding around them.
    notes: { minHeight: typeScale.body.lineHeight * 3 + space.m, textAlignVertical: 'top' },
  }),
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Label dim>{label}</Label>
      {children}
    </View>
  );
}

/** The manual tag form: every tag as chips, brand, price and notes as text. The caller owns the draft. */
export function ItemForm({ draft, onChange }: { draft: TagDraft; onChange(draft: TagDraft): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const set =
    <K extends keyof TagDraft>(key: K) =>
    (value: TagDraft[K]) =>
      onChange({ ...draft, [key]: value });
  const subcategories: readonly Subcategory[] = draft.slot === null ? [] : SUBCATEGORIES[draft.slot];

  return (
    <View style={styles.form}>
      <Field label="Tür">
        <SingleChips options={SLOTS} labels={SLOT_TR} value={draft.slot} onChange={(slot) => onChange(withSlot(draft, slot))} />
      </Field>
      {subcategories.length > 0 && (
        <Field label="Alt tür">
          <SingleChips options={subcategories} labels={SUBCATEGORY_TR} value={draft.subcategory} onChange={set('subcategory')} />
        </Field>
      )}
      <Field label="Renk">
        <MultiChips options={COLORS} labels={COLOR_TR} value={draft.colors} onChange={set('colors')} />
      </Field>
      <Field label="Malzeme">
        <SingleChips options={MATERIALS} labels={MATERIAL_TR} value={draft.material} onChange={set('material')} />
      </Field>
      <Field label="Doku">
        <SingleChips options={TEXTURES} labels={TEXTURE_TR} value={draft.texture} onChange={set('texture')} />
      </Field>
      <Field label="Desen">
        <SingleChips options={PATTERNS} labels={PATTERN_TR} value={draft.pattern} onChange={set('pattern')} />
      </Field>
      <Field label="Kesim">
        <SingleChips options={SILHOUETTES} labels={SILHOUETTE_TR} value={draft.silhouette} onChange={set('silhouette')} />
      </Field>
      <Field label="Resmiyet">
        <SingleChips options={SCALE} labels={FORMALITY_TR} value={draft.formality} onChange={set('formality')} />
      </Field>
      <Field label="Sıcaklık">
        <SingleChips options={SCALE} labels={WARMTH_TR} value={draft.warmth} onChange={set('warmth')} />
      </Field>
      <Field label="Mevsim (boşsa her mevsim)">
        <MultiChips options={SEASONS} labels={SEASON_TR} value={draft.seasons} onChange={set('seasons')} />
      </Field>
      <Field label="Detaylar">
        <MultiChips options={DETAILS} labels={DETAIL_TR} value={draft.details} onChange={set('details')} />
      </Field>
      <Field label="Kondisyon">
        <SingleChips options={CONDITIONS} labels={CONDITION_TR} value={draft.condition} onChange={set('condition')} />
      </Field>
      <Field label="Marka">
        <TextInput
          value={draft.brand}
          onChangeText={set('brand')}
          placeholder="Bilmiyorsan boş bırak"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          style={styles.input}
        />
      </Field>
      <Field label="Fiyat (TL)">
        <TextInput
          value={draft.price}
          onChangeText={set('price')}
          keyboardType="decimal-pad"
          placeholder="Örn. 1250"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />
      </Field>
      <Field label="Not">
        <TextInput value={draft.notes} onChangeText={set('notes')} multiline style={[styles.input, styles.notes]} />
      </Field>
    </View>
  );
}
