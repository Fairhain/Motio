import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthProvider } from "@/context/AuthContext";
import { getDb } from '@/services/database';
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';



export default function RootLayout() {

  useEffect(() => {
    (async () => {
      await getDb();
      console.log('Database initialized ✅');
    })();
  }, []);
  return <AuthProvider > 
    <GestureHandlerRootView style={{ flex: 1 }}>
    <StatusBar barStyle="dark-content" backgroundColor="white" />

    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"  />
      <Stack.Screen name="drivingSession" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="auth/signIn"  />
      <Stack.Screen name="auth/signUp" />
      <Stack.Screen name="otherProfile" />
      <Stack.Screen name="friends/friends" />
      <Stack.Screen name="friends/addFriends" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="hotspots" />

    </Stack>
  </GestureHandlerRootView>

  </AuthProvider>
}
