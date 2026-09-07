/**
 * 색과 간격.
 *
 * 밝은 화면과 어두운 화면 두 벌을 같은 이름으로 둡니다. 화면 코드에서는
 * useTheme() 으로 받은 이름만 쓰고 색값을 직접 적지 않습니다. 한 곳에서만
 * 고치면 되도록.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#101114',
    textSecondary: '#60646C',
    textMuted: '#8B8D98',
    background: '#FFFFFF',
    backgroundElement: '#F4F5F7',
    backgroundSelected: '#E4E6EA',
    border: '#DFE1E6',
    accent: '#2563EB',
    accentText: '#FFFFFF',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    success: '#16A34A',
    warning: '#B45309',
  },
  dark: {
    text: '#F5F6F8',
    textSecondary: '#B0B4BA',
    textMuted: '#7E828B',
    background: '#0E0F11',
    backgroundElement: '#1B1D20',
    backgroundSelected: '#2A2D31',
    border: '#2E3135',
    accent: '#4F86F7',
    accentText: '#0B0C0E',
    danger: '#F87171',
    dangerSoft: '#3B1A1A',
    success: '#4ADE80',
    warning: '#FBBF24',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/* as const 때문에 각 색이 리터럴 타입이 됩니다. 밝은 벌과 어두운 벌을 같은
   타입으로 다루려면 값 타입을 string 으로 넓혀 둬야 합니다. */
export type Theme = { readonly [K in ThemeColor]: string };

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
})!;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** 넓은 화면(웹·태블릿)에서 글줄이 지나치게 길어지지 않게 잡아 둡니다. */
export const MaxContentWidth = 760;
