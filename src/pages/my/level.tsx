// 我的段位页（v2.13.0 等级玩法）：对标京东会员/美团会员中心版式——
// 顶部段位 tab 条（横滑，当前档下划线）+ 段位大卡（色带底+进度条+升档礼）+ 权益宫格 + 入口行。
// 数据源：/mobile/points/levels（全档位+本人落档+已领标记）与 /mobile/points/account（商家 buff 卡复用既有接口）
// RN 约束：仅 flex 布局、无 fixed/vh/CSS 变量、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getPointLadder, getMerchantBuff, type PointLadder, type MerchantBuff } from '../../services/points'
import { getLevelBand } from '../../utils/level'

definePageConfig({ disableScroll: true })

/** 权益宫格单元（图标名走 Lucide 动态映射） */
interface PerkCell {
  icon: string
  label: string
  note: string
  locked?: boolean
}

export default function LevelPage() {
  const t = useTheme()
  const fs = useFs()
  const [ladder, setLadder] = useState<PointLadder | null>(null)
  const [buff, setBuff] = useState<MerchantBuff | null>(null)
  // 选中查看的档位号（默认当前档；tab 条点击切换，大卡随选中档展示）
  const [selected, setSelected] = useState<number>(1)

  useDidShow(() => {
    void getPointLadder().then((r) => {
      setLadder(r)
      if (r) setSelected(r.currentLevel)
    })
    void getMerchantBuff().then(setBuff).catch(() => setBuff(null))
  })

  if (!ladder) {
    return (
      <PageLayout nav={<NavBar title='我的段位' showBack onBack={() => Taro.navigateBack()} />}>
        <View style={{ padding: 48, display: 'flex', alignItems: 'center' }}>
          <Text style={{ ...fs(13), color: t.textTertiary }}>加载段位数据…</Text>
        </View>
      </PageLayout>
    )
  }

  const levels = ladder.levels
  const cur = levels.find((l) => l.level === selected) ?? levels[0]
  const isCur = selected === ladder.currentLevel
  const next = levels.find((l) => l.level === ladder.currentLevel + 1)
  const band = getLevelBand(cur.level)
  // 色带深底上统一白字，浅档（白银）也保证对比度（bg 均取中深色系）
  const nextGap = next ? Math.max(0, next.minTotalEarned - ladder.totalEarned) : 0
  const pct = next && next.minTotalEarned > 0
    ? Math.min(100, Math.max(2, Math.round((ladder.totalEarned / next.minTotalEarned) * 100)))
    : 100

  // 权益宫格：段位体系现有权益全列（锁定态给出口径说明）
  const perks: PerkCell[] = [
    { icon: 'badge-check', label: '段位彩牌', note: '昵称旁全端展示' },
    { icon: 'gift', label: '升档礼', note: cur.levelUpBonus > 0 ? `跨档 +${cur.levelUpBonus} 币` : '该档无升档礼' },
    { icon: 'zap', label: '赚币暴击', note: '全段位 10% 双倍 2% 传说' },
    { icon: 'store', label: '商家 buff', note: buff && buff.rank > 0 ? `${buff.merchantName ?? ''} Lv${buff.rank} 加成生效` : '入职商家享被动加成', locked: !buff || buff.rank <= 0 },
  ]

  const entries: { icon: string; label: string; url: string }[] = [
    { icon: 'list-checks', label: '怎么赚轴承币', url: '/pages/my/tasks' },
    { icon: 'medal', label: '勋章墙', url: '/pages/my/achievements' },
    { icon: 'coins', label: '收支明细', url: '/pages/my/points' },
    { icon: 'book-open', label: '轴承币规则', url: '/pages/rules/index?kind=points' },
  ]

  return (
    <PageLayout nav={<NavBar title='我的段位' showBack onBack={() => Taro.navigateBack()} />}>
      {/* 顶部段位 tab 条（美团式横滑，当前档下划线标记） */}
      <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ height: 44, backgroundColor: t.bgCard }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12 }}>
          {levels.map((l) => {
            const active = l.level === selected
            return (
              <View key={l.level} style={{ paddingLeft: 10, paddingRight: 10, height: 44, justifyContent: 'center' }} onClick={() => setSelected(l.level)}>
                <Text style={{ ...fs(13), color: active ? t.textPrimary : t.textTertiary, fontWeight: active ? '700' : '400' }}>{l.name}</Text>
                {active && <View style={{ height: 2, backgroundColor: t.primary, marginTop: 3, borderRadius: 1 }} />}
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* 段位大卡（选中档色带底；当前档附进度条与升档礼预告） */}
      <View style={{ margin: 12, borderRadius: 14, padding: 20, backgroundColor: band.bg }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(22), color: '#FFFFFF', fontWeight: 'bold' }}>Lv.{cur.level} {cur.name}</Text>
            <Text style={{ ...fs(12), color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
              {isCur ? `累计获得 ${ladder.totalEarned} 轴承币` : cur.reached ? '已达成的历史档位' : `累计获得达 ${cur.minTotalEarned} 解锁该档`}
            </Text>
          </View>
          <Icon name='crown' size={44} color='rgba(255,255,255,0.9)' />
        </View>
        {isCur && next ? (
          <View style={{ marginTop: 16 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', width: `${pct}%` }} />
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ ...fs(11), color: 'rgba(255,255,255,0.9)' }}>距升「{next.name}」还差 {nextGap} 币</Text>
              <Text style={{ ...fs(11), color: '#FFFFFF', fontWeight: '600' }}>升档礼 +{next.levelUpBonus}</Text>
            </View>
          </View>
        ) : null}
        {isCur && !next ? (
          <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600', marginTop: 12 }}>已达最高段位，独孤求败不过如此</Text>
        ) : null}
        {/* 选中档的升档礼领取态（历史档回看用） */}
        {!isCur && cur.level >= 2 && cur.levelUpBonus > 0 ? (
          <Text style={{ ...fs(11), color: 'rgba(255,255,255,0.9)', marginTop: 12 }}>
            {cur.bonusClaimed ? `升档礼 +${cur.levelUpBonus} 已领（终身一次）` : cur.reached ? `升档礼 +${cur.levelUpBonus} 待发放（下次赚币自动到账）` : `跨档可得升档礼 +${cur.levelUpBonus}`}
          </Text>
        ) : null}
      </View>

      {/* 可享权益宫格（2×2） */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12, padding: 14 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>段位权益</Text>
        <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {perks.map((p, i) => (
            <View key={i} style={{ width: '50%', marginTop: 8, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: p.locked ? t.primaryLight : band.bg + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Icon name={p.locked ? 'lock' : p.icon} size={18} color={p.locked ? t.textTertiary : band.bg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '500' }}>{p.label}</Text>
                <Text style={{ ...fs(11), color: t.textTertiary }} numberOfLines={1}>{p.note}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 10 }}>段位不给赚币倍率/额度（归商家 buff 通道）；等级只升不降</Text>
      </View>

      {/* 入口行 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12 }}>
        {entries.map((e, i) => (
          <View
            key={e.url}
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i === entries.length - 1 ? 0 : 1, borderBottomColor: t.border }}
            onClick={() => Taro.navigateTo({ url: e.url })}
          >
            <Icon name={e.icon} size={18} color={t.primary} />
            <Text style={{ ...fs(14), color: t.textPrimary, flex: 1, marginLeft: 10 }}>{e.label}</Text>
            <Icon name='chevron-right' size={16} color={t.textTertiary} />
          </View>
        ))}
      </View>
      <View style={{ height: 24 }} />
    </PageLayout>
  )
}
