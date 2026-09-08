// 安全区 hook（H5 / 小程序实现）
// RN 端使用同目录 use-safe-area.rn.ts（基于 react-native-safe-area-context 的 useSafeAreaInsets）；
// H5 / 小程序此文件返回全 0：H5 用 CSS env(safe-area-inset-*)、小程序由原生处理，无需 JS 注入。
import type { UseSafeAreaResult } from './use-safe-area-types'

export function useSafeArea(): UseSafeAreaResult {
  return { top: 0, bottom: 0 }
}

export default useSafeArea