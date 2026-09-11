// 应用启动共享引导逻辑（app.tsx 与 app.rn.tsx 两个入口共用）
// 改动说明：RN 端 Metro 解析 ./app 时命中 app.rn.tsx（平台后缀优先），导致只加在
// app.tsx 里的登录态恢复/隐私弹窗/主题字体初始化在 RN 上从未执行（冷启动丢登录的根因）。
// 启动逻辑收敛到本文件，两个入口统一调用，杜绝再次漂移。
import Taro from '@tarojs/taro'
import { getItem, setItem } from './utils/storage'
import { initFontSize } from './stores/fontSize'
import { initTheme } from './stores/theme'
import { initThemeColor } from './hooks/useThemeColor'
import { useAuthStore } from './stores/auth'

// 预读商家入驻状态存入 globalData，供 CustomTabBar 首次渲染时同步读取
// 修复商家 tab 冷启动时图标从普通样式跳变为大圆 logo 的闪烁问题
export function preloadMerchantState() {
  Promise.all([
    getItem('merchant_approved'),
    getItem('merchant_logo'),
    getItem('merchant_name')
  ]).then(([approved, logo, name]) => {
    const app = Taro.getApp() as any
    if (app) {
      app.globalData = app.globalData || {}
      // 严格字符串比较（getItem 恒返回 string|null），避免 "false" 字符串被 !! 判为 true
      app.globalData.merchantApproved = approved === 'true'
      app.globalData.merchantLogo = logo || null
      app.globalData.merchantName = name || '商家'
    }
  }).catch(() => { /* 读取失败时 CustomTabBar 自行兜底，默认未入驻 */ })
}

// 首启隐私政策同意弹窗（合规：PIPL 要求收集个人信息前取得用户同意）
// 说明：本期为软门槛——未同意仍可匿名浏览查询，仅登录/入驻等有个人信息场景在各自页再行勾选；
// showModal 无法内嵌可点链接，此处文案引导，完整可点协议见注册页与设置页协议入口。
const PRIVACY_CONSENT_KEY = 'privacy_consent'
export function showPrivacyConsentOnce() {
  getItem(PRIVACY_CONSENT_KEY)
    .then((v) => {
      if (v === 'true') return
      Taro.showModal({
        title: '隐私保护提示',
        content: '欢迎使用本应用。请阅读并同意《用户协议》与《隐私政策》后再使用登录、收藏、入驻等功能。',
        confirmText: '同意',
        cancelText: '暂不',
        success: (res) => {
          if (res.confirm) setItem(PRIVACY_CONSENT_KEY, 'true')
        }
      })
    })
    .catch(() => { /* 读取失败忽略 */ })
}

/** bootDone 防止两个入口路径（didMount 双触发等）重复执行引导 */
let bootDone = false

/**
 * 应用启动引导（一次性）：预读商家状态、隐私弹窗、主题/字体初始化、恢复登录态。
 * init 以持久 refresh_token 为准恢复 isLoggedIn 并补拉 profile。
 */
export function bootOnce() {
  if (bootDone) return
  bootDone = true
  preloadMerchantState()
  showPrivacyConsentOnce()
  initFontSize()
  initTheme()
  initThemeColor()
  void useAuthStore.getState().init()
}
