import { request } from './request'
import { API } from './config'

/** 商家信息 */
export interface Merchant {
  id: string
  name: string
  logoUrl?: string
  description?: string
  isVerified: boolean
  contact?: string
  businessScope?: string
  /** 在售商品数 */
  bearingCount?: number
}

/** 搜索商家 */
export async function searchMerchants(keyword: string, page = 1, pageSize = 20) {
  return request<{ items: Merchant[]; totalCount: number }>(
    `${API.MERCHANTS_SEARCH}?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
    { auth: false }
  )
}

/** 获取商家详情 */
export async function getMerchantDetail(id: string) {
  return request<Merchant>(API.MERCHANT_DETAIL(id), { auth: false })
}

/** 获取商家在售商品 */
export async function getMerchantBearings(merchantId: string) {
  return request<any[]>(API.MERCHANT_BEARINGS(merchantId), { auth: false })
}
