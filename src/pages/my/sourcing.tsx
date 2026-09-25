// 我的寻货页（v1.7.19）：个人用户发布的寻货列表（全状态倒序），点击进详情。
// 八格"我的寻货"入口落地（原占位 toast）
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { getMySourcingDemands, demandStatusText, DEMAND_STATUS, type SourcingMyDemand } from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 我的寻货页 */
export default function MySourcingPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [items, setItems] = useState<SourcingMyDemand[]>([])

  useDidShow(() => {
    if (isLoggedIn) void getMySourcingDemands().then((r) => setItems(r || []))
  })

  return (
    <PageLayout>
      <NavBar title='我的寻货' onBack={() => Taro.navigateBack()} showBack />
      <ScrollView style={{ flex: 1 }}>
        {!isLoggedIn && (
          <View style={{ alignItems: 'center', paddingTop: 100 }}>
            <Text style={{ ...fs(14), color: t.textTertiary }}>登录后查看我发布的寻货</Text>
          </View>
        )}
        {isLoggedIn && items.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 100 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  寻 {item.partNumber}
                </Text>
                <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: open ? t.primaryLight : t.bgInput }}>
                  <Text style={{ ...fs(11), color: open ? t.primary : t.textTertiary }}>{demandStatusText(item.status)}</Text>
                </View>
              </View>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }}>
                {[item.brand, item.quantity].filter(Boolean).join(' · ') || '—'} · {item.responseCount} 家应答
              </Text>
            </View>
          )
        })}
        <View style={{ height: 30 }} />
      </ScrollView>
    </PageLayout>
  )
}
