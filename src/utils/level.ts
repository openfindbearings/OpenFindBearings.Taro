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
 * 商家牌级枚举值 → 单调序数（v2.18.0 牌级重构：枚举已改为单调，1 普通/2 铜牌/3 银牌/4 金牌，
 * 序数即枚举值本身；保留此函数名以免各页大改，语义=牌级台阶）
 */
export function merchantGradeToRank(grade?: number): number {
  const g = grade ?? 0
  return g >= 1 && g <= 4 ? g : 0
}

/**
 * 商家牌级枚举名 → 单调序数（API DTO 的 Grade 走 enum.ToString() 回名称：
 * Ordinary/Bronze/Silver/Gold；与 merchantGradeToRank 同表；
 * 改动说明（v2.19.0 有效期制）：Registered 改名 Ordinary）
 */
export function merchantGradeNameToRank(gradeName?: string | null): number {
  switch (gradeName) {
    case 'Ordinary': return 1
    case 'Bronze': return 2
    case 'Silver': return 3
    case 'Gold': return 4
    default: return 0
  }
}

/**
 * 商家牌级序数 → 展示名（与后端 Merchant.GetGradeDisplayName 同表；
 * v2.18.0 牌级重构：认证是独立徽章（IsVerified），不再写进等级名；
 * 改动说明（v2.19.0 有效期制）：统一为"普通/铜牌/银牌/金牌"）
 */
export const MERCHANT_GRADE_LABELS: Record<number, string> = {
  1: '普通',
  2: '铜牌',
  3: '银牌',
  4: '金牌',
}

/**
 * 商家牌级图标（v2.19.0）：普通/铜/银/金四档，白金与钻石只预留命名；
 * 均取自 lucide 既有图标集，H5 与 RN 共用同一名称
 */
export const MERCHANT_GRADE_ICONS: Record<number, string> = {
  1: 'user',
  2: 'medal',
  3: 'award',
  4: 'trophy',
}

/**
 * 商家牌级彩牌色带（v2.13.0 商家等级页/头部铭牌，v2.18.0 改牌级配色）：
 * Lv1 普通石板灰 / Lv2 铜 / Lv3 银 / Lv4 金。
 * 注意入参是 rank（1~4 单调序数，现与 grade 枚举值同值）
 */
export function getMerchantGradeBand(rank?: number): LevelBand {
  switch (rank ?? 0) {
    case 1: return { band: '普通', bg: '#64748B' }
    case 2: return { band: '铜牌', bg: '#B87333' }
    case 3: return { band: '银牌', bg: '#8E9AA8' }
    case 4: return { band: '金牌', bg: '#D97706' }
    default: return { band: '未定级', bg: '#94A3B8' }
  }
}
