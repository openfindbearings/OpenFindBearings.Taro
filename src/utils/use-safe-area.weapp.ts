// 安全区 hook - 微信小程序实现
// 改动说明：H5/小程序共用的 use-safe-area.ts 返回全 0（H5 用 CSS env() 即可），
//   但项目 navigationStyle 为 custom，小程序端状态栏与 Home 指示条不会自动让位，
//   顶部搜索栏怼进状态栏、底部 tab 文字被 Home 条压住。
//   此 weapp 分支用 getWindowInfo 返回真实内缩：top=状态栏高度、
//   bottom=屏幕高-safeArea.bottom（全面屏手势条 34px，普通屏 0）。
//   NavBar / CustomTabBar / my 页已消费本 hook，无需改调用方。
import Taro from '@tarojs/taro'
import type { UseSafeAreaResult } from './use-safe-area-types'

// 模块级缓存：安全区在小程序生命周期内不变，避免每次渲染同步调系统 API
let cached: UseSafeAreaResult | null = null

function readInsets(): UseSafeAreaResult {
  try {
    const win = Taro.getWindowInfo()
    const top = win.statusBarHeight ?? 0
    // safeArea 在部分低端安卓可能缺失，兜底 0
    const bottom = win.safeArea && win.screenHeight
      ? Math.max(0, win.screenHeight - win.safeArea.bottom)
      : 0
    return { top, bottom }
  } catch {
    return { top: 0, bottom: 0 }
  }
}

export function useSafeArea(): UseSafeAreaResult {
  if (!cached) cached = readInsets()
  return cached
}

export default useSafeArea
