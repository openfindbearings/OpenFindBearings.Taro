// 商家寻货应答页（v1.7.19）：商家作为货源方，对寻货的应答与可应答线索。
// v2.24.0 信息架构归位：「为你匹配」（原在寻货发布页）并入本页——
//   待应答 = 点名邀请我的单 + 匹配我在售型号的进行中公开单（顶部另有在售型号聚合摘要）；
//   我的应答 = 本商户已提交的应答，待处理在上，已选定/未选中收进底部"已结束 N 条"折叠区。
// 入口：商家 Tab 功能宫格。
import { useState } from 'react'
import { View, Text} from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import ListChips from '../../components/ListKit/ListChips'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMySourcingResponses, responseStatusText, getOpportunities, getMatchedDemands,
  RESPONSE_STATUS, type SourcingMerchantResponse, type OpportunityItem, type MatchedDemand,
} from '../../services/sourcing'
import { setItem } from '../../utils/storage'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/**
 * 页面两条主线（v2.24.0）：待应答=我该去报价的货源线索；我的应答=已提交的报价记录。
 */
const TABS = [
  { key: 'todo', label: '待应答' },
  { key: 'mine', label: '我的应答' },
]

/** 商家寻货应答页 */
export default function MerchantResponsesPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [tab, setTab] = useState<'todo' | 'mine'>('todo')
  const [items, setItems] = useState<SourcingMerchantResponse[]>([])
  // 需求信号（v1.7.21 反向导购）：在售型号中被寻货且未应答的聚合，失败静默隐藏
  const [opps, setOpps] = useState<OpportunityItem[]>([])
  // 为你匹配的单条线索（v2.24.0 从寻货发布页迁入）
  const [matched, setMatched] = useState<MatchedDemand[]>([])
  // 终态折叠区展开态：null 表示用户未操作过，按条数自动决定（<=3 条直接展开）
  const [endedToggle, setEndedToggle] = useState<boolean | null>(null)

  useDidShow(() => {
    if (currentMerchant) {
      void getMySourcingResponses().then((r) => setItems(r || []))
      void getOpportunities().then(setOpps)
      void getMatchedDemands().then(setMatched)
    }
  })

  // 我的应答拆分：待处理直接铺开，已选定/未选中进底部折叠区
  const pending = items.filter((it) => it.status === RESPONSE_STATUS.pending)
  const ended = items.filter((it) => it.status !== RESPONSE_STATUS.pending)
  const endedExpanded = endedToggle ?? ended.length <= 3

  /** 渲染单条应答卡（待处理与终态共用，已选定项额外给会话入口） */
  const renderResponseCard = (item: SourcingMerchantResponse, first: boolean) => {
    const adopted = item.status === RESPONSE_STATUS.adopted
    return (
      <View
        key={item.id}
        style={{ marginLeft: 12, marginRight: 12, marginTop: first ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
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
          <Text style={{ ...fs(12), color: t.primary, marginTop: 4 }}>已被选定，可进详情或直接发起会话沟通</Text>
        )}
        {/* 改动说明（v2.18.0 T1 会话入口）：商家侧列表就地进会话；
            电话单向（商家看不到需求方号码），会话是主要沟通通道 */}
        {adopted && currentMerchant ? (
          <View
            style={{ alignSelf: 'flex-start', marginTop: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6, borderRadius: 16, backgroundColor: t.primaryLight }}
            onClick={(e) => {
              e?.stopPropagation?.()
              Taro.navigateTo({ url: `/pages/discover/chat?demandId=${item.demandId}&merchantId=${currentMerchant.merchantId}` })
            }}
          >
            <Text style={{ ...fs(12), color: t.primary, fontWeight: '600' }}>发起会话</Text>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <PageLayout nav={<NavBar title='寻货应答' onBack={() => Taro.navigateBack()} showBack />}>
      <View>
        {!currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
        {currentMerchant && <ListChips items={TABS} active={tab} onChange={(k) => setTab(k as 'todo' | 'mine')} />}

        {/* ===== 待应答（v2.24.0 并入原"为你匹配"）：聚合摘要 + 单条线索 ===== */}
        {currentMerchant && tab === 'todo' && (
          <View>
            {opps.length > 0 && (
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
            {matched.map((d, i) => (
              <View
                key={d.id}
                style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
                onClick={() => Taro.navigateTo({ url: `/pages/discover/detail?id=${d.id}` })}
              >
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>寻 {d.partNumber}</Text>
                  {d.isPrivate && (
                    <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: t.primaryLight, marginRight: 6 }}>
                      <Text style={{ ...fs(10), color: t.primary, fontWeight: '700' }}>邀请</Text>
                    </View>
                  )}
                </View>
                <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 6 }} numberOfLines={1}>
                  {[d.brand, d.quantity, d.region].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            ))}
            {matched.length === 0 && opps.length === 0 && (
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
                <Icon name='search' size={40} color={t.textTertiary} />
                <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12, paddingLeft: 32, paddingRight: 32, textAlign: 'center' }}>
                  暂无为你匹配的寻货——买家寻货型号与你在售一致、或买家邀请你报价时会出现在这里
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ===== 我的应答：待处理铺开，终态收进底部折叠区 ===== */}
        {currentMerchant && tab === 'mine' && (
          <View>
            {items.length === 0 && (
              <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
                <Icon name='compass' size={40} color={t.textTertiary} />
                <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
                  还没有应答过寻货，去"待应答"看看有没有能供的货
                </Text>
              </View>
            )}
            {pending.map((item, i) => renderResponseCard(item, i === 0))}
            {/* 终态折叠区（v2.24.0 滴滴历史行程式）：默认收起，条数少时直接展开 */}
            {ended.length > 0 && (
              <View
                onClick={() => setEndedToggle(!endedExpanded)}
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginRight: 12, marginTop: 12, paddingTop: 12, paddingBottom: 12, backgroundColor: t.bgCard, borderRadius: 12 }}
              >
                <Text style={{ ...fs(13), color: t.textSecondary }}>已结束 {ended.length} 条</Text>
                <View style={{ marginLeft: 4, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={endedExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={t.textTertiary} />
                </View>
              </View>
            )}
            {endedExpanded && ended.map((item) => renderResponseCard(item, false))}
          </View>
        )}
        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
