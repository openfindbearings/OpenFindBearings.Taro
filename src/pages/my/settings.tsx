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
import { getObject, setObject } from '../../utils/storage'
import { showConfirmDialog } from '../../components/ConfirmDialog'
// 改动说明：toggleVibrate 移除后 IS_RN 不再使用，删除导入避免未引用告警
import Switch from '../../components/Switch'
import { useFontSizeStore } from '../../stores/fontSize'
import { useThemeStore, type ThemeMode } from '../../stores/theme'
import { useThemeColorStore } from '../../hooks/useThemeColor'
import { THEME_PRESETS } from '../../styles/themes'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { checkUpdateManually, isAutoUpdateEnabled, setAutoUpdateEnabled } from '../../services/update'
import { deactivateAccount } from '../../services/user'
import { vibrateTap } from '../../utils/haptics'
import { getAppVersion } from '../../utils/version'
import './settings.scss'

const SETTINGS_KEY = 'app_settings'

/** 首页模式：普通 / 简洁 / 智能 */
type HomeMode = 'normal' | 'simple' | 'smart'

interface AppSettings {
  /** 首页模式（主字段） */
  homeMode: HomeMode
  /** 旧字段：简洁模式布尔，保留做兼容写入（homeMode==='simple' 时为 true） */
  simpleHome: boolean
  pushEnabled: boolean
  adEnabled: boolean
  // 改动说明（v1.7.13）：音效开关真实生效（新消息轮询提醒），恢复为正式字段
  soundEnabled: boolean
  vibrateEnabled: boolean
}

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    homeMode: 'normal',
    simpleHome: false,
    pushEnabled: true,
    adEnabled: false,
    soundEnabled: true,
    vibrateEnabled: true
  })
  // 启动时自动检查更新（设备级本地开关，默认开；v1.7.6 新增）
  const [autoUpdate, setAutoUpdate] = useState(true)
  // 登录态：控制"注销账户/退出登录"显隐，以及"简洁首页模式"的登录门槛
  // 改动说明：由本地 useState + useDidShow 读 storage，改为订阅 auth store（唯一事实源）——
  // 登录成功返回、登出、冷启动 init 恢复均即时响应，不再依赖页面显示时序与 storage 读取
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  // 改动说明：未登录时首页模式一律显示"普通"（与首页 effectiveMode 降级一致），
  // 登录态变化即时响应；已存的个性化模式在登录后恢复显示
  const displayHomeMode: HomeMode = isLoggedIn ? settings.homeMode : 'normal'
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
      if (saved) {
        // 迁移：优先 homeMode；无则由旧 simpleHome 推导
        const homeMode: HomeMode = saved.homeMode ?? (saved.simpleHome ? 'simple' : 'normal')
        setSettings({ ...saved, homeMode })
      }
    }).catch(() => { /* 默认值 */ })
    // 改动说明（v1.7.6）：启动自动检查开关为设备级本地设置（services/update 存储），单独读取
    isAutoUpdateEnabled().then(setAutoUpdate).catch(() => { /* 默认开 */ })
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

  // 改动说明：首页模式整组上登录门槛——未登录只能保持"普通"（原仅简洁受限，
  // 智能反而可设，与"个性化设置属登录用户"的语义矛盾）。写 homeMode（主）+ simpleHome（旧字段兼容）
  const handleHomeMode = (mode: HomeMode) => {
    if (mode !== 'normal' && !isLoggedIn) {
      showConfirmDialog({ title: '提示', content: '首页模式需登录后设置', confirmText: '去登录' }).then((ok) => {
        if (ok) Taro.navigateTo({ url: '/pages/auth/login' })
      })
      return
    }
    save({ homeMode: mode, simpleHome: mode === 'simple' })
  }

  // 主题色选择：登录门槛（与简洁首页模式一致），选后即时生效（useTheme 全站响应）
  const handleThemeColor = () => {
    if (!isLoggedIn) {
      showConfirmDialog({ title: '提示', content: '主题色需登录后使用', confirmText: '去登录' }).then((ok) => {
        if (ok) Taro.navigateTo({ url: '/pages/auth/login' })
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
    showConfirmDialog({ title: '退出登录', content: '确定要退出当前账号吗？', confirmColor: '#EF4444' }).then((ok) => {
      if (ok) {
        // 改动说明：统一走 auth store 的 logout（先吊销服务端刷新令牌，再清本地 access/refresh 与展示信息），
        // 设备身份 device_id 与隐私同意保留，不整体 clearStorage。
        ;(async () => {
          // store 的 logout 内部已置 isLoggedIn:false，页面订阅自动响应，无需本地状态
          await useAuthStore.getState().logout()
          Taro.reLaunch({ url: '/pages/home/index' })
        })()
      }
    })
  }

  // 注销账户（v1.7.12）：真注销——先调服务端（守卫+关系清理+Identity 禁用吊销），
  // 成功后再清本地登录态。原实现仅 clearStorage 属"假注销"（服务端账号完好），文案与行为不符。
  // 唯一管理员商户被拦截时，服务端 message（含商户名与转让指引）弹窗原样呈现
  const handleDeleteAccount = () => {
    showConfirmDialog({
      title: '注销账户',
      content: '注销后账号将无法登录，收藏/关注/消息等个人数据将被清除；30 天冷静期内可联系客服撤销，期满数据匿名化不可恢复。若仍是某商户唯一管理员，需先转让管理员。',
      confirmText: '确认注销',
      confirmColor: '#EF4444'
    }).then(async (ok) => {
      if (!ok) return
      try {
        const r = await deactivateAccount()
        if (r?.success) {
          // 服务端已禁用账号并吊销全部令牌；本地清登录态并回首页
          await useAuthStore.getState().logout()
          Taro.showToast({ title: '账户已注销', icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 1500)
        } else {
          showConfirmDialog({
            title: '无法注销',
            content: r?.message || '注销失败，请稍后重试',
            confirmText: '知道了',
            showCancel: false
          })
        }
      } catch (e: any) {
        showConfirmDialog({
          title: '无法注销',
          content: e?.message || '注销失败，请稍后重试',
          confirmText: '知道了',
          showCancel: false
        })
      }
    })
  }

  // 改动说明：原硬编码"已是最新版本"占位，接入后端版本检查（BFF /mobile/version/check）。
  // 三端策略与启动检查共用 services/update：RN 真实比较+应用内下载安装，H5/小程序给确定性指引
  const checkVersion = () => {
    void checkUpdateManually()
  }

  const callHotline = () => {
    showConfirmDialog({ title: '服务热线', content: '拨打 400-xxx-xxxx？' }).then((ok) => {
      if (ok) Taro.makePhoneCall({ phoneNumber: '400-xxx-xxxx' }).catch(() => {})
    })
  }

  // 改动说明：震动改为停用态后，原 toggleVibrate（含 RN 震动反馈）不再被引用，已移除

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
                    { key: 'normal', label: '普通' },
                    { key: 'simple', label: '简洁' },
                    { key: 'smart', label: '智能' }
                  ] as const
                ).map((opt) => (
                  <View
                    key={opt.key}
                    className={displayHomeMode === opt.key ? 'font-btn font-btn-active' : 'font-btn'}
                    style={{ backgroundColor: displayHomeMode === opt.key ? t.primary : t.bgInput }}
                    onClick={() => handleHomeMode(opt.key)}
                  >
                    <Text
                      className={displayHomeMode === opt.key ? 'font-btn-text font-btn-text-active' : 'font-btn-text'}
                      style={{ ...fs(13), color: displayHomeMode === opt.key ? t.textOnPrimary : t.textSecondary }}
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
            {/* 改动说明：底层推送未接入，开关做真停用态且恒显示关闭（与广告设置一致，避免"停用却开着"的矛盾观感） */}
            <Switch
              checked={false}
              disabled
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
              disabled
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

      {/* 通用：音效（新消息轮询提醒，三端分策：H5 合成音/小程序 wav/RN 以震动替代）/
          震动（应用级触感开关）/ 版本更新。
          改动说明（v1.7.13）：两开关均真实生效——即使系统声音/触感开启，用户也可在本 App 内
          强制静音/静震（iOS 键盘触感同思路）；原"暂未上线"占位态移除 */}
      <View className='section'>
        <Text className='section-title' style={{ ...fs(15), color: t.textTertiary }}>通用</Text>
        <View className='list' style={{ backgroundColor: t.bgCard }}>
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="volume_2" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>音效</Text>
            </View>
            <Switch checked={settings.soundEnabled} onChange={(v) => save({ soundEnabled: v })} />
          </View>
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="vibrate" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>震动</Text>
            </View>
            <Switch checked={settings.vibrateEnabled} onChange={(v) => { save({ vibrateEnabled: v }); if (v) void vibrateTap() }} />
          </View>
          {/* 改动说明（v1.7.6）：启动自动检查开关——关闭后开屏不再静默检查（设置页手动检查不受影响） */}
          <View className='list-item' style={{ borderBottomColor: t.border }}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="refresh-cw" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>启动时自动检查更新</Text>
            </View>
            <Switch
              checked={autoUpdate}
              onChange={(v) => { setAutoUpdate(v); void setAutoUpdateEnabled(v) }}
            />
          </View>
          <View className='list-item list-item-last' onClick={checkVersion}>
            <View className='list-left'>
              <View className='list-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="info" size={20} color={t.primary} />
              </View>
              <Text className='list-label' style={{ ...fs(15), color: t.textPrimary }}>版本更新</Text>
            </View>
            <View className='list-right'>
              {/* 改动说明：版本号从单一来源 utils/version 读取（RN 安装包 versionName / H5 编译常量），不再写死 */}
              <Text className='list-value' style={{ ...fs(13), color: t.textTertiary }}>v{getAppVersion()}</Text>
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

      {/* 退出登录：仅登录后可见。改动说明（v1.7.12）：由红字列表项改主题色全宽按钮——
          与"注销账户"（红字危险项）拉开视觉层级，防误点，对齐主流设置页退出按钮惯例 */}
      {isLoggedIn && (
        <View className='section'>
          <View className='logout-btn' style={{ backgroundColor: t.primary }} onClick={handleLogout}>
            <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>退出登录</Text>
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
