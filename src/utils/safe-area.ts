// 安全区工具（v1.7.0 度量重构新建）
// 背景：Taro RN（runtime-rn / components-rn）不内置 SafeAreaProvider（已核实源码无相关符号），
// 状态栏与底部手势区必须自取注入，否则 NavBar 顶进状态栏、TabBar 被手势条遮挡。
// 公式（审核修正版）：顶部 = statusBarHeight 直接用；
// 底部内嵌 = screenHeight − safeArea.bottom —— Taro 返回的 safeArea.bottom 是坐标值而非 inset，
// 直接用会得到几百 dp 的错误 padding；Android 非沉浸式该式自动得 0，iOS 得 34。
// 单位：返回值即 RN dp，调用方以 inline style 注入（inline 不经 pxtransform，不缩放）。
import Taro from '@tarojs/taro'
import { IS_RN } from './platform'

/** 安全区尺寸（dp） */
export interface SafeArea {
  /** 顶部状态栏高度，注入 NavBar paddingTop */
  statusBarHeight: number
  /** 底部手势条 / Home Indicator 内缩量，注入 TabBar paddingBottom */
  bottomInset: number
}

/**
 * 获取安全区内缩量。
 * 非 RN 平台返回全 0：H5 用 CSS env(safe-area-inset-*)、小程序由原生处理，无需 JS 注入。
 */
export function getSafeArea(): SafeArea {
  if (!IS_RN) {
    return { statusBarHeight: 0, bottomInset: 0 }
  }
  try {
    const info = Taro.getSystemInfoSync()
    const statusBarHeight = info.statusBarHeight || 0
    // screenHeight 在部分设备缺省时退回 windowHeight 兜底
    const screenHeight = info.screenHeight || info.windowHeight
    const safeBottom = info.safeArea && info.safeArea.bottom ? info.safeArea.bottom : screenHeight
    const bottomInset = Math.max(0, screenHeight - safeBottom)
    return { statusBarHeight, bottomInset }
  } catch {
    // 取不到系统信息时降级为 0，保证不崩
    return { statusBarHeight: 0, bottomInset: 0 }
  }
}

/**
 * 获取页面根节点高度（dp）。
 * RN 不支持 vh 单位且 flex:1 需要高度有界父容器，根节点必须显式设 windowHeight；
 * 非 RN 平台返回 0，由 CSS（100vh / flex）自行处理。
 */
export function getWindowHeight(): number {
  if (!IS_RN) {
    return 0
  }
  try {
    return Taro.getSystemInfoSync().windowHeight || 0
  } catch {
    return 0
  }
}
