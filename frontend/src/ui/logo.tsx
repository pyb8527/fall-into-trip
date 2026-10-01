import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Weight } from '@/constants/theme';

/**
 * 로고 — 심볼과 워드마크.
 *
 * <h3>글자였던 것을 그림으로 돌립니다</h3>
 *
 * <p>여태 로고는 <b>글자 「FIT」</b> 이었습니다. 글꼴이 손글씨 1종이던 때는
 * 그것이 최선이었습니다 — 그림 파일을 기다리지 않아도 되고, 어느 크기로
 * 키워도 뭉개지지 않고, 색을 바꿔 쓸 수 있었습니다. 대신 이름이 이름으로만
 * 서 있었고, <b>무엇을 하는 앱인지는 한 글자도 말하지 않았습니다.</b>
 *
 * <p>시안의 심볼은 그 한마디를 합니다. 길이가 줄어드는 일정 막대 셋 위로
 * 기울어진 노란 알약 하나가 꽂히는 모양 — <b>「일정 칸에 한 자리가 떨어져
 * 들어온다」</b> 입니다. 빗금 둘은 그 알약이 방금 떨어졌다는 표시입니다.
 * 노랑을 「지금 · 곧」에만 쓰기로 한 것도 여기서 나왔습니다(constants/theme).
 *
 * <h3>왜 네모를 쌓아 그리는가</h3>
 *
 * <p>시안은 SVG 이고, 그대로 그리려면 {@code react-native-svg} 가 있어야
 * 합니다. 이 저장소에는 없습니다. 로고 하나 때문에 꾸러미를 더 싣지
 * 않습니다 — 앱 용량이 늘고, 무엇보다 Expo 판을 올릴 때마다 함께 판을
 * 맞춰야 하는 것이 하나 더 생깁니다.
 *
 * <p>다행히 이 심볼은 <b>둥근 네모 넷과 짧은 빗금 둘</b>뿐입니다. 네모는
 * {@code borderRadius}, 기울기는 {@code rotate} 로 그대로 나옵니다. 둥근
 * 끝이 달린 선(round cap)은 <b>길이에 선 굵기를 더한 둥근 네모</b>와 같은
 * 모양이라, 빗금도 네모 하나로 그립니다.
 *
 * <p>좌표는 시안의 {@code viewBox="0 0 100 100"} 을 그대로 씁니다. 아래
 * {@code UNIT} 이 그 값이고 {@code u()} 가 실제 픽셀로 바꿉니다. 눈대중으로
 * 옮겨 적은 값이 하나도 없어야, 다음에 시안이 바뀔 때 그 자리만 고치면
 * 됩니다.
 */

/** 시안의 칸 — {@code viewBox="0 0 100 100"}. 아래 좌표는 모두 이 칸 안의 값입니다. */
const UNIT = 100;

/**
 * 일정 막대 셋.
 *
 * <p>54 → 38 → 15 로 줄어듭니다. 길이가 다른 것이 「일정」으로 읽히는
 * 까닭입니다 — 같은 길이 셋은 그냥 줄무늬입니다.
 */
const BARS = [
  { x: 23, y: 18, w: 54 },
  { x: 23, y: 39, w: 38 },
  { x: 23, y: 60, w: 15 },
] as const;

/** 막대 높이. 모서리는 늘 이것의 반이라 알약이 됩니다. */
const BAR_H = 15;

/** 셋째 줄 오른쪽 빈자리에 꽂히는 노란 알약. */
const PILL = { x: 44, y: 60, w: 33, h: BAR_H, tilt: '-12deg' } as const;

/**
 * 빗금 둘 — 알약이 방금 떨어졌다는 표시.
 *
 * <p>시안에서는 {@code (70,44)–(72,40)} 과 {@code (77,47)–(79,43)}, 굵기 3,
 * 끝은 둥글게입니다. 둘의 기울기가 같아 각도 하나를 함께 씁니다.
 */
const SLASHES = [
  { cx: 71, cy: 42 },
  { cx: 78, cy: 45 },
] as const;

const SLASH_W = 3;

/** 선 길이에 굵기를 더합니다 — 둥근 끝 두 개가 반지름만큼씩 더 나오기 때문입니다. */
const SLASH_H = Math.sqrt(2 * 2 + 4 * 4) + SLASH_W;

/**
 * 빗금이 선 각도.
 *
 * <p>기울기가 {@code (2, -4)} 이므로 세로에서 {@code atan(1/2)} = 26.57°
 * 만큼 시계 방향입니다. 숫자로 적어 두면 시안이 바뀔 때 어디서 온 값인지
 * 알 수 없어, 좌표에서 계산합니다.
 */
const SLASH_TILT = `${(Math.atan(2 / 4) * 180) / Math.PI}deg`;

/** 판의 모서리. 1024 아이콘에서 230 쯤 — iOS·안드로이드의 둥근 네모와 같은 비율입니다. */
const PLATE_R = 22.5;

/**
 * 심볼만.
 *
 * <p>판({@code plate})을 어떻게 두느냐로 세 벌이 나옵니다. 앱 아이콘과
 * 시작 화면은 <b>바이올렛 판</b>, 흰 면 위에 아이콘 자체를 얹어야 할 때는
 * <b>흰 판</b>, 화면 안에서 쓸 때는 <b>판 없이</b> 입니다.
 *
 * <p>화면 안에서 판을 두르지 않는 까닭: 로그인 화면 한가운데에 둥근 네모가
 * 서면 그것이 로고가 아니라 <b>앱 아이콘을 붙여 둔 것</b>으로 읽힙니다.
 * 획만 남기면 그릴 것이 줄어 작은 크기에서도 모양이 살아 있습니다.
 */
export function LogoSymbol({
  size = 56,
  plate = 'none',
  tone = 'violet',
}: {
  /** 한 변의 길이. 쓰는 크기는 셋입니다 — 24(막대) · 56(로그인) · 88(시작 화면). */
  size?: number;
  plate?: 'violet' | 'white' | 'none';
  /** 판이 없을 때 획의 색. 바이올렛 면 위에서는 {@code 'white'} 입니다. */
  tone?: 'violet' | 'white';
}) {
  /** 시안의 100 분율을 실제 픽셀로. */
  const u = (n: number) => (n * size) / UNIT;

  /* 판 위에서는 획의 색이 정해져 있습니다 — 바이올렛 판에 흰 획, 흰 판에
     바이올렛 획. 판이 없을 때만 부르는 쪽이 고릅니다. */
  const ink =
    plate === 'violet'
      ? Colors.onAccent
      : plate === 'white'
        ? Colors.accent
        : tone === 'white'
          ? Colors.onAccent
          : Colors.accent;

  return (
    <View
      style={[
        { width: size, height: size },
        plate !== 'none' && {
          borderRadius: u(PLATE_R),
          backgroundColor: plate === 'violet' ? Colors.accent : Colors.surface,
          /* 흰 판은 흰 바탕 위에 놓이면 테두리 없이는 어디까지가 아이콘인지
             보이지 않습니다. 시안의 선 색이 그대로 토큰의 border 입니다. */
          borderWidth: plate === 'white' ? StyleSheet.hairlineWidth : 0,
          borderColor: Colors.border,
          overflow: 'hidden',
        },
      ]}>
      {BARS.map((bar) => (
        <View
          key={bar.y}
          style={{
            position: 'absolute',
            left: u(bar.x),
            top: u(bar.y),
            width: u(bar.w),
            height: u(BAR_H),
            borderRadius: u(BAR_H / 2),
            backgroundColor: ink,
          }}
        />
      ))}

      {/* 노랑은 어느 벌에서도 노랑입니다. 이 색이 심볼의 뜻을 집니다. */}
      <View
        style={{
          position: 'absolute',
          left: u(PILL.x),
          top: u(PILL.y),
          width: u(PILL.w),
          height: u(PILL.h),
          borderRadius: u(PILL.h / 2),
          backgroundColor: Colors.hot,
          transform: [{ rotate: PILL.tilt }],
        }}
      />

      {SLASHES.map((slash) => (
        <View
          key={slash.cx}
          style={{
            position: 'absolute',
            /* 가운데를 좌표로 받았으니 왼쪽·위로 반씩 물러나야 그 자리에 섭니다. */
            left: u(slash.cx - SLASH_W / 2),
            top: u(slash.cy - SLASH_H / 2),
            width: u(SLASH_W),
            height: u(SLASH_H),
            borderRadius: u(SLASH_W / 2),
            backgroundColor: ink,
            transform: [{ rotate: SLASH_TILT }],
          }}
        />
      ))}
    </View>
  );
}

/**
 * 워드마크만. 좁은 자리(상단바, 내 계정 카드)에 씁니다.
 *
 * <h3>소문자입니다</h3>
 *
 * <p>대문자 「FIT」 였습니다. 흑백 화면에서 이름이 이름으로 읽히려면 무게가
 * 있어야 했고, 색을 안 쓰기로 했으니 남는 것이 <b>대문자와 자간</b>뿐이었
 * 습니다.
 *
 * <p>시안은 소문자 {@code fit} 입니다. 심볼이 이미 할 말을 하므로 이름이
 * 소리를 지를 필요가 없습니다. 자간도 벌리지 않고 살짝 조입니다 — 세 글자가
 * 한 덩어리로 보여야 이름입니다.
 *
 * <p>시안의 글꼴은 둥근 기하 고딕(Outfit 계열)이고, 제대로 하려면 그것을
 * <b>윤곽선으로 바꿔</b> 심볼과 함께 한 장으로 내보내야 합니다(§6). 그
 * 파일이 들어올 때까지는 UI 글꼴의 굵은 단계로 그립니다 — 둘 다 기하 고딕
 * 계열이라 자리가 크게 흔들리지 않고, 무엇보다 <b>받을 것이 없어</b> 첫
 * 그림에서 이미 보입니다.
 */
export function LogoMark({ size = 28, tone = Colors.text }: { size?: number; tone?: string }) {
  return (
    <Text accessibilityLabel="fit" style={[styles.wordmark, { fontSize: size, color: tone }]}>
      fit
    </Text>
  );
}

/**
 * 심볼 · 워드마크 · 한 줄을 세로로 쌓은 것.
 *
 * <p>처음 만나는 화면(시작 화면, 초대 링크)에서 한 번 보여 줍니다.
 *
 * <h3>가운데로 모았습니다</h3>
 *
 * <p>왼쪽에 세워 두었습니다 — 「로고만 가운데고 아래 글이 왼쪽이면 두 축이
 * 생긴다」가 그때의 이유였습니다. 심볼이 생기면서 사정이 바뀌었습니다.
 * 심볼 · 이름 · 한 줄이 세로로 쌓이면 축은 <b>가운데 하나</b>이고, 이 묶음이
 * 서는 자리는 화면 한가운데(시작 화면)입니다. 왼쪽에 세우면 가운데 선
 * 묶음을 왼쪽으로 밀어 놓은 것처럼 보입니다.
 */
export function LogoLockup({
  size = 88,
  tone = 'ink',
}: {
  /** 심볼의 한 변. 아래 두 줄이 이 값에서 함께 계산됩니다. */
  size?: number;
  /** 흰 면 위면 {@code 'ink'}, 바이올렛 면 위면 {@code 'onAccent'}. */
  tone?: 'ink' | 'onAccent';
}) {
  /* 기준은 심볼 88 일 때 이름 32, 한 줄 13 입니다. 그 비로 함께 커집니다. */
  const nameSize = Math.round(size * 0.36);
  const lineSize = Math.max(11, Math.round(size * 0.15));

  const onViolet = tone === 'onAccent';

  return (
    <View style={styles.lockup} accessibilityLabel="fit — fall into trip">
      <LogoSymbol size={size} tone={onViolet ? 'white' : 'violet'} />
      <Text
        style={[
          styles.wordmark,
          {
            fontSize: nameSize,
            marginTop: Math.round(size * 0.12),
            color: onViolet ? Colors.onAccent : Colors.text,
          },
        ]}>
        fit
      </Text>
      <Text
        style={[
          styles.tagline,
          {
            fontSize: lineSize,
            letterSpacing: lineSize * 0.04,
            color: onViolet ? Colors.onAccent : Colors.textSecondary,
          },
        ]}>
        fall into trip
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
    */
    fontFamily: Fonts.sans,
    fontWeight: Weight.bold,
    /* 조입니다. 벌려 두던 것은 손글씨 때문이었습니다 — 글자 폭이 들쭉날쭉해서
       조이면 획이 서로 닿았습니다. 반듯한 고딕에서는 붙여야 한 이름입니다. */
    letterSpacing: -0.5,
  },
  /* 심볼 · 이름 · 한 줄이 한 덩어리로 보여야 합니다. 이름 위는 심볼과
     떼고(심볼의 12%), 한 줄은 이름에 붙입니다(2). */
  lockup: {
    alignItems: 'center',
    gap: 2,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontWeight: Weight.medium,
  },
});
