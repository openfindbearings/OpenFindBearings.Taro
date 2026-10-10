// 收支明细页（v1.7.17 轴承币底座；v1.7.19 标题由"轴承币明细"改"收支明细"，与商家金流水页同名不同币种）：余额概览 + 收支流水分页（触底加载）
// 改动说明（v2.12.0 等级玩法）：等级卡升级段位彩牌（色带徽标）+ 升档进度条（距升 X 还差 Y 币与升档礼预告）
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import { getPointAccount, getPointTransactions, GRANT_TYPE_LABELS, type PointAccount, type PointTransaction } from '../../services/points'
import { formatTime } from '../../utils/format'
import { getLevelBand } from '../../utils/level'

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
    <PageLayout nav={
      <NavBar
        title='收支明细'
        showBack
        onBack={() => Taro.navigateBack()}
        rightSlot={
          // 改动说明（v2.10.1）：右上角进轴承币规则页（与商家金规则同页双内容）
          <View onClick={() => Taro.navigateTo({ url: '/pages/rules/index?kind=points' })}>
            <Text style={{ ...fs(13), color: t.primary }}>轴承币规则</Text>
          </View>
        }
      />
    }
    // 改动说明（v1.7.19 weapp 适配）：页内 ScrollView 移除（PageLayout 统一滚动），
    //   触底加载改走 PageLayout onEndReached 透传
    onEndReached={() => void loadMore()}
    >
      <View>
        {/* 余额概览卡 */}
        <View style={{ backgroundColor: t.bgCard, margin: 12, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center' }}>
          <Text style={{ ...fs(34), color: t.primary, fontWeight: 'bold' }}>{account.balance}</Text>
          <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 4 }}>当前轴承币</Text>
          {/* v2.12.0 等级玩法：段位彩牌（青铜~王者七色带，Lv1 也亮牌）；v2.13.0 点击进段位详情页 */}
          <View style={{ marginTop: 8 }} onClick={() => Taro.navigateTo({ url: '/pages/my/level' })}>
            <View style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: getLevelBand(account.level).bg, borderRadius: 12, paddingLeft: 10, paddingRight: 5, paddingTop: 3, paddingBottom: 3 }}>
              <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600' }}>Lv.{account.level ?? 1} {account.levelName ?? ''}</Text>
              <Icon name='chevron-right' size={12} color='#FFFFFF' />
            </View>
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', marginTop: 12 }}>
            <Text style={{ ...fs(12), color: t.textTertiary, marginRight: 16 }}>累计获得 {account.totalEarned}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary }}>累计消耗 {account.totalSpent}</Text>
          </View>
          {/* v2.12.0 等级玩法：升档进度条——距下一档还差多少币、跨档发多少升档礼（终身一次） */}
          {account.nextLevelMin != null && account.nextLevelMin > 0 ? (
            <View style={{ width: '100%', marginTop: 14 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' }}>
                <View style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: getLevelBand(account.level).bg,
                  width: `${Math.min(100, Math.max(2, Math.round((account.totalEarned / account.nextLevelMin) * 100)))}%`,
                }} />
              </View>
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ ...fs(11), color: t.textTertiary }}>
                  距升「{account.nextLevelName ?? ''}」还差 {Math.max(0, account.nextLevelMin - account.totalEarned)} 币
                </Text>
                {account.nextLevelBonus != null && account.nextLevelBonus > 0 && (
                  <Text style={{ ...fs(11), color: t.primary }}>升档礼 +{account.nextLevelBonus}</Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>已达最高段位</Text>
          )}
        </View>

        {/* 流水列表 */}
        <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12 }}>
          {items.length === 0 && (
            <View style={{ padding: 32, display: 'flex', alignItems: 'center' }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>暂无轴承币记录，登录签到赚轴承币吧</Text>
            </View>
          )}
          {items.map((it) => (
            <View
              key={it.id}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...fs(14), color: t.textPrimary }}>{GRANT_TYPE_LABELS[it.grantType] || it.grantType}</Text>
                {/* 备注（如"连续第 3 天"）与时间副行 */}
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>
                  {it.remark ? `${it.remark} · ` : ''}{formatTime(it.createdAt)}
                </Text>
              </View>
              <View style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Text style={{ ...fs(15), fontWeight: '600', color: it.direction === 1 ? t.primary : '#EF4444' }}>
                  {it.direction === 1 ? '+' : '-'}{it.amount}
                </Text>
                <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>余额 {it.balanceAfter}</Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={{ padding: 12, display: 'flex', alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>加载中…</Text>
            </View>
          )}
        </View>
        {/* 底部留白防内容贴边 */}
        <View style={{ height: 24 }} />
      </View>
    </PageLayout>
  )
}
