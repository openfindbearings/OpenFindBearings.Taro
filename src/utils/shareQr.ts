// 分享素材地址构造（扫码与分享需求 v0.1.0）：
// 二维码与海报均由 API 生成，BFF 提供 /mobile/share/* 匿名转发，移动端只依赖 BFF 一个域名。
// H5 走同源（devServer 已代理 /mobile），RN 与小程序走 BFF 绝对地址（与业务请求同一 base）。
import { getBaseUrl, API_PREFIX } from '../services/config'

/** 分享来源白名单，与 API 侧保持一致 */
export type ShareSource = 'app' | 'h5' | 'weapp' | 'qr' | 'poster'

/** 分享素材目标类型 */
export type ShareTarget = 'bearing' | 'merchant'

/** 构造分享二维码图片地址 */
export function getShareQrUrl(type: ShareTarget, id: string, src: ShareSource = 'qr'): string {
  return `${getBaseUrl()}${API_PREFIX}/share/qr?type=${type}&id=${encodeURIComponent(id)}&src=${src}`
}

/** 构造分享海报图片地址（后端合成，三端只负责展示与保存） */
export function getSharePosterUrl(type: ShareTarget, id: string, src: ShareSource = 'poster'): string {
  return `${getBaseUrl()}${API_PREFIX}/share/poster?type=${type}&id=${encodeURIComponent(id)}&src=${src}`
}