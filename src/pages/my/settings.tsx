// 设置页（详情页）
// NavBar：标题居中"设置"，左侧返回箭头（showBack），无右侧图标
// 图标颜色用 prop 传入（RN 端 CSS 变量失效）
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  ChevronRight, Moon, Smartphone, Sun,
  Bell, Volume2, RefreshCw, LogOut,
  Phone, User, Users, Shield, FileText, Trash2
} from 'lucide-react-taro'
import NavBar from '../../components/NavBar'
import { useThemeStore, ThemeMode } from '../../stores/theme'
import './settings.scss'

const SETTINGS_KEY = 'app_settings'

interface AppSettings {
  simpleHome: boolean
  fontSize: 'small' | 'medium' | 'large'
  pushEnabled: boolean
  adEnabled: boolean
  soundEnabled: boolean
  vibrateEnabled: boolean
}

const themeLabels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    simpleHome: false,
    fontSize: 'medium',
    pushEnabled: true,
    adEnabled: false,
    soundEnabled: true,
    vibrateEnabled: true
  })
  const theme = useThemeStore((s) => s.mode)
  const setTheme = useThemeStore((s) => s.setMode)
  const [showThemePicker, setShowThemePicker] = useState(false)

  useDidShow(() => {
    const saved: AppSettings = Taro.getStorageSync(SETTINGS_KEY) || {
      simpleHome: false,
      fontSize: 'medium',
      pushEnabled: true,
      adEnabled: false,
      soundEnabled: true,
      vibrateEnabled: true
    }
    setSettings(saved)
  })

  const save = (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates }
    Taro.setStorageSync(SETTINGS_KEY, next)
    setSettings(next)
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorageSync()
          Taro.reLaunch({ url: '/pages/home/index' })
        }
      }
    })
  }

  const navigate = (title: string) => {
    Taro.showToast({ title: `${title}（开发中）`, icon: 'none' })
  }

  // 切换主题：setTheme 内部会自动写入 localStorage 并应用到 <html data-theme>
  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode)
    setShowThemePicker(false)
  }

  return (
    <View className='settings-page'>
      <NavBar title="设置" showBack />

      <View className='section'>
        <Text className='section-title'>外观</Text>
        <View className='list'>
          <View className='list-item' onClick={() => setShowThemePicker(!showThemePicker)}>
            <View className='list-left'>
              <View className='list-icon'>
                <Moon size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>深色模式</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>{themeLabels[theme]}</Text>
              <ChevronRight size={16} color='#94A3B8' />
            </View>
          </View>

          {showThemePicker && (
            <>
              <View className='list-item indent' onClick={() => applyTheme('light')}>
                <View className='list-left'>
                  <View className='list-icon sm'>
                    <Sun size={15} color='#F59E0B' />
                  </View>
                  <Text className='list-label'>浅色模式</Text>
                </View>
                {theme === 'light' && <View className='check-dot' />}
              </View>
              <View className='list-item indent' onClick={() => applyTheme('dark')}>
                <View className='list-left'>
                  <View className='list-icon sm'>
                    <Moon size={15} color='#0EA5E9' />
                  </View>
                  <Text className='list-label'>深色模式</Text>
                </View>
                {theme === 'dark' && <View className='check-dot' />}
              </View>
              <View className='list-item indent' onClick={() => applyTheme('system')}>
                <View className='list-left'>
                  <View className='list-icon sm'>
                    <Smartphone size={15} color='#64748B' />
                  </View>
                  <Text className='list-label'>跟随系统</Text>
                </View>
                {theme === 'system' && <View className='check-dot' />}
              </View>
            </>
          )}

          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0EA5E9' }}>A</Text>
              </View>
              <Text className='list-label'>字体大小</Text>
            </View>
            <View className='list-right'>
              <View className='font-size-picker'>
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <View
                    key={s}
                    className={`font-btn ${settings.fontSize === s ? 'active' : ''}`}
                    onClick={() => save({ fontSize: s })}
                  >
                    <Text style={{ fontSize: s === 'small' ? 12 : s === 'medium' ? 14 : 16 }}>
                      {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>消息</Text>
        <View className='list'>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Bell size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>消息推送</Text>
            </View>
            <View
              className={`toggle ${settings.pushEnabled ? 'on' : ''}`}
              onClick={() => save({ pushEnabled: !settings.pushEnabled })}
            >
              <View className='toggle-thumb' />
            </View>
          </View>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Text style={{ fontSize: 14, color: '#0EA5E9' }}>📢</Text>
              </View>
              <Text className='list-label'>广告设置</Text>
            </View>
            <View
              className={`toggle ${settings.adEnabled ? 'on' : ''}`}
              onClick={() => save({ adEnabled: !settings.adEnabled })}
            >
              <View className='toggle-thumb' />
            </View>
          </View>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>通用</Text>
        <View className='list'>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Volume2 size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>音效</Text>
            </View>
            <View
              className={`toggle ${settings.soundEnabled ? 'on' : ''}`}
              onClick={() => save({ soundEnabled: !settings.soundEnabled })}
            >
              <View className='toggle-thumb' />
            </View>
          </View>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <RefreshCw size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>震动</Text>
            </View>
            <View
              className={`toggle ${settings.vibrateEnabled ? 'on' : ''}`}
              onClick={() => save({ vibrateEnabled: !settings.vibrateEnabled })}
            >
              <View className='toggle-thumb' />
            </View>
          </View>
          <View className='list-item' onClick={() => navigate('版本更新')}>
            <View className='list-left'>
              <View className='list-icon'>
                <RefreshCw size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>版本更新</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>v1.0.0</Text>
              <ChevronRight size={16} color='#94A3B8' />
            </View>
          </View>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>隐私</Text>
        <View className='list'>
          <View className='list-item' onClick={() => navigate('隐私管理')}>
            <View className='list-left'>
              <View className='list-icon'>
                <Shield size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>隐私管理</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
          <View className='list-item' onClick={() => navigate('隐私政策')}>
            <View className='list-left'>
              <View className='list-icon'>
                <FileText size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>隐私政策</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
          <View className='list-item' onClick={() => navigate('个人信息收集清单')}>
            <View className='list-left'>
              <View className='list-icon'>
                <User size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>个人信息收集清单</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
          <View className='list-item' onClick={() => navigate('第三方信息共享清单')}>
            <View className='list-left'>
              <View className='list-icon'>
                <Users size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>第三方信息共享清单</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
        </View>
      </View>

      <View className='section'>
        <View className='list'>
          <View className='list-item' onClick={() => navigate('个人信息')}>
            <View className='list-left'>
              <View className='list-icon'>
                <User size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>个人信息</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
          <View className='list-item' onClick={() => navigate('服务热线')}>
            <View className='list-left'>
              <View className='list-icon'>
                <Phone size={18} color='#0EA5E9' />
              </View>
              <Text className='list-label'>服务热线</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>400-xxx-xxxx</Text>
              <ChevronRight size={16} color='#94A3B8' />
            </View>
          </View>
          <View className='list-item danger' onClick={() => navigate('注销账户')}>
            <View className='list-left'>
              <View className='list-icon danger'>
                <Trash2 size={18} color='#EF4444' />
              </View>
              <Text className='list-label danger'>注销账户</Text>
            </View>
            <ChevronRight size={16} color='#94A3B8' />
          </View>
        </View>
      </View>

      <View className='section'>
        <View className='list'>
          <View className='list-item danger' onClick={handleLogout}>
            <View className='list-left center'>
              <LogOut size={18} color='#EF4444' />
              <Text className='list-label danger'>退出登录</Text>
            </View>
          </View>
        </View>
      </View>

      <Text className='footer'>
        登录即表示同意
        <Text className='link' onClick={() => navigate('用户协议')}>《用户协议》</Text>
        和
        <Text className='link' onClick={() => navigate('隐私政策')}>《隐私政策》</Text>
      </Text>
    </View>
  )
}
