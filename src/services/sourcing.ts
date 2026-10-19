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
  /** v2.12.0 等级玩法铭牌曝光：经办人段位（号+名，发布人比价信任信号） */
  responderLevel?: number
  responderLevelName?: string | null
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
  // 改动说明（v2.18.0 电话单向）：删除 publisherContact——商家任何情况下都拿不到需求方号码，
  // 需求方仅通过站内会话与商家沟通
  /** v2.18.0 商户名义发布：发布方身份 */
  publisherMerchantId?: string | null
  publisherMerchantName?: string | null
  publisherType?: 'merchant' | 'individual' | null
  /** v1.8.0 公开招标/邀标：是否邀标单（前端出"邀标"徽章） */
  isPrivate?: boolean
  /** 邀标收件人家数（前端出"邀标(N家)"文案） */
  invitedCount?: number
  /** v2.18.0 联系方式解锁时刻（被选商户视角提示"买家已获取你的联系方式"） */
  contactUnlockedAt?: string | null
  /** v2.18.0 被选定的应答 ID（发布人回填成交回执的落点） */
  selectedResponseId?: string | null
  /** v2.18.0 当前用户是否可提交成交回执（仅发布人 + 已选定） */
  canFeedback?: boolean
  /** 当前用户已提交的成交回执（回显，可覆盖更新） */
  myFeedback?: SourcingMyFeedback | null
}

/** 成交回执（v2.18.0 撮合成交链） */
export interface SourcingMyFeedback {
  outcome: number
  reason?: string | null
  at?: string | null
  /** 是否已计入商家卡级（自关联/配对重复/资格不足/异常检测未过则为 false） */
  counted: boolean
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
  /** v1.8.0 公开招标/邀标：是否邀标单（徽章 + "转为公开招标"按钮态） */
  isPrivate?: boolean
  /** 邀标收件人家数 */
  invitedCount?: number
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

/** 需求状态筛选 chips（唯一来源，v2.13.2 收敛：原"我的寻货"与商户寻货页各写一份）。
 *  key 为字符串以贴合筛选态传参口径；顺序=全部/进行中/已选定/已取消/已过期/已下架 */
export const DEMAND_STATUS_CHIPS = [
  { key: 'all', label: '全部' },
  { key: String(DEMAND_STATUS.published), label: demandStatusText(DEMAND_STATUS.published) },
  { key: String(DEMAND_STATUS.closed), label: demandStatusText(DEMAND_STATUS.closed) },
  { key: String(DEMAND_STATUS.cancelled), label: demandStatusText(DEMAND_STATUS.cancelled) },
  { key: String(DEMAND_STATUS.expired), label: demandStatusText(DEMAND_STATUS.expired) },
  { key: String(DEMAND_STATUS.takenDown), label: demandStatusText(DEMAND_STATUS.takenDown) },
]

/** 应答状态筛选 chips（唯一来源，v2.13.2 收敛：全部/待处理/已选定/未选中） */
export const RESPONSE_STATUS_CHIPS = [
  { key: 'all', label: '全部' },
  { key: String(RESPONSE_STATUS.pending), label: responseStatusText(RESPONSE_STATUS.pending) },
  { key: String(RESPONSE_STATUS.adopted), label: responseStatusText(RESPONSE_STATUS.adopted) },
  { key: String(RESPONSE_STATUS.notSelected), label: responseStatusText(RESPONSE_STATUS.notSelected) },
]

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

/** 带响应体的写操作结果（v1.7.0）：发布等需回读结果字段的写操作用 */
export type SourcingOpDataResult<T> = SourcingOpResult & { data?: T }

/** 写操作统一包装（带响应体）：成功返回 data，失败捕获 ApiError 透传 message */
async function opWrapData<T>(fn: () => Promise<T>): Promise<SourcingOpDataResult<T>> {
  try {
    const data = await fn()
    return { success: true, data }
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
  /** v1.8.0 公开招标/邀标：0=公开招标（默认，进大厅 + 通知匹配商家）/ 1=邀标（不进大厅，只推收件人） */
  visibility?: number
  /** v1.8.0 邀标收件人勾选（空=全部匹配的认证在售商家；仅给本字段时表示"邀全部"；公开招标携带将被服务端 400 拒绝） */
  invitedMerchantIds?: string[] | null
}

/** 发布寻货结果（v1.8.1 随口径更名）：id=寻货单 ID；
 *  recipientMerchantCount=本次收件人集合大小（公开招标=在售匹配家数、邀标=勾选∩匹配家数、无匹配=0）。
 *  改动说明：原名 notifiedMerchantCount 暗示"实际收到推送的家数"，实际投递还取决于收件商户是否有在职管理员，名实不符故更名 */
export interface PublishDemandResult {
  id: string
  recipientMerchantCount?: number
}

/** 发布寻货（免费额度内直接成功；超限返回 NEED_POINTS 协议文案；成功回读通知家数供反馈文案用）。
 *  改动说明（v1.7.40 发布幂等）：可传 idempotencyKey 走 Idempotency-Key 请求头——
 *  同一 key 的重复提交（网络重试/连续点击/NEED_POINTS 二次确认）由服务端去重，不重复建单、不重复扣分 */
export function publishDemand(body: PublishDemandBody, idempotencyKey?: string) {
  const header = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  return opWrapData(() => request<PublishDemandResult>(API.SOURCING_DEMANDS, { method: 'POST', data: body, header }))
}

/** 生成发布幂等键（v1.7.40）：时间戳 + 两段随机，页面内稳定复用、发布成功后轮换，无需依赖 uuid 库 */
export function genPublishIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 转为公开招标（v1.8.0）：邀标单进行中时由发布人放开为公开（进大厅），免去取消重建 */
export function publishDemandAsPublic(demandId: string) {
  return opWrap(() => request(API.SOURCING_PUBLISH_PUBLIC(demandId), { method: 'POST' }))
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

/** 选定应答（发布人；v2.18.0 单向：仅发布人获得商户联系电话，商家看不到需求方号码） */
export function selectResponse(demandId: string, responseId: string) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/select`, { method: 'POST', data: { responseId } }))
}

/** 成交回执结果枚举（v2.18.0 撮合成交链；与 API SourcingDealOutcome 对齐） */
export const DEAL_OUTCOME = {
  confirmed: 0,
  noStock: 1,
  priceRaise: 2,
  delayed: 3,
  other: 4,
} as const

/** 成交回执结果中文（一键三选的主标签/负反馈原因） */
export function dealOutcomeText(outcome: number): string {
  switch (outcome) {
    case DEAL_OUTCOME.confirmed: return '谈成了'
    case DEAL_OUTCOME.noStock: return '对方没货'
    case DEAL_OUTCOME.priceRaise: return '临时加价'
    case DEAL_OUTCOME.delayed: return '拖延交期'
    case DEAL_OUTCOME.other: return '其他情况'
    default: return ''
  }
}

/** 负反馈原因三选（谈成不计原因） */
export const DEAL_NEGATIVE_OUTCOMES = [DEAL_OUTCOME.noStock, DEAL_OUTCOME.priceRaise, DEAL_OUTCOME.delayed, DEAL_OUTCOME.other]

/** 成交回执提交结果：counted=是否计入商家卡级，message=未计入原因 */
export interface DealFeedbackResult {
  counted: boolean
  message?: string | null
}

/** 提交/更新成交回执（v2.18.0：需求方对被选定合作一键回填洽谈结果，影响商家卡级；重复提交=覆盖更新） */
export function submitDealFeedback(responseId: string, outcome: number, reason?: string | null) {
  return opWrapData(() => request<DealFeedbackResult>(API.SOURCING_RESPONSE_FEEDBACK(responseId), {
    method: 'POST',
    data: { outcome, reason: reason ?? null },
  }))
}

/** 取消寻货（发布人） */
export function cancelDemand(demandId: string) {
  return opWrap(() => request(`${API.SOURCING_DEMANDS}/${demandId}/cancel`, { method: 'POST' }))
}

/** 商户名义发布的寻货项（v2.12.0 商户工作台"寻货管理-我发布的"，含经办人） */
export interface SourcingMerchantDemand {
  id: string
  partNumber: string
  brand?: string | null
  quantity?: string | null
  status: number
  responseCount: number
  createdAt: string
  expiryAt: string
  isPinned?: boolean
  pinnedUntil?: string | null
  /** 经办人昵称（管理操作仅经办人本人，其他成员只读） */
  publisherName?: string | null
  /** 当前用户是否经办人 */
  isMine?: boolean
  /** v1.8.0 公开招标/邀标：是否邀标单 */
  isPrivate?: boolean
  /** 邀标收件人家数 */
  invitedCount?: number
}

/** 商户名义发布的寻货列表（v2.12.0 商户工作台"寻货管理-我发布的"） */
export function getMerchantSourcingDemands() {
  return request<SourcingMerchantDemand[]>(API.SOURCING_MERCHANT_DEMANDS)
}

/** 批量删除寻货需求（v2.12.0 列表删除：软删终态单，左滑单删=ids 传一个；进行中拒删计 skipped） */
export async function batchDeleteDemands(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const r = await request<{ success: boolean; deleted: number; skipped: number }>(API.SOURCING_BATCH_DELETE, { method: "POST", data: { ids } })
  return { deleted: (r as any)?.deleted ?? 0, skipped: (r as any)?.skipped ?? 0 }
}
/** 我发布的寻货（仅个人名义单——商户名义归商户工作台，v2.12.0 双体系拆分） */
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

/** 为你匹配的寻货项（v1.6.0 商户侧聚合面；对齐 BFF /mobile/sourcing/matched） */
export interface MatchedDemand {
  id: string
  partNumber: string
  brand?: string | null
  quantity?: string | null
  region?: string | null
  status: number
  responseCount: number
  createdAt: string
  expiryAt: string
  /** v1.8.0：是否邀标给我的单（前端出"邀标"徽章） */
  isPrivate: boolean
}

/** 拉取为你匹配的寻货（v1.6.0 商户工作台聚合 tab；失败返回空数组降级空态） */
export async function getMatchedDemands(): Promise<MatchedDemand[]> {
  try {
    const r = await request<MatchedDemand[]>(API.SOURCING_MATCHED)
    return r || []
  } catch {
    return []
  }
}

// ============ T1 撮合会话（v2.18.0） ============

/** 会话列表项（对齐 BFF /mobile/sourcing/conversations items） */
export interface SourcingConversation {
  conversationId: string
  demandId: string
  merchantId: string
  /** 当前用户在本会话中的身份（publisher=需求方 / merchant=商家方） */
  role: 'publisher' | 'merchant'
  /** 对方名称（需求方看商户名；商家看"需求方"） */
  counterpartyName?: string | null
  partNumber?: string | null
  demandStatus?: number | null
  /** 单据已结束（会话只读） */
  demandReadOnly: boolean
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCount: number
}

/** 会话消息项 */
export interface SourcingMessage {
  id: string
  /** 发送方 0=需求方 / 1=商家方 */
  senderSide: number
  /** 是否当前用户所发（右侧气泡） */
  mine: boolean
  content: string
  createdAt: string
}

/** 会话消息响应 */
export interface SourcingMessages {
  conversationId?: string | null
  demandId: string
  merchantId: string
  role: 'publisher' | 'merchant'
  /** 单据结束：可读不可发 */
  readOnly: boolean
  hasMore: boolean
  messages: SourcingMessage[]
}

/** 拉取会话列表（失败返回空数组降级空态） */
export async function getConversations(page = 1, pageSize = 20): Promise<{ items: SourcingConversation[]; total: number }> {
  try {
    const r = await request<{ items: SourcingConversation[]; total: number }>(
      `${API.SOURCING_CONVERSATIONS}?page=${page}&pageSize=${pageSize}`)
    return r || { items: [], total: 0 }
  } catch {
    return { items: [], total: 0 }
  }
}

/** 会话总未读数（失败返回 0，角标降级不显示） */
export async function getConversationUnreadCount(): Promise<number> {
  try {
    const r = await request<{ unreadCount: number }>(API.SOURCING_CONVERSATIONS_UNREAD)
    return r?.unreadCount ?? 0
  } catch {
    return 0
  }
}

/** 拉取会话消息（failure 抛出：聊天页需区分"会话不存在"与"网络失败"） */
export function getConversationMessages(demandId: string, merchantId: string, before?: string, limit = 30) {
  const qs = `?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`
  return request<SourcingMessages>(`${API.SOURCING_CONVERSATION_MESSAGES(demandId, merchantId)}${qs}`)
}

/** 发送会话消息（会话懒创建；单据结束后服务端拒发） */
export function sendConversationMessage(demandId: string, merchantId: string, content: string) {
  return opWrap(() => request(API.SOURCING_CONVERSATION_MESSAGES(demandId, merchantId), { method: 'POST', data: { content } }))
}

/** 标记会话已读 */
export function markConversationRead(demandId: string, merchantId: string) {
  return opWrap(() => request(API.SOURCING_CONVERSATION_READ(demandId, merchantId), { method: 'POST' }))
}
