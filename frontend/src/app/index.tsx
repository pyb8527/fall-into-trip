import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { Loading, Screen } from '@/ui';

/**
 * 어디로 보낼지 정하는 자리.
 *
 * 첫 확인(리프레시 쿠키로 조용히 로그인)이 끝나기 전에 화면을 고르면,
 * 이미 로그인한 사람에게 로그인 화면이 잠깐 번쩍였다가 사라집니다.
 */
export default function Entry() {
  const { ready, user, setupNeeded } = useAuth();

  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading label="확인하는 중…" />
      </Screen>
    );
  }
  if (user) {
    return <Redirect href="/(app)/trips" />;
  }
  /* 운영자가 아직 없는 서버입니다. 로그인할 계정 자체가 없습니다. */
  if (setupNeeded) {
    return <Redirect href="/(auth)/setup" />;
  }
  return <Redirect href="/(auth)/login" />;
}
