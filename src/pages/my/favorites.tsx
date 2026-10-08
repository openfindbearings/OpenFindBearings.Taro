// 我的收藏轴承页（v2.12.0 列表统一改造）：三级手势——左滑取消收藏 / 长按菜单（取消收藏|多选）/
// 多选批量取消；行内垃圾桶按钮移除（操作收进手势，行保持干净）。数据经 BFF /mobile/favorites。
// 登录态订阅 auth store；未登录展示引导登录空态（页面自身兜底，入口不再弹窗拦截）。
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { formatTime } from '../../utils/format'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import NavBar from '../../components/NavBar'
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import ListActionSheet, { type ListSheetAction } from '../../components/ListKit/ListActionSheet'
import BatchBar from '../../components/ListKit/BatchBar'
import { useListSelection } from '../../components/ListKit/useListSelection'
import { useLongPressMenu } from '../../components/ListKit/useLongPressMenu'
import { useAuthStore } from '../../stores/auth'
import MediaImage from '../../components/MediaImage'
import { getFavorites, toggleFavorite, batchRemoveFavorites, type FavoriteItem } from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

/** 收藏列表页：展示型号/品牌/类型与收藏时间，左滑/长按/多选取消收藏，分页加载 */
export default function FavoritesPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [items, setItems] = useState<FavoriteItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  // 左滑互斥 + 长按菜单目标 + 多选模式
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<FavoriteItem | null>(null)
  // 长按菜单走"松手才弹"安全封装（RN 按住即 setState 会触发 UI 队列竞态崩溃）
  const menuHandlers = useLongPressMenu<FavoriteItem>(setSheetFor)
  const sel = useListSelection()

  /** 加载收藏分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); setTotal(0); return }
    setLoading(true)
    try {
      const r = await getFavorites(p, PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
      setTotal(r?.totalCount || 0)
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 取消收藏单条（确认→toggle→本地移除） */
  const onRemove = (item: FavoriteItem) => {
    showConfirmDialog({ title: '取消收藏', content: `不再收藏「${item.bearing.partNumber}」？` }).then(async (ok) => {
      if (!ok) return
      try {
        await toggleFavorite(item.bearing.id, true)
        setItems((prev) => prev.filter((x) => x.id !== item.id))
        setTotal((n) => Math.max(0, n - 1))
        Taro.showToast({ title: '已取消收藏', icon: 'none' })
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' })
      }
    })
  }

  /** 批量取消收藏（多选模式；ids=bearingId 集） */
  const onBatchRemove = async () => {
    const bearingIds = items.filter((x) => sel.selected.includes(x.id)).map((x) => x.bearing.id)
    const ok = await showConfirmDialog({ title: '取消收藏', content: `确认取消选中的 ${bearingIds.length} 个收藏？`, confirmText: '取消收藏', confirmColor: t.danger })
    if (!ok) return
    const n = await batchRemoveFavorites(bearingIds)
    if (n > 0) {
      setItems((prev) => prev.filter((x) => !sel.selected.includes(x.id)))
      setTotal((x) => Math.max(0, x - n))
      Taro.showToast({ title: `已取消 ${n} 个收藏`, icon: 'none' })
    }
    sel.reset()
  }

  // 长按菜单：取消收藏 + 多选
  const sheetActions: ListSheetAction[] = sheetFor
    ? [
      { key: 'remove', label: '取消收藏', danger: true, icon: 'heart-off', onPress: () => onRemove(sheetFor) },
      { key: 'multi', label: '多选', icon: 'list-checks', onPress: () => sel.enter(sheetFor.id) },
    ]
    : []

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title="我的收藏" showBack />} overlay={<ListActionSheet visible={!!sheetFor} title={sheetFor ? sheetFor.bearing.partNumber : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />}>
      {!isLoggedIn && <LoginGuide icon='heart' text='登录后可查看收藏' />}
      {isLoggedIn && items.length === 0 && !loading && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 80 }}>
          <Icon name="heart" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>还没有收藏，去逛逛轴承详情吧</Text>
        </View>
      )}
      {items.map((item) => {
        const checked = sel.selected.includes(item.id)
        const actions: SwipeCellAction[] = sel.selectMode ? [] : [{ key: 'remove', label: '取消收藏', color: '#FFFFFF', bg: t.danger, onPress: () => onRemove(item) }]
        const card = (
          <View
            style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}
            {...menuHandlers(item, !sel.selectMode)}
            onClick={() => {
              if (sel.selectMode) { sel.toggle(item.id); return }
              goDetail(item.bearing.id)
            }}
          >
            {sel.selectMode && (
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: checked ? t.primary : t.textTertiary, backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                {checked ? <Icon name='check' size={13} color='#FFFFFF' /> : null}
              </View>
            )}
            {/* 行图标（v2.12.0）：轴承真图 3D 优先→2D 兜底→皆无/加载失败出 box 默认图标，与关注行 store 同款版式 */}
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primaryLight, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
              <MediaImage url={item.bearing.image3DUrl} fallbacks={[item.bearing.image2DUrl]} fallbackIcon="box" fallbackColor={t.primary} fallbackSize={20} style={{ width: 40, height: 40, borderRadius: 20 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(16), color: t.textPrimary }}>{item.bearing.partNumber}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {[item.bearing.brandName, item.bearing.bearingType].filter(Boolean).join(' · ')}
                {'\n'}收藏于 {formatTime(item.createdAt)}
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
      <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="取消收藏" onAction={() => void onBatchRemove()} onExit={sel.exit} />
      {isLoggedIn && hasMore && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 14, paddingBottom: 14 }} onClick={() => { if (!loading) load(page + 1, true) }}>
          <Text style={{ ...fs(14), color: t.primaryText }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
    </PageLayout>
  )
}
