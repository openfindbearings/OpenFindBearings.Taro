// 商家服务：搜索、详情、在售轴承（均调 BFF public 端点，auth:false）
import { request } from './request'
import { API, buildQuery } from './config'
import type { Paged } from './bearing'

/** 商家搜索结果项（对齐 BFF MerchantItem） */
export interface Merchant {
  id: string
  name: string
  companyName?: string | null
  type?: string | null
  isVerified: boolean
  status?: string | null
  productCount?: number | null
  logoUrl?: string | null
}

/** 商家详情（对齐 BFF MerchantDetail） */
export interface MerchantDetail {
  id: string
  name: string
  companyName?: string | null
  type?: string | null
  contactPerson?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  isVerified: boolean
  status?: string | null
  grade?: string | null
  followerCount: number
  productCount: number
  logoUrl?: string | null
}

/** 商家在售轴承项（对齐 BFF MerchantBearingItem） */
export interface MerchantBearing {
  bearingId: string
  bearingPartNumber: string
  oldNumber?: string | null
  bearingTypeName?: string | null
  brandName?: string | null
  innerDiameter?: number | null
  outerDiameter?: number | null
  width?: number | null
  price?: string | null
  isOnSale: boolean
}

/** 搜索商家 */
export function searchMerchants(params: { keyword?: string; verifiedOnly?: boolean; page?: number; pageSize?: number }) {
  const qs = buildQuery({
    keyword: params.keyword,
    verifiedOnly: params.verifiedOnly == null ? undefined : String(params.verifiedOnly),
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20
  })
  return request<Paged<Merchant>>(`${API.MERCHANTS_SEARCH}?${qs}`, { auth: false })
}

/** 商家详情 */
export function getMerchantDetail(id: string) {
  return request<MerchantDetail>(API.MERCHANT_DETAIL(id), { auth: false })
}

/** 商家在售轴承 */
export function getMerchantBearings(id: string) {
  return request<Paged<MerchantBearing>>(`${API.MERCHANT_BEARINGS(id)}?page=1&pageSize=20`, { auth: false })
}
