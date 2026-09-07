import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Loading, Screen } from '@/ui';

/**
 * 운영 화면의 문.
 *
 * 여기서 막는 것은 화면 흐름을 위한 것입니다. 진짜 차단은 서버가 합니다.
 * 서버는 토큰의 역할만 믿지 않고 요청마다 계정을 다시 확인합니다.
 */
export default function AdminLayout() {
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
  if (user.role !== 'ADMIN') {
    return <Redirect href="/(app)/trips" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '운영' }} />
      <Stack.Screen name="users" options={{ title: '계정 관리' }} />
      <Stack.Screen name="audit" options={{ title: '감사 로그' }} />
    </Stack>
  );
}
