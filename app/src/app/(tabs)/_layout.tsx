import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { TAB_TR } from '../../ui/labels';
import { useTheme } from '../../ui/themes';

type TabName = keyof typeof TAB_TR;

/** The Ionicons glyph of each tab. */
const TAB_ICONS: Record<TabName, ComponentProps<typeof Ionicons>['name']> = {
  index: 'shirt-outline',
  outfits: 'layers-outline',
  today: 'sunny-outline',
  settings: 'settings-outline',
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.outline },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        // The navigator types `color` as any ColorValue; the tint colours above are plain strings.
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name as TabName]} color={color as string} size={size} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: TAB_TR.index }} />
      <Tabs.Screen name="outfits" options={{ title: TAB_TR.outfits }} />
      <Tabs.Screen name="today" options={{ title: TAB_TR.today }} />
      <Tabs.Screen name="settings" options={{ title: TAB_TR.settings }} />
    </Tabs>
  );
}
