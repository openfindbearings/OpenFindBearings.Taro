// 轴承币与商家金规则数据源（v2.17.0）：规则页数值单一来源，消除页面内硬编码数值与后端漂移。
// 代理 BFF /mobile/points/rules（匿名）；接口失败由调用方兜底默认值，不打扰页面。
import { request } from './request'
import { API } from './config'

/** 规则数据（对齐 API PointRulesDto / BFF PointRulesResponse） */
export interface PointRules {
  /** 签到连签阶梯（如 [2,3,4,5,5]） */
  checkinLadder: number[]
  /** 签到暴击双倍概率（%） */
  checkinDoubleChance: number
  /** 签到传说 ×5 暴击概率（%） */
  checkinLegendChance: number
  /** 每日登录分值 */
  loginAmount: number
  /** 纠错被采纳分值 */
  correctionAmount: number
  /** 纠错被采纳每日上限 */
  correctionDailyLimit: number
  /** 每日三件套额外奖励分值 */
  comboAmount: number
  /** 小游戏每局分值 */
  minigameAmount: number
  /** 小游戏每日上限分值 */
  minigameDailyLimit: number
  /** 完善资料一次性里程碑分值 */
  milestoneProfile: number
  /** 首次上架一次性里程碑分值 */
  milestoneFirstProduct: number
  /** 入驻审批通过一次性里程碑分值 */
  milestoneApproved: number
  /** 寻货超额每次扣币分值 */
  sourcingBonusAmount: number
  /** 寻货发布每日硬上限条数 */
  sourcingPublishDailyLimit: number
  /** 寻货应答每日硬上限条数 */
  sourcingRespondDailyLimit: number
  /** 寻货每日免费发布条数 */
  freePublishPerDay: number
  /** 寻货每日免费应答条数 */
  freeRespondPerDay: number
  /** 段位升档礼区间下限 */
  levelBonusMin: number
  /** 段位升档礼区间上限 */
  levelBonusMax: number
  /** 业务切日时区偏移小时数 */
  tzOffsetHours: number
  /** 签到 buff 最大加数 */
  buffCheckinMax: number
  /** 每日登录 buff 加数 */
  buffLogin: number
  /** 纠错采纳 buff 最大乘数 */
  buffCorrectionMax: number
  /** 成员上供比例（%） */
  tricklePercent: number
  /** 店铺每日上供入账上限 */
  trickleDailyCap: number
  /** 店铺每月上供入账上限 */
  trickleMonthlyCap: number
  /** 挂礼结算每月上限 */
  giftSettleMonthlyCap: number
  /** 商家升到 Lv2 的升档礼金额 */
  merchantGradeBonusLv2: number
  /** 商家升到 Lv3 的升档礼金额 */
  merchantGradeBonusLv3: number
  /** 商家升到 Lv4 的升档礼金额 */
  merchantGradeBonusLv4: number
  /** 商家掉级缓冲天数 */
  merchantGradeGraceDays: number
  /** 个人代付汇率（1 商家金折算 N 轴承币） */
  merchantGoldPayRate: number
  /** 集体任务周奖励金库金额 */
  merchantTaskWeeklyTreasury: number
  /** 集体任务成员奖区间下限 */
  merchantTaskMemberMin: number
  /** 集体任务成员奖区间上限 */
  merchantTaskMemberMax: number
}

/** 拉取规则数据（匿名；失败由调用方 catch 兜底默认值） */
export function getPointRules() {
  return request<PointRules>(API.POINT_RULES, { auth: false })
}