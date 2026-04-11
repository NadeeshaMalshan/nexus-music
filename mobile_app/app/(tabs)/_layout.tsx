import React from 'react';
import { View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { MiniPlayerBar } from '@/src/components/echoai/MiniPlayerBar';
import { useThemePalette } from '@/src/theme/useThemePalette';

function TabBarWithMiniPlayer(props: BottomTabBarProps) {
  return (
    <View>
      <MiniPlayerBar />
      <BottomTabBar {...props} />
    </View>
  );
}

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const p = useThemePalette();

  return (
    <Tabs
      tabBar={(props) => <TabBarWithMiniPlayer {...props} />}
      screenOptions={{
        tabBarActiveTintColor: p.playAccent,
        tabBarInactiveTintColor: p.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.6,
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: p.tabBar,
          borderTopColor: p.tabBarBorder,
          paddingTop: 6,
          height: 62,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'HOME',
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'SEARCH',
          tabBarLabel: 'SEARCH',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'LIBRARY',
          tabBarLabel: 'LIBRARY',
          tabBarIcon: ({ color }) => <TabBarIcon name="music" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarLabel: 'SETTINGS',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
