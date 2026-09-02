import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { User, Heart, Users, Clock, Settings, ChevronRight, LogIn } from 'lucide-react-taro'
import CustomTabBar from '../../custom-tab-bar'
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
  { key: 'settings', label: '设置', icon: Settings, iconClass: 'icon-secondary' }
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
    if (!user.isLoggedIn && key !== 'settings') {
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
      {/* 用户信息区 */}
      <View className='user-section'>
        {user.isLoggedIn ? (
          <View className='user-info'>
            <View className='avatar'>
              {user.avatar ? (
                <Image className='avatar-img' src={user.avatar} mode='aspectFill' />
              ) : (
                <User size={28} color='#FFFFFF' />
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
              <LogIn size={24} color='#FFFFFF' />
            </View>
            <View className='user-detail'>
              <Text className='nickname'>点击登录</Text>
              <Text className='phone'>登录后享受更多功能</Text>
            </View>
          </View>
        )}
      </View>

      {/* 功能菜单 */}
      <View className='menu-section'>
        {menuItems.map((item) => (
          <View
            key={item.key}
            className='menu-item'
            onClick={() => handleMenuClick(item.key)}
          >
            <View className='menu-left'>
              <View className={`menu-icon ${item.iconClass}`}>
                <item.icon size={20} />
              </View>
              <Text className='menu-label'>{item.label}</Text>
            </View>
            <ChevronRight size={16} className='icon-tertiary' />
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
