// 我的寻货页（v1.7.19）：个人名义发布的寻货列表（全状态倒序），点击进详情。
// v2.10.0 寻货置顶：进行中的需求可购买"寻货置顶卡"（24h/72h，个人轴承币支付）
// v2.12.0 列表统一改造：① 子 tab 换状态 chips（全部/进行中/已选定/已取消/已过期/已下架）；
//   ② 三级手势删除——左滑单删（SwipeCell）/长按上下文菜单（ListActionSheet）/多选批量（useListSelection+BatchBar），
//   仅终态单可删（进行中须先取消走通知流程）；③ 商户名义单已归商户工作台（后端过滤，本页恒个人单，徽章死码移除）
import { useState } from 'react'
import { View, Text} from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import NavBar from '../../components/NavBar'
import SwipeCell, { type SwipeCellAction } from '../../components/SwipeCell'
import ListChips from '../../components/ListKit/ListChips'
import ListActionSheet, { type ListSheetAction } from '../../components/ListKit/ListActionSheet'
import BatchBar from '../../components/ListKit/BatchBar'
import { useListSelection } from '../../components/ListKit/useListSelection'
import { useLongPressMenu } from '../../components/ListKit/useLongPressMenu'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useAuthStore } from '../../stores/auth'
import { getMySourcingDemands, batchDeleteDemands, demandStatusText, DEMAND_STATUS, type SourcingMyDemand } from '../../services/sourcing'
import { getMallItems, redeemMallItem, MALL_CATEGORY, type MallItem } from '../../services/mall'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 状态 chips 定义（与 DEMAND_STATUS 常量对齐） */
const CHIPS = [
  { key: 'all', label: '全部' },
  { key: '1', label: '进行中' },
  { key: '2', label: '已选定' },
  { key: '4', label: '已取消' },
  { key: '3', label: '已过期' },
  { key: '5', label: '已下架' },
]

/** 我的寻货页 */
export default function MySourcingPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [items, setItems] = useState<SourcingMyDemand[]>([])
  // v2.12.0 状态筛选 chips（取代"进行中|已结束"二分 tab——同类型数据状态一律 chips）
  const [chip, setChip] = useState('all')
  // 左滑互斥（同通知页模式：同时只展开一个）
  const [openedId, setOpenedId] = useState<string | null>(null)
  // 长按上下文菜单目标
  const [sheetFor, setSheetFor] = useState<SourcingMyDemand | null>(null)
  // 长按菜单走"松手才弹"安全封装（RN 按住即 setState 会触发 UI 队列竞态崩溃）
  const menuHandlers = useLongPressMenu<SourcingMyDemand>(setSheetFor)
  // 多选模式
  const sel = useListSelection()
  // v2.10.0 寻货置顶：选卡弹层状态（选中需求 + 需求置顶卡目录）
  const [pinFor, setPinFor] = useState<SourcingMyDemand | null>(null)
  const [demandPins, setDemandPins] = useState<MallItem[]>([])
  const [pinning, setPinning] = useState(false)

  const reload = () => { void getMySourcingDemands().then((r) => setItems(r || [])) }
  useDidShow(() => {
    if (isLoggedIn) reload()
  })

  // 打开选卡弹层：懒加载需求置顶卡目录（TargetKind=2 且未兑完）
  const openPinPicker = async (item: SourcingMyDemand) => {
    setPinFor(item)
    if (demandPins.length === 0) {
      const cat = await getMallItems().catch(() => null)
      setDemandPins((cat?.items || []).filter((i) => i.category === MALL_CATEGORY.PIN_CARD && (i.targetKind ?? 1) === 2 && !i.soldOut))
    }
  }

  // 兑换置顶卡：requestId 幂等键带需求与时间戳防重复提交
  const doPin = async (card: MallItem) => {
    if (!pinFor || pinning) return
    setPinning(true)
    try {
      await redeemMallItem(card.id, pinFor.id, `dpin-${pinFor.id}-${Date.now()}`)
      Taro.showToast({ title: '已置顶，大厅可见', icon: 'success' })
      setPinFor(null)
      reload()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '置顶失败，稍后再试', icon: 'none' })
    } finally {
      setPinning(false)
    }
  }

  /** 是否终态（可删）：非进行中 */
  const isClosed = (it: SourcingMyDemand) => it.status !== DEMAND_STATUS.published

  /** 删除执行（单删/批删共用）：二次确认 → batchDelete → 刷新 */
  const doDelete = async (ids: string[]) => {
    const ok = await showConfirmDialog({
      title: '删除寻货记录',
      content: ids.length === 1 ? '删除后该记录从列表移除，应答数据保留。确认删除？' : `确认删除选中的 ${ids.length} 条寻货记录？`,
      confirmText: '删除',
      confirmColor: t.danger,
    })
    if (!ok) return
    // 改动说明（v2.12.0）：包 try/catch——网络/服务端失败转 toast 提示，
    // 不再冒泡成 RN LogBox "Unhandled Promise Rejection" 弹层
    try {
      const r = await batchDeleteDemands(ids)
      if (r.deleted > 0) {
        Taro.showToast({ title: r.skipped > 0 ? `已删 ${r.deleted} 条，${r.skipped} 条进行中未删` : '已删除', icon: 'none' })
      } else {
        Taro.showToast({ title: '没有可删除的记录（进行中请先取消）', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
    }
    sel.reset()
    reload()
  }

  // 长按菜单动作（终态单：删除/多选）
  const sheetActions: ListSheetAction[] = sheetFor
    ? [
      { key: 'delete', label: '删除记录', danger: true, icon: 'trash-2', onPress: () => void doDelete([sheetFor.id]) },
      { key: 'multi', label: '多选', icon: 'list-checks', onPress: () => sel.enter(sheetFor.id) },
    ]
    : []

  // 左滑动作（仅终态单出删除）
  const swipeActions = (item: SourcingMyDemand): SwipeCellAction[] =>
    isClosed(item)
      ? [{ key: 'delete', label: '删除', color: '#FFFFFF', bg: t.danger, onPress: () => void doDelete([item.id]) }]
      : []

  const shown = items.filter((it) => chip === 'all' || String(it.status) === chip)

  return (
    <PageLayout nav={<NavBar title='我的寻货' onBack={() => Taro.navigateBack()} showBack />}>
      <View>
        {!isLoggedIn && <LoginGuide icon="compass" text="登录后可查看我发布的寻货" />}
        {/* v2.12.0 状态 chips（有数据才出） */}
        {isLoggedIn && items.length > 0 && <ListChips items={CHIPS} active={chip} onChange={setChip} />}
        {isLoggedIn && items.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>还没有发布过寻货，去"发现"页发一条吧</Text>
          </View>
        )}
        {isLoggedIn && items.length > 0 && shown.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>该状态下暂无寻货</Text>
          </View>
        )}
        {shown.map((item, i) => {
          const open = !isClosed(item)
          const checked = sel.selected.includes(item.id)
          const card = (
            <View
              style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
              {...menuHandlers(item, !sel.selectMode && isClosed(item))}
              onClick={() => {
                if (sel.selectMode) { if (isClosed(item)) sel.toggle(item.id); return }
                Taro.navigateTo({ url: `/pages/discover/detail?id=${item.id}` })
              }}
            >
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                {/* 多选模式勾选框（终态单可勾，进行中灰态不可选） */}
                {sel.selectMode && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: checked ? t.primary : (isClosed(item) ? t.textTertiary : t.border), backgroundColor: checked ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
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
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ ...fs(13), color: t.textTertiary, flex: 1 }}>
                  {[item.brand, item.quantity].filter(Boolean).join(' · ') || '—'} · {item.responseCount} 条应答
                </Text>
                {/* v2.10.0 寻货置顶：进行中的需求才出置顶按钮（点按不冒泡进详情；多选模式隐藏） */}
                {open && !sel.selectMode && (
                  <View
                    onClick={(e) => { e?.stopPropagation?.(); void openPinPicker(item) }}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 14, borderWidth: 1, borderColor: t.primary }}
                  >
                    <Icon name='arrow-up-circle' size={13} color={t.primary} />
                    <Text style={{ ...fs(12), color: t.primary, marginLeft: 3 }}>{item.isPinned ? '续置顶' : '置顶'}</Text>
                  </View>
                )}
              </View>
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
        {/* v2.12.0 多选批量条（列表尾，RN 无 fixed） */}
        <BatchBar visible={sel.selectMode} count={sel.count} actionLabel="删除" onAction={() => void doDelete(sel.selected)} onExit={sel.exit} />
        <View style={{ height: 30 }} />
      </View>

      {/* v2.12.0 长按上下文菜单 */}
      <ListActionSheet visible={!!sheetFor} title={sheetFor ? `寻 ${sheetFor.partNumber}` : undefined} actions={sheetActions} onClose={() => setSheetFor(null)} />

      {/* v2.10.0 寻货置顶：选卡弹层 */}
      {pinFor && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', display: 'flex' }}>
          <View style={{ backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '700' }}>置顶这条寻货</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>寻 {pinFor.partNumber} · 将用个人轴承币支付</Text>
            {demandPins.length === 0 && (
              <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 16 }}>暂无可购买的寻货置顶卡</Text>
            )}
            {demandPins.map((card) => (
              <View
                key={card.id}
                onClick={() => void doPin(card)}
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.borderColor, backgroundColor: t.bgMain }}
              >
                <Icon name={card.icon || 'arrow-up-circle'} size={20} color={t.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>{card.name}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{card.description}</Text>
                </View>
                <Text style={{ ...fs(15), color: t.primary, fontWeight: '700' }}>{card.price} 轴承币</Text>
              </View>
            ))}
            <View
              onClick={() => setPinFor(null)}
              style={{ marginTop: 14, display: 'flex', alignItems: 'center', padding: 10 }}
            >
              <Text style={{ ...fs(14), color: t.textTertiary }}>{pinning ? '提交中…' : '取消'}</Text>
            </View>
          </View>
        </View>
      )}
    </PageLayout>
  )
}
