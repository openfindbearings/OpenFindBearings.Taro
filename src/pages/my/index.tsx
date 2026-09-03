// 我的页（Tab 根页）
// NavBar：标题居中"我的"，右侧保留 Bell（消息中心）+ Settings（设置入口）
// 内容：用户信息区 + 功能菜单（收藏/关注/历史）
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { User, Heart, Users, Clock, LogIn, Bell, Settings } from 'lucide-react-taro'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

interface UserInfo {
  nickname: string
  phone: string
  avatar: string
  isLoggedIn: boolean
}

// 功能菜单配置（图标颜色用 prop 传入，不依赖 className）
const menuItems = [
  { key: 'favorites', label: '收藏轴承', icon: Heart, color: '#EF4444' },
  { key: 'followed', label: '关注商家', icon: Users, color: '#0EA5E9' },
  { key: 'history', label: '浏览历史', icon: Clock, color: '#10B981' },
  { key: 'settings', label: '设置', icon: Settings, color: '#64748B' }
]

export default function MyPage() {
  const [user, setUser] = useState<UserInfo>({
    nickname: '',
    phone: '',
    avatar: '',
    isLoggedIn: false
  })

  useDidShow(() => {
    const token = Taro.getStorageSync('access_token')
    const nickname = Taro.getStorageSync('user_nickname') || ''
    const phone = Taro.getStorageSync('user_phone') || ''
    const avatar = Taro.getStorageSync('user_avatar') || ''
    setUser({
      nickname: nickname || (token ? '已登录用户' : ''),
      phone,
      avatar,
      isLoggedIn: !!token
    })
  })

  const handleMenuClick = (key: string) => {
    if (key === 'settings') {
      Taro.navigateTo({ url: '/pages/my/settings' })
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

  // NavBar 右侧：Bell + Settings
  const rightSlot = (
    <>
      <View className='navbar-icon' onClick={handleBellClick}>
        <Bell size={22} />
      </View>
      <View className='navbar-icon' onClick={handleSettingsClick} style={{ marginLeft: 4 }}>
        <Settings size={22} />
      </View>
    </>
  )

  return (
    <View className='my-page'>
      <NavBar title="我的" rightSlot={rightSlot} />

      {/* 用户信息区 */}
      <View className='user-section'>
        {user.isLoggedIn ? (
          <View className='user-info'>
            <View className='avatar'>
              {user.avatar ? (
                <Image className='avatar-img' src={user.avatar} mode='aspectFill' />
              ) : (
                <User size={32} color='#FFFFFF' />
              )}
            </View>
            <View className='user-detail'>
              <Text className='nickname'>{user.nickname || '已登录用户'}</Text>
              {user.phone && <Text className='phone'>{user.phone}</Text>}
            </View>
          </View>
        ) : (
          <View className='user-info' onClick={() => Taro.showToast({ title: '登录功能开发中', icon: 'none' })}>
            <View className='avatar'>
              <LogIn size={28} color='#FFFFFF' />
            </View>
            <View className='user-detail'>
              <Text className='nickname'>点击登录</Text>
              <Text className='phone'>登录后享受更多功能</Text>
            </View>
          </View>
        )}
      </View>

      {/* 功能菜单 - 横向四宫格 */}
      <View className='menu-grid'>
        {menuItems.map((item) => (
          <View
            key={item.key}
            className='grid-item'
            onClick={() => handleMenuClick(item.key)}
          >
            <View className='grid-icon'>
              <item.icon size={28} color={item.color} />
            </View>
            <Text className='grid-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      <CustomTabBar />
    </View>
  )
}
