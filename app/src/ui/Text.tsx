import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { makeStyles } from './themes';

interface Props extends Omit<TextProps, 'style' | 'children'> {
  dim?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

const useStyles = makeStyles(({ colors, typeScale }) =>
  StyleSheet.create({
    title: { ...typeScale.title, fontWeight: '700', color: colors.text },
    body: { ...typeScale.body, color: colors.text },
    caption: { ...typeScale.caption, color: colors.text },
    label: { ...typeScale.label, fontWeight: '600', color: colors.text },
    dim: { color: colors.textDim },
  }),
);

function make(variant: 'title' | 'body' | 'caption' | 'label') {
  return function StyledText({ dim, style, children, ...rest }: Props) {
    const styles = useStyles();
    return (
      <RNText {...rest} style={[styles[variant], dim && styles.dim, style]}>
        {children}
      </RNText>
    );
  };
}

export const Title = make('title');
export const Body = make('body');
export const Caption = make('caption');

const LabelBase = make('label');

/** Letter-spaced caps, uppercased with the Turkish locale (i → İ). */
export function Label({ children, ...rest }: Omit<Props, 'children'> & { children: string }) {
  return <LabelBase {...rest}>{children.toLocaleUpperCase('tr-TR')}</LabelBase>;
}
