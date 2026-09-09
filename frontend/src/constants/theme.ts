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
 * 흰 종이와 바이올렛.
 *
 * <p>밝은 화면 한 벌만 씁니다. 두 벌을 두면 어느 한쪽은 늘 덜 손질된 채로
 * 남고, 색을 하나 고칠 때마다 두 군데를 맞춰야 합니다.
 *
 * <p>회색은 <b>어느 쪽으로도 기울이지 않았습니다.</b> 따뜻하게 두면 종이처럼
 * 보이지만 그만큼 누렇고, 차게 두면 금융 앱의 얼굴이 됩니다. 순수한 회색
 * 위에서는 얹히는 색이 제 색으로 보입니다.
 *
 * <p>층을 나누는 것은 선이 아니라 <b>그림자</b>입니다. 흰 카드가 거의 흰 바탕
 * 위에 떠 있으므로, 실선을 두르면 그 선이 먼저 눈에 띕니다. 아주 옅고 넓게
 * 퍼지는 그림자면 선 없이도 떠 보입니다.
 */
const Zinc = {
  /** 화면 바탕 */
  50: '#FAFAFA',
  /** 카드 안에서 한 겹 더 눌러 앉는 자리(입력칸·칩) */
  100: '#F4F4F5',
  /** 눌렀을 때, 그리고 선 */
  200: '#E4E4E7',
  /** 진한 선 */
  300: '#D4D4D8',
  /** 못 누르는 글자 */
  400: '#A1A1AA',
  /** 곁다리 글자 */
  500: '#71717A',
  /** 보조 설명 */
  600: '#52525B',
  /** 본문 */
  900: '#18181B',
} as const;

/**
 * 강조색 둘.
 *
 * <p>바이올렛 하나만 "누르면 일이 벌어지는 것" 에 씁니다.
 *
 * <p>산호색은 "지금·오늘·여기" 처럼 시간이 걸린 것에만 씁니다. 바이올렛과
 * 색상환에서 멀리 떨어져 있어 둘이 나란히 있어도 서로를 죽이지 않습니다.
 * 이쪽을 단추에 쓰지는 않습니다 — 눌러야 할 곳이 둘이 되면 어느 쪽을 눌러야
 * 하는지 매번 고르게 됩니다.
 */
const Violet = {
  core: '#6366F1',
  deep: '#4F46E5',
  soft: '#EEF2FF',
  softOn: '#E0E7FF',
  /** 뱃지·글자로 쓸 때. 옅은 배경 위에서 읽히려면 한 단 짙어야 합니다. */
  text: '#4F46E5',
} as const;
const Coral = { core: '#FF385C', soft: '#FFF1F3' } as const;
const Red = { core: '#DC2626', soft: '#FEF2F2', softOn: '#FEE2E2' } as const;
const Emerald = { core: '#059669', soft: '#ECFDF5' } as const;
const Amber = { core: '#D97706', soft: '#FFFBEB' } as const;

export const Colors = {
  /* 글자 */
  text: Zinc[900],
  textSecondary: Zinc[600],
  textMuted: Zinc[500],
  textDisabled: Zinc[400],

  /* 바탕 — 거의 흰 판 위에 완전히 흰 카드가 그림자로 떠 있습니다. */
  background: Zinc[50],
  /** 지도 뒤에 깔리는 바닥. 지도가 뜨기 전에 잠깐 보입니다. */
  abyss: Zinc[100],
  surface: '#FFFFFF',
  /** 판 위에 다시 얹히는 것(바텀시트 안의 카드) */
  surfaceRaised: Zinc[50],
  fill: Zinc[100],
  fillPressed: Zinc[200],
  border: Zinc[200],
  borderStrong: Zinc[300],
  divider: Zinc[100],

  /* 강조 — 주 동작 */
  accent: Violet.core,
  accentPressed: Violet.deep,
  accentSoft: Violet.soft,
  accentSoftPressed: Violet.softOn,
  accentText: '#FFFFFF',
  /** 강조를 글자·아이콘으로 쓸 때. 칠할 때는 위의 accent 를 씁니다. */
  accentInk: Violet.text,

  /* 지금·오늘·여기 */
  hot: Coral.core,
  hotSoft: Coral.soft,

  /* 알림 */
  danger: Red.core,
  dangerSoft: Red.soft,
  dangerSoftPressed: Red.softOn,
  success: Emerald.core,
  successSoft: Emerald.soft,
  warning: Amber.core,
  warningSoft: Amber.soft,

  /** 색으로 채운 자리 위에 얹는 글자. 강조색도 날짜 색도 모두 진합니다. */
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
 * 떠 있는 것.
 *
 * <p>거의 흰 바탕 위에 완전히 흰 카드를 얹으므로, 층을 나누는 것은 실선이
 * 아니라 그림자입니다. 실선을 두르면 그 선이 카드 안의 글자보다 먼저 눈에
 * 띕니다.
 *
 * <p>아주 옅고(5%) 넓게(20) 퍼뜨립니다. 진한 그림자는 카드를 무겁게 만들고,
 * 좁은 그림자는 테두리처럼 보입니다. 붉은 기 없이 순수한 검정으로만 깔아야
 * 흰 바탕이 탁해지지 않습니다.
 *
 * <p>안드로이드는 그림자 색·번짐을 정할 수 없고 elevation 한 값만 받습니다.
 * 그래서 그쪽에서는 조금 다르게 보입니다 — 어쩔 수 없는 차이입니다.
 */
export const Lift = {
  shadowColor: '#000000',
  shadowOpacity: 0.05,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
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
  display: { ...family, fontSize: 30, lineHeight: 40, letterSpacing: -0.8 },
  title: { ...family, fontSize: 26, lineHeight: 35, letterSpacing: -0.7 },
  heading: { ...family, fontSize: 22, lineHeight: 31, letterSpacing: -0.5 },
  subheading: { ...family, fontSize: 20, lineHeight: 29, letterSpacing: -0.4 },
  /** 본문·입력칸. 16 아래로 내리면 iOS 사파리가 입력할 때 화면을 확대합니다. */
  body: { ...family, fontSize: 17, lineHeight: 25.5, letterSpacing: -0.3 },
  bodySmall: { ...family, fontSize: 15, lineHeight: 22.5, letterSpacing: -0.2 },
  caption: { ...family, fontSize: 13, lineHeight: 19.5, letterSpacing: -0.1 },
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
  /** 화면 아래에서 올라오는 큰 판. 모서리가 커야 "얹혀 있다" 로 읽힙니다. */
  xxl: 28,
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
