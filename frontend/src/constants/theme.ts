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
 * TDS 회색 10단계.
 *
 * 글자·선·배경이 같은 계열에서 조금씩 다른 밝기를 쓰는데, 그때마다 색을
 * 새로 고르면 화면마다 미묘하게 어긋납니다.
 */
const Grey = {
  50: '#F9FAFB',
  100: '#F2F4F6',
  200: '#E5E8EB',
  300: '#D1D6DB',
  400: '#B0B8C1',
  500: '#8B95A1',
  600: '#6B7684',
  700: '#4E5968',
  800: '#333D4B',
  900: '#191F28',
} as const;

const Blue = { 50: '#E8F3FF', 100: '#C9E2FF', 500: '#3182F6', 700: '#1B64DA' } as const;
const Red = { 50: '#FFEEEE', 100: '#FFD4D6', 500: '#F04452' } as const;
const Green = { 50: '#F0FAF6', 400: '#15C47E' } as const;
const Orange = { 50: '#FFF4E5', 500: '#FF9F1C' } as const;

export const Colors = {
  /* 글자 — 900 은 본문, 700 은 보조 설명, 500 은 곁다리, 400 은 못 누르는 것 */
  text: Grey[900],
  textSecondary: Grey[700],
  textMuted: Grey[500],
  textDisabled: Grey[400],

  /**
   * 바탕.
   *
   * 회색 판(#F2F4F6) 위에 흰 카드가 뜹니다. 선을 긋는 대신 밝기 차이로
   * 층을 나눠서 화면이 조용합니다.
   */
  background: Grey[100],
  surface: '#FFFFFF',
  /* 입력칸처럼 카드 안에서 한 겹 더 눌러 앉는 자리 */
  fill: Grey[100],
  fillPressed: Grey[200],
  border: Grey[200],
  divider: Grey[100],

  /* 강조 */
  accent: Blue[500],
  accentPressed: Blue[700],
  accentSoft: Blue[50],
  accentSoftPressed: Blue[100],
  accentText: '#FFFFFF',

  /* 알림 */
  danger: Red[500],
  dangerSoft: Red[50],
  dangerSoftPressed: Red[100],
  success: Green[400],
  successSoft: Green[50],
  warning: Orange[500],
  warningSoft: Orange[50],
} as const;

/**
 * 날짜를 구분하는 색.
 *
 * 뜻이 있는 색(성공·경고)이 아니라 이름표입니다. 날짜 수만큼 돌려 쓰고,
 * 지도의 핀·동선과 목록의 날짜 표시가 같은 색을 씁니다. 색만으로 구분하지
 * 않도록 핀에는 번호도 함께 적습니다.
 */
export const DayColors = [
  Blue[500],
  '#15C47E',
  '#FF9F1C',
  '#8B5CF6',
  '#F04452',
  '#0EA5E9',
] as const;

export const dayColor = (index: number) => DayColors[index % DayColors.length];

export type ThemeColor = keyof typeof Colors;
export type Theme = { readonly [K in ThemeColor]: string };

/* ---------------------------------------------------------------- 글자 */

/**
 * 한글이 또렷하게 나오는 순서.
 *
 * 웹 폰트를 받아 오지 않습니다. 받아 오면 글자가 한 번 바뀌어 보이고,
 * 느린 곳에서는 한동안 아무것도 안 보입니다.
 */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
})!;

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
  display: { fontSize: 30, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 35, letterSpacing: -0.7 },
  heading: { fontSize: 22, lineHeight: 31, letterSpacing: -0.5 },
  subheading: { fontSize: 20, lineHeight: 29, letterSpacing: -0.4 },
  /** 본문·입력칸. 16 아래로 내리면 iOS 사파리가 입력할 때 화면을 확대합니다. */
  body: { fontSize: 17, lineHeight: 25.5, letterSpacing: -0.3 },
  bodySmall: { fontSize: 15, lineHeight: 22.5, letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 19.5, letterSpacing: -0.1 },
} as const;

export const Weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
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

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
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
