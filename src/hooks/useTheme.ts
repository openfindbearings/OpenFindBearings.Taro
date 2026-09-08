// 全色板 hook：useTheme()
// 职责：按「主题模式(light/dark/system) × 主题预设」计算整套运行时颜色，供全站 inline style 取用。
// 背景：RN 无 CSS 变量、SCSS 颜色为编译期常量，运行时切换深浅色只能逐元素 inline 覆盖（与字号/主色同因）。
// 方案①：深色模式用固定中性深色彩底，但强调色仍尊重用户预设（取预设的 primaryDark 亮变体），切换不跳色。
// 用法：const t = useTheme(); <View style={{ backgroundColor: t.bgCard }} />
import { useThemeStore } from '../stores/theme'
import { useThemeColorStore } from './useThemeColor'
import { useSystemTheme } from './useSystemTheme'
import { getThemePreset } from '../styles/themes'

/** 完整色板 */
export interface ThemePalette {
  isDark: boolean
  // 面
  bgPage: string
  bgCard: string
  bgInput: string
  bgBadge: string
  // 文字
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textOnPrimary: string
  // 线
  border: string
  borderLight: string
  // 强调色（随模式×预设）
  primary: string
  primaryText: string
  primaryDeep: string
  primaryLight: string
  // 语义色
  danger: string
  success: string
  warning: string
  // 骨架
  navBarBg: string
  navBarText: string
  tabBarBg: string
  tabBarBorder: string
  tabBarText: string
  tabBarTextActive: string
  // 会员卡渐变两端
  memberGradientFrom: string
  memberGradientTo: string
  // 阴影色
  shadowColor: string
}

/**
 * 读取当前完整色板（响应式：mode、preset 或系统深浅色变化即重渲染）。
 */
export function useTheme(): ThemePalette {
  const mode = useThemeStore((s) => s.mode)
  const presetKey = useThemeColorStore((s) => s.key)
  const system = useSystemTheme()
  const preset = getThemePreset(presetKey)
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark')

  if (isDark) {
    return {
      isDark: true,
      bgPage: '#0F172A',
      bgCard: '#1E293B',
      bgInput: '#334155',
      bgBadge: '#334155',
      textPrimary: '#F1F5F9',
      textSecondary: '#CBD5E1',
      textTertiary: '#94A3B8',
      textOnPrimary: '#0B1220',
      border: '#334155',
      borderLight: '#1E293B',
      primary: preset.primaryDark,
      primaryText: preset.primaryDark,
      primaryDeep: preset.primary,
      primaryLight: '#334155',
      danger: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      navBarBg: '#1E293B',
      navBarText: '#F1F5F9',
      tabBarBg: '#0F172A',
      tabBarBorder: '#1E293B',
      tabBarText: '#94A3B8',
      tabBarTextActive: preset.primaryDark,
      memberGradientFrom: preset.primaryDark,
      memberGradientTo: preset.primary,
      shadowColor: 'rgba(0, 0, 0, 0.5)'
    }
  }

  return {
    isDark: false,
    bgPage: '#F5F7FA',
    bgCard: '#FFFFFF',
    bgInput: '#F1F5F9',
    bgBadge: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    textOnPrimary: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    primary: preset.primary,
    primaryText: preset.primaryText,
    primaryDeep: preset.primaryDeep,
    primaryLight: preset.primaryLight,
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    navBarBg: '#FFFFFF',
    navBarText: '#0F172A',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    tabBarText: '#64748B',
    tabBarTextActive: preset.primaryText,
    memberGradientFrom: preset.primary,
    memberGradientTo: preset.primaryDeep,
    shadowColor: 'rgba(15, 23, 42, 0.12)'
  }
}
