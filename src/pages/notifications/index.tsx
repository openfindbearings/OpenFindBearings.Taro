// 消息中心页：站内信收件箱（列表/未读点/单条已读跳转/全部已读/下拉加载更多）
// 触达链路：审核通过/拒绝、提名被接受等事件由 API 订阅落库，本页拉取展示；
// 进入与返回时刷新未读数（联动 TabBar 角标 store）。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值。
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getNotifications, markNotificationRead, markAllNotificationsRead, type SiteNotification } from '../../services/notification'
import { formatTime } from '../../utils/format'

/** 每页条数 */
const PAGE_SIZE = 20

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供（滚动区规范）
definePageConfig({ disableScroll: true })

/** 通知类型对应的图标（仅用项目内已验证存在的 lucide 名） */
function typeIcon(type: string): string {
  if (type === 'merchant_approved') return 'check'
  if (type === 'merchant_rejected') return 'x'
  if (type === 'nomination_accepted') return 'user-plus'
  return 'bell'
}

/** 消息中心页 */
export default function NotificationsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const fetchUnread = useNotificationStore((s) => s.fetchUnread)

  const [items, setItems] = useState<SiteNotification[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  /** 拉取指定页；append=true 时追加（加载更多） */
  const load = async (p: number, append: boolean) => {
    if (!isLoggedIn) return
    setLoading(true)
    try {
      const r = await getNotifications({ page: p, pageSize: PAGE_SIZE })
      setItems((prev) => (append ? [...prev, ...(r?.items ?? [])] : r?.items ?? []))
      setTotal(r?.totalCount ?? 0)
      setPage(p)
    } catch { /* 拉取失败保持当前列表 */ } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    void load(1, false)
    void fetchUnread()
  })

  /** 点击一条消息：未读则标记已读，再按业务类型跳转 */
  const onTapItem = async (n: SiteNotification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id)
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
        void fetchUnread()
      } catch { /* 标记失败不阻断跳转 */ }
    }
    if (n.bizType === 'nomination') Taro.navigateTo({ url: '/pages/merchant/apply' })
    else if (n.bizType === 'merchant') Taro.navigateTo({ url: '/pages/merchant/index' })
  }

  /** 全部已读 */
  const onReadAll = async () => {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
      void fetchUnread()
      Taro.showToast({ title: '已全部标为已读', icon: 'none' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title='消息中心' showBack rightSlot={
      items.some((n) => !n.isRead) ? (
        <Text style={{ ...fs(13), color: t.primaryText }} onClick={onReadAll}>全部已读</Text>
      ) : null
    } />}>
      <ScrollView
        scrollY
        style={{ flex: 1 }}
        onScrollToLower={() => { if (hasMore && !loading) void load(page + 1, true) }}
      >
        <View style={{ padding: 16 }}>
          {!isLoggedIn ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ ...fs(14), color: t.textSecondary }}>登录后查看消息</Text>
            </View>
          ) : items.length === 0 && !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Icon name='bell' size={40} color={t.textTertiary} />
              <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无消息</Text>
            </View>
          ) : (
            items.map((n) => (
              <View
                key={n.id}
                style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 10 }}
                onClick={() => void onTapItem(n)}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={typeIcon(n.type)} size={18} color={t.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* 未读圆点：RN 用数值宽高小圆 View */}
                    {!n.isRead && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger, marginRight: 6 }} />
                    )}
                    <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>{n.title}</Text>
                  </View>
                  <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 4 }} numberOfLines={2}>{n.body}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>{formatTime(n.createdAt)}</Text>
                </View>
                <Icon name='chevron-right' size={16} color={t.textTertiary} />
              </View>
            ))
          )}
          {loading && (
            <View style={{ alignItems: 'center', padding: 10 }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>加载中…</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </PageLayout>
  )
}
