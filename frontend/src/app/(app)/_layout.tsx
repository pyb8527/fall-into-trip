import { Redirect, Stack, useRouter } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Loading, Screen } from '@/ui';
import { stackHeader } from '@/ui/nav';

/**
 * 주소로 곧장 들어왔을 때 밑에 깔아 둘 화면.
 *
 * <p>뒤로가기 화살표는 네비게이션이 쌓아 둔 기록을 보고 만듭니다. 그래서
 * 브라우저에서 /trips 나 /settings 를 새로고침하면 이 스택에 그 화면 하나만 들어가고,
 * 밑에 아무것도 없어 화살표가 생기지 않습니다.
 *
 * <p>anchor 를 두면 그럴 때 home 을 밑에 깔아 줍니다. 이 층은 이미
 * 로그인을 요구하므로 밑에 하나 더 깔린다고 달라질 것이 없습니다.
 */
export const unstable_settings = { anchor: 'home' };

/**
 * 로그인한 사람만 지나갑니다.
 *
 * 서버도 같은 것을 확인하므로 여기서 막는 것은 안전장치가 아니라 화면
 * 흐름을 위한 것입니다. 진짜 차단은 서버가 합니다.
 */
export default function AppLayout() {
  const { ready, user } = useAuth();
  const router = useRouter();

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
      <Stack.Screen name="trips" options={stackHeader('내 여행')} />
      <Stack.Screen name="saved" options={stackHeader('보석함')} />
      <Stack.Screen name="news" options={stackHeader('소식')} />
      <Stack.Screen name="settings" options={stackHeader('내 계정')} />
    </Stack>
  );
}
