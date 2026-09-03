import { request } from './request'
import { API } from './config'

/** 轴承信息 */
export interface Bearing {
  id: string
  partNumber: string
  oldNumber?: string
  brandName?: string
  typeName?: string
  description?: string
  image3dUrl?: string
  image2dUrl?: string
  dynamicLoad?: number
  staticLoad?: number
  /** 在售商家数量 */
  merchantCount?: number
}

/** 搜索轴承 */
export async function searchBearings(keyword: string, page = 1, pageSize = 20) {
  return request<{ items: Bearing[]; totalCount: number }>(
    `${API.BEARINGS_SEARCH}?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
    { auth: false }
  )
}

/** 获取轴承详情 */
export async function getBearingDetail(id: string) {
  return request<Bearing>(API.BEARING_DETAIL(id), { auth: false })
}

/** 获取在售商家 */
export async function getBearingMerchants(bearingId: string) {
  return request<any[]>(API.BEARING_MERCHANTS(bearingId), { auth: false })
}
