import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuthStore } from '../../stores/authStore'
import { getMyMerchantProfile, type MyMerchantProfile } from '../../services/merchantManage'
import ApplyForm from './components/ApplyForm'
import PendingStatus from './components/PendingStatus'
import ManagePanel from './components/ManagePanel'
import './index.scss'

/** 入驻/商家 Tab 主页 */
export default function MerchantPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [profile, setProfile] = useState<MyMerchantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = () => {
    if (!isLoggedIn) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getMyMerchantProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }

  useDidShow(loadProfile)
  useEffect(loadProfile, [isLoggedIn])

  if (!isLoggedIn) {
    return (
      <View className='merchant-page'>
        <View className='merchant-page__empty'>
          <Text className='merchant-page__empty-icon'>🏪</Text>
          <Text className='merchant-page__empty-text'>登录后可申请入驻</Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className='merchant-page'>
        <Text className='merchant-page__loading'>加载中...</Text>
      </View>
    )
  }

  // 根据状态切换视图
  if (!profile || profile.status === 'None') {
    return <ApplyForm onSuccess={loadProfile} />
  }

  if (profile.status === 'Pending') {
    return <PendingStatus profile={profile} />
  }

  return <ManagePanel profile={profile} onUpdate={loadProfile} />
}
