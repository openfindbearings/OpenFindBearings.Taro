// 轴承服务：搜索、详情、在售商家、替代品（均调 BFF public 端点，auth:false）
import { request } from './request'
import { API, buildQuery } from './config'
import { DEFAULT_PAGE_SIZE } from '../utils/paging'

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
  // 改动说明（v2.13.2 幻影字段修复）：englishName 上游不存在，移除；类型用 bearingType
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
  /** v1.6.0 数据可信联动：参数来源（Internet/OcrExtract/SeedData=仅供参考） */
  dataSource?: string | null
}

/** v1.6.0 数据可信联动：判断参数来源是否"仅供参考"（互联网采集/OCR/种子三源） */
export function isReferenceSource(dataSource?: string | null): boolean {
  return dataSource === 'Internet' || dataSource === 'OcrExtract' || dataSource === 'SeedData'
}

/** 轴承在售商家项（对齐 BFF BearingMerchantItem） */
export interface BearingMerchant {
  merchantId: string
  merchantName: string
  price?: string | null
  /** v2.15.0 状态统一：销售态 0=已下架/1=出售中/2=补货中 */
  saleState: number
  /** 补货预计到货时间（自由文本） */
  restockEta?: string | null
  /** 置顶中（v2.3.0 商城置顶卡：商家花积分买曝光，列表已按置顶优先排序） */
  isPinned?: boolean
  /** 置顶到期时间（UTC） */
  pinnedUntil?: string | null
  /** v1.6.0 数据可信联动：商家是否已认证（询价行动门只对认证商家开放） */
  isVerified?: boolean
}

/** 轴承替代品项（对齐 BFF InterchangeItem，v2.16.0 三级治理：含类型标签与责任提示字段） */
export interface Interchange {
  id: string
  /** 替代品（对方）轴承ID，供导航 */
  bearingId: string
  partNumber: string
  brandName?: string | null
  bearingType?: string | null
  innerDiameter: number
  outerDiameter: number
  width: number
  /** exact=标准等效替代 / conditional=条件替代 / functional=仅供参考 */
  interchangeType?: string | null
  typeLabel: string
  confidence: number
  remarks?: string | null
  isBidirectional: boolean
  isAutoRecommendable: boolean
}

/** 三级替代类型（唯一来源，v2.13.2 收敛：原 interchanges 页与详情页各写一份）。
 *  exact=标准等效替代 / conditional=条件替代（需评估）/ functional=仅供参考 */
export const INTERCHANGE_TYPES: { key: string; label: string }[] = [
  { key: 'exact', label: '标准等效替代' },
  { key: 'conditional', label: '条件替代（需评估）' },
  { key: 'functional', label: '仅供参考' },
]

/** 替代类型语义色（走主题 token：exact=正 / conditional=警 / 其余=弱），供各露出点统一取色 */
export function interchangeTone(type: string | null | undefined, t: { success: string; warning: string; textTertiary: string }): string {
  if (type === 'exact') return t.success
  if (type === 'conditional') return t.warning
  return t.textTertiary
}

/** 分页结果（BFF PagedResult 透传） */
export interface Paged<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** 轴承搜索参数：关键词 / 按品牌ID / 按类型ID / 排序 / 尺寸范围 */
export interface BearingSearchParams {
  keyword?: string
  brandId?: string
  bearingTypeId?: string
  sortBy?: 'partnumber' | 'innerdiameter' | 'outerdiameter' | 'width' | 'viewcount'
  sortOrder?: 'asc' | 'desc'
  minInnerDiameter?: number
  maxInnerDiameter?: number
  minOuterDiameter?: number
  maxOuterDiameter?: number
  minWidth?: number
  maxWidth?: number
  page?: number
  pageSize?: number
}

/** 搜索轴承（可按 keyword / brandId / bearingTypeId / 尺寸范围过滤，支持排序分页） */
export function searchBearings(params: BearingSearchParams) {
  const qs = buildQuery({
    keyword: params.keyword,
    brandId: params.brandId,
    bearingTypeId: params.bearingTypeId,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    minInnerDiameter: params.minInnerDiameter,
    maxInnerDiameter: params.maxInnerDiameter,
    minOuterDiameter: params.minOuterDiameter,
    maxOuterDiameter: params.maxOuterDiameter,
    minWidth: params.minWidth,
    maxWidth: params.maxWidth,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20
  })
  return request<Paged<Bearing>>(`${API.BEARINGS_SEARCH}?${qs}`, { auth: false })
}

/** 轴承详情 */
export function getBearingDetail(id: string) {
  return request<BearingDetail>(API.BEARING_DETAIL(id), { auth: false })
}

/** 轴承在售商家（分页；默认首页 20 条） */
export function getBearingMerchants(id: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return request<Paged<BearingMerchant>>(`${API.BEARING_MERCHANTS(id)}?page=${page}&pageSize=${pageSize}`, { auth: false })
}

/**
 * 轴承在售商家全量（v1.8.1 邀标候选清单）：逐页拉齐。
 * 改动说明：邀标勾选若只取第一页，用户"部分勾选"时会静默丢掉未展示的商家（与"勾选∩匹配"的精确邀标语义不符）；
 * 上限 10 页（500 家）兜底，防极端数据拖垮页面
 * @param id 轴承 ID
 */
export async function getAllBearingMerchants(id: string): Promise<BearingMerchant[]> {
  const pageSize = 50
  const all: BearingMerchant[] = []
  for (let page = 1; page <= 10; page++) {
    const r = await getBearingMerchants(id, page, pageSize)
    const items = r?.items ?? []
    all.push(...items)
    // 本页不足一页或已收齐总数即止（Paged 的总数字段是 totalCount，缺失时按"本页为空"收敛）
    if (items.length < pageSize || all.length >= (r?.totalCount ?? all.length)) break
  }
  return all
}

/** 轴承替代品 */
export function getBearingInterchanges(id: string) {
  return request<Interchange[]>(API.BEARING_INTERCHANGES(id), { auth: false })
}
