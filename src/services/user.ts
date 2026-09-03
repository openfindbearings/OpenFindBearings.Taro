import { request } from './request'
import { API } from './config'

/** 获取用户配置（首页/我的页面） */
export async function getHomeData() {
  return request<any>(API.HOME, { auth: false })
}

/** 获取用户 profile */
export async function getProfile() {
  return request<any>(API.PROFILE)
}

/** 获取收藏列表 */
export async function getFavorites(page = 1, pageSize = 20) {
  return request<any>(`${API.FAVORITES}?page=${page}&pageSize=${pageSize}`)
}

/** 获取关注列表 */
export async function getFollowedMerchants(page = 1, pageSize = 20) {
  return request<any>(`${API.FOLLOWED}?page=${page}&pageSize=${pageSize}`)
}

/** 获取浏览历史 */
export async function getHistory(page = 1, pageSize = 20) {
  return request<any>(`${API.HISTORY}?page=${page}&pageSize=${pageSize}`)
}
