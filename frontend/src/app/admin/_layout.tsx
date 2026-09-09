import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Loading, Screen } from '@/ui';
import { stackHeader } from '@/ui/nav';

/**
 * 주소로 곧장 들어왔을 때 밑에 깔아 둘 화면.
 *
 * <p>뒤로가기 화살표는 네비게이션이 쌓아 둔 기록을 보고 만듭니다. 그래서
 * 브라우저에서 /admin/users 나 /admin/audit 를 새로고침하면 이 스택에 그 화면 하나만 들어가고,
 * 밑에 아무것도 없어 화살표가 생기지 않습니다.
 *
 * <p>anchor 를 두면 그럴 때 index 을 밑에 깔아 줍니다. 이 층은 이미
 * 로그인을 요구하므로 밑에 하나 더 깔린다고 달라질 것이 없습니다.
 */
export const unstable_settings = { anchor: 'index' };

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
      <Stack.Screen name="index" options={stackHeader('운영')} />
      <Stack.Screen name="users" options={stackHeader('계정 관리')} />
      <Stack.Screen name="audit" options={stackHeader('감사 로그')} />
      <Stack.Screen name="posts" options={stackHeader('신고된 것')} />
    </Stack>
  );
}
