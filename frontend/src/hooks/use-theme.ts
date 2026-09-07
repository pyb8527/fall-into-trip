/**
 * 지금 화면이 밝은지 어두운지에 맞는 색 한 벌.
 *
 * 기기가 알려 주지 않으면(null) 밝은 쪽으로 봅니다.
 */

import { Colors, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}
