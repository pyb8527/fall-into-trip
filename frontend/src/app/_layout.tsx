import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/auth/auth-provider';

/**
 * 앱 전체를 감싸는 껍데기.
 *
 * 로그인 상태는 여기 한 번만 두고, 화면들은 useAuth() 로 꺼내 씁니다.
 * 어느 화면으로 보낼지는 각 그룹의 _layout 이 정합니다.
 */
export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="trip/[id]" options={{ title: '일정' }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
