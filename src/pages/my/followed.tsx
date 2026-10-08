// 我的关注商家页（v2.12.0 列表统一改造）：三级手势——左滑取消关注 / 长按菜单（取消关注|多选）/
// 多选批量取关；行内垃圾桶按钮移除。数据经 BFF /mobile/followed（API /api/me/follows/merchants）。
// 与收藏页同范式：登录态订阅 store，未登录展示引导空态。
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { formatTime } from '../../utils/format'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import ListActionSheet, { type ListSheetAction } from '../../components/ListKit/ListActionSheet'
import BatchBar from '../../components/ListKit/BatchBar'
import { useListSelection } from '../../components/ListKit/useListSelection'
import { useLongPressMenu } from '../../components/ListKit/useLongPressMenu'
import { useAuthStore } from '../../stores/auth'
import MediaImage from '../../components/MediaImage'
import { getFollowedMerchants, toggleFollow, batchRemoveFollows, type FollowedItem } from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

/** 关注商家列表页：展示商家名称/公司与关注时间，左滑/长按/多选取消关注，分页加载 */
export default function FollowedPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [items, setItems] = useState<FollowedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<FollowedItem | null>(null)
  // 长按菜单走"松手才弹"安全封装（RN 按住即 setState 会触发 UI 队列竞态崩溃）
  const menuHandlers = useLongPressMenu<FollowedItem>(setSheetFor)
  const sel = useListSelection()

  /** 加载关注分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); setTotal(0); return }
    setLoading(true)
    try {
      const r = await getFollowedMerchants(p, PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
      setTotal(r?.totalCount || 0)
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 取消关注单条（确认→toggle→本地移除） */
  const onUnfollow = (item: FollowedItem) => {
    showConfirmDialog({ title: '取消关注', content: `不再关注「${item.merchant.name}」？` }).then(async (ok) => {
      if (!ok) return
      try {
        await toggleFollow(item.merchant.id, true)
        setItems((prev) => prev.filter((x) => x.id !== item.id))
        setTotal((n) => Math.max(0, n - 1))
        Taro.showToast({ title: '已取消关注', icon: 'none' })
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' })
      }
    })
  }

  /** 批量取消关注（多选模式；ids=merchantId 集） */
  const onBatchUnfollow = async () => {
    const merchantIds = items.filter((x) => sel.selected.includes(x.id)).map((x) => x.merchant.id)
    const ok = await showConfirmDialog({ title: '取消关注', content: `确认取消关注选中的 ${merchantIds.length} 个商家？`, confirmText: '取消关注', confirmColor: t.danger })
    if (!ok) return
    const n = await batchRemoveFollows(merchantIds)
    if (n > 0) {
      setItems((prev) => prev.filter((x) => !sel.selected.includes(x.id)))
      setTotal((x) => Math.max(0, x - n))
      Taro.showToast({ title: `已取消关注 ${n} 个商家`, icon: 'none' })
    }
    sel.reset()
  }

  // 长按菜单：取消关注 + 多选
  const sheetActions: ListSheetAction[] = sheetFor
    ? [
      { key: 'unfollow', label: '取消关注', danger: true, icon: 'user-minus', onPress: () => onUnfollow(sheetFor) },
      { key: 'multi', label: '多选', icon: 'list-checks', onPress: () => sel.enter(sheetFor.id) },
    ]
    : []

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })
  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title="我的关注" showBack />} overlay={<ListActionSheet visible={!!sheetFor} title={sheetFor ? sheetFor.merchant.name : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />}>
      {!isLoggedIn && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 80 }}>
          <Icon name="users" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>登录后可查看关注</Text>
          <View
            style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, marginTop: 16 }}
            onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          >
            <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
          </View>
        </View>
      )}
      {isLoggedIn && items.length === 0 && !loading && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 80 }}>
          <Icon name="users" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>还没有关注，去商家详情页看看吧</Text>
        </View>
      )}
      {items.map((item) => {
        const checked = sel.selected.includes(item.id)
        const actions: SwipeCellAction[] = sel.selectMode ? [] : [{ key: 'unfollow', label: '取消关注', color: '#FFFFFF', bg: t.danger, onPress: () => onUnfollow(item) }]
        const card = (
          <View
            style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}
            {...menuHandlers(item, !sel.selectMode)}
            onClick={() => {
              if (sel.selectMode) { sel.toggle(item.id); return }
              goDetail(item.merchant.id)
            }}
          >
            {sel.selectMode && (
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: checked ? t.primary : t.textTertiary, backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                {checked ? <Icon name='check' size={13} color='#FFFFFF' /> : null}
              </View>
            )}
            {/* 行图标（v2.12.0）：商家真实 logo（BFF 补透传 LogoUrl），无 logo/加载失败回退 store 默认图标 */}
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primaryLight, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
              <MediaImage url={item.merchant.logoUrl} fallbackIcon="store" fallbackColor={t.primary} fallbackSize={20} style={{ width: 40, height: 40, borderRadius: 20 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(16), color: t.textPrimary }}>{item.merchant.name}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {item.merchant.companyName || (item.merchant.isVerified ? '认证商家' : '')}
                {'\n'}关注于 {formatTime(item.createdAt)}
              </Text>
            </View>
            {!sel.selectMode ? <Icon name="chevron-right" size={16} color={t.textTertiary} /> : null}
          </View>
        )
        return sel.selectMode ? (
          <View key={item.id}>{card}</View>
        ) : (
          <SwipeCell key={item.id} actions={actions} opened={openedId === item.id} onOpenChange={(o) => setOpenedId(o ? item.id : null)} radius={0}>
            {card}
          </SwipeCell>
        )
      })}
      <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="取消关注" onAction={() => void onBatchUnfollow()} onExit={sel.exit} />
      {isLoggedIn && hasMore && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 14, paddingBottom: 14 }} onClick={() => { if (!loading) load(page + 1, true) }}>
          <Text style={{ ...fs(14), color: t.primaryText }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
    </PageLayout>
  )
}
