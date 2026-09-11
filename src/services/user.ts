/**
 * 个人业务服务层：资料、收藏、关注、浏览历史的查询与写操作。
 * 全部经 BFF /mobile 代理（写操作走 /mobile/me/*，透传用户 access token）。
 */
import Taro from '@tarojs/taro'
import { request, ensureAccessToken } from './request'
import { API, getBaseUrl } from './config'

/** BFF 分页包装（与 API PagedResult 对齐） */
export interface Paged<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** 写操作统一响应 */
export interface OpResult {
  success: boolean
  message?: string
}

/** 收藏项（嵌套轴承摘要，对齐 BFF FavoriteBearing） */
export interface FavoriteItem {
  id: string
  createdAt: string
  bearing: { id: string; partNumber: string; brandName?: string; bearingType?: string }
}

/** 关注项（嵌套商家摘要） */
export interface FollowedItem {
  id: string
  createdAt: string
  merchant: { id: string; name: string; companyName?: string; isVerified: boolean }
}

/** 轴承浏览历史条目 */
export interface BearingHistoryItem {
  id: string
  bearingId: string
  bearingPartNumber: string
  brandName?: string
  viewedAt: string
  viewCount: number
}

/** 商家浏览历史条目 */
export interface MerchantHistoryItem {
  id: string
  merchantId: string
  merchantName: string
  companyName?: string
  viewedAt: string
  viewCount: number
}

/** 聚合用户资料（Identity 账号信息 + API 业务资料） */
export interface ProfileInfo {
  id: string
  userName: string
  phoneNumber: string
  nickname?: string
  avatar?: string
  occupation?: number
  companyName?: string
  industry?: string
  merchantId?: string
  merchantName?: string
  favoriteCount: number
  followCount: number
  isActive: boolean
  createdAt: string
  lastLoginAt: string
}

/** 资料编辑请求体（全部可选，部分更新） */
export interface ProfileUpdateBody {
  nickname?: string
  avatar?: string
  occupation?: number
  companyName?: string
  industry?: string
}

/** 获取用户配置（首页/我的页面） */
export async function getHomeData() {
  return request<any>(API.HOME, { auth: false })
}

/** 获取用户 profile（聚合） */
export async function getProfile() {
  return request<ProfileInfo>(API.PROFILE)
}

/** 更新个人信息（BFF 双写 Identity + 业务库） */
export async function updateProfile(body: ProfileUpdateBody) {
  return request<OpResult>(API.PROFILE_UPDATE, { method: 'PUT', data: body })
}

/**
 * 上传本地头像图片（相册选图后的临时路径）。
 * 走 Taro.uploadFile multipart 旁路（不经 request 拦截器），
 * 故先 ensureAccessToken 保证冷启动场景 token 可用。
 */
export async function uploadAvatar(filePath: string): Promise<OpResult & { url?: string }> {
  const token = await ensureAccessToken()
  const res = await Taro.uploadFile({
    url: `${getBaseUrl()}${API.AVATAR_UPLOAD}`,
    filePath,
    name: 'file',
    header: token ? { Authorization: `Bearer ${token}` } : {}
  })
  try {
    const data = JSON.parse(res.data as string)
    return { success: data.success === true, message: data.message, url: data.url }
  } catch {
    return { success: false, message: '上传响应解析失败' }
  }
}

/** 获取收藏列表 */
export async function getFavorites(page = 1, pageSize = 20) {
  return request<Paged<FavoriteItem>>(`${API.FAVORITES}?page=${page}&pageSize=${pageSize}`)
}

/** 获取关注列表 */
export async function getFollowedMerchants(page = 1, pageSize = 20) {
  return request<Paged<FollowedItem>>(`${API.FOLLOWED}?page=${page}&pageSize=${pageSize}`)
}

/** 收藏/取消收藏轴承 */
export async function toggleFavorite(bearingId: string, favorited: boolean): Promise<OpResult> {
  if (favorited) {
    return await request<OpResult>(API.FAVORITE_TOGGLE(bearingId), { method: 'DELETE' })
  }
  return await request<OpResult>(API.FAVORITE_TOGGLE(bearingId), { method: 'POST' })
}

/** 查询是否已收藏（未登录/失败按未收藏处理，不抛出） */
export async function checkFavorite(bearingId: string): Promise<boolean> {
  try {
    const r = await request<{ isFavorited: boolean }>(API.FAVORITE_CHECK(bearingId))
    return !!r?.isFavorited
  } catch {
    return false
  }
}

/** 关注/取消关注商家 */
export async function toggleFollow(merchantId: string, followed: boolean): Promise<OpResult> {
  if (followed) {
    return await request<OpResult>(API.FOLLOW_TOGGLE(merchantId), { method: 'DELETE' })
  }
  return await request<OpResult>(API.FOLLOW_TOGGLE(merchantId), { method: 'POST' })
}

/** 查询是否已关注 */
export async function checkFollow(merchantId: string): Promise<boolean> {
  try {
    const r = await request<{ isFollowed: boolean }>(API.FOLLOW_CHECK(merchantId))
    return !!r?.isFollowed
  } catch {
    return false
  }
}

/** 轴承浏览历史（分页） */
export async function getBearingHistory(page = 1, pageSize = 20) {
  return request<Paged<BearingHistoryItem>>(`${API.HISTORY_BEARINGS}?page=${page}&pageSize=${pageSize}`)
}

/** 商家浏览历史（分页） */
export async function getMerchantHistory(page = 1, pageSize = 20) {
  return request<Paged<MerchantHistoryItem>>(`${API.HISTORY_MERCHANTS}?page=${page}&pageSize=${pageSize}`)
}

/** 上报轴承浏览（详情页进入时调用；尽力而为，失败静默） */
export function recordBearingView(bearingId: string) {
  request<OpResult>(API.HISTORY_RECORD_BEARING(bearingId), { method: 'POST' }).catch(() => { /* 上报失败不影响浏览 */ })
}

/** 上报商家浏览 */
export function recordMerchantView(merchantId: string) {
  request<OpResult>(API.HISTORY_RECORD_MERCHANT(merchantId), { method: 'POST' }).catch(() => {})
}

/** 删除单条轴承浏览历史 */
export async function deleteBearingHistory(bearingId: string) {
  return request<OpResult>(API.HISTORY_RECORD_BEARING(bearingId), { method: 'DELETE' })
}

/** 删除单条商家浏览历史 */
export async function deleteMerchantHistory(merchantId: string) {
  return request<OpResult>(API.HISTORY_RECORD_MERCHANT(merchantId), { method: 'DELETE' })
}

/** 清空浏览历史 */
export async function clearHistory() {
  return request<OpResult>(API.HISTORY_CLEAR, { method: 'DELETE' })
}
