// 主题色偏好 store（Zustand）+ usePrimary hook
// 职责：运行时主题色的唯一来源。各组件通过 usePrimary() 读取当前预设色板，
//   把主色相关颜色以 inline style 应用（SCSS $primary 是编译期常量，无法运行时改）。
// 持久化：storage key app_theme_color。
// 深色模式：本阶段锁浅色，色板即浅色档；深色变体后续接入。
import { create } from 'zustand'
import { getItem, setItem } from '../utils/storage'
import { ThemePreset, getThemePreset, DEFAULT_THEME_KEY } from '../styles/themes'

const STORAGE_KEY = 'app_theme_color'

interface ThemeColorState {
  key: string
  setKey: (k: string) => void
}

export const useThemeColorStore = create<ThemeColorState>((set) => ({
  key: DEFAULT_THEME_KEY,
  setKey: (k: string) => {
    set({ key: k })
    setItem(STORAGE_KEY, k).catch(() => { /* 存储失败不影响运行时 */ })
  }
}))

/** 启动时从本地存储恢复主题色（app 入口调用一次） */
export async function initThemeColor(): Promise<void> {
  try {
    const v = await getItem(STORAGE_KEY)
    if (v) useThemeColorStore.setState({ key: v })
  } catch {
    /* 默认 sky */
  }
}

/**
 * 读取当前主色色板（响应式）。
 * 用法：const { primary, primaryText, primaryDeep, primaryLight } = usePrimary()
 */
export function usePrimary(): ThemePreset {
  const key = useThemeColorStore((s) => s.key)
  return getThemePreset(key)
}
