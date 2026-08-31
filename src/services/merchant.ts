import { requestPublic, request, type PagedData } from './request'

/** 商家信息 */
export interface Merchant {
  id: string
  name: string
  contact?: string
  phone?: string
  description?: string
  isVerified: boolean
  status: string
  bearingCount?: number
}

/** 商家搜索参数 */
export interface MerchantSearchParams {
  keyword?: string
  verifiedOnly?: boolean
  page?: number
  pageSize?: number
}

/** 搜索商家（BFF /api/mobile/merchants/search） */
export async function searchMerchants(params: MerchantSearchParams): Promise<PagedData<Merchant>> {
  return requestPublic<PagedData<Merchant>>('/api/mobile/merchants/search', params as Record<string, unknown>)
}

/** 商家详情（BFF /api/mobile/merchants/{id}） */
export async function getMerchantDetail(id: string): Promise<Merchant> {
  return requestPublic<Merchant>(`/api/mobile/merchants/${id}`)
}

/** 商家在售商品（BFF /api/mobile/merchants/{id}/bearings） */
export interface MerchantBearing {
  bearingId: string
  bearingPartNumber: string
  oldNumber?: string
  bearingTypeName?: string
  brandName?: string
  innerDiameter?: number
  outerDiameter?: number
  width?: number
  price?: string
  isOnSale: boolean
}

export async function getMerchantBearings(merchantId: string, page = 1, pageSize = 20): Promise<PagedData<MerchantBearing>> {
  return requestPublic<PagedData<MerchantBearing>>(
    `/api/mobile/merchants/${merchantId}/bearings`,
    { page, pageSize } as Record<string, unknown>
  )
}

/** 推荐商家（从首页聚合数据获取） */
export async function getRecommendedMerchants(page = 1, pageSize = 6): Promise<PagedData<Merchant>> {
  const res = await requestPublic<{ merchants: Merchant[] }>('/api/mobile/home')
  const all = res?.merchants ?? []
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    totalCount: all.length,
    page,
    pageSize,
    totalPages: Math.ceil(all.length / pageSize),
  }
}
