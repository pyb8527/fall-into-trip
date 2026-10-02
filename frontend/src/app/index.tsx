import { Redirect } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';

/**
 * 앱 시작 화면과 같은 것. app.json 의 expo-splash-screen 설정을 그대로
 * 옮겨 둡니다 — 한쪽만 고치면 시작할 때 화면이 다시 두 번 바뀝니다.
 */
const SPLASH_BG = '#6D5BF6';
const SPLASH_WIDTH = 120;

/**
 * 어디로 보낼지 정하는 자리.
 *
 * <p>첫 확인(리프레시 쿠키로 조용히 로그인)이 끝나기 전에 화면을 고르면,
 * 이미 로그인한 사람에게 로그인 화면이 잠깐 번쩍였다가 사라집니다.
 *
 * <p>기다리는 동안에는 시작 화면과 같은 모양을 보여 줍니다. 앱에서는
 * expo-splash-screen 이 로고를 붙들고 있고, 웹에는 그런 것이 없으므로
 * 여기가 그 자리를 대신합니다. 둘의 생김새가 같아야 넘어갈 때 튀지 않습니다.
 */
export default function Entry() {
  const { ready, user, setupNeeded } = useAuth();

  if (!ready) {
    return <Splash />;
  }
  if (user) {
    return <Redirect href="/(app)/home" />;
  }
  /* 운영자가 아직 없는 서버입니다. 로그인할 계정 자체가 없습니다. */
  if (setupNeeded) {
    return <Redirect href="/(auth)/setup" />;
  }
  /*
    로그인 안 한 사람을 곧장 로그인 화면으로 보내지 않습니다.

    처음 온 사람에게 로그인 화면은 아무것도 말해 주지 않는 화면입니다.
    여기가 무엇을 하는 곳인지 모르는 채로 이메일부터 내라고 하는 셈이라
    대부분 거기서 닫습니다. 둘러보기는 계정 없이도 되므로, 먼저 그것을
    권하고 계정은 필요해질 때 부릅니다.

    다시 온 사람은 대개 리프레시 쿠키가 살아 있어 위에서 이미 걸러졌고,
    끊긴 사람에게는 그 화면 안에 로그인 단추가 있습니다.
  */
  return <Redirect href="/(auth)/welcome" />;
}

/*
  시작 화면.

  <p>흰 바탕에 로고와 도는 표시를 그렸습니다. 그런데 그 앞에 앱(네이티브)과
  웹 머리(+html)의 시작 화면이 <b>바이올렛 바탕에 그림 하나</b>로 이미 떠
  있어서, 켤 때마다 바이올렛 → 흰 로고 → 첫 화면으로 두 번 바뀌었습니다.

  <p>앞의 것과 똑같이 그립니다 — 같은 바탕, 같은 그림, 같은 자리와 크기.
  그러면 넘어가는 자리가 안 보이고 한 장으로 읽힙니다. 도는 표시는
  뺍니다. 앞의 시작 화면에도 없습니다.
*/
function Splash() {
  return (
    <View style={styles.splash}>
      <Image
        source={require('../../assets/images/splash-icon.png')}
        style={styles.mark}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
  mark: {
    width: SPLASH_WIDTH,
    height: SPLASH_WIDTH,
  },
});
