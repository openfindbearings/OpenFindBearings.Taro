// 主题状态管理（Zustand）
// H5 端：data-theme 属性运行时切换深浅色
// RN 端：provider 切换 + 重新渲染（第三阶段实现）
import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'app_theme'

/** 从 localStorage 读取初始主题 */
function getInitialMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved
      }
    }
  } catch {
    // 容错：localStorage 不可用时返回默认值
  }
  return 'light'
}

/** 将主题应用到 <html data-theme> 属性（H5 端生效） */
function applyThemeToDom(mode: ThemeMode) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'system') {
    // 跟随系统：移除 data-theme，让媒体查询自动生效
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
  // #endif
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 容错
    }
    applyThemeToDom(mode)
    set({ mode })
  }
}))

/** 初始化主题（app.tsx 启动时调用一次） */
export function initTheme() {
  const mode = getInitialMode()
  applyThemeToDom(mode)
}
