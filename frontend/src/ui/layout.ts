import { Platform, useWindowDimensions } from 'react-native';

import { Spacing } from '@/constants/theme';

/**
 * 화면 너비 단계.
 *
 * <h3>웹이 이미 돌아가고 있었습니다</h3>
 *
 * <p>이 앱은 폰과 웹이 같은 코드입니다. 그래서 PC 브라우저에서도 열리기는
 * 하는데, 폰 폭에 맞춰 짠 화면이 1920픽셀짜리 창에 그대로 늘어나 있었습니다 —
 * 글줄이 화면을 가로지르고, 아래 갈래 띠가 모니터 밑에 깔리고, 카드 하나가
 * 한 줄을 통째로 먹었습니다.
 *
 * <p>너비를 재서 세 단계로 가릅니다. 재는 자리를 여기 하나로 모읍니다 —
 * 부품마다 숫자를 따로 적어 두면 어떤 것은 768에서, 어떤 것은 800에서 바뀌어
 * 그 사이 폭에서 화면이 반쯤 바뀐 모양이 됩니다.
 */
export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/**
 * 경계.
 *
 * <p>768은 세로로 세운 태블릿의 폭이고, 1024는 가로로 눕힌 태블릿과 작은
 * 노트북의 폭입니다. 흔히 쓰는 자리라 기기들이 그 근처에서 갈립니다.
 */
const TABLET = 768;
const DESKTOP = 1024;

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  /*
    앱(네이티브)에서는 늘 phone 입니다.

    <p>계획서가 정한 넓은 화면은 <b>웹</b>입니다. 그리고 넓은 배치가 쓰는
    것들이 웹에만 있습니다 — 사이드바는 {@code position: fixed} 로 서서
    내용 바깥에 붙고, 앱에는 fixed 가 없어 absolute 로 떨어집니다. 그러면
    사이드바가 자리를 비켜 둔 내용 <b>안쪽</b>에 갇혀 240 만큼 밀려 섭니다.

    <p>가로로 눕힌 큰 태블릿 앱에서 반쯤 바뀐 모양을 보는 것보다, 폰 배치
    그대로 보는 편이 낫습니다. 안드로이드 웹뷰는 웹이므로 폭만 보고 갈립니다
    (그쪽은 어차피 768 밑입니다).
  */
  if (Platform.OS !== 'web') {
    return 'phone';
  }
  if (width >= DESKTOP) {
    return 'desktop';
  }
  if (width >= TABLET) {
    return 'tablet';
  }
  return 'phone';
}

/**
 * 넓은 화면인지만 물을 때.
 *
 * <p>대부분의 부품이 알고 싶은 것은 「사이드바가 섰는가」 하나입니다.
 */
export function useWide(): boolean {
  return useBreakpoint() === 'desktop';
}

/**
 * 본문이 넓어질 수 있는 최대 폭.
 *
 * <p>폰에서는 화면 폭 그대로이고, 넓은 화면에서는 가운데로 모읍니다. 한 줄이
 * 길어지면 눈이 다음 줄 첫 글자를 잃습니다.
 *
 * <p>desktop 이 tablet 보다 넓은 것은 그쪽에 <b>옆으로 벌리는 배치</b>(일정
 * + 지도, 카드 세 칸)가 서기 때문입니다. 글만 흐르는 화면에서는 둘 다 680을
 * 넘지 않습니다.
 */
export const ContentWidth: Record<Breakpoint, number> = {
  phone: 9999,
  tablet: 680,
  desktop: 960,
};

/** 왼쪽 사이드바의 폭. 넓은 화면에서 아래 갈래 띠를 대신합니다. */
export const SidebarWidth = 240;

/**
 * 카드를 몇 칸으로 늘어놓을지.
 *
 * <p>폰에서 한 칸인 것을 넓은 화면에서도 한 칸으로 두면, 카드 하나가 960픽셀
 * 줄을 통째로 먹고 그 안의 글자는 왼쪽 끝에 몰립니다.
 */
export const CardColumns: Record<Breakpoint, number> = {
  phone: 1,
  tablet: 2,
  desktop: 3,
};

/** 몇 칸인지만 물을 때. 칸을 세는 쪽이 단계를 다시 외우지 않게 합니다. */
export function useCardColumns(): number {
  return CardColumns[useBreakpoint()];
}

/**
 * 카드 사이.
 *
 * <p>계획서가 정한 20 입니다. 화면 좌우 여백과 같은 값이라, 세 칸이 섰을
 * 때 카드 사이와 화면 끝까지가 같은 간격으로 보입니다.
 */
export const CardGap = Spacing.s5;

/**
 * 지도를 쓰는 상세 화면의 왼쪽 패널 폭.
 *
 * <p>폰에서는 지도 위로 끌어올리는 판(DragSheet)이 하던 일입니다. 넓은
 * 화면에서는 끌 까닭이 없습니다 — 지도와 일정을 나란히 둘 자리가 있으니,
 * 판을 올렸다 내렸다 하는 것은 손이 한 번 더 가는 일일 뿐입니다.
 *
 * <p>420 은 장소 줄(썸네일 56 + 이름 + 메모)이 줄바꿈 없이 들어가는 폭이고,
 * 1024 에서도 지도에 600 이 남습니다.
 */
export const SidePanelWidth = 420;
