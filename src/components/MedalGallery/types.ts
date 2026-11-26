// 勋章图鉴共享类型与纯计算（v1.4.47 蜜雪式改版）：
// 上半静态 hero（身份 + 已点亮总数），下半弧形分类页签 + 整页图鉴网格切换。
// 本文件只放跨端纯逻辑，不含任何平台样式，供 index.tsx（H5/小程序）与 index.rn.tsx 共用。
import type { ReactNode } from 'react'
import type { AchievementItem } from '../../services/achievements'

/** 图鉴数据源：一个分类一页 */
export interface MedalCategoryPage {
  /** 分类名（弧形页签文案） */
  label: string
  /** 该分类下的全部勋章（含未解锁） */
  items: AchievementItem[]
  /** 已点亮数量 */
  unlockedCount: number
}

/** MedalGallery 组件属性 */
export interface MedalGalleryProps {
  /** 分类分页数据（顺序即页序） */
  pages: MedalCategoryPage[]
  /** hero 头像地址（已解析的绝对 URL，空则显示占位图标） */
  avatarUrl?: string | null
  /** hero 无头像时的占位图标名（个人页用 user，商户页用 store） */
  avatarIcon?: string
  /** hero 主标题（昵称 / 商户名） */
  name: string
  /** hero 副标题（脱敏手机号 / 商户牌级等，可空） */
  subtitle?: string | null
  /** 已点亮总数（hero 大字） */
  unlockedCount: number
  /** 勋章总数（hero 分母） */
  totalCount: number
  /** hero 下方附加内容（摘要条、佩戴称号等功能区） */
  footer?: ReactNode
}

/** 弧形页签的位移参数：距当前页越远，越倾斜、越靠下、越暗 */
export interface ArcParams {
  rotateDeg: number
  translateY: number
  scale: number
  opacity: number
}

/**
 * 按「与当前页的偏移」计算弧形页签姿态。
 * 偏移 0 摆正放大，两侧依次外倾、下沉、变淡，形成弧面观感。
 */
export function arcParams(offset: number): ArcParams {
  const abs = Math.abs(offset)
  return {
    rotateDeg: Math.max(-12, Math.min(12, offset * 6)),
    translateY: Math.min(10, abs * 5),
    scale: offset === 0 ? 1.1 : 0.92,
    opacity: abs === 0 ? 1 : abs === 1 ? 0.65 : 0.35,
  }
}



/** 手机号脱敏（hero 副标题用）：138****8000 */
export function maskMobile(phone?: string | null): string {
  if (!phone) return ''
  const p = phone.replace(/\s/g, '')
  if (p.length < 7) return p
  return `${p.slice(0, 3)}****${p.slice(-4)}`
}
