// 注册页（RN 优先）
// 手机号 + 密码 + 确认密码 + 协议勾选；注册即登录（BFF signup+password grant）
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

export default function RegisterPage() {
  const t = useTheme()
  const fs = useFs()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [msg, setMsg] = useState('')
  const { register, loading } = useAuthStore()

  const doRegister = async () => {
    setMsg('')
    if (!phone || !password || !confirm) {
      setMsg('请填写完整信息')
      return
    }
    // 改动说明：客户端先验手机号格式（即时反馈），BFF 层同规则兜底
    if (!isChineseMobile(phone)) {
      setMsg('请输入正确的手机号')
      return
    }
    if (password.length < 6) {
      setMsg('密码至少 6 位')
      return
    }
    if (password !== confirm) {
      setMsg('两次输入的密码不一致')
      return
    }
    if (!agreed) {
      setMsg('请先阅读并同意用户协议与隐私政策')
      return
    }
    try {
      await register(phone, password, true)
      Taro.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e: any) {
      setMsg(e?.message || '注册失败，请重试')
    }
  }

  return (
    <PageLayout nav={<NavBar title='注册' showBack onBack={() => Taro.navigateBack()} />}>
      <View className='auth-form' style={{ backgroundColor: t.bgCard }}>
        <Text className='auth-title' style={{ ...fs(22), color: t.textPrimary }}>创建账号</Text>
        <Text className='auth-sub' style={{ ...fs(13), color: t.textSecondary }}>使用手机号注册，开启收藏与入驻</Text>

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
            placeholder='设置密码（至少 6 位）'
            placeholderClass='auth-ph'
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
          <Icon name='lock' size={18} color={t.textTertiary} />
          <Input
            className='auth-input'
            style={{ ...fs(15), color: t.textPrimary }}
            password
            placeholder='确认密码'
            placeholderClass='auth-ph'
            value={confirm}
            onInput={(e) => setConfirm(e.detail.value)}
          />
        </View>

        {/* 协议勾选：自绘可点方框（RN 无原生 checkbox，保持跨端一致） */}
        <View className='auth-row' onClick={() => setAgreed(!agreed)}>
          <View
            className='auth-checkbox'
            style={{ borderColor: agreed ? t.primary : t.border, backgroundColor: agreed ? t.primary : 'transparent' }}
          >
            {agreed && <Icon name='check' size={12} color={t.textOnPrimary} />}
          </View>
          <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>
            我已阅读并同意
            <Text className='auth-link' style={{ color: t.primaryText }} onClick={(e) => { e.stopPropagation?.(); Taro.navigateTo({ url: '/pages/common/doc?type=user-agreement' }) }}>《用户协议》</Text>
            与
            <Text className='auth-link' style={{ color: t.primaryText }} onClick={(e) => { e.stopPropagation?.(); Taro.navigateTo({ url: '/pages/common/doc?type=privacy-policy' }) }}>《隐私政策》</Text>
          </Text>
        </View>

        {!!msg && <Text className='auth-msg' style={{ ...fs(13), color: t.danger }}>{msg}</Text>}

        <View className='auth-btn' style={{ backgroundColor: t.primary }} onClick={loading ? undefined : doRegister}>
          <Text className='auth-btn-text' style={{ ...fs(16), color: t.textOnPrimary }}>{loading ? '注册中…' : '注册并登录'}</Text>
        </View>

        <View className='auth-links'>
          <Text style={{ ...fs(14), color: t.textSecondary }}>已有账号？</Text>
          <Text className='auth-link' style={{ ...fs(14), color: t.primaryText }} onClick={() => Taro.redirectTo({ url: '/pages/auth/login' })}>去登录</Text>
        </View>
      </View>
    </PageLayout>
  )
}
