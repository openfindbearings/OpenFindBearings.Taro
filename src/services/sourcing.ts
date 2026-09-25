// 寻货服务（v1.7.19）：feed/详情/发布/应答/选定/取消/我的列表
// 后端 BFF /mobile/sourcing/*；浏览匿名可访问，写操作带 token
// 额度协议：超限未确认时 message 返回 "NEED_POINTS:20"，前端解析后弹积分确认框再重提交
// 写操作统一 catch ApiError 转 {success,message}（request 失败抛 ApiError，message 即上游文案）
import { request, ApiError } from './request'
import { API } from './config'

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
}

/** 应答明细（仅发布人可见全量） */
export interface SourcingResponseDetail {
  id: string
  merchantId: string
  merchantName?: string | null
  isVerified: boolean
  price?: number | null
  stock?: string | null
  leadTime?: string | null
  remark: string
  status: number
  createdAt: string
}

/** 我（当前商户）的应答 */
export interface SourcingMyResponse {
  id: string
  price?: number | null
  stock?: string | null
  leadTime?: string | null
  remark: string
  status: number
  createdAt: string
}

/** 寻货详情 */
export interface SourcingDetail {
  id: string
  partNumber: string
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
  /** 选定后解锁：发布人手机号（被选商户视角） */
  publisherContact?: string | null
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
}

/** 商户应答记录项 */
export interface SourcingMerchantResponse {
  id: string
  demandId: string
  partNumber?: string | null
  demandStatus?: number | null
  price?: number | null
  stock?: string | null
  leadTime?: string | null
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

/** feed 分页（匿名可访问；keyword 型号搜索、onlyOpen 进行中过滤） */
export function getSourcingFeed(keyword: string, onlyOpen: boolean, page: number, pageSize = 20) {
  const qs = `?keyword=${encodeURIComponent(keyword)}&onlyOpen=${onlyOpen}&page=${page}&pageSize=${pageSize}`
  return request<{ items: SourcingFeedItem[]; total: number }>(`${API.SOURCING_DEMANDS}${qs}`, { auth: false })
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
}

/** 发布寻货（免费额度内直接成功；超限返回 NEED_POINTS 协议文案） */
export function publishDemand(body: PublishDemandBody) {
  return opWrap(() => request(API.SOURCING_DEMANDS, { method: 'POST', data: body }))
}

/** 应答寻货请求体 */
export interface RespondDemandBody {
  price?: number | null
  stock?: string | null
  leadTime?: string | null
  remark: string
  usePoints: boolean
}

/** 应答寻货（当前商户；重复应答=更新） */
export function respondDemand(demandId: string, body: RespondDemandBody) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/respond`, { method: 'POST', data: body }))
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
