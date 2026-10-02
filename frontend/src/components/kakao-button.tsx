import { Platform, StyleSheet, Text } from 'react-native';

import { Radius, Tap, Type } from '@/constants/theme';
import { Press } from '@/ui';

/**
 * 카카오로 들어가는 단추.
 *
 * <h3>웹에서만 그립니다</h3>
 *
 * <p>카카오 로그인은 브라우저가 페이지째 카카오로 갔다가 서버 주소로
 * 돌아오고, 서버가 그 자리에서 세션 쿠키를 심습니다. 앱은 그 쿠키를 같은
 * 자리에서 받을 길이 없어 지금은 안 그립니다 — 앱에서 하려면 카카오
 * 네이티브 SDK 와 다시 굽기(EAS)가 필요합니다.
 *
 * <h3>색은 카카오가 정합니다</h3>
 *
 * <p>노랑 바탕(#FEE500)에 85% 검정 글씨. 카카오 로그인 단추 규칙입니다 —
 * 이 앱의 색 토큰을 쓰지 않습니다.
 */
export const canSignInWithKakao = Platform.OS === 'web';

export function KakaoButton({
  label = '카카오로 시작하기',
  onPress,
}: {
  label?: string;
  /** 누르면 할 일 — 로그인(lib/kakao-signin)이나 잇기 */
  onPress: () => void;
}) {
  if (!canSignInWithKakao) {
    return null;
  }
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.button}>
      <Text style={styles.bubble}>●</Text>
      <Text style={styles.label}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  /* 폭은 구글 단추와 맞춥니다(240~360). 둘이 위아래로 서는데 폭이 다르면
     하나가 덜 된 것처럼 보입니다. */
  button: {
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
    marginHorizontal: 'auto',
    minHeight: Tap.min,
    borderRadius: Radius.md,
    backgroundColor: '#FEE500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  /* 말풍선 자리. 카카오 로고 파일을 싣는 대신 검은 점 하나로 둡니다. */
  bubble: {
    fontSize: 14,
    color: '#000000',
  },
  label: {
    ...Type.body,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.85)',
  },
});
