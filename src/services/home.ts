// 首页聚合服务：调用 BFF GET /mobile/home（public，无需登录）。
// 返回热门轴承 + 推荐商家 + 品牌 + 类型，供首页渲染。
import { request } from './request'
import { API } from './config'

/** 热门轴承项（对齐 BFF HomeEndpoints.BearingDto） */
export interface HotBearing {
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

/** 推荐商家项（对齐 BFF MerchantDto） */
export interface HomeMerchant {
  id: string
  name: string
  description?: string | null
  isVerified: boolean
}

/** 品牌 / 类型简项 */
export interface HomeRef {
  id: string
  name: string
}

/** 首页聚合响应 */
export interface HomeData {
  hotBearings: HotBearing[]
  merchants: HomeMerchant[]
  brands: HomeRef[]
  bearingTypes: HomeRef[]
}

/** 拉取首页聚合数据（auth:false，公开接口） */
export function getHome(): Promise<HomeData> {
  return request<HomeData>(API.HOME, { auth: false })
}
