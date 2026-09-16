// 站内信通知 store：未读数全局共享（CustomTabBar 角标 / 消息中心 / 我的页），
// 进入相关页面 useDidShow 时调 fetchUnread 刷新；失败静默归零不打扰
import { create } from 'zustand'
import { getUnreadCount } from '../services/notification'
import { useAuthStore } from './auth'

interface NotificationState {
  /** 未读条数（角标显示，>99 展示 99+） */
  unreadCount: number
  /** 拉取当前用户未读数（未登录直接归零；退出登录后页面 useDidShow 再拉即清零） */
  fetchUnread: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  fetchUnread: async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      set({ unreadCount: 0 })
      return
    }
    const count = await getUnreadCount()
    set({ unreadCount: count })
  }
}))
