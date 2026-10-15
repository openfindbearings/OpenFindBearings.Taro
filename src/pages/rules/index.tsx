// 轴承币与商家金规则页：?kind=points 显示个人"轴承币"规则，?kind=gold 显示"商家金"规则。
// 改动说明（v2.11.0 定名）：个人积分对外定名"轴承币"（与"荣誉分/商家金"彻底区分），
// 代码与接口仍用 points 内部口径，仅展示层改名。
// 改动说明（v2.17.0 规则数据源）：页面数值原全部硬编码、与后端配置易漂移，改为挂载时拉取
// /mobile/points/rules 后渲染；接口失败保持内置默认值（与后端默认一致），页面照常可用。
// RN 约束：仅 flex、无 fixed、Text 包裹、数值 lineHeight。
import { useEffect, useState } from 'react'
import { View, Text} from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getPointRules, type PointRules } from '../../services/pointRules'

definePageConfig({ disableScroll: true })

/**
 * 规则默认值（与后端 PointRulesDto 默认一一对应）。
 * 接口成功时用返回值覆盖；失败或缺字段时回退此处，保证页面不因数据缺失变形。
 */
const DEFAULT_RULES: PointRules = {
  checkinLadder: [2, 3, 4, 5, 5],
  checkinDoubleChance: 10,
  checkinLegendChance: 2,
  loginAmount: 1,
  correctionAmount: 20,
  correctionDailyLimit: 100,
  comboAmount: 30,
  minigameAmount: 5,
  minigameDailyLimit: 10,
  milestoneProfile: 50,
  milestoneFirstProduct: 20,
  milestoneApproved: 100,
  sourcingBonusAmount: 20,
  sourcingPublishDailyLimit: 10,
  sourcingRespondDailyLimit: 50,
  freePublishPerDay: 3,
  freeRespondPerDay: 20,
  levelBonusMin: 10,
  levelBonusMax: 120,
  tzOffsetHours: 8,
  buffCheckinMax: 3,
  buffLogin: 1,
  buffCorrectionMax: 1.25,
  tricklePercent: 10,
  trickleDailyCap: 50,
  trickleMonthlyCap: 1000,
  giftSettleMonthlyCap: 2000,
  merchantGradeBonusLv2: 50,
  merchantGradeBonusLv3: 150,
  merchantGradeBonusLv4: 300,
  merchantGradeGraceDays: 15,
  merchantGoldPayRate: 2,
  merchantTaskWeeklyTreasury: 100,
  merchantTaskMemberMin: 20,
  merchantTaskMemberMax: 50,
}

/** 规则小节：标题 + 行列表（行=左文案右数值，value 可空） */
function RuleSection({ title, rows, t, fs }: {
  title: string
  rows: Array<{ label: string; value?: string; note?: string }>
  t: any; fs: (n: number) => any
}) {
  return (
    <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
      <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>{title}</Text>
      {rows.map((r, i) => (
        <View key={i} style={{ marginTop: 10 }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>{r.label}</Text>
            {r.value ? <Text style={{ ...fs(13), color: t.primary, fontWeight: '600' }}>{r.value}</Text> : null}
          </View>
          {r.note ? <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{r.note}</Text> : null}
        </View>
      ))}
    </View>
  )
}

/** 规则页（轴承币 / 商家金双内容，数值来自后端规则数据源） */
export default function RulesPage() {
  const t = useTheme()
  const fs = useFs()
  const router = useRouter()
  const isGold = router.params.kind === 'gold'
  const [rules, setRules] = useState<PointRules>(DEFAULT_RULES)

  // 挂载拉取规则数据源：成功后合并到默认值（缺字段回退默认），失败静默保持默认
  useEffect(() => {
    let alive = true
    getPointRules()
      .then((data) => { if (alive && data) setRules({ ...DEFAULT_RULES, ...data }) })
      .catch(() => { /* 接口失败保持默认，页面照常渲染 */ })
    return () => { alive = false }
  }, [])

  const r = rules
  // 签到阶梯：接口可能返回空数组，稳妥回退默认阶梯后再取区间与文案
  const ladder = r.checkinLadder && r.checkinLadder.length > 0 ? r.checkinLadder : DEFAULT_RULES.checkinLadder
  const ladderText = ladder.join('/')
  const ladderMin = Math.min(...ladder)
  const ladderMax = Math.max(...ladder)

  return (
    <PageLayout nav={<NavBar title={isGold ? '商家金规则' : '轴承币规则'} showBack />}>
      <View>
        {isGold ? (
          <>
            <View style={{ marginLeft: 12, marginRight: 12, marginTop: 14 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>
                商家金是店铺经营账本（金库）里的货币，与个人轴承币是两套独立账本，互不转账。只有商户管理员可支配，用于平台内经营支出。
              </Text>
            </View>
            <RuleSection t={t} fs={fs} title='怎么赚' rows={[
              { label: '成员上供', value: `赚币 ×${r.tricklePercent}%`, note: `成员获得审核/交易类轴承币时自动滴给在职店铺；签到登录等被动收益不参与；店铺每日限 ${r.trickleDailyCap}、每月限 ${r.trickleMonthlyCap}` },
              { label: '挂礼成交', value: '全额入账', note: '买家兑换礼品确认收货（或发货 7 天自动确认）后，货款全额结算进金库' },
              { label: '集体任务', value: `+${r.merchantTaskWeeklyTreasury}/周`, note: `如"本周新上架 5 款"达成奖励金库 ${r.merchantTaskWeeklyTreasury}（任务清单见商家主页）` },
              { label: '商家升档礼', value: `+${r.merchantGradeBonusLv2}~+${r.merchantGradeBonusLv4}`, note: `商家等级升到 Lv2 认证 +${r.merchantGradeBonusLv2}、Lv3 口碑商家 +${r.merchantGradeBonusLv3}、Lv4 金牌 +${r.merchantGradeBonusLv4}，一次性入金库；每店每档终身一次，掉级后复升不重发` },
            ]} />
            <RuleSection t={t} fs={fs} title='怎么花' rows={[
              { label: '商品置顶卡', value: '原价支付', note: '在售商品在型号商家列表置顶 24/72 小时，管理员默认走金库' },
              { label: '其他平台权益', value: '陆续开放', note: '金库只能在平台内消费' },
            ]} />
            <RuleSection t={t} fs={fs} title='与轴承币的关系' rows={[
              { label: '个人代付折算', value: `1 金 = ${r.merchantGoldPayRate} 币`, note: '管理员也可用个人轴承币代付商品置顶，按汇率折算多付（汇率平台可调）；这是个人消费，不会变成金库余额' },
              { label: '成员赚币上供', value: `${r.tricklePercent}% 滴入`, note: '个人赚币不受影响，金库只是同步攒下的一小部分' },
            ]} />
            <RuleSection t={t} fs={fs} title='红线' rows={[
              { label: '不可提现 / 折现 / 转让', note: '平台无现金结算，商家金只能在平台内使用' },
              { label: '成员不能支取金库', value: '仅管理员', note: '防止店铺资金被个人掏空；多管理员共管' },
              { label: '掉级有缓冲', value: `${r.merchantGradeGraceDays} 天`, note: '在售跌破阈值先进保级期（维持原等级与成员 buff），期内补回即保住；到期仍不达标才降档，已发升档礼不追缴' },
              { label: '闭店清空', note: '店铺退出经营时金库余额作废燃烧，不折算给任何个人' },
            ]} />
          </>
        ) : (
          <>
            <View style={{ marginLeft: 12, marginRight: 12, marginTop: 14 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>
                轴承币是个人行为货币：靠日常贡献赚取，用于超额寻货与商城兑换。不可充值、不可提现、不可转让，与商家金是两套账本。
              </Text>
            </View>
            <RuleSection t={t} fs={fs} title='怎么赚' rows={[
              { label: '每日签到', value: `+${ladderMin}~+${ladderMax}`, note: `连签阶梯 ${ladderText} 封顶；受最佳商家 buff 加成（最高 +${r.buffCheckinMax}）` },
              { label: '每日登录', value: `+${r.loginAmount}`, note: `每天首次请求自动发放；buff 加成 +${r.buffLogin}` },
              { label: '纠错被采纳', value: `+${r.correctionAmount}/条`, note: `平台审核采纳后到账，每日上限 ${r.correctionDailyLimit}；buff 加成最高 ×${r.buffCorrectionMax}` },
              { label: '每日三件套', value: `+${r.comboAmount}`, note: '同一天完成签到+纠错被采纳+寻货应答各至少一次，额外奖励' },
              { label: '小游戏胜利', value: `+${r.minigameAmount}/局`, note: `轴承连连看等平台小游戏，每日上限 ${r.minigameDailyLimit} 币` },
              { label: '集体任务成员奖', value: `+${r.merchantTaskMemberMin}~+${r.merchantTaskMemberMax}`, note: '店铺达成集体任务（如周纠错 5 条）时每位在职成员得奖' },
              { label: '段位升档礼', value: `+${r.levelBonusMin}~+${r.levelBonusMax}`, note: '累计获得轴承币跨入新段位（青铜→最强王者十档）一次性发放，每段终身一次；勋章点亮不再产币（纯荣誉）' },
              { label: '一次性里程碑', value: `+${r.milestoneProfile}~+${r.milestoneApproved}`, note: `完善资料 +${r.milestoneProfile}、首次上架 +${r.milestoneFirstProduct}、入驻审批通过 +${r.milestoneApproved}` },
              { label: '赚币暴击', value: `${r.checkinDoubleChance}% ×2`, note: `签到等主动赚币有 ${r.checkinDoubleChance}% 概率双倍、${r.checkinLegendChance}% 概率传说 ×5（服务端判定，仍受日上限约束）` },
            ]} />
            <RuleSection t={t} fs={fs} title='怎么花' rows={[
              { label: '寻货超额', value: `${r.sourcingBonusAmount}/次`, note: `发布/应答超出免费额度（每日 ${r.freePublishPerDay} 发布 / ${r.freeRespondPerDay} 应答）后按次扣币；硬上限 ${r.sourcingPublishDailyLimit}/${r.sourcingRespondDailyLimit} 币也买不到` },
              { label: '商城兑换', value: '见标价', note: '寻货置顶卡、权益包、商家挂礼等，兑换即扣' },
              { label: '商品置顶代付', value: `×${r.merchantGoldPayRate} 折算`, note: '店铺管理员可用个人轴承币代付商品置顶（按商家金汇率折算多付）' },
            ]} />
            <RuleSection t={t} fs={fs} title='规则与边界' rows={[
              { label: '段位只升不降', note: '段位按累计获得轴承币落档（青铜→王者十档），只升不降；段位享彩牌铭牌与升档礼，不影响赚币倍率（倍率归商家 buff）' },
              { label: '每日上限', note: `各赚币场景有日上限（如纠错 ${r.correctionDailyLimit}/日），防刷分` },
              // 改动说明（v2.17.0）：值随配置偏移；注释同步走条件文案，避免偏移非 8 时"北京时间"与之矛盾
              { label: '切日口径', value: `UTC+${r.tzOffsetHours}`, note: r.tzOffsetHours === 8 ? '"每天"按北京时间（东八区）零点切分' : `"每天"按 UTC+${r.tzOffsetHours} 零点切分` },
              { label: '不过期', note: '当前轴承币无过期时间；平台保留后续引入过期策略的可能' },
              { label: '不可提现转让', note: '轴承币不能换钱、不能转给他人（含店铺），唯一去向是平台内消费' },
            ]} />
          </>
        )}
        <View style={{ height: 40 }} />
      </View>
    </PageLayout>
  )
}