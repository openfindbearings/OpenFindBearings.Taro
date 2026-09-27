// 成就墙页（v2.1.0 成就子系统）：全成就目录+本人进度，未解锁灰显带"如何获得"提示+进度条，
// 已解锁点亮+稀有标；顶部成就点合计与当前称号。RN 约束：仅 flex、无 fixed/vh、Text 数值 lineHeight
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { getAchievementWall, type AchievementWall, type AchievementItem } from '../../services/achievements'

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

/** 单个成就卡：已解锁点亮主题色、未解锁灰显+进度条+如何获得提示 */
function AchievementCard({ item, t, fs }: { item: AchievementItem; t: any; fs: (n: number) => any }) {
  const pct = item.target > 0 ? Math.min(100, Math.round((item.progress / item.target) * 100)) : 0
  return (
    <View style={{
      backgroundColor: item.unlocked ? t.bgCard : t.bgMain,
      borderRadius: 12, padding: 12, marginBottom: 10,
      borderWidth: 1, borderColor: item.unlocked ? t.primary : t.borderColor,
      opacity: item.unlocked || item.hidden ? 1 : 0.75,
      display: 'flex', flexDirection: 'row', alignItems: 'center'
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: item.unlocked ? t.primary : t.borderColor
      }}>
        <Icon name={item.icon || 'award'} size={22} color={item.unlocked ? '#FFFFFF' : t.textTertiary} />
      </View>
      <View style={{ flex: 1, marginLeft: 10, display: 'flex', flexDirection: 'column' }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...fs(15), color: item.unlocked ? t.textPrimary : t.textSecondary, fontWeight: '600' }}>{item.name}</Text>
          {item.rare && <Text style={{ ...fs(11), color: t.warning, marginLeft: 6 }}>稀有</Text>}
          {item.unlocked && item.titleReward && <Text style={{ ...fs(11), color: t.primary, marginLeft: 6 }}>称号·{item.titleReward}</Text>}
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
          {item.unlocked ? item.description : `${item.description}（${item.progress}/${item.target}）`}
        </Text>
        {!item.unlocked && (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: t.borderColor, marginTop: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.primary, width: `${pct}%` }} />
          </View>
        )}
      </View>
      <Text style={{ ...fs(12), color: item.unlocked ? t.primary : t.textTertiary }}>+{item.metaPoints}</Text>
    </View>
  )
}

export default function AchievementsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [wall, setWall] = useState<AchievementWall | null>(null)

  useDidShow(() => {
    if (isLoggedIn) void getAchievementWall().then((r) => setWall(r || null))
  })

  // 按分类分组展示
  const categories = Array.from(new Set((wall?.items || []).map((i) => i.category)))

  return (
    <PageLayout nav={<NavBar title='成就墙' showBack />}>
      {!isLoggedIn && <LoginGuide icon='award' text='登录后查看你的成就墙' />}
      {isLoggedIn && (
        <ScrollView style={{ flex: 1 }}>
          <View style={{ backgroundColor: t.bgCard, margin: 12, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(22), color: t.primary, fontWeight: '700' }}>{wall?.totalMetaPoints ?? 0}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>成就点（只加不花的荣誉分）</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...fs(14), color: t.textPrimary }}>{wall?.currentTitle || '暂无称号'}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>已点亮 {wall?.unlockedCount ?? 0} 个</Text>
            </View>
          </View>
          {categories.map((cat) => (
            <View key={cat} style={{ marginLeft: 12, marginRight: 12 }}>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 8, marginBottom: 8 }}>{cat}</Text>
              {(wall?.items || []).filter((i) => i.category === cat).map((item) => (
                <AchievementCard key={item.key} item={item} t={t} fs={fs} />
              ))}
            </View>
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </PageLayout>
  )
}
