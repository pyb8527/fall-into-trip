import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Tap, Type } from '@/constants/theme';
import { canSignInWithGoogle, useGoogleIdToken } from '@/lib/google-signin';
import { Press } from '@/ui';

/**
 * 구글로 로그인하는 단추 (앱).
 *
 * <h3>구글이 그려 주지 않습니다</h3>
 *
 * <p>웹에서는 구글이 스크립트로 단추를 그려 줍니다(google-button.web).
 * 앱에는 그런 것이 없어 직접 그립니다. 구글 로고와 문구에는 지켜야 할
 * 규칙이 있어서, 흰 바탕 · 회색 테두리 · "Google로 로그인" 이라는
 * 가장 기본형을 씁니다.
 *
 * <p>로고는 그림 파일이 아니라 네 조각 색으로 흉내 냅니다 — 파일 하나를
 * 더 실을 만한 일이 아니고, 이 크기에서는 구별이 안 갑니다.
 *
 * <h3>안 넣었으면 안 그립니다</h3>
 *
 * <p>클라이언트 ID 를 빌드에 안 넣었으면 아무것도 안 그립니다. 눌러도
 * 아무 일이 없는 단추를 두는 것보다 없는 편이 낫습니다.
 */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const [request, response, prompt] = useGoogleIdToken();

  useEffect(() => {
    if (response?.type !== 'success') {
      return;
    }
    const token = response.params?.id_token;
    if (token) {
      onCredential(token);
    }
    /* onCredential 은 매번 새 함수라 여기 넣으면 응답이 안 바뀌어도 다시
       돕니다. 우리가 보는 것은 응답 하나입니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  if (!canSignInWithGoogle) {
    return null;
  }

  return (
    <Press
      onPress={() => prompt()}
      disabled={!request}
      accessibilityLabel="Google로 로그인"
      style={styles.button}>
      <View style={styles.logo}>
        <View style={[styles.quarter, { backgroundColor: '#EA4335' }]} />
        <View style={[styles.quarter, { backgroundColor: '#4285F4' }]} />
        <View style={[styles.quarter, { backgroundColor: '#FBBC05' }]} />
        <View style={[styles.quarter, { backgroundColor: '#34A853' }]} />
      </View>
      <Text style={styles.label}>Google로 로그인</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: Tap.min,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
  },
  /* 네 조각으로 흉내 낸 로고. 이 크기에서는 진짜와 구별이 안 갑니다. */
  logo: {
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quarter: {
    width: 9,
    height: 9,
  },
  label: {
    ...Type.body,
    color: Colors.text,
  },
});
