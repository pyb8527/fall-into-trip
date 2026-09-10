import { StyleSheet, Text, View } from 'react-native';

import { Colors, Type, Weight } from '@/constants/theme';

/**
 * 로고.
 *
 * <p>그림이 아니라 글자로 씁니다. 어느 크기로 키워도 뭉개지지 않고, 화면을
 * 열 때 그림 파일을 기다리지 않아도 되며, 색을 바꿔 쓸 수 있습니다.
 * (앱 아이콘과 시작 화면은 그림이어야 하므로 assets 의 png 를 씁니다.)
 *
 * <p>아래 설명 줄은 마크 크기에서 계산합니다. size 하나만 바꾸면 두 줄이
 * 같은 비율로 커지고 작아집니다.
 *
 * <p>글자를 최대로 굵히고 자간을 좁혀 한 덩어리로 만듭니다. 흑백에서
 * 이름이 이름으로 읽히려면 <b>무게</b>가 있어야 하고, 그 무게를 낼 수 있는
 * 것이 색이 아니라 굵기밖에 없습니다.
 */

/** 워드마크만. 좁은 자리(내 계정 카드 등)에 씁니다. */
export function LogoMark({
  size = 28,
  tone = Colors.text,
}: {
  /** 글자 크기. 실제 글자 높이는 이것의 0.7 쯤입니다. */
  size?: number;
  tone?: string;
}) {
  return (
    <Text
      accessibilityLabel="FIT"
      style={[styles.wordmark, { fontSize: size, color: tone }]}>
      FIT
    </Text>
  );
}

/**
 * 워드마크와 한 줄 설명.
 *
 * 처음 만나는 화면(로그인·가입·시작 화면)에서 한 번 보여 줍니다.
 */
export function LogoLockup({ size = 80 }: { size?: number }) {
  /* 기준은 size 80 일 때 설명 15, 위 여백 -7 입니다. 그 비로 함께 커집니다.
     여백이 음수인 것은, 큰 글자의 줄 상자에 글자 아래 여유가 붙어 있어서
     그만큼 당겨야 두 줄이 한 덩어리로 보이기 때문입니다. */
  const captionSize = Math.max(10, Math.round(size * 0.14));
  const gap = Math.round(size * -0.06);

  return (
    <View style={styles.lockup}>
      <LogoMark size={size} />
      <Text
        style={[
          styles.tagline,
          { fontSize: captionSize, letterSpacing: captionSize * 0.28, marginTop: gap },
        ]}>
        FALL INTO TRIP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontWeight: Weight.heavy,
    /* 워드마크는 글자끼리 붙어 한 덩어리로 보여야 합니다. 크기에 상관없이
       같은 정도로 붙으려면 고정값이 아니라 비율이어야 하는데, 여기서는
       가장 자주 쓰는 크기에서 맞춰 두고 큰 자리는 lockup 이 따로 잡습니다. */
    letterSpacing: -1.2,
    color: Colors.text,
  },
  /* 왼쪽에 세웁니다. 로고만 가운데고 아래 글이 왼쪽이면 두 축이 생겨
     화면이 정돈되지 않은 것으로 읽힙니다. */
  lockup: {
    alignItems: 'flex-start',
  },
  tagline: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textMuted,
    textAlign: 'left',
  },
});
