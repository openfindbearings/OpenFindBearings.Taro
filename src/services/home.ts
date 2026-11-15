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

/** 推荐商家项（对齐 BFF HomeEndpoints.MerchantDto） */
export interface HomeMerchant {
  id: string
  name: string
  companyName?: string | null
  isVerified: boolean
  productCount?: number | null
  logoUrl?: string | null
}

/** 品牌 / 类型简项 */
export interface HomeRef {
  id: string
  name: string
}

/**
 * 品牌简项（扩展字段）
 * 说明：BFF 首页与品牌接口直接下发 BrandDto 全字段（country/level/description 等），
 * 品牌 Tab 据此展示所属国家、档次与一句简介，无需额外请求
 */
export interface BrandRef extends HomeRef {
  /** 品牌代码（如 SKF） */
  code?: string
  /** 所属国家 */
  country?: string | null
  /** 品牌档次（枚举名，如 InternationalPremium） */
  level?: string
  /** 品牌简介/特点 */
  description?: string | null
  /** 在售型号数量 */
  bearingCount?: number
}

/** 首页聚合响应 */
export interface HomeData {
  hotBearings: HotBearing[]
  merchants: HomeMerchant[]
  brands: BrandRef[]
  bearingTypes: HomeRef[]
}

/** 拉取首页聚合数据（auth:false，公开接口） */
export function getHome(): Promise<HomeData> {
  return request<HomeData>(API.HOME, { auth: false })
}
