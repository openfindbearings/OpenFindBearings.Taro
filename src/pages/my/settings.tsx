// 设置页（详情页）— v1.7.0 度量重构，纯 RN 基准
// 改动说明（本轮设置页折腾）：
//   1. 开关控件由自绘 View(.toggle) 改用 Taro 标准 <Switch>（RN 映射原生 Switch，
//      修复自绘 thumb 定位在 RN 下显示异常的老问题）；
//   2. "个人信息"入口从设置页移除，改由"我的"页头像进入（见 my/index.tsx）；
//   3. "注销账户""退出登录"按登录态条件渲染：未登录隐藏，登录才显示；
//   4. "首页模式"默认普通；点击"简洁"未登录时弹"请先登录"（复用我的页门槛逻辑），
//      点击"普通"始终允许；
//   5. 深色模式入口保留但 RN 本轮锁定浅色，点击仅提示不生效；主题色功能下阶段接入。
import { useState } from 'react'
import Icon from '../../components/Icon'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem, getObject, setObject, removeItem } from '../../utils/storage'
import { IS_RN } from '../../utils/platform'
import Switch from '../../components/Switch'
import { useFontSizeStore } from '../../stores/fontSize'
import { useThemeStore, type ThemeMode } from '../../stores/theme'
import { useThemeColorStore } from '../../hooks/useThemeColor'
import { THEME_PRESETS } from '../../styles/themes'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import './settings.scss'

const SETTINGS_KEY = 'app_settings'

interface AppSettings {
  simpleHome: boolean
  pushEnabled: boolean
  adEnabled: boolean
  soundEnabled: boolean
  vibrateEnabled: boolean
}

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    simpleHome: false,
    pushEnabled: true,
    adEnabled: false,
    soundEnabled: true,
    vibrateEnabled: true
  })
  // 登录态：控制"注销账户/退出登录"显隐，以及"简洁首页模式"的登录门槛
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  // 字号：全局 store 为唯一来源（实时生效），不再走 app_settings
  const fontSize = useFontSizeStore((s) => s.size)
  const setFontSize = useFontSizeStore((s) => s.setSize)
  // 主题色板（全站色随模式×预设）+ 全局字号缩放
  const t = useTheme()
  const fs = useFs()
  // 主题模式（浅/深/跟随系统）
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  // 主题色选择：当前 key + setter
  const themeKey = useThemeColorStore((s) => s.key)
  const setThemeKey = useThemeColorStore((s) => s.setKey)

  useDidShow(() => {
    getObject<AppSettings>(SETTINGS_KEY).then((saved) => {
      if (saved) setSettings(saved)
    }).catch(() => { /* 默认值 */ })
    getItem('access_token').then(t => setIsLoggedIn(!!t)).catch(() => setIsLoggedIn(false))
  })

  // 保存设置（纯存储，无 DOM 操作——RN 无 document）
  const save = (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates }
    setObject(SETTINGS_KEY, next)
    setSettings(next)
  }

  // 深色模式三选：浅色 / 深色 / 跟随系统，选后全站 useTheme 即时切换（方案①深色尊重主题色）
  const MODE_LABELS = ['浅色', '深色', '跟随系统']
  const handleThemeClick = () => {
    Taro.showActionSheet({ itemList: MODE_LABELS })
      .then((res) => {
        const modes: ThemeMode[] = ['light', 'dark', 'system']
        const m = modes[res.tapIndex]
        if (m) {
          setMode(m)
          Taro.showToast({ title: `已切换${MODE_LABELS[res.tapIndex]}`, icon: 'success' })
        }
      })
      .catch(() => { /* 用户取消 */ })
  }

  // 首页模式：普通（simpleHome=false）始终可选；简洁（true）需登录，未登录弹提示
  const handleHomeMode = (simple: boolean) => {
    if (simple && !isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: '简洁首页模式需登录后使用',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            // TODO: 跳转登录页
          }
        }
      })
      return
    }
    save({ simpleHome: simple })
  }

  // 主题色选择：登录门槛（与简洁首页模式一致），选后即时生效（useTheme 全站响应）
  const handleThemeColor = () => {
    if (!isLoggedIn) {
      Taro.showModal({
        title: '提示',
        content: '主题色需登录后使用',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            // TODO: 跳转登录页
          }
        }
      })
      return
    }
    Taro.showActionSheet({ itemList: THEME_PRESETS.map((p) => p.name) })
      .then((res) => {
        const preset = THEME_PRESETS[res.tapIndex]
        if (preset) {
          setThemeKey(preset.key)
          Taro.showToast({ title: `已切换为${preset.name}`, icon: 'success' })
        }
      })
      .catch(() => { /* 用户取消 */ })
  }

  // 字体大小三档：写入全局 store，实时生效（各页 Text 通过 useFs 读取缩放）
  const handleFontSize = (s: 'small' | 'medium' | 'large') => {
    setFontSize(s)
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          removeItem(SETTINGS_KEY)
          Taro.clearStorage()
          Taro.reLaunch({ url: '/pages/home/index' })
        }
      }
    })
  }

  const handleDeleteAccount = () => {
    Taro.showModal({
      title: '注销账户',
      content: '注销后所有数据将被清除且无法恢复，确定继续？',
      confirmText: '确认注销',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorage()
          Taro.showToast({ title: '账户已注销', icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 1500)
        }
      }
    })
  }

  const checkVersion = () => {
    Taro.showModal({
      title: '版本更新',
      content: '当前版本 v1.0.0，已是最新版本。',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const callHotline = () => {
    Taro.showModal({
      title: '服务热线',
      content: '拨打 400-xxx-xxxx？',
      success: (res) => {
        if (res.confirm) {
          Taro.makePhoneCall({ phoneNumber: '400-xxx-xxxx' }).catch(() => {})
        }
      }
    })
  }

  // 震动开关：开启时触发一次轻震动反馈
  const toggleVibrate = () => {
    const next = !settings.vibrateEnabled
    save({ vibrateEnabled: next })
    if (next && IS_RN) {
      Taro.vibrateShort({ type: 'light' }).catch(() => {})
    }
  }

  return (
    <PageLayout nav={<NavBar title="设置" showBack />}>

      {/* 外观：首页模式 / 深色模式 / 字体大小（首页模式与深色模式按需求换序） */}
      <View className='section'>
        <Text className='section-title' style={{ ...fs(15), color: t.textTertiary }}>外观</Text>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          {/* 首页模式：普通（顶部搜索栏）/简洁（搜索框+快捷按钮居中）。简洁需登录 */}
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="layout_grid" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>首页模式</Text>
            </View>
            <View className='list-right'>
              <View className='font-size-picker'>
                {(
                  [
                    { key: false, label: '普通' },
                    { key: true, label: '简洁' }
                  ] as const
                ).map((opt) => (
                  <View
                    key={String(opt.key)}
                    className={settings.simpleHome === opt.key ? 'font-btn font-btn-active' : 'font-btn'}
                    style={{ backgroundColor: settings.simpleHome === opt.key ? t.primary : t.bgInput }}
                    onClick={() => handleHomeMode(opt.key)}
                  >
                    <Text
                      className={settings.simpleHome === opt.key ? 'font-btn-text font-btn-text-active' : 'font-btn-text'}
                      style={{ ...fs(13), color: settings.simpleHome === opt.key ? t.textOnPrimary : t.textSecondary }}
                    >
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* 主题色：预设色板选择（登录门槛），选后全站主色即时切换 */}
          <View className='list-item' style={{ borderBottomColor: t.border }} onClick={handleThemeColor}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="palette" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>主题色</Text>
            </View>
            <View className='list-right'>
              <View className='theme-dot' style={{ backgroundColor: t.primary }} />
              <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>{THEME_PRESETS.find((p) => p.key === themeKey)?.name}</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          </View>

          <View className='list-item' style={{ borderBottomColor: t.border }} onClick={handleThemeClick}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="moon" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>深色模式</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>{mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          </View>

          <View className='list-item list-item-last'>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Text className='list-icon-letter' style={{ ...fs(15), color: t.primaryText }}>A</Text>
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>字体大小</Text>
            </View>
            <View className='list-right'>
              <View className='font-size-picker'>
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <View
                    key={s}
                    className={fontSize === s ? 'font-btn font-btn-active' : 'font-btn'}
                    style={{ backgroundColor: fontSize === s ? t.primary : t.bgInput }}
                    onClick={() => handleFontSize(s)}
                  >
                    <Text
                      className={fontSize === s ? 'font-btn-text font-btn-text-active' : 'font-btn-text'}
                      style={{ ...fs(13), color: fontSize === s ? t.textOnPrimary : t.textSecondary }}
                    >
                      {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 消息：底层推送/广告能力未接入，开关先保留并标注"暂未上线" */}
      <View className='section'>
        <Text className='section-title' style={{ ...fs(15), color: t.textTertiary }}>消息</Text>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="bell" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>消息推送</Text>
              <Text className='list-badge' style={{ ...fs(13), color: t.textTertiary, backgroundColor: t.bgInput }}>暂未上线</Text>
            </View>
            <Switch
              checked={settings.pushEnabled}
              onChange={(v) => save({ pushEnabled: v })}
            />
          </View>
          <View className='list-item list-item-last'>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="megaphone" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>广告设置</Text>
              <Text className='list-badge' style={{ ...fs(13), color: t.textTertiary, backgroundColor: t.bgInput }}>暂未上线</Text>
            </View>
            <Switch
              checked={settings.adEnabled}
              onChange={(v) => save({ adEnabled: v })}
            />
          </View>
        </View>
      </View>

      {/* 隐私：点击进入通用文档页（合规全文见 src/content/legal.ts）。按需求与通用换序，隐私在前 */}
      <View className='section'>
        <Text className='section-title' style={{ ...fs(15), color: t.textTertiary }}>隐私</Text>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          {[
            { icon: 'shield', label: '隐私管理', type: 'privacy-manage' },
            { icon: 'file_text', label: '隐私政策', type: 'privacy-policy' },
            { icon: 'user', label: '个人信息收集清单', type: 'info-collection' },
            { icon: 'users', label: '第三方信息共享清单', type: 'third-party-share' }
          ].map((item, i, arr) => (
            <View
              key={item.label}
              className={i === arr.length - 1 ? 'list-item list-item-last' : 'list-item'}
              style={{ borderBottomColor: t.border }}
              onClick={() => Taro.navigateTo({ url: `/pages/common/doc?type=${item.type}` })}
            >
              <View className='list-left'>
                <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                  <Icon name={item.icon} size={20} color={t.primary} />
                </View>
                <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>{item.label}</Text>
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      </View>

      {/* 通用：音效（底层未接入，标注暂未上线）/ 震动（真实生效）/ 版本更新 */}
      <View className='section'>
        <Text className='section-title' style={{ ...fs(15), color: t.textTertiary }}>通用</Text>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="volume_2" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>音效</Text>
              <Text className='list-badge' style={{ ...fs(13), color: t.textTertiary, backgroundColor: t.bgInput }}>暂未上线</Text>
            </View>
            <Switch
              checked={settings.soundEnabled}
              onChange={(v) => save({ soundEnabled: v })}
            />
          </View>
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="vibrate" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>震动</Text>
            </View>
            <Switch checked={settings.vibrateEnabled} onChange={toggleVibrate} />
          </View>
          <View className='list-item list-item-last' onClick={checkVersion}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="info" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>版本更新</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>v1.0.0</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          </View>
        </View>
      </View>

      {/* 其他：服务热线；注销账户仅登录后可见（个人信息入口已移至"我的"页头像） */}
      <View className='section'>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          <View className={isLoggedIn ? 'list-item' : 'list-item list-item-last'} style={{ borderBottomColor: t.border }} onClick={callHotline}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="phone" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>服务热线</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>400-xxx-xxxx</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          </View>
          {isLoggedIn && (
            <View className='list-item list-item-last' onClick={handleDeleteAccount}>
              <View className='list-left'>
                <View className='list-icon list-icon-danger' style={{ backgroundColor: t.danger + '22' }}>
                  <Icon name="trash" size={20} color={t.danger} />
                </View>
                <Text className='list-label list-label-danger' style={{ ...fs(15), color: t.danger }}>注销账户</Text>
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          )}
        </View>
      </View>

      {/* 退出登录：仅登录后可见 */}
      {isLoggedIn && (
        <View className='section'>
          <View className='list' style={{ backgroundColor: t.bgCard }}>
            <View className='list-item list-item-last list-item-center' onClick={handleLogout}>
              <Icon name="log_out" size={18} color={t.danger} />
              <Text className='list-label-danger logout-text' style={{ ...fs(15), color: t.danger }}>退出登录</Text>
            </View>
          </View>
        </View>
      )}

      <Text className='footer' style={{ ...fs(13), color: t.textTertiary }}>
        登录即表示同意
        <Text className='link' style={{ color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=user-agreement' })}>《用户协议》</Text>
        和
        <Text className='link' style={{ color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=privacy-policy' })}>《隐私政策》</Text>
      </Text>
    </PageLayout>
  )
}
