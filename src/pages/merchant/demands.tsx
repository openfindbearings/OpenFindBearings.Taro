// 商户寻货发布页（v2.12.0 双体系拆分）：本店商户名义发布的寻货单（全状态倒序）。
// 权限：本店在职成员均可见；删除等管理操作仅经办人本人（终态单，左滑/长按菜单/多选三级手势，
//   与"我的寻货"同构；进行中单不可删——须由经办人在详情页取消走通知流程）。
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
import { getMerchantSourcingDemands, batchDeleteDemands, demandStatusText, DEMAND_STATUS, type SourcingMerchantDemand } from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 状态 chips（与个人"我的寻货"同构） */
const CHIPS = [
  { key: 'all', label: '全部' },
  { key: '1', label: '进行中' },
  { key: '2', label: '已选定' },
  { key: '4', label: '已取消' },
  { key: '3', label: '已过期' },
  { key: '5', label: '已下架' },
]

/** 商户寻货发布页 */
export default function MerchantDemandsPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [items, setItems] = useState<SourcingMerchantDemand[]>([])
  const [chip, setChip] = useState('all')
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<SourcingMerchantDemand | null>(null)
  // 长按菜单走"松手才弹"安全封装（RN 按住即 setState 会触发 UI 队列竞态崩溃）
  const menuHandlers = useLongPressMenu<SourcingMerchantDemand>(setSheetFor)
  const sel = useListSelection()

  const reload = () => { void getMerchantSourcingDemands().then((r) => setItems(r || [])).catch(() => { /* 降级空列表 */ }) }
  useDidShow(() => {
    if (currentMerchant) reload()
  })

  /** 该条是否可删：终态 且 经办人本人（他人发的单全员可见不可管） */
  const canDelete = (it: SourcingMerchantDemand) => it.status !== DEMAND_STATUS.published && !!it.isMine

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
        Taro.showToast({ title: '没有可删除的记录（进行中或非本人发布）', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
    }
    sel.reset()
    reload()
  }

  // 长按上下文菜单（仅本人终态单可删；他人单只给"查看"引导——不弹菜单）
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

  const shown = items.filter((it) => chip === 'all' || String(it.status) === chip)

  return (
    <PageLayout nav={<NavBar title='寻货发布' onBack={() => Taro.navigateBack()} showBack />} overlay={<ListActionSheet visible={!!sheetFor} title={sheetFor ? `寻 ${sheetFor.partNumber}` : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />}>
      <View>
        {!currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
        {currentMerchant && items.length > 0 && <ListChips items={CHIPS} active={chip} onChange={setChip} />}
        {currentMerchant && items.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='clipboard-list' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12, paddingLeft: 32, paddingRight: 32, textAlign: 'center' }}>
              还没有以商户名义发布的寻货，去"发现"页点发布，提交时选商户名义
            </Text>
          </View>
        )}
        {currentMerchant && items.length > 0 && shown.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
            <Icon name='clipboard-list' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>该状态下暂无寻货</Text>
          </View>
        )}
        {shown.map((item, i) => {
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
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: checked ? t.primary : (canDelete(item) ? t.textTertiary : t.border), backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
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
                <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: open ? t.primaryLight : t.bgMain }}>
                  <Text style={{ ...fs(11), color: open ? t.primary : t.textTertiary }}>{demandStatusText(item.status)}</Text>
                </View>
              </View>
              <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 6 }} numberOfLines={1}>
                {[item.brand, item.quantity].filter(Boolean).join(' · ') || '—'} · {item.responseCount} 条应答
              </Text>
              {/* 经办人标识（管理操作仅经办人本人） */}
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {item.isMine ? '由我发布' : `由 ${item.publisherName || '成员'} 发布`}
              </Text>
            </View>
          )
          return sel.selectMode ? (
            <View key={item.id} style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8 }}>
              {card}
            </View>
          ) : (
            <SwipeCell
              key={item.id}
              actions={swipeActions(item)}
              opened={openedId === item.id}
              onOpenChange={(o) => setOpenedId(o ? item.id : null)}
              radius={12}
              containerStyle={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, marginBottom: 0 }}
            >
              {card}
            </SwipeCell>
          )
        })}
        <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="删除" onAction={() => void doDelete(sel.selected)} onExit={sel.exit} />
        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
