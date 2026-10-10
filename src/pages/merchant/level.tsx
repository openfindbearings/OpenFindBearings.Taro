// 商家等级页（v2.13.0 等级玩法）：对标个人段位页——头部大卡（等级色带+保级倒计时）
// + 双指标进度（在售/金库 vs 下一档阈值）+ 四档阶梯 + 权益宫格。
// 数据源：/mobile/points/merchant-grade（在职成员校验，API 侧把关）
// RN 约束：仅 flex 布局、无 fixed/vh/CSS 变量、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { getMerchantGrade, type MerchantGradeDetail } from '../../services/points'
import { getMerchantGradeBand } from '../../utils/level'

definePageConfig({ disableScroll: true })

/** 四档阶梯静态骨架（阈值/升档礼数值来自接口，档位语义与后端 MerchantGrade 定案一致） */
const GRADE_STEPS: { rank: number; name: string; cond: string }[] = [
  { rank: 1, name: '入驻商家', cond: '审核通过即得' },
  { rank: 2, name: '认证商家', cond: '证照审核通过' },
  { rank: 3, name: '活跃供给', cond: '认证 + 在售达阈值' },
  { rank: 4, name: '金牌商家', cond: '认证 + 在售达阈值 + 金库累计达阈值' },
]

export default function MerchantLevelPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const current = useMerchantStore((s) => s.currentMerchant())
  const [detail, setDetail] = useState<MerchantGradeDetail | null>(null)

  useDidShow(() => {
    if (current?.merchantId) void getMerchantGrade(current.merchantId).then(setDetail)
  })

  const nav = <NavBar title='商家等级' showBack onBack={() => Taro.navigateBack()} />
  if (!isLoggedIn) {
    return (
      <PageLayout nav={nav}>
        <LoginGuide icon='store' text='登录后查看商家等级' />
      </PageLayout>
    )
  }
  if (!current?.merchantId) {
    return (
      <PageLayout nav={nav}>
        <View style={{ padding: 48, display: 'flex', alignItems: 'center' }}>
          <Text style={{ ...fs(13), color: t.textTertiary }}>请先在商户页入驻或加入一家商户</Text>
        </View>
      </PageLayout>
    )
  }
  if (!detail) {
    return (
      <PageLayout nav={nav}>
        <View style={{ padding: 48, display: 'flex', alignItems: 'center' }}>
          <Text style={{ ...fs(13), color: t.textTertiary }}>加载等级数据…</Text>
        </View>
      </PageLayout>
    )
  }

  const band = getMerchantGradeBand(detail.rank)
  const isMax = detail.rank >= 4
  // 保级剩余天数（graceUntil 为 UTC ISO；RN/H5 Date 解析一致）
  const graceDays = detail.graceUntil
    ? Math.max(0, Math.ceil((new Date(detail.graceUntil).getTime() - Date.now()) / 86400000))
    : 0
  // 下一档双指标：Lv2→3 看在售（达 lv3OnSaleMin）；Lv3→4 看在售(lv4OnSaleMin)+金库(lv4TreasuryMin)
  const nextOnSaleMin = detail.rank === 2 ? detail.lv3OnSaleMin : detail.lv4OnSaleMin
  const nextBonus = detail.rank === 1 ? detail.bonusLv2 : detail.rank === 2 ? detail.bonusLv3 : detail.bonusLv4

  const bar = (label: string, cur: number, min: number, unit: string) => {
    const pct = min > 0 ? Math.min(100, Math.round((cur / min) * 100)) : 100
    return (
      <View style={{ marginTop: 12 }}>
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.9)' }}>{label} {cur}/{min} {unit}</Text>
          <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600' }}>{pct}%</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 4, overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', width: `${Math.max(2, pct)}%` }} />
        </View>
      </View>
    )
  }

  return (
    <PageLayout nav={nav}>
      {/* 头部大卡：等级彩牌 + 保级倒计时（挂钟时） */}
      <View style={{ margin: 12, borderRadius: 14, padding: 20, backgroundColor: band.bg }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(22), color: '#FFFFFF', fontWeight: 'bold' }}>{detail.gradeDisplay}</Text>
            <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{detail.merchantName}</Text>
          </View>
          <Icon name='shield-check' size={44} color='rgba(255,255,255,0.9)' />
        </View>
        {graceDays > 0 ? (
          <View style={{ marginTop: 14, padding: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ ...fs(12), color: '#FFFFFF' }}>保级缓冲中：剩余 {graceDays} 天，在售回升至阈值即可维持当前等级</Text>
          </View>
        ) : null}
        {!isMax && (
          <View>
            {detail.rank === 1 && (
              <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.9)', marginTop: 14 }}>通过平台证照认证即可升 Lv2 认证商家，升档礼 +{nextBonus} 商家金</Text>
            )}
            {detail.rank === 2 && bar('在售商品', detail.onSaleCount, nextOnSaleMin, '件')}
            {detail.rank === 3 && (
              <>
                {bar('在售商品', detail.onSaleCount, nextOnSaleMin, '件')}
                {bar('金库累计入账', detail.treasuryEarned, detail.lv4TreasuryMin, '金')}
              </>
            )}
            {detail.rank >= 2 && (
              <Text style={{ ...fs(11), color: '#FFFFFF', fontWeight: '600', marginTop: 10 }}>
                升下一档礼 +{nextBonus} 商家金（终身一次{detail.claimedRanks.includes(detail.rank + 1) ? '，已领过则复升不再发' : ''}）
              </Text>
            )}
          </View>
        )}
        {isMax && <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600', marginTop: 12 }}>已是金牌商家，最高等级</Text>}
      </View>

      {/* 四档阶梯 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>等级阶梯</Text>
        {GRADE_STEPS.map((s) => {
          const reached = detail.rank >= s.rank
          const bonus = s.rank === 2 ? detail.bonusLv2 : s.rank === 3 ? detail.bonusLv3 : s.rank === 4 ? detail.bonusLv4 : 0
          const claimed = detail.claimedRanks.includes(s.rank)
          return (
            <View key={s.rank} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: reached ? getMerchantGradeBand(s.rank).bg : t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...fs(12), color: reached ? '#FFFFFF' : t.textTertiary, fontWeight: '700' }}>{s.rank}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ ...fs(13), color: reached ? t.textPrimary : t.textTertiary, fontWeight: '500' }}>{s.name}</Text>
                <Text style={{ ...fs(11), color: t.textTertiary }}>{s.cond}</Text>
              </View>
              {bonus > 0 && (
                <Text style={{ ...fs(11), color: claimed ? t.textTertiary : t.primary }}>{claimed ? `礼+${bonus} 已领` : `礼+${bonus}`}</Text>
              )}
            </View>
          )
        })}
      </View>

      {/* 权益宫格：成员 buff 清单 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>当前等级权益</Text>
        {detail.labels.length === 0 ? (
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>入驻商家暂无成员加成，认证后解锁（登录/纠错/发布加成）</Text>
        ) : (
          detail.labels.map((lb, i) => (
            <View key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ ...fs(12), color: '#16A34A', marginRight: 6 }}>✓</Text>
              <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>{lb}</Text>
            </View>
          ))
        )}
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>以上加成对本店全体在职成员自动生效；掉级先进保级期，只停权益不罚币</Text>
      </View>

      {/* 入口行 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12 }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 14 }} onClick={() => Taro.navigateTo({ url: '/pages/merchant/treasury' })}>
          <Icon name='vault' size={18} color={t.primary} />
          <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, marginLeft: 10 }}>商家金库明细</Text>
          <Icon name='chevron-right' size={16} color={t.textTertiary} />
        </View>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: t.border }} onClick={() => Taro.navigateTo({ url: '/pages/rules/index?kind=gold' })}>
          <Icon name='book-open' size={18} color={t.primary} />
          <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, marginLeft: 10 }}>商家金规则</Text>
          <Icon name='chevron-right' size={16} color={t.textTertiary} />
        </View>
      </View>
      <View style={{ height: 24 }} />
    </PageLayout>
  )
}
