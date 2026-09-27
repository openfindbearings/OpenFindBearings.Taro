// 商家管理页（v2.6.0 双界面拆分）：自家管理员/员工的"帮派总部"，
// 三卡镜像个人我的页——商家金库卡（仅管理员，对应个人积分卡）、功能宫格卡（对应功能四宫格）、
// 商家勋章卡（对应我的勋章卡），底部集体任务进度板（帮派 raid 板）。
// 公开展示界面见 merchantDetail.tsx（门面+勋章园+商品+关注/纠错），两界面互留导航。
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import MedalImage from '../../components/MedalImage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import MediaImage from '../../components/MediaImage'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { getTreasury, type TreasuryAccount } from '../../services/gifts'
import { getMerchantAchievements, type AchievementWall } from '../../services/achievements'
// v2.6.0 任务中心拆分：商家级"帮派任务"内容（福利/集体任务/实力榜）全部归本页
import { getMerchantTasks, getMerchantBuff, getMerchantRanking, type MerchantTasksResult, type MerchantBuff, type MerchantRanking } from '../../services/points'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function MerchantHomePage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  // 管理对象=当前商家上下文（多商家切换走商家 tab，本页跟随 currentMerchant）
  const current = useMerchantStore((s) => s.currentMerchant())
  const [treasury, setTreasury] = useState<TreasuryAccount | null>(null)
  const [ach, setAch] = useState<AchievementWall | null>(null)
  const [mtasks, setMtasks] = useState<MerchantTasksResult | null>(null)
  // v2.6.0 拆分：本店福利卡 + 实力榜（"本店给成员的 buff"与"本店名次"，商家视角）
  const [buff, setBuff] = useState<MerchantBuff | null>(null)
  const [ranking, setRanking] = useState<MerchantRanking | null>(null)

  const isAdmin = current?.role === 'MerchantAdmin'

  useDidShow(() => {
    const mid = current?.merchantId
    if (!isLoggedIn || !mid) {
      setTreasury(null); setAch(null); setMtasks(null); setBuff(null); setRanking(null)
      return
    }
    // 金库仅管理员有权限（员工不渲染金额，接口也不请求）
    if (isAdmin) void getTreasury().then(setTreasury).catch(() => setTreasury(null))
    else setTreasury(null)
    void getMerchantAchievements(mid).then((r) => setAch(r || null)).catch(() => setAch(null))
    void getMerchantTasks(mid).then(setMtasks).catch(() => setMtasks(null))
    void getMerchantBuff(mid).then(setBuff).catch(() => setBuff(null))
    void getMerchantRanking(mid).then(setRanking).catch(() => setRanking(null))
  })

  // 勋章展示序：最近点亮优先（与个人勋章卡同口径），最多 12 枚
  const medalItems = (ach?.items ?? [])
    .filter((i) => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 12)

  // 功能宫格（全员：商品/成员/寻货应答；管理员+金库挂礼/信息维护）
  const actions = [
    { url: '/pages/merchant/manage', icon: 'boxes', label: '商品管理' },
    { url: '/pages/merchant/members', icon: 'users', label: isAdmin ? '成员管理' : '员工列表' },
    { url: '/pages/merchant/responses', icon: 'search', label: '寻货应答' },
    ...(isAdmin
      ? [
          { url: '/pages/merchant/gifts', icon: 'vault', label: '金库挂礼' },
          { url: '/pages/merchant/profile', icon: 'file_text', label: '信息维护' },
        ]
      : []),
  ]

  if (!isLoggedIn) {
    return (
      <PageLayout nav={<NavBar title='商家管理' showBack />}>
        <LoginGuide icon='store' text='登录后查看商家管理' />
      </PageLayout>
    )
  }

  if (!current?.merchantId) {
    return (
      <PageLayout nav={<NavBar title='商家管理' showBack />}>
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Icon name='store' size={40} color={t.textTertiary} />
          <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无生效中的商家，可在商家 tab 入驻或受聘</Text>
        </View>
      </PageLayout>
    )
  }

  return (
    <PageLayout nav={<NavBar title='商家管理' showBack />}>
      <ScrollView style={{ flex: 1 }}>
        {/* 头部：商家 Logo + 名称 + 等级徽章（管理员取金库接口等级，员工按认证态简化显示） */}
        <View style={{ flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 0, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <MediaImage
            url={current.logoUrl}
            style={{ width: 44, height: 44, borderRadius: 10 }}
            fallback={
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name='store' size={22} color={t.primary} />
              </View>
            }
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>{current.merchantName}</Text>
              {isAdmin && treasury?.gradeDisplay ? (
                <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: treasury.grade === 4 ? '#D97706' : treasury.grade === 2 ? '#8B5CF6' : '#F59E0B' }}>
                  <Icon name='badge-check' size={11} color='#FFFFFF' />
                  <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: 'bold', marginLeft: 3 }}>{treasury.gradeDisplay}</Text>
                </View>
              ) : (!isAdmin && current.isVerified ? (
                <Text style={{ ...fs(11), color: '#F59E0B' }}>认证商家</Text>
              ) : null)}
            </View>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>{isAdmin ? '管理员' : '员工'} · 与成员共同经营</Text>
          </View>
        </View>

        {/* 1. 商家金库卡（仅管理员，镜像个人积分卡；员工不经手钱货不渲染） */}
        {isAdmin && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, marginTop: 12, padding: 16, backgroundColor: t.bgCard, borderRadius: 12 }}
            onClick={() => Taro.navigateTo({ url: '/pages/merchant/gifts' })}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(13), color: t.textSecondary }}>商家金库</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={{ ...fs(26), color: t.primary, fontWeight: 'bold' }}>{treasury?.balance ?? 0}</Text>
                {/* 改动说明（v2.10.0 商家金）：金库货币定名"商家金"，与个人积分区分 */}
                <Text style={{ ...fs(13), color: t.textSecondary, marginLeft: 6 }}>商家金</Text>
              </View>
              <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>来源：成员赚分上供 · 挂礼结算 · 集体任务奖励</Text>
            </View>
            <Text style={{ ...fs(13), color: t.primary }}>流水与挂礼 ›</Text>
          </View>
        )}

        {/* 2. 功能宫格卡（镜像我的页功能四宫格） */}
        <View style={{ margin: 16, marginTop: 12, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>商家功能</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {actions.map((a) => (
              <View key={a.url} style={{ width: '33.33%', alignItems: 'center', padding: 10 }} onClick={() => Taro.navigateTo({ url: a.url })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.icon} size={22} color={t.primary} />
                </View>
                <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 5 }}>{a.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 3. 商家勋章卡（镜像我的勋章卡）
            改动说明（用户定案）：点击进商家勋章展示页（medals，镜像个人勋章页），
            不进 public 详情页——自家荣誉看自家展厅 */}
        <View
          style={{ margin: 16, marginTop: 12, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}
          onClick={() => Taro.navigateTo({ url: '/pages/merchant/medals' })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>商家勋章</Text>
            <Text style={{ ...fs(13), color: t.textTertiary }}>共 {ach?.unlockedCount ?? 0} 枚 ›</Text>
          </View>
          {medalItems.length === 0 ? (
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>上架供给、认证资料、集体任务都能点亮勋章</Text>
          ) : (
            <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ height: 84, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {medalItems.map((b) => {
                  return (
                    <View key={b.key} style={{ width: 64, alignItems: 'center', marginRight: 6 }}>
                      <MedalImage imageKey={b.imageKey} icon={b.icon || 'award'} rare={b.rare} variant='card' primary={t.primary} primaryLight={t.primaryLight} />
                      <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 4, lineHeight: 13 }} numberOfLines={1}>{b.name}</Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          )}
          {(mtasks?.completedTotal ?? 0) > 0 && (
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>集体任务累计达成 {mtasks?.completedTotal} 次</Text>
          )}
        </View>

        {/* 4. 商家福利卡（v2.6.0 拆分自个人任务中心）：本店给全体在职成员的被动加成 */}
        <View style={{ margin: 16, marginTop: 12, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>商家福利</Text>
            {buff && buff.rank > 0 ? (
              <Text style={{ ...fs(12), color: '#8B5CF6' }}>
                {buff.rank === 1 ? 'Lv1 入驻' : buff.rank === 2 ? 'Lv2 认证' : buff.rank === 3 ? 'Lv3 活跃供给' : 'Lv4 金牌'}
              </Text>
            ) : null}
          </View>
          {buff && buff.rank > 0 ? (
            <>
              <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>以下加成对本店全体在职成员自动生效：</Text>
              {(buff.labels || []).map((lb, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                  <Text style={{ ...fs(12), color: '#16A34A', marginRight: 6 }}>✓</Text>
                  <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>{lb}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>商家通过认证后解锁成员福利（登录/纠错/发布加成）</Text>
          )}
          {buff?.nextHint ? (
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>升级：{buff.nextHint}</Text>
          ) : null}
        </View>

        {/* 5. 集体任务进度板（帮派 raid 板，数据按本商家查询） */}
        {mtasks && mtasks.tasks.length > 0 && (
          <View style={{ margin: 16, marginTop: 12, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>集体任务</Text>
              <Text style={{ ...fs(12), color: t.textTertiary }}>{mtasks.merchantName ?? current.merchantName}</Text>
            </View>
            {mtasks.tasks.map((mt, i) => {
              const pct = mt.target > 0 ? Math.min(1, mt.current / mt.target) : 0
              return (
                <View key={mt.taskKey} style={{ marginTop: i === 0 ? 10 : 0, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.borderLight }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ ...fs(13), color: t.textPrimary, flex: 1 }}>{mt.period === 2 ? '月' : '周'}·{mt.name}</Text>
                    {mt.done
                      ? <Text style={{ ...fs(12), color: '#16A34A', fontWeight: '600' }}>已达成</Text>
                      : <Text style={{ ...fs(12), color: t.textSecondary }}>{mt.current}/{mt.target}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: t.bgInput, marginTop: 5, overflow: 'hidden' }}>
                    <View style={{ flex: Math.max(pct, 0.02), backgroundColor: mt.done ? '#16A34A' : t.primary }} />
                    <View style={{ flex: Math.max(1 - pct, 0.02) }} />
                  </View>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>
                    {mt.rewardType === 2 ? `达成奖励：商家金 +${mt.rewardAmount}` : `达成奖励：每位成员 +${mt.rewardAmount}`}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* 6. 商家实力月榜（v2.6.0 拆分自个人任务中心）：本月金库入账 Top5 + 本店名次回显 */}
        <View style={{ margin: 16, marginTop: 12, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>商家实力榜</Text>
            {ranking?.periodKey ? (
              <Text style={{ ...fs(11), color: t.textTertiary }}>
                {ranking.periodKey.length === 6 ? `${ranking.periodKey.slice(0, 4)}年${ranking.periodKey.slice(4)}月` : ranking.periodKey}
              </Text>
            ) : null}
          </View>
          {!ranking || ranking.top.length === 0 ? (
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>本月还没有商家入账，冲榜机会来了</Text>
          ) : (
            ranking.top.slice(0, 5).map((r) => (
              <View key={r.merchantId} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <Text style={{ ...fs(13), fontWeight: '700', width: 28, color: r.rank === 1 ? '#F59E0B' : r.rank === 2 ? '#94A3B8' : r.rank === 3 ? '#B45309' : t.textTertiary }}>{r.rank}</Text>
                <View style={{ flex: 1, marginLeft: 4 }}>
                  <Text style={{ ...fs(13), color: t.textPrimary }} numberOfLines={1}>{r.merchantName}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 1 }}>{r.gradeDisplay}商家</Text>
                </View>
                <Text style={{ ...fs(13), color: t.primary, fontWeight: '600' }}>{r.total}</Text>
                <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 3 }}>分</Text>
              </View>
            ))
          )}
          {ranking?.mine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.borderLight }}>
              <Text style={{ ...fs(13), fontWeight: '700', width: 28, color: t.textTertiary }}>{ranking.mine.rank > 0 ? ranking.mine.rank : '—'}</Text>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={{ ...fs(13), color: t.textPrimary }} numberOfLines={1}>本店 · {ranking.mine.merchantName}</Text>
              </View>
              <Text style={{ ...fs(13), color: t.primary, fontWeight: '600' }}>{ranking.mine.rank > 0 ? ranking.mine.total : '未上榜'}</Text>
              {ranking.mine.rank > 0 ? <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 3 }}>分</Text> : null}
            </View>
          ) : null}
        </View>

        {/* 合规三纪律脚注（与个人侧口径一致） */}
        <Text style={{ ...fs(11), color: t.textTertiary, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
          金库积分不可充值、不可提现、不可转让
        </Text>
      </ScrollView>
    </PageLayout>
  )
}
