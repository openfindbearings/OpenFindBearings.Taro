// 商家勋章页（v1.4.47 蜜雪式改版）：商家管理页「商家勋章卡」的落地展示页，版式与个人勋章页共用 MedalGallery——
// 深色 hero（商户名 + 已点亮 N/M）→ 弧形分类页签 → 整页图鉴网格 → 点击弹详情；下方保留荣誉摘要条。
// 改动说明：原「大圆盘舞台 + 分类行列表」与个人页同病（同批勋章展示两遍、枚数少时排版散），
//   现统一到同一组件，两页只差数据源与 hero 文案。
// 数据源=getMerchantAchievementsWall（scope=Merchant 全目录 + 本店进度，仅在职成员）；公开详情页仍用已解锁徽章排。
// RN 约束：仅 flex、无 fixed/vh/gradient、Text 数值 lineHeight
import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import LoginGuide from '../../components/LoginGuide'
import MedalGallery from '../../components/MedalGallery'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { getMerchantAchievementsWall, type AchievementWall } from '../../services/achievements'

// 编译期配置：与全站一致，滚动由 PageLayout 统一提供
definePageConfig({ disableScroll: true })

export default function MerchantMedalsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [wall, setWall] = useState<AchievementWall | null>(null)
  // 展示对象=当前商家上下文（商家管理页进入时必已选定商家）
  const current = useMerchantStore((s) => s.currentMerchant())

  useDidShow(() => {
    if (isLoggedIn && current?.merchantId) void getMerchantAchievementsWall(current.merchantId).then((r) => setWall(r || null))
  })

  // 分类分页：按目录出现顺序聚合，每类一页，页内保留未解锁项
  const pages = useMemo(() => {
    const items = wall?.items || []
    const cats = Array.from(new Set(items.map((i) => i.category)))
    return cats.map((cat) => {
      const inCat = items.filter((i) => i.category === cat)
      return { label: cat, items: inCat, unlockedCount: inCat.filter((i) => i.unlocked).length }
    })
  }, [wall])

  /** 图鉴下方功能区（v1.4.53）：商家没有佩戴称号的通道，称号是个人侧概念（User.EquippedTitle），
   *  因此这里不再展示"当前称号"，改为"下一个目标"引导 + 勋章点摘要 */
  const nextGoal = useMemo(() => {
    const locked = (wall?.items || []).filter((i) => !i.unlocked)
    if (locked.length === 0) return null
    // 取进度比例最高的一枚：距离点亮最近，提示最有用
    return locked
      .slice()
      .sort((a, b) => (b.progress / Math.max(1, b.target)) - (a.progress / Math.max(1, a.target)))[0]
  }, [wall])

  const footer = (
    <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ ...fs(12), color: t.textTertiary }}>下一个目标</Text>
        <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '700', marginTop: 2 }}>
          {nextGoal ? nextGoal.name : '已全部点亮'}
        </Text>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>
          {nextGoal ? `${nextGoal.description}（${nextGoal.progress}/${nextGoal.target}）` : '荣誉已收齐，继续保持'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ ...fs(22), color: t.primary, fontWeight: '700' }}>{wall?.totalMetaPoints ?? 0}</Text>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>勋章点 · 荣誉不花</Text>
      </View>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title='商家勋章' showBack />}>
      {!isLoggedIn && <LoginGuide icon='award' text='登录后查看商家勋章' />}
      {isLoggedIn && wall && pages.length > 0 && (
        <MedalGallery
          pages={pages}
          avatarIcon='store'
          name={current?.merchantName || '本商家'}
          unlockedCount={wall.unlockedCount ?? 0}
          totalCount={wall.items?.length ?? 0}
          footer={footer}
        />
      )}
      {isLoggedIn && wall && pages.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Icon name='award' size={36} color={t.textTertiary} />
          <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 10 }}>该商家暂无可展示的勋章</Text>
        </View>
      )}
    </PageLayout>
  )
}