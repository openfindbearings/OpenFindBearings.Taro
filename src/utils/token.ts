import storage from './storage'

/** Token 存储键名常量 */
const KEYS = {
  ACCESS_TOKEN: 'ofb_access_token',
  REFRESH_TOKEN: 'ofb_refresh_token',
  DEVICE_ID: 'ofb_device_id',
  EXPIRES_AT: 'ofb_expires_at',
} as const

/** 设备标识，首次生成后持久化 */
function getOrCreateDeviceId(): string {
  let id = storage.get(KEYS.DEVICE_ID)
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '')
    storage.set(KEYS.DEVICE_ID, id)
  }
  return id
}

/** 读取 access_token */
export function getAccessToken(): string {
  return storage.get(KEYS.ACCESS_TOKEN) || ''
}

/** 读取 refresh_token */
export function getRefreshToken(): string {
  return storage.get(KEYS.REFRESH_TOKEN) || ''
}

/** 读取 device_id */
export function getDeviceId(): string {
  return getOrCreateDeviceId()
}

/** 读取过期时间（毫秒时间戳） */
export function getExpiresAt(): number {
  const v = storage.get(KEYS.EXPIRES_AT)
  return v ? parseInt(v, 10) : 0
}

/** access_token 是否有效（未过期且存在） */
export function isTokenValid(): boolean {
  const token = getAccessToken()
  if (!token) return false
  const expiresAt = getExpiresAt()
  // 提前 60 秒视为过期，留刷新缓冲
  return Date.now() < expiresAt - 60_000
}

/** 保存 tokens */
export function saveTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  storage.set(KEYS.ACCESS_TOKEN, accessToken)
  storage.set(KEYS.REFRESH_TOKEN, refreshToken)
  storage.set(KEYS.EXPIRES_AT, String(Date.now() + expiresIn * 1000))
}

/** 清除 tokens（登出） */
export function clearTokens(): void {
  storage.remove(KEYS.ACCESS_TOKEN)
  storage.remove(KEYS.REFRESH_TOKEN)
  storage.remove(KEYS.EXPIRES_AT)
}
