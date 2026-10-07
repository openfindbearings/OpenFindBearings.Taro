// 商家寻货应答页（v1.7.19）：当前商户对寻货的应答记录（应答=商家行为，归属商户），
// 展示需求快照与应答状态（待处理/已选定/未选中），点击进详情。入口：商家 Tab 功能宫格。
// v2.12.0 双体系拆分：原"寻货管理"双 tab 中的"我发布的"独立成 pages/merchant/demands（宫格并列入口）；
// 本页回归纯应答列表，"进行中|已结束"子 tab 换状态 chips（全部/待处理/已选定/未选中）
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
  getMySourcingResponses, responseStatusText, getOpportunities,
  RESPONSE_STATUS, DEMAND_STATUS, type SourcingMerchantResponse, type OpportunityItem,
} from '../../services/sourcing'
import { setItem } from '../../utils/storage'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 应答状态 chips（应答三态：待处理/已选定/未选中；需求关闭的归入对应应答状态展示） */
const CHIPS = [
  { key: 'all', label: '全部' },
  { key: '1', label: '待处理' },
  { key: '2', label: '已选定' },
  { key: '3', label: '未选中' },
]

/** 商家寻货应答页 */
export default function MerchantResponsesPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [items, setItems] = useState<SourcingMerchantResponse[]>([])
  // 需求信号（v1.7.21 反向导购）：在售型号中被寻货且未应答的聚合，失败静默隐藏
  const [opps, setOpps] = useState<OpportunityItem[]>([])
  // v2.12.0 状态 chips（取代"进行中|已结束"二分）
  const [chip, setChip] = useState('all')

  useDidShow(() => {
    if (currentMerchant) {
      void getMySourcingResponses().then((r) => setItems(r || []))
      void getOpportunities().then(setOpps)
    }
  })

  const shown = items.filter((it) => chip === 'all' || String(it.status) === chip)

  return (
    <PageLayout nav={<NavBar title='寻货应答' onBack={() => Taro.navigateBack()} showBack />}>
      <View>
        {!currentMerchant && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
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
        {currentMerchant && items.length > 0 && <ListChips items={CHIPS} active={chip} onChange={setChip} />}
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
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>该状态下暂无应答</Text>
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
        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
