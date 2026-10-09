// 商家金库与挂礼服务（v2.4.0 商家经济）：金库余额/流水 + 挂礼管理 + 礼品订单发货
// 全部走 BFF /mobile/merchant/*，依赖 X-Merchant-Id 当前商户上下文（merchantContext 自动带头）
import { request } from './request'
import { API, getBaseUrl } from './config'
import { getToken } from './request'
import { uploadFileNormalized } from './upload'
import type { Paged } from './bearing'

/** 礼品审核态（与 API MallItem.AuditState 对齐） */
export const GIFT_AUDIT = {
  NONE: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3
} as const

/** 发货状态（与 API MallOrder.ShipStatus 对齐） */
export const SHIP_STATUS = {
  NONE: 0,
  PENDING: 1,
  SHIPPED: 2,
  RECEIVED: 3,
  REFUNDED: 4
} as const

/** 金库账户 */
export interface TreasuryAccount {
  balance: number
  totalEarned: number
  totalSpent: number
  /** v2.5.0 商家等级（1入驻/3认证/2活跃/4金牌，非单调） */
  grade?: number
  gradeDisplay?: string | null
}

/** 金库流水条目 */
export interface TreasuryTx {
  direction: number
  scene: string
  amount: number
  balanceAfter: number
  remark?: string | null
  createdAt: string
}

/** 流水场景中文（金库明细展示） */
export function treasurySceneText(scene: string): string {
  switch (scene) {
    case 'member_trickle': return '成员赚分上供'
    case 'gift_settlement': return '礼品订单结算'
    case 'treasury_spend': return '金库消费'
    case 'treasury_burn': return '关店清算'
    // v2.6.0 M3：商家集体任务达标入账
    case 'merchant_task_reward': return '集体任务奖励'
    // v2.12.0 等级玩法：商家升档礼（每店每档终身一次）
    case 'grade_up_bonus': return '商家升档礼'
    default: return scene
  }
}

/** 我的挂礼条目（含各审核态） */
export interface MyGift {
  id: string
  name: string
  description: string
  imageKey?: string | null
  pointPrice: number
  stock: number
  soldCount: number
  auditState: number
  auditRemark?: string | null
  enabled: boolean
  createdAt: string
}

/** 礼品订单（商家侧，含收货信息） */
export interface GiftOrder {
  id: string
  itemName: string
  pointsSpent: number
  shipStatus: number
  receiverName?: string | null
  receiverPhone?: string | null
  receiverAddress?: string | null
  shipTracking?: string | null
  shippedAt?: string | null
  receivedAt?: string | null
  createdAt: string
}

/** 金库余额 */
export function getTreasury() {
  return request<TreasuryAccount>(API.MERCHANT_TREASURY)
}

/** 金库流水分页 */
export function getTreasuryTransactions(page = 1, pageSize = 20) {
  return request<Paged<TreasuryTx>>(`${API.MERCHANT_TREASURY_TX}?page=${page}&pageSize=${pageSize}`)
}

/** 我的挂礼列表 */
export function getMyGifts() {
  return request<MyGift[]>(API.MERCHANT_GIFTS)
}

/** 申请挂礼（进待审，平台定档后自动上架） */
export function createGift(name: string, description: string, imageKey: string | null, stock: number) {
  return request<{ id: string }>(API.MERCHANT_GIFTS, {
    method: 'POST',
    data: { name, description, imageKey, stock }
  })
}

/** 下架礼品（存量订单不受影响） */
export function offShelfGift(id: string) {
  return request<unknown>(API.MERCHANT_GIFT_OFFSHELF(id), { method: 'POST', data: {} })
}

/** 礼品图上传（走 BFF multipart 代理，返回对象存储相对 URL） */
export async function uploadGiftImage(filePath: string): Promise<string> {
  const token = getToken()
  const res = await uploadFileNormalized({
    url: `${getBaseUrl()}${API.MERCHANT_GIFT_IMAGE}`,
    filePath,
    header: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeout: 60000
  })
  let url = ''
  try {
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    url = data?.url || ''
  } catch {
    url = ''
  }
  if (!url) throw new Error('上传失败')
  return url
}

/** 礼品订单列表（shipStatus: 1 待发货 / 2 已发货 / 不传=全部） */
export function getGiftOrders(shipStatus?: number, page = 1, pageSize = 20) {
  const q = shipStatus ? `&shipStatus=${shipStatus}` : ''
  return request<Paged<GiftOrder>>(`${API.MERCHANT_GIFT_ORDERS}?page=${page}&pageSize=${pageSize}${q}`)
}

/** 发货登记（物流单号必填） */
export function shipGiftOrder(id: string, tracking: string) {
  return request<unknown>(API.MERCHANT_GIFT_ORDER_SHIP(id), {
    method: 'POST',
    data: { tracking }
  })
}
