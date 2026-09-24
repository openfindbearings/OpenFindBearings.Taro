// 积分明细页（v1.7.17 积分底座）：余额概览 + 收支流水分页（触底加载）
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getPointAccount, getPointTransactions, GRANT_TYPE_LABELS, type PointAccount, type PointTransaction } from '../../services/points'
import { formatTime } from '../../utils/format'

/** 每页条数 */
const PAGE_SIZE = 20

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

export default function PointsPage() {
  const t = useTheme()
  const fs = useFs()
  const [account, setAccount] = useState<PointAccount>({ balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 })
  const [items, setItems] = useState<PointTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // 进入/返回刷新（签到后回本页余额同步）
  useDidShow(() => {
    void getPointAccount().then(setAccount)
    void getPointTransactions(1, PAGE_SIZE).then((r) => {
      if (r) { setItems(r.items || []); setTotal(r.totalCount || 0); setPage(1) }
    })
  })

  // 触底加载下一页（简单分页，无并发锁需求外的复杂逻辑）
  const loadMore = async () => {
    if (loading || items.length >= total) return
    setLoading(true)
    const next = page + 1
    const r = await getPointTransactions(next, PAGE_SIZE)
    if (r) { setItems([...items, ...(r.items || [])]); setPage(next) }
    setLoading(false)
  }

  return (
    <PageLayout>
      <NavBar title='积分明细' onBack={() => Taro.navigateBack()} />
      <ScrollView style={{ flex: 1 }} onScrollToLower={() => void loadMore()}>
        {/* 余额概览卡 */}
        <View style={{ backgroundColor: t.bgCard, margin: 12, borderRadius: 12, padding: 20, alignItems: 'center' }}>
          <Text style={{ ...fs(34), color: t.primary, fontWeight: 'bold' }}>{account.balance}</Text>
          <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 4 }}>当前积分</Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Text style={{ ...fs(12), color: t.textTertiary, marginRight: 16 }}>累计获得 {account.totalEarned}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary }}>累计消耗 {account.totalSpent}</Text>
          </View>
        </View>

        {/* 流水列表 */}
        <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12 }}>
          {items.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>暂无积分记录，登录签到赚积分吧</Text>
            </View>
          )}
          {items.map((it) => (
            <View
              key={it.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...fs(14), color: t.textPrimary }}>{GRANT_TYPE_LABELS[it.grantType] || it.grantType}</Text>
                {/* 备注（如"连续第 3 天"）与时间副行 */}
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>
                  {it.remark ? `${it.remark} · ` : ''}{formatTime(it.createdAt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...fs(15), fontWeight: '600', color: it.direction === 1 ? t.primary : '#EF4444' }}>
                  {it.direction === 1 ? '+' : '-'}{it.amount}
                </Text>
                <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>余额 {it.balanceAfter}</Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>加载中…</Text>
            </View>
          )}
        </View>
        {/* 底部留白防内容贴边 */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </PageLayout>
  )
}
