// 浏览历史页：轴承/商家双 Tab（不同实体保留主 tab，符合列表规范分层原则）。
// v2.12.0 列表统一改造：行内垃圾桶 → 三级手势（左滑删单条 / 长按菜单（删除|多选）/ 多选批量删）；
// "清空历史"（NavBar 右侧）保留一键全清出口。上报入口在两个详情页（进入即 upsert），本页只做展示与清理。
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
import { useAuthStore } from '../../stores/auth'
import {
  getBearingHistory, getMerchantHistory,
  deleteBearingHistory, deleteMerchantHistory, clearHistory, batchDeleteHistory,
  type BearingHistoryItem, type MerchantHistoryItem
} from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

type TabKey = 'bearing' | 'merchant'

/** 浏览历史页：分 Tab 展示最近浏览，左滑/长按/多选删除 + 一键清空 */
export default function HistoryPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [tab, setTab] = useState<TabKey>('bearing')
  const [bearings, setBearings] = useState<BearingHistoryItem[]>([])
  const [merchants, setMerchants] = useState<MerchantHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [openedId, setOpenedId] = useState<string | null>(null)
  // 长按菜单目标（记录行 id 字符串，跨两类实体统一）
  const [sheetFor, setSheetFor] = useState<{ id: string; label: string; targetId: string } | null>(null)
  const sel = useListSelection()

  /** 按当前 Tab 加载分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean, tk: TabKey = tab) => {
    if (!isLoggedIn) { setBearings([]); setMerchants([]); setTotal(0); return }
    setLoading(true)
    try {
      if (tk === 'bearing') {
        const r = await getBearingHistory(p, PAGE_SIZE)
        setBearings((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
        setTotal(r?.totalCount || 0)
      } else {
        const r = await getMerchantHistory(p, PAGE_SIZE)
        setMerchants((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
        setTotal(r?.totalCount || 0)
      }
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 切换 Tab 并重新加载（多选模式跨 tab 无意义，退出） */
  const switchTab = (tk: TabKey) => {
    if (tk === tab) return
    setTab(tk)
    sel.reset()
    load(1, false, tk)
  }

  /** 删除单条（确认后再调代理，成功即本地移除） */
  const onDelete = (item: BearingHistoryItem | MerchantHistoryItem, tk: TabKey) => {
    const label = tk === 'bearing'
      ? (item as BearingHistoryItem).bearingPartNumber
      : (item as MerchantHistoryItem).merchantName
    showConfirmDialog({ title: '删除记录', content: `删除「${label}」的浏览记录？` }).then(async (ok) => {
      if (!ok) return
      const key = tk === 'bearing' ? (item as BearingHistoryItem).bearingId : (item as MerchantHistoryItem).merchantId
      try {
        if (tk === 'bearing') {
          await deleteBearingHistory(key)
          setBearings((prev) => prev.filter((x) => x.bearingId !== key))
        } else {
          await deleteMerchantHistory(key)
          setMerchants((prev) => prev.filter((x) => x.merchantId !== key))
        }
        setTotal((n) => Math.max(0, n - 1))
      } catch {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    })
  }

  /** 批量删除当前 tab 选中项（v2.12.0 列表多选） */
  const onBatchDelete = async () => {
    const ids = sel.selected
    const ok = await showConfirmDialog({ title: '删除记录', content: `确认删除选中的 ${ids.length} 条浏览记录？`, confirmText: '删除', confirmColor: t.danger })
    if (!ok) return
    const bearingIds = tab === 'bearing' ? bearings.filter((x) => ids.includes(x.id)).map((x) => x.bearingId) : []
    const merchantIds = tab === 'merchant' ? merchants.filter((x) => ids.includes(x.id)).map((x) => x.merchantId) : []
    const n = await batchDeleteHistory(bearingIds, merchantIds)
    if (n > 0) {
      if (tab === 'bearing') setBearings((prev) => prev.filter((x) => !ids.includes(x.id)))
      else setMerchants((prev) => prev.filter((x) => !ids.includes(x.id)))
      setTotal((x) => Math.max(0, x - n))
      Taro.showToast({ title: `已删除 ${n} 条`, icon: 'none' })
    }
    sel.reset()
  }

  /** 清空当前用户全部浏览历史（轴承+商家两表） */
  const onClearAll = () => {
    showConfirmDialog({ title: '清空历史', content: '确定清空全部浏览历史？该操作不可恢复。' }).then(async (ok) => {
      if (!ok) return
      try {
        await clearHistory()
        setBearings([])
        setMerchants([])
        setTotal(0)
        Taro.showToast({ title: '已清空', icon: 'none' })
      } catch {
        Taro.showToast({ title: '清空失败', icon: 'none' })
      }
    })
  }

  // 长按菜单：删除 + 多选
  const sheetActions: ListSheetAction[] = sheetFor
    ? [
      { key: 'delete', label: '删除记录', danger: true, icon: 'trash-2', onPress: () => void onDeleteOneFromSheet(sheetFor) },
      { key: 'multi', label: '多选', icon: 'list-checks', onPress: () => sel.enter(sheetFor.id) },
    ]
    : []

  /** 菜单删除（复用单删确认流） */
  const onDeleteOneFromSheet = async (s: { id: string; label: string; targetId: string }) => {
    const ok = await showConfirmDialog({ title: '删除记录', content: `删除「${s.label}」的浏览记录？` })
    if (!ok) return
    try {
      if (tab === 'bearing') {
        await deleteBearingHistory(s.targetId)
        setBearings((prev) => prev.filter((x) => x.id !== s.id))
      } else {
        await deleteMerchantHistory(s.targetId)
        setMerchants((prev) => prev.filter((x) => x.id !== s.id))
      }
      setTotal((n) => Math.max(0, n - 1))
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const rightIcons = isLoggedIn ? [{ name: 'trash-2', onClick: onClearAll }] : []
  const hasMore = (tab === 'bearing' ? bearings.length : merchants.length) < total

  /** 通用行渲染（两类历史同构） */
  const rowCard = (opts: { id: string; title: string; sub: string; targetId: string; onPress: () => void }) => {
    const checked = sel.selected.includes(opts.id)
    const actions: SwipeCellAction[] = sel.selectMode ? [] : [{ key: 'delete', label: '删除', color: '#FFFFFF', bg: t.danger, onPress: () => void onDeleteOneFromSheet({ id: opts.id, label: opts.title, targetId: opts.targetId }) }]
    const card = (
      <View
        style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}
        onLongPress={() => { if (!sel.selectMode) setSheetFor({ id: opts.id, label: opts.title, targetId: opts.targetId }) }}
        onClick={() => {
          if (sel.selectMode) { sel.toggle(opts.id); return }
          opts.onPress()
        }}
      >
        {sel.selectMode && (
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: checked ? t.primary : t.textTertiary, backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            {checked ? <Icon name='check' size={13} color='#FFFFFF' /> : null}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ ...fs(16), color: t.textPrimary }}>{opts.title}</Text>
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{opts.sub}</Text>
        </View>
        {!sel.selectMode ? <Icon name="chevron-right" size={16} color={t.textTertiary} /> : null}
      </View>
    )
    return sel.selectMode ? (
      <View key={opts.id}>{card}</View>
    ) : (
      <SwipeCell key={opts.id} actions={actions} opened={openedId === opts.id} onOpenChange={(o) => setOpenedId(o ? opts.id : null)} radius={0}>
        {card}
      </SwipeCell>
    )
  }

  return (
    <PageLayout nav={<NavBar title="浏览历史" showBack rightIcons={rightIcons} />}>
      {/* 主 tab：轴承|商家（不同实体保留 tab，符合列表规范分层原则） */}
      <View style={{ display: 'flex', flexDirection: 'row', backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {([
          { key: 'bearing', label: '轴承' },
          { key: 'merchant', label: '商家' }
        ] as const).map((tb) => (
          <View
            key={tb.key}
            style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: tab === tb.key ? t.primary : 'transparent' }}
            onClick={() => switchTab(tb.key)}
          >
            <Text style={{ ...fs(15), color: tab === tb.key ? t.primaryText : t.textSecondary }}>{tb.label}</Text>
          </View>
        ))}
      </View>

      {!isLoggedIn && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 80 }}>
          <Icon name="clock" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>登录后可查看浏览历史</Text>
          <View
            style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, marginTop: 16 }}
            onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          >
            <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
          </View>
        </View>
      )}
      {isLoggedIn && (tab === 'bearing' ? bearings.length === 0 : merchants.length === 0) && !loading && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 80 }}>
          <Icon name="clock" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>暂无浏览记录</Text>
        </View>
      )}
      {tab === 'bearing' && bearings.map((item) => rowCard({
        id: item.id,
        title: item.bearingPartNumber,
        sub: `${item.brandName ? `${item.brandName} · ` : ''}浏览 ${item.viewCount} 次 · ${formatTime(item.viewedAt)}`,
        targetId: item.bearingId,
        onPress: () => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${item.bearingId}` }),
      }))}
      {tab === 'merchant' && merchants.map((item) => rowCard({
        id: item.id,
        title: item.merchantName,
        sub: `${item.companyName ? `${item.companyName} · ` : ''}浏览 ${item.viewCount} 次 · ${formatTime(item.viewedAt)}`,
        targetId: item.merchantId,
        onPress: () => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${item.merchantId}` }),
      }))}
      <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="删除" onAction={() => void onBatchDelete()} onExit={sel.exit} />
      {isLoggedIn && hasMore && (
        <View style={{ display: 'flex', alignItems: 'center', paddingTop: 14, paddingBottom: 14 }} onClick={() => { if (!loading) load(page + 1, true) }}>
          <Text style={{ ...fs(14), color: t.primaryText }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
      <ListActionSheet visible={!!sheetFor} title={sheetFor ? sheetFor.label : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />
    </PageLayout>
  )
}
