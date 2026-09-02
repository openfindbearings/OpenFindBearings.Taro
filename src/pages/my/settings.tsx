import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ArrowLeft, ChevronRight, LayoutGrid, Moon, Smartphone, Sun } from 'lucide-react-taro'
import './settings.scss'

const SETTINGS_KEY = 'app_settings'
const THEME_KEY = 'app_theme'
type ThemeMode = 'light' | 'dark' | 'system'

interface AppSettings {
  simpleHome: boolean
}

const themeLabels: Record<ThemeMode, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统'
}

export default function SettingsPage() {
  const [simpleHome, setSimpleHome] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [showThemePicker, setShowThemePicker] = useState(false)

  useDidShow(() => {
    const settings: AppSettings = Taro.getStorageSync(SETTINGS_KEY) || { simpleHome: false }
    setSimpleMode(settings.simpleHome)
    const saved: ThemeMode = Taro.getStorageSync(THEME_KEY) || 'light'
    setTheme(saved)
  })

  const setSimpleMode = (val: boolean) => {
    setSimpleHome(val)
    const settings: AppSettings = { simpleHome: val }
    Taro.setStorageSync(SETTINGS_KEY, settings)
  }

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode)
    Taro.setStorageSync(THEME_KEY, mode)
    setShowThemePicker(false)
    // #ifdef H5
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark', 'theme-system')
    root.classList.add(`theme-${mode}`)
    // #endif
  }

  return (
    <View className='settings-page'>
      {/* 导航栏 */}
      <View className='nav-bar'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} className='icon-primary' />
        </View>
        <Text className='nav-title'>设置</Text>
      </View>

      {/* 外观设置 */}
      <View className='settings-group'>
        <Text className='group-title'>外观</Text>
        <View className='setting-item' onClick={() => setShowThemePicker(!showThemePicker)}>
          <View className='setting-left'>
            <View className='setting-icon icon-bg-primary'>
              <Moon size={18} className='icon-on-card' />
            </View>
            <Text className='setting-label'>暗黑模式</Text>
          </View>
          <View className='setting-right'>
            <Text className='setting-value'>{themeLabels[theme]}</Text>
            <ChevronRight size={16} className='icon-tertiary' />
          </View>
        </View>
      </View>

      {/* 主题选择面板 */}
      {showThemePicker && (
        <View className='settings-group'>
          <Text className='group-title'>主题模式</Text>
          <View className='setting-item' onClick={() => applyTheme('light')}>
            <View className='setting-left'>
              <View className='setting-icon icon-bg-warning'>
                <Sun size={18} className='icon-warning' />
              </View>
              <Text className='setting-label'>浅色模式</Text>
            </View>
            {theme === 'light' && <View className='check-dot' />}
          </View>
          <View className='setting-item' onClick={() => applyTheme('dark')}>
            <View className='setting-left'>
              <View className='setting-icon icon-bg-primary'>
                <Moon size={18} className='icon-on-card' />
              </View>
              <Text className='setting-label'>深色模式</Text>
            </View>
            {theme === 'dark' && <View className='check-dot' />}
          </View>
          <View className='setting-item' onClick={() => applyTheme('system')}>
            <View className='setting-left'>
              <View className='setting-icon icon-bg-success'>
                <Smartphone size={18} className='icon-success' />
              </View>
              <Text className='setting-label'>跟随系统</Text>
            </View>
            {theme === 'system' && <View className='check-dot' />}
          </View>
        </View>
      )}

      {/* 首页设置 */}
      <View className='settings-group'>
        <Text className='group-title'>功能</Text>
        <View className='setting-item'>
          <View className='setting-left'>
            <View className='setting-icon icon-bg-secondary'>
              <LayoutGrid size={18} className='icon-secondary' />
            </View>
            <View className='setting-text'>
              <Text className='setting-label'>简洁模式</Text>
              <Text className='setting-desc'>首页仅显示搜索框和快捷入口</Text>
            </View>
          </View>
          <View
            className={`toggle ${simpleHome ? 'on' : ''}`}
            onClick={() => setSimpleMode(!simpleHome)}
          >
            <View className='toggle-thumb' />
          </View>
        </View>
      </View>
    </View>
  )
}
