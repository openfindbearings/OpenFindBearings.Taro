// 安全区 hook（RN 实现）
// 标准 RN 做法：通过 react-native-safe-area-context 的 useSafeAreaInsets() 获取
// 状态栏顶部内缩与底部 Home Indicator 内缩，替代之前手读 Taro.getSystemInfoSync()
// 再手工计算总高（border-box 盒模型 hack）的损招。
// 前置条件：应用根（src/app.rn.tsx）已包 SafeAreaProvider。
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { UseSafeAreaResult } from './use-safe-area-types'

export function useSafeArea(): UseSafeAreaResult {
  const insets = useSafeAreaInsets()
  return { top: insets.top, bottom: insets.bottom }
}

export default useSafeArea