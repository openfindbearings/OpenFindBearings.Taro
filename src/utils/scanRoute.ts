// 扫码结果解析（三端共用）：把扫到的平台二维码还原成「类型 + id + 附带参数」
// 平台码固定是分享落地页链接：/s/bearing/{id}?view=supply&src=qr 与 /s/merchant/{id}?src=qr
// 解析只认路径形态，不强制校验域名（自建/测试环境域名可能不同），但非平台形态一律判为无法识别。
import Taro from '@tarojs/taro'
import { showTip } from './toast'

export interface ScanTarget {
  /** 目标类型：轴承型号详情或商家详情 */
  type: 'bearing' | 'merchant'
  /** 目标实体 id（GUID） */
  id: string
  /** 附带的视图参数，如 supply（货源视图） */
  view?: string
  /** 来源标记，用于后续统计 */
  src?: string
}

/** 落地页路径正则：/s/(bearing|merchant)/{guid}，允许任意协议与域名前缀 */
const LANDING_PATTERN = /\/s\/(bearing|merchant)\/([0-9a-fA-F-]{36})(?:[?#](.*))?$/

/**
 * 解析扫码内容为跳转目标；非平台二维码返回 null
 * 兼容扫码引擎返回的完整 URL 与带前后空白的文本
 */
export function parseScanResult(raw: string): ScanTarget | null {
  const text = (raw || '').trim()
  if (!text) return null

  const matched = LANDING_PATTERN.exec(text)
  if (!matched) return null

  const type = matched[1] as 'bearing' | 'merchant'
  const id = matched[2]
  const query = matched[3] || ''

  const target: ScanTarget = { type, id }
  query.split('&').forEach((pair) => {
    const index = pair.indexOf('=')
    if (index <= 0) return
    const key = pair.slice(0, index)
    const value = decodeURIComponent(pair.slice(index + 1))
    if (key === 'view' && value) target.view = value
    if (key === 'src' && value) target.src = value
  })
  return target
}

/**
 * 由扫码目标拼跳转地址：轴承进型号详情（保留货源视图），商家进店铺详情
 * 路径与 BFF 落地页保持同一套语义，App 内不经过 H5。
 */
export function scanTargetUrl(target: ScanTarget): string {
  if (target.type === 'bearing') {
    const view = target.view ? `&view=${encodeURIComponent(target.view)}` : ''
    return `/pages/home/bearingDetail?id=${target.id}${view}`
  }
  return `/pages/merchant/merchantDetail?id=${target.id}`
}

/**
 * 唤起扫码并跳转（v1.4.44）：三处入口（搜索框图标、首页宫格扫条码、后续扩展）共用。
 * 平台能力缺失时只提示不抛错——H5 无扫码、RN 端 Taro 未实现 scanCode，
 * 直接调用会抛异常导致整页崩溃，必须先做能力探测并包 try/catch。
 */
export function scanAndOpen(): void {
  const runtime = Taro as unknown as { scanCode?: (opts: { onlyFromCamera?: boolean }) => Promise<{ result?: string }> }
  if (process.env.TARO_ENV === 'h5' || typeof runtime.scanCode !== 'function') {
    showTip('当前版本暂不支持扫码，请在支持扫码的端使用')
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