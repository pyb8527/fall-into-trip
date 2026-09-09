import { Stack, ThemeProvider, type Theme as NavTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { Colors, Type, Weight } from '@/constants/theme';

/**
 * 앱 전체를 감싸는 껍데기.
 *
 * <p>로그인 상태는 여기 한 번만 두고, 화면들은 useAuth() 로 꺼내 씁니다.
 * 어느 화면으로 보낼지는 각 그룹의 _layout 이 정합니다.
 *
 * <p>기기가 어두운 모드여도 밝은 화면 한 벌로만 그립니다. 그래서
 * useColorScheme 을 보지 않습니다.
 */

/**
 * 시작 화면을 우리가 직접 내립니다.
 *
 * 그대로 두면 화면이 그려지자마자 사라지는데, 그때는 아직 로그인 확인이
 * 끝나기 전이라 "확인하는 중" 이 잠깐 번쩍였다가 진짜 화면으로 바뀝니다.
 * 확인이 끝날 때까지 로고를 붙들고 있다가 한 번에 넘깁니다.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  /* 이미 사라졌거나 이 플랫폼에 시작 화면이 없을 수 있습니다. 막을 일은 아닙니다. */
});

/** 화면 위쪽 막대와 뒤로가기 색을 우리 팔레트에 맞춥니다. */
const navigationTheme: NavTheme = {
  dark: false,
  colors: {
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: 'transparent',
    notification: Colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '600' },
    heavy: { fontFamily: 'System', fontWeight: '700' },
  },
};

export default function RootLayout() {
  return (
    /* 노치·홈 인디케이터 크기를 화면들이 물어볼 수 있게 가장 바깥에 둡니다. */
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="dark" />
          <SplashGate />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: Colors.text,
              headerStyle: { backgroundColor: Colors.background },
              headerTitleStyle: {
                fontSize: Type.body.fontSize,
                fontWeight: Weight.semibold,
                color: Colors.text,
              },
              contentStyle: { backgroundColor: Colors.background },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="trip/[id]" options={{ title: '일정' }} />
            <Stack.Screen name="travel/[id]" options={{ title: '여행 중' }} />
            <Stack.Screen name="vote/[id]" options={{ title: '가고 싶은 곳' }} />
            <Stack.Screen name="community" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** 로그인 확인이 끝나면 시작 화면을 내립니다. 그리는 것은 없습니다. */
function SplashGate() {
  const { ready } = useAuth();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {
        /* 이미 사라진 뒤일 수 있습니다. */
      });
    }
  }, [ready]);

  return null;
}
