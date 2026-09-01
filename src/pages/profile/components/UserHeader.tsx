import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { User } from 'lucide-react-taro'
import { useAuthStore } from '../../../stores/authStore'
import { loginWithPassword } from '../../../services/auth'

/** 用户头像/昵称/登录入口 */
export default function UserHeader() {
  const { isLoggedIn, user, login } = useAuthStore()

  const handleLogin = () => {
    // 简易登录弹窗（后续改为独立登录页）
    Taro.showModal({
      title: '登录',
      editable: true,
      placeholderText: '请输入手机号',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        const phone = res.content.trim()
        if (!/^1\d{10}$/.test(phone)) {
          Taro.showToast({ title: '手机号格式错误', icon: 'none' })
          return
        }
        // 密码登录弹窗
        Taro.showModal({
          title: '输入密码',
          editable: true,
          placeholderText: '请输入密码',
          success: async (pwdRes) => {
            if (!pwdRes.confirm || !pwdRes.content) return
            try {
              const result = await loginWithPassword(phone, pwdRes.content)
              login(result.user)
              Taro.showToast({ title: '登录成功', icon: 'success' })
            } catch (e: unknown) {
              Taro.showToast({ title: (e as Error).message || '登录失败', icon: 'none' })
            }
          },
        })
      },
    })
  }

  return (
    <View className='user-header'>
      <View className='user-header__avatar'>
        <View className='user-header__avatar-text'>
          <User size={32} color='#fff' strokeWidth={1.5} />
        </View>
      </View>
      {isLoggedIn ? (
        <View className='user-header__info'>
          <Text className='user-header__name'>{user?.name || '用户'}</Text>
          <Text className='user-header__phone'>{user?.phone || ''}</Text>
        </View>
      ) : (
        <View className='user-header__login' onClick={handleLogin}>
          <Text className='user-header__login-text'>点击登录</Text>
        </View>
      )}
    </View>
  )
}
