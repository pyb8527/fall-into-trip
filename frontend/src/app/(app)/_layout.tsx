import { Redirect, Stack, useRouter } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Colors } from '@/constants/theme';
import { Loading, Screen } from '@/ui';
import { SidebarWidth, useWide } from '@/ui/layout';
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
  /*
    넓은 화면에서 갈래가 왼쪽 기둥으로 섭니다(ui/tab-bar).

    <h3>기둥을 세우는 쪽과 자리를 비우는 쪽이 다릅니다</h3>

    <p>기둥은 아래 갈래 띠를 달던 화면이 그대로 답니다 — 띠가 모양만 바뀐
    것이라 다는 자리도 그대로입니다. 그런데 기둥은 창에 붙어 떠 있어서
    <b>자리를 차지하지 못합니다.</b> 비워 두지 않으면 본문 왼쪽 240 이
    기둥 뒤로 들어갑니다.

    <p>그래서 비우는 일은 층이 합니다. 띠를 다는 화면에만 비웁니다 — 띠가
    없는 화면(검색·알림·내 계정 …)까지 비우면 거기에는 아무것도 없는 240 이
    남습니다.
  */
  const wide = useWide();
  const rail = wide ? { paddingLeft: SidebarWidth, backgroundColor: Colors.background } : undefined;

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
      <Stack.Screen name="home" options={{ headerShown: false, contentStyle: rail }} />
      {/* 갈래에서 바로 열리는 화면들입니다. 위층은 홈입니다 — 여기서
          뒤로를 눌러 「내 여행」이 뜨면, 보석함을 보다가 엉뚱한 데로
          옮겨진 셈이 됩니다. */}
      <Stack.Screen
        name="trips"
        options={stackHeader('내 여행', { up: '/(app)/home', rail: wide })}
      />
      <Stack.Screen name="groups" options={stackHeader('모임', { up: '/(app)/home', rail: wide })} />
      <Stack.Screen name="saved" options={stackHeader('저장', { up: '/(app)/home', rail: wide })} />
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
      <Stack.Screen name="news" options={stackHeader('알림', { up: '/(app)/home' })} />
      {/*
        마이페이지.

        <p>제 상단바를 직접 세웠습니다(큰 제목 + 뒤로). 그래서 뒤로 단추가
        이 화면만 안쪽 80 자리에 섰고, 검색·모임 상세는 왼쪽 끝 40 이었습니다.
        홈 막대에서 들어오는 하위 화면이라 다른 하위 화면과 같은 막대를
        씁니다 — 뒤로 + 작은 제목. 남의 페이지면 화면이 제목을 그 사람
        이름으로 바꿉니다.
      */}
      <Stack.Screen name="me" options={stackHeader('내 페이지', { up: '/(app)/home' })} />
      <Stack.Screen name="settings" options={stackHeader('내 계정', { up: '/(app)/me' })} />
    </Stack>
  );
}
