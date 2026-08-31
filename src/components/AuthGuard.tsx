import { type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthStore } from '../stores/authStore'

/** 登录守卫：未登录时拦截操作并弹窗提示 */
export default function AuthGuard({ children, message = '请先登录' }: { children: ReactNode; message?: string }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const handleTap = () => {
    if (!isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: message,
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: '/pages/profile/index' })
          }
        },
      })
      return
    }
  }

  return (
    <View onClick={handleTap}>
      {isLoggedIn ? children : <View>{children}</View>}
    </View>
  )
}
