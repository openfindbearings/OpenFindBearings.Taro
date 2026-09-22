// 站内信通知 store：未读数全局共享（CustomTabBar 角标 / 消息中心 / 我的页），
// 进入相关页面 useDidShow 时调 fetchUnread 刷新；失败静默归零不打扰。
// 改动说明（v1.7.13）：新增 60s 轮询（startPolling）——未读数增加时播提示音/震动提醒
//   （utils/sound 三端分策，音效开关可关）；冷启动首拉只立基线不提醒。
import { create } from 'zustand'
import { getUnreadCount } from '../services/notification'
import { notifyNewMessage } from '../utils/sound'
import { useAuthStore } from './auth'

interface NotificationState {
  /** 未读条数（角标显示，>99 展示 99+） */
  unreadCount: number
  /** 拉取当前用户未读数（未登录直接归零；退出登录后页面 useDidShow 再拉即清零） */
  fetchUnread: () => Promise<void>
  /** 启动未读轮询（App 启动调一次；60s 间隔，仅登录时请求） */
  startPolling: () => void
}

/** 轮询定时器（模块级单例，startPolling 幂等防重复起） */
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 基线已立标记：冷启动/登录后的第一次拉取不触发提醒（避免历史未读轰炸） */
let baselineSet = false

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,

  fetchUnread: async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      baselineSet = false
      set({ unreadCount: 0 })
      return
    }
    const count = await getUnreadCount()
    const prev = get().unreadCount
    set({ unreadCount: count })
    // 未读数增加才提醒；首拉仅立基线。退出重进/登出清零后重新立基线
    if (baselineSet && count > prev) void notifyNewMessage()
    baselineSet = true
  },

  startPolling: () => {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      void get().fetchUnread()
    }, 60 * 1000)
  }
}))
