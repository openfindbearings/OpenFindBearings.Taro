import Taro from '@tarojs/taro'
import { getAccessToken, isTokenValid, saveTokens, clearTokens, getRefreshToken, getDeviceId } from '../utils/token'

/** BFF 基础地址（H5 用相对路径，小程序用完整地址） */
function getBaseUrl(): string {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) return ''
  // 小程序/APP 需配置 BFF 实际地址
  return process.env.TARO_APP_BFF_BASE_URL || 'https://mobile.515813.xyz'
}

/** 通用 API 响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
}

/** 分页数据结构 */
export interface PagedData<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

/** 请求配置 */
interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  /** 是否需要 JWT 认证，默认 true */
  auth?: boolean
  /** 是否显示 loading，默认 false */
  loading?: boolean
}

/** 尝试刷新 token，返回新 token 或 null */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const baseUrl = getBaseUrl()
    const res = await Taro.request({
      url: `${baseUrl}/api/mobile/auth/refresh`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        refreshToken,
        deviceId: getDeviceId(),
      },
    })

    if (res.statusCode === 200 && res.data.success) {
      saveTokens(res.data.accessToken, res.data.refreshToken || refreshToken, res.data.expiresIn)
      return res.data.accessToken
    }
  } catch { /* 忽略 */ }
  return null
}

/**
 * 统一请求方法
 * - 自动附加 JWT
 * - 401 自动刷新重试一次
 * - 可选 loading 提示
 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, auth = true, loading = false } = options
  const baseUrl = getBaseUrl()
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

  if (loading) {
    Taro.showLoading({ title: '加载中...', mask: true })
  }

  try {
    // 附加 JWT
    if (auth) {
      const token = getAccessToken()
      if (token) {
        header['Authorization'] = `Bearer ${token}`
      }
    }

    const res = await Taro.request({
      url: fullUrl,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
    })

    // 401 → 尝试刷新
    if (res.statusCode === 401 && auth && isTokenValid() === false) {
      const newToken = await tryRefreshToken()
      if (newToken) {
        header['Authorization'] = `Bearer ${newToken}`
        const retryRes = await Taro.request({
          url: fullUrl,
          method,
          data,
          header: { 'Content-Type': 'application/json', ...header },
        })
        return parseResponse<T>(retryRes)
      }
      // 刷新失败 → 清除 token，抛异常
      clearTokens()
      throw new Error('登录已过期，请重新登录')
    }

    return parseResponse<T>(res)
  } finally {
    if (loading) Taro.hideLoading()
  }
}

function parseResponse<T>(res: Taro.request.Response): T {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const body = res.data as ApiResponse<T>
    // 如果后端返回标准 ApiResponse 结构
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success) {
        throw new Error(body.message || '请求失败')
      }
      return body.data as T
    }
    // 非标准结构直接返回
    return res.data as T
  }
  throw new Error(`请求失败 (${res.statusCode})`)
}

/** 不带认证的公开请求 */
export function requestPublic<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, data, auth: false })
}
