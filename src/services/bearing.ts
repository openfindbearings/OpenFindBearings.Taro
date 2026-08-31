import { requestPublic, type PagedData } from './request'

/** 轴承信息 */
export interface Bearing {
  id: string
  partNumber: string
  oldNumber?: string
  englishName?: string
  bearingType?: string
  brandName?: string
  innerDiameter?: number
  outerDiameter?: number
  width?: number
  dynamicLoad?: number
  staticLoad?: number
  weight?: number
  image3dUrl?: string
  image2dUrl?: string
  merchantCount?: number
}

/** 轴承搜索参数 */
export interface BearingSearchParams {
  keyword?: string
  brandName?: string
  bearingType?: string
  page?: number
  pageSize?: number
}

/** 搜索轴承 */
export async function searchBearings(params: BearingSearchParams): Promise<PagedData<Bearing>> {
  return requestPublic<PagedData<Bearing>>('/mobile/bearings/search', params as Record<string, unknown>)
}

/** 轴承详情 */
export async function getBearingDetail(id: string): Promise<Bearing> {
  return requestPublic<Bearing>(`/mobile/bearings/${id}`)
}

/** 轴承在售商家 */
export interface BearingMerchant {
  merchantId: string
  merchantName: string
  price?: string
  isOnSale: boolean
}

export async function getBearingMerchants(bearingId: string, page = 1, pageSize = 20): Promise<PagedData<BearingMerchant>> {
  return requestPublic<PagedData<BearingMerchant>>(
    `/mobile/bearings/${bearingId}/merchants`,
    { page, pageSize, onlyOnSale: true } as Record<string, unknown>
  )
}

/** 热门轴承（从首页聚合接口获取） */
export async function getHotBearings(count = 10): Promise<Bearing[]> {
  const res = await requestPublic<{ hotBearings: Bearing[] }>('/mobile/home')
  return res?.hotBearings ?? []
}
