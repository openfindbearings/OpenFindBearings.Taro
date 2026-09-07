// 我的页（Tab 根页）
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight hack）；补审核 P2-8 缺失元素——
// 会员信息卡（积分/余额占位，纯色主色底）与版本信息行；NavBar 右侧图标 20→24dp。
// NavBar：标题居中"我的"，右侧 Bell（消息中心）+ Settings（设置入口）
// 内容：用户信息区 + 会员卡 + 功能卡（收藏/关注/历史/全部功能 四横钮）
import { useState } from 'react'
import Icon from '../../components/Icon'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import LinearGradient from 'react-native-linear-gradient'
import { getItem } from '../../utils/storage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

interface UserInfo {
  nickname: string
  phone: string
  avatar: string
  isLoggedIn: boolean
}

// 功能菜单配置（横向四宫格：收藏/关注/历史/全部功能）
// 第4项为"全部功能"（layout_grid 图标），设置仅在 NavBar 右上角
const menuItems = [
  { key: 'favorites', label: '收藏轴承', icon: 'heart', color: '#EF4444' },
  { key: 'followed', label: '关注商家', icon: 'users', color: '#0EA5E9' },
  { key: 'history', label: '浏览历史', icon: 'clock', color: '#10B981' },
  { key: 'all_features', label: '全部功能', icon: 'layout_grid', color: '#6366F1' }
]

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function MyPage() {
  const [user, setUser] = useState<UserInfo>({
    nickname: '',
    phone: '',
    avatar: '',
    isLoggedIn: false
  })
  // 主题色板（会员卡渐变/用户区底/图标底/文字随模式）+ 全局字号
  const t = useTheme()
  const fs = useFs()

  useDidShow(() => {
    Promise.all([
      getItem('access_token'),
      getItem('user_nickname'),
      getItem('user_phone'),
      getItem('user_avatar')
    ]).then(([token, nickname, phone, avatar]) => {
      setUser({
        nickname: nickname || (token ? '已登录用户' : ''),
        phone: phone || '',
        avatar: avatar || '',
        isLoggedIn: !!token
      })
    }).catch(() => { /* 默认未登录状态 */ })
  })

  const handleMenuClick = (key: string) => {
    // 全部功能：跳转功能大全页（含收藏/关注/历史/消息/设置）
    if (key === 'all_features') {
      Taro.navigateTo({ url: '/pages/my/all-features' })
      return
    }
    if (!user.isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            // TODO: 跳转登录页
          }
        }
      })
      return
    }
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  const handleBellClick = () => {
    Taro.showToast({ title: '消息中心开发中', icon: 'none' })
  }

  const handleSettingsClick = () => {
    Taro.navigateTo({ url: '/pages/my/settings' })
  }

  // 个人信息入口：本轮从设置页移到"我的"页头像（登录态点击头像进入）。
  // 个人信息详情页尚未实现，先占位提示，接入页面后改为 navigateTo。
  const handleProfileClick = () => {
    Taro.showToast({ title: '个人信息开发中', icon: 'none' })
  }

  // 会员卡（美团风格）：收支明细入口与去兑换按钮暂为占位
  const handlePointsDetail = () => {
    Taro.showToast({ title: '收支明细开发中', icon: 'none' })
  }

  const handleRedeem = () => {
    Taro.showToast({ title: '积分兑换开发中', icon: 'none' })
  }

  // NavBar 右侧：Bell + Settings。改用声明式 rightIcons 交给 NavBar 内部渲染——
  // 规避 Taro RN className 文件作用域限制（此前在本文件写 navbar-icon 类，
  // 编译期按 my 页样式表查不到该类，图标触控框/间距全丢，导致两图标紧贴）。
  const rightIcons = [
    { name: 'bell', onClick: handleBellClick },
    { name: 'settings', onClick: handleSettingsClick }
  ]

  // 会员卡阴影：Taro 不转 Android elevation，inline 补。
  // 类型断言原因：shadow*/elevation 是 RN 专有样式属性，Taro 的 CSSProperties 类型未声明
  const memberCardStyle = {
    shadowColor: 'rgba(2, 132, 199, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 1,
    elevation: 3
  } as any

  return (
    <PageLayout nav={<NavBar title="我的" rightIcons={rightIcons} />} tabbar={<CustomTabBar />}>
      {/* 用户信息区 */}
      <View className='user-section'>
        {user.isLoggedIn ? (
          <View className='user-info' style={{ backgroundColor: t.primary }} onClick={handleProfileClick}>
            <View className='avatar'>
              {user.avatar ? (
                <Image className='avatar-img' src={user.avatar} mode='aspectFill' />
              ) : (
                <Icon name="user" size={32} color={t.textOnPrimary} />
              )}
            </View>
            <View className='user-detail'>
              <Text className='nickname' style={{ ...fs(17), color: t.textOnPrimary }}>{user.nickname || '已登录用户'}</Text>
              {user.phone && <Text className='phone' style={{ ...fs(13), color: t.textOnPrimary }}>{user.phone}</Text>}
            </View>
          </View>
        ) : (
          <View className='user-info' style={{ backgroundColor: t.primary }} onClick={() => Taro.showToast({ title: '登录功能开发中', icon: 'none' })}>
            <View className='avatar'>
              <Icon name="log_in" size={28} color={t.textOnPrimary} />
            </View>
            <View className='user-detail'>
              <Text className='nickname' style={{ ...fs(17), color: t.textOnPrimary }}>点击登录</Text>
              <Text className='phone' style={{ ...fs(13), color: t.textOnPrimary }}>登录后享受更多功能</Text>
            </View>
          </View>
        )}
      </View>

      {/* 会员卡（美团风格渐变）：顶部积分大数字 + 收支明细入口，底部积分兑换按钮。
          背景用 react-native-linear-gradient 标准原生渐变（主题蓝天蓝系），
          替代之前"RN 不支持渐变"妥协的单一纯色实现——RN 端原生组件可直接使用。 */}
      <LinearGradient
        colors={[t.memberGradientFrom, t.memberGradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className='member-card'
        style={memberCardStyle}
      >
        <View className='member-head'>
          <Text className='member-head-title' style={{ ...fs(13), color: t.textOnPrimary }}>我的积分</Text>
          <View className='member-detail' onClick={handlePointsDetail}>
            <Text className='member-detail-text' style={{ ...fs(13), color: t.textOnPrimary }}>收支明细</Text>
            <Icon name="chevron_right" size={14} color={t.textOnPrimary} />
          </View>
        </View>

        <View className='member-main'>
          <Text className='member-points' style={{ ...fs(32), color: t.textOnPrimary }}>0</Text>
          <Text className='member-points-label' style={{ ...fs(13), color: t.textOnPrimary }}>积分</Text>
        </View>

        <View className='member-foot'>
          <Text className='member-foot-tip' style={{ ...fs(12), color: t.textOnPrimary }}>积分可兑换现金</Text>
          <View className='member-redeem' style={{ backgroundColor: t.textOnPrimary + '22' }} onClick={handleRedeem}>
            <Text className='member-redeem-text' style={{ ...fs(13), color: t.textOnPrimary }}>去兑换</Text>
          </View>
        </View>
      </LinearGradient>

      {/* 功能卡 - 横向四宫格 */}
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
    </PageLayout>
  )
}
