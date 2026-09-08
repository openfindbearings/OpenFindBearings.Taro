import Taro from '@tarojs/taro'
import { getBaseUrl, API } from './config'
import { getItem, setItem, removeItem } from '../utils/storage'

/** 通用 API 响应结构 */
interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/** Token 存储键名 */
const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

/** 内存中缓存的 token（同步读用，避免每次请求都 await 存储） */
let cachedToken: string | null = null

/** 初始化时尝试从存储恢复 token（异步，fire-and-forget） */
;(async () => {
  cachedToken = await getItem(TOKEN_KEY)
})()

/** 获取当前 access token（同步返回缓存值；启动后第一次 await init 后才能用） */
export function getToken(): string | null {
  return cachedToken
}

/** 保存 token */
export async function setToken(accessToken: string, refreshToken?: string): Promise<void> {
  cachedToken = accessToken
  await setItem(TOKEN_KEY, accessToken)
  if (refreshToken) await setItem(REFRESH_KEY, refreshToken)
}

/** 清除 token */
export async function clearToken(): Promise<void> {
  cachedToken = null
  await removeItem(TOKEN_KEY)
  await removeItem(REFRESH_KEY)
}

/** 获取 refresh token（异步，调用方 await） */
export async function getRefreshToken(): Promise<string | null> {
  return await getItem(REFRESH_KEY)
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
  if (auth && cachedToken) {
    header['Authorization'] = `Bearer ${cachedToken}`
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
        if (cachedToken) {
          header['Authorization'] = `Bearer ${cachedToken}`
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
      // 刷新失败或重试失败，清除 token 抛错
      await clearToken()
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
  const refreshToken = await getRefreshToken()
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
        await setToken(body.data.accessToken, body.data.refreshToken)
        return true
      }
    }
  } catch { /* ignore */ }
  return false
}
