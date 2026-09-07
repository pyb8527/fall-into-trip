/**
 * 색 한 벌.
 *
 * 예전에는 밝은 벌과 어두운 벌을 골랐지만 지금은 한 벌만 씁니다. 그래도
 * 화면들이 이 훅으로 색을 받아 가므로 자리를 남겨 둡니다. 나중에 벌이
 * 늘어나도 화면 코드는 그대로입니다.
 */

import { Colors, type Theme } from '@/constants/theme';

export function useTheme(): Theme {
  return Colors;
}
