import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';

/** 이미 로그인한 사람이 로그인 화면에 머무를 이유가 없습니다. */
export default function AuthLayout() {
  const { ready, user } = useAuth();

  if (ready && user) {
    return <Redirect href="/(app)/home" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
