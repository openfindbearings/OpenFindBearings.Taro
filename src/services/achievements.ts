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
