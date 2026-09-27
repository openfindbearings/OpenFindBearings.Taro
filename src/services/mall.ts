// 商城服务（v2.3.0 商城虚拟权益）：目录 / 积分兑换 / 我的订单，走 BFF /mobile/mall/*
// 一期实装置顶卡：兑换须带 targetRef=MerchantBearingId（商品管理页"置顶"入口）
import { request } from './request'
import { API } from './config'
import type { Paged } from './bearing'

/** 商城商品类别（与 API MallItemCategory 对齐） */
export const MALL_CATEGORY = {
  /** 置顶卡：把在售商品在型号商家列表置顶 N 小时 */
  PIN_CARD: 1,
  /** 寻货次数包（预留未实装） */
  SOURCING_PACK: 2,
  /** 实物礼品（预留未实装） */
  GIFT: 3
} as const

/** 订单状态（与 API MallOrderStatus 对齐） */
export const MALL_ORDER_STATUS = {
  PENDING: 0,
  FULFILLED: 1,
  FAILED: 2,
  REFUNDED: 3
} as const

/** 商城目录条目（价格已按闪购窗口结算） */
export interface MallItem {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: number
  /** 生效价（闪购窗口内=闪购价） */
  price: number
  /** 闪购期内的常规价（划线价展示） */
  originalPrice?: number | null
  flashing: boolean
  flashEnd?: string | null
  durationHours?: number | null
  /** -1=不限量 */
  stock: number
  soldCount: number
  soldOut: boolean
}

/** 商城目录（含余额，供三态按钮：兑换 / 积分不足去赚） */
export interface MallCatalog {
  items: MallItem[]
  balance: number
}

/** 兑换结果 */
export interface MallRedeemResult {
  orderId?: string | null
  pointsSpent: number
  pinnedUntil?: string | null
}

/** 兑换订单条目 */
export interface MallOrder {
  id: string
  itemKey: string
  itemName: string
  pointsSpent: number
  status: number
  remark?: string | null
  createdAt: string
  fulfilledAt?: string | null
}

/** 拉取商城目录（含当前余额） */
export function getMallItems() {
  return request<MallCatalog>(API.MALL_ITEMS)
}

/**
 * 积分兑换。requestId 为客户端幂等键（同一次确认重复提交只扣一次），
 * 调用方生成一次并复用；失败时 request 层抛出后端 message（积分不足/越权/非在售）
 */
export function redeemMallItem(itemId: string, targetRef?: string, requestId?: string) {
  return request<MallRedeemResult>(API.MALL_REDEEM, {
    method: 'POST',
    data: { itemId, targetRef: targetRef || null, requestId: requestId || null }
  })
}

/** 我的兑换订单（分页） */
export function getMallOrders(page = 1, pageSize = 20) {
  return request<Paged<MallOrder>>(`${API.MALL_ORDERS}?page=${page}&pageSize=${pageSize}`)
}
