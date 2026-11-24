// 扫码入口（RN）：Taro 未实现 scanCode，改为跳原生扫码页 pages/common/scan（VisionCamera 实现）。
// 解析逻辑统一在 scanParse.ts，与小程序/H5 共用同一套平台码规则。
import Taro from '@tarojs/taro'
import { parseScanResult, scanTargetUrl } from './scanParse'

export { parseScanResult, scanTargetUrl }
export type { ScanTarget } from './scanParse'

/** 打开原生扫码页；识别与跳转在扫码页内完成 */
export function scanAndOpen(): void {
  Taro.navigateTo({ url: '/pages/common/scan/index' })
}