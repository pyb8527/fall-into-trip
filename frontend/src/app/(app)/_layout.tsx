import { Redirect, Stack, useRouter } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { IconButton, Loading, Screen } from '@/ui';

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

  /**
   * 돌아갈 데가 없을 때만 화살표를 답니다.
   *
   * <p>anchor 로 대개는 밑에 첫 화면이 깔리지만, 다른 화면에서 이리로
   * 갈아치우며 들어오면(예: 여행을 지우고 목록으로) 그 층에 이것 하나만
   * 남습니다. 그때는 화살표가 아예 생기지 않습니다.
   *
   * <p>기록이 있으면 손대지 않고 네비게이션이 만든 것을 그대로 씁니다.
   */
  function backTo(title: string) {
    return ({ navigation }: { navigation: { canGoBack: () => boolean } }) => ({
      title,
      headerLeft: navigation.canGoBack()
        ? undefined
        : () => (
            <IconButton
              name="chevron-left"
              label="처음으로"
              bare
              onPress={() => router.replace('/(app)/home')}
            />
          ),
    });
  }

  return (
    <Stack>
      {/* 첫 화면은 제목 대신 로고를 본문 안에 두므로 막대를 감춥니다. */}
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="trips" options={backTo('내 여행')} />
      <Stack.Screen name="saved" options={backTo('보관함')} />
      <Stack.Screen name="settings" options={backTo('내 계정')} />
    </Stack>
  );
}
