import { View, Text, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuthStore } from '../../stores/authStore'
import { logout } from '../../services/auth'
import UserHeader from './components/UserHeader'
import FavoriteList from './components/FavoriteList'
import FollowedList from './components/FollowedList'
import HistoryList from './components/HistoryList'
import './index.scss'

/** 我的 Tab 主页 */
export default function ProfilePage() {
  const { isLoggedIn, user, logout: storeLogout } = useAuthStore()
  const [activeSection, setActiveSection] = useState<'favorite' | 'followed' | 'history'>('favorite')

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          storeLogout()
          Taro.showToast({ title: '已退出', icon: 'success' })
        }
      },
    })
  }

  return (
    <View className='profile-page'>
      <UserHeader />

      {isLoggedIn ? (
        <>
          {/* 功能分区切换 */}
          <View className='profile-tabs'>
            <View
              className={`profile-tabs__item ${activeSection === 'favorite' ? 'active' : ''}`}
              onClick={() => setActiveSection('favorite')}
            >
              <Text>收藏</Text>
            </View>
            <View
              className={`profile-tabs__item ${activeSection === 'followed' ? 'active' : ''}`}
              onClick={() => setActiveSection('followed')}
            >
              <Text>关注</Text>
            </View>
            <View
              className={`profile-tabs__item ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => setActiveSection('history')}
            >
              <Text>浏览记录</Text>
            </View>
          </View>

          {/* 内容区 */}
          <View className='profile-content'>
            {activeSection === 'favorite' && <FavoriteList />}
            {activeSection === 'followed' && <FollowedList />}
            {activeSection === 'history' && <HistoryList />}
          </View>

          {/* 退出按钮 */}
          <View className='profile-actions'>
            <Button className='profile-actions__logout' onClick={handleLogout}>
              退出登录
            </Button>
          </View>
        </>
      ) : (
        <View className='profile-login-hint'>
          <Text className='profile-login-hint__text'>
            登录后可收藏轴承、关注商家和查看浏览记录
          </Text>
        </View>
      )}
    </View>
  )
}
