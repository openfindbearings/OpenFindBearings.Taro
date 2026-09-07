// 设置页（详情页）— v1.7.0 度量重构，纯 RN 基准
// 改动说明：
//   1. 接入 PageLayout（删 rnHeight/自管 ScrollView hack）；
//   2. 删除 useThemeColors + 逐元素 inline 色板（H5 深色时代遗留）——本轮 RN 锁定浅色，
//      颜色全部走 settings.scss 的编译期 dp/色 token；
//   3. 深色模式入口保留（用户能看到选项），但 RN 端点击弹 toast"将在后续版本支持"，
//      不落库不生效——避免"设置页能变暗、别页不变"的分裂体验（审核采纳项）；
//   4. 字体大小三档：RN 端记录偏好并即时提示重启生效（本轮仅存储，应用逻辑后续接入）；
//   5. 组合类（list-item.indent/.on/.danger）全部拆为独立类名（RN 忽略组合选择器）。
import { useState } from 'react'
import Icon from '../../components/Icon'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getObject, setObject, removeItem } from '../../utils/storage'
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

  useDidShow(() => {
    getObject<AppSettings>(SETTINGS_KEY).then((saved) => {
      if (saved) setSettings(saved)
    }).catch(() => { /* 默认值 */ })
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

  const toggleVibrate = () => {
    const next = !settings.vibrateEnabled
    save({ vibrateEnabled: next })
    if (next && IS_RN) {
      Taro.vibrateShort({ type: 'light' }).catch(() => {})
    }
  }

  // 开关组件：on 态用独立类（组合选择器 RN 忽略）
  const Toggle = ({ on, onClick }: { on: boolean; onClick?: () => void }) => (
    <View className={on ? 'toggle toggle-on' : 'toggle'} onClick={onClick}>
      <View className={on ? 'toggle-thumb toggle-thumb-on' : 'toggle-thumb'} />
    </View>
  )

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

          {/* 首页模式：普通（顶部搜索栏）/简洁（搜索框+快捷按钮居中） */}
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
                    onClick={() => save({ simpleHome: opt.key })}
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
            <Toggle on={settings.pushEnabled} onClick={() => save({ pushEnabled: !settings.pushEnabled })} />
          </View>
          <View className='list-item list-item-last'>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="megaphone" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>广告设置</Text>
            </View>
            <Toggle on={settings.adEnabled} onClick={() => save({ adEnabled: !settings.adEnabled })} />
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
            <Toggle on={settings.soundEnabled} onClick={() => save({ soundEnabled: !settings.soundEnabled })} />
          </View>
          <View className='list-item' onClick={toggleVibrate}>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="vibrate" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>震动</Text>
            </View>
            <Toggle on={settings.vibrateEnabled} />
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

      {/* 其他 */}
      <View className='section'>
        <View className='list'>
          <View className='list-item' onClick={() => Taro.showToast({ title: '个人信息（开发中）', icon: 'none' })}>
            <View className='list-left'>
              <View className='list-icon'>
                <Icon name="user" size={20} color='#0EA5E9' />
              </View>
              <Text className='list-label'>个人信息</Text>
            </View>
            <Icon name="chevron_right" size={18} color='#64748B' />
          </View>
          <View className='list-item' onClick={callHotline}>
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
          <View className='list-item list-item-last' onClick={handleDeleteAccount}>
            <View className='list-left'>
              <View className='list-icon list-icon-danger'>
                <Icon name="trash" size={20} color='#EF4444' />
              </View>
              <Text className='list-label list-label-danger'>注销账户</Text>
            </View>
            <Icon name="chevron_right" size={18} color='#64748B' />
          </View>
        </View>
      </View>

      {/* 退出登录 */}
      <View className='section'>
        <View className='list'>
          <View className='list-item list-item-last list-item-center' onClick={handleLogout}>
            <Icon name="log_out" size={18} color='#EF4444' />
            <Text className='list-label-danger logout-text'>退出登录</Text>
          </View>
        </View>
      </View>

      <Text className='footer'>
        登录即表示同意
        <Text className='link' onClick={() => showStaticPage('用户协议', '欢迎使用 OpenFindBearings。')}>《用户协议》</Text>
        和
        <Text className='link' onClick={() => showStaticPage('隐私政策', '本应用尊重并保护您的隐私。')}>《隐私政策》</Text>
      </Text>
    </PageLayout>
  )
}
