import { useWindowDimensions } from 'react-native';

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
