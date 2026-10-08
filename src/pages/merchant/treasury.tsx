// 商家金收支明细页（v2.10.1）：从金库挂礼页拆出——余额卡+金库流水的纯明细视图，
// 与个人"收支明细"页对齐；挂礼管理走商家主页宫格"金库挂礼"入口，本页不再重复承载。
// RN 约束：仅 flex 布局、无 fixed、Text 包裹、lineHeight 数值。
import { useState } from 'react'
import { View, Text} from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import LoginGuide from '../../components/LoginGuide'
import { getTreasury, getTreasuryTransactions, treasurySceneText, type TreasuryAccount, type TreasuryTx } from '../../services/gifts'
import { formatTime } from '../../utils/format'

definePageConfig({ disableScroll: true })

/** 商家金收支明细页 */
export default function MerchantTreasuryPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [treasury, setTreasury] = useState<TreasuryAccount | null>(null)
  const [txs, setTxs] = useState<TreasuryTx[]>([])

  useDidShow(() => {
    if (!isLoggedIn) return
    void getTreasury().then((r) => setTreasury(r || null)).catch(() => { /* 静默 */ })
    void getTreasuryTransactions(1, 50).then((r) => setTxs(r?.items || [])).catch(() => { /* 静默 */ })
  })

  return (
    <PageLayout
      nav={
        <NavBar
          title='收支明细'
          showBack
          rightSlot={
            <View onClick={() => Taro.navigateTo({ url: '/pages/rules/index?kind=gold' })}>
              <Text style={{ ...fs(13), color: t.primary }}>商家金规则</Text>
            </View>
          }
        />
      }
    >
      {!isLoggedIn && <LoginGuide icon='vault' text='登录后查看商家金收支明细' />}
      {isLoggedIn && (
        <View>
          {/* 金库余额（商家仓库） */}
          <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>商家金库</Text>
              {/* 等级徽章（入驻/认证/活跃供给/金牌——buff 与信任的可视化） */}
              {treasury?.gradeDisplay ? (
                <Text style={{ ...fs(10), color: '#8B5CF6', backgroundColor: t.primaryLight, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, marginLeft: 8 }}>{treasury.gradeDisplay}</Text>
              ) : null}
            </View>
            {/* 改动说明（RN 布局修复）：原"大数字 Text 内嵌小 Text"写法在 Taro RN 渲染异常
                （余额数字丢失、单位样式错乱），展平为 row+baseline 双 Text，三端一致 */}
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={{ ...fs(28), color: t.primary, fontWeight: '700' }}>{String(treasury?.balance ?? 0)}</Text>
              <Text style={{ ...fs(13), color: t.textTertiary, marginLeft: 6 }}>商家金</Text>
            </View>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>
              累计入账 {treasury?.totalEarned ?? 0} · 累计支出 {treasury?.totalSpent ?? 0}
            </Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>
              成员赚分上供与礼品结算入此金库，可用于商品置顶等经营支出，不可提现或转让
            </Text>
          </View>

          {/* 金库流水（全量列表，时间倒序） */}
          {txs.length > 0 ? (
            <View style={{ marginLeft: 12, marginRight: 12, marginTop: 12 }}>
              <Text style={{ ...fs(13), color: t.textSecondary }}>全部流水</Text>
              {txs.map((tx, i) => (
                <View key={i} style={{ backgroundColor: t.bgCard, borderRadius: 10, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fs(13), color: t.textPrimary }}>{treasurySceneText(tx.scene)}</Text>
                    <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 3 }}>{tx.remark || ''} {formatTime(tx.createdAt)}</Text>
                  </View>
                  <Text style={{ ...fs(15), color: tx.direction === 1 ? '#16A34A' : '#EF4444', fontWeight: '600' }}>
                    {tx.direction === 1 ? '+' : '-'}{tx.amount}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ display: 'flex', alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>还没有金库流水，成员赚分上供、挂礼成交与集体任务奖励会记在这里</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </View>
      )}
    </PageLayout>
  )
}
