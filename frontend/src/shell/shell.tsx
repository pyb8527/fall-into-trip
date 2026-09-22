import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { answer } from '@/shell/answer';
import { onNotificationTap, tappedToOpen } from '@/shell/push';
import { SITE, ours } from '@/shell/site';
import { speak, type Envelope } from '@/shell/talk';

/**
 * 앱 껍데기.
 *
 * <p>웹을 띄우고, 폰만 할 수 있는 일을 거들어 줍니다. 화면은 웹이 그립니다.
 *
 * <h3>껍데기가 맡는 것</h3>
 *
 * <ul>
 *   <li>뒤로가기 단추 — 웹 안에서 한 칸 물러납니다. 물러날 데가 없을 때만
 *       앱이 닫힙니다</li>
 *   <li>남의 자리 — 구글 지도나 예약 사이트는 폰의 브라우저로 내보냅니다.
 *       앱 안에서 열면 돌아올 길이 우리 화면 기록과 섞입니다</li>
 *   <li>시작 화면 — 웹이 첫 그림을 낼 때까지 붙들고 있습니다</li>
 *   <li>안 열릴 때 — 흰 화면 대신 무슨 일인지 말하고 다시 열 길을 냅니다</li>
 * </ul>
 */

/* 웹이 첫 그림을 낼 때까지 붙들고 있습니다. 라우터를 안 거치므로 여기서
   직접 막아야 합니다. */
SplashScreen.preventAutoHideAsync().catch(() => {
  /* 이미 사라졌거나 이 플랫폼에 시작 화면이 없을 수 있습니다. */
});

/**
 * 웹에게 "지금 앱 껍데기 안" 이라고 알려 줍니다.
 *
 * <p>첫 줄이 그려지기 <b>전에</b> 넣습니다. 웹이 뜨고 나서 알려 주면 그
 * 사이에 이미 브라우저인 줄 알고 움직인 코드가 있습니다.
 *
 * <p>웹 쪽은 이 표시를 보고 폰만 할 수 있는 일을 껍데기에 넘깁니다.
 * 표시가 없으면 지금까지처럼 브라우저의 것을 씁니다 — 그래서 이 값이
 * 없어도 웹은 그대로 돕니다.
 */
const TELL = `
  window.FIT_SHELL = ${JSON.stringify({ version: 1, os: Platform.OS })};
  true;
`;

export function Shell() {
  return (
    <SafeAreaProvider>
      <Inside />
    </SafeAreaProvider>
  );
}

function Inside() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);

  /* 뒤로갈 데가 있는지. 웹뷰가 화면을 옮길 때마다 알려 줍니다. */
  const canBack = useRef(false);
  const [broken, setBroken] = useState<string | null>(null);
  /* 다시 열기를 누를 때마다 웹뷰를 새로 세웁니다. reload 는 망가진 자리에서
     다시 망가지는 일이 잦습니다. */
  const [attempt, setAttempt] = useState(0);

  /*
    안드로이드 뒤로가기.

    <p>앱을 닫는 대신 웹 안에서 한 칸 물러납니다. 안 그러면 여행 상세에서
    뒤로가기를 눌렀을 때 목록이 아니라 앱이 닫힙니다 — 폰에서 제일
    당황스러운 일입니다.
  */
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canBack.current) {
        web.current?.goBack();
        return true;
      }
      /* 물러날 데가 없습니다. 폰이 하던 대로 앱을 닫습니다. */
      return false;
    });
    return () => sub.remove();
  }, []);

  const moved = useCallback((e: WebViewNavigation) => {
    canBack.current = e.canGoBack;
  }, []);

  /*
    남의 자리는 폰이 받습니다.

    <p>우리 자리면 안에서 그대로 띄웁니다. 아니면 웹뷰는 안 가고 폰에게
    넘깁니다 — 구글 지도 길찾기, 예약 사이트, tel:, mailto: 같은 것들입니다.
  */
  const goingTo = useCallback((e: WebViewNavigation) => {
    if (ours(e.url)) {
      return true;
    }
    Linking.openURL(e.url).catch(() => {
      /* 받아 줄 앱이 없습니다. 아무 일도 안 일어나는 편이 낫습니다 —
         여기서 화면을 띄우면 잘못 눌렀을 때마다 걸립니다. */
    });
    return false;
  }, []);

  const shown = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  /** 웹에 한마디 넣습니다. 웹뷰가 아직 없으면 조용히 버립니다. */
  const say = useCallback((code: string) => {
    web.current?.injectJavaScript(code);
  }, []);

  /*
    웹의 부탁을 받습니다.

    <p>부탁 하나에 답 하나. 실패도 답입니다 — 아무 말도 안 하면 웹은 영영
    "기다리는 중" 으로 남습니다. 그것이 제일 나쁩니다.
  */
  const heard = useCallback(
    async (raw: string) => {
      let envelope: Envelope;
      try {
        envelope = JSON.parse(raw) as Envelope;
      } catch {
        /* 우리 말이 아닙니다. 웹 안의 다른 코드가 postMessage 를 쓸 수도
           있으므로 조용히 넘깁니다. */
        return;
      }
      if (!envelope?.id || !envelope.ask?.kind) {
        return;
      }

      try {
        const value = await answer(envelope.ask);
        say(speak({ kind: 'done', id: envelope.id, value }));
      } catch (e) {
        say(speak({ kind: 'failed', id: envelope.id, why: (e as Error).message }));
      }
    },
    [say],
  );

  /*
    알림을 눌러 들어왔을 때.

    <p>어디로 갈지는 웹이 압니다. 주소만 건네줍니다.

    <p>앱이 꺼져 있었을 때는 듣는 자리가 아직 없으므로 한 번 물어봐야
    합니다 — 안 물어보면 알림을 눌렀는데 첫 화면이 뜹니다.
  */
  useEffect(() => {
    const go = (url: string) => say(speak({ kind: 'opened', url }));
    tappedToOpen().then((url) => {
      if (url) {
        go(url);
      }
    });
    return onNotificationTap(go);
  }, [say]);

  if (!SITE) {
    /* 빌드에 주소를 안 넣었습니다. 흰 화면으로 두면 앱이 고장 난 것처럼
       보이므로 그렇다고 말합니다. */
    return (
      <Sorry
        title="어디로 가야 할지 모릅니다"
        body="이 빌드에 서버 주소가 안 들어갔습니다. 다시 빌드해야 합니다."
      />
    );
  }

  if (broken) {
    return (
      <Sorry
        title="열 수가 없습니다"
        body={broken}
        onRetry={() => {
          setBroken(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    /* 위쪽은 상태 표시줄만큼 비웁니다. 아래는 웹이 제 안에서 씁니다 —
       하단 띠가 화면 맨 아래에 붙어야 하기 때문입니다. */
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <WebView
        key={attempt}
        ref={web}
        source={{ uri: SITE }}
        style={styles.fill}
        /* 웹이 칠하기 전까지 흰 판이 아니라 우리 바탕색입니다. */
        containerStyle={styles.fill}
        injectedJavaScriptBeforeContentLoaded={TELL}
        onNavigationStateChange={moved}
        onShouldStartLoadWithRequest={goingTo}
        onLoadEnd={shown}
        onMessage={(e) => heard(e.nativeEvent.data)}
        onError={(e) => {
          setBroken(e.nativeEvent.description || '인터넷에 닿지 못했습니다.');
          shown();
        }}
        onHttpError={(e) => {
          /* 페이지 안의 그림 하나가 404 인 것과 화면 자체가 안 열린 것은
             다릅니다. 화면일 때만 말합니다. */
          if (e.nativeEvent.url === SITE || e.nativeEvent.url === `${SITE}/`) {
            setBroken(`서버가 ${e.nativeEvent.statusCode} 를 돌려주었습니다.`);
            shown();
          }
        }}
        /* 지도에서 지금 자리를 쓸 수 있게 합니다. 권한 자체는 폰이 묻습니다. */
        geolocationEnabled
        /* 저장해 둔 여행과 로그인 상태가 앱을 껐다 켜도 남아 있어야 합니다. */
        domStorageEnabled
        /* 창을 새로 여는 링크도 이 안에서 처리합니다. 안 그러면 안드로이드
           에서 target=_blank 링크가 아무 일도 안 한 것처럼 보입니다. */
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        /* 스스로 도는 소리·영상에 손을 안 대게 합니다. */
        mediaPlaybackRequiresUserAction
      />
    </View>
  );
}

/**
 * 안 될 때 보여 주는 화면.
 *
 * <p>껍데기가 그리는 유일한 화면입니다. 웹을 못 띄웠을 때 쓰는 것이라
 * 웹의 글꼴이나 색을 못 가져옵니다 — 여기 값을 직접 적습니다.
 */
function Sorry({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={styles.sorry}>
      <StatusBar style="dark" />
      <Text style={styles.sorryTitle}>{title}</Text>
      <Text style={styles.sorryBody}>{body}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryLabel}>다시 열기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* 웹의 팔레트와 같은 값입니다(constants/theme). 여기서 그것을 불러오면
   껍데기가 화면 코드를 통째로 끌고 들어옵니다. 두 줄을 베껴 둡니다. */
const GROUND = '#FAFAFA';
const INK = '#191F28';
const FAINT = '#8B95A1';

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: GROUND,
  },
  sorry: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: GROUND,
  },
  sorryTitle: {
    fontSize: 18,
    color: INK,
    textAlign: 'center',
  },
  sorryBody: {
    fontSize: 14,
    lineHeight: 21,
    color: FAINT,
    textAlign: 'center',
  },
  retry: {
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: INK,
  },
  retryLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});
