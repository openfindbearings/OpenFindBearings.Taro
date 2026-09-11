import Taro from '@tarojs/taro'
import { getBaseUrl, API } from './config'
import { getItem, setItem, removeItem } from '../utils/storage'
import { getDeviceId } from '../utils/device'

/** BFF 认证扁平响应结构 */
interface BffAuthBody {
  success?: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  code?: string
  message?: string
}

/** 通用错误响应结构（BFF 失败体 {success:false, code, message}） */
interface ApiErrorBody {
  code?: string
  message?: string
}

/**
 * 令牌存储策略（安全约束）：
 * - access_token 仅存内存（不落盘，降低被静态分析/备份读取风险）
 * - refresh_token 持久化（换设备重装后凭它静默续期；配合 device_id 绑定）
 * 改动说明：原实现把 access 也落盘（TOKEN_KEY），现改为仅内存；冷启动 access 为空，
 * 首个受保护请求命中 401 → 自动刷新一次 → 重放，无需启动即刷新。
 */
const REFRESH_KEY = 'refresh_token'
let accessToken: string | null = null

/** 读取内存中的 access token */
export function getToken(): string | null {
  return accessToken
}

/** 是否持有内存 access token */
export function hasSession(): boolean {
  return !!accessToken
}

/** 写入令牌：access 进内存，refresh 落盘 */
export async function setTokens(access: string, refresh?: string): Promise<void> {
  // 改动说明：原写 memoryToken（不存在的变量，实际创建了幽灵全局），真正的 accessToken
  // 恒为 null → 所有请求不带 Authorization → 401→刷新→重放仍 401 的死循环。
  // 收藏/资料/登录态保持全部失效的总根因，改回 accessToken
  accessToken = access
  if (refresh) await setItem(REFRESH_KEY, refresh)
}

/** 清除令牌：内存 access 置空 + 删除持久 refresh */
export async function clearTokens(): Promise<void> {
  accessToken = null
  await removeItem(REFRESH_KEY)
}

/** 读取持久化的 refresh token */
export async function getRefreshToken(): Promise<string | null> {
  return await getItem(REFRESH_KEY)
}

/**
 * 统一 API 错误对象。
 * 携带 BFF 返回的 code / HTTP 状态，登录注册页据此展示具体失败原因（而非一律"网络错误"）。
 */
export class ApiError extends Error {
  code?: string
  statusCode?: number
  constructor(message: string, code?: string, statusCode?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

/** 认证类端点：不参与 401→刷新→重放，避免登录失败被刷新逻辑吞掉/递归 */
const AUTH_PATHS: string[] = [
  API.LOGIN, API.REGISTER, API.REFRESH,
  API.LOGIN_SMS, API.SEND_CODE, API.LOGOUT, API.DELETION
]
function isAuthPath(url: string): boolean {
  return AUTH_PATHS.some((p) => url.indexOf(p) === 0)
}

/** 刷新 single-flight：并发 401 只真正刷新一次，其余复用同一 Promise */
let refreshPromise: Promise<boolean> | null = null

/** 实际刷新动作：用持久 refresh + device_id 换新的 access/refresh */
async function doRefreshToken(): Promise<boolean> {
  const refresh = await getRefreshToken()
  if (!refresh) return false
  const deviceId = await getDeviceId()
  try {
    const res = await Taro.request({
      url: `${getBaseUrl()}${API.REFRESH}`,
      method: 'POST',
      data: { refreshToken: refresh, deviceId },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000
    })
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = res.data as BffAuthBody
      // 改动说明：BFF /auth/refresh 返回扁平 {accessToken,...}，直接读，不再取 body.data（旧写法恒判失败）
      if (body && body.accessToken) {
        await setTokens(body.accessToken, body.refreshToken)
        return true
      }
    }
  } catch {
    /* 刷新请求异常，返回 false 由上层清态 */
  }
  return false
}

/** 取得 single-flight 的刷新 Promise */
function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * 取当前 access token；内存为空（冷启动/过期）则先用 refresh 换一次。
 * 改动说明：uploadFile 等旁路请求不走 request() 的 401→刷新→重放拦截，
 * 需要显式确保 token 可用（头像上传用）。
 */
export async function ensureAccessToken(): Promise<string | null> {
  const tk = getToken()
  if (tk) return tk
  const ok = await refreshOnce()
  return ok ? getToken() : null
}

/** 通用请求方法 */
export async function request<T = any>(  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
    auth?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', data, header = {}, auth = true } = options
  const baseUrl = getBaseUrl()

  const buildHeader = (tok: string | null): any => {
    const h: any = { 'Content-Type': 'application/json', ...header }
    if (auth && tok) h['Authorization'] = `Bearer ${tok}`
    return h
  }
  // 改动说明：Taro RN 的 request 对非 2xx 走 fail 回调（Promise reject，reject 值即响应对象），
  // 与 H5"任何状态码都 resolve"语义不同——导致 401→刷新→重放分支在 RN 上永远不执行，
  // 冷启动登录态无法自愈。此处把 reject 的响应对象归一化回 res 形状，双端行为对齐
  const send = async (): Promise<any> => {
    try {
      return await Taro.request({
        url: `${baseUrl}${url}`,
        method,
        data,
        header: buildHeader(accessToken),
        timeout: 15000
      })
    } catch (e: any) {
      if (e && typeof e.statusCode === 'number') return e
      throw e
    }
  }

  let res = await send()

  // 认证端点：成功直接返回，失败透出 BFF 的 code/message（不触发刷新）
  if (isAuthPath(url)) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const b = res.data as any
      return ((b && (b.data ?? b)) ?? b) as T
    }
    const eb = (res.data || {}) as ApiErrorBody
    throw new ApiError(eb.message || `HTTP ${res.statusCode}`, eb.code, res.statusCode)
  }

  // 业务端点 401：尝试刷新一次并重放；刷新失败清态并抛未授权
  if (res.statusCode === 401) {
    const ok = await refreshOnce()
    if (ok) {
      res = await send()
    } else {
      await clearTokens()
      throw new ApiError('登录已过期，请重新登录', 'UNAUTHORIZED', 401)
    }
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    const b = res.data as any
    return ((b && (b.data ?? b)) ?? b) as T
  }

  const eb = (res.data || {}) as ApiErrorBody
  if (res.statusCode === 429) {
    throw new ApiError(eb.message || '操作过于频繁，请稍后再试', 'RATE_LIMITED', 429)
  }
  throw new ApiError(eb.message || `HTTP ${res.statusCode}`, eb.code, res.statusCode)
}
