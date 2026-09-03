// 主题切换 hook
// 封装 setMode，提供简洁的 useTheme() 接口
import { useThemeStore, ThemeMode } from '../stores/theme'

export function useTheme() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  return { mode, setMode }
}

export type { ThemeMode }
