import { create } from 'zustand'
import { request, setTokens, clearTokens, getRefreshToken, getToken } from '../services/request'
import { getDeviceId } from '../utils/device'
import { setItem } from '../utils/storage'
import { API } from '../services/config'

/** 用户信息（对齐 BFF /mobile/profile 返回） */
export interface UserInfo {
  id: string
  userName: string
  phoneNumber?: string
  nickname?: string
  /** 头像绝对 URL（BFF profile 聚合返回；个人信息页保存后 fetchProfile 刷新即联动） */
  avatar?: string
  role?: string
  /** 商家 ID，已入驻时有值（成员表模型前暂留单值语义） */
  merchantId?: string
}

/** 认证状态与动作 */
interface AuthState {
  isLoggedIn: boolean
  user: UserInfo | null
  loading: boolean
  /** 手机号 + 密码登录 */
  login: (phone: string, password: string) => Promise<void>
  /** 手机号 + 密码注册（注册即登录） */
  register: (phone: string, password: string, agreeTerms: boolean) => Promise<void>
  /** 退出登录 */
  logout: () => Promise<void>
  /** 拉取并持久化用户信息 */
  fetchProfile: () => Promise<void>
  /** 启动初始化：有持久 refresh token 即视为登录态，再补拉 profile */
  init: () => Promise<void>
}

/** 把 profile 关键展示字段落盘，供"我的"页同步读取 */
async function persistProfileFields(p: UserInfo) {
  await setItem('user_nickname', p.nickname || p.userName || '')
  await setItem('user_phone', p.phoneNumber || '')
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  user: null,
  loading: false,

  login: async (phone: string, password: string) => {
    set({ loading: true })
    try {
      const deviceId = await getDeviceId()
      // 改动说明：登录请求字段对齐 BFF LoginRequest{Username,Password,DeviceId}，
      // 旧实现发的是 {phone,password} 且缺 deviceId，BFF 绑定校验拿不到设备。
      const res = await request<{ accessToken: string; refreshToken: string }>(
        API.LOGIN,
        { method: 'POST', data: { username: phone, password, deviceId }, auth: false }
      )
      await setTokens(res.accessToken, res.refreshToken)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  register: async (phone: string, password: string, agreeTerms: boolean) => {
    set({ loading: true })
    try {
      const deviceId = await getDeviceId()
      // 注册即登录：BFF register = Identity signup + password grant，直接返回令牌
      const res = await request<{ accessToken: string; refreshToken: string }>(
        API.REGISTER,
        { method: 'POST', data: { phone, password, agreeTerms, deviceId }, auth: false }
      )
      await setTokens(res.accessToken, res.refreshToken)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: async () => {
    // 登出：先尽力吊销服务端刷新令牌（失败不阻断），再清本地凭证
    const refresh = await getRefreshToken()
    if (refresh) {
      try {
        await request(API.LOGOUT, { method: 'POST', data: { refreshToken: refresh }, auth: false })
      } catch { /* 忽略：本地仍清除 */ }
    }
    await clearTokens()
    await setItem('user_nickname', '')
    await setItem('user_phone', '')
    set({ isLoggedIn: false, user: null })
  },

  fetchProfile: async () => {
    try {
      const profile = await request<UserInfo>(API.PROFILE)
      if (profile) {
        set({ user: profile })
        await persistProfileFields(profile)
      }
    } catch {
      // profile 失败不在此登出（401 已由 request 拦截处理）；保留当前登录态判断
    }
  },

  init: async () => {
    // access 仅内存，冷启动为空；以持久 refresh 是否存在判定登录态
    const refresh = await getRefreshToken()
    if (!refresh && !getToken()) return
    set({ isLoggedIn: true })
    await get().fetchProfile()
  }
}))
