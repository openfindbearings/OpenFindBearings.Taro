// 我的寻货页（v1.7.19）：个人用户发布的寻货列表（全状态倒序），点击进详情。
// 八格"我的寻货"入口落地（原占位 toast）
// v2.10.0 寻货置顶：进行中的需求可购买"寻货置顶卡"（24h/72h，个人轴承币支付），
// 兑换成功后该需求在公开大厅排前并带角标
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { getMySourcingDemands, demandStatusText, DEMAND_STATUS, type SourcingMyDemand } from '../../services/sourcing'
import { getMallItems, redeemMallItem, MALL_CATEGORY, type MallItem } from '../../services/mall'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 我的寻货页 */
export default function MySourcingPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [items, setItems] = useState<SourcingMyDemand[]>([])
  // v2.10.0 寻货置顶：选卡弹层状态（选中需求 + 需求置顶卡目录）
  const [pinFor, setPinFor] = useState<SourcingMyDemand | null>(null)
  const [demandPins, setDemandPins] = useState<MallItem[]>([])
  const [pinning, setPinning] = useState(false)

  useDidShow(() => {
    if (isLoggedIn) void getMySourcingDemands().then((r) => setItems(r || []))
  })

  // 打开选卡弹层：懒加载需求置顶卡目录（TargetKind=2 且未兑完）
  const openPinPicker = async (item: SourcingMyDemand) => {
    setPinFor(item)
    if (demandPins.length === 0) {
      const cat = await getMallItems().catch(() => null)
      setDemandPins((cat?.items || []).filter((i) => i.category === MALL_CATEGORY.PIN_CARD && (i.targetKind ?? 1) === 2 && !i.soldOut))
    }
  }

  // 兑换置顶卡：requestId 幂等键带需求与时间戳防重复提交；
  // request 层失败抛后端 message（轴承币不足/越权），此处 catch 转 toast
  const doPin = async (card: MallItem) => {
    if (!pinFor || pinning) return
    setPinning(true)
    try {
      await redeemMallItem(card.id, pinFor.id, `dpin-${pinFor.id}-${Date.now()}`)
      Taro.showToast({ title: '已置顶，大厅可见', icon: 'success' })
      setPinFor(null)
      void getMySourcingDemands().then((rr) => setItems(rr || []))
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '置顶失败，稍后再试', icon: 'none' })
    } finally {
      setPinning(false)
    }
  }

  return (
    <PageLayout nav={<NavBar title='我的寻货' onBack={() => Taro.navigateBack()} showBack />}>
      <ScrollView style={{ flex: 1 }}>
        {!isLoggedIn && <LoginGuide icon="compass" text="登录后可查看我发布的寻货" />}
        {isLoggedIn && items.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>还没有发布过寻货，去"发现"页发一条吧</Text>
          </View>
        )}
        {items.map((item, i) => {
          const open = item.status === DEMAND_STATUS.published
          return (
            <View
              key={item.id}
              style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
              onClick={() => Taro.navigateTo({ url: `/pages/discover/detail?id=${item.id}` })}
            >
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
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
                {/* v2.10.0 寻货置顶：进行中的需求才出置顶按钮（点按不冒泡进详情） */}
                {open && (
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
        })}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* v2.10.0 寻货置顶：选卡弹层（遮罩自绘，RN 兼容无 fixed——用全屏绝对定位替代方案：ScrollView 内浮层高度 100%） */}
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
