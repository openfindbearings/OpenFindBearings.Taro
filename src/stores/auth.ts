import { create } from 'zustand'
import { request, setToken, clearToken, getToken } from '../services/request'
import { API } from '../services/config'

/** 用户信息 */
export interface UserInfo {
  id: string
  userName: string
  phoneNumber?: string
  role?: string
  /** 商家 ID，已入驻时有值 */
  merchantId?: string
}

/** 认证状态 */
interface AuthState {
  isLoggedIn: boolean
  user: UserInfo | null
  loading: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (phone: string, password: string) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  user: null,
  loading: false,

  /** 手机号 + 密码登录 */
  login: async (phone: string, password: string) => {
    set({ loading: true })
    try {
      const res = await request<{ accessToken: string; refreshToken: string }>(
        API.LOGIN,
        { method: 'POST', data: { phone, password }, auth: false }
      )
      setToken(res.accessToken, res.refreshToken)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  /** 手机号 + 密码注册 */
  register: async (phone: string, password: string) => {
    set({ loading: true })
    try {
      const res = await request<{ accessToken: string; refreshToken: string }>(
        API.REGISTER,
        { method: 'POST', data: { phone, password }, auth: false }
      )
      setToken(res.accessToken, res.refreshToken)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  /** 退出登录 */
  logout: () => {
    clearToken()
    set({ isLoggedIn: false, user: null })
  },

  /** 拉取用户信息 */
  fetchProfile: async () => {
    try {
      const profile = await request<UserInfo>(API.PROFILE)
      set({ user: profile })
    } catch {
      // token 失效，但不在此处登出（让请求拦截器处理 401）
    }
  },

  /** 启动时初始化：检查 token 是否有效 */
  init: async () => {
    const token = getToken()
    if (!token) return
    set({ isLoggedIn: true })
    await get().fetchProfile()
  },
}))
