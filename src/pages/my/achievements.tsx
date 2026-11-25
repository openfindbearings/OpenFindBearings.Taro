// 我的勋章页（v1.4.47 蜜雪式改版）：深色 hero（头像 + 已点亮 N/M）→ 弧形分类页签 →
// 整页图鉴网格（已获得彩色带日期、未获得灰度带进度）→ 点任意一枚弹详情；
// 功能区（当前称号与勋章点摘要、佩戴称号选择）保留，下移到图鉴之后。
// 改动说明：原「大圆盘舞台 + 分类行列表」把同一批勋章展示两遍，且 5 枚时排成 3+2 显得散；
//   改版后上半静态只交代身份与总量，动效全部收敛在下半的弧面切页，同时把未解锁勋章纳入视野。
// 平台差异由 MedalGallery 内部按 .rn.tsx / index.tsx 分文件处理，本页三端写法一致。
// RN 约束：仅 flex、无 fixed/vh/gradient、Text 包裹文本
import { useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import LoginGuide from '../../components/LoginGuide'
import MedalGallery from '../../components/MedalGallery'
import { useAuthStore } from '../../stores/auth'
import { usableImage } from '../../services/config'
import { maskMobile } from '../../components/MedalGallery/types'
import {
  getAchievementWall,
  getMyTitles,
  equipTitle,
  type AchievementWall,
  type MyTitles,
} from '../../services/achievements'

// 编译期配置：与全站一致，滚动由 PageLayout 统一提供
definePageConfig({ disableScroll: true })

export default function AchievementsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const authUser = useAuthStore((s) => s.user)
  const [wall, setWall] = useState<AchievementWall | null>(null)
  const [titles, setTitles] = useState<MyTitles | null>(null)

  useDidShow(() => {
    if (isLoggedIn) {
      void getAchievementWall().then((r) => setWall(r || null))
      void getMyTitles().then((r) => setTitles(r || null))
    }
  })

  /** 佩戴/卸下称号（点当前佩戴=卸下），成功后回写本地态 */
  const onEquip = async (title: string | null) => {
    const r = await equipTitle(title ?? '')
    if (r) setTitles((prev) => (prev ? { ...prev, equippedTitle: title } : prev))
  }

  // 分类分页：按目录出现顺序聚合，每类一页，页内保留未解锁项
  const pages = useMemo(() => {
    const items = wall?.items || []
    const cats = Array.from(new Set(items.map((i) => i.category)))
    return cats.map((cat) => {
      const inCat = items.filter((i) => i.category === cat)
      return { label: cat, items: inCat, unlockedCount: inCat.filter((i) => i.unlocked).length }
    })
  }, [wall])

  /** 图鉴下方功能区：荣誉摘要 + 佩戴称号 */
  const footer = (
    <View>
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...fs(12), color: t.textTertiary }}>当前称号</Text>
          <Text style={{ ...fs(16), color: wall?.currentTitle ? '#F59E0B' : t.textTertiary, fontWeight: '700', marginTop: 2 }}>
            {wall?.currentTitle || '暂未获得'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...fs(22), color: t.primary, fontWeight: '700' }}>{wall?.totalMetaPoints ?? 0}</Text>
          <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>勋章点 · 荣誉不花</Text>
        </View>
      </View>

      {titles && titles.titles.length > 0 && (
        <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, padding: 14 }}>
          <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '600' }}>佩戴称号</Text>
          <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              {titles.titles.map((tt) => {
                const active = titles.equippedTitle === tt
                return (
                  <View
                    key={tt}
                    onClick={() => void onEquip(active ? null : tt)}
                    style={{
                      marginRight: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
                      backgroundColor: active ? t.primary : t.bgMain, borderStyle: 'solid', borderWidth: 1,
                      borderColor: active ? t.primary : t.borderColor,
                    }}
                  >
                    <Text style={{ ...fs(12), color: active ? '#FFFFFF' : t.textSecondary, fontWeight: active ? '600' : '400' }}>
                      {tt}{active ? ' ✓' : ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          </ScrollView>
          <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>点选已解锁称号佩戴，点当前佩戴可卸下</Text>
        </View>
      )}
      <View style={{ height: 40 }} />
    </View>
  )

  return (
    <PageLayout nav={<NavBar title='我的勋章' showBack />}>
      {!isLoggedIn && <LoginGuide icon='award' text='登录后查看你的勋章' />}
      {isLoggedIn && wall && (
        <MedalGallery
          pages={pages}
          avatarUrl={usableImage(authUser?.avatar)}
          name={authUser?.nickname || authUser?.userName || '我'}
          subtitle={maskMobile(authUser?.phoneNumber)}
          unlockedCount={wall.unlockedCount ?? 0}
          totalCount={wall.items?.length ?? 0}
          footer={footer}
        />
      )}
    </PageLayout>
  )
}
