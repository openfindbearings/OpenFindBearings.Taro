// 商家勋章页（v2.6.0 双界面拆分）：商家管理页"商家勋章卡"的落地展示页，版式镜像个人勋章页——
// 勋章舞台（已获得平铺+点选聚焦+获得日期）→ 荣誉摘要条（称号+勋章点）→ 分类分组列表。
// 改动说明（v2.9.0 舞台平铺）：与个人勋章页同步，去掉横向轮播（RN pagingEnabled 按视口翻页会错位、
//   小程序 96 高容器裁掉勋章描边），已获得勋章平铺居中、点击选中。
// 数据源=getMerchantAchievements(当前商家)（scope=Merchant），与公开主页（merchantDetail）互不混用。
// RN 约束：仅 flex、无 fixed/vh/gradient、Text 数值 lineHeight
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { formatDate } from '../../utils/format'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { getMerchantAchievements, type AchievementWall, type AchievementItem } from '../../services/achievements'
import { useMerchantStore } from '../../stores/merchant'
import MedalImage from '../../components/MedalImage'

// 编译期配置：禁用外层 ScrollView，滚动由页内 ScrollView 统一提供
definePageConfig({ disableScroll: true })

/** ISO UTC → 中文长日期（浏览器/WebView 按本地时区换算，符合展示层转换规则；失败回退日期截断） */
function fmtEarnDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    return formatDate(iso)
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * 舞台勋章：MedalImage 统一渲染（有图用后台勋章图，无图回退双环占位）。
 * 改动说明（v2.9.0）：去掉固定 112 占位宽，改由外层 flexWrap 居中平铺，点击触发选中
 */
function StageMedal({ item, active, isDark, primary, onSelect }: { item: AchievementItem; active: boolean; isDark: boolean; primary: string; onSelect: () => void }) {
  return (
    <View onClick={onSelect} style={{ margin: 6, display: 'flex', alignItems: 'center' }}>
      <MedalImage imageKey={item.imageKey} icon={item.icon || 'award'} rare={item.rare} variant='stage' primary={primary} isDark={isDark} active={active} />
    </View>
  )
}

/** 单个成就卡：已解锁点亮主题色、未解锁灰显+进度条+如何获得提示 */
function AchievementCard({ item, t, fs }: { item: AchievementItem; t: any; fs: (n: number) => any }) {
  const pct = item.target > 0 ? Math.min(100, Math.round((item.progress / item.target) * 100)) : 0
  return (
    <View style={{
      backgroundColor: item.unlocked ? t.bgCard : t.bgMain,
      borderRadius: 12, padding: 12, marginBottom: 10,
      borderStyle: 'solid', borderWidth: 1, borderColor: item.unlocked ? t.primary : t.borderColor,
      opacity: item.unlocked || item.hidden ? 1 : 0.75,
      display: 'flex', flexDirection: 'row', alignItems: 'center'
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        backgroundColor: item.unlocked ? t.primary : t.borderColor
      }}>
        {item.unlocked && item.imageKey ? (
          <MedalImage imageKey={item.imageKey} icon={item.icon || 'award'} rare={item.rare} variant='card' primary={t.primary} size={44} />
        ) : (
          <Icon name={item.icon || 'award'} size={22} color={item.unlocked ? '#FFFFFF' : t.textTertiary} />
        )}
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

export default function MerchantMedalsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [wall, setWall] = useState<AchievementWall | null>(null)
  // 展示对象=当前商家上下文（商家管理页进入时必已选定商家）
  const current = useMerchantStore((s) => s.currentMerchant())
  // 舞台选中索引（onScroll 换算）
  const [sel, setSel] = useState(0)

  useDidShow(() => {
    if (isLoggedIn && current?.merchantId) void getMerchantAchievements(current.merchantId).then((r) => setWall(r || null))
  })

  // 已解锁勋章：最近获得排前（unlockedAt ISO 串字典序即时间序）
  const unlocked = (wall?.items || [])
    .filter((i) => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
  const focus = unlocked.length > 0 ? unlocked[Math.min(sel, unlocked.length - 1)] : null

  // 按分类分组展示（保持目录原有顺序聚合）
  const categories = Array.from(new Set((wall?.items || []).map((i) => i.category)))

  return (
    <PageLayout nav={<NavBar title='商家勋章' showBack />}>
      {!isLoggedIn && <LoginGuide icon='award' text='登录后查看商家勋章' />}
      {isLoggedIn && (
        <View>
          {/* 1. 勋章舞台：展台底色深浅双轨（深底近黑/浅底近白），已获得勋章平铺居中+点选聚焦 */}
          <View style={{ backgroundColor: t.isDark ? '#111827' : '#F8FAFC', margin: 12, borderRadius: 16, paddingTop: 12, paddingBottom: 14 }}>
            {unlocked.length > 0 ? (
              <>
                <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 8, paddingRight: 8 }}>
                  {unlocked.map((m, i) => (
                    <StageMedal
                      key={m.key}
                      item={m}
                      active={Math.min(sel, unlocked.length - 1) === i}
                      isDark={t.isDark}
                      primary={t.primary}
                      onSelect={() => setSel(i)}
                    />
                  ))}
                </View>
                {focus && (
                  <View style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                    {/* 改动说明（v2.9.0）：原日期/归属文字硬编码深底浅色（#E2E8F0/#94A3B8），
                        浅色主题下几乎不可读，改为按主题取色 */}
                    <Text style={{ ...fs(14), color: t.isDark ? '#E2E8F0' : t.textPrimary }}>
                      {fmtEarnDate(focus.unlockedAt)} 获得此勋章
                    </Text>
                    <Text style={{ ...fs(12), color: t.isDark ? '#94A3B8' : t.textSecondary, marginTop: 4 }}>
                      {focus.category} · {focus.name}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={{ display: 'flex', alignItems: 'center', paddingTop: 26, paddingBottom: 26 }}>
                <Icon name='award' size={36} color={t.isDark ? '#475569' : '#94A3B8'} />
                <Text style={{ ...fs(13), color: t.isDark ? '#94A3B8' : t.textSecondary, marginTop: 10 }}>
                  还没有点亮的勋章，完成下方任务即可获得
                </Text>
              </View>
            )}
          </View>

          {/* 2. 荣誉摘要条：称号为叙事主角（金色），勋章点为数值佐证 */}
          <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>当前称号</Text>
              <Text style={{ ...fs(16), color: wall?.currentTitle ? '#F59E0B' : t.textTertiary, fontWeight: '700', marginTop: 2 }}>
                {wall?.currentTitle || '暂未获得'}
              </Text>
            </View>
            <View style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Text style={{ ...fs(22), color: t.primary, fontWeight: '700' }}>{wall?.totalMetaPoints ?? 0}</Text>
              <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>勋章点 · 荣誉不花</Text>
            </View>
          </View>

          {/* 3. 分类分组列表：组头带 已点亮/总数 进度 */}
          <View style={{ marginLeft: 12, marginRight: 12, marginTop: 16 }}>
            {categories.map((cat) => {
              const inCat = (wall?.items || []).filter((i) => i.category === cat)
              const doneInCat = inCat.filter((i) => i.unlocked).length
              return (
                <View key={cat} style={{ marginBottom: 6 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', marginTop: 8, marginBottom: 8 }}>
                    <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>{cat}</Text>
                    <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 6 }}>{doneInCat}/{inCat.length}</Text>
                  </View>
                  {inCat.map((item) => (
                    <AchievementCard key={item.key} item={item} t={t} fs={fs} />
                  ))}
                </View>
              )
            })}
          </View>
          <View style={{ height: 80 }} />
        </View>
      )}
    </PageLayout>
  )
}
