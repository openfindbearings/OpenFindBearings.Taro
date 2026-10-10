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
  /** v2.7.0 G7：用户积分等级（按累计获得积分落档） */
  level?: number
  levelName?: string
  /** v2.12.0 等级玩法：下一档阈值/段位名/升档礼（进度条"距升 X 还差 Y 币"；已达最高档为 null） */
  nextLevelMin?: number | null
  nextLevelName?: string | null
  nextLevelBonus?: number | null
  /** 业务日界偏移小时数（v1.36.1 后端下发，对应 BusinessClock 配置；缺省按 +8 北京兜底） */
  tzOffsetHours?: number
}

/** 签到结果（对齐 BFF CheckinResponse） */
export interface CheckinResult {
  amount: number
  consecutiveDays: number
  alreadyCheckedIn: boolean
  /** v2.1.0 成就子系统：本次签到新点亮的成就键（供 toast） */
  unlockedAchievements?: string[]
  /** v2.8.0 G1：暴击倍数（1=无暴击 / 2=双倍 / 5=传说，供动画 toast） */
  critMultiplier?: number
  /** v2.12.0 等级玩法：签到后最终段位 + 是否跨档（leveledUp=true 播"恭喜升级"toast） */
  level?: number | null
  levelName?: string | null
  leveledUp?: boolean
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
  // v2.6.0 M3：商家集体任务 Job 达标结算发放
  merchant_task: '商家集体任务奖励',
  // v2.7.0 G2：每日任务板三件套（签到 + 纠错 + 应答）额外奖励
  daily_combo: '每日任务板三件套',
  // 名词统一（成就/徽章→勋章）：历史流水保留展示（v2.12.0 起勋章纯荣誉不再产币）
  achievement_unlock: '勋章解锁奖励',
  // v2.12.0 等级玩法：跨入新段位一次性发放的升档礼
  level_up_bonus: '段位升档礼',
}

/** 拉取积分账户（失败返回零值兜底，不打扰页面） */
export async function getPointAccount(): Promise<PointAccount> {
  try {
    const r = await request<PointAccount>(API.POINTS_ACCOUNT)
    return r ?? { balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 }
  } catch {
    return { balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 }
  }}

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

/** 商家福利卡（v2.5.0：成员最佳商家与被动加成，散人 rank=0 空清单） */
export interface MerchantBuff {
  merchantId?: string | null
  merchantName?: string | null
  grade: number
  rank: number
  labels: string[]
  nextHint: string
  /** v2.12.0 等级玩法：下一档升档礼（商家金，终身一次；最高档 null） */
  gradeUpBonus?: number | null
  /** v2.12.0 等级玩法：本店保级截止时刻（UTC ISO；仅 merchantId 本店视角返回，掉级倒计时卡数据源） */
  graceUntil?: string | null
}

/** 拉取商家福利卡；v2.6.0 任务中心拆分：传 merchantId 查"本店给成员的 buff"（商家管理页），
 *  缺省查"我的最佳商家"（个人视角） */
export function getMerchantBuff(merchantId?: string) {
  const url = merchantId ? `${API.POINTS_MERCHANT_BUFF}?merchantId=${merchantId}` : API.POINTS_MERCHANT_BUFF
  return request<MerchantBuff>(url)
}

/** 段位阶梯档（v2.13.0 段位详情页；reached=已达档，bonusClaimed=该档升档礼终身已领） */
export interface PointLadderItem {
  level: number
  name: string
  minTotalEarned: number
  levelUpBonus: number
  reached: boolean
  bonusClaimed: boolean
}

/** 段位阶梯表响应（对齐 BFF PointLadderResponse） */
export interface PointLadder {
  totalEarned: number
  currentLevel: number
  currentLevelName: string
  levels: PointLadderItem[]
}

/** 段位阶梯表（失败返回空表兜底，不打扰页面） */
export async function getPointLadder(): Promise<PointLadder | null> {
  try {
    return await request<PointLadder>(API.POINTS_LEVELS)
  } catch {
    return null
  }
}

/** 商家等级详情（v2.13.0 商家等级页；对齐 BFF MerchantGradeResponse，在职成员可见） */
export interface MerchantGradeDetail {
  merchantId: string
  merchantName?: string | null
  grade: number
  rank: number
  gradeDisplay: string
  isVerified: boolean
  onSaleCount: number
  treasuryEarned: number
  lv3OnSaleMin: number
  lv4OnSaleMin: number
  lv4TreasuryMin: number
  bonusLv2: number
  bonusLv3: number
  bonusLv4: number
  claimedRanks: number[]
  graceUntil?: string | null
  labels: string[]
}

/** 商家等级详情（失败返回 null，调用方兜底） */
export async function getMerchantGrade(merchantId: string): Promise<MerchantGradeDetail | null> {
  try {
    return await request<MerchantGradeDetail>(`${API.POINTS_MERCHANT_GRADE}?merchantId=${merchantId}`)
  } catch {
    return null
  }
}

/** 商家集体任务项（v2.6.0 M3；period 1 周/2 月，rewardType 1 成员/2 金库，done=本周期已达成） */
export interface MerchantTask {
  taskKey: string
  name: string
  description: string
  target: number
  current: number
  period: number
  rewardType: number
  rewardAmount: number
  done: boolean
}

/** 集体任务板响应（对齐 BFF MerchantTasksResponse；散人 tasks 为空） */
export interface MerchantTasksResult {
  merchantId?: string | null
  merchantName?: string | null
  tasks: MerchantTask[]
  completedTotal: number
}

/** 任务板数据（失败返回空清单，不打扰页面）；
 *  v2.6.0 商家主页：传 merchantId 查指定商家（后端校验在职成员），缺省走最佳商户口径 */
export async function getMerchantTasks(merchantId?: string): Promise<MerchantTasksResult> {
  try {
    const url = merchantId ? `${API.POINTS_MERCHANT_TASKS}?merchantId=${merchantId}` : API.POINTS_MERCHANT_TASKS
    const r = await request<MerchantTasksResult>(url)
    return r ?? { merchantId: null, merchantName: null, tasks: [], completedTotal: 0 }
  } catch {
    return { merchantId: null, merchantName: null, tasks: [], completedTotal: 0 }
  }
}

/** 商家实力月榜行（rank=0 表示未进前 100；对齐 BFF MerchantRankItem） */
export interface MerchantRankItem {
  rank: number
  merchantId: string
  merchantName: string
  gradeDisplay: string
  total: number
}

/** 月榜响应（对齐 BFF MerchantRankingResponse；mine 可能为 null=散人无商家） */
export interface MerchantRanking {
  periodKey: string
  top: MerchantRankItem[]
  mine?: MerchantRankItem | null
}

/** 月榜数据（失败返回空榜）；v2.6.0 拆分：传 merchantId 时"我的商家"=该店（商家管理页视角） */
export async function getMerchantRanking(merchantId?: string): Promise<MerchantRanking> {
  try {
    const url = merchantId ? `${API.POINTS_MERCHANT_RANKING}?merchantId=${merchantId}` : API.POINTS_MERCHANT_RANKING
    const r = await request<MerchantRanking>(url)
    return r ?? { periodKey: '', top: [], mine: null }
  } catch {
    return { periodKey: '', top: [], mine: null }
  }
}
