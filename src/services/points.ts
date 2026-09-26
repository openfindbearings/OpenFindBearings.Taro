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
  /** 业务日界偏移小时数（v1.36.1 后端下发，对应 BusinessClock 配置；缺省按 +8 北京兜底） */
  tzOffsetHours?: number
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
  merchant_profile_complete: '完善商户资料',
  merchant_first_product: '首件商品上架',
  sourcing_publish_bonus: '寻货发布加量',
  sourcing_respond_bonus: '寻货应答加量',
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

/** 赚分任务项（对齐 BFF PointTaskItem；daily=每日刷新，done 按今日/历史口径） */
export interface PointTask {
  grantType: string
  displayName: string
  amount: number
  description?: string | null
  /** 连续阶梯数组（签到类非空，可展示"最高 X 分"） */
  ladder?: number[] | null
  daily: boolean
  done: boolean
  /** 今日完成次数（daily 有意义；v1.7.21 任务计数展示） */
  count?: number
  /** 每日上限（0=不限；v1.7.21） */
  limit?: number
}

/** 赚分任务清单（任务中心数据源；失败返回空数组） */
export async function getPointTasks(): Promise<PointTask[]> {
  try {
    const r = await request<PointTask[]>(API.POINTS_TASKS)
    return r ?? []
  } catch {
    return []
  }
}
