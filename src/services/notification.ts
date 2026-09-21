// 站内信服务：消息中心列表 / 未读数（TabBar 角标） / 已读标记，代理 BFF /mobile/notifications/*
import { request } from './request'
import { API } from './config'
import type { Paged } from './bearing'

/** 站内信项（对齐 BFF NotificationItem） */
export interface SiteNotification {
  id: string
  /** merchant_approved / merchant_rejected / nomination_accepted / system */
  type: string
  title: string
  body: string
  /** merchant / nomination，null 无跳转 */
  bizType?: string | null
  bizId?: string | null
  isRead: boolean
  createdAt: string
}

/** 拉取收件箱分页列表 */
export function getNotifications(params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const qs = `page=${params.page || 1}&pageSize=${params.pageSize || 20}${params.unreadOnly ? '&unreadOnly=true' : ''}`
  return request<Paged<SiteNotification>>(`${API.NOTIFICATIONS}?${qs}`)
}

/** 未读条数（角标轮询；失败返回 0 不打扰页面） */
export async function getUnreadCount(): Promise<number> {
  try {
    const r = await request<{ count: number }>(API.NOTIFICATIONS_UNREAD_COUNT)
    return r?.count ?? 0
  } catch {
    return 0
  }
}

/** 标记单条已读 */
export function markNotificationRead(id: string) {
  return request<{ success: boolean }>(API.NOTIFICATION_READ(id), { method: 'POST' })
}

/** 全部标记已读 */
export function markAllNotificationsRead() {
  return request<{ success: boolean }>(API.NOTIFICATIONS_READ_ALL, { method: 'POST' })
}

/** 删除单条站内信（v1.7.9 左滑删除，硬删） */
export function deleteNotification(id: string) {
  return request<{ success: boolean }>(API.NOTIFICATION_ITEM(id), { method: 'DELETE' })
}

/** 清空全部已读（v1.7.9，未读保留） */
export function clearReadNotifications() {
  return request<{ success: boolean }>(API.NOTIFICATIONS_CLEAR_READ, { method: 'DELETE' })
}
