// 寻货服务（v1.7.19）：feed/详情/发布/应答/选定/取消/我的列表
// 后端 BFF /mobile/sourcing/*；浏览匿名可访问，写操作带 token
// 额度协议：超限未确认时 message 返回 "NEED_POINTS:20"，前端解析后弹积分确认框再重提交
// 写操作统一 catch ApiError 转 {success,message}（request 失败抛 ApiError，message 即上游文案）
import { request, ApiError } from './request'
import { API } from './config'
import type { HomeRef } from './home'

/** feed 单项 */
export interface SourcingFeedItem {
  id: string
  partNumber: string
  brand?: string | null
  quantity?: string | null
  region?: string | null
  status: number
  responseCount: number
  createdAt: string
  expiryAt: string
  isMine: boolean
  /** v2.10.0 寻货置顶：置顶期内（大厅角标+排序依据） */
  isPinned?: boolean
  /** 置顶到期时刻（ISO UTC） */
  pinnedUntil?: string | null
  /** v2.12.0 商户名义发布：发布方身份（徽章展示与商户主页跳转） */
  publisherMerchantId?: string | null
  publisherMerchantName?: string | null
  publisherType?: 'merchant' | 'individual' | null
}

/** 应答型号行（v1.5.0 多行标书：每条应答含多行型号，可引用在售商品） */
export interface SourcingResponseItem {
  id: string
  partNumber: string
  /** 引用的在售商品 ID（MerchantBearing，可空=自由文本型号行） */
  bearingId?: string | null
  price?: number | null
  stock?: string | null
  leadTime?: string | null
}

/** 应答明细（仅发布人可见全量；v1.5.0 多行标书 + 实力摘要） */
export interface SourcingResponseDetail {
  id: string
  merchantId: string
  merchantName?: string | null
  isVerified: boolean
  /** v1.5.0 证据力 P1：公司名/在售数/集体任务达成（发布人选定的结构化依据） */
  companyName?: string | null
  onSaleCount?: number
  completedTaskCount?: number
  /** v1.5.0 多行标书：应答型号行 */
  items: SourcingResponseItem[]
  remark: string
  status: number
  createdAt: string
}

/** 我（当前商户）的应答 */
export interface SourcingMyResponse {
  id: string
  items: SourcingResponseItem[]
  remark: string
  status: number
  createdAt: string
}

/** 寻货详情 */
export interface SourcingDetail {
  id: string
  partNumber: string
  /** v1.7.21 应答预填精确匹配键（可空=自由文本型号） */
  bearingId?: string | null
  brand?: string | null
  quantity?: string | null
  expectedDelivery?: string | null
  region?: string | null
  description?: string | null
  status: number
  responseCount: number
  createdAt: string
  expiryAt: string
  closedAt?: string | null
  isPublisher: boolean
  responses?: SourcingResponseDetail[] | null
  myResponse?: SourcingMyResponse | null
  /** 选定后解锁：被选商户联系电话（发布人视角） */
  selectedMerchantContact?: string | null
  /** 选定后解锁：发布方联系电话（被选商户视角；v2.12.0 商户单=商户公开电话，个人单=注册手机） */
  publisherContact?: string | null
  /** v2.12.0 商户名义发布：发布方身份 */
  publisherMerchantId?: string | null
  publisherMerchantName?: string | null
  publisherType?: 'merchant' | 'individual' | null
}

/** 我发布的寻货项 */
export interface SourcingMyDemand {
  id: string
  partNumber: string
  brand?: string | null
  quantity?: string | null
  status: number
  responseCount: number
  createdAt: string
  expiryAt: string
  /** v2.10.0 寻货置顶：置顶期内（"我的"页置顶按钮态） */
  isPinned?: boolean
  /** 置顶到期时刻（ISO UTC） */
  pinnedUntil?: string | null
  /** v2.12.0 商户名义发布：发布身份徽章 */
  publisherMerchantId?: string | null
  publisherMerchantName?: string | null
  publisherType?: 'merchant' | 'individual' | null
}

/** 商户应答记录项 */
export interface SourcingMerchantResponse {
  id: string
  demandId: string
  partNumber?: string | null
  demandStatus?: number | null
  items: SourcingResponseItem[]
  remark: string
  status: number
  createdAt: string
}

/** 写操作统一返回（BFF 透传上游 message，含 NEED_POINTS 协议文案） */
export interface SourcingOpResult {
  success: boolean
  message?: string
}

/** 解析"需积分确认"协议：命中返回分值，否则 null */
export function parseNeedPoints(message?: string): number | null {
  if (!message) return null
  const m = message.match(/NEED_POINTS:(\d+)/)
  return m ? Number(m[1]) : null
}

/** 寻货状态常量（与 API SourcingDemand.Status* 对齐） */
export const DEMAND_STATUS = {
  published: 1,
  closed: 2,
  expired: 3,
  cancelled: 4,
  takenDown: 5,
} as const

/** 应答状态常量（与 API SourcingResponse.Status* 对齐） */
export const RESPONSE_STATUS = {
  pending: 1,
  adopted: 2,
  notSelected: 3,
} as const

/** 需求状态中文 */
export function demandStatusText(status: number): string {
  switch (status) {
    case DEMAND_STATUS.published: return '进行中'
    case DEMAND_STATUS.closed: return '已选定'
    case DEMAND_STATUS.expired: return '已过期'
    case DEMAND_STATUS.cancelled: return '已取消'
    case DEMAND_STATUS.takenDown: return '已下架'
    default: return ''
  }
}

/** 应答状态中文 */
export function responseStatusText(status: number): string {
  switch (status) {
    case RESPONSE_STATUS.pending: return '待处理'
    case RESPONSE_STATUS.adopted: return '已选定'
    case RESPONSE_STATUS.notSelected: return '未选中'
    default: return ''
  }
}

/** feed 分页选项（v1.7.29 大厅筛选）：brand/region 包含匹配、sort 发布时间升降序 */
export interface SourcingFeedOptions {
  brand?: string
  region?: string
  sort?: 'asc' | 'desc'
  pageSize?: number
}

/** feed 分页（匿名可访问；keyword 型号 + brand/region 筛选 + sort 升降序 + 分页；有 token 即带出 isMine 角标） */
export function getSourcingFeed(keyword: string, onlyOpen: boolean, page: number, opts: SourcingFeedOptions = {}) {
  const parts = [
    `keyword=${encodeURIComponent(keyword)}`,
    `onlyOpen=${onlyOpen}`,
    `sort=${opts.sort ?? 'desc'}`,
    `page=${page}`,
    `pageSize=${opts.pageSize ?? 20}`,
  ]
  if (opts.brand) parts.push(`brand=${encodeURIComponent(opts.brand)}`)
  if (opts.region) parts.push(`region=${encodeURIComponent(opts.region)}`)
  // 改动说明（v1.7.29）：auth 用默认 true——有 token 即带（isMine 角标生效），无 token 服务端浏览公开不报错；
  // 原 mineOnly 专属 auth 参数随 mineOnly 一并删除（发现页收敛纯大厅）
  return request<{ items: SourcingFeedItem[]; total: number }>(`${API.SOURCING_DEMANDS}?${parts.join('&')}`)
}

/** 寻货详情（匿名可访问；带 token 时返回我的应答/解锁联系方式） */
export function getSourcingDetail(id: string) {
  return request<SourcingDetail>(`${API.SOURCING_DEMANDS}/${id}`)
}

/** 额度条单项（与 API /quota 口径一致：免费额度/今日已用/硬上限/积分单价） */
export interface QuotaItem {
  freeLimit: number
  todayUsed: number
  hardLimit: number
  pointsPrice: number
}

/** 寻货额度聚合响应（v1.7.21 额度可见化：额度条与按钮三态数据源） */
export interface SourcingQuota {
  publish: QuotaItem
  respond: QuotaItem
  balance: number
}

/** 拉取额度聚合（需登录；失败由调用方静默降级——额度条隐藏，撞墙协议仍兜底） */
export function getSourcingQuota(): Promise<SourcingQuota> {
  return request<SourcingQuota>(API.SOURCING_QUOTA)
}

/** 我的在售同款（v1.7.21 应答预填）：当前商户对该型号的在售/补货中条目 */
export interface MyOffering {
  found: boolean
  isOnSale?: boolean
  isRestocking?: boolean
  price?: number | null
  priceDescription?: string | null
  stock?: string | null
  minOrder?: string | null
  restockEta?: string | null
  remarks?: string | null
}

/** 拉取我的在售同款（失败返回 null，应答表单退化为纯手填） */
export async function getMyOffering(bearingId: string | null, partNumber: string): Promise<MyOffering | null> {
  const qs = `?bearingId=${encodeURIComponent(bearingId || '')}&partNumber=${encodeURIComponent(partNumber)}`
  try {
    return await request<MyOffering>(`${API.SOURCING_MY_OFFERING}${qs}`)
  } catch {
    return null
  }
}

/** 需求信号行（v1.7.21 反向导购）：商户在售型号中被寻货且未应答的聚合 */
export interface OpportunityItem {
  partNumber: string
  demandCount: number
  latestAt: string
}

/** 拉取需求信号（失败返回空数组，横幅隐藏） */
export async function getOpportunities(): Promise<OpportunityItem[]> {
  try {
    const r = await request<OpportunityItem[]>(API.SOURCING_OPPORTUNITIES)
    return r || []
  } catch {
    return []
  }
}
/** 写操作统一包装：成功 {success:true}，失败捕获 ApiError 透传 message（NEED_POINTS 协议靠它） */
async function opWrap(fn: () => Promise<unknown>): Promise<SourcingOpResult> {
  try {
    await fn()
    return { success: true }
  } catch (e) {
    if (e instanceof ApiError) return { success: false, message: e.message }
    return { success: false, message: '网络异常，请稍后重试' }
  }
}

/** 发布寻货请求体 */
export interface PublishDemandBody {
  partNumber: string
  bearingId?: string | null
  brand?: string | null
  quantity?: string | null
  expectedDelivery?: string | null
  region?: string | null
  description?: string | null
  usePoints: boolean
  /** v2.12.0 商户名义发布：以该商户名义发布（须为在职成员）；缺省/空=个人名义 */
  merchantId?: string | null
}

/** 发布寻货（免费额度内直接成功；超限返回 NEED_POINTS 协议文案） */
export function publishDemand(body: PublishDemandBody) {
  return opWrap(() => request(API.SOURCING_DEMANDS, { method: 'POST', data: body }))
}

/** 应答型号行输入（v1.5.0 多行标书） */
export interface RespondItemInput {
  partNumber: string
  /** 引用的在售商品 ID（可空=自由文本型号行） */
  bearingId?: string | null
  price?: number | null
  stock?: string | null
  leadTime?: string | null
}

/** 应答寻货请求体 */
export interface RespondDemandBody {
  items: RespondItemInput[]
  remark: string
  usePoints: boolean
}

/** 应答寻货（当前商户；重复应答=更新） */
export function respondDemand(demandId: string, body: RespondDemandBody) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/respond`, { method: 'POST', data: body }))
}

/** 撤销应答（v1.5.0 取消应答：仅待处理可撤；撤后需求回到未应答，当日额度不退还） */
export function cancelMyResponse(demandId: string) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/respond`, { method: 'DELETE' }))
}

/** 选定应答（发布人；双方解锁联系方式） */
export function selectResponse(demandId: string, responseId: string) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/select`, { method: 'POST', data: { responseId } }))
}

/** 取消寻货（发布人） */
export function cancelDemand(demandId: string) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/cancel`, { method: 'POST' }))
}

/** 我发布的寻货 */
export function getMySourcingDemands() {
  return request<SourcingMyDemand[]>(API.SOURCING_MY_DEMANDS)
}

/** 当前商户的应答记录 */
export function getMySourcingResponses() {
  return request<SourcingMerchantResponse[]>(API.SOURCING_MY_RESPONSES)
}

/** 拉取品牌字典（v1.7.29 发现页筛选面板；失败返回空数组面板降级为空态） */
export async function getBrands(): Promise<HomeRef[]> {
  try {
    const r = await request<HomeRef[]>(API.BRANDS, { auth: false })
    return r || []
  } catch {
    return []
  }
}
