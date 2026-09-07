import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Loading, Screen } from '@/ui';

/**
 * 로그인한 사람만 지나갑니다.
 *
 * 서버도 같은 것을 확인하므로 여기서 막는 것은 안전장치가 아니라 화면
 * 흐름을 위한 것입니다. 진짜 차단은 서버가 합니다.
 */
export default function AppLayout() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading label="확인하는 중…" />
      </Screen>
    );
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      {/* 첫 화면은 제목 대신 로고를 본문 안에 두므로 막대를 감춥니다. */}
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="trips" options={{ title: '내 여행' }} />
      <Stack.Screen name="settings" options={{ title: '내 계정' }} />
    </Stack>
  );
}
