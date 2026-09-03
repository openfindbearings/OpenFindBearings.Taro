/** BFF API 配置常量 */

/** API 路径前缀 */
export const API_PREFIX = '/mobile'

/** H5 开发环境使用相对路径 + webpack proxy，小程序使用环境变量 */
export function getBaseUrl(): string {
  return '' // H5 模式走相对路径，proxy 到 BFF
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
