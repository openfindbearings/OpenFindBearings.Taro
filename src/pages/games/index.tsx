// 游戏中心页（v2.10.1）：注册表 GAMES 驱动渲染——available 可玩、comingSoon 置灰"敬请期待"。
// 赚分纪律卡置顶（每局 5 分/日上限 10 分），让用户对奖励预期透明。
// RN 约束：仅 flex、无 fixed/渐变/vh、Text 包裹、数值 lineHeight。
import { View, Text} from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import { useAuthStore } from '../../stores/auth'
import LoginGuide from '../../components/LoginGuide'
import { GAMES } from '../../services/games'

definePageConfig({ disableScroll: true })

/** 游戏中心页 */
export default function GamesPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const openGame = (route?: string, status?: string) => {
    if (status !== 'available') {
      Taro.showToast({ title: '敬请期待', icon: 'none' })
      return
    }
    if (route) Taro.navigateTo({ url: route })
  }

  return (
    <PageLayout nav={<NavBar title='游戏中心' showBack />}>
      {!isLoggedIn && <LoginGuide icon='puzzle' text='登录后玩游戏赚轴承币' />}
      {isLoggedIn && (
        <View>
          {/* 头部说明卡：主题色浅底 + 赚分纪律（预期透明） */}
          <View style={{ marginLeft: 16, marginRight: 16, marginTop: 16, borderRadius: 16, backgroundColor: t.primaryLight, padding: 16 }}>
            <Text style={{ ...fs(17), color: t.textPrimary, fontWeight: '700' }}>玩小游戏，赚轴承币</Text>
            <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>
              每局胜利 +5 分，每日上限 10 分；题目都来自平台真实轴承数据，玩着玩着就认识型号了
            </Text>
          </View>

          {/* 游戏卡片列表（注册表驱动） */}
          {GAMES.map((g) => {
            const locked = g.status !== 'available'
            return (
              <View
                key={g.key}
                style={{
                  display: 'flex', flexDirection: 'row',
                  display: 'flex', alignItems: 'center',
                  backgroundColor: t.bgCard,
                  marginLeft: 16,
                  marginRight: 16,
                  marginTop: 12,
                  borderRadius: 16,
                  padding: 16,
                  opacity: locked ? 0.55 : 1
                }}
                onClick={() => openGame(g.route, g.status)}
              >
                {/* 图标容器：游戏专属色浅底圆角块 */}
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: locked ? t.bgInput : t.primaryLight, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Icon name={g.icon} size={28} color={locked ? t.textTertiary : g.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600' }}>{g.name}</Text>
                    {locked ? (
                      <Text style={{ ...fs(10), color: t.textTertiary, backgroundColor: t.bgInput, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, marginLeft: 8 }}>敬请期待</Text>
                    ) : (
                      <Text style={{ ...fs(10), color: '#16A34A', backgroundColor: t.primaryLight, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, marginLeft: 8 }}>可玩</Text>
                    )}
                  </View>
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{g.desc}</Text>
                </View>
                <Icon name='chevron-right' size={18} color={t.textTertiary} />
              </View>
            )
          })}

          {/* 合规脚注：轴承币红线口径（与规则页一致） */}
          <View style={{ marginLeft: 16, marginRight: 16, marginTop: 20 }}>
            <Text style={{ ...fs(11), color: t.textTertiary }}>
              轴承币不可充值、不可提现、不可转让；小游戏是平台的活跃奖励，不是收益渠道
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </View>
      )}
    </PageLayout>
  )
}
