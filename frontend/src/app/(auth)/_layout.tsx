import { type Href, Redirect, Stack, useGlobalSearchParams } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';

/**
 * 돌아갈 곳을 고릅니다.
 *
 * <p>주소에 실려 오는 값은 바깥에서 들어오는 것입니다. 그대로 믿고 보내면,
 * 남이 만든 링크로 우리 로그인 화면을 거쳐 엉뚱한 사이트로 튕겨 보낼 수
 * 있습니다. 우리 안의 경로만 받습니다.
 */
function safeNext(next?: string): Href | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return null;
  }
  return next as Href;
}

/** 이미 로그인한 사람이 로그인 화면에 머무를 이유가 없습니다. */
export default function AuthLayout() {
  const { ready, user } = useAuth();
  const { next } = useGlobalSearchParams<{ next?: string }>();

  if (ready && user) {
    /* 초대 링크를 눌렀다가 로그인하러 온 경우처럼 원래 가려던 곳이 있으면
       거기로 돌려보냅니다. 없으면 첫 화면입니다. */
    return <Redirect href={safeNext(next) ?? '/(app)/home'} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
