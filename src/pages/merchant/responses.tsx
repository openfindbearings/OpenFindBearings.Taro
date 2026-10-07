// 商家寻货管理页（v1.7.19 寻货应答，v2.12.0 升级双 tab）：
// 「我应答的」= 当前商户对寻货的应答记录（需求快照+应答状态）；
// 「我发布的」= 商户名义发布的寻货单（全员可见，管理操作仅经办人——详情页按 isPublisher 出按钮）。
// 入口：商家 Tab 已入驻功能区。
import { useState } from 'react'
import { View, Text} from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMySourcingResponses, getMerchantSourcingDemands, responseStatusText, demandStatusText, getOpportunities,
  RESPONSE_STATUS, DEMAND_STATUS, type SourcingMerchantResponse, type SourcingMerchantDemand, type OpportunityItem,
} from '../../services/sourcing'
import { setItem } from '../../utils/storage'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 商家寻货管理页（我应答的｜我发布的） */
export default function MerchantResponsesPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [items, setItems] = useState<SourcingMerchantResponse[]>([])
  // v2.12.0 商户名义发布的单（"我发布的" tab）
  const [demands, setDemands] = useState<SourcingMerchantDemand[]>([])
  // 需求信号（v1.7.21 反向导购）：在售型号中被寻货且未应答的聚合，失败静默隐藏
  const [opps, setOpps] = useState<OpportunityItem[]>([])
  // 改动说明（v1.7.29 分组收敛）：子 tab 进行中|已结束——终态（选定/未选中/需求关闭）不与待处理混排
  const [gTab, setGTab] = useState<'open' | 'closed'>('open')
  // v2.12.0 主 tab：responses=我应答的（存量习惯首位）| demands=我发布的
  const [mTab, setMTab] = useState<'responses' | 'demands'>('responses')

  useDidShow(() => {
    if (currentMerchant) {
      void getMySourcingResponses().then((r) => setItems(r || []))
      // 商户名义单列表（失败静默空态，不阻塞应答 tab）
      void getMerchantSourcingDemands().then((r) => setDemands(r || [])).catch(() => { /* 降级空列表 */ })
      void getOpportunities().then(setOpps)
    }
  })

  // 进行中=应答待处理且需求仍开放（demandStatus 缺失按乐观归进行中）；其余归已结束
  const isOpen = (it: SourcingMerchantResponse) =>
    it.status === RESPONSE_STATUS.pending && (it.demandStatus == null || it.demandStatus === DEMAND_STATUS.published)
  const openCount = items.filter(isOpen).length
  const shown = items.filter((it) => (gTab === 'open' ? isOpen(it) : !isOpen(it)))

  return (
    <PageLayout nav={<NavBar title='寻货管理' onBack={() => Taro.navigateBack()} showBack />}>
      <View>
        {!currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
        {/* v2.12.0 主 tab：我应答的｜我发布的（商户寻货的两个动作对称管理） */}
        {currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'row', marginLeft: 12, marginRight: 12, marginTop: 12 }}>
            {([
              { key: 'responses' as const, label: `我应答的 ${items.length}` },
              { key: 'demands' as const, label: `我发布的 ${demands.length}` },
            ]).map((tb) => (
              <View
                key={tb.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, borderRadius: 16, marginRight: 8,
                  backgroundColor: mTab === tb.key ? t.primary : t.bgInput,
                }}
                onClick={() => setMTab(tb.key)}
              >
                <Text style={{ ...fs(14), color: mTab === tb.key ? '#FFFFFF' : t.textSecondary }}>{tb.label}</Text>
              </View>
            ))}
          </View>
        )}
        {mTab === 'responses' && (<>
        {/* 需求信号横幅（v1.7.21 反向导购）：你在售的型号正被寻货且无人应答 */}
        {currentMerchant && opps.length > 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', marginLeft: 12, marginRight: 12, marginTop: 12, padding: 12, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="trending-up" size={16} color={t.warning} />
              <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600', marginLeft: 6 }}>
                你的在售型号有 {opps.reduce((s, o) => s + o.demandCount, 0)} 条寻货待应答
              </Text>
            </View>
            {opps.slice(0, 5).map((o) => (
              <View
                key={o.partNumber}
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}
                onClick={() => {
                  // switchTab 不能带 query——搜索词经 storage 传给发现页消费
                  void setItem('sourcing_search_kw', o.partNumber)
                  void Taro.switchTab({ url: '/pages/discover/index' })
                }}
              >
                <Text style={{ ...fs(13), color: t.primary }}>{o.partNumber}</Text>
                <Text style={{ ...fs(12), color: t.textTertiary }}>{o.demandCount} 条寻货 · 去应答 ›</Text>
              </View>
            ))}
          </View>
        )}
        {currentMerchant && items.length > 0 && (
          <View style={{ display: 'flex', flexDirection: 'row', marginLeft: 12, marginRight: 12, marginTop: 12 }}>
            {([
              { key: 'open' as const, label: `进行中 ${openCount}` },
              { key: 'closed' as const, label: `已结束 ${items.length - openCount}` },
            ]).map((tb) => (
              <View
                key={tb.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5, borderRadius: 15, marginRight: 8,
                  backgroundColor: gTab === tb.key ? t.primary : t.bgInput,
                }}
                onClick={() => setGTab(tb.key)}
              >
                <Text style={{ ...fs(13), color: gTab === tb.key ? '#FFFFFF' : t.textSecondary }}>{tb.label}</Text>
              </View>
            ))}
          </View>
        )}
        {currentMerchant && items.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              还没有应答过寻货，去"发现"页看看有没有能供的货
            </Text>
          </View>
        )}
        {currentMerchant && items.length > 0 && shown.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              {gTab === 'open' ? '没有进行中的应答' : '还没有已结束的应答'}
            </Text>
          </View>
        )}
        {shown.map((item, i) => {
          const adopted = item.status === RESPONSE_STATUS.adopted
          return (
            <View
              key={item.id}
              style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
              onClick={() => Taro.navigateTo({ url: `/pages/discover/detail?id=${item.demandId}` })}
            >
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  寻 {item.partNumber || '已删除的寻货'}
                </Text>
                <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: adopted ? t.primaryLight : t.bgInput }}>
                  <Text style={{ ...fs(11), color: adopted ? t.primary : t.textTertiary }}>{responseStatusText(item.status)}</Text>
                </View>
              </View>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }} numberOfLines={1}>
                {item.items && item.items.length > 0
                  ? `${item.items.length} 个型号 · ${[item.items[0].price != null ? `¥${item.items[0].price}/只` : null, item.items[0].stock ? `库存 ${item.items[0].stock}` : null].filter(Boolean).join(' · ') || '可详谈'}`
                  : item.remark}
              </Text>
              {adopted && (
                <Text style={{ ...fs(12), color: t.primary, marginTop: 4 }}>已被选定，进详情查看需求方联系方式</Text>
              )}
            </View>
          )
        })}
        </>)}
        {/* v2.12.0 "我发布的"：商户名义寻货单（全员可见；选定/取消等管理操作进详情，按经办人身份出按钮） */}
        {mTab === 'demands' && demands.length === 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Icon name='clipboard-list' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12, paddingLeft: 32, paddingRight: 32, textAlign: 'center' }}>
              还没有以商户名义发布的寻货，去"发现"页点发布，提交时选商户名义
            </Text>
          </View>
        )}
        {mTab === 'demands' && demands.map((item, i) => {
          const open = item.status === DEMAND_STATUS.published
          return (
            <View
              key={item.id}
              style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
              onClick={() => Taro.navigateTo({ url: `/pages/discover/detail?id=${item.id}` })}
            >
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
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
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }} numberOfLines={1}>
                {[item.brand, item.quantity].filter(Boolean).join(' · ') || '—'} · {item.responseCount} 条应答
              </Text>
              {/* 经办人标识：管理操作仅经办人本人（详情页按钮按 isPublisher 显隐） */}
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                {item.isMine ? '由我发布 · 进详情可选定或取消' : `由 ${item.publisherName || '成员'} 发布 · 进详情可查看`}
              </Text>
            </View>
          )
        })}
        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
