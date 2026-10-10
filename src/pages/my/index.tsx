// 我的页（Tab 根页）
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight hack）；补审核 P2-8 缺失元素——
// 会员信息卡（轴承币/余额占位，纯色主色底）与版本信息行；NavBar 右侧图标 20→24dp。
// NavBar：标题居中"我的"，右侧 Bell（消息中心）+ Settings（设置入口）
// 内容：用户信息区 + 会员卡 + 功能卡（收藏/关注/历史/全部功能 四横钮）
import Icon from '../../components/Icon'
import MedalImage from '../../components/MedalImage'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
// 改动说明（v1.7.11 沉浸式渐变头部）：useState 管滚动浮现度；useSafeArea 供渐变内容避让状态栏
import { useState } from 'react'
import { useSafeArea } from '../../utils/use-safe-area'
// 改动说明：原直接 import react-native-linear-gradient 会让 H5 webpack 打包 RN 原生模块而报
// ModuleParseError；改用平台分文件的 Gradient 组件（RN 走原生、H5/小程序走 CSS 渐变），JSX 用法不变。
import LinearGradient from '../../components/Gradient'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { usableImage } from '../../services/config'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
// 改动说明（v1.7.17 轴承币底座）：账户/签到服务 + 签到成功长震反馈
import { getPointAccount, type PointAccount } from '../../services/points'
// v2.12.0 等级玩法：段位彩牌色带（青铜~王者）
import { getLevelBand } from '../../utils/level'
// v2.1.0 成就子系统：个人徽章排（我的页轴承币卡下方横向徽章条）
import { getMyAchievements, getMyTitles, type AchievementWall } from '../../services/achievements'
import './index.scss'

// 功能菜单配置（横向四宫格：收藏/关注/历史/全部功能）
// 第4项为"全部功能"（layout_grid 图标），设置仅在 NavBar 右上角
const menuItems = [
  { key: 'favorites', label: '收藏轴承', icon: 'heart', color: '#EF4444' },
  { key: 'followed', label: '关注商家', icon: 'users', color: '#0EA5E9' },
  { key: 'history', label: '浏览历史', icon: 'clock', color: '#10B981' },
  // v1.7.18 补：我的纠错上第一行（此前实施遗漏）
  { key: 'corrections', label: '我的纠错', icon: 'file_text', color: '#EF4444' },
  // v1.7.18 第二行：我的寻货（占位）、任务中心（赚分）、设置、全部功能兜底（寻货与任务中心按需求换序）
  { key: 'sourcing', label: '我的寻货', icon: 'search', color: '#0EA5E9' },
  { key: 'tasks', label: '任务中心', icon: 'gift', color: '#F59E0B' },
  // 改动说明（v2.10.1 游戏中心）：宫格"设置"位换成"游戏中心"（设置入口保留在 NavBar 右上角不丢）
  { key: 'games', label: '游戏中心', icon: 'puzzle', color: '#0EA5E9' },
  { key: 'all_features', label: '全部功能', icon: 'layout_grid', color: '#6366F1' }
]

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function MyPage() {
  // 改动说明：登录态与用户资料改为订阅 auth store（唯一事实源）。
  // 原实现依赖 useDidShow + 读 storage 的本地 state，登录成功 navigateBack 后
  // 若 didShow 时序不触发就永不刷新；store 订阅保证登录/登出即时响应。
  // 冷启动的 storage 恢复统一由 app.tsx 的 init() 完成。
  // 改动说明：头像从 storage('user_avatar' 无人写入的断链) 改为订阅 store user.avatar，
  // 个人信息页保存 → fetchProfile → 本页即时显示
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const authUser = useAuthStore((s) => s.user)
  const avatar = usableImage(authUser?.avatar)
  // 主题色板（会员卡渐变/用户区底/图标底/文字随模式）+ 全局字号
  const t = useTheme()
  const fs = useFs()
  // 未读消息数（铃铛红点，与 TabBar 角标同源 store）
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  // v1.7.17 轴承币账户（未登录零值兜底）
  const [points, setPoints] = useState<PointAccount>({ balance: 0, totalEarned: 0, totalSpent: 0, todayCheckedIn: false, consecutiveDays: 0 })
  // v2.1.0 成就子系统：已解锁个人徽章排（轴承币卡下方横向徽章条）
  const [myAch, setMyAch] = useState<AchievementWall | null>(null)
  // v2.6.0 勋章卡改版：最近解锁优先露出前 12 枚（unlockedAt 为 ISO 串，字典序即时间序）
  const medalItems = (myAch?.items ?? [])
    .slice()
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 12)
  // v2.8.0 称号系统：当前佩戴称号（昵称旁金色徽章）
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null)

  useDidShow(() => {
    // 每次显示时拉一次资料，保证登录成功 navigateBack 后昵称/手机/头像立即刷新
    if (isLoggedIn) void useAuthStore.getState().fetchProfile()
    // 改动说明（v1.7.8）：拉取未读消息数，与消息中心页、TabBar 角标同源同刷（store 单例）
    void useNotificationStore.getState().fetchUnread()
    // v1.7.17：轴承币账户与签到状态随页刷新
    if (isLoggedIn) void getPointAccount().then(setPoints)
    // v2.1.0：徽章排随页刷新（未登录清空）
    if (isLoggedIn) void getMyAchievements().then((r) => setMyAch(r || null)).catch(() => setMyAch(null))
    else setMyAch(null)
    // v2.8.0 称号系统：佩戴称号随页刷新
    if (isLoggedIn) void getMyTitles().then((r) => setEquippedTitle(r?.equippedTitle || null)).catch(() => setEquippedTitle(null))
    else setEquippedTitle(null)
  })

  const handleMenuClick = (key: string) => {
    // 全部功能：跳转功能大全页（含收藏/关注/历史/消息/设置）
    if (key === 'all_features') {
      Taro.navigateTo({ url: '/pages/my/all-features' })
      return
    }
    // 改动说明：收藏/关注/历史三入口从"开发中"占位改为跳转真实页面；
    // 页面内部自带未登录引导空态，此处不再弹窗拦截（少一层打断）
    const menuUrls: Record<string, string> = {
      favorites: '/pages/my/favorites',
      followed: '/pages/my/followed',
      history: '/pages/my/history',
      // v1.7.18：任务中心/设置/我的纠错直跳页面；v1.7.19：我的寻货转正（原占位 toast）
      tasks: '/pages/my/tasks',
      corrections: '/pages/my/corrections',
      sourcing: '/pages/my/sourcing',
      settings: '/pages/my/settings',
      games: '/pages/games/index'
    }
    if (menuUrls[key]) {
      Taro.navigateTo({ url: menuUrls[key] })
      return
    }
    Taro.showToast({ title: '功能暂未上线', icon: 'none' })
  }

  // 改动说明（v1.7.8）：铃铛从"暂未上线"占位改为跳转消息中心（页面早已存在，此前漏接线）；
  //   红点与 TabBar"我的"角标同源（notification store），点开消息即消
  const handleBellClick = () => {
    Taro.navigateTo({ url: '/pages/notifications/index' })
  }

  const handleSettingsClick = () => {
    Taro.navigateTo({ url: '/pages/my/settings' })
  }

  // 个人信息入口：登录态点击头像进入编辑页（未登录仍走"点击登录"卡片）。
  // 改动说明：详情页已实现，占位 toast 改为跳转。
  const handleProfileClick = () => {
    Taro.navigateTo({ url: '/pages/my/profile-edit' })
  }

  // 会员卡（v1.7.17）：收支明细接轴承币流水页；去兑换仍占位（商城 P8 未上线）
  const handlePointsDetail = () => {
    Taro.navigateTo({ url: '/pages/my/points' })
  }

  const handleRedeem = () => {
    Taro.showToast({ title: '轴承币兑换暂未上线', icon: 'none' })
  }

  // NavBar 右侧：Bell + Settings。改用声明式 rightIcons 交给 NavBar 内部渲染——
  // 规避 Taro RN className 文件作用域限制（此前在本文件写 navbar-icon 类，
  // 编译期按 my 页样式表查不到该类，图标触控框/间距全丢，导致两图标紧贴）。
  const rightIcons = [
    { name: 'bell', onClick: handleBellClick, badge: unreadCount },
    { name: 'settings', onClick: handleSettingsClick }
  ]

  // 会员卡阴影：Taro 不转 Android elevation，inline 补。
  // 类型断言原因：shadow*/elevation 是 RN 专有样式属性，Taro 的 CSSProperties 类型未声明
  const cardShadow = {
    shadowColor: 'rgba(0, 0, 0, 0.10)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 1,
    elevation: 3
  } as any

  // 改动说明（v1.7.11 沉浸式渐变头部）：滚动 40→120px 区间线性求导航浮现度，
  //   双层 nav 交叉淡入——白图标透明层（1-fade）与白底标题深色层（fade）互换透明度
  const [scrollY, setScrollY] = useState(0)
  const fade = Math.min(1, Math.max(0, (scrollY - 40) / 80))
  // 状态栏安全区：渐变延伸到顶，内容需吃 paddingTop 避让透明 nav
  const { top: safeTop } = useSafeArea()

  return (
    <PageLayout
      immersive
      onScrollY={setScrollY}
      tabbar={<CustomTabBar />}
      nav={
        <View style={{ position: 'relative' }}>
          {/* 底层：透明沉浸（渐变深底上白色图标，无标题） */}
          <View style={{ opacity: 1 - fade }}>
            <NavBar
              background='transparent'
              contentColor='#FFFFFF'
              showBorder={false}
              rightIcons={rightIcons}
            />
          </View>
          {/* 改动说明（v1.7.19）：浮现层去掉"我的"标题——weapp 胶囊把右侧图标推近居中会撞标题；
              主流 App 的"我的"页以头像/白底头部为标识，导航不重复标题 */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: fade }}>
            <NavBar rightIcons={rightIcons} />
          </View>
        </View>
      }
    >
      {/* 渐变头部容器（v1.7.11）：主题渐变铺满状态栏下，含用户信息 + 四宫格；
          白色内容板（轴承币卡）负 margin 上浮叠在渐变底部——美团/携程同款层次 */}
      <LinearGradient
        colors={[t.memberGradientFrom, t.memberGradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        className='header-gradient'
      >
        <View style={{ paddingTop: safeTop + 8 }}>
          {/* 用户信息区（渐变深底：白字白描边） */}
          <View className='user-section'>
            {isLoggedIn ? (
              <View className='user-info' onClick={handleProfileClick}>
                <View className='avatar' style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
                  {avatar ? (
                    <Image className='avatar-img' src={avatar} mode='aspectFill' />
                  ) : (
                    <Icon name="user" size={30} color="#FFFFFF" />
                  )}
                </View>
                <View className='user-detail'>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <Text className='nickname' style={{ ...fs(19), color: '#FFFFFF' }}>{authUser?.nickname || authUser?.userName || '已登录用户'}</Text>
                    {/* v2.8.0 称号系统：佩戴称号金色徽章（昵称旁） */}
                    {equippedTitle && (
                      <View style={{ marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#F59E0B' }}>
                        <Text style={{ ...fs(11), color: '#FDE68A', fontWeight: '600' }}>{equippedTitle}</Text>
                      </View>
                    )}
                  </View>
                  {/* v2.13.0 等级玩法：段位彩牌挪至用户信息卡（对标主流账号卡版式，替代手机号行），
                      点击进段位详情页；手机号在资料编辑页仍可见 */}
                  <View onClick={() => { if (isLoggedIn) void Taro.navigateTo({ url: '/pages/my/level' }) }}>
                    <View style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: getLevelBand(points.level).bg, borderRadius: 10, paddingLeft: 8, paddingRight: 5, paddingTop: 2, paddingBottom: 2, marginTop: 4 }}>
                      <Text style={{ ...fs(11), color: '#FFFFFF', fontWeight: '600' }}>Lv.{points.level ?? 1} {points.levelName ?? ''}</Text>
                      <Icon name='chevron-right' size={12} color='#FFFFFF' />
                    </View>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.85)" />
              </View>
            ) : (
              <View className='user-info' onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}>
                <View className='avatar' style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
                  <Icon name="log_in" size={26} color="#FFFFFF" />
                </View>
                <View className='user-detail'>
                  <Text className='nickname' style={{ ...fs(19), color: '#FFFFFF' }}>点击登录</Text>
                  <Text className='phone' style={{ ...fs(13), color: 'rgba(255,255,255,0.85)' }}>登录后享受更多功能</Text>
                </View>
                <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.85)" />
              </View>
            )}
          </View>

          {/* 改动说明（v1.7.11 二次调整）：四宫格从渐变区移出，还原为白卡片放轴承币卡下方 */}
        </View>
      </LinearGradient>

      {/* 轴承币卡（v1.7.11 改白卡）：原渐变背景上移给头部后，此卡回归普通白卡——
          负 margin 上浮叠在渐变底部，顶部大圆角。
          改动说明：文案"轴承币可兑换现金"违反轴承币合规红线（不可兑现），改"兑换精选礼品" */}
      <View className='member-card-white' style={{ ...cardShadow, backgroundColor: t.bgCard }}>
        <View className='member-head'>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>我的轴承币</Text>
            {/* 改动说明（v2.13.0）：段位彩牌上移至用户信息卡（此处撤除防双份） */}
          </View>
          <View className='member-detail' onClick={handlePointsDetail}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>收支明细</Text>
            <Icon name="chevron_right" size={14} color={t.textTertiary} />
          </View>
        </View>
        <View className='member-main'>
          {/* v1.7.18：余额保留真数据；签到胶囊撤除（一行摆不下显示不全），赚分动作收进任务中心 */}
          <Text style={{ ...fs(30), color: t.primary, fontWeight: 'bold' }}>{points.balance}</Text>
          <Text style={{ ...fs(13), color: t.textSecondary, marginLeft: 6, marginBottom: 4 }}>轴承币</Text>
        </View>
        <View className='member-foot'>
          <Text style={{ ...fs(12), color: t.textTertiary }}>活跃赚轴承币，可兑换精选礼品</Text>
          <View className='member-redeem' style={{ backgroundColor: t.primary }} onClick={handleRedeem}>
            <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>去兑换</Text>
          </View>
        </View>
      </View>

      {/* 功能卡 - 横向四宫格（白卡样式，v1.7.11 调整到轴承币卡下方） */}
      <View className='menu-grid' style={{ backgroundColor: t.bgCard }}>
        {menuItems.map((item) => (
          <View
            key={item.key}
            className='grid-item'
            onClick={() => handleMenuClick(item.key)}
          >
            <View className='grid-icon'>
              <Icon name={item.icon} size={28} color={item.color} />
            </View>
            <Text className='grid-label' style={{ ...fs(13), color: t.textSecondary }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* v2.6.0 勋章卡改版（承 v2.1.0 徽章条）：头部"我的勋章 + 共 N 枚 ›"，
          主体横向勋章排——rare 金环/普通主题色环双色描边模拟金属感，下方勋章名一行；
          整卡点进成就墙；改动说明（用户定案）：卡片常驻显示不再判断 >0，0 枚显示引导；
          位置调整（用户定案）：移到功能四宫格下方（轴承币→功能→勋章 三段递进） */}
      <View
        // 改动说明：左右 16px 对齐 menu-grid/轴承币卡的 $space-4 栅格（原 12 比功能卡宽 8px）
        style={{ backgroundColor: t.bgCard, marginLeft: 16, marginRight: 16, marginTop: 12, marginBottom: 16, borderRadius: 12, padding: 14 }}
        onClick={() => Taro.navigateTo({ url: '/pages/my/achievements' })}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', flex: 1 }}>我的勋章</Text>
          <Text style={{ ...fs(13), color: t.textTertiary }}>共 {myAch?.unlockedCount ?? 0} 枚 ›</Text>
        </View>
        {medalItems.length === 0 ? (
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>
            {isLoggedIn ? '签到、纠错、寻货都能点亮勋章，从第一枚开始攒' : '登录后查看你的勋章墙'}
          </Text>
        ) : (
        <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ height: 84, marginTop: 10 }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            {medalItems.map((b) => {
              return (
                <View key={b.key} style={{ width: 64, display: 'flex', alignItems: 'center', marginRight: 6 }}>
                  {/* 勋章图组件统一渲染：无图回退双环占位（rare 金环/主题环） */}
                  <MedalImage imageKey={b.imageKey} icon={b.icon || 'award'} rare={b.rare} variant='card' primary={t.primary} primaryLight={t.primaryLight} />
                  <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 4 }} numberOfLines={1}>
                    {b.name}
                  </Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
        )}
      </View>
    </PageLayout>
  )
}
