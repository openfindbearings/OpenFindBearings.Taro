// 扫码入口（小程序 / H5）：能力探测后调用 Taro.scanCode，识别平台码即跳详情。
// RN 端由 scanRoute.rn.ts 覆盖实现（跳原生扫码页），解析逻辑统一在 scanParse.ts。
import Taro from '@tarojs/taro'
import { showTip } from './toast'
import { parseScanResult, scanTargetUrl } from './scanParse'

export { parseScanResult, scanTargetUrl }
export type { ScanTarget } from './scanParse'

/**
 * 唤起扫码并跳转：三处入口（搜索框图标、首页宫格扫条码、后续扩展）共用。
 * 能力缺失时只提示不抛错——H5 无扫码能力，直接调用会异常。
 */
export function scanAndOpen(): void {
  const runtime = Taro as unknown as { scanCode?: (opts: { onlyFromCamera?: boolean }) => Promise<{ result?: string }> }
  if (process.env.TARO_ENV === 'h5' || typeof runtime.scanCode !== 'function') {
    showTip('当前版本暂不支持扫码，请在 App 或小程序内使用')
    return
  }
  try {
    runtime.scanCode({ onlyFromCamera: false })
      .then((res) => {
        const target = parseScanResult(res?.result || '')
        if (!target) {
          showTip('未识别到平台二维码')
          return
        }
        Taro.navigateTo({ url: scanTargetUrl(target) })
      })
      .catch(() => { /* 用户取消或权限拒绝：静默 */ })
  } catch {
    showTip('扫码不可用，请稍后重试')
  }
}