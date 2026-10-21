// 商家等级页（v2.19.0 有效期制）：头部大卡（牌级图标 + 到期日 + 在售保级提示）
// + 双指标（本期成交 / 在售）+ 四档阶梯 + 权益清单 + 商家金加减 + 等级规则入口。
// 数据源：/mobile/points/merchant-grade（在职成员校验，API 侧把关）
// 规则：一期 180 天；期内达到下一档即升级并重发一期；到期按本期成交续期或降档；
// 在售连续不足超过保级期直接降普通，不等期末。
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
import { getTreasury, getTreasuryTransactions, treasurySceneText, type TreasuryAccount, type TreasuryTx } from '../../services/gifts'
import { MERCHANT_GRADE_ICONS, MERCHANT_GRADE_LABELS, getMerchantGradeBand } from '../../utils/level'
import { formatDate } from '../../utils/format'

definePageConfig({ disableScroll: true })

/** UTC ISO → "yyyy.MM.dd"（卡面到期日样式；无值回空串） */
function dateDot(iso?: string | null): string {
  if (!iso) return ''
  const d = formatDate(iso)
  return d === '-' ? '' : d.replace(/-/g, '.')
}

/** 商家等级页：牌级、有效期、双指标进度、阶梯、权益与商家金加减 */
export default function MerchantLevelPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const current = useMerchantStore((s) => s.currentMerchant())
  const [detail, setDetail] = useState<MerchantGradeDetail | null>(null)
  const [treasury, setTreasury] = useState<TreasuryAccount | null>(null)
  const [txs, setTxs] = useState<TreasuryTx[]>([])
  // 金库接口仅管理员可读；成员看到说明文案而不是空白卡
  const isAdmin = current?.role === 'MerchantAdmin'

  useDidShow(() => {
    if (!current?.merchantId) return
    void getMerchantGrade(current.merchantId).then(setDetail)
    // 商家金牌片：余额 + 最近 5 条加减流水；失败静默（不影响等级主信息）
    if (current.role === 'MerchantAdmin') {
      void getTreasury().then((r) => setTreasury(r || null)).catch(() => { /* 保持空态 */ })
      void getTreasuryTransactions(1, 5)
        .then((r) => setTxs(r?.items || []))
        .catch(() => { /* 保持空态 */ })
    }
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
  const gradeIcon = MERCHANT_GRADE_ICONS[detail.rank] || 'user'
  const isMax = detail.rank >= 4
  // 保级剩余天数（graceUntil 为 UTC ISO；仅"在售不足"会挂这个钟）
  const graceLeft = detail.graceUntil
    ? Math.max(0, Math.ceil((new Date(detail.graceUntil).getTime() - Date.now()) / 86400000))
    : 0
  // 距下一档（后端只回"下一档缺什么"，前端只渲染，不自推阈值组合）
  const next = detail.nextTier ?? null
  const nextBonus = detail.rank === 1 ? detail.bonusLv2 : detail.rank === 2 ? detail.bonusLv3 : detail.bonusLv4
  // 本期成交是否达标：requiredDeals 为 0 表示该档无成交要求
  const dealsMet = detail.requiredDeals <= 0 || detail.dealCount >= detail.requiredDeals
  const onSaleMet = detail.onSaleCount >= detail.onSaleMin
  // 到期降档预告：后台给出将降到的档位，前端只做文案
  const downgradeName = detail.downgradeTo ? (MERCHANT_GRADE_LABELS[detail.downgradeTo] || '') : ''
  const periodEnd = dateDot(detail.periodEndAt)
  // 四档阶梯：条件文案按有效期制口径，阈值仍取接口
  const steps: { rank: number; name: string; cond: string }[] = [
    { rank: 1, name: MERCHANT_GRADE_LABELS[1], cond: '注册即可；未认证或在售不足时落在此档' },
    { rank: 2, name: MERCHANT_GRADE_LABELS[2], cond: `完成平台证照认证 + 在售 ≥ ${detail.onSaleMin} 件` },
    { rank: 3, name: MERCHANT_GRADE_LABELS[3], cond: `认证 + 在售 ≥ ${detail.onSaleMin} 件 + 本期成功撮合 ≥ ${detail.silverDealMin} 次` },
    { rank: 4, name: MERCHANT_GRADE_LABELS[4], cond: `认证 + 在售 ≥ ${detail.onSaleMin} 件 + 本期成功撮合 ≥ ${detail.goldDealMin} 次` },
  ]

  /** 白底进度条：本期成交/在售双指标共用 */
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
      {/* 头部大卡：牌级图标 + 有效期到期日 + 在售保级提示 */}
      <View style={{ margin: 12, borderRadius: 14, padding: 20, backgroundColor: band.bg }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(22), color: '#FFFFFF', fontWeight: 'bold' }}>{detail.gradeDisplay}</Text>
              <Text style={{
                ...fs(10), color: '#FFFFFF', marginLeft: 8, paddingLeft: 6, paddingRight: 6,
                paddingTop: 2, paddingBottom: 2, borderRadius: 4,
                backgroundColor: detail.isVerified ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'
              }}>{detail.isVerified ? '已认证' : '未认证'}</Text>
            </View>
            <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{detail.merchantName}</Text>
            {/* 改动说明（v2.19.0）：到期日直接印在卡面；无有效期时说明起期条件（认证 + 在售达标） */}
            <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.9)', marginTop: 8 }}>
              {periodEnd ? `有效期至 ${periodEnd}` : `认证且在售 ≥ ${detail.onSaleMin} 件后开启 ${detail.periodDays} 天有效期`}
            </Text>
          </View>
          <Icon name={gradeIcon} size={44} color='rgba(255,255,255,0.92)' />
        </View>

        {graceLeft > 0 ? (
          <View style={{ marginTop: 14, padding: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ ...fs(12), color: '#FFFFFF' }}>
              在售不足，保级至 {dateDot(detail.graceUntil)}（剩 {graceLeft} 天）；补回在售即恢复，逾期降为普通
            </Text>
          </View>
        ) : null}

        {!detail.isVerified ? (
          <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.9)', marginTop: 14 }}>
            完成平台证照认证且在售达 {detail.onSaleMin} 件即进入铜牌，首次升档礼 +{detail.bonusLv2} 商家金
          </Text>
        ) : (
          <View>
            {/* 双指标：本期成交按有效期统计，在售按实时统计，两条都必达 */}
            {detail.requiredDeals > 0
              ? bar('本期成功撮合', detail.dealCount, detail.requiredDeals, '次')
              : (
                <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.9)', marginTop: 10 }}>
                  本期成功撮合 {detail.dealCount} 次（当前牌级无成交要求）
                </Text>
              )}
            {bar('在售商品', detail.onSaleCount, Math.max(1, detail.onSaleMin), '件')}
            {!isMax && next ? (
              <Text style={{ ...fs(11), color: '#FFFFFF', fontWeight: '600', marginTop: 10 }}>
                升 {next.label} 还差：
                {next.metOnSale ? '在售已达标' : `在售 ${Math.max(0, next.requiredOnSale - detail.onSaleCount)} 件`}
                {' · '}
                {next.metDeals ? '撮合已达标' : `成功撮合 ${Math.max(0, next.requiredDeals - detail.dealCount)} 次`}
                （升档礼 +{nextBonus} 商家金）
              </Text>
            ) : null}
            {isMax ? (
              <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600', marginTop: 12 }}>
                已是金牌；到期前保持本期成交与在售，即可续期
              </Text>
            ) : null}
          </View>
        )}
      </View>

      {/* 保级与降级：把有效期、本期成交、在售三条规则讲清楚 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>保级与降级</Text>
        <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 8 }}>
          一期 {detail.periodDays} 天，{periodEnd ? `本期到 ${periodEnd}` : '认证且在售达标后开始计时'}。期内成功撮合达到下一档要求，立即升级并重发 {detail.periodDays} 天；到期时按本期成交保留能支撑的牌级。
        </Text>
        <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>
          在售与成交同时达标才算保级：在售连续不足超过 {detail.graceDays} 天直接降普通，不等期末。
        </Text>
        {detail.downgradeTo && detail.downgradeTo < detail.rank ? (
          <Text style={{ ...fs(12), color: t.warning, marginTop: 6 }}>
            按当前进度，到期将降为 {downgradeName || MERCHANT_GRADE_LABELS[detail.downgradeTo]}。
          </Text>
        ) : (
          <Text style={{ ...fs(12), color: t.success, marginTop: 6 }}>
            当前进度可保级{dealsMet && onSaleMet ? '' : '（仍有一项未达标）'}。
          </Text>
        )}
      </View>

      {/* 四档阶梯：档位图标替代数字，升档礼用"升档礼 +N"表述 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>牌级阶梯</Text>
        {steps.map((s) => {
          const reached = detail.rank >= s.rank
          const bonus = s.rank === 2 ? detail.bonusLv2 : s.rank === 3 ? detail.bonusLv3 : s.rank === 4 ? detail.bonusLv4 : 0
          const claimed = detail.claimedRanks.includes(s.rank)
          return (
            <View key={s.rank} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: reached ? getMerchantGradeBand(s.rank).bg : t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={MERCHANT_GRADE_ICONS[s.rank] || 'user'} size={16} color={reached ? '#FFFFFF' : t.textTertiary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ ...fs(13), color: reached ? t.textPrimary : t.textTertiary, fontWeight: '500' }}>{s.name}</Text>
                <Text style={{ ...fs(11), color: t.textTertiary }}>{s.cond}</Text>
              </View>
              {bonus > 0 && (
                <Text style={{ ...fs(11), color: claimed ? t.textTertiary : t.primary }}>
                  {claimed ? `升档礼 +${bonus} 已领` : `升档礼 +${bonus}`}
                </Text>
              )}
            </View>
          )
        })}
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>
          升档礼为每档终身一次的商家金，首次达到即入金库，掉级后复升不重发。
        </Text>
      </View>

      {/* 权益清单：成员 buff（普通档无加成时给准确文案，避免误以为整档无权益） */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>当前牌级权益</Text>
        {detail.labels.length === 0 ? (
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>当前牌级暂无成员加成，完成认证入铜牌后解锁</Text>
        ) : (
          detail.labels.map((lb, i) => (
            <View key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ ...fs(12), color: t.success, marginRight: 6 }}>✓</Text>
              <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>{lb}</Text>
            </View>
          ))
        )}
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>以上加成发给成员本人（个人轴承币与每日免费额度），不进入商家金；掉级先进保级期，只停权益不罚币</Text>
      </View>

      {/* 商家金：等级权益的主要载体，把"加"（升档礼/任务）与"减"（置顶兑换）放在同一张卡 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Icon name='vault' size={18} color={t.primary} />
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', marginLeft: 8, flex: 1 }}>商家金</Text>
          {isAdmin && treasury ? (
            <Text style={{ ...fs(20), color: t.primary, fontWeight: '700' }}>{treasury.balance}</Text>
          ) : null}
        </View>
        {!isAdmin ? (
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>商家金仅商户管理员可查看与支配，可直接用于商品置顶。</Text>
        ) : (
          <View>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>升档礼、任务奖励入账；兑换置顶等支出扣减。</Text>
            {txs.length === 0 ? (
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>暂无流水</Text>
            ) : (
              txs.map((tx, i) => (
                <View key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>{treasurySceneText(tx.scene)}</Text>
                  <Text style={{ ...fs(13), color: tx.direction === 1 ? t.success : t.danger, fontWeight: '600' }}>
                    {tx.direction === 1 ? '+' : '-'}{tx.amount}
                  </Text>
                </View>
              ))
            )}
            <View style={{ display: 'flex', flexDirection: 'row', marginTop: 12 }}>
              <View
                style={{ flex: 1, paddingTop: 9, paddingBottom: 9, borderRadius: 8, backgroundColor: t.primary, display: 'flex', alignItems: 'center' }}
                onClick={() => Taro.navigateTo({ url: '/pages/merchant/manage' })}
              >
                <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>去兑换置顶</Text>
              </View>
              <View
                style={{ flex: 1, marginLeft: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 8, borderStyle: 'solid', borderWidth: 1, borderColor: t.primary, display: 'flex', alignItems: 'center' }}
                onClick={() => Taro.navigateTo({ url: '/pages/merchant/treasury' })}
              >
                <Text style={{ ...fs(13), color: t.primary, fontWeight: '600' }}>全部明细</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 规则入口：积分规则/商家金规则/等级规则共用 rules 页 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12 }}>
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 14 }}
          onClick={() => Taro.navigateTo({ url: '/pages/rules/index?kind=grade' })}
        >
          <Icon name='book-open' size={18} color={t.primary} />
          <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, marginLeft: 10 }}>等级规则</Text>
          <Icon name='chevron-right' size={16} color={t.textTertiary} />
        </View>
      </View>
      <View style={{ height: 24 }} />
    </PageLayout>
  )
}
