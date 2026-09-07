// 主题状态管理（Zustand）
// H5 端：data-theme 属性运行时切换深浅色
// RN 端：v1.7.0 本轮锁定浅色（深色需全页配色令牌化，属第二阶段），非浅色选择
//   在 setMode 单点拦截并 toast 提示，避免"设置页能变暗别页不变"的分裂体验。
//   第二步放开时删除 IS_RN 守卫即可。
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { IS_RN } from '../utils/platform'

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
    // RN 锁浅色守卫：非 light 选择直接提示并返回，不落 storage 不改状态
    if (IS_RN && mode !== 'light') {
      Taro.showToast({ title: '深色模式将在后续版本支持', icon: 'none' })
      return
    }
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
