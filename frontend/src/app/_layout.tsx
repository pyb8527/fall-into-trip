import { Stack, ThemeProvider, usePathname, type Theme as NavTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { tellShellCanGoBack } from '@/lib/shell-bridge.web';
import { ShellInsets } from '@/lib/shell-insets.web';
import { listenForShellOpen } from '@/lib/shell-open.web';
import { Colors, Fonts, Type, Weight } from '@/constants/theme';
import { HandFont } from '@/ui/hand';
import { useWide } from '@/ui/layout';
import { stackHeader } from '@/ui/nav';
import { WANT } from '@/constants/words';

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
    primary: Colors.accentInk,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: 'transparent',
    notification: Colors.danger,
  },
  /*
    위쪽 막대의 글자도 화면 안과 같은 글꼴을 씁니다.

    <p>앱에서는 글꼴 이름이 비어 있습니다 — 기기 고딕을 그대로 쓰기
    때문입니다(Fonts). 빈 값을 넘기면 안드로이드가 글꼴을 못 찾을 수 있어
    'System' 으로 돌려 둡니다.
  */
  fonts: {
    regular: { fontFamily: Fonts.sans ?? 'System', fontWeight: '400' },
    medium: { fontFamily: Fonts.sans ?? 'System', fontWeight: '500' },
    bold: { fontFamily: Fonts.sans ?? 'System', fontWeight: '600' },
    heavy: { fontFamily: Fonts.sans ?? 'System', fontWeight: '700' },
  },
};

export default function RootLayout() {
  /*
    알림을 눌러 들어왔을 때 그 화면을 엽니다.

    <p>알림은 폰이 받지만(앱 껍데기) 어느 화면인지는 웹만 압니다. 껍데기가
    주소를 건네면 여기서 엽니다. 브라우저에서는 아무 일도 안 합니다.
  */
  useEffect(() => listenForShellOpen(), []);

  /*
    물러날 데가 있는지 껍데기에게 알립니다.

    <p>껍데기는 웹뷰가 주는 {@code canGoBack} 을 보고 물리 뒤로가기를
    처리했습니다. 그런데 그 신호는 <b>진짜 쪽 이동</b>에만 울립니다 — 이
    앱의 화면 이동은 전부 {@code history.pushState} 라서 한 번도 안
    울렸습니다. 그래서 여행 상세에 들어가 뒤로가기를 눌러도 껍데기는
    「물러날 데가 없다」고 알고, 뒤로 가는 대신 「한 번 더 누르면 나가요」를
    띄웠습니다.

    <p>길이를 아는 쪽이 말합니다. 웹뷰 안에서는 우리 자리가 기록의 처음이라,
    쌓인 것이 하나라도 있으면 돌아갈 데가 있습니다.
  */
  const here = usePathname();
  useEffect(() => {
    tellShellCanGoBack(typeof window !== 'undefined' && window.history.length > 1);
  }, [here]);

  /* 여행에 딸린 네 화면은 여행의 갈래 띠를 답니다. 넓은 화면에서 그 띠가
     왼쪽 기둥으로 서므로, 본문과 막대가 그만큼 비켜 앉아야 합니다
     (ui/nav 의 rail). */
  const wide = useWide();

  return (
    /* 노치·홈 인디케이터 크기를 화면들이 물어볼 수 있게 가장 바깥에 둡니다. */
    <SafeAreaProvider>
      {/* 앱 껍데기 안이면 폰이 아는 안전영역으로 갈아 끼웁니다. 브라우저면
          그냥 지나갑니다. */}
      <ShellInsets>
      <AuthProvider>
        {/* 제목에 쓰는 손글씨를 받아 둡니다. 기다리지는 않습니다 — 제목 하나
            때문에 첫 화면을 붙들고 있을 이유가 없고, 도착하면 조용히 갈아
            끼워집니다. */}
        <HandFont>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="dark" />
          <SplashGate />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: Colors.text,
              headerStyle: { backgroundColor: Colors.background },
              /*
                상단바 제목.

                <p>{@code title3}(18/600) 입니다. 본문과 같은 크기였는데,
                그러면 막대의 제목이 화면 안의 글과 같은 무게로 서서 「여기가
                어디인지」를 말해 주지 못합니다. 한 단 올립니다.
              */
              headerTitleStyle: {
                fontSize: Type.title3.fontSize,
                fontWeight: Weight.semibold,
                color: Colors.text,
              },
              contentStyle: { backgroundColor: Colors.background },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            {/* 여행에 딸린 화면들은 <b>여행 이름</b>이 부모입니다. 그 이름은
                여기서 알 수 없으므로 화면이 받아 온 뒤에 스스로 답니다
                (각 화면의 Stack.Screen). 여기 적는 것은 아직 못 받았을
                때 잠깐 보일 이름입니다. */}
            {/* 일정의 위층은 여행 목록입니다. 여기만 「내 여행」이 맞습니다. */}
            <Stack.Screen
              name="trip/[id]"
              options={stackHeader('일정', { up: '/(app)/trips', rail: wide })}
            />
            <Stack.Screen
              name="vote/[id]"
              options={stackHeader(WANT, { toTrip: true, rail: wide })}
            />
            <Stack.Screen
              name="card/[id]"
              options={stackHeader('여행 카드', { toTrip: true, rail: wide })}
            />
            <Stack.Screen
              name="money/[id]"
              options={stackHeader('가계부', { toTrip: true, rail: wide })}
            />
            {/* 모임 이름은 화면이 받아 온 뒤에 스스로 답니다. 여기 적는
                것은 아직 못 받았을 때 잠깐 보일 이름입니다. */}
            <Stack.Screen name="group/[id]" options={stackHeader('모임', { up: '/(app)/groups' })} />
            {/*
              피드 글 하나.

              <p>위층을 안 적습니다. 다른 화면들은 위층이 하나인데 — 일정의
              위는 내 여행이고 모임의 위는 모임 목록입니다 — 피드 글은 들어오는
              길이 셋입니다(마이페이지의 피드 칸, 모임의 피드, 여행 상세의
              앨범). 그중 하나를 위층이라고 적으면 나머지 둘로 들어온 사람이
              엉뚱한 데로 올라갑니다. 안 적으면 돌아갈 데가 없을 때만 처음으로
              갑니다.
            */}
            <Stack.Screen name="feed/[id]" options={stackHeader('피드 글')} />
            <Stack.Screen name="community" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
        </HandFont>
      </AuthProvider>
      </ShellInsets>
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
