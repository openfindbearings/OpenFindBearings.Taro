import Taro from '@tarojs/taro'
import { saveTokens, clearTokens, getDeviceId } from '../utils/token'

/** BFF 基础地址 */
function getBaseUrl(): string {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) return ''
  return process.env.TARO_APP_BFF_BASE_URL || 'https://bff.515813.xyz'
}

/** 登录请求参数 */
export interface LoginParams {
  phone: string
  credential: string
  grantType?: 'password' | 'sms'
}

/** 登录结果 */
export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    sub: string
    name: string
    phone: string
  }
}

/** 密码登录（BFF /mobile/auth/login） */
export async function loginWithPassword(phone: string, password: string): Promise<LoginResult> {
  const baseUrl = getBaseUrl()
  const res = await Taro.request({
    url: `${baseUrl}/mobile/auth/login`,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: { username: phone, password, deviceId: getDeviceId() },
  })

  if (res.statusCode !== 200 || !res.data.success) {
    throw new Error(res.data.message || '手机号或密码错误')
  }

  saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)

  const payload = parseJwt(res.data.accessToken)
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    expiresIn: res.data.expiresIn,
    user: {
      sub: payload.sub || '',
      name: payload.name || payload.preferred_username || '',
      phone: payload.phone_number || '',
    },
  }
}

/** 短信验证码登录/注册（BFF /mobile/auth/login-sms） */
export async function loginWithSms(phone: string, code: string): Promise<LoginResult> {
  const baseUrl = getBaseUrl()
  const res = await Taro.request({
    url: `${baseUrl}/mobile/auth/login-sms`,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: { phone, code, deviceId: getDeviceId() },
  })

  if (res.statusCode !== 200 || !res.data.success) {
    throw new Error(res.data.message || '验证码错误或已过期')
  }

  saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn)

  const payload = parseJwt(res.data.accessToken)
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    expiresIn: res.data.expiresIn,
    user: {
      sub: payload.sub || '',
      name: payload.name || payload.preferred_username || '',
      phone: payload.phone_number || '',
    },
  }
}

/** 发送短信验证码（BFF /mobile/auth/send-code） */
export async function sendSmsCode(phone: string): Promise<void> {
  const baseUrl = getBaseUrl()
  const res = await Taro.request({
    url: `${baseUrl}/mobile/auth/send-sms`,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: { phone },
  })
  if (res.statusCode !== 200 || !res.data.success) {
    throw new Error(res.data.message || '发送验证码失败')
  }
}

/** 登出（清除本地 token） */
export function logout(): void {
  clearTokens()
}

/** 解析 JWT payload（不做签名验证） */
function parseJwt(token: string): Record<string, string> {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return {}
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = payload.length % 4
    if (pad === 2) payload += '=='
    else if (pad === 3) payload += '='
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return {}
  }
}
