// 商家寻货应答页（v1.7.19）：当前商户对寻货的应答记录（应答=商家行为，归属商户），
// 展示需求快照与应答状态（待处理/已选定/未选中），点击进详情。入口：商家 Tab 已入驻功能区
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMySourcingResponses, responseStatusText,
  RESPONSE_STATUS, type SourcingMerchantResponse,
} from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 商家寻货应答页 */
export default function MerchantResponsesPage() {
  const t = useTheme()
  const fs = useFs()
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [items, setItems] = useState<SourcingMerchantResponse[]>([])

  useDidShow(() => {
    if (currentMerchant) void getMySourcingResponses().then((r) => setItems(r || []))
  })

  return (
    <PageLayout>
      <NavBar title='寻货应答' onBack={() => Taro.navigateBack()} showBack />
      <ScrollView style={{ flex: 1 }}>
        {!currentMerchant && (
          <View style={{ alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>请先在商家 Tab 选择当前商户</Text>
          </View>
        )}
        {currentMerchant && items.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 100 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              还没有应答过寻货，去"发现"页看看有没有能供的货
            </Text>
          </View>
        )}
        {items.map((item, i) => {
          const adopted = item.status === RESPONSE_STATUS.adopted
          return (
            <View
              key={item.id}
              style={{ marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 12 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
              onClick={() => Taro.navigateTo({ url: `/pages/discover/detail?id=${item.demandId}` })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  寻 {item.partNumber || '已删除的寻货'}
                </Text>
                <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: adopted ? t.primaryLight : t.bgInput }}>
                  <Text style={{ ...fs(11), color: adopted ? t.primary : t.textTertiary }}>{responseStatusText(item.status)}</Text>
                </View>
              </View>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }} numberOfLines={1}>
                {[item.price != null ? `¥${item.price}/只` : null, item.stock ? `库存 ${item.stock}` : null, item.leadTime ? `交期 ${item.leadTime}` : null].filter(Boolean).join(' · ') || item.remark}
              </Text>
              {adopted && (
                <Text style={{ ...fs(12), color: t.primary, marginTop: 4 }}>已被选定，进详情查看需求方联系方式</Text>
              )}
            </View>
          )
        })}
        <View style={{ height: 30 }} />
      </ScrollView>
    </PageLayout>
  )
}
