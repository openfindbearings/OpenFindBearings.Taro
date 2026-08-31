import { create } from 'zustand'
import { isTokenValid, getAccessToken, clearTokens } from '../utils/token'

/** 认证状态 */
interface AuthState {
  /** 是否已登录（token 有效） */
  isLoggedIn: boolean
  /** 用户信息 */
  user: {
    sub: string
    name: string
    phone: string
  } | null
  /** 初始化（检查本地 token） */
  init: () => void
  /** 登录成功后设置 */
  login: (user: AuthState['user']) => void
  /** 登出 */
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,

  init: () => {
    const valid = isTokenValid()
    if (!valid) {
      clearTokens()
    }
    set({ isLoggedIn: valid })
  },

  login: (user) => set({ isLoggedIn: true, user }),

  logout: () => {
    clearTokens()
    set({ isLoggedIn: false, user: null })
  },
}))
