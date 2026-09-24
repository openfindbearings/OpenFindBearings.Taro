// 积分服务（v1.7.17 积分底座）：账户概览 / 每日签到 / 流水分页，代理 BFF /mobile/points/*
import { request } from './request'
import { API } from './config'
import type { Paged } from './bearing'

/** 积分账户概览（对齐 BFF PointAccountResponse） */
export interface PointAccount {
  balance: number
  totalEarned: number
  totalSpent: number
  /** 今日是否已签到（签到按钮态） */
  todayCheckedIn: boolean
  /** 当前连续签到天数（阶梯展示用） */
  consecutiveDays: number
}

/** 签到结果（对齐 BFF CheckinResponse） */
export interface CheckinResult {
  amount: number
  consecutiveDays: number
  alreadyCheckedIn: boolean
}

/** 积分流水项（对齐 BFF PointTransactionItem） */
export interface PointTransaction {
  id: string
  /** 1=入账 2=出账 */
  direction: number
  /** daily_login / daily_checkin / register_bonus / correction_adopted / merchant_approved */
  grantType: string
  amount: number
  balanceAfter: number
  remark?: string | null
  createdAt: string
}

/** 动作类型 → 中文名（明细页展示；未知类型回退原串） */
export const GRANT_TYPE_LABELS: Record<string, string> = {
  daily_login: '每日登录',
  daily_checkin: '每日签到',
  register_bonus: '新用户注册奖励',
  correction_adopted: '纠错被采纳',
  merchant_approved: '商户入驻通过',
}

/** 拉取积分账户（失败返回零值兜底，不打扰页面） */
export async function getPointAccount(): Promise<PointAccount> {
  try {
    const r = await request<PointAccount>(API.POINTS_ACCOUNT)
    return r ?? { balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 }
  } catch {
    return { balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 }
  }
}

/** 每日签到 */
export function dailyCheckin() {
  return request<CheckinResult>(API.POINTS_CHECKIN, { method: 'POST' })
}

/** 积分流水分页 */
export function getPointTransactions(page = 1, pageSize = 20) {
  return request<Paged<PointTransaction>>(`${API.POINTS_TRANSACTIONS}?page=${page}&pageSize=${pageSize}`)
}
