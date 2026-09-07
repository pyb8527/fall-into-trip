import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Colors, Spacing } from '@/constants/theme';
import { LogoLockup } from '@/ui/logo';

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
  return <Redirect href="/(auth)/login" />;
}

function Splash() {
  return (
    <View style={styles.splash}>
      <LogoLockup size={80} />
      <ActivityIndicator color={Colors.textDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxxl,
    backgroundColor: Colors.surface,
  },
});
