// 商户寻货发布页（v2.24.0 信息架构归位）：只保留"本店商户名义发布的寻货单"（全状态倒序）。
// 语义：这里是商家以买家身份串货/补货的单；"为你匹配"（可应答的货源线索）已迁到寻货应答页。
// 展示：进行中单直接铺开；终态单收进列表底部"已结束 N 条"折叠区（滴滴历史行程式，默认收起，<=3 条时直接展开）。
// 权限：本店在职成员均可见；管理操作（删除/转公开/多选）限经办人本人或本店在职管理员（服务端 canManage）。
import { useState } from 'react'
import { View, Text} from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import ListChips from '../../components/ListKit/ListChips'
import ListActionSheet, { type ListSheetAction } from '../../components/ListKit/ListActionSheet'
import BatchBar from '../../components/ListKit/BatchBar'
import { useListSelection } from '../../components/ListKit/useListSelection'
import { useLongPressMenu } from '../../components/ListKit/useLongPressMenu'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useMerchantStore } from '../../stores/merchant'
import { getMerchantSourcingDemands, batchDeleteDemands, publishDemandAsPublic, demandStatusText, DEMAND_STATUS, type SourcingMerchantDemand } from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/**
 * 经办范围筛选（v2.24.0）：本店单默认全部可见，日常跟进时切到"我经办的"只看自己名下的。
 */
const FILTER_CHIPS = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我经办的' },
]

/** 商户寻货发布页 */
export default function MerchantDemandsPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [items, setItems] = useState<SourcingMerchantDemand[]>([])
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  // 终态折叠区展开态：null 表示用户未操作过，按条数自动决定（<=3 条直接展开）
  const [endedToggle, setEndedToggle] = useState<boolean | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<SourcingMerchantDemand | null>(null)
  // 长按菜单走"松手才弹"安全封装（RN 按住即 setState 会触发 UI 队列竞态崩溃）
  const menuHandlers = useLongPressMenu<SourcingMerchantDemand>(setSheetFor)
  const sel = useListSelection()

  const reload = () => {
    void getMerchantSourcingDemands().then((r) => setItems(r || [])).catch(() => { /* 降级空列表 */ })
  }
  useDidShow(() => {
    if (currentMerchant) reload()
  })

  /**
   * 管理权判定（v2.24.0）：服务端 canManage = 经办人本人 或 本店在职管理员；
   * 兼容旧字段 isMine（canManage 缺省时退回本人判定）。
   */
  const canManage = (it: SourcingMerchantDemand) => it.canManage ?? !!it.isMine

  /** 该条是否可删：终态 且 有管理权（进行中须先取消走通知流程） */
  const canDelete = (it: SourcingMerchantDemand) => it.status !== DEMAND_STATUS.published && canManage(it)

  /** 删除执行（单删/批删共用） */
  const doDelete = async (ids: string[]) => {
    const ok = await showConfirmDialog({
      title: '删除寻货记录',
      content: ids.length === 1 ? '删除后该记录从本店列表移除，应答数据保留。确认删除？' : `确认删除选中的 ${ids.length} 条寻货记录？`,
      confirmText: '删除',
      confirmColor: t.danger,
    })
    if (!ok) return
    // 改动说明（v2.12.0）：包 try/catch——失败转 toast，不冒泡成 RN LogBox 未处理拒绝弹层
    try {
      const r = await batchDeleteDemands(ids)
      if (r.deleted > 0) {
        Taro.showToast({ title: r.skipped > 0 ? `已删 ${r.deleted} 条，${r.skipped} 条不可删` : '已删除', icon: 'none' })
      } else {
        Taro.showToast({ title: '没有可删除的记录（进行中或无管理权限）', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
    }
    sel.reset()
    reload()
  }

  /**
   * 转为公开（v1.8.0 公开/邀请）：本店名义的邀请单无人应答时放开进大厅，
   * 免去"取消重建"（发布额度与积分不退还）；经办人或本店管理员可操作。
   */
  const doPublishPublic = async (item: SourcingMerchantDemand) => {
    const ok = await showConfirmDialog({
      title: '转为公开',
      content: '转为公开后需求进入寻货大厅，所有商家可见可应答；原邀请商家仍可应答。确认转为公开？',
      confirmText: '转为公开',
    })
    if (!ok) return
    const r = await publishDemandAsPublic(item.id)
    if (r.success) {
      Taro.showToast({ title: '已转为公开', icon: 'none' })
      reload()
      return
    }
    Taro.showToast({ title: r.message || '操作失败，请稍后重试', icon: 'none' })
  }

  // 长按上下文菜单（有管理权的终态单可删；其余只读）
  const sheetActions: ListSheetAction[] = sheetFor
    ? [
      { key: 'delete', label: '删除记录', danger: true, icon: 'trash-2', onPress: () => void doDelete([sheetFor.id]) },
      { key: 'multi', label: '多选', icon: 'list-checks', onPress: () => sel.enter(sheetFor.id) },
    ]
    : []

  const swipeActions = (item: SourcingMerchantDemand): SwipeCellAction[] =>
    canDelete(item)
      ? [{ key: 'delete', label: '删除', color: '#FFFFFF', bg: t.danger, onPress: () => void doDelete([item.id]) }]
      : []

  // 按经办范围筛选后拆分：进行中直接铺开，终态进底部折叠区
  const scoped = items.filter((it) => filter === 'all' || it.isMine)
  const openItems = scoped.filter((it) => it.status === DEMAND_STATUS.published)
  const endedItems = scoped.filter((it) => it.status !== DEMAND_STATUS.published)
  const endedExpanded = endedToggle ?? endedItems.length <= 3

  /** 渲染单张寻货卡（进行中/终态共用，卡片样式与操作口径一致） */
  const renderCard = (item: SourcingMerchantDemand) => {
    const open = item.status === DEMAND_STATUS.published
    const checked = sel.selected.includes(item.id)
    const card = (
      <View
        style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
        {...menuHandlers(item, !sel.selectMode && canDelete(item))}
        onClick={() => {
          if (sel.selectMode) { if (canDelete(item)) sel.toggle(item.id); return }
          Taro.navigateTo({ url: `/pages/discover/detail?id=${item.id}` })
        }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          {sel.selectMode && (
            <View style={{ width: 20, height: 20, borderRadius: 10, borderStyle: 'solid', borderWidth: 1, borderColor: checked ? t.primary : (canDelete(item) ? t.textTertiary : t.border), backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              {checked ? <Icon name='check' size={13} color='#FFFFFF' /> : null}
            </View>
          )}
          <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            寻 {item.partNumber}
          </Text>
          {item.isPinned && (
            <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: t.warning, marginRight: 6 }}>
              <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: '700' }}>置顶中</Text>
            </View>
          )}
          {/* 改动说明（v1.8.0 公开/邀请）：邀请单角标 */}
          {item.isPrivate && (
            <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: t.primaryLight, marginRight: 6 }}>
              <Text style={{ ...fs(10), color: t.primary, fontWeight: '700' }}>邀请</Text>
            </View>
          )}
          <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: open ? t.primaryLight : t.bgMain }}>
            <Text style={{ ...fs(11), color: open ? t.primary : t.textTertiary }}>{demandStatusText(item.status)}</Text>
          </View>
        </View>
        <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 6 }} numberOfLines={1}>
          {[item.brand, item.quantity].filter(Boolean).join(' · ') || '—'} · {item.responseCount} 条应答
        </Text>
        {/* 经办人标识（管理操作仅经办人或本店管理员） */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ ...fs(12), color: t.textTertiary, flex: 1 }}>
            {item.isMine ? '由我发布' : `由 ${item.publisherName || '成员'} 发布`}
          </Text>
          {/* 改动说明（v1.8.0）：进行中的邀请单可转公开（canManage 已含本店管理员代办） */}
          {open && item.isPrivate && canManage(item) && !sel.selectMode && (
            <View
              onClick={(e) => { e?.stopPropagation?.(); void doPublishPublic(item) }}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 14, borderStyle: 'solid', borderWidth: 1, borderColor: t.border }}
            >
              <Text style={{ ...fs(12), color: t.textSecondary }}>转公开</Text>
            </View>
          )}
        </View>
      </View>
    )
    return card
  }

  /** 渲染带手势的单卡容器（多选态不用 SwipeCell，避免手势冲突） */
  const renderRow = (item: SourcingMerchantDemand, first: boolean) => {
    const card = renderCard(item)
    return sel.selectMode ? (
      <View key={item.id} style={{ marginLeft: 12, marginRight: 12, marginTop: first ? 12 : 8 }}>
        {card}
      </View>
    ) : (
      <SwipeCell
        key={item.id}
        actions={swipeActions(item)}
        opened={openedId === item.id}
        onOpenChange={(o) => setOpenedId(o ? item.id : null)}
        radius={12}
        containerStyle={{ marginLeft: 12, marginRight: 12, marginTop: first ? 12 : 8, marginBottom: 0 }}
      >
        {card}
      </SwipeCell>
    )
  }

  return (
    <PageLayout nav={<NavBar title='寻货发布' onBack={() => Taro.navigateBack()} showBack />} overlay={<ListActionSheet visible={!!sheetFor} title={sheetFor ? `寻 ${sheetFor.partNumber}` : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />}>
      <View>
        {!currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
        {currentMerchant && <ListChips items={FILTER_CHIPS} active={filter} onChange={(k) => setFilter(k as 'all' | 'mine')} />}
        {currentMerchant && scoped.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='clipboard-list' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12, paddingLeft: 32, paddingRight: 32, textAlign: 'center' }}>
              {filter === 'mine'
                ? '本店暂时没有由我经办的寻货'
                : '还没有以商户名义发布的寻货，去"发现"页点发布，提交时选商户名义'}
            </Text>
          </View>
        )}
        {openItems.map((item, i) => renderRow(item, i === 0))}
        {/* 终态折叠区（v2.24.0 滴滴历史行程式）：默认收起，条数少时直接展开避免藏内容 */}
        {endedItems.length > 0 && (
          <View
            onClick={() => setEndedToggle(!endedExpanded)}
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginRight: 12, marginTop: 12, paddingTop: 12, paddingBottom: 12, backgroundColor: t.bgCard, borderRadius: 12 }}
          >
            <Text style={{ ...fs(13), color: t.textSecondary }}>已结束 {endedItems.length} 条</Text>
            <View style={{ marginLeft: 4, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Icon name={endedExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={t.textTertiary} />
            </View>
          </View>
        )}
        {endedExpanded && endedItems.map((item) => renderRow(item, false))}
        <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="删除" onAction={() => void doDelete(sel.selected)} onExit={sel.exit} />
        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
