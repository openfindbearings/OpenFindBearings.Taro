// 成就子系统（v2.1.0）：成就墙 / 我的徽章排 / 商户徽章排，走 BFF /mobile/achievements/*
import { request } from './request'
import { API } from './config'

/** 成就墙视图项（对应 BFF AchievementItemResponse） */
export interface AchievementItem {
  key: string
  name: string
  description: string
  icon: string
  category: string
  /** 1=个人 2=商户 */
  scope: number
  target: number
  progress: number
  unlocked: boolean
  unlockedAt?: string | null
  rare: boolean
  hidden: boolean
  metaPoints: number
  titleReward?: string | null
  /** v2.6.0 勋章图片相对媒体键（后台配置，无图为空则用图标占位） */
  imageKey?: string | null
  /** v2.8.0 G11 限量徽章标志（绝版窗口，限注册序号前 N） */
  isLimited?: boolean
  /** v2.8.0 G11 限量窗口序号（注册序号 ≤ 此值可解锁） */
  limitedOrdinal?: number | null
}

/** 成就墙视图（对应 BFF AchievementWallResponse） */
export interface AchievementWall {
  items: AchievementItem[]
  totalMetaPoints: number
  currentTitle?: string | null
  unlockedCount: number
}

/** 个人成就墙（全目录+本人进度） */
export function getAchievementWall() {
  return request<AchievementWall>(API.ACHIEVEMENTS_WALL)
}

/** 我的已解锁徽章排（资料页徽章条） */
export function getMyAchievements() {
  return request<AchievementWall>(API.ACHIEVEMENTS_ME)
}

/** 商户徽章排（商户详情/卡片信任信号） */
export function getMerchantAchievements(merchantId: string) {
  return request<AchievementWall>(API.ACHIEVEMENTS_MERCHANT(merchantId))
}

/** 我的称号列表与当前佩戴（v2.8.0 称号系统） */
export interface MyTitles {
  titles: string[]
  equippedTitle?: string | null
}

/** 拉取我的称号与当前佩戴 */
export function getMyTitles() {
  return request<MyTitles>(API.ACHIEVEMENTS_TITLES)
}

/** 佩戴/卸下称号（title 空=卸下） */
export function equipTitle(title: string) {
  return request<{ equippedTitle?: string | null }>(API.ACHIEVEMENTS_TITLE, { method: 'PUT', data: { title } })
}
