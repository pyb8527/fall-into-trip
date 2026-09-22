import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Type } from '@/constants/theme';

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
 * <p>여태 <b>굵기</b>로 무게를 냈습니다 — 흑백 화면에서 이름이 이름으로
 * 읽히려면 무게가 있어야 하는데, 색을 안 쓰기로 했으니 남는 것이 굵기뿐
 * 이었습니다.
 *
 * <p>이제 글꼴이 손글씨 1종이라 굵기가 하나뿐입니다(ui/hand). 무게는
 * <b>크기</b>가 냅니다. 대신 자간을 벌립니다 — 손글씨는 글자 폭이 들쭉날쭉
 * 해서 조이면 획이 서로 닿습니다. 반듯한 고딕에서 붙여 두던 것과 반대입니다.
 *
 * <p>앱 아이콘과 시작 화면 그림도 이 글꼴로 구워 두었습니다
 * (assets/images — 굽는 법은 그 폴더의 README 에 적어 두었습니다).
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
    /*
      글꼴을 여기서 직접 댑니다.

      <p>Type 의 단계들은 전부 이것을 물고 있는데(constants/theme), 로고는
      그중 어느 단계도 안 씁니다 — 크기를 부르는 쪽이 정하기 때문입니다.
      그래서 앱 전체를 손글씨로 바꿀 때 <b>이 한 자리만 빠졌습니다.</b>
      이름이 제 글씨가 아닌 채로 화면마다 왼쪽 위에 서 있었습니다.
    */
    fontFamily: Fonts.sans,
    /* 붙이지 않고 벌립니다. 반듯한 고딕이던 때는 -1.2 로 조여 한 덩어리로
       만들었는데, 손글씨는 글자마다 폭이 달라서 조이면 F 의 가로획과 I 가
       닿습니다. 살짝 벌려야 세 글자가 따로 서면서도 한 이름으로 읽힙니다. */
    letterSpacing: 1,
    color: Colors.text,
  },
  /* 왼쪽에 세웁니다. 로고만 가운데고 아래 글이 왼쪽이면 두 축이 생겨
     화면이 정돈되지 않은 것으로 읽힙니다. */
  lockup: {
    alignItems: 'flex-start',
  },
  tagline: {
    ...Type.label,
    color: Colors.textMuted,
    textAlign: 'left',
  },
});
