/**
 * 디자인 토큰.
 *
 * <p>값을 눈대중으로 고르지 않았습니다. 색과 글자 크기는 토스 디자인
 * 시스템(TDS)이 공개한 값을 그대로 옮겼고, 누르는 크기는 애플·구글·WCAG 의
 * 기준을 따랐습니다. 근거는 docs/design.md 에 정리해 두었습니다.
 *
 * <p>밝은 화면 한 벌만 씁니다. 두 벌을 두면 어느 한쪽은 늘 덜 손질된 채로
 * 남고, 색을 하나 고칠 때마다 두 군데를 맞춰야 합니다.
 *
 * <p>화면 코드에서는 숫자를 직접 적지 않고 여기 이름만 씁니다.
 */

import '@/global.css';

import { Platform } from 'react-native';

/* ------------------------------------------------------------------- 색 */

/**
 * 검정과 흰색, 그리고 그 사이.
 *
 * <p>강조색을 따로 두지 않습니다. <b>가장 진한 것이 곧 강조</b>입니다.
 * 색으로 끌던 눈길을 이제 굵기와 여백이 대신합니다.
 *
 * <p>회색은 어느 쪽으로도 기울이지 않았습니다. 지도의 색(날짜 구분)만은
 * 그대로 두기로 했는데, 바탕이 조금이라도 기울면 그 색들이 다르게
 * 보입니다.
 *
 * <p>층은 그림자가 아니라 <b>선 한 가닥</b>이 나눕니다. 그림자는 카드가
 * 여럿 놓이면 화면 전체가 부옇게 뜨고, 무엇을 먼저 봐야 할지 흐립니다.
 */
const Ink = {
  /** 종이 */
  0: '#FFFFFF',
  /** 눌러 앉은 자리(입력칸) */
  50: '#F7F7F7',
  /** 눌렸을 때 */
  100: '#EFEFEF',
  /** 선 */
  200: '#E4E4E4',
  /** 진한 선 */
  300: '#D2D2D2',
  /** 못 누르는 글자 */
  400: '#B0B0B0',
  /** 곁다리 글자 */
  500: '#8A8A8A',
  /** 보조 설명 */
  700: '#5A5A5A',
  /** 본문, 그리고 강조 */
  900: '#0E0E0E',
} as const;

export const Colors = {
  /* 글자 */
  text: Ink[900],
  textSecondary: Ink[700],
  textMuted: Ink[500],
  textDisabled: Ink[400],

  /* 바탕 — 흰 종이 한 장입니다. 카드에 따로 색을 주지 않습니다. */
  background: Ink[0],
  /** 지도 뒤에 깔리는 바닥. 지도가 뜨기 전에 잠깐 보입니다. */
  abyss: Ink[100],
  surface: Ink[0],
  /** 판 위에 다시 얹히는 것(바텀시트 안의 칸) */
  surfaceRaised: Ink[50],
  fill: Ink[50],
  fillPressed: Ink[100],
  border: Ink[200],
  borderStrong: Ink[300],
  divider: Ink[200],

  /* 강조 — 주 동작. 색이 아니라 검정입니다. */
  accent: Ink[900],
  accentPressed: '#000000',
  accentSoft: Ink[100],
  accentSoftPressed: Ink[200],
  accentText: Ink[0],
  /** 강조를 글자·아이콘으로 쓸 때. */
  accentInk: Ink[900],

  /* 지금·오늘·여기 */
  hot: Ink[900],
  hotSoft: Ink[100],

  /*
    알림.

    무채색이라 색으로는 못 가립니다. 위험한 것은 <b>모양</b>으로 가릅니다 —
    되돌릴 수 없는 단추만 테두리를 두르고, 그 앞에는 늘 확인 판이 섭니다.
   */
  danger: Ink[900],
  dangerSoft: Ink[0],
  dangerSoftPressed: Ink[100],
  success: Ink[900],
  successSoft: Ink[50],
  warning: Ink[700],
  warningSoft: Ink[50],

  /** 색으로 채운 자리 위에 얹는 글자. 날짜 색은 모두 진합니다. */
  onDay: '#FFFFFF',
} as const;

/**
 * 날짜를 구분하는 색.
 *
 * <p>뜻이 있는 색(성공·경고)이 아니라 이름표입니다. 날짜 수만큼 돌려 쓰고,
 * 지도의 핀·동선과 목록의 날짜 표시가 같은 색을 씁니다. 색만으로 구분하지
 * 않도록 핀에는 번호와 그림도 함께 넣습니다.
 *
 * <p>여섯 가지 모두 흰 글자를 얹어도 읽힐 만큼 진합니다. 옅은 색을 섞으면
 * 그 날의 핀만 번호가 안 보입니다.
 *
 * <p>바이올렛과 산호색은 여기서 뺐습니다. 하나는 "누르는 것", 하나는 "지금"
 * 의 색이라, 날짜에까지 쓰면 그 뜻이 흐려집니다.
 */
export const DayColors = [
  '#2563EB',
  '#F97316',
  '#059669',
  '#9333EA',
  '#E11D48',
  '#0891B2',
] as const;

export const dayColor = (index: number) => DayColors[index % DayColors.length];

/**
 * 떠 있는 것 — 이제 뜨지 않습니다.
 *
 * <p>흰 카드가 옅은 그림자로 떠 있던 것을 걷었습니다. 카드가 서넛만
 * 놓여도 화면 전체가 부옇게 뜨고, 그 상태에서는 무엇을 먼저 봐야 할지
 * 눈이 고르지 못합니다.
 *
 * <p>층은 선 한 가닥과 여백이 나눕니다. 이름은 남겨 둡니다 — 쓰는 자리가
 * 여럿이라 지우면 그만큼 고칠 데가 늘고, 언젠가 한 곳에서만 다시
 * 띄우고 싶을 때 여기만 고치면 됩니다.
 */
export const Lift = {
  shadowColor: '#000000',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

/**
 * 움직임.
 *
 * <p>길이를 화면마다 눈대중으로 고르면 어떤 것은 굼뜨고 어떤 것은 홱
 * 지나갑니다. 세 가지만 둡니다.
 *
 * <ul>
 *   <li><b>tap</b> — 눌렀을 때 손끝에 바로 붙어야 합니다. 이보다 길면
 *       눌렀는지 아닌지 헷갈립니다.</li>
 *   <li><b>base</b> — 나타나고 사라지는 것. 사람이 "움직였다" 고 느끼는
 *       가장 짧은 길이입니다.</li>
 *   <li><b>sheet</b> — 판이 오르내리는 것처럼 화면의 큰 덩어리가 자리를
 *       옮길 때.</li>
 * </ul>
 */
export const Motion = {
  tap: 110,
  base: 220,
  sheet: 320,
  /** 판이 손을 떠났을 때 붙는 느낌. 튕기지 않을 만큼만 무겁게. */
  spring: { damping: 22, stiffness: 220, mass: 0.9 },
} as const;

export type ThemeColor = keyof typeof Colors;
export type Theme = { readonly [K in ThemeColor]: string };

/* ---------------------------------------------------------------- 글자 */

/**
 * 글꼴.
 *
 * <p>웹은 프리텐다드를 우리 서버에서 함께 내보냅니다(global.css). 기기마다
 * 다른 글꼴로 그려지면 같은 화면이 아니게 되는데, 특히 안드로이드와 윈도우
 * 사이에서 한글이 눈에 띄게 다릅니다.
 *
 * <p>앱에서는 기기 것을 그대로 씁니다. 프리텐다드를 앱에 넣으려면 굵기별로
 * 파일을 등록해야 하고 그만큼 앱이 무거워집니다. iOS 는 애초에 프리텐다드가
 * 본뜬 글꼴(Apple SD Gothic Neo)을 쓰므로 차이가 거의 없습니다.
 */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
})!;

/**
 * 모든 글자에 붙는 글꼴 이름.
 *
 * <p>웹에서만 붙입니다. 앱에서 'normal' 같은 이름을 글꼴로 넘기면 안드로이드
 * 에서는 그런 글꼴을 찾다가 글자가 아예 안 그려질 수 있습니다. 비워 두면
 * 기기 기본값을 씁니다.
 *
 * <p>아래 Type 이 이것을 함께 담고 있어, 화면들은 <code>...Type.body</code>
 * 하나만 펼치면 크기·줄높이·글꼴이 한꺼번에 붙습니다. 전에는 Fonts 를
 * 만들어 두고 어디서도 쓰지 않아, 글꼴을 실어도 화면에는 붙지 않았습니다.
 */
const family = Platform.OS === 'web' ? { fontFamily: Fonts.sans } : {};

/**
 * 글자 크기와 줄 높이 — TDS 본 타이포그래피 7단계 그대로입니다.
 *
 * 큰 글자일수록 줄 높이 비율이 낮습니다(30/40 = 1.33, 13/19.5 = 1.5).
 * 제목은 붙어 있어야 덩어리로 읽히고, 본문은 벌어져 있어야 눈이 다음 줄을
 * 찾습니다.
 *
 * 자간은 한글에서 살짝 좁혀야 성기지 않습니다. 큰 글자일수록 더 좁힙니다.
 */
export const Type = {
  /*
    색을 걷어 냈으므로 위계를 글자가 혼자 집니다. 그래서 큰 것은 더
    크고 더 좁게, 작은 것은 더 조용하게 벌립니다. 단계 사이가 가까우면
    무채색 화면에서는 아무 단계도 없는 것처럼 보입니다.
  */
  display: { ...family, fontSize: 34, lineHeight: 40, letterSpacing: -1.4 },
  title: { ...family, fontSize: 26, lineHeight: 33, letterSpacing: -1.0 },
  heading: { ...family, fontSize: 21, lineHeight: 28, letterSpacing: -0.7 },
  subheading: { ...family, fontSize: 18, lineHeight: 26, letterSpacing: -0.5 },
  /** 본문·입력칸. 16 아래로 내리면 iOS 사파리가 입력할 때 화면을 확대합니다. */
  body: { ...family, fontSize: 16, lineHeight: 25, letterSpacing: -0.3 },
  bodySmall: { ...family, fontSize: 14, lineHeight: 21, letterSpacing: -0.2 },
  caption: { ...family, fontSize: 12, lineHeight: 18, letterSpacing: -0.1 },
  /**
   * 구역 이름표.
   *
   * <p>제목을 하나 더 늘리는 대신 이것을 씁니다. 아주 작고 넓게 벌린
   * 대문자는 읽으라고 있는 것이 아니라 <b>여기서부터 다른 이야기</b>
   * 라는 표시라, 화면에 글자가 늘어도 눈이 걸리지 않습니다.
   */
  label: { ...family, fontSize: 11, lineHeight: 16, letterSpacing: 1.4 },
} as const;

export const Weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  /* 무채색에서 "가장 강한 것" 을 만들 방법은 굵기뿐입니다. */
  heavy: '800',
} as const;

/* ---------------------------------------------------------------- 치수 */

/** 4의 배수로만 씁니다. 사이사이 값을 끼워 넣으면 금세 어긋납니다. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/**
 * 모서리.
 *
 * <p>둥근 모서리를 걷었습니다. 카드·단추·입력칸·시트가 모두 직각입니다.
 * 둥근 것이 여럿 겹치면 화면이 물러 보이고, 무엇이 무엇 위에 놓였는지가
 * 모서리가 아니라 그림자에 기대게 됩니다.
 *
 * <p><b>full 은 지도에만 남깁니다.</b> 핀은 어느 지도에서나 동그라미라,
 * 그것까지 각지게 하면 지도 위의 점이 우리 UI 조각처럼 보입니다.
 * 도장도 마찬가지입니다 — 네모난 도장은 도장으로 안 읽힙니다.
 */
export const Radius = {
  none: 0,
  /** 지도 핀과 도장. 그 밖에는 쓰지 않습니다. */
  full: 999,
} as const;

/**
 * 손가락으로 누르는 크기.
 *
 * <ul>
 *   <li>애플은 44pt, 구글은 48dp 를 최소로 봅니다.</li>
 *   <li>WCAG 2.2 는 24px 를 바닥으로 두되 AAA 에서 44px 를 요구합니다.</li>
 * </ul>
 *
 * 그래서 어떤 것도 44 아래로 내려가지 않게 합니다. 줄 안에 들어가는 작은
 * 버튼은 보기에만 작게 두고 hitSlop 으로 실제 누르는 넓이를 44 로 채웁니다.
 * 애플도 "보이는 크기와 누르는 넓이는 다를 수 있다" 고 씁니다.
 */
export const Tap = {
  min: 44,
  /** 화면의 주 동작. 넉넉히 둡니다. */
  control: 52,
  /** 줄 안에 들어가는 작은 버튼의 보이는 높이. */
  compact: 36,
  /** compact 를 44 로 채우기 위한 여유. (36 + 4*2 = 44) */
  compactSlop: 4,
} as const;

/**
 * 화면 안에서 큰 덩어리(제목·카드·목록) 사이의 간격.
 *
 * 카드 안쪽 간격(Spacing.md)보다 훨씬 넓어야 "이건 다른 이야기" 로 읽힙니다.
 * 4의 배수 눈금에서는 한 칸이 없어 따로 이름을 붙여 둡니다.
 */
export const ScreenGap = 36;

/**
 * 화면 좌우 여백.
 *
 * 가장 좁은 폰(360dp)에서도 양옆 20 씩 떼면 320 이 남아 한 줄에 한글이
 * 충분히 들어갑니다.
 */
export const Gutter = 20;

/**
 * 넓은 화면에서 글줄이 지나치게 길어지지 않게 잡아 둡니다.
 *
 * 태블릿·웹에서 한 줄이 길어지면 눈이 다음 줄 첫 글자를 잃습니다.
 */
export const MaxContentWidth = 560;
