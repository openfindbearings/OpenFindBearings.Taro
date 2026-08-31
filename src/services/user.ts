import { request } from './request'

/** 用户信息 */
export interface UserProfile {
  id: string
  name: string
  phone: string
  email?: string
  isEnabled: boolean
  createdAt?: string
  lastLoginAt?: string
  roles: string[]
  /** 是否已入驻 */
  isMerchant: boolean
  merchantId?: string
}

/** 获取当前用户信息 */
export async function getCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>({ url: '/api/account/me' })
}

/** 收藏轴承 */
export async function addFavoriteBearing(bearingId: string): Promise<void> {
  await request({ url: '/api/user/favorites/bearings', method: 'POST', data: { bearingId } })
}

/** 取消收藏轴承 */
export async function removeFavoriteBearing(bearingId: string): Promise<void> {
  await request({ url: `/api/user/favorites/bearings/${bearingId}`, method: 'DELETE' })
}

/** 获取收藏轴承列表 */
export async function getFavoriteBearings(page = 1, pageSize = 20): Promise<{ items: { bearingId: string; createdAt: string }[]; totalCount: number }> {
  return request({ url: '/api/user/favorites/bearings', data: { page, pageSize } })
}

/** 关注商家 */
export async function followMerchant(merchantId: string): Promise<void> {
  await request({ url: '/api/user/follows/merchants', method: 'POST', data: { merchantId } })
}

/** 取消关注商家 */
export async function unfollowMerchant(merchantId: string): Promise<void> {
  await request({ url: `/api/user/follows/merchants/${merchantId}`, method: 'DELETE' })
}

/** 获取关注商家列表 */
export async function getFollowedMerchants(page = 1, pageSize = 20): Promise<{ items: { merchantId: string; createdAt: string }[]; totalCount: number }> {
  return request({ url: '/api/user/follows/merchants', data: { page, pageSize } })
}

/** 获取浏览记录 */
export async function getBrowseHistory(page = 1, pageSize = 20): Promise<{ items: { bearingId: string; viewedAt: string }[]; totalCount: number }> {
  return request({ url: '/api/user/history', data: { page, pageSize } })
}

/** 记录浏览 */
export async function addBrowseHistory(bearingId: string): Promise<void> {
  await request({ url: '/api/user/history', method: 'POST', data: { bearingId } })
}
