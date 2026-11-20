// 分享二维码地址构造（扫码与分享需求 v0.1.0 P0-1/P0-3）。
// 二维码由 BFF 端点 /s/qr 生成，内容指向 /s 落地页；H5 走同源（生产由 nginx 反代 /s/，
// 开发由 devServer 代理），RN 与小程序走 BFF 绝对地址（与业务请求同一 base）。
import { getBaseUrl } from '../services/config'

/** 分享来源白名单，与 BFF 侧保持一致 */
export type ShareSource = 'app' | 'h5' | 'weapp' | 'qr' | 'poster'

/** 二维码目标类型 */
export type ShareQrTarget = 'bearing' | 'merchant'

/**
 * 构造分享二维码图片地址。
 * type 决定落地页形态（轴承货源 / 商家店铺），src 用于后续来源统计。
 */
export function getShareQrUrl(type: ShareQrTarget, id: string, src: ShareSource = 'qr'): string {
  const base = getBaseUrl()
  return `${base}/s/qr?type=${type}&id=${encodeURIComponent(id)}&src=${src}`
}