import { Pressable, StyleSheet, View } from 'react-native';
import { Caption } from './Text';
import { makeStyles } from './themes';

type Option = string | number;

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
    chip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
      paddingVertical: space.s,
      paddingHorizontal: space.m,
    },
    selected: { backgroundColor: colors.accent, borderColor: colors.accent },
    selectedText: { color: colors.onAccent },
  }),
);

interface ChipsProps<T extends Option> {
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
}

/** One choice or none: tapping the selected chip clears it. */
export function SingleChips<T extends Option>({ options, labels, value, onChange }: ChipsProps<T> & { value: T | null; onChange(value: T | null): void }) {
  return <ChipRow options={options} labels={labels} isSelected={(o) => o === value} onToggle={(o) => onChange(o === value ? null : o)} />;
}

/** Any number of choices. */
export function MultiChips<T extends Option>({ options, labels, value, onChange }: ChipsProps<T> & { value: readonly T[]; onChange(value: T[]): void }) {
  return (
    <ChipRow
      options={options}
      labels={labels}
      isSelected={(o) => value.includes(o)}
      onToggle={(o) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])}
    />
  );
}

function ChipRow<T extends Option>({ options, labels, isSelected, onToggle }: ChipsProps<T> & { isSelected(o: T): boolean; onToggle(o: T): void }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = isSelected(option);
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onToggle(option)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Caption style={selected && styles.selectedText}>{labels[option]}</Caption>
          </Pressable>
        );
      })}
    </View>
  );
}
