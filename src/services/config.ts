/** BFF API 配置常量 */

/** API 路径前缀 */
export const API_PREFIX = '/mobile'

/**
 * 手写 query string 构造。
 * 改动说明：Hermes(RN 0.70) 的 URLSearchParams 未实现 .set/.toString，
 * 用它会抛 "URLSearchParams.set is not implemented"，故改用手写拼接 + encodeURIComponent。
 * 传入 key/value 对，跳过 null/undefined/'' 值。
 */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === null || v === undefined || v === '') return
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return parts.join('&')
}

/** BFF 线上绝对地址（RN/小程序无 dev proxy，必须走公网 https） */
const BFF_PROD_BASE = 'https://bff.515813.xyz'

/**
 * 按平台返回请求 base 地址。
 * 改动说明：原实现无条件返回 ''，仅适用于 H5 开发期 webpack proxy；
 * RN 真机/模拟器无 proxy，相对路径会触发 Network request failed，
 * 故 RN 与小程序返回 BFF 公网绝对地址。H5 仍返回 ''（dev proxy / 同源）。
 * 可用环境变量 TARO_APP_BFF_BASE_URL 覆盖（默认 https://bff.515813.xyz）。
 */
export function getBaseUrl(): string {
  const env = process.env.TARO_ENV
  if (env === 'h5') {
    return ''
  }
  return process.env.TARO_APP_BFF_BASE_URL || BFF_PROD_BASE
}

/**
 * 判断图片地址是否可在 RN 直接加载。
 * 改动说明：API 返回的 image2DUrl/image3DUrl 可能是相对路径（如 /images/bearings/2d/xxx），
 * RN <Image> 加载相对地址会抛 "Warning: Image source ..." 且显示破图。
 * 故仅当为绝对 http(s) 地址时才渲染 <Image>，否则由调用方回退默认占位图标。
 */
export function usableImage(url?: string | null): string {
  return url && /^https?:\/\//i.test(url) ? url : ''
}

/** API 路径 */
export const API = {
  /** 认证 */
  LOGIN: `${API_PREFIX}/auth/login`,
  REGISTER: `${API_PREFIX}/auth/register`,
  REFRESH: `${API_PREFIX}/auth/refresh`,

  /** 首页聚合 */
  HOME: `${API_PREFIX}/home`,

  /** 轴承 */
  BEARINGS_SEARCH: `${API_PREFIX}/bearings/search`,
  BEARING_DETAIL: (id: string) => `${API_PREFIX}/bearings/${id}`,
  BEARING_MERCHANTS: (id: string) => `${API_PREFIX}/bearings/${id}/merchants`,
  BEARING_INTERCHANGES: (id: string) => `${API_PREFIX}/bearings/${id}/interchanges`,

  /** 商家 */
  MERCHANTS_SEARCH: `${API_PREFIX}/merchants/search`,
  MERCHANT_DETAIL: (id: string) => `${API_PREFIX}/merchants/${id}`,
  MERCHANT_BEARINGS: (id: string) => `${API_PREFIX}/merchants/${id}/bearings`,

  /** 个人 */
  PROFILE: `${API_PREFIX}/profile`,
  FAVORITES: `${API_PREFIX}/favorites`,
  FOLLOWED: `${API_PREFIX}/followed`,
  HISTORY: `${API_PREFIX}/history`,

  /** 配置 */
  CONFIG: `${API_PREFIX}/config`,
} as const
