// 主题模式 store（Zustand）：light / dark / system
// 改动说明（深色模式落地）：
//   1. 移除此前"RN 锁浅色"的 setMode 守卫——本轮实现真·深色；
//   2. 持久化改用跨端异步 storage 封装（RN 无 window.localStorage）；
//   3. H5 的 DOM data-theme 切换归入第二阶段（做 H5 时按平台重新接入），
//      此处仅维护模式状态；实际取色由 useTheme() 按 mode × 主题预设计算。
import { create } from 'zustand'
import { getItem, setItem } from '../utils/storage'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'app_theme'

interface ThemeState {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  setMode: (m: ThemeMode) => {
    set({ mode: m })
    setItem(STORAGE_KEY, m).catch(() => { /* 存储失败不影响运行时 */ })
  }
}))

/** 启动时从本地存储恢复主题模式（app 入口调用一次） */
export async function initTheme(): Promise<void> {
  try {
    const v = await getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') {
      useThemeStore.setState({ mode: v })
    }
  } catch {
    /* 默认 light */
  }
}
