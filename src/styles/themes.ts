// 预制主题色板（方案 A：预设，不做自定义取色）
// 每个预设提供四档色：primary（图标/装饰/实心）、primaryText（文字级，AA 对比）、
// primaryDeep（深色档，渐变尾/按压）、primaryLight（浅底）。覆盖暖色与冷色。
// 说明：主色用于运行时切换（zustand store + usePrimary hook 内联），
//   语义色（成功绿/警告橙/危险红、快捷三钮三色）不随主题变化，保持固定。
// 深色模式：本阶段 RN 锁浅色；后续接入深色时，各预设再补 dark 变体（此处预留结构）。

/** 一个主题色预设 */
export interface ThemePreset {
  key: string
  /** 中文显示名 */
  name: string
  /** 主色（图标/装饰/实心圆/开关） */
  primary: string
  /** 文字级主色（tab 选中/链接/强调文字，满足对白底 AA） */
  primaryText: string
  /** 深色档（会员卡渐变尾、按压态） */
  primaryDeep: string
  /** 主色浅底（占位图标圆底、选中浅背景） */
  primaryLight: string
  /** 深色模式强调色（更亮、对深色底达标的同色系变体；方案①：深色仍尊重用户选色） */
  primaryDark: string
}

/** 预设列表：天空蓝(默认)/翡翠绿/琥珀橙/玫红/紫罗兰/石墨，冷暖兼顾 */
export const THEME_PRESETS: ThemePreset[] = [
  { key: 'sky', name: '天空蓝', primary: '#0EA5E9', primaryText: '#0284C7', primaryDeep: '#0369A1', primaryLight: '#E0F2FE', primaryDark: '#38BDF8' },
  { key: 'jade', name: '翡翠绿', primary: '#10B981', primaryText: '#059669', primaryDeep: '#047857', primaryLight: '#D1FAE5', primaryDark: '#34D399' },
  { key: 'amber', name: '琥珀橙', primary: '#F59E0B', primaryText: '#D97706', primaryDeep: '#B45309', primaryLight: '#FEF3C7', primaryDark: '#FBBF24' },
  { key: 'rose', name: '玫瑰红', primary: '#F43F5E', primaryText: '#E11D48', primaryDeep: '#BE123C', primaryLight: '#FFE4E6', primaryDark: '#FB7185' },
  { key: 'violet', name: '紫罗兰', primary: '#8B5CF6', primaryText: '#7C3AED', primaryDeep: '#6D28D9', primaryLight: '#EDE9FE', primaryDark: '#A78BFA' },
  { key: 'graphite', name: '石墨灰', primary: '#475569', primaryText: '#334155', primaryDeep: '#1E293B', primaryLight: '#E2E8F0', primaryDark: '#94A3B8' }
]

/** 默认预设 key */
export const DEFAULT_THEME_KEY = 'sky'

/** 按 key 取预设，未知回退默认 */
export function getThemePreset(key: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.key === key) || THEME_PRESETS[0]
}
