// 胶囊按钮右侧预留宽度 - 微信小程序实现
// 改动说明：navigationStyle custom 下，右上角"…⊙"胶囊悬浮在页面之上，
//   不自定义让位的话 NavBar 搜索框/右侧图标会被胶囊压住（H5/RN 无胶囊从未暴露）。
//   用 getMenuButtonBoundingClientRect 取胶囊左边界，预留 = 屏宽 - 胶囊左边 + 8px 间隙。
//   结果模块级缓存（胶囊位置在生命周期内不变）。
import Taro from '@tarojs/taro'

let cached: number | null = null

/** 返回导航栏右侧需为胶囊预留的宽度（px）；取不到胶囊信息时兜底 100px */
export function capsuleRightReserve(): number {
  if (cached !== null) return cached
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    const { screenWidth } = Taro.getWindowInfo()
    // 预留到胶囊左边界外再留 8px 呼吸间隙
    cached = Math.max(0, screenWidth - rect.left + 8)
  } catch {
    // 兜底：胶囊常规占位 ≈ 屏宽右边 100px（iOS/Android 胶囊宽度基本一致）
    cached = 100
  }
  return cached
}
