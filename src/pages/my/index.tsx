import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { User, Heart, Users, Clock, LogIn, Bell, Settings, LayoutGrid } from 'lucide-react-taro'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

interface UserInfo {
  nickname: string
  phone: string
  avatar: string
  isLoggedIn: boolean
}

const menuItems = [
  { key: 'favorites', label: '收藏轴承', icon: Heart, iconClass: 'icon-danger' },
  { key: 'followed', label: '关注商家', icon: Users, iconClass: 'icon-primary' },
  { key: 'history', label: '浏览历史', icon: Clock, iconClass: 'icon-success' },
  { key: 'more', label: '更多', icon: LayoutGrid, iconClass: 'icon-secondary' }
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
    switch (key) {
      case 'settings':
        Taro.navigateTo({ url: '/pages/my/settings' })
        break
      default:
        Taro.showToast({ title: '功能开发中', icon: 'none' })
    }
  }

  return (
    <View className='my-page'>
      {/* NavBar */}
      <View className='nav-bar'>
        <View className='nav-bar-left'>
          <Text className='nav-bar-title'>我的</Text>
        </View>
        <View className='nav-bar-right'>
          <View className='nav-icon' onClick={() => Taro.showToast({ title: '消息功能开发中', icon: 'none' })}>
            <Bell size={22} />
          </View>
          <View className='nav-icon' onClick={() => Taro.navigateTo({ url: '/pages/my/settings' })}>
            <Settings size={22} />
          </View>
        </View>
      </View>

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

      {/* 积分/金币卡片（预留） */}
      <View className='points-card'>
        <View className='points-item'>
          <Text className='points-label'>我的积分</Text>
          <Text className='points-value'>--</Text>
        </View>
        <View className='points-divider' />
        <View className='points-item'>
          <Text className='points-label'>收支明细</Text>
          <Text className='points-value'>--</Text>
        </View>
      </View>

      {/* 功能菜单 - 横向大图标 */}
      <View className='menu-grid'>
        {menuItems.map((item) => (
          <View
            key={item.key}
            className='grid-item'
            onClick={() => handleMenuClick(item.key)}
          >
            <View className={`grid-icon ${item.iconClass}`}>
              <item.icon size={28} />
            </View>
            <Text className='grid-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* 版本信息 */}
      <View className='version-info'>
        <Text>OpenFindBearings v1.0.0</Text>
      </View>

      <CustomTabBar />
    </View>
  )
}
