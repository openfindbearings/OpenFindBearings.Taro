// 跨平台主题色工具
// H5 端：可选 CSS 变量覆盖（保留兼容）
// RN 端：通过此工具获取当前主题色，用于 inline style
import { useThemeStore, ThemeMode } from '../stores/theme'

/** 浅色主题色板 */
const LIGHT = {
  bgPage: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgInput: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  primary: '#0EA5E9',
  primaryLight: '#E0F2FE',
  danger: '#EF4444',
  dangerBg: '#7F1D1D',
  white: '#FFFFFF'
}

/** 深色主题色板 */
const DARK = {
  bgPage: '#0F172A',
  bgCard: '#1E293B',
  bgInput: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#334155',
  primary: '#0EA5E9',
  primaryLight: '#334155',
  danger: '#EF4444',
  dangerBg: '#7F1D1D',
  white: '#FFFFFF'
}

export type ThemeColors = typeof LIGHT

/** 根据主题模式返回对应色板 */
function resolveColors(mode: ThemeMode): ThemeColors {
  if (mode === 'dark') return DARK
  if (mode === 'system') {
    // #ifdef H5
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT
    }
    // #endif
    return LIGHT
  }
  return LIGHT
}

/**
 * React Hook：返回当前主题色板（响应式切换）
 * 用法：const colors = useThemeColors()
 */
export function useThemeColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode)
  return resolveColors(mode)
}

/**
 * 非 Hook 版本：直接读取当前主题色板（用于 class 组件或一次性读取）
 */
export function getThemeColors(): ThemeColors {
  const mode = useThemeStore.getState().mode
  return resolveColors(mode)
}
