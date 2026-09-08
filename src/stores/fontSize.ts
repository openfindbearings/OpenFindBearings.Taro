// 全局字号偏好 store（Zustand）
// 职责：作为 App 内所有文本字号的唯一运行时来源（小/中/大 → 缩放系数）。
// 背景：Taro RN 的 className 是文件作用域、且 SCSS 字号为编译期静态值，无法运行时缩放；
//   故采用"各 Text 保留 className 供颜色/字重 + 内联 style 覆盖 fontSize/lineHeight"的方案，
//   内联值 = 设计基准字号 × 缩放系数。系数的唯一真相在此。
// 持久化：storage key app_font_size（异步封装，RN 无同步存储）。
import { create } from 'zustand'
import { getItem, setItem } from '../utils/storage'

/** 字号档位 */
export type FontSizeKey = 'small' | 'medium' | 'large'

/** 存储键 */
const STORAGE_KEY = 'app_font_size'

/** 各档位缩放系数：中为基准 1.0，小 0.9，大 1.15 */
export const FONT_SCALE: Record<FontSizeKey, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15
}

interface FontSizeState {
  size: FontSizeKey
  setSize: (s: FontSizeKey) => void
}

export const useFontSizeStore = create<FontSizeState>((set) => ({
  size: 'medium',
  setSize: (s: FontSizeKey) => {
    set({ size: s })
    setItem(STORAGE_KEY, s).catch(() => { /* 存储失败不影响运行时 */ })
  }
}))

/** 启动时从本地存储恢复字号档位（app 入口调用一次） */
export async function initFontSize(): Promise<void> {
  try {
    const v = await getItem(STORAGE_KEY)
    if (v === 'small' || v === 'medium' || v === 'large') {
      useFontSizeStore.setState({ size: v })
    }
  } catch {
    /* 默认 medium */
  }
}
