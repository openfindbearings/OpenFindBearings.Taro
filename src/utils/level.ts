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
