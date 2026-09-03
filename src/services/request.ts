import Taro from '@tarojs/taro'
import { getBaseUrl, API } from './config'

/** 通用 API 响应结构 */
interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/** 分页响应结构 */
interface PagedData<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** Token 存储键名 */
const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

/** 内存中缓存的 token */
let cachedToken: string | null = null

/** 获取当前 access token */
export function getToken(): string | null {
  if (cachedToken) return cachedToken
  try {
    cachedToken = Taro.getStorageSync(TOKEN_KEY) || null
  } catch {
    cachedToken = null
  }
  return cachedToken
}

/** 保存 token */
export function setToken(accessToken: string, refreshToken?: string) {
  cachedToken = accessToken
  try {
    Taro.setStorageSync(TOKEN_KEY, accessToken)
    if (refreshToken) Taro.setStorageSync(REFRESH_KEY, refreshToken)
  } catch { /* ignore */ }
}

/** 清除 token */
export function clearToken() {
  cachedToken = null
  try {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(REFRESH_KEY)
  } catch { /* ignore */ }
}

/** 获取 refresh token */
export function getRefreshToken(): string | null {
  try {
    return Taro.getStorageSync(REFRESH_KEY) || null
  } catch {
    return null
  }
}

/** 通用请求方法 */
export async function request<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
    auth?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', data, header = {}, auth = true } = options
  const baseUrl = getBaseUrl()

  // 自动附加 JWT
  if (auth) {
    const token = getToken()
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  try {
    const res = await Taro.request({
      url: `${baseUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      timeout: 15000,
    })

    if (res.statusCode === 401) {
      // token 过期，尝试刷新
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        // 刷新成功，重试请求
        const newToken = getToken()
        if (newToken) {
          header['Authorization'] = `Bearer ${newToken}`
          const retryRes = await Taro.request({
            url: `${baseUrl}${url}`,
            method,
            data,
            header: { 'Content-Type': 'application/json', ...header },
            timeout: 15000,
          })
          if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
            return (retryRes.data as ApiResponse<T>).data ?? retryRes.data as T
          }
        }
      }
      // 刷新失败或重试失败，清除 token 跳登录
      clearToken()
      throw new Error('UNAUTHORIZED')
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return (res.data as ApiResponse<T>).data ?? res.data as T
    }

    throw new Error(`HTTP ${res.statusCode}`)
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') throw err
    console.error(`[Request] ${method} ${url} failed:`, err)
    throw err
  }
}

/** 尝试刷新 token */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await Taro.request({
      url: `${getBaseUrl()}${API.REFRESH}`,
      method: 'POST',
      data: { refreshToken },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = res.data as ApiResponse<{ accessToken: string; refreshToken: string }>
      if (body?.data) {
        setToken(body.data.accessToken, body.data.refreshToken)
        return true
      }
    }
  } catch { /* ignore */ }
  return false
}
