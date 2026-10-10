// 段位彩牌工具（v2.12.0 等级玩法）：等级号 → 段位色带（青铜/白银/黄金/铂金/钻石/星耀/王者）。
// 参照京东/王者简单做法：仅按等级号映射底色，文案仍用后端 levelName（Admin 可改段位名不失效）。
// RN 约束：返回硬编码色值（不用 CSS 变量）；深底配白字保证对比度
export interface LevelBand {
  /** 色带名（青铜~王者，调试与兜底展示用） */
  band: string
  /** 徽章底色 */
  bg: string
}

/**
 * 按等级号取段位色带：Lv1-2 青铜 / Lv3-4 白银 / Lv5 黄金 / Lv6 铂金 /
 * Lv7 钻石 / Lv8-9 星耀 / Lv10+ 王者（与十档种子一一对应；档位增删时按号就近落带）
 */
export function getLevelBand(level?: number): LevelBand {
  const lv = level ?? 1
  if (lv <= 2) return { band: '青铜', bg: '#CD7F32' }
  if (lv <= 4) return { band: '白银', bg: '#8E9AA8' }
  if (lv === 5) return { band: '黄金', bg: '#E6A700' }
  if (lv === 6) return { band: '铂金', bg: '#3FA9A0' }
  if (lv === 7) return { band: '钻石', bg: '#3B82F6' }
  if (lv <= 9) return { band: '星耀', bg: '#8B5CF6' }
  return { band: '王者', bg: '#E5484D' }
}

/**
 * 商家等级枚举值 → 单调序数（与后端 MerchantBuffs.Rank 同表：1入驻/3认证→2/2活跃→3/4金牌→4；
 * 枚举数值非单调是历史映射，前端任何等级比较必须先经此换算）
 */
export function merchantGradeToRank(grade?: number): number {
  switch (grade ?? 0) {
    case 1: return 1
    case 3: return 2
    case 2: return 3
    case 4: return 4
    default: return 0
  }
}

/**
 * 商家等级序数 → 展示名（与后端 Merchant.GetGradeDisplayName 同表；
 * v2.13.0 商家头部彩牌用——buff 接口只回 grade/rank 不回名称，前端映射避免多打一次接口）
 */
export const MERCHANT_GRADE_LABELS: Record<number, string> = {
  1: '入驻商家',
  2: '认证商家',
  3: '活跃供给',
  4: '金牌商家',
}

/**
 * 商家等级彩牌色带（v2.13.0 商家等级页/头部铭牌）：按等级序数 rank 取色——
 * Lv1 入驻石板灰 / Lv2 认证紫 / Lv3 活跃供给蓝 / Lv4 金牌琥珀。
 * 注意入参是 rank（1~4 单调序数）而非 grade 枚举值（数值非单调，须经 MerchantBuffs.Rank 换算）
 */
export function getMerchantGradeBand(rank?: number): LevelBand {
  switch (rank ?? 0) {
    case 1: return { band: '入驻', bg: '#64748B' }
    case 2: return { band: '认证', bg: '#8B5CF6' }
    case 3: return { band: '活跃供给', bg: '#2563EB' }
    case 4: return { band: '金牌', bg: '#D97706' }
    default: return { band: '未定级', bg: '#94A3B8' }
  }
}
