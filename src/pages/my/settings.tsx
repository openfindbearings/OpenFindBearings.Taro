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
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem, getObject, setObject, removeItem } from '../../utils/storage'
import { IS_RN } from '../../utils/platform'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
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

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    simpleHome: false,
    fontSize: 'medium',
    pushEnabled: true,
    adEnabled: false,
    soundEnabled: true,
    vibrateEnabled: true
  })
  // 登录态：控制"注销账户/退出登录"显隐，以及"简洁首页模式"的登录门槛
  const [isLoggedIn, setIsLoggedIn] = useState(false)

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

  // 深色模式入口：RN 本轮锁定浅色，仅提示不生效（第二阶段 H5 适配时恢复完整实现）
  const handleThemeClick = () => {
    if (IS_RN) {
      Taro.showToast({ title: '深色模式将在后续版本支持', icon: 'none' })
      return
    }
    Taro.showToast({ title: '深色模式开发中', icon: 'none' })
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

  // 字体大小三档：存偏好；RN 提示重启生效（应用逻辑后续接入）
  const handleFontSize = (s: 'small' | 'medium' | 'large') => {
    save({ fontSize: s })
    if (IS_RN) {
      Taro.showToast({ title: '字体大小将在下次启动生效', icon: 'none' })
    }
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

  const showStaticPage = (title: string, content: string) => {
    Taro.showModal({ title, content, showCancel: false, confirmText: '我知道了' })
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

      {/* 外观 */}
      <View className='section'>
        <Text className='section-title'>外观</Text>
        <View className='list'>
          <View className='list-item' onClick={handleThemeClick}>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="moon" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>深色模式</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>后续支持</Text>
              <Icon name="chevron_right" size={18} color='#64748B' />
            </View>
          </View>

          {/* 首页模式：普通（顶部搜索栏）/简洁（搜索框+快捷按钮居中）。简洁需登录 */}
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="layout_grid" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>首页模式</Text>
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
                    onClick={() => handleHomeMode(opt.key)}
                  >
                    <Text className={settings.simpleHome === opt.key ? 'font-btn-text font-btn-text-active' : 'font-btn-text'}>
                      {opt.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className='list-item list-item-last'>
            <View className='list-left'>
              <View className='list-icon'>
                <Text className='list-icon-letter'>A</Text>
              </View>
              <Text className='list-label'>字体大小</Text>
            </View>
            <View className='list-right'>
              <View className='font-size-picker'>
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <View
                    key={s}
                    className={settings.fontSize === s ? 'font-btn font-btn-active' : 'font-btn'}
                    onClick={() => handleFontSize(s)}
                  >
                    <Text className={settings.fontSize === s ? 'font-btn-text font-btn-text-active' : 'font-btn-text'}>
                      {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 消息 */}
      <View className='section'>
        <Text className='section-title'>消息</Text>
        <View className='list'>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="bell" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>消息推送</Text>
            </View>
            <Switch
              checked={settings.pushEnabled}
              color='#0EA5E9'
              onChange={(e) => save({ pushEnabled: e.detail.value })}
            />
          </View>
          <View className='list-item list-item-last'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="megaphone" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>广告设置</Text>
            </View>
            <Switch
              checked={settings.adEnabled}
              color='#0EA5E9'
              onChange={(e) => save({ adEnabled: e.detail.value })}
            />
          </View>
        </View>
      </View>

      {/* 通用 */}
      <View className='section'>
        <Text className='section-title'>通用</Text>
        <View className='list'>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="volume_2" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>音效</Text>
            </View>
            <Switch
              checked={settings.soundEnabled}
              color='#0EA5E9'
              onChange={(e) => save({ soundEnabled: e.detail.value })}
            />
          </View>
          <View className='list-item'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="vibrate" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>震动</Text>
            </View>
            <Switch checked={settings.vibrateEnabled} color='#0EA5E9' onChange={toggleVibrate} />
          </View>
          <View className='list-item list-item-last' onClick={checkVersion}>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="info" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>版本更新</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>v1.0.0</Text>
              <Icon name="chevron_right" size={18} color='#64748B' />
            </View>
          </View>
        </View>
      </View>

      {/* 隐私 */}
      <View className='section'>
        <Text className='section-title'>隐私</Text>
        <View className='list'>
          {[
            { icon: 'shield', label: '隐私管理', desc: '您可以在隐私管理中控制个人信息的使用范围。' },
            { icon: 'file_text', label: '隐私政策', desc: '本应用尊重并保护您的隐私。我们仅收集必要的产品信息以提供轴承查询服务。' },
            { icon: 'user', label: '个人信息收集清单', desc: '我们收集以下信息：账户信息、设备信息、使用数据。' },
            { icon: 'users', label: '第三方信息共享清单', desc: '我们与云服务和统计分析服务共享必要信息，不会出售您的个人信息。' }
          ].map((item, i, arr) => (
            <View
              key={item.label}
              className={i === arr.length - 1 ? 'list-item list-item-last' : 'list-item'}
              onClick={() => showStaticPage(item.label, item.desc)}
            >
              <View className='list-left'>
                <View className='list-icon'>
                  <Icon name={item.icon} size={20} color='#0EA5E9' />
                </View>
                <Text className='list-label'>{item.label}</Text>
              </View>
              <Icon name="chevron_right" size={18} color='#64748B' />
            </View>
          ))}
        </View>
      </View>

      {/* 其他：服务热线；注销账户仅登录后可见（个人信息入口已移至"我的"页头像） */}
      <View className='section'>
        <View className='list'>
          <View className={isLoggedIn ? 'list-item' : 'list-item list-item-last'} onClick={callHotline}>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="phone" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>服务热线</Text>
            </View>
            <View className='list-right'>
              <Text className='list-value'>400-xxx-xxxx</Text>
              <Icon name="chevron_right" size={18} color='#64748B' />
            </View>
          </View>
          {isLoggedIn && (
            <View className='list-item list-item-last' onClick={handleDeleteAccount}>
              <View className='list-left'>
                <View className='list-icon list-icon-danger'>
                  <Icon name="trash" size={20} color='#EF4444' />
                </View>
                <Text className='list-label list-label-danger'>注销账户</Text>
              </View>
              <Icon name="chevron_right" size={18} color='#64748B' />
            </View>
          )}
        </View>
      </View>

      {/* 退出登录：仅登录后可见 */}
      {isLoggedIn && (
        <View className='section'>
          <View className='list'>
            <View className='list-item list-item-last list-item-center' onClick={handleLogout}>
              <Icon name="log_out" size={18} color='#EF4444' />
              <Text className='list-label-danger logout-text'>退出登录</Text>
            </View>
          </View>
        </View>
      )}

      <Text className='footer'>
        登录即表示同意
        <Text className='link' onClick={() => showStaticPage('用户协议', '欢迎使用 OpenFindBearings。')}>《用户协议》</Text>
        和
        <Text className='link' onClick={() => showStaticPage('隐私政策', '本应用尊重并保护您的隐私。')}>《隐私政策》</Text>
      </Text>
    </PageLayout>
  )
}
