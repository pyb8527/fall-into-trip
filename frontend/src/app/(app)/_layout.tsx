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
      {/* 갈래에서 바로 열리는 화면들입니다. 위층은 홈입니다 — 여기서
          뒤로를 눌러 「내 여행」이 뜨면, 보석함을 보다가 엉뚱한 데로
          옮겨진 셈이 됩니다. */}
      <Stack.Screen name="trips" options={stackHeader('내 여행', { up: '/(app)/home' })} />
      <Stack.Screen name="saved" options={stackHeader('보석함', { up: '/(app)/home' })} />
      {/* 제목을 화면 안에 두므로 막대를 감춥니다 — 홈과 같은 방식입니다. */}
      <Stack.Screen name="money" options={{ headerShown: false }} />
      {/* 「여럿이 간 곳」 이었습니다. 무엇이 있는지는 말해 주는데 왜
          봐야 하는지는 안 말합니다 — 여럿이 갔다는 것은 셈이고, 지금
          뜬다는 것은 갈 만하다는 뜻입니다. */}
      <Stack.Screen
        name="popular"
        options={stackHeader('지금 뜨는 여행지', { up: '/(app)/home' })}
      />
      {/* 적어 두지 않으면 머리글에 길 이름이 그대로 뜹니다 — 「search」
          라고 적혀 있었습니다. */}
      <Stack.Screen name="search" options={stackHeader('검색', { up: '/(app)/home' })} />
      <Stack.Screen name="news" options={stackHeader('소식', { up: '/(app)/home' })} />
      <Stack.Screen name="settings" options={stackHeader('내 계정', { up: '/(app)/home' })} />
    </Stack>
  );
}
