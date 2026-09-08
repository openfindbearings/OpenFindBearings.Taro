// 轴承服务：搜索、详情、在售商家、替代品（均调 BFF public 端点，auth:false）
import { request } from './request'
import { API, buildQuery } from './config'

/** 轴承搜索结果项（对齐 BFF BearingItem） */
export interface Bearing {
  id: string
  partNumber: string
  oldNumber?: string | null
  bearingType: string
  innerDiameter: number
  outerDiameter: number
  width: number
  brandName: string
  image3DUrl?: string | null
  image2DUrl?: string | null
}

/** 轴承详情（对齐 BFF BearingDetail） */
export interface BearingDetail {
  id: string
  partNumber: string
  oldNumber?: string | null
  englishName?: string | null
  bearingType: string
  innerDiameter: number
  outerDiameter: number
  width: number
  weight?: number | null
  brandName: string
  brandCountry?: string | null
  image3DUrl?: string | null
  image2DUrl?: string | null
  viewCount: number
  favoriteCount: number
}

/** 轴承在售商家项（对齐 BFF BearingMerchantItem） */
export interface BearingMerchant {
  merchantId: string
  merchantName: string
  price?: string | null
  isOnSale: boolean
}

/** 轴承替代品项（对齐 BFF InterchangeItem） */
export interface Interchange {
  id: string
  partNumber: string
  brandName: string
  bearingType: string
  confidence: number
}

/** 分页结果（BFF PagedResult 透传） */
export interface Paged<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** 搜索轴承（可按 keyword / brandName / bearingType 过滤） */
export function searchBearings(params: { keyword?: string; brandName?: string; bearingType?: string; page?: number; pageSize?: number }) {
  const qs = buildQuery({
    keyword: params.keyword,
    brandName: params.brandName,
    bearingType: params.bearingType,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20
  })
  return request<Paged<Bearing>>(`${API.BEARINGS_SEARCH}?${qs}`, { auth: false })
}

/** 轴承详情 */
export function getBearingDetail(id: string) {
  return request<BearingDetail>(API.BEARING_DETAIL(id), { auth: false })
}

/** 轴承在售商家 */
export function getBearingMerchants(id: string) {
  return request<Paged<BearingMerchant>>(`${API.BEARING_MERCHANTS(id)}?page=1&pageSize=20`, { auth: false })
}

/** 轴承替代品 */
export function getBearingInterchanges(id: string) {
  return request<Interchange[]>(API.BEARING_INTERCHANGES(id), { auth: false })
}
