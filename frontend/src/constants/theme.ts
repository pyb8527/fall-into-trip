import { Platform, type TextStyle } from 'react-native';

/**
 * 디자인 토큰.
 *
 * <h3>왜 다시 썼는가</h3>
 *
 * <p>옛 규칙은 <b>무채색·직각·손글씨</b>였습니다. 색을 안 쓰고, 모서리를 안
 * 굴리고, 굵기가 하나뿐인 글꼴로 위계를 크기 하나에 맡겼습니다. 하나하나는
 * 말이 되는데 다 합치니 <b>스타일을 안 입힌 화면</b>이 됐습니다 — 처음 연
 * 사람에게 "만들다 만 것" 으로 읽혔습니다.
 *
 * <p>상용 앱들이 함께 지키는 규칙 위에 FIT 의 색과 성격을 얹습니다. 특정 앱
 * 하나를 따라 하지 않습니다. 근거는 {@code docs/redesign/research.md},
 * 결정은 {@code docs/redesign/plan.md} 에 있습니다.
 *
 * <h3>다섯 가지만 기억하면 됩니다</h3>
 *
 * <ol>
 *   <li>글꼴은 한 가족, 굵기는 네 단계. 위계는 크기·굵기·색이 함께 만듭니다</li>
 *   <li>색은 아낍니다. 화면의 90%는 흰색과 회색입니다</li>
 *   <li>구역은 띠로, 물건은 카드로</li>
 *   <li>가까운 것은 붙이고 다른 것은 띄웁니다</li>
 *   <li>주 버튼은 화면에 하나, 자리는 아래</li>
 * </ol>
 */

/* ---------------------------------------------------------------- 회색 */

/**
 * 회색 열두 단.
 *
 * <p>글자색은 <b>네 단만</b> 씁니다(900·700·600·500). 그보다 잘게 나누면
 * 어느 것이 더 중요한지가 색으로 안 읽히고, 화면마다 다른 회색이 섞입니다.
 *
 * <p>굵게 표시한 넷은 시안에서 온 값입니다 — Background·Line·Gray·Ink.
 *
 * <h3>700 이 없어서 두 단이 한 단이 돼 있었습니다</h3>
 *
 * <p>처음 옮겨 적을 때 <b>700 을 빼먹었습니다.</b> 그래서 「설명」과
 * 「메타」가 둘 다 600 으로 내려앉아, 설명과 날짜·개수가 <b>같은 회색</b>이
 * 됐습니다. 한 줄 안에 둘이 같이 있으면 어느 것이 본문이고 어느 것이
 * 곁다리인지 색으로 안 읽혀서, 글자를 읽어 봐야 알았습니다.
 */
const Gray = {
  /** 바탕, 카드, 시트. 이 앱의 바닥은 흰색입니다. */
  0: '#FFFFFF',
  /** 눌린 줄, 표의 짝수 줄 */
  25: '#F9FAFB',
  /** <b>구역 띠</b>와 회색 면(검색칸, 정보 상자). 시안의 Background */
  50: '#F2F4F6',
  /** 눌린 면, 스켈레톤, 꺼진 세그먼트 바탕 */
  100: '#EAECEF',
  /** 구분선과 1px 테두리. 시안의 Line */
  200: '#E5E8EB',
  /** 진한 테두리(입력칸·테두리 버튼), 손잡이, 꺼진 스위치 */
  300: '#D1D6DB',
  /** 못 누름, 자리 표시 글자, 꺼진 탭 아이콘 */
  400: '#B0B8C1',
  /**
   * 꺼진 탭 아이콘, 4위 이하 순위 번호.
   *
   * <p>흰 바탕에서 대비가 3:1 쯤입니다. <b>18픽셀보다 작은 글자에는 쓰지
   * 않습니다</b> — 읽히기는 하는데 또렷하지 않습니다.
   */
  500: '#8B95A1',
  /** 메타·캡션 — <b>3차 글자</b>. 대비 4.6:1. 시안의 Gray */
  600: '#6B7684',
  /** 설명 — <b>2차 글자</b> */
  700: '#4E5968',
  /** 진한 면(스낵바) */
  800: '#333D4B',
  /** 제목·본문 — <b>1차 글자</b>. 시안의 Ink. 순검정은 안 씁니다 */
  900: '#191F28',
} as const;

/* -------------------------------------------------------------- 브랜드 */

/**
 * 바이올렛 — 시안 「FIT 로고 · 앱 아이콘」의 색입니다.
 *
 * <h3>색이 글씨를 집니다</h3>
 *
 * <p>옛 코랄은 <b>글씨를 지지 않기로</b> 하고 고른 색이었습니다. 밝은 코랄에
 * 흰 글씨를 얹으면 대비가 안 나와서, 단추를 옅은 물에 코랄 글씨로 두는 길을
 * 택했습니다. 그 결과 화면에서 <b>가득 찬 색</b>이 한 자리도 없었고, 주
 * 동작이 어느 것인지 한눈에 안 보였습니다.
 *
 * <p>바이올렛 500 은 흰 글씨와 5.3:1 입니다. 가득 칠하고 흰 글씨를 얹을 수
 * 있습니다 — 그래서 주 버튼이 주 버튼으로 보입니다.
 */
const Violet = {
  /** 옅은 면 — tonal 버튼, 켜진 타일, 안 읽은 알림 */
  50: '#F3F1FF',
  /** 옅은 면 눌림, 필터 칩 바탕 */
  100: '#E6E2FF',
  /** 못 누르는 주 버튼 */
  200: '#CEC6FF',
  /** 어두운 바탕 위 링크(스낵바 동작) */
  300: '#ADA0FD',
  /** 다크 아이콘 막대 */
  400: '#8C7BFA',
  /** <b>주 버튼, 켜진 스위치·체크, 링크, 포커스 테두리, 스플래시 바탕</b> */
  500: '#6D5BF6',
  /** 주 버튼 눌림 */
  600: '#5A45E6',
  /** 옅은 면 위 글자 */
  700: '#4935C4',
  800: '#3A2A9C',
  900: '#2B1F73',
} as const;

/**
 * 노랑 — 심볼의 기울어진 알약에서 온 색.
 *
 * <p>그 알약은 「일정 칸에 들어가는 한 자리」를 뜻합니다. 그래서 노랑은
 * <b>「지금 · 곧」</b>을 가리키는 자리에만 씁니다 — D-day, 여행 중, 별점,
 * 지금 시각 선, 방금 넣은 장소.
 *
 * <p><b>글자색으로는 안 씁니다.</b> 흰 바탕에서 대비가 1.6:1 입니다. 노란
 * 면 위의 글자는 늘 Ink 입니다.
 */
const Slot = {
  base: '#FFD43B',
  /** 방금 넣은 것에 1.5초 깔리는 바탕 */
  wash: '#FFF6D1',
} as const;

/* ---------------------------------------------------------------- 색 */

export const Colors = {
  /* -------- 글자. 네 단만 씁니다 */
  /** 제목·본문 — 1차 */
  text: Gray[900],
  /** 설명 — 2차 */
  textSecondary: Gray[700],
  /** 메타(날짜·거리·개수), 힌트 — 3차 */
  textMuted: Gray[600],
  /** 못 누르는 것, 자리 표시 글자 */
  textDisabled: Gray[400],

  /**
   * 꺼진 탭·갈래 아이콘.
   *
   * <p>전에는 꺼진 탭이 {@link Colors.textMuted} 를 봤습니다. 그 값이 한 단
   * 진해지면서 <b>켜진 탭과 꺼진 탭이 비슷해졌습니다</b> — 아이콘이 선에서
   * 채움으로 바뀌는 것 하나로만 갈려서, 작은 화면에서는 어느 쪽에 있는지
   * 한눈에 안 보입니다. 꺼진 것은 꺼진 것으로 두는 자리 하나를 따로 둡니다.
   */
  iconOff: Gray[500],

  /*
    바닥이 흰색입니다.

    <p>전에는 회색 바닥 위에 흰 카드를 얹었습니다. 그러면 <b>모든 것이
    카드</b>가 되어야 해서, 글 한 줄을 놓으려 해도 상자를 하나 만들어야
    했습니다. 상자가 늘면 화면이 사각형의 더미가 됩니다.

    <p>바닥을 흰색으로 두고, 구역은 8픽셀 회색 띠가 가릅니다. 카드는 <b>눌러서
    들어가는 물건</b>(여행·장소·글)에만 씁니다.
  */
  background: Gray[0],
  /** 구역을 가르는 띠, 그리고 회색 면(검색칸·정보 상자) */
  band: Gray[50],
  /** 지도 뒤에 깔리는 바닥. 지도가 뜨기 전에 잠깐 보입니다 */
  abyss: Gray[200],
  surface: Gray[0],
  /** 흰 면 위에 다시 얹히는 것 */
  surfaceRaised: Gray[25],
  fill: Gray[50],
  fillPressed: Gray[100],
  border: Gray[200],
  borderStrong: Gray[300],
  divider: Gray[200],

  /* -------- 브랜드 */
  /** 주 버튼 바탕, 켜진 것, 링크, 지도 핀 */
  accent: Violet[500],
  accentPressed: Violet[600],
  /** 옅은 면 — tonal 버튼, 켜진 타일 */
  accentSoft: Violet[50],
  accentSoftPressed: Violet[100],
  /** 옅은 면 위에 얹는 글자 */
  accentText: Violet[700],
  /** 강조를 글자·아이콘으로 쓸 때. 흰 바탕에서 5.3:1 */
  accentInk: Violet[500],
  /** 바이올렛을 가득 칠한 자리 위의 글자 */
  onAccent: Gray[0],
  /** 못 누르는 주 버튼 */
  accentDisabled: Violet[200],

  /* -------- 지금 · 곧 */
  hot: Slot.base,
  hotSoft: Slot.wash,
  /** 노란 면 위의 글자. 늘 Ink 입니다 */
  onHot: Gray[900],

  /*
    의미색 — 색마다 하는 일이 하나입니다.

    <p>전에는 위험도 성공도 전부 먹색이었습니다("위험한 것은 색이 아니라
    모양으로 가린다"). 그런데 가계부의 <b>받을 돈과 줄 돈</b>을 모양으로
    가를 방법이 없었고, 결국 글자를 읽어야 어느 쪽인지 알았습니다.
  */
  danger: '#E5383B',
  dangerSoft: '#FFF0F0',
  dangerSoftPressed: '#FFE0E0',
  /** 받을 돈, 완료, 정해짐 */
  success: '#0E9F6E',
  successSoft: '#E8F7F1',
  /** 줄 돈, 마감 임박 */
  warning: '#F2690D',
  warningSoft: '#FFF3EA',
  /** 하트 */
  like: '#FF4D5E',
  likeSoft: '#FFF0F2',
  /** 별점 */
  star: Slot.base,

  /** 색으로 채운 자리 위에 얹는 글자. 날짜 색은 모두 진합니다 */
  onDay: '#FFFFFF',

  /* -------- 덮개 */
  /** 시트·다이얼로그 뒤 가림막 */
  scrim: 'rgba(0, 0, 0, 0.48)',
} as const;

/** 단계로 직접 집어야 할 때. 부품 안에서만 씁니다 — 화면은 위 이름을 씁니다. */
export const Palette = { gray: Gray, violet: Violet, slot: Slot } as const;

/**
 * 날짜를 구분하는 색 여덟.
 *
 * <p>뜻이 있는 색이 아니라 이름표입니다. 지도의 핀·동선과 목록의 날짜 칩이
 * 같은 색을 씁니다.
 *
 * <p><b>바이올렛과 노랑은 뺐습니다.</b> 브랜드색과 「지금」을 가리키는 색이
 * 날짜 이름표에 섞이면, 그 둘이 무엇을 뜻하는지가 흐려집니다.
 *
 * <p>여덟 모두 흰 글자를 얹어도 읽힐 만큼 진합니다 — 핀 안에 번호가 들어가기
 * 때문입니다.
 */
export const DayColors = [
  '#3B82F6',
  '#F97316',
  '#10B981',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#B45309',
  '#64748B',
] as const;

export const dayColor = (index: number) => DayColors[index % DayColors.length];

/* -------------------------------------------------------------- 그림자 */

/**
 * 떠 있는 정도.
 *
 * <p>평평한 것이 기본입니다. 그림자는 <b>진짜로 떠 있는 것</b>에만 줍니다 —
 * 지도 위 단추, 바닥에 고정된 바, 시트, 다이얼로그.
 *
 * <p>쪽마다 먹는 것이 다릅니다. {@code shadowOffset} 으로 방향을 고르는 것은
 * iOS·웹에서만 먹고, 안드로이드의 {@code elevation} 은 사방으로 뿌립니다.
 * 둘을 같이 적습니다 — 한쪽만 적으면 다른 쪽에서 조용히 안 뜹니다.
 *
 * <p>{@code shadowOpacity} 를 빼먹으면 iOS·웹에서 <b>아무것도 안 보입니다.</b>
 * 기본값이 0 이라서입니다.
 */
export const Elevation = {
  /** 안 띄웁니다. 띠·목록·면 카드 */
  none: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /**
   * 흰 바탕 위 카드, 세그먼트의 흰 손잡이.
   *
   * <p>계획서의 {@code e1} 은 <b>두 겹</b>입니다 — 0/1/2/0.04 로 바로 아래에
   * 닿는 선 하나, 0/2/8/0.04 로 넓게 퍼지는 것 하나. 여기는 한 겹입니다.
   * {@code shadowColor·shadowOffset·shadowRadius} 는 상자 하나에 한 벌만
   * 걸리고, 안드로이드의 {@code elevation} 은 애초에 겹을 모릅니다. 두 겹을
   * 흉내 내려면 카드마다 상자를 하나 더 감싸야 하는데, <b>목록 한 화면에
   * 상자가 스물 늘어납니다.</b> 가까운 쪽 한 겹으로 둡니다.
   */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** 지도 위 단추·칩, 스낵바, 바닥에 고정된 바 */
  float: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /** 드래그 시트 — 위쪽으로 드리웁니다 */
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  /** 다이얼로그, 넓은 화면의 팝오버 */
  dialog: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  /** 바닥에 놓인 것이 살짝 들린 정도 — 작은 표식 */
  stamp: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  /**
   * 지도 위의 핀.
   *
   * <p>지도는 바탕이 잡다해서 테두리만으로는 핀이 안 떨어집니다.
   */
  pin: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  /**
   * 그림자는 안 그리되 제 레이어에는 올립니다.
   *
   * <p>안드로이드에서만 뜻이 있습니다. 지도는 제 겉면을 따로 가진 것이라,
   * 레이어 없는 뷰가 그 위에서 높이를 바꾸면 지나간 자리가 제때 안 지워져
   * 깜빡이고 잔상이 남습니다.
   */
  layerOnly: { elevation: 12, shadowColor: 'transparent' },
} as const;

/* -------------------------------------------------------------- 움직임 */

export const Motion = {
  /** 눌림. 손끝에 바로 붙어야 합니다 */
  tap: 100,
  /** 색·투명도 바뀜, 스위치 */
  base: 200,
  /** 시트·다이얼로그 열림 */
  sheet: 280,
  /** 세그먼트 손잡이, 드래그 시트가 자리에 붙는 느낌 */
  spring: { damping: 24, stiffness: 260, mass: 1 },
  /**
   * 눌렀을 때 줄어드는 비율.
   *
   * <p>0.88~0.94 였습니다. 그만큼 줄면 눌린 것이 아니라 <b>튕겨 나간 것</b>
   * 처럼 보입니다.
   */
  press: { large: 0.98, small: 0.96 },
} as const;

export type ThemeColor = keyof typeof Colors;
export type Theme = { readonly [K in ThemeColor]: string };

/* ---------------------------------------------------------------- 글자 */

/**
 * 글꼴.
 *
 * <h3>손글씨를 걷었습니다</h3>
 *
 * <p>이서윤체는 <b>1종</b>이라 굵기가 하나뿐이었습니다. 그래서 위계를 크기
 * 하나에 맡겨야 했고, 단계 사이를 벌리느라 본문이 20픽셀까지 커졌습니다 —
 * 한 화면에 드는 것이 그만큼 줄었습니다. 무엇보다 손글씨는 「정성 들인 것」
 * 으로도 읽히지만 「만들다 만 것」으로도 읽힙니다.
 *
 * <h3>웹은 프리텐다드, 앱은 기기 고딕</h3>
 *
 * <p>웹은 {@code public/fonts/PretendardVariable.woff2} 를 우리 서버에서
 * 함께 내보냅니다(global.css). 기기마다 다른 글꼴로 그려지면 같은 화면이
 * 아니게 되는데, 특히 안드로이드와 윈도우 사이에서 한글이 눈에 띄게
 * 다릅니다.
 *
 * <p>앱은 기기 것을 씁니다. iOS 의 Apple SD Gothic Neo 는 프리텐다드가 본뜬
 * 글꼴이고, 안드로이드의 Noto Sans KR 도 같은 계열입니다 — 굵기 네 단계가
 * 다 있어서 위계가 제대로 섭니다.
 *
 * <p>앱에도 프리텐다드를 싣고 싶으면 굵기별 파일 네 개를
 * {@code assets/fonts/} 에 넣고 아래 {@code weight} 가 이름을 고르게
 * 하면 됩니다. 안드로이드는 굵기마다 family 이름이 달라야 해서, 굵기 숫자만
 * 넘겨서는 안 됩니다.
 */
export const Fonts = Platform.select({
  ios: { sans: undefined, mono: 'ui-monospace' },
  default: { sans: undefined, mono: 'monospace' },
  web: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
})!;

/**
 * 글자에 붙는 글꼴 이름.
 *
 * <p>웹에서만 붙입니다. 앱에서 등록되지 않은 이름을 글꼴로 넘기면 안드로이드
 * 에서 글자가 아예 안 그려질 수 있습니다. 비워 두면 기기 기본값입니다.
 */
const family = Fonts.sans ? { fontFamily: Fonts.sans } : {};

/**
 * 글자 굵기.
 *
 * <p>네 단계입니다. 전에는 다섯 이름이 모두 {@code '400'} 이었습니다 —
 * 굵기가 하나뿐인 글꼴이라 없는 굵기를 적으면 기기가 <b>합성</b>해서 획이
 * 번졌기 때문입니다. 글꼴을 바꿨으니 되돌립니다.
 */
export const Weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  /** 옛 이름. bold 와 같습니다 */
  heavy: '700',
} as const;

/**
 * 글자 단계.
 *
 * <p>열 단계지만 <b>화면 하나에서 쓰는 것은 셋 이하</b>로 합니다. 넷을 넘기면
 * 어느 것이 더 중요한지가 안 보입니다.
 *
 * <p>자간 음수는 큰 글자에만 줍니다. 작은 글자를 조이면 한글 받침이 서로
 * 닿습니다.
 */
export const Type = {
  /** 여행 히어로 제목, 홈 첫 줄 */
  display: { ...family, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 },
  /** 탭 화면 큰 제목, 합계 금액 */
  title1: { ...family, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  /** 구역 제목, 시트 제목 */
  title2: { ...family, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  /** 다이얼로그 제목, 큰 카드 제목, 상단바 제목 */
  title3: { ...family, fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  /** 목록 제목, 카드 제목, 큰 버튼 글자 */
  headline: { ...family, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  /** 여러 줄 본문, 입력 글자. 16 아래로 내리면 iOS 사파리가 입력할 때 화면을 확대합니다 */
  body: { ...family, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  /** 설명, 카드 본문, 글 요약 */
  body2: { ...family, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  /** 메타(날짜·거리·개수), 힌트, 오류 */
  caption: { ...family, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** 하단 탭 글자, 배지, 지도 핀 글자 */
  micro: { ...family, fontSize: 11, lineHeight: 14, letterSpacing: 0 },

  /* -------- 옛 이름. 화면이 아직 부르고 있어 남겨 둡니다 */
  /** @deprecated {@link Type.title1} 을 쓰세요 */
  title: { ...family, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  /** @deprecated {@link Type.title2} 를 쓰세요 */
  heading: { ...family, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  /** @deprecated {@link Type.title3} 을 쓰세요 */
  subheading: { ...family, fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  /** @deprecated {@link Type.body2} 를 쓰세요 */
  bodySmall: { ...family, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  /**
   * 중간 버튼, 칩, 탭, 입력 라벨, 「더보기」 링크.
   *
   * <h3>이름이 다른 것을 가리키고 있었습니다</h3>
   *
   * <p>전에 이 이름은 <b>구역 이름표</b>(12/16, 자간 1.2 — 작고 넓게 벌린
   * 글자)였습니다. 바닥이 회색이고 구역마다 머리가 붙던 때의 것입니다.
   * 바닥이 흰색이 되고 구역을 띠와 {@code SectionHeader} 가 가르게 된 뒤로는
   * 쓰는 곳이 한 군데도 안 남았는데, <b>이름만 남아 자리를 막고</b>
   * 있었습니다 — 버튼·칩·탭이 저마다 크기를 손으로 적게 된 것이 그래서입니다.
   */
  label: { ...family, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
} as const;

/** 숫자가 자릿수로 줄 맞춰야 하는 자리 — 금액, 시간, 개수. */
/*
  숫자가 자릿수로 줄 맞춰야 하는 자리 — 금액, 시간, 개수.

  <p>{@link TextStyle} 로 못 박습니다. {@code as const} 로 두었더니 배열이
  {@code readonly} 가 되어 TextStyle 에 안 맞았고, 그러면 이것을
  {@code StyleSheet.create} 안에서 펼칠 때 <b>그 묶음 전체</b>의 타입이
  무너집니다 — create 가 갈래를 못 정해 모든 칸이
  {@code ViewStyle | TextStyle | ImageStyle} 가 되고, 그 파일의 style 이
  하나도 안 맞게 됩니다.

  <p>두 화면이 이미 {@code { fontVariant: [...Tabular.fontVariant] }} 를
  손으로 다시 만들어 쓰고 있었습니다. 같은 우회가 둘이면 고칠 곳은
  우회가 아니라 여기입니다.
*/
export const Tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/* ---------------------------------------------------------------- 치수 */

/**
 * 간격 — 4의 배수 격자.
 *
 * <p>단계: 구역 32 &gt; 제목 아래 12 &gt; 항목 사이 16 &gt; 항목 안 4~8.
 *
 * <p>이름이 둘입니다. {@code s1…s16} 이 새 이름이고, {@code xs…huge} 는
 * 화면 사백 군데가 부르고 있는 옛 이름입니다. 값은 같은 격자 위에 있습니다.
 */
export const Spacing = {
  /** 제목과 바로 붙은 부제, 아이콘과 숫자 */
  s1: 4,
  /** 칩 사이, 아이콘과 글자, 배지 안쪽 */
  s2: 8,
  /** 구역 제목 → 내용, 카드 사이, 버튼 둘 사이 */
  s3: 12,
  /** 목록 항목 사이, 카드 안쪽 여백 */
  s4: 16,
  /** 화면 좌우 여백, 시트 안쪽 */
  s5: 20,
  /** 다이얼로그 안쪽, 구역 아래 여백 */
  s6: 24,
  /** 구역 위 여백 */
  s8: 32,
  /** 큰 구역(히어로 아래) */
  s10: 40,
  /** 빈 상태 위아래 */
  s12: 48,
  /** 화면 맨 아래 여유 */
  s16: 64,

  /* -------- 옛 이름 */
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/**
 * 모서리.
 *
 * <p>지금 섞여 있는 0·6·17·24 를 다섯 단으로 모읍니다. 자리마다 눈대중으로
 * 고르면 카드 안에 든 것이 카드보다 더 둥글어지는 일이 생깁니다.
 */
export const Radius = {
  none: 0,
  /** 배지, 태그 */
  r1: 4,
  /** 썸네일, 작은 버튼, 지도 위 작은 상자 */
  r2: 8,
  /** <b>버튼, 입력칸, 목록 카드, 정보 상자, 세그먼트</b> */
  r3: 12,
  /** 사진 카드, 큰 카드, 스낵바 */
  r4: 16,
  /** 바텀시트 위 모서리, 다이얼로그 */
  r5: 20,
  /** 칩, 스위치, 아바타, 지도 위 원 버튼 */
  full: 999,

  /* -------- 옛 이름 */
  /** 칸 안에 드는 작은 것 — 타일, 체크, 아이콘 단추 */
  sm: 12,
  /** 단추와 줄 */
  md: 12,
  /** 카드와 판 */
  lg: 16,
  /** 바텀시트 위 모서리 */
  sheet: 20,
} as const;

/**
 * 손가락으로 누르는 크기.
 *
 * <p>애플은 44pt, 구글은 48dp 를 최소로 봅니다. 어떤 것도 44 아래로 안
 * 내려가게 하되, 줄 안에 들어가는 작은 버튼은 보기에만 작게 두고 hitSlop 으로
 * 실제 누르는 넓이를 44 로 채웁니다.
 *
 * <p>전에는 52/62 였습니다. 글자가 20픽셀이던 시절의 값이라, 글자를 16으로
 * 되돌리면서 함께 내립니다 — 안 내리면 줄 안이 휑합니다.
 */
export const Tap = {
  /** 목록 한 줄, 중간 버튼 */
  min: 44,
  /** 화면의 주 동작 */
  control: 52,
  /** 줄 안에 들어가는 작은 버튼의 보이는 높이 */
  compact: 36,
  /** compact 를 44 로 채우기 위한 여유 */
  compactSlop: 4,
  /**
   * 글에 붙어 있는 동작 — 「편집」, 「+ 추가」.
   *
   * <p>{@link Tap.compact} 보다 한 단 더 작습니다. 제목 줄 끝에 붙는
   * 것들인데, 36 이면 제목보다 키가 커서 <b>제목이 버튼에 딸린 설명처럼</b>
   * 보였습니다.
   */
  tiny: 30,
  /** tiny 를 44 로 채우기 위한 여유 */
  tinySlop: 7,
  /** 칩 */
  chip: 34,
  /** 세그먼트 */
  segment: 40,
  /** 화면 안의 상단 탭 */
  topTab: 44,
  /** 상단바 */
  bar: 56,
} as const;

/**
 * 아래 갈래 띠가 먹는 높이. <b>안전영역은 안 셉니다.</b>
 *
 * <p>띠 자신과, 띠 때문에 아래를 비워야 하는 화면들이 같은 값을 봐야 합니다.
 *
 * <p>전에는 64 였습니다. 그 위에 안전영역이 또 더해지니 아이폰에서 띠가
 * <b>98픽셀</b>까지 자랐습니다 — 화면 아래 칠 분의 일을 갈래 이름 다섯이
 * 먹고 있었습니다.
 */
export const TabDock = 56;

/**
 * 큰 덩어리(구역) 사이의 간격.
 *
 * <p>띠로 구역을 가르는 화면에서는 띠가 이 일을 하므로 0 입니다. 카드를
 * 늘어놓는 목록에서만 씁니다.
 */
export const ScreenGap = 12;

/** 구역을 가르는 회색 띠의 높이. */
export const BandHeight = 8;

/**
 * 화면 좌우 여백.
 *
 * <p>가장 좁은 폰(360dp)에서도 양옆 20씩 떼면 320이 남아 한 줄에 한글이
 * 충분히 들어갑니다. <b>모든 글자가 이 선에 맞습니다.</b>
 */
export const Gutter = 20;

/**
 * 넓은 화면에서 글줄이 지나치게 길어지지 않게 잡아 둡니다.
 *
 * <p>글자를 16으로 되돌렸으므로 폭도 함께 좁힙니다 — 폭을 그대로 두면 한
 * 줄이 너무 길어져 눈이 다음 줄 첫 글자를 잃습니다.
 */
export const MaxContentWidth = 680;
