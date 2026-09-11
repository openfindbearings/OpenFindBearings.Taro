// 登录页（RN 优先：仅用 Taro 跨端组件 + Flex + inline 主题色，无 H5 专有 CSS）
// 手机号 + 密码登录，成功后返回上一页；可跳注册；底部协议链接跳文档页
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { isChineseMobile } from '../../utils/validate'
import './auth.scss'

export default function LoginPage() {
  const t = useTheme()
  const fs = useFs()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const { login, loading } = useAuthStore()

  const doLogin = async () => {
    setMsg('')
    if (!phone || !password) {
      setMsg('请输入手机号和密码')
      return
    }
    // 改动说明：客户端先验手机号格式（即时反馈），BFF 层同规则兜底
    if (!isChineseMobile(phone)) {
      setMsg('请输入正确的手机号')
      return
    }
    try {
      await login(phone, password)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e: any) {
      setMsg(e?.message || '登录失败，请重试')
    }
  }

  return (
    <PageLayout nav={<NavBar title='登录' showBack onBack={() => Taro.navigateBack()} />}>
      <View className='auth-form' style={{ backgroundColor: t.bgCard }}>
        <Text className='auth-title' style={{ ...fs(22), color: t.textPrimary }}>欢迎回来</Text>
        <Text className='auth-sub' style={{ ...fs(13), color: t.textSecondary }}>登录后可收藏、关注商家、申请入驻</Text>

        <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
          <Icon name='phone' size={18} color={t.textTertiary} />
          <Input
            className='auth-input'
            style={{ ...fs(15), color: t.textPrimary }}
            type='number'
            maxlength={11}
            placeholder='请输入手机号'
            placeholderClass='auth-ph'
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>

        <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
          <Icon name='lock' size={18} color={t.textTertiary} />
          <Input
            className='auth-input'
            style={{ ...fs(15), color: t.textPrimary }}
            password
            placeholder='请输入密码'
            placeholderClass='auth-ph'
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        {!!msg && <Text className='auth-msg' style={{ ...fs(13), color: t.danger }}>{msg}</Text>}

        <View className='auth-btn' style={{ backgroundColor: t.primary }} onClick={loading ? undefined : doLogin}>
          <Text className='auth-btn-text' style={{ ...fs(16), color: t.textOnPrimary }}>{loading ? '登录中…' : '登录'}</Text>
        </View>

        <View className='auth-links'>
          <Text style={{ ...fs(14), color: t.textSecondary }}>没有账号？</Text>
          <Text className='auth-link' style={{ ...fs(14), color: t.primaryText }} onClick={() => Taro.redirectTo({ url: '/pages/auth/register' })}>注册</Text>
        </View>

        <View className='auth-agree'>
          <Text style={{ ...fs(12), color: t.textTertiary }}>登录即同意 </Text>
          <Text className='auth-link' style={{ ...fs(12), color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=user-agreement' })}>《用户协议》</Text>
          <Text style={{ ...fs(12), color: t.textTertiary }}> 与 </Text>
          <Text className='auth-link' style={{ ...fs(12), color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=privacy-policy' })}>《隐私政策》</Text>
        </View>
      </View>
    </PageLayout>
  )
}
