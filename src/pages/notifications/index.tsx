// 消息中心页：站内信收件箱（v1.7.9 增强：详情面板/全部已读常驻/清空已读/左滑删除）
// 交互对标主流：点消息 → 弹底部详情面板（不再一点就跳转），面板内〔去处理〕才标已读+跳转；
// 未读消息不可左滑删（防误删漏看），只留"清空已读"批量出口；
// 进入与返回时刷新未读数（联动 TabBar 角标 store）。
// RN 约束：仅 flex 布局、无 fixed/vh（覆盖层用 absolute）、Text 包裹、lineHeight 数值。
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
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, clearReadNotifications, type SiteNotification
} from '../../services/notification'
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
  // 详情面板目标消息（null=收起）
  const [detail, setDetail] = useState<SiteNotification | null>(null)
  // 左滑互斥：同一时刻只允许一行展开
  const [openedId, setOpenedId] = useState<string | null>(null)

  const hasUnread = items.some((n) => !n.isRead)
  const hasRead = items.some((n) => n.isRead)

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

  /** 点消息行：弹详情面板；未读即标已读（主流"打开即读"，不依赖后续跳转） */
  const onTapItem = async (n: SiteNotification) => {
    setDetail(n)
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id)
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
        setDetail((d) => (d && d.id === n.id ? { ...d, isRead: true } : d))
        void fetchUnread()
      } catch { /* 标记失败不阻断看详情 */ }
    }
  }

  /** 详情面板〔去处理〕：按业务类型跳转（关闭面板由调用侧处理） */
  const onGoHandle = (n: SiteNotification) => {
    setDetail(null)
    if (n.bizType === 'nomination') Taro.navigateTo({ url: '/pages/merchant/apply' })
    else if (n.bizType === 'merchant') Taro.navigateTo({ url: '/pages/merchant/index' })
  }

  /** 全部已读（v1.7.9 常驻显示，无未读时置灰不可点） */
  const onReadAll = async () => {
    if (!hasUnread) return
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
      void fetchUnread()
      Taro.showToast({ title: '已全部标为已读', icon: 'none' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  /** 清空已读（确认框；未读保留） */
  const onClearRead = async () => {
    if (!hasRead) {
      Taro.showToast({ title: '暂无已读消息', icon: 'none' })
      return
    }
    const ok = await showConfirmDialog({
      title: '清空已读消息',
      content: '删除所有已读消息，未读消息不受影响。',
      confirmText: '清空',
      confirmColor: t.danger
    })
    if (!ok) return
    try {
      await clearReadNotifications()
      setItems((prev) => prev.filter((x) => !x.isRead))
      setTotal((n) => Math.max(0, n - items.filter((x) => x.isRead).length))
      Taro.showToast({ title: '已清空已读', icon: 'none' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  /** 左滑删除单条（确认框；仅已读行可滑删） */
  const onDelete = async (n: SiteNotification) => {
    setOpenedId(null)
    const ok = await showConfirmDialog({
      title: '删除消息',
      content: `删除「${n.title}」？删除后不可恢复。`,
      confirmText: '删除',
      confirmColor: t.danger
    })
    if (!ok) return
    try {
      await deleteNotification(n.id)
      setItems((prev) => prev.filter((x) => x.id !== n.id))
      setTotal((t2) => Math.max(0, t2 - 1))
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title='消息中心' showBack rightSlot={
      // 改动说明（v1.7.9）："全部已读"从条件渲染改常驻（无未读置灰），加"清空已读"批量出口——
      //   原"有未读才出现"太隐蔽，用户找不到操作入口
      isLoggedIn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...fs(13), color: hasRead ? t.primaryText : t.textTertiary }} onClick={() => void onClearRead()}>清空已读</Text>
          <Text style={{ ...fs(13), color: hasUnread ? t.primaryText : t.textTertiary, marginLeft: 14 }} onClick={() => void onReadAll()}>全部已读</Text>
        </View>
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
            items.map((n) => {
              // 改动说明（v1.7.9）：已读行左滑出"删除"；未读行不给滑删（防误删漏看，主流口径）
              const actions: SwipeCellAction[] = n.isRead
                ? [{ key: 'delete', label: '删除', color: '#FFFFFF', bg: t.danger, onPress: () => void onDelete(n) }]
                : []
              return (
                <SwipeCell
                  key={n.id}
                  actions={actions}
                  opened={openedId === n.id}
                  onOpenChange={(o) => setOpenedId(o ? n.id : null)}
                  radius={12}
                  containerStyle={{ marginBottom: 10 }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: t.bgCard, borderRadius: 12, padding: 14 }}
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
                </SwipeCell>
              )
            })
          )}
          {loading && (
            <View style={{ alignItems: 'center', padding: 10 }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>加载中…</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 消息详情面板（v1.7.9，自绘覆盖层 absolute 于页面根，与成员详情面板同款）
          改动说明：点行不再直接跳转商户页——先看详情，〔去处理〕才跳转（主流消息中心交互） */}
      {detail && (
        <View
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDetail(null)}
        >
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgPage, paddingTop: 18, paddingLeft: 16, paddingRight: 16, paddingBottom: 30, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={typeIcon(detail.type)} size={20} color={t.primary} />
              </View>
              <Text style={{ ...fs(17), color: t.textPrimary, fontWeight: '700', flex: 1, marginLeft: 10 }}>{detail.title}</Text>
              <Text style={{ ...fs(13), color: t.textTertiary }} onClick={() => setDetail(null)}>关闭</Text>
            </View>
            <Text style={{ ...fs(15), color: t.textPrimary, marginTop: 14, lineHeight: 23 }}>{detail.body}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 10 }}>{formatTime(detail.createdAt)}</Text>
            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              <View
                style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: t.bgInput, alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setDetail(null)}
              >
                <Text style={{ ...fs(15), color: t.textPrimary }}>知道了</Text>
              </View>
              {detail.bizType === 'merchant' || detail.bizType === 'nomination' ? (
                <View
                  style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}
                  onClick={() => onGoHandle(detail)}
                >
                  <Text style={{ ...fs(15), color: '#FFFFFF', fontWeight: '600' }}>去处理</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </PageLayout>
  )
}
