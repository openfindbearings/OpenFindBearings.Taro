import { create } from 'zustand'
import { request, setTokens, clearTokens, getRefreshToken, getToken } from '../services/request'
import { getDeviceId } from '../utils/device'
import { setItem } from '../utils/storage'
import { API } from '../services/config'
import { useMerchantStore } from './merchant'

/** 用户信息（对齐 BFF /mobile/profile 返回） */
export interface UserInfo {
  id: string
  userName: string
  phoneNumber?: string
  nickname?: string
  /** 头像绝对 URL（BFF profile 聚合返回；个人信息页保存后 fetchProfile 刷新即联动） */
  avatar?: string
  role?: string
  // 改动说明：移除 merchantId —— 后端已废弃 User.MerchantId 单值列；当前商户上下文用
  //   merchantContext / useMerchantStore.currentMerchantId（成员表多商户模型）
}

/** 认证状态与动作 */
interface AuthState {
  isLoggedIn: boolean
  user: UserInfo | null
  loading: boolean
  /** 手机号 + 密码登录 */
  login: (phone: string, password: string) => Promise<void>
  /**
   * 发送短信验证码（60 秒频控由服务端兜底）。
   * 改动说明（短信登录上线）：注册页下线、全面走"验证码登录即注册"，此动作为主登录链路供码。
   * 改动说明（验证码改密）：type 区分用途（login 默认；改密发码传 reset_password），隔离验证码用途。
   */
  sendCode: (phone: string, type?: string) => Promise<void>
  /**
   * 手机号 + 验证码登录（登录即注册：未注册手机号由 Identity sms grant 自动建号）。
   * 改动说明（短信登录上线）：新增，替代原 register 动作。
   */
  loginSms: (phone: string, code: string) => Promise<void>
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
      // 记住本次登录手机号，下次打开登录页自动回填（登录过的设备一步直达）
      await setItem('last_login_phone', phone)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
      // 登录后拉取入驻状态（非阻塞，商户页/TabBar 读取）
      void useMerchantStore.getState().fetchApplications()
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  sendCode: async (phone: string, type?: string) => {
    // 只发码不改登录态（页面自行管理倒计时与 loading），失败抛出交页面提示
    // 改动说明（验证码改密）：带 type 区分用途，缺省不传由 BFF/Identity 回落 login
    await request(API.SEND_CODE, { method: 'POST', data: { phone, ...(type ? { type } : {}) }, auth: false })
  },

  loginSms: async (phone: string, code: string) => {
    set({ loading: true })
    try {
      const deviceId = await getDeviceId()
      // 登录即注册：BFF login-sms = Identity sms grant，未注册手机号自动建号后返回令牌
      const res = await request<{ accessToken: string; refreshToken: string }>(
        API.LOGIN_SMS,
        { method: 'POST', data: { phone, code, deviceId }, auth: false }
      )
      await setTokens(res.accessToken, res.refreshToken)
      await setItem('last_login_phone', phone)
      await get().fetchProfile()
      set({ isLoggedIn: true, loading: false })
      void useMerchantStore.getState().fetchApplications()
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
    useMerchantStore.getState().reset()
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
    void useMerchantStore.getState().fetchApplications()
  }
}))
