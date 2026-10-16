// 分享工具（v1.6.0 搜索寻货联动）：H5 默认实现。
// 小程序原生分享走 <Button open-type='share'> + 页面 useShareAppMessage（见 components/ShareButton）；
// RN 走同目录 share.rn.ts（Metro 按 .rn. 后缀解析），本文件用于 H5/小程序。
import Taro from '@tarojs/taro'
import { getH5BaseUrl } from '../services/config'

/** 分享内容（标题 + 落地路径 + 可选配图） */
export interface ShareContent {
  title: string
  /** 落地路径：服务端落地页 /s/bearing/{id} 或内部页面 /pages/... */
  path: string
  imageUrl?: string
}

/**
 * 拼分享链接（绝对地址）。
 * 改动说明（分享落地页）：分享路径统一改为服务端落地页 /s/...（BFF 渲染 og 卡片），
 * 以 H5 公网域名对外呈现，避免出现过长的内部路由路径。
 * - 已是 http(s) 绝对地址：原样返回
 * - 服务端落地页（/s/...）：拼 H5 公网域名
 * - 其余内部页面路径（/pages/...）：浏览器用同源 origin + hash，非浏览器用 H5 base + hash
 */
export function toShareUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/s/')) return `${getH5BaseUrl()}${path}`
  if (typeof window !== 'undefined' && window.location) return `${window.location.origin}/#${path}`
  return `${getH5BaseUrl()}/#${path}`
}

/** H5 命令式分享：优先 Web Share API（覆盖微信/QQ/抖音等系统分享），不可用则复制链接兜底 */
export async function shareContent(content: ShareContent): Promise<void> {
  const url = toShareUrl(content.path)
  const nav: any = typeof navigator !== 'undefined' ? navigator : null
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: content.title, text: content.title, url })
      return
    } catch (e: any) {
      // 用户取消（AbortError）不算失败，静默返回
      if (e && e.name === 'AbortError') return
    }
  }
  await Taro.setClipboardData({ data: url })
  Taro.showToast({ title: '链接已复制，去粘贴分享', icon: 'none' })
}